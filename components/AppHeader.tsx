import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AppIcon from '@/components/AppIcon';

const GREEN = '#2d7a3a';

interface Props {
  title: string;
  subtitle?: string;
  onLogout: () => void;
  rightAction?: { label: string; onPress: () => void };
  paddingTop?: number;
}

export default function AppHeader({ title, subtitle, onLogout, rightAction, paddingTop = 14 }: Props) {
  return (
    <View style={[s.header, { paddingTop }]}>
      <View style={s.brandRow}>
        <View style={s.logoMark}>
          <AppIcon name="medical" size={20} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.brand}>PillPal</Text>
          <Text style={s.title}>{title}</Text>
          {!!subtitle && <Text style={s.sub}>{subtitle}</Text>}
        </View>
      </View>
      <View style={s.actions}>
        {rightAction && (
          <TouchableOpacity style={s.actionBtn} onPress={rightAction.onPress}>
            <Text style={s.actionText}>{rightAction.label}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={s.logoutBtn} onPress={onLogout}>
          <Text style={s.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    backgroundColor: GREEN,
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoMark: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  brand: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  title: { fontSize: 20, fontWeight: '800', color: '#fff', marginTop: 2 },
  sub:   { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' },
  actionBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  actionText: { color: GREEN, fontWeight: '800', fontSize: 13 },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  logoutText: { color: '#fff', fontSize: 13, fontWeight: '700' },
});
