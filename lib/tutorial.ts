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

export interface NavTutorialStep extends TutorialStep {
  /** Switches the highlighted bottom tab during the tour. */
  tab?: string;
}

export const PATIENT_TUTORIAL: NavTutorialStep[] = [
  { tab: 'Home', title: 'Home', body: 'See today’s meds, stats, and shortcuts to your full list and calendar.' },
  { tab: 'Calendar', title: 'Calendar', body: 'Swipe the week strip to plan ahead. Dots mark days with reminders.' },
  { tab: 'Medications', title: 'Medications', body: 'Add, edit, or remove reminders. Use the switch when you take a dose.' },
  { tab: 'Manage', title: 'Manage', body: 'Link caregivers, notification settings, privacy, and sign out.' },
];

export const FAMILY_TUTORIAL: NavTutorialStep[] = [
  { tab: 'Home', title: 'Home', body: 'Overview of everyone you support and quick actions to send reminders.' },
  { tab: 'Family', title: 'Family', body: 'See linked members and accept new link requests from patients.' },
  { tab: 'Schedule', title: 'Schedule', body: 'Morning, afternoon, and evening doses for each linked person.' },
  { tab: 'Manage', title: 'Manage', body: 'Link more family, switch to caregiver mode, or sign out.' },
];

export const CAREGIVER_TUTORIAL: NavTutorialStep[] = [
  { tab: 'Home', title: 'Dashboard', body: 'Quick stats and shortcuts to patients, medications, and alerts.' },
  { tab: 'Patients', title: 'Patients', body: 'Search, expand a patient, send reminders, and accept link requests.' },
  { tab: 'Schedule', title: 'Schedule', body: 'Every linked patient’s day in one place — morning through evening.' },
  { tab: 'Medications', title: 'Medications', body: 'Open a patient to view meds. Alerts live in this tab too.' },
  { tab: 'Manage', title: 'Manage', body: 'Link patients, account settings, family view, and sign out.' },
];
