export interface IntelligenceProfile {
  miss_risk?: number;
  miss_risk_label?: string;
  sample_size_sufficient?: boolean;
  action?: string;
  action_code?: number;
  cluster_label?: string;
  preferred_lead_minutes?: number;
  avg_response_delay_minutes?: number;
  engine?: string;
  model_version?: string;
}

export type RiskLevel = 'Low' | 'Medium' | 'High';

const INSUFFICIENT_SAMPLE_SUFFIX = ':insufficient_sample';

/** True when fewer than 5 intelligence_events — risk tier is not yet reliable. */
export function isSampleInsufficient(profile: IntelligenceProfile): boolean {
  if (typeof profile.sample_size_sufficient === 'boolean') {
    return !profile.sample_size_sufficient;
  }
  return profile.model_version?.includes(INSUFFICIENT_SAMPLE_SUFFIX) ?? false;
}

export function getLearningPatternMessage(): string {
  return "Still learning this patient's pattern";
}

/** Risk tier from server-derived miss_risk_label (low | medium | high). */
export function getRiskLevel(profile: IntelligenceProfile): RiskLevel {
  const label = (profile.miss_risk_label || 'low').toLowerCase();
  if (label === 'high') return 'High';
  if (label === 'medium') return 'Medium';
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

export function getRecommendedAction(level: RiskLevel): string {
  switch (level) {
    case 'Low':
      return 'Keep it up! Continue current routine.';
    case 'Medium':
      return 'Monitor closely. Consider sending a reminder.';
    case 'High':
      return 'Send reminder now. Immediate intervention recommended.';
  }
}

/** Recommended copy driven by risk tier; learning state when sample is insufficient. */
export function getRecommendedActionForProfile(profile: IntelligenceProfile): string {
  if (isSampleInsufficient(profile)) {
    return getLearningPatternMessage();
  }
  return getRecommendedAction(getRiskLevel(profile));
}

export function getRiskSummary(level: RiskLevel): string {
  switch (level) {
    case 'Low':
      return '🟢 Low Risk — Patient is adhering well. No action needed.';
    case 'Medium':
      return '🟡 Medium Risk — Patient shows some inconsistency. Caretaker should monitor more closely.';
    case 'High':
      return '🔴 High Risk — Patient has poor adherence pattern. Immediate follow-up recommended.';
  }
}

export function getRiskExplanation(profile: IntelligenceProfile, level: RiskLevel): string {
  if (isSampleInsufficient(profile)) {
    return getLearningPatternMessage();
  }
  if (profile.cluster_label === 'needs_nudge') {
    return 'You often respond late to reminders. An earlier nudge may help you stay on track.';
  }
  if (profile.cluster_label === 'consistent') {
    return 'Your recent adherence pattern is strong. Keep following your schedule.';
  }
  return getRiskSummary(level).replace(/^[^\s]+\s/, '');
}
