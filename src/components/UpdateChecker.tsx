import React, { useEffect, useState } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    Linking,
    StyleSheet,
    ScrollView,
} from 'react-native';

// ─── CONFIGURATION ───────────────────────────────────────────────
// Point this to wherever you host your version.json
// Options: GitHub raw URL, your website, etc.
const VERSION_CHECK_URL =
    'https://raw.githubusercontent.com/Poorthing998/TypeGone-MobileApp/main/version.json';

// The CURRENT version baked into this build
const CURRENT_VERSION = '1.1.0';

// ─── Helpers ─────────────────────────────────────────────────────
function isNewer(remote: string, local: string): boolean {
    const r = remote.split('.').map(Number);
    const l = local.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
        if ((r[i] || 0) > (l[i] || 0)) return true;
        if ((r[i] || 0) < (l[i] || 0)) return false;
    }
    return false;
}

// ─── Types ───────────────────────────────────────────────────────
interface VersionInfo {
    version: string;
    versionCode: number;
    releaseNotes: string;
    downloadUrl: string;
    mandatory: boolean;
}

// ─── Component ───────────────────────────────────────────────────
export default function UpdateChecker() {
    const [info, setInfo] = useState<VersionInfo | null>(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        checkForUpdate();
    }, []);

    async function checkForUpdate() {
        try {
            const resp = await fetch(VERSION_CHECK_URL, { cache: 'no-store' });
            if (!resp.ok) return;
            const data: VersionInfo = await resp.json();
            if (isNewer(data.version, CURRENT_VERSION)) {
                setInfo(data);
                setVisible(true);
            }
        } catch {
            // Silently fail — no internet or bad URL
        }
    }

    if (!info || !visible) return null;

    return (
        <Modal transparent animationType="fade" visible={visible}>
            <View style={s.overlay}>
                <View style={s.card}>
                    {/* Header */}
                    <Text style={s.title}>🎉 Update Available!</Text>
                    <Text style={s.version}>v{info.version}</Text>

                    {/* Release Notes */}
                    <ScrollView style={s.notesScroll}>
                        <Text style={s.notes}>{info.releaseNotes}</Text>
                    </ScrollView>

                    {/* Buttons */}
                    <TouchableOpacity
                        style={s.downloadBtn}
                        onPress={() => {
                            Linking.openURL(info.downloadUrl);
                            if (!info.mandatory) setVisible(false);
                        }}>
                        <Text style={s.downloadText}>Download Update</Text>
                    </TouchableOpacity>

                    {!info.mandatory && (
                        <TouchableOpacity
                            style={s.skipBtn}
                            onPress={() => setVisible(false)}>
                            <Text style={s.skipText}>Later</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </Modal>
    );
}

// ─── Styles ──────────────────────────────────────────────────────
const s = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        width: '100%',
        maxWidth: 360,
        backgroundColor: '#111113',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#1F1F25',
        padding: 24,
        alignItems: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#EAEAE8',
        marginBottom: 4,
    },
    version: {
        fontSize: 14,
        color: '#E8A83E',
        fontWeight: '600',
        marginBottom: 16,
    },
    notesScroll: {
        maxHeight: 180,
        width: '100%',
        marginBottom: 20,
    },
    notes: {
        fontSize: 13,
        color: '#B0B0B5',
        lineHeight: 20,
    },
    downloadBtn: {
        width: '100%',
        backgroundColor: '#E8A83E',
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 10,
    },
    downloadText: {
        color: '#09090B',
        fontWeight: '700',
        fontSize: 15,
    },
    skipBtn: {
        paddingVertical: 8,
    },
    skipText: {
        color: '#7C7A85',
        fontSize: 13,
    },
});
