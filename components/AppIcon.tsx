import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

type IonName = ComponentProps<typeof Ionicons>['name'];

interface Props {
  name: IonName;
  size?: number;
  color?: string;
}

/** Consistent vector icons (replaces emoji in UI chrome). */
export default function AppIcon({ name, size = 20, color = '#2d7a3a' }: Props) {
  return <Ionicons name={name} size={size} color={color} />;
}

export const TAB_ICONS = {
  Home: 'home-outline' as IonName,
  Patients: 'people-outline' as IonName,
  Schedule: 'calendar-outline' as IonName,
  Medications: 'medical-outline' as IonName,
  Alerts: 'notifications-outline' as IonName,
  Manage: 'settings-outline' as IonName,
};
