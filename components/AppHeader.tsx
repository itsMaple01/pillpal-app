import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AppLogo from '@/components/AppLogo';
import { APP_NAME } from '@/lib/branding';
import { TEXT } from '@/lib/typography';

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
        <AppLogo size={44} />
        <View style={{ flex: 1 }}>
          <Text style={s.brand}>{APP_NAME}</Text>
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
    backgroundColor: '#ffffff',
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
  brand: {
    fontSize: TEXT.xs,
    fontWeight: '800',
    color: GREEN,
    letterSpacing: 1.2,
  },
  title: { fontSize: TEXT.xl, fontWeight: '800', color: '#1a1a1a', marginTop: 2 },
  sub:   { fontSize: TEXT.sm, color: '#888', marginTop: 2 },
  actionBtn: {
    backgroundColor: GREEN,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  actionText: { color: '#fff', fontWeight: '800', fontSize: TEXT.sm },
});
