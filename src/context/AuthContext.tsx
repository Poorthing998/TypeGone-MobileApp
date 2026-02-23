import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import * as Linking from 'expo-linking';
import type { Session, User } from '@supabase/supabase-js';

type Profile = {
    id: string;
    email: string;
    display_name: string;
    role: string;
    words_used: number;
    recordings_used: number;
    paid_recordings: number;
};

type AuthState = {
    session: Session | null;
    user: User | null;
    profile: Profile | null;
    loading: boolean;
    profileError: string | null;
    signIn: () => Promise<void>;
    signOut: () => Promise<void>;
    refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
    session: null,
    user: null,
    profile: null,
    loading: true,
    profileError: null,
    signIn: async () => { },
    signOut: async () => { },
    refreshProfile: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [loading, setLoading] = useState(true);
    const [profileError, setProfileError] = useState<string | null>(null);

    useEffect(() => {
        // Restore session on mount
        supabase.auth.getSession().then(({ data: { session: s }, error }) => {
            if (error) console.log('[Auth] getSession error:', error.message);
            console.log('[Auth] Restored session:', s ? s.user?.email : 'none');
            setSession(s);
            if (s?.user) {
                fetchProfile(s.user.id);
                syncSessionToNative(s);
            }
            setLoading(false);
        });

        // Listen for auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
            console.log('[Auth] State changed:', _event, s?.user?.email);
            setSession(s);
            if (s?.user) {
                fetchProfile(s.user.id);
                syncSessionToNative(s);
            } else {
                setProfile(null);
            }
        });

        // Listen for deep link callback with OAuth tokens
        const handleDeepLink = (event: { url: string }) => {
            console.log('[Auth] Deep link received:', event.url.substring(0, 60) + '...');
            handleOAuthURL(event.url);
        };
        const linkSub = Linking.addEventListener('url', handleDeepLink);

        // Check if app was opened via deep link
        Linking.getInitialURL().then((url) => {
            if (url) {
                console.log('[Auth] Initial URL:', url.substring(0, 60) + '...');
                handleOAuthURL(url);
            }
        });

        return () => {
            subscription.unsubscribe();
            linkSub.remove();
        };
    }, []);

    async function handleOAuthURL(url: string) {
        if (!url.includes('access_token') || !url.includes('refresh_token')) return;

        try {
            const fragment = url.split('#')[1];
            if (!fragment) return;

            const params = new URLSearchParams(fragment);
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');

            if (accessToken && refreshToken) {
                console.log('[Auth] Setting session from deep link tokens...');
                const { data, error } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                });
                if (error) {
                    console.error('[Auth] setSession error:', error.message);
                    setProfileError('Auth error: ' + error.message);
                } else if (data.session) {
                    console.log('[Auth] Session set for:', data.user?.email);
                    setSession(data.session);
                    if (data.user) fetchProfile(data.user.id);
                    syncSessionToNative(data.session);
                }
            }
        } catch (e: any) {
            console.error('[Auth] Deep link auth error:', e.message);
        }
    }

    async function fetchProfile(userId: string) {
        console.log('[Auth] Fetching profile for:', userId);
        setProfileError(null);
        try {
            const { data, error, status } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            console.log('[Auth] Profile response:', { data: data ? 'found' : 'null', error: error?.message, status });

            if (error) {
                setProfileError(`Profile fetch error (${status}): ${error.message}`);
                console.error('[Auth] Profile error:', error.message, error.details, error.hint);

                // If profile doesn't exist yet, try to create it
                if (status === 406 || error.code === 'PGRST116') {
                    console.log('[Auth] Profile not found, creating...');
                    await createProfile(userId);
                }
            } else if (data) {
                console.log('[Auth] Profile loaded:', data.display_name, 'words:', data.words_used, 'recordings:', data.recordings_used);
                setProfile(data);
            }
        } catch (e: any) {
            setProfileError('Network error: ' + e.message);
            console.error('[Auth] Profile fetch exception:', e.message);
        }
    }

    async function createProfile(userId: string) {
        try {
            const { data: { session: s } } = await supabase.auth.getSession();
            const user = s?.user;
            if (!user) return;

            const { data, error } = await supabase.from('profiles').upsert({
                id: user.id,
                email: user.email,
                display_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email,
                role: 'user',
                words_used: 0,
                recordings_used: 0,
                paid_recordings: 0,
            }, { onConflict: 'id', ignoreDuplicates: true }).select().single();

            if (error) {
                console.error('[Auth] Profile create error:', error.message);
            } else if (data) {
                console.log('[Auth] Profile created:', data.display_name);
                setProfile(data);
            }
        } catch (e: any) {
            console.error('[Auth] Profile create exception:', e.message);
        }
    }

    async function syncSessionToNative(s: Session) {
        try {
            const DefaultPreference = require('react-native-default-preference').default;
            await DefaultPreference.setName('typegone_prefs');
            await DefaultPreference.set('supabase_token', s.access_token);
            await DefaultPreference.set('supabase_refresh_token', s.refresh_token);
            console.log('[Auth] Token + refresh_token synced to native SharedPreferences');
        } catch (e: any) {
            console.log('[Auth] Native sync skipped:', e.message);
        }
    }

    async function signIn() {
        try {
            const redirectUrl = Linking.createURL('auth/callback');
            console.log('[Auth] Redirect URL:', redirectUrl);

            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectUrl,
                    skipBrowserRedirect: true,
                },
            });

            if (error) {
                console.error('[Auth] Sign in error:', error.message);
                Alert.alert('Sign In Error', error.message);
                return;
            }

            if (data.url) {
                console.log('[Auth] Opening OAuth URL...');
                await Linking.openURL(data.url);
            }
        } catch (e: any) {
            console.error('[Auth] Sign in exception:', e.message);
            Alert.alert('Sign In Error', e.message);
        }
    }

    async function signOut() {
        await supabase.auth.signOut();
        setSession(null);
        setProfile(null);
        setProfileError(null);
        try {
            const DefaultPreference = require('react-native-default-preference').default;
            await DefaultPreference.setName('typegone_prefs');
            await DefaultPreference.set('supabase_token', '');
        } catch { }
    }

    async function refreshProfile() {
        if (session?.user) await fetchProfile(session.user.id);
    }

    return (
        <AuthContext.Provider
            value={{
                session,
                user: session?.user ?? null,
                profile,
                loading,
                profileError,
                signIn,
                signOut,
                refreshProfile,
            }}>
            {children}
        </AuthContext.Provider>
    );
}
