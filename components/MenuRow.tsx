import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AppIcon from '@/components/AppIcon';
import type { ComponentProps } from 'react';

type IonName = ComponentProps<typeof AppIcon>['name'];

const GREEN = '#2d7a3a';
const GREEN_LIGHT = '#e8f5e9';

interface Props {
  icon: IonName;
  iconColor?: string;
  iconBg?: string;
  label: string;
  sub: string;
  onPress?: () => void;
  badge?: string | number;
  showChevron?: boolean;
}

export default function MenuRow({
  icon,
  iconColor = GREEN,
  iconBg = GREEN_LIGHT,
  label,
  sub,
  onPress,
  badge,
  showChevron = true,
}: Props) {
  const inner = (
    <>
      <View style={[s.iconBox, { backgroundColor: iconBg }]}>
        <AppIcon name={icon} size={22} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.label}>{label}</Text>
        <Text style={s.sub}>{sub}</Text>
      </View>
      {badge != null && (
        <View style={s.badge}>
          <Text style={s.badgeText}>{badge}</Text>
        </View>
      )}
      {showChevron && !!onPress && <AppIcon name="chevron-forward" size={18} color="#ccc" />}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={s.row} onPress={onPress} activeOpacity={0.75}>
        {inner}
      </TouchableOpacity>
    );
  }
  return <View style={s.row}>{inner}</View>;
}

const s = StyleSheet.create({
  row: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eef2ee',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  sub:   { fontSize: 12, color: '#888', marginTop: 2 },
  badge: {
    backgroundColor: GREEN_LIGHT,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 4,
  },
  badgeText: { color: GREEN, fontWeight: '800', fontSize: 13 },
});
