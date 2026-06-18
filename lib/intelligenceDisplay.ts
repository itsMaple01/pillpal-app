export interface IntelligenceProfile {
  miss_risk?: number;
  miss_risk_label?: string;
  action?: string;
  cluster_label?: string;
  preferred_lead_minutes?: number;
  avg_response_delay_minutes?: number;
  engine?: string;
  model_version?: string;
}

export type RiskLevel = 'Low' | 'Medium' | 'High';

export function getRiskLevel(profile: IntelligenceProfile): RiskLevel {
  const label = (profile.miss_risk_label || '').toLowerCase();
  const score = profile.miss_risk ?? 0;
  if (label === 'high' || score >= 0.7) return 'High';
  if (label === 'medium' || score >= 0.35) return 'Medium';
  return 'Low';
}

export function getRiskColor(level: RiskLevel): string {
  if (level === 'High') return '#c62828';
  if (level === 'Medium') return '#e65100';
  return '#2d7a3a';
}

export function getRiskBg(level: RiskLevel): string {
  if (level === 'High') return '#fce4ec';
  if (level === 'Medium') return '#fff3e0';
  return '#eef6f0';
}

export function getActionLabel(action?: string): string {
  switch (action) {
    case 'delay':
      return 'Delay reminder';
    case 'snooze':
      return 'Snooze reminder';
    case 'send_now':
    default:
      return 'Send reminder now';
  }
}

export function getRiskExplanation(profile: IntelligenceProfile, level: RiskLevel): string {
  if (profile.cluster_label === 'needs_nudge') {
    return 'You often respond late to reminders. An earlier nudge may help you stay on track.';
  }
  if (profile.cluster_label === 'consistent') {
    return 'Your recent adherence pattern is strong. Keep following your schedule.';
  }
  if (level === 'High') {
    return 'Recent missed or delayed doses raise your miss risk. Watch for upcoming reminders.';
  }
  if (level === 'Medium') {
    return 'Some doses have been delayed lately. Try to take medications closer to schedule.';
  }
  return 'Your adherence looks steady. Continue taking medications as scheduled.';
}
