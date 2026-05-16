import { setMedicationTaken } from '@/api/index';
import { redeemPatientLinkCode } from '@/api/index';
import { getMutationQueue, setMutationQueue, type OfflineMutation } from '@/lib/offline/store';

export async function flushOfflineQueue(): Promise<number> {
  const queue = await getMutationQueue();
  if (queue.length === 0) return 0;

  const remaining: OfflineMutation[] = [];
  let synced = 0;

  for (const item of queue) {
    try {
      if (item.type === 'medication_taken') {
        await setMedicationTaken(item.medicationId, item.taken);
      } else if (item.type === 'link_redeem') {
        await redeemPatientLinkCode(item.caretakerUid, item.code);
      }
      synced++;
    } catch {
      remaining.push(item);
    }
  }

  await setMutationQueue(remaining);
  return synced;
}
