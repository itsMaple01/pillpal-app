import { View, Text, StyleSheet } from 'react-native';
import AppIcon from '@/components/AppIcon';
import type { PatientMedication } from '@/types/medication';
import {
  DOSE_STATUS_COLORS,
  DOSE_STATUS_ICONS,
  getDoseStatusLabel,
  resolveMedDoseStatus,
} from '@/lib/doseStatus';
import type { ComponentProps } from 'react';

type IonName = ComponentProps<typeof AppIcon>['name'];

interface Props {
  med: Pick<PatientMedication, 'time' | 'taken' | 'missed' | 'late' | 'doseStatus' | 'takenAt'>;
  size?: number;
}

export default function DoseStatusBadge({ med, size = 20 }: Props) {
  const status = resolveMedDoseStatus(med);
  const color = DOSE_STATUS_COLORS[status];
  const label = getDoseStatusLabel(status);

  return (
    <View style={s.wrap}>
      <AppIcon name={DOSE_STATUS_ICONS[status] as IonName} size={size} color={color} />
      <Text style={[s.label, { color }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 52,
    paddingRight: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'center',
  },
});
