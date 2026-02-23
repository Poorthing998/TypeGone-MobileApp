import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, StyleSheet, TouchableOpacity, Alert,
    ScrollView, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { loadModes, saveModes } from '../lib/supabase';

export function EditModeScreen() {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const modeId = route.params?.modeId;

    const [label, setLabel] = useState('');
    const [prompt, setPrompt] = useState('');
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        loadModes().then((modes) => {
            const m = modes.find((x: any) => x.id === modeId);
            if (m) { setLabel(m.label); setPrompt(m.prompt); }
        });
    }, [modeId]);

    const save = async () => {
        const modes = await loadModes();
        const idx = modes.findIndex((m: any) => m.id === modeId);
        if (idx !== -1) {
            modes[idx] = { ...modes[idx], label, prompt };
            await saveModes(modes);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        }
    };

    const remove = () => {
        Alert.alert('Delete Mode', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive',
                onPress: async () => {
                    const modes = await loadModes();
                    await saveModes(modes.filter((m: any) => m.id !== modeId));
                    navigation.goBack();
                },
            },
        ]);
    };

    return (
        <View style={s.bg}>
            <StatusBar barStyle="light-content" backgroundColor="#09090B" />
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <ScrollView contentContainerStyle={s.scroll}>

                    {/* Label */}
                    <Text style={s.fieldLabel}>Mode Name</Text>
                    <TextInput
                        style={s.input}
                        value={label}
                        onChangeText={setLabel}
                        placeholder="e.g. Write Email"
                        placeholderTextColor="#4A5568"
                    />

                    {/* Prompt */}
                    <Text style={s.fieldLabel}>System Prompt</Text>
                    <Text style={s.hint}>
                        This tells the AI how to format your speech. Use clear instructions.
                    </Text>
                    <TextInput
                        style={[s.input, s.promptInput]}
                        value={prompt}
                        onChangeText={setPrompt}
                        placeholder="Convert the spoken text into..."
                        placeholderTextColor="#4A5568"
                        multiline
                        textAlignVertical="top"
                    />

                    {/* Actions */}
                    <TouchableOpacity
                        style={[s.saveBtn, saved && s.savedBtn]}
                        onPress={save}
                        activeOpacity={0.85}>
                        <Text style={s.saveTxt}>{saved ? 'Saved!' : 'Save Mode'}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={s.deleteBtn} onPress={remove} activeOpacity={0.85}>
                        <Text style={s.deleteTxt}>Delete Mode</Text>
                    </TouchableOpacity>

                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const s = StyleSheet.create({
    bg: { flex: 1, backgroundColor: '#09090B' },
    scroll: { padding: 20, paddingTop: 24, paddingBottom: 40 },

    fieldLabel: { color: '#EAEAE8', fontSize: 15, fontWeight: '700', marginBottom: 8 },
    hint: { color: '#7C7A85', fontSize: 12, marginBottom: 10, lineHeight: 17 },

    input: {
        backgroundColor: '#111113', borderWidth: 1, borderColor: '#1F1F25',
        borderRadius: 12, padding: 14, fontSize: 15, color: '#EAEAE8', marginBottom: 20,
    },
    promptInput: { minHeight: 160, lineHeight: 22 },

    saveBtn: {
        backgroundColor: '#E8A83E', borderRadius: 14, paddingVertical: 16,
        alignItems: 'center', marginBottom: 12,
    },
    savedBtn: { backgroundColor: '#2E7D32' },
    saveTxt: { color: '#09090B', fontSize: 16, fontWeight: 'bold' },

    deleteBtn: {
        borderRadius: 14, paddingVertical: 14, alignItems: 'center',
        borderWidth: 1, borderColor: '#E94560',
    },
    deleteTxt: { color: '#E94560', fontSize: 15, fontWeight: '600' },
});
