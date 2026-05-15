import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Platform, Alert,
} from 'react-native';
import { useState } from 'react';
import { redeemPatientLinkCode } from '@/api/index';
import AppIcon from '@/components/AppIcon';

const GREEN       = '#2d7a3a';
const GREEN_DARK  = '#1e5c28';
const GREEN_LIGHT = '#e8f5e9';

interface Props {
  visible:      boolean;
  onClose:      () => void;
  caretakerUid: string;
  onLinked:     () => void;
}

/** Caregivers link only by entering a code the patient generated — patients initiate linking. */
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.handle} />

          <View style={s.header}>
            <View style={s.iconCircle}>
              <AppIcon name="link" size={28} color={GREEN} />
            </View>
            <Text style={s.title}>Link a patient</Text>
            <Text style={s.subtitle}>
              Ask the patient to generate a link code from their app (Manage → Link caregiver).
              Enter that code here — only patients can start a link request.
            </Text>
          </View>

          <View style={s.body}>
            <Text style={s.label}>PATIENT CODE</Text>
            <TextInput
              style={[s.input, error ? s.inputError : null]}
              placeholder="e.g. ABC123"
              placeholderTextColor="#bbb"
              value={code}
              onChangeText={t => { setCode(t.toUpperCase()); setError(''); }}
              autoCapitalize="characters"
              editable={!loading}
            />
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
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#e0e0e0', alignSelf: 'center', marginTop: 12,
  },
  header: {
    alignItems: 'center', paddingTop: 16, paddingHorizontal: 24,
    paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  iconCircle: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: GREEN_LIGHT,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  title:    { fontSize: 19, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 },
  subtitle: { fontSize: 13, color: '#666', textAlign: 'center', lineHeight: 18 },

  body: { padding: 20, gap: 8 },
  label: {
    fontSize: 11, fontWeight: '800', color: '#888',
    letterSpacing: 1, textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1.5, borderColor: '#e0e0e0', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, color: '#222', backgroundColor: '#fafafa',
  },
  inputError: { borderColor: '#d32f2f', backgroundColor: '#fff8f8' },
  errorText:  { fontSize: 12, color: '#d32f2f' },

  footer: {
    flexDirection: 'row', gap: 12,
    paddingHorizontal: 20, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: '#f0f0f0',
  },
  cancelBtn: {
    flex: 1, paddingVertical: 15, borderRadius: 12,
    alignItems: 'center', backgroundColor: '#f5f5f5',
    borderWidth: 1.5, borderColor: '#e8e8e8',
  },
  cancelText: { fontSize: 15, fontWeight: '700', color: '#666' },
  linkBtn: {
    flex: 2, paddingVertical: 15, borderRadius: 12,
    alignItems: 'center', backgroundColor: GREEN_DARK,
  },
  linkText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
