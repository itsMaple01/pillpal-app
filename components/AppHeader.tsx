import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AppIcon from '@/components/AppIcon';

const GREEN = '#2d7a3a';

interface Props {
  title: string;
  subtitle?: string;
  rightAction?: { label: string; onPress: () => void };
  paddingTop?: number;
}

/** Compact white page header — logout lives in Manage only. */
export default function AppHeader({ title, subtitle, rightAction, paddingTop = 14 }: Props) {
  return (
    <View style={[s.header, { paddingTop }]}>
      <View style={s.row}>
        <View style={s.logoMark}>
          <AppIcon name="medical" size={22} color={GREEN} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.brand}>PillPal</Text>
          <Text style={s.title}>{title}</Text>
          {!!subtitle && <Text style={s.sub}>{subtitle}</Text>}
        </View>
        {rightAction && (
          <TouchableOpacity style={s.actionBtn} onPress={rightAction.onPress}>
            <Text style={s.actionText}>{rightAction.label}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e8ece8',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoMark: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#e8f5e9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#cfe8d4',
  },
  brand: {
    fontSize: 10,
    fontWeight: '800',
    color: GREEN,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: { fontSize: 20, fontWeight: '800', color: '#1a1a1a', marginTop: 2 },
  sub:   { fontSize: 12, color: '#888', marginTop: 2 },
  actionBtn: {
    backgroundColor: GREEN,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  actionText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
