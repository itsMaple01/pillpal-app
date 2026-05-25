import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Platform, Share, Alert, ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { createLinkRequest, generatePatientLinkCode } from '@/api/index';
import AppIcon from '@/components/AppIcon';
import CenteredModal from '@/components/CenteredModal';

const GREEN       = '#2d7a3a';
const GREEN_DARK  = '#1e5c28';
const GREEN_LIGHT = '#e8f5e9';

interface Props {
  visible: boolean;
  onClose: () => void;
  uid:     string;
  email:   string;
}

export default function LinkCaretakerModal({ visible, onClose, uid, email }: Props) {
  const [mode, setMode] = useState<'code' | 'request'>('code');
  const [code, setCode] = useState('');
  const [cgEmail, setCgEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const showMsg = (title: string, msg: string) => {
    if (Platform.OS === 'web') window.alert(`${title}\n${msg}`);
    else Alert.alert(title, msg);
  };

  const genCode = async () => {
    setLoading(true);
    try {
      const res = await generatePatientLinkCode(uid);
      setCode(res.data.code);
    } catch {
      showMsg('Error', 'Could not generate a code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const shareCode = async () => {
    if (!code) return;
    const message = `Link with me on GabayRa.\n\nMy code: ${code}\n(Valid 24 hours)\n\nOr use my email: ${email}`;
    try {
      if (Platform.OS === 'web') {
        await navigator.clipboard.writeText(message);
        window.alert('Copied!');
      } else {
        await Share.share({ message });
      }
    } catch {
      showMsg('Error', 'Could not share. Copy the code manually.');
    }
  };

  const sendRequest = async () => {
    const trimmed = cgEmail.trim().toLowerCase();
    if (!trimmed || !/\S+@\S+\.\S+/.test(trimmed)) {
      showMsg('Email', 'Enter a valid caregiver email.');
      return;
    }
    setLoading(true);
    try {
      await createLinkRequest({ patient_uid: uid, caretaker_email: trimmed });
      showMsg('Sent', 'They can accept from their Patients tab.');
      setCgEmail('');
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Could not send request.';
      showMsg('Error', String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <CenteredModal visible={visible} onClose={onClose}>
      <View style={s.hero}>
        <View style={s.iconCircle}>
          <AppIcon name="people" size={28} color="#fff" />
        </View>
        <Text style={s.heroKicker}>GabayRa</Text>
        <Text style={s.title}>Link caregiver / family</Text>
        <Text style={s.subtitle}>Share a code or send a request to their email.</Text>
      </View>

      <View style={s.tabRow}>
        <TouchableOpacity style={[s.tab, mode === 'code' && s.tabOn]} onPress={() => setMode('code')}>
          <Text style={[s.tabTxt, mode === 'code' && s.tabTxtOn]}>Code</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, mode === 'request' && s.tabOn]} onPress={() => setMode('request')}>
          <Text style={[s.tabTxt, mode === 'request' && s.tabTxtOn]}>Request</Text>
        </TouchableOpacity>
      </View>

      <View style={s.body}>
        {mode === 'code' ? (
          <>
            <TouchableOpacity style={s.genBtn} onPress={genCode} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.genTxt}>Generate new code</Text>}
            </TouchableOpacity>
            {!!code && (
              <View style={s.codeBox}>
                <Text style={s.codeLabel}>YOUR CODE</Text>
                <Text style={s.codeText}>{code}</Text>
                <Text style={s.codeNote}>Give this to your caregiver. Expires in 24 hours.</Text>
              </View>
            )}
            <TouchableOpacity style={s.shareBtn} onPress={shareCode} disabled={!code}>
              <Text style={s.shareTxt}>{Platform.OS === 'web' ? 'Copy message' : 'Share'}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={s.label}>CAREGIVER EMAIL</Text>
            <TextInput
              style={s.input}
              placeholder="caregiver@email.com"
              placeholderTextColor="#bbb"
              value={cgEmail}
              onChangeText={setCgEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TouchableOpacity style={s.genBtn} onPress={sendRequest} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.genTxt}>Send link request</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={s.footer}>
        <TouchableOpacity style={s.closeBtn} onPress={onClose}>
          <Text style={s.closeText}>Done</Text>
        </TouchableOpacity>
      </View>
    </CenteredModal>
  );
}

const s = StyleSheet.create({
  hero: {
    backgroundColor: GREEN,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 18,
    alignItems: 'center',
  },
  iconCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  heroKicker: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.85)', letterSpacing: 2 },
  title: { fontSize: 20, fontWeight: '800', color: '#fff', marginTop: 4 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.88)', textAlign: 'center', marginTop: 6 },

  tabRow: { flexDirection: 'row', marginHorizontal: 20, marginTop: 16, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#f0f0f0', alignItems: 'center' },
  tabOn: { backgroundColor: GREEN_LIGHT, borderWidth: 1.5, borderColor: GREEN },
  tabTxt: { fontSize: 13, fontWeight: '600', color: '#888' },
  tabTxtOn: { color: GREEN_DARK, fontWeight: '800' },

  body: { padding: 20, gap: 12 },
  genBtn: { backgroundColor: GREEN_DARK, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  genTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  codeBox: { backgroundColor: GREEN_LIGHT, borderRadius: 12, padding: 16, borderWidth: 1.5, borderColor: GREEN },
  codeLabel: { fontSize: 10, fontWeight: '800', color: GREEN, letterSpacing: 1 },
  codeText: { fontSize: 28, fontWeight: '900', color: GREEN_DARK, letterSpacing: 4, marginTop: 6 },
  codeNote: { fontSize: 11, color: GREEN_DARK, marginTop: 8 },
  shareBtn: { backgroundColor: GREEN, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  shareTxt: { color: '#fff', fontWeight: '800' },
  label: { fontSize: 11, fontWeight: '800', color: '#888', letterSpacing: 1 },
  input: { borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 12, padding: 14, fontSize: 15, backgroundColor: '#fafafa' },

  footer: { paddingHorizontal: 20, paddingBottom: 20 },
  closeBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#f5f5f5', borderWidth: 1.5, borderColor: '#e8e8e8' },
  closeText: { fontSize: 15, fontWeight: '700', color: '#666' },
});
