import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView,
  ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Svg, { Circle, G } from 'react-native-svg';
import AppIcon from '@/components/AppIcon';
import { theme } from '@/lib/theme';
import { TEXT } from '@/lib/typography';
import {
  connectPillbox,
  disconnectPillbox,
  getPillboxStatus,
  getPillboxAdherence,
} from '@/api/index';

interface Props {
  visible: boolean;
  patientUid: string;
  patientName?: string;
  onClose: () => void;
}

interface PillboxStatus {
  connected: boolean;
  device_id?: string;
  battery_level?: number;
  last_dose_time?: string | null;
  connected_at?: string;
}

interface AdherenceData {
  percentage: number;
  taken: number;
  total: number;
  recent_doses: {
    medication_name: string;
    scheduled_at: string;
    taken_at?: string | null;
    status: string;
  }[];
}

function formatTime(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function AdherenceRing({ percentage }: { percentage: number }) {
  const size = 120;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <View style={s.ringWrap}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e8f0ea"
          strokeWidth={stroke}
          fill="none"
        />
        <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={theme.green}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </G>
      </Svg>
      <View style={s.ringCenter}>
        <Text style={s.ringPct}>{percentage}%</Text>
        <Text style={s.ringSub}>Today</Text>
      </View>
    </View>
  );
}

export default function PillboxScreen({ visible, patientUid, patientName, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<PillboxStatus>({ connected: false });
  const [adherence, setAdherence] = useState<AdherenceData | null>(null);
  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const loadData = useCallback(async () => {
    if (!patientUid) return;
    setLoading(true);
    try {
      const [statusRes, adherenceRes] = await Promise.all([
        getPillboxStatus(patientUid),
        getPillboxAdherence(patientUid),
      ]);
      setStatus(statusRes.data);
      setAdherence(adherenceRes.data);
    } catch {
      setStatus({ connected: false });
      setAdherence(null);
    } finally {
      setLoading(false);
    }
  }, [patientUid]);

  useEffect(() => {
    if (visible) {
      setScanned(false);
      setScanning(false);
      loadData();
    }
  }, [visible, loadData]);

  const handleScanPress = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert('Camera permission', 'Allow camera access to scan the pillbox QR code.');
        return;
      }
    }
    setScanned(false);
    setScanning(true);
  };

  const handleBarcode = async ({ data }: { data: string }) => {
    if (scanned || connecting) return;
    setScanned(true);
    setScanning(false);

    let parsed: { device_id?: string; token?: string };
    try {
      parsed = JSON.parse(data);
    } catch {
      Alert.alert('Invalid QR', 'Could not read pillbox QR code. Try again.');
      setScanned(false);
      return;
    }

    if (!parsed.device_id || !parsed.token) {
      Alert.alert('Invalid QR', 'QR code must contain device_id and token.');
      setScanned(false);
      return;
    }

    setConnecting(true);
    try {
      await connectPillbox({
        patient_uid: patientUid,
        device_id: parsed.device_id,
        token: parsed.token,
      });
      await loadData();
      Alert.alert('Connected', `Pillbox ${parsed.device_id} linked successfully.`);
    } catch (err: any) {
      Alert.alert('Connection failed', err?.response?.data?.error || 'Could not connect pillbox.');
      setScanned(false);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect pillbox',
      'This will unlink the smart pillbox from this account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await disconnectPillbox(patientUid);
              await loadData();
            } catch {
              Alert.alert('Error', 'Could not disconnect pillbox.');
            }
          },
        },
      ],
    );
  };

  const title = patientName ? `${patientName}'s Pillbox` : 'Smart Pillbox';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <AppIcon name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{title}</Text>
          <View style={{ width: 24 }} />
        </View>

        {scanning ? (
          <View style={s.scannerWrap}>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={scanned ? undefined : handleBarcode}
            />
            <View style={s.scannerOverlay}>
              <Text style={s.scannerHint}>Point at the QR code on your pillbox</Text>
              <TouchableOpacity style={s.scannerCancel} onPress={() => setScanning(false)}>
                <Text style={s.scannerCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
            {loading ? (
              <ActivityIndicator size="large" color={theme.green} style={{ marginTop: 48 }} />
            ) : !status.connected ? (
              <>
                <View style={s.heroIcon}>
                  <AppIcon name="hardware-chip-outline" size={64} color={theme.green} />
                </View>
                <Text style={s.heroTitle}>No Pillbox Connected Yet</Text>
                <Text style={s.heroSub}>
                  Scan the QR code on your smart pillbox to start automatic dose tracking
                </Text>
                <TouchableOpacity
                  style={s.primaryBtn}
                  onPress={handleScanPress}
                  disabled={connecting}
                >
                  {connecting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <AppIcon name="qr-code-outline" size={20} color="#fff" />
                      <Text style={s.primaryBtnText}>Scan QR Code</Text>
                    </>
                  )}
                </TouchableOpacity>

                <View style={s.features}>
                  {[
                    { icon: 'sync-outline' as const, label: 'Automatic tracking' },
                    { icon: 'pulse-outline' as const, label: 'Real-time updates' },
                    { icon: 'trending-up-outline' as const, label: 'Better adherence' },
                  ].map(f => (
                    <View key={f.label} style={s.featureRow}>
                      <AppIcon name={f.icon} size={20} color={theme.green} />
                      <Text style={s.featureText}>{f.label}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <>
                <View style={s.connectedBadge}>
                  <View style={s.connectedDot} />
                  <Text style={s.connectedText}>Connected · {status.device_id}</Text>
                </View>

                <View style={s.infoGrid}>
                  <View style={s.infoCard}>
                    <Text style={s.infoLabel}>Last Dose Time</Text>
                    <Text style={s.infoValue}>{formatTime(status.last_dose_time)}</Text>
                  </View>
                  <View style={s.infoCard}>
                    <Text style={s.infoLabel}>Battery Level</Text>
                    <Text style={s.infoValue}>{status.battery_level ?? 100}%</Text>
                  </View>
                </View>

                <Text style={s.sectionTitle}>Today&apos;s Adherence</Text>
                <View style={s.adherenceRow}>
                  <AdherenceRing percentage={adherence?.percentage ?? 0} />
                  <View style={s.adherenceMeta}>
                    <Text style={s.adherenceTaken}>
                      {adherence?.taken ?? 0}/{adherence?.total ?? 0}
                    </Text>
                    <Text style={s.adherenceSub}>doses taken</Text>
                  </View>
                </View>

                <Text style={s.sectionTitle}>Recent Doses</Text>
                {(adherence?.recent_doses ?? []).length === 0 ? (
                  <Text style={s.emptyRecent}>No doses scheduled for today yet.</Text>
                ) : (
                  adherence!.recent_doses.map((d, i) => (
                    <View key={`${d.scheduled_at}-${i}`} style={s.doseRow}>
                      <View>
                        <Text style={s.doseName}>{d.medication_name}</Text>
                        <Text style={s.doseTime}>{formatTime(d.scheduled_at)}</Text>
                      </View>
                      <View style={[
                        s.doseBadge,
                        d.status === 'taken' ? s.doseTaken : d.status === 'missed' ? s.doseMissed : s.dosePending,
                      ]}>
                        <Text style={[
                          s.doseBadgeText,
                          d.status === 'taken' ? s.doseTakenText : d.status === 'missed' ? s.doseMissedText : s.dosePendingText,
                        ]}>
                          {d.status === 'taken' ? 'Taken' : d.status === 'missed' ? 'Missed' : 'Pending'}
                        </Text>
                      </View>
                    </View>
                  ))
                )}

                <TouchableOpacity style={s.disconnectBtn} onPress={handleDisconnect}>
                  <Text style={s.disconnectText}>Disconnect</Text>
                </TouchableOpacity>

                <TouchableOpacity style={s.primaryBtn} onPress={handleScanPress}>
                  <AppIcon name="qr-code-outline" size={20} color="#fff" />
                  <Text style={s.primaryBtnText}>Scan QR to Connect New Pillbox</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerTitle: { fontSize: TEXT.lg, fontWeight: '800', color: theme.text },
  content: { padding: 20, paddingBottom: 40 },
  heroIcon: {
    alignSelf: 'center',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: theme.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  heroTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 8, color: theme.text },
  heroSub: { fontSize: TEXT.sm, color: theme.textMuted, textAlign: 'center', marginBottom: 28, lineHeight: 22 },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.green,
    borderRadius: 14,
    paddingVertical: 16,
    marginBottom: 16,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  features: { marginTop: 24, gap: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureText: { fontSize: TEXT.sm, color: theme.textSecondary },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: theme.greenLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
    marginBottom: 20,
  },
  connectedDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.green },
  connectedText: { color: theme.greenDark, fontWeight: '700', fontSize: 14 },
  infoGrid: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  infoCard: {
    flex: 1,
    backgroundColor: '#f8faf9',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
  },
  infoLabel: { fontSize: 12, color: theme.textMuted, fontWeight: '600', marginBottom: 6 },
  infoValue: { fontSize: 20, fontWeight: '800', color: theme.text },
  sectionTitle: { fontSize: TEXT.md, fontWeight: '800', color: theme.text, marginBottom: 14, marginTop: 8 },
  adherenceRow: { flexDirection: 'row', alignItems: 'center', gap: 24, marginBottom: 28 },
  ringWrap: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  ringPct: { fontSize: 26, fontWeight: '800', color: theme.green },
  ringSub: { fontSize: 12, color: theme.textMuted, fontWeight: '600' },
  adherenceMeta: { flex: 1 },
  adherenceTaken: { fontSize: 32, fontWeight: '800', color: theme.text },
  adherenceSub: { fontSize: 14, color: theme.textMuted, marginTop: 4 },
  doseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  doseName: { fontWeight: '700', fontSize: 15, color: theme.text },
  doseTime: { fontSize: 13, color: theme.textMuted, marginTop: 2 },
  doseBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  doseTaken: { backgroundColor: theme.greenLight },
  doseMissed: { backgroundColor: theme.dangerBg },
  dosePending: { backgroundColor: '#f0f0f0' },
  doseBadgeText: { fontWeight: '700', fontSize: 12 },
  doseTakenText: { color: theme.greenDark },
  doseMissedText: { color: theme.danger },
  dosePendingText: { color: theme.textMuted },
  emptyRecent: { color: theme.textMuted, marginBottom: 20 },
  disconnectBtn: {
    borderWidth: 1.5,
    borderColor: theme.danger,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  disconnectText: { color: theme.danger, fontWeight: '800', fontSize: 15 },
  scannerWrap: { flex: 1, backgroundColor: '#000' },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 48,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  scannerHint: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 20, textAlign: 'center', paddingHorizontal: 24 },
  scannerCancel: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  scannerCancelText: { color: '#fff', fontWeight: '700' },
});
