import React, { useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar,
    TextInput, Alert, Clipboard, Linking, ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

// ── Tron USDT Payment Config ─────────────────────────────────────────
const RECEIVING_WALLET = 'TJjNj8iuuE9BzTzztzk6aRsaaKvYNNx68V'; // TypeGone's wallet
const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';  // USDT TRC-20
const PRICE_USDT = 5;                                      // 5 USDT
const RECORDING_CREDITS = 200;                                   // per payment
const TRONGRID_API = 'https://api.trongrid.io';

export function PaymentScreen() {
    const { user, profile, refreshProfile } = useAuth();
    const [txHash, setTxHash] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

    const copyAddress = () => {
        Clipboard.setString(RECEIVING_WALLET);
        Alert.alert('Copied!', 'Wallet address copied to clipboard');
    };

    const openTronScan = () => {
        Linking.openURL(`https://tronscan.org/#/address/${RECEIVING_WALLET}`);
    };

    const verifyPayment = async () => {
        const hash = txHash.trim();
        if (!hash) {
            Alert.alert('Enter TX Hash', 'Paste the transaction hash from your wallet after sending.');
            return;
        }
        if (!user) {
            Alert.alert('Not Signed In', 'Please sign in first.');
            return;
        }

        setVerifying(true);
        setResult(null);

        try {
            // 1. Verify transaction on TronGrid
            const resp = await fetch(`${TRONGRID_API}/wallet/gettransactioninfobyid`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: hash }),
            });
            const txInfo = await resp.json();

            if (!txInfo || !txInfo.receipt) {
                setResult({ success: false, message: 'Transaction not found. Please check the hash and wait a few minutes.' });
                setVerifying(false);
                return;
            }

            if (txInfo.receipt.result !== 'SUCCESS') {
                setResult({ success: false, message: 'Transaction failed on-chain. Status: ' + txInfo.receipt.result });
                setVerifying(false);
                return;
            }

            // 2. Check it's a USDT TRC-20 transfer to our wallet
            const logs = txInfo.log || [];
            let validTransfer = false;
            let fromWallet = '';

            for (const log of logs) {
                // TRC-20 Transfer event topic
                if (log.topics && log.topics[0] === 'ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {
                    // Decode recipient from topics[2] — last 20 bytes as hex address
                    const toHex = '41' + log.topics[2].slice(24);
                    const dataHex = log.data;
                    // Amount is in the data field (6 decimal places for USDT)
                    const amountSun = parseInt(dataHex, 16);
                    const amount = amountSun / 1e6;

                    if (amount >= PRICE_USDT) {
                        validTransfer = true;
                        fromWallet = '41' + log.topics[1].slice(24);
                    }
                }
            }

            if (!validTransfer) {
                setResult({ success: false, message: `Payment must be at least ${PRICE_USDT} USDT to the TypeGone wallet.` });
                setVerifying(false);
                return;
            }

            // 3. Record payment in Supabase
            const { data, error } = await supabase.rpc('process_payment', {
                p_user_id: user.id,
                p_tx_hash: hash,
                p_from_wallet: fromWallet,
                p_amount: PRICE_USDT,
                p_recording_credits: RECORDING_CREDITS,
            });

            if (error) {
                setResult({ success: false, message: error.message });
            } else if (data?.success) {
                setResult({ success: true, message: `${RECORDING_CREDITS} recording credits added!` });
                refreshProfile();
                setTxHash('');
            } else {
                setResult({ success: false, message: data?.error || 'Payment could not be processed.' });
            }
        } catch (e: any) {
            setResult({ success: false, message: 'Network error: ' + e.message });
        }

        setVerifying(false);
    };

    return (
        <View style={s.bg}>
            <StatusBar barStyle="light-content" backgroundColor="#09090B" />
            <ScrollView contentContainerStyle={s.scroll}>

                {/* Header */}
                <View style={s.card}>
                    <Text style={s.cardH}>Get More Recordings</Text>
                    <Text style={s.desc}>
                        You get {FREE_LIMIT} free words. After that, purchase recording packs with USDT on the Tron network.
                    </Text>
                </View>

                {/* Pricing */}
                <View style={[s.card, s.priceCard]}>
                    <Text style={s.priceBig}>{PRICE_USDT} USDT</Text>
                    <Text style={s.priceLabel}>= {RECORDING_CREDITS} recording credits</Text>
                    <Text style={s.priceSub}>TRC-20 (Tron Network)</Text>
                </View>

                {/* Current Balance */}
                {profile && (
                    <View style={s.card}>
                        <Text style={s.cardH}>Your Balance</Text>
                        <View style={s.balRow}>
                            <BalItem label="Words Used" value={profile.words_used?.toString() || '0'} />
                            <BalItem label="Recordings" value={profile.recordings_used?.toString() || '0'} />
                            <BalItem label="Paid Credits" value={profile.paid_recordings?.toString() || '0'} />
                        </View>
                    </View>
                )}

                {/* Instructions */}
                <View style={s.card}>
                    <Text style={s.cardH}>How to Pay</Text>
                    <Step n="1" t={`Send exactly ${PRICE_USDT} USDT (TRC-20) to the address below`} />
                    <Step n="2" t="Copy the transaction hash from your wallet" />
                    <Step n="3" t="Paste it below and tap Verify" />
                </View>

                {/* Wallet Address */}
                <View style={s.card}>
                    <Text style={s.cardH}>Send USDT To</Text>
                    <TouchableOpacity style={s.addressBox} onPress={copyAddress} activeOpacity={0.7}>
                        <Text style={s.addressText} selectable>{RECEIVING_WALLET}</Text>
                    </TouchableOpacity>
                    <View style={s.addrActions}>
                        <TouchableOpacity style={s.addrBtn} onPress={copyAddress}>
                            <Text style={s.addrBtnText}>Copy Address</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[s.addrBtn, s.addrBtnOutline]} onPress={openTronScan}>
                            <Text style={[s.addrBtnText, { color: '#EAEAE8' }]}>View on TronScan</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* TX Hash Input */}
                <View style={s.card}>
                    <Text style={s.cardH}>Verify Payment</Text>
                    <TextInput
                        style={s.input}
                        value={txHash}
                        onChangeText={setTxHash}
                        placeholder="Paste transaction hash here..."
                        placeholderTextColor="#4A5568"
                        autoCapitalize="none"
                        autoCorrect={false}
                    />

                    <TouchableOpacity
                        style={[s.verifyBtn, verifying && { opacity: 0.6 }]}
                        onPress={verifyPayment}
                        disabled={verifying}
                        activeOpacity={0.85}>
                        {verifying ? (
                            <ActivityIndicator color="#09090B" />
                        ) : (
                            <Text style={s.verifyText}>Verify & Add Credits</Text>
                        )}
                    </TouchableOpacity>

                    {result && (
                        <View style={[s.resultBox, result.success ? s.resultSuccess : s.resultError]}>
                            <Text style={[s.resultText, result.success ? { color: '#2E7D32' } : { color: '#E94560' }]}>
                                {result.message}
                            </Text>
                        </View>
                    )}
                </View>

            </ScrollView>
        </View>
    );
}

const FREE_LIMIT = 5000;

function BalItem({ label, value }: { label: string; value: string }) {
    return (
        <View style={s.balItem}>
            <Text style={s.balVal}>{value}</Text>
            <Text style={s.balLabel}>{label}</Text>
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
    scroll: { padding: 20, paddingTop: 16, paddingBottom: 40 },

    card: {
        backgroundColor: '#111113', borderRadius: 16, padding: 20,
        marginBottom: 14, borderWidth: 1, borderColor: '#1F1F25',
    },
    cardH: { fontSize: 18, fontWeight: '800', color: '#EAEAE8', marginBottom: 10 },
    desc: { color: '#7C7A85', fontSize: 13, lineHeight: 20 },

    priceCard: { alignItems: 'center', borderColor: '#E8A83E' },
    priceBig: { fontSize: 36, fontWeight: '900', color: '#E8A83E' },
    priceLabel: { fontSize: 16, color: '#EAEAE8', fontWeight: '600', marginTop: 4 },
    priceSub: { fontSize: 12, color: '#7C7A85', marginTop: 4 },

    balRow: { flexDirection: 'row', gap: 16, justifyContent: 'center', width: '100%' },
    balItem: { alignItems: 'center', minWidth: 80 },
    balVal: { color: '#E8A83E', fontSize: 20, fontWeight: '800' },
    balLabel: { color: '#7C7A85', fontSize: 11, marginTop: 2 },

    stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
    stepBadge: {
        width: 24, height: 24, borderRadius: 12, backgroundColor: '#E8A83E',
        justifyContent: 'center', alignItems: 'center', marginRight: 12,
    },
    stepN: { color: '#09090B', fontWeight: 'bold', fontSize: 11 },
    stepT: { color: '#7C7A85', fontSize: 13, flex: 1, lineHeight: 18 },

    addressBox: {
        backgroundColor: '#09090B', borderRadius: 10, padding: 14,
        borderWidth: 1, borderColor: '#1F1F25', marginBottom: 10,
    },
    addressText: { color: '#E8A83E', fontSize: 12, fontFamily: 'monospace', textAlign: 'center' },
    addrActions: { flexDirection: 'row', gap: 10 },
    addrBtn: {
        flex: 1, backgroundColor: '#E8A83E', borderRadius: 10, paddingVertical: 10,
        alignItems: 'center',
    },
    addrBtnOutline: {
        backgroundColor: 'transparent', borderWidth: 1, borderColor: '#1F1F25',
    },
    addrBtnText: { color: '#09090B', fontSize: 13, fontWeight: '700' },

    input: {
        backgroundColor: '#09090B', borderWidth: 1, borderColor: '#1F1F25',
        borderRadius: 12, padding: 14, fontSize: 13, color: '#EAEAE8', marginBottom: 14,
        fontFamily: 'monospace',
    },

    verifyBtn: {
        backgroundColor: '#E8A83E', borderRadius: 14, paddingVertical: 16,
        alignItems: 'center',
    },
    verifyText: { color: '#09090B', fontSize: 16, fontWeight: 'bold' },

    resultBox: { borderRadius: 10, padding: 14, marginTop: 14 },
    resultSuccess: { backgroundColor: 'rgba(46,125,50,0.12)' },
    resultError: { backgroundColor: 'rgba(233,69,96,0.12)' },
    resultText: { fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 18 },
});
