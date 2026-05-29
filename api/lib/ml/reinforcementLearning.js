/**
 * RL placeholder — replace with trained policy (e.g. Q-table or small neural net).
 * @returns {{ preferred_lead_minutes: number, policy_version: string }}
 */
function suggestReminderLead(events, profile) {
  const base = profile?.preferred_lead_minutes ?? 5;
  const snoozes = events.filter(e => e.event_type === 'snooze').length;
  const confirms = events.filter(e => e.event_type === 'confirm' || e.event_type === 'taken').length;
  let lead = base;
  if (snoozes > confirms) lead = Math.min(15, lead + 5);
  if (confirms > 8 && snoozes < 2) lead = Math.max(3, lead - 2);
  return { preferred_lead_minutes: lead, policy_version: 'rl-stub-v1' };
}

module.exports = { suggestReminderLead };
