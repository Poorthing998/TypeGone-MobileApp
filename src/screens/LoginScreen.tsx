import React, { useRef, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, StatusBar,
    Animated, Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

export function LoginScreen() {
    const { signIn } = useAuth();
    const fade = useRef(new Animated.Value(0)).current;
    const slideUp = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fade, { toValue: 1, duration: 700, useNativeDriver: true }),
            Animated.timing(slideUp, { toValue: 0, duration: 700, useNativeDriver: true }),
        ]).start();
    }, []);

    const handleSignIn = async () => {
        await signIn();
    };

    return (
        <View style={s.bg}>
            <StatusBar barStyle="light-content" backgroundColor="#09090B" />
            <Animated.View style={[s.content, { opacity: fade, transform: [{ translateY: slideUp }] }]}>

                {/* Logo area */}
                <View style={s.logoWrap}>
                    <View style={s.logoCircle}>
                        <Text style={s.logoText}>T</Text>
                    </View>
                    <Text style={s.brand}>TypeGone</Text>
                    <Text style={s.tagline}>Speak. Format. Done.</Text>
                </View>

                {/* Features */}
                <View style={s.features}>
                    <Feature text="Voice to perfectly formatted text" />
                    <Feature text="6 AI modes — email, summary, translate & more" />
                    <Feature text="Works in any app as your keyboard" />
                    <Feature text="Custom prompts for your workflows" />
                </View>

                {/* CTA */}
                <TouchableOpacity style={s.googleBtn} activeOpacity={0.85} onPress={handleSignIn}>
                    <Text style={s.googleText}>Sign in with Google</Text>
                </TouchableOpacity>

                <Text style={s.footer}>Your voice data is processed securely via OpenAI</Text>
            </Animated.View>
        </View>
    );
}

function Feature({ text }: { text: string }) {
    return (
        <View style={s.featureRow}>
            <View style={s.dot} />
            <Text style={s.featureText}>{text}</Text>
        </View>
    );
}

const s = StyleSheet.create({
    bg: { flex: 1, backgroundColor: '#09090B' },
    content: {
        flex: 1, paddingHorizontal: 28, justifyContent: 'center', paddingBottom: 40,
    },

    logoWrap: { alignItems: 'center', marginBottom: 48 },
    logoCircle: {
        width: 80, height: 80, borderRadius: 40, backgroundColor: '#E8A83E',
        justifyContent: 'center', alignItems: 'center', marginBottom: 16,
        elevation: 8, shadowColor: '#E8A83E', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4, shadowRadius: 12,
    },
    logoText: { fontSize: 36, fontWeight: '900', color: '#09090B' },
    brand: { fontSize: 36, fontWeight: '900', color: '#EAEAE8', letterSpacing: 1 },
    tagline: { fontSize: 15, color: '#7C7A85', marginTop: 6 },

    features: { marginBottom: 48 },
    featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    dot: {
        width: 6, height: 6, borderRadius: 3, backgroundColor: '#E8A83E', marginRight: 12,
    },
    featureText: { color: '#EAEAE8', fontSize: 15 },

    googleBtn: {
        backgroundColor: '#E8A83E', borderRadius: 14, paddingVertical: 16,
        alignItems: 'center',
        elevation: 6, shadowColor: '#E8A83E', shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.35, shadowRadius: 8,
    },
    googleText: { color: '#09090B', fontSize: 17, fontWeight: 'bold', letterSpacing: 0.5 },

    footer: { textAlign: 'center', color: '#7C7A85', fontSize: 12, marginTop: 20 },
});
