import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, PermissionsAndroid,
    Platform, Animated, StatusBar,
} from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

type Nav = NativeStackNavigationProp<any>;

const FREE_WORD_LIMIT = 5000;

export function HomeScreen() {
    const navigation = useNavigation<Nav>();
    const { user, profile, refreshProfile } = useAuth();
    const pulse = useRef(new Animated.Value(1)).current;
    const fade = useRef(new Animated.Value(0)).current;
    const [wordsLeft, setWordsLeft] = useState<number | null>(null);

    useEffect(() => {
        if (Platform.OS === 'android') {
            PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
                title: 'Microphone',
                message: 'TypeGone needs mic access for voice input.',
                buttonNeutral: 'Later', buttonNegative: 'No', buttonPositive: 'Allow',
            }).catch(() => { });
        }

        Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }).start();
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1.1, duration: 1200, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    useFocusEffect(
        useCallback(() => {
            refreshProfile();
            if (user) {
                supabase.rpc('check_usage', { p_user_id: user.id }).then(({ data }) => {
                    if (data?.unlimited) setWordsLeft(-1); // unlimited
                    else if (data?.words_remaining != null) setWordsLeft(data.words_remaining);
                });
            }
        }, [user])
    );

    const isUnlimited = profile?.role === 'admin' || profile?.role === 'owner';

    return (
        <View style={s.bg}>
            <StatusBar barStyle="light-content" backgroundColor="#09090B" />
            <Animated.View style={[s.content, { opacity: fade }]}>

                {/* User greeting */}
                <View style={s.header}>
                    <Text style={s.brand}>TypeGone</Text>
                    {profile ? (
                        <Text style={s.greeting}>Welcome, {profile.display_name || user?.email}</Text>
                    ) : (
                        <Text style={s.tagline}>Voice to perfectly formatted text</Text>
                    )}
                </View>

                {/* Mic hero */}
                <View style={s.heroWrap}>
                    <Animated.View style={[s.ring, { transform: [{ scale: pulse }] }]} />
                    <View style={s.micCircle}>
                        <Text style={s.micLetter}>T</Text>
                    </View>
                    {isUnlimited ? (
                        <Text style={[s.statusLabel, { color: '#E8A83E' }]}>Unlimited Access</Text>
                    ) : wordsLeft !== null ? (
                        <Text style={s.statusLabel}>
                            {wordsLeft > 0 ? `${wordsLeft.toLocaleString()} words remaining` : 'Usage limit reached'}
                        </Text>
                    ) : (
                        <Text style={s.statusLabel}>Keyboard Ready</Text>
                    )}
                </View>

                {/* Quick start */}
                <View style={s.cards}>
                    <Card n="1" title="Enable Keyboard" sub='Settings > Keyboard > TypeGone Voice' />
                    <Card n="2" title="Choose a Mode" sub="Tap Mode on the keyboard to pick your AI format" />
                    <Card n="3" title="Speak & Go" sub="Tap MIC, talk, tap STOP — formatted text appears" />
                </View>

                {/* Bottom buttons */}
                <View style={s.btns}>
                    <TouchableOpacity style={s.cta} activeOpacity={0.85}
                        onPress={() => navigation.navigate('Modes')}>
                        <Text style={s.ctaText}>Manage Voice Modes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.secondary} activeOpacity={0.85}
                        onPress={() => navigation.navigate('Settings')}>
                        <Text style={s.secText}>Settings</Text>
                    </TouchableOpacity>
                </View>

            </Animated.View>
        </View>
    );
}

function Card({ n, title, sub }: { n: string; title: string; sub: string }) {
    return (
        <View style={s.card}>
            <View style={s.badge}><Text style={s.badgeN}>{n}</Text></View>
            <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{title}</Text>
                <Text style={s.cardSub}>{sub}</Text>
            </View>
        </View>
    );
}

const s = StyleSheet.create({
    bg: { flex: 1, backgroundColor: '#09090B' },
    content: { flex: 1, paddingHorizontal: 24, paddingTop: 50, justifyContent: 'space-between', paddingBottom: 28 },

    header: { alignItems: 'center' },
    brand: { fontSize: 36, fontWeight: '900', color: '#EAEAE8', letterSpacing: 1 },
    greeting: { fontSize: 14, color: '#E8A83E', marginTop: 6, fontWeight: '600' },
    tagline: { fontSize: 14, color: '#7C7A85', marginTop: 6 },

    heroWrap: { alignItems: 'center', marginVertical: 6 },
    ring: {
        position: 'absolute', width: 140, height: 140, borderRadius: 70,
        borderWidth: 2, borderColor: 'rgba(232,168,62,0.3)',
    },
    micCircle: {
        width: 100, height: 100, borderRadius: 50, backgroundColor: '#E8A83E',
        justifyContent: 'center', alignItems: 'center',
        elevation: 10, shadowColor: '#E8A83E', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4, shadowRadius: 12,
    },
    micLetter: { fontSize: 42, fontWeight: '900', color: '#09090B' },
    statusLabel: { marginTop: 16, fontSize: 14, color: '#7C7A85', fontWeight: '600' },

    cards: { gap: 10 },
    card: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#111113', borderRadius: 14,
        padding: 16, borderWidth: 1, borderColor: '#1F1F25',
    },
    badge: {
        width: 30, height: 30, borderRadius: 15, backgroundColor: '#E8A83E',
        justifyContent: 'center', alignItems: 'center', marginRight: 14,
    },
    badgeN: { color: '#09090B', fontWeight: 'bold', fontSize: 14 },
    cardTitle: { color: '#EAEAE8', fontSize: 15, fontWeight: '700' },
    cardSub: { color: '#7C7A85', fontSize: 12, marginTop: 2 },

    btns: { gap: 10 },
    cta: {
        backgroundColor: '#E8A83E', borderRadius: 14, paddingVertical: 16, alignItems: 'center',
        elevation: 4, shadowColor: '#E8A83E', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3, shadowRadius: 6,
    },
    ctaText: { color: '#09090B', fontSize: 16, fontWeight: 'bold' },
    secondary: {
        borderRadius: 14, paddingVertical: 14, alignItems: 'center',
        borderWidth: 1, borderColor: '#1F1F25',
    },
    secText: { color: '#EAEAE8', fontSize: 15, fontWeight: '600' },
});
