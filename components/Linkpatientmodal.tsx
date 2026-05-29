import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Platform, Alert, ScrollView,
} from 'react-native';
import { useCallback, useEffect, useState } from 'react';
import {
  redeemPatientLinkCode,
  getIncomingLinkRequests,
  acceptLinkRequest,
  rejectLinkRequest,
  caregiverLinkRequest,
} from '@/api/index';
import AppIcon from '@/components/AppIcon';
import AppLogo from '@/components/AppLogo';
import CenteredModal from '@/components/CenteredModal';
import SegmentedCodeInput from '@/components/SegmentedCodeInput';
import { APP_NAME } from '@/lib/branding';

const GREEN       = '#2d7a3a';
const GREEN_DARK  = '#1e5c28';
const GREEN_LIGHT = '#e8f5e9';

type Mode = 'code' | 'requests' | 'email';

interface LinkRequestRow {
  id: number;
  patient_uid: string;
  patient_name?: string;
  patient_email?: string;
  patient_age?: number;
}

interface Props {
  visible:      boolean;
  onClose:      () => void;
  caretakerUid: string;
  onLinked:     () => void;
}

export default function LinkPatientModal({ visible, onClose, caretakerUid, onLinked }: Props) {
  const [mode, setMode] = useState<Mode>('code');
  const [code, setCode] = useState('');
  const [patientEmail, setPatientEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [requests, setRequests] = useState<LinkRequestRow[]>([]);
  const [loadingReqs, setLoadingReqs] = useState(false);

  const showMsg = (title: string, msg: string) => {
    if (Platform.OS === 'web') window.alert(`${title}\n${msg}`);
    else Alert.alert(title, msg);
  };

  const loadRequests = useCallback(async () => {
    setLoadingReqs(true);
    try {
      const res = await getIncomingLinkRequests(caretakerUid);
      setRequests(Array.isArray(res.data) ? res.data : []);
    } catch {
      setRequests([]);
    } finally {
      setLoadingReqs(false);
    }
  }, [caretakerUid]);

  useEffect(() => {
    if (visible) loadRequests();
  }, [visible, loadRequests]);

  const handleClose = () => {
    setCode('');
    setPatientEmail('');
    setError('');
    setMode('code');
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

  const sendEmailRequest = async () => {
    const trimmed = patientEmail.trim().toLowerCase();
    if (!trimmed || !/\S+@\S+\.\S+/.test(trimmed)) {
      setError('Enter a valid patient email.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await caregiverLinkRequest({ caretaker_uid: caretakerUid, patient_email: trimmed });
      showMsg('Request sent', 'The patient can accept from their Manage screen.');
      setPatientEmail('');
      onLinked();
    } catch (err: any) {
      setError(String(err?.response?.data?.error || 'Could not send request.'));
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (id: number) => {
    setLoading(true);
    try {
      await acceptLinkRequest(id, caretakerUid);
      await loadRequests();
      onLinked();
      showMsg('Linked', 'Patient is now connected.');
    } catch {
      showMsg('Error', 'Could not accept request.');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (id: number) => {
    setLoading(true);
    try {
      await rejectLinkRequest(id, { caretaker_uid: caretakerUid });
      await loadRequests();
    } catch {
      showMsg('Error', 'Could not decline request.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CenteredModal visible={visible} onClose={handleClose}>
      <View style={s.hero}>
        <AppLogo size={52} />
        <Text style={s.heroKicker}>{APP_NAME}</Text>
        <Text style={s.title}>Link family member / patient</Text>
        <Text style={s.subtitle}>
          Redeem a patient code, review pending requests, or ask a patient to approve by email.
        </Text>
      </View>

      <View style={s.tabRow}>
        {(['code', 'requests', 'email'] as Mode[]).map(m => (
          <TouchableOpacity
            key={m}
            style={[s.tab, mode === m && s.tabOn]}
            onPress={() => { setMode(m); setError(''); }}
          >
            <Text style={[s.tabTxt, mode === m && s.tabTxtOn]}>
              {m === 'code' ? 'Code' : m === 'requests' ? `Requests${requests.length ? ` (${requests.length})` : ''}` : 'By email'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={s.bodyScroll} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        {mode === 'code' && (
          <>
            <Text style={s.label}>Patient code</Text>
            <Text style={s.hint}>Patient: Manage → Link caregiver → Generate code</Text>
            <SegmentedCodeInput value={code} onChange={c => { setCode(c); setError(''); }} />
          </>
        )}

        {mode === 'requests' && (
          <>
            {loadingReqs ? (
              <ActivityIndicator color={GREEN} style={{ marginVertical: 20 }} />
            ) : requests.length === 0 ? (
              <View style={s.emptyReq}>
                <AppIcon name="mail-open-outline" size={32} color="#bbb" />
                <Text style={s.emptyReqTitle}>No pending requests</Text>
                <Text style={s.emptyReqSub}>
                  When a patient sends you a link request, it will appear here.
                </Text>
              </View>
            ) : (
              requests.map(req => (
                <View key={req.id} style={s.reqCard}>
                  <View style={s.reqHead}>
                    <View style={s.reqAvatar}>
                      <Text style={s.reqAvatarText}>
                        {(req.patient_name || req.patient_email || '?').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.reqName}>{req.patient_name || 'Patient'}</Text>
                      <Text style={s.reqEmail}>{req.patient_email}</Text>
                      {req.patient_age != null && (
                        <Text style={s.reqMeta}>Age {req.patient_age}</Text>
                      )}
                    </View>
                  </View>
                  <Text style={s.reqNote}>Wants to connect with you on {APP_NAME}</Text>
                  <View style={s.reqActions}>
                    <TouchableOpacity
                      style={s.acceptBtn}
                      onPress={() => handleAccept(req.id)}
                      disabled={loading}
                    >
                      <Text style={s.acceptTxt}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={s.declineBtn}
                      onPress={() => handleReject(req.id)}
                      disabled={loading}
                    >
                      <Text style={s.declineTxt}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {mode === 'email' && (
          <>
            <Text style={s.label}>Patient email</Text>
            <Text style={s.hint}>They must accept the request in their app.</Text>
            <TextInput
              style={s.emailInput}
              placeholder="patient@email.com"
              placeholderTextColor="#bbb"
              value={patientEmail}
              onChangeText={t => { setPatientEmail(t); setError(''); }}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </>
        )}

        {!!error && <Text style={s.errorText}>{error}</Text>}
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity style={s.cancelBtn} onPress={handleClose} disabled={loading}>
          <Text style={s.cancelText}>Close</Text>
        </TouchableOpacity>
        {mode === 'code' && (
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
        )}
        {mode === 'email' && (
          <TouchableOpacity
            style={[s.linkBtn, loading && { opacity: 0.6 }]}
            onPress={sendEmailRequest}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.linkText}>Send request</Text>
            }
          </TouchableOpacity>
        )}
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
  heroKicker: { fontSize: 11, fontWeight: '800', color: 'rgba(255,255,255,0.85)', letterSpacing: 2, marginTop: 8 },
  title:    { fontSize: 20, fontWeight: '800', color: '#fff', marginTop: 4, textAlign: 'center' },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.88)', textAlign: 'center', lineHeight: 18, marginTop: 8 },

  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 4,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabOn: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  tabTxt: { fontSize: 12, fontWeight: '600', color: '#888' },
  tabTxtOn: { color: GREEN, fontWeight: '800' },

  bodyScroll: { maxHeight: 340 },
  body: { padding: 20, gap: 12 },
  label: { fontSize: 14, fontWeight: '700', color: '#444' },
  hint: { fontSize: 13, color: '#888', marginBottom: 4 },
  emailInput: {
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#222',
    backgroundColor: '#fafafa',
  },
  errorText: { fontSize: 12, color: '#d32f2f' },

  emptyReq: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyReqTitle: { fontSize: 16, fontWeight: '800', color: '#444' },
  emptyReqSub: { fontSize: 13, color: '#888', textAlign: 'center', lineHeight: 18 },

  reqCard: {
    backgroundColor: GREEN_LIGHT,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#cfe8d4',
    marginBottom: 10,
  },
  reqHead: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  reqAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reqAvatarText: { fontSize: 18, fontWeight: '800', color: GREEN },
  reqName: { fontSize: 16, fontWeight: '800', color: '#222' },
  reqEmail: { fontSize: 13, color: '#666', marginTop: 2 },
  reqMeta: { fontSize: 12, color: GREEN, marginTop: 2, fontWeight: '600' },
  reqNote: { fontSize: 13, color: '#555', marginTop: 10 },
  reqActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  acceptBtn: { flex: 1, backgroundColor: GREEN_DARK, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  acceptTxt: { color: '#fff', fontWeight: '800' },
  declineBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ccc',
    backgroundColor: '#fff',
  },
  declineTxt: { color: '#666', fontWeight: '700' },

  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 4,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderWidth: 1.5,
    borderColor: '#e8e8e8',
  },
  cancelText: { fontSize: 15, fontWeight: '700', color: '#666' },
  linkBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: GREEN_DARK,
  },
  linkText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
