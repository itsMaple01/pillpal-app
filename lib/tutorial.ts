import AsyncStorage from '@react-native-async-storage/async-storage';

export type TutorialRole = 'patient' | 'family' | 'caregiver';

const key = (role: TutorialRole, uid: string) => `gabayra_tutorial_${role}_${uid}`;

export async function isTutorialDone(role: TutorialRole, uid: string): Promise<boolean> {
  return (await AsyncStorage.getItem(key(role, uid))) === '1';
}

export async function setTutorialDone(role: TutorialRole, uid: string): Promise<void> {
  await AsyncStorage.setItem(key(role, uid), '1');
}

export interface TutorialStep {
  title: string;
  body: string;
}

export const PATIENT_TUTORIAL: TutorialStep[] = [
  { title: 'Home', body: 'See today’s meds and mark them taken from the list.' },
  { title: 'Calendar', body: 'Swipe the week strip to plan ahead. Dots show upcoming doses.' },
  { title: 'Medications', body: 'Tap any medication card to edit. Use the switch on the right when you take a dose.' },
  { title: 'Manage', body: 'Link family, notifications, and your profile live here.' },
];

export const FAMILY_TUTORIAL: TutorialStep[] = [
  { title: 'Family home', body: 'View everyone you support and send reminders with one tap.' },
  { title: 'Schedules', body: 'See all linked members’ morning, afternoon, and evening meds.' },
  { title: 'Caregiver mode', body: 'Switch to the full caregiver dashboard anytime in Manage.' },
];

export const CAREGIVER_TUTORIAL: TutorialStep[] = [
  { title: 'Patients', body: 'Search and expand a patient to send reminders or edit info.' },
  { title: 'Medications', body: 'Open a patient to view meds. Alerts are inside this tab.' },
  { title: 'Schedule', body: 'Every linked patient’s day appears here — not just one person.' },
];
