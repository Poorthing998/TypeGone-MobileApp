import React, { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { loadModes, saveModes } from '../lib/supabase';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type Nav = NativeStackNavigationProp<any>;

export function ModesScreen() {
    const navigation = useNavigation<Nav>();
    const [modes, setModes] = useState<any[]>([]);

    useFocusEffect(
        useCallback(() => {
            loadModes().then(setModes);
        }, [])
    );

    const deleteMode = (id: string) => {
        Alert.alert('Delete Mode', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive',
                onPress: async () => {
                    const updated = modes.filter((m) => m.id !== id);
                    await saveModes(updated);
                    setModes(updated);
                },
            },
        ]);
    };

    const addMode = async () => {
        const newMode = {
            id: Date.now().toString(36),
            label: 'New Mode',
            prompt: 'Process the following spoken text:',
        };
        const updated = [...modes, newMode];
        await saveModes(updated);
        setModes(updated);
        navigation.navigate('EditMode', { modeId: newMode.id });
    };

    return (
        <View style={s.bg}>
            <StatusBar barStyle="light-content" backgroundColor="#09090B" />
            <FlatList
                data={modes}
                keyExtractor={(m) => m.id}
                contentContainerStyle={s.list}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={s.card}
                        activeOpacity={0.8}
                        onPress={() => navigation.navigate('EditMode', { modeId: item.id })}
                        onLongPress={() => deleteMode(item.id)}>
                        <View style={s.cardLeft}>
                            <View style={s.dot} />
                            <View style={{ flex: 1 }}>
                                <Text style={s.label}>{item.label}</Text>
                                <Text style={s.promptPreview} numberOfLines={2}>
                                    {item.prompt}
                                </Text>
                            </View>
                        </View>
                        <Text style={s.arrow}>›</Text>
                    </TouchableOpacity>
                )}
                ListFooterComponent={
                    <TouchableOpacity style={s.addBtn} onPress={addMode} activeOpacity={0.85}>
                        <Text style={s.addText}>+ Add New Mode</Text>
                    </TouchableOpacity>
                }
            />
        </View>
    );
}

const s = StyleSheet.create({
    bg: { flex: 1, backgroundColor: '#09090B' },
    list: { padding: 16, paddingBottom: 40 },
    card: {
        backgroundColor: '#111113', borderRadius: 14, padding: 16,
        marginBottom: 10, borderWidth: 1, borderColor: '#1F1F25',
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    cardLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    dot: {
        width: 8, height: 8, borderRadius: 4, backgroundColor: '#E8A83E',
        marginRight: 14, marginTop: 2,
    },
    label: { color: '#EAEAE8', fontSize: 16, fontWeight: '700' },
    promptPreview: { color: '#7C7A85', fontSize: 12, marginTop: 4 },
    arrow: { color: '#7C7A85', fontSize: 22, marginLeft: 8 },
    addBtn: {
        backgroundColor: '#E8A83E', borderRadius: 14, paddingVertical: 16,
        alignItems: 'center', marginTop: 10,
    },
    addText: { color: '#09090B', fontSize: 16, fontWeight: 'bold' },
});
