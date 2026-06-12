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
  { tab: 'Home', title: 'Home', body: 'See today\'s medications, compliance stats, and quick access to inventory and calendar.' },
  { tab: 'Calendar', title: 'Calendar', body: 'View your full medication schedule by day.' },
  { tab: 'Medications', title: 'Medications', body: 'Manage all your medications, mark doses as taken, check inventory.' },
  { tab: 'Manage', title: 'Manage', body: 'Update your profile, view inventory, and manage account settings.' },
];

export const FAMILY_TUTORIAL: NavTutorialStep[] = [
  { tab: 'Home', title: 'Home', body: 'Overview of linked family members and their medication status.' },
  { tab: 'Family', title: 'Family', body: 'View linked family members and their health details.' },
  { tab: 'Schedule', title: 'Schedule', body: 'See all family members\' medication schedules with status indicators.' },
  { tab: 'Manage', title: 'Manage', body: 'Manage linked members, inventory, and account settings.' },
];

export const CAREGIVER_TUTORIAL: NavTutorialStep[] = [
  { tab: 'Home', title: 'Home', body: 'Overview of all linked patients, missed doses, and compliance stats.' },
  { tab: 'Patients', title: 'Patients', body: 'View and manage each patient, send reminders, view their schedule.' },
  { tab: 'Schedule', title: 'Schedule', body: 'See all patients\' medication schedules in one daily view with missed/late indicators.' },
  { tab: 'Manage', title: 'Manage', body: 'Manage linked patients, inventory, alerts, and account settings.' },
];
