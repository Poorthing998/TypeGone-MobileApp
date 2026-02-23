import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pnlwglsglwebcobjynrg.supabase.co';
const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBubHdnbHNnbHdlYmNvYmp5bnJnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0NTQ4NDIsImV4cCI6MjA4MzAzMDg0Mn0.9jJtvA6WxNVPzt5q3qaj5z0TQSGsaUS4mabDektQ8pQ';

export const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/process-recording`;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});

// ── Default modes (same as desktop shortcuts) ───────────────────────────
export const DEFAULT_MODES = [
    {
        id: 'email',
        label: 'Write Email',
        prompt:
            'Convert the following spoken text into a polished, professional email. Fix grammar, improve clarity, and format it properly with a greeting and sign-off. Only output the email, nothing else.',
    },
    {
        id: 'tidy',
        label: 'Tidy Speech',
        prompt:
            'Clean up the following spoken text. Remove filler words, fix grammar, and make it clear and concise while preserving the original meaning. Only output the cleaned text.',
    },
    {
        id: 'prompt',
        label: 'AI Prompt',
        prompt:
            'Convert the following spoken text into a well-structured AI prompt. Make it clear, specific, and effective. Only output the prompt.',
    },
    {
        id: 'summary',
        label: 'Summarize',
        prompt:
            'Summarize the following spoken text into concise bullet points capturing the key ideas. Only output the summary.',
    },
    {
        id: 'translate',
        label: 'Translate to EN',
        prompt:
            'Translate the following spoken text into fluent English. Preserve the tone and meaning. Only output the translation.',
    },
];

// ── Modes persistence ───────────────────────────────────────────────────
const MODES_KEY = 'typegone_modes';

export async function loadModes() {
    try {
        const raw = await AsyncStorage.getItem(MODES_KEY);
        if (raw) return JSON.parse(raw);
        await AsyncStorage.setItem(MODES_KEY, JSON.stringify(DEFAULT_MODES));
        return DEFAULT_MODES;
    } catch {
        return DEFAULT_MODES;
    }
}

export async function saveModes(modes: any[]) {
    await AsyncStorage.setItem(MODES_KEY, JSON.stringify(modes));
    // Also write to SharedPreferences so native keyboard can read them
    try {
        const DefaultPreference = require('react-native-default-preference').default;
        await DefaultPreference.setName('typegone_prefs');
        await DefaultPreference.set('modes', JSON.stringify(modes));
    } catch { }
}
