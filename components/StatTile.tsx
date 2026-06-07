import { View, Text, StyleSheet } from 'react-native';
import AppIcon from '@/components/AppIcon';
import type { ComponentProps } from 'react';

type IonName = ComponentProps<typeof AppIcon>['name'];

interface Props {
  icon: IonName;
  value: string | number;
  label: string;
  accent?: string;
  iconBg?: string;
}

export default function StatTile({ icon, value, label, accent = '#2d7a3a', iconBg = '#e8f5e9' }: Props) {
  return (
    <View style={s.card}>
      <View style={[s.iconWrap, { backgroundColor: iconBg }]}>
        <AppIcon name={icon} size={20} color={accent} />
      </View>
      <Text style={[s.num, { color: accent }]}>{value}</Text>
      <Text style={s.label}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eef2ee',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  num:   { fontSize: 22, fontWeight: '800' },
  label: { fontSize: 10, color: '#888', marginTop: 4, textAlign: 'center', fontWeight: '600' },
});
