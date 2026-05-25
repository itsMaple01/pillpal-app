import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Platform, Alert,
} from 'react-native';
import { useState } from 'react';
import { redeemPatientLinkCode } from '@/api/index';
import AppIcon from '@/components/AppIcon';
import CenteredModal from '@/components/CenteredModal';
import SegmentedCodeInput from '@/components/SegmentedCodeInput';

const GREEN       = '#2d7a3a';
const GREEN_DARK  = '#1e5c28';
const GREEN_LIGHT = '#e8f5e9';

interface Props {
  visible:      boolean;
  onClose:      () => void;
  caretakerUid: string;
  onLinked:     () => void;
}

export default function LinkPatientModal({ visible, onClose, caretakerUid, onLinked }: Props) {
  const [code,    setCode]    = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const showMsg = (title: string, msg: string) => {
    if (Platform.OS === 'web') window.alert(`${title}\n${msg}`);
    else Alert.alert(title, msg);
  };

  const handleClose = () => {
    setCode('');
    setError('');
    onClose();
  };

  const redeemCode = async () => {
    const c = code.trim().toUpperCase();
    if (c.length < 4) { setError('Enter the code from the patient.'); return; }
    setLoading(true);
    setError('');
    try {
      await redeemPatientLinkCode(caretakerUid, c);
      showMsg('Linked!', 'Patient is now connected.');
      handleClose();
      onLinked();
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Invalid or expired code.';
      setError(String(msg));
    } finally {
      setLoading(false);
    }
  };

  return (
    <CenteredModal visible={visible} onClose={handleClose}>
      <View style={s.hero}>
        <View style={s.iconCircle}>
          <AppIcon name="link" size={28} color="#fff" />
        </View>
        <Text style={s.heroKicker}>GabayRa</Text>
        <Text style={s.title}>Link a patient</Text>
        <Text style={s.subtitle}>
          Ask the patient to generate a code (Manage → Link caregiver). Only patients start link requests.
        </Text>
      </View>

      <View style={s.body}>
        <Text style={s.label}>Patient code</Text>
        <Text style={s.hint}>Enter each character in its own box</Text>
        <SegmentedCodeInput value={code} onChange={c => { setCode(c); setError(''); }} />
        {!!error && <Text style={s.errorText}>{error}</Text>}
      </View>

      <View style={s.footer}>
        <TouchableOpacity style={s.cancelBtn} onPress={handleClose} disabled={loading}>
          <Text style={s.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.linkBtn, loading && { opacity: 0.6 }]}
          onPress={redeemCode}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={s.linkText}>Link with code</Text>
          }
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
    paddingBottom: 20,
    alignItems: 'center',
  },
  iconCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  heroKicker: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.85)', letterSpacing: 2 },
  title:    { fontSize: 20, fontWeight: '800', color: '#fff', marginTop: 4 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.88)', textAlign: 'center', lineHeight: 18, marginTop: 8 },

  body: { padding: 20, gap: 12 },
  label: { fontSize: 14, fontWeight: '600', color: '#444', marginBottom: 4 },
  hint: { fontSize: 13, color: '#888', marginBottom: 12 },
  errorText:  { fontSize: 12, color: '#d32f2f' },

  footer: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 20, paddingBottom: 20, paddingTop: 4,
  },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    alignItems: 'center', backgroundColor: '#f5f5f5',
    borderWidth: 1.5, borderColor: '#e8e8e8',
  },
  cancelText: { fontSize: 15, fontWeight: '700', color: '#666' },
  linkBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 12,
    alignItems: 'center', backgroundColor: GREEN_DARK,
  },
  linkText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
