import React, { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Alert, Switch,
    NativeModules,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Nav = NativeStackNavigationProp<any>;

const FREE_WORD_LIMIT = 5000;

export function SettingsScreen() {
    const navigation = useNavigation<Nav>();
    const { user, profile, profileError, signOut, refreshProfile } = useAuth();
    const [usage, setUsage] = useState<any>(null);
    const [isDarkTheme, setIsDarkTheme] = useState(true);

    useFocusEffect(
        useCallback(() => {
            refreshProfile();
            checkUsage();
            loadTheme();
        }, [])
    );

    const loadTheme = async () => {
        try {
            const DefaultPreference = require('react-native-default-preference').default;
            await DefaultPreference.setName('typegone_prefs');
            const theme = await DefaultPreference.get('keyboard_theme');
            setIsDarkTheme(theme !== 'light');
        } catch {
            setIsDarkTheme(true);
        }
    };

    const toggleTheme = async (dark: boolean) => {
        setIsDarkTheme(dark);
        try {
            const DefaultPreference = require('react-native-default-preference').default;
            await DefaultPreference.setName('typegone_prefs');
            await DefaultPreference.set('keyboard_theme', dark ? 'dark' : 'light');
        } catch { }
    };

    const checkUsage = async () => {
        if (!user) return;
        try {
            const { data, error } = await supabase.rpc('check_usage', { p_user_id: user.id });
            if (error) console.log('[Settings] check_usage error:', error.message);
            if (data) setUsage(data);
        } catch (e: any) {
            console.log('[Settings] check_usage exception:', e.message);
        }
    };

    const handleSignOut = () => {
        Alert.alert('Sign Out', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: signOut },
        ]);
    };

    const isUnlimited = profile?.role === 'admin' || profile?.role === 'owner';
    const wordsUsed = profile?.words_used ?? 0;
    const recordingsUsed = profile?.recordings_used ?? 0;
    const paidRecordings = profile?.paid_recordings ?? 0;
    const usagePercent = isUnlimited ? 0 : Math.min(100, (wordsUsed / FREE_WORD_LIMIT) * 100);

    return (
        <View style={s.bg}>
            <StatusBar barStyle="light-content" backgroundColor="#09090B" />
            <ScrollView contentContainerStyle={s.scroll}>

                {/* Profile Card */}
                <View style={s.card}>
                    <View style={s.avatar}>
                        <Text style={s.avatarText}>
                            {(profile?.display_name || user?.email || 'U').charAt(0).toUpperCase()}
                        </Text>
                    </View>
                    <Text style={s.name}>{profile?.display_name || 'User'}</Text>
                    <Text style={s.email}>{user?.email}</Text>
                    {profile?.role && profile.role !== 'user' && (
                        <View style={s.roleBadge}>
                            <Text style={s.roleText}>{profile.role.toUpperCase()}</Text>
                        </View>
                    )}
                </View>

                {/* Connection Error */}
                {profileError && (
                    <View style={s.errorCard}>
                        <Text style={s.errorH}>Connection Issue</Text>
                        <Text style={s.errorText}>{profileError}</Text>
                        <TouchableOpacity style={s.retryBtn} onPress={refreshProfile}>
                            <Text style={s.retryText}>Retry</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Usage Stats */}
                <View style={s.card}>
                    <Text style={s.cardH}>Usage</Text>
                    {isUnlimited ? (
                        <View style={s.unlimitedBanner}>
                            <Text style={s.unlimitedText}>Unlimited Access</Text>
                        </View>
                    ) : (
                        <>
                            <Text style={s.usageLabel}>
                                Free words: {wordsUsed.toLocaleString()} / {FREE_WORD_LIMIT.toLocaleString()}
                            </Text>
                            <View style={s.progressBg}>
                                <View style={[s.progressFill, { width: `${usagePercent}%` }]} />
                            </View>
                            {usage && !usage.allowed && (
                                <View style={s.limitBanner}>
                                    <Text style={s.limitText}>
                                        Free limit reached. Purchase recordings to continue.
                                    </Text>
                                </View>
                            )}
                        </>
                    )}
                    <View style={s.statRow}>
                        <Stat label="Words" value={wordsUsed.toLocaleString()} />
                        <Stat label="Recordings" value={recordingsUsed.toString()} />
                        <Stat label="Paid Credits" value={paidRecordings.toString()} />
                    </View>
                </View>

                {/* Buy Credits */}
                <TouchableOpacity style={s.goldItem} activeOpacity={0.8}
                    onPress={() => navigation.navigate('Payment')}>
                    <Text style={s.goldText}>Buy Recording Credits</Text>
                    <Text style={s.goldSub}>5 USDT = 200 recordings</Text>
                </TouchableOpacity>

                {/* Keyboard Theme Toggle */}
                <View style={s.themeRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={s.menuText}>Keyboard Theme</Text>
                        <Text style={s.themeSub}>
                            {isDarkTheme ? 'Dark' : 'Light'} — switch keyboards to apply
                        </Text>
                    </View>
                    <View style={s.themeToggle}>
                        <Text style={[s.themeLabel, !isDarkTheme && s.themeLabelActive]}>☀</Text>
                        <Switch
                            value={isDarkTheme}
                            onValueChange={toggleTheme}
                            trackColor={{ false: '#B0B0B5', true: '#3A3A3C' }}
                            thumbColor={isDarkTheme ? '#E8A83E' : '#FFFFFF'}
                        />
                        <Text style={[s.themeLabel, isDarkTheme && s.themeLabelActive]}>🌙</Text>
                    </View>
                </View>

                {/* Voice Modes */}
                <TouchableOpacity style={s.menuItem} activeOpacity={0.8}
                    onPress={() => navigation.navigate('Modes')}>
                    <Text style={s.menuText}>Manage Voice Modes</Text>
                    <Text style={s.menuArrow}>›</Text>
                </TouchableOpacity>

                {/* How to Use */}
                <View style={s.card}>
                    <Text style={s.cardH}>How to Use</Text>
                    <Step n="1" t='Settings > System > Keyboard > enable "TypeGone Voice"' />
                    <Step n="2" t="Open any app (WhatsApp, Gmail, etc.)" />
                    <Step n="3" t='Switch to TypeGone keyboard using the keyboard icon' />
                    <Step n="4" t='Tap "MIC", speak, tap "STOP" — done!' />
                </View>

                {/* Sign Out */}
                <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut} activeOpacity={0.85}>
                    <Text style={s.signOutText}>Sign Out</Text>
                </TouchableOpacity>

            </ScrollView>
        </View>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <View style={s.stat}>
            <Text style={s.statVal}>{value}</Text>
            <Text style={s.statLabel}>{label}</Text>
        </View>
    );
}

function Step({ n, t }: { n: string; t: string }) {
    return (
        <View style={s.stepRow}>
            <View style={s.stepBadge}><Text style={s.stepN}>{n}</Text></View>
            <Text style={s.stepT}>{t}</Text>
        </View>
    );
}

const s = StyleSheet.create({
    bg: { flex: 1, backgroundColor: '#09090B' },
    scroll: { padding: 20, paddingTop: 24, paddingBottom: 40 },

    card: {
        backgroundColor: '#111113', borderRadius: 16, padding: 20,
        marginBottom: 14, borderWidth: 1, borderColor: '#1F1F25', alignItems: 'center',
    },
    cardH: { fontSize: 18, fontWeight: '800', color: '#EAEAE8', marginBottom: 14, alignSelf: 'flex-start' },

    avatar: {
        width: 56, height: 56, borderRadius: 28, backgroundColor: '#E8A83E',
        justifyContent: 'center', alignItems: 'center', marginBottom: 10,
    },
    avatarText: { fontSize: 24, fontWeight: '900', color: '#09090B' },
    name: { color: '#EAEAE8', fontSize: 18, fontWeight: '700' },
    email: { color: '#7C7A85', fontSize: 13, marginTop: 2 },
    roleBadge: {
        marginTop: 8, backgroundColor: '#E8A83E', borderRadius: 8,
        paddingHorizontal: 12, paddingVertical: 4,
    },
    roleText: { color: '#09090B', fontSize: 11, fontWeight: 'bold', letterSpacing: 1 },

    errorCard: {
        backgroundColor: 'rgba(233,69,96,0.08)', borderRadius: 14, padding: 16,
        marginBottom: 14, borderWidth: 1, borderColor: '#E94560',
    },
    errorH: { color: '#E94560', fontSize: 14, fontWeight: '700', marginBottom: 6 },
    errorText: { color: '#7C7A85', fontSize: 12, lineHeight: 17, marginBottom: 10 },
    retryBtn: {
        backgroundColor: '#E94560', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16, alignSelf: 'flex-start',
    },
    retryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },

    usageLabel: { color: '#7C7A85', fontSize: 13, alignSelf: 'flex-start', marginBottom: 6 },
    progressBg: { width: '100%', height: 8, borderRadius: 4, backgroundColor: '#1F1F25', marginBottom: 14 },
    progressFill: { height: 8, borderRadius: 4, backgroundColor: '#E8A83E' },

    unlimitedBanner: {
        backgroundColor: 'rgba(232,168,62,0.12)', borderRadius: 10,
        paddingHorizontal: 16, paddingVertical: 10, marginBottom: 14, width: '100%',
    },
    unlimitedText: { color: '#E8A83E', fontSize: 14, fontWeight: '700', textAlign: 'center' },

    limitBanner: {
        backgroundColor: 'rgba(233,69,96,0.12)', borderRadius: 10,
        paddingHorizontal: 16, paddingVertical: 10, marginBottom: 14, width: '100%',
    },
    limitText: { color: '#E94560', fontSize: 13, fontWeight: '600', textAlign: 'center' },

    statRow: { flexDirection: 'row', gap: 20, width: '100%', justifyContent: 'center', marginTop: 4 },
    stat: { alignItems: 'center', minWidth: 80 },
    statVal: { color: '#E8A83E', fontSize: 22, fontWeight: '800' },
    statLabel: { color: '#7C7A85', fontSize: 11, marginTop: 2 },

    goldItem: {
        backgroundColor: '#111113', borderRadius: 14, padding: 18,
        marginBottom: 14, borderWidth: 1, borderColor: '#E8A83E', alignItems: 'center',
    },
    goldText: { color: '#E8A83E', fontSize: 16, fontWeight: '700' },
    goldSub: { color: '#7C7A85', fontSize: 12, marginTop: 2 },

    themeRow: {
        backgroundColor: '#111113', borderRadius: 14, padding: 16,
        marginBottom: 14, borderWidth: 1, borderColor: '#1F1F25',
        flexDirection: 'row', alignItems: 'center',
    },
    themeSub: { color: '#7C7A85', fontSize: 11, marginTop: 2 },
    themeToggle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    themeLabel: { fontSize: 18, opacity: 0.4 },
    themeLabelActive: { opacity: 1 },

    menuItem: {
        backgroundColor: '#111113', borderRadius: 14, padding: 18,
        marginBottom: 14, borderWidth: 1, borderColor: '#1F1F25',
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    menuText: { color: '#EAEAE8', fontSize: 16, fontWeight: '600' },
    menuArrow: { color: '#7C7A85', fontSize: 22 },

    stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, width: '100%' },
    stepBadge: {
        width: 24, height: 24, borderRadius: 12, backgroundColor: '#E8A83E',
        justifyContent: 'center', alignItems: 'center', marginRight: 12,
    },
    stepN: { color: '#09090B', fontWeight: 'bold', fontSize: 11 },
    stepT: { color: '#7C7A85', fontSize: 13, flex: 1, lineHeight: 18 },

    signOutBtn: {
        borderRadius: 14, paddingVertical: 14, alignItems: 'center',
        borderWidth: 1, borderColor: '#E94560', marginTop: 6,
    },
    signOutText: { color: '#E94560', fontSize: 15, fontWeight: '600' },
});
