import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Check if db is initialized
if (!db) {
  console.error('Firebase db not initialized in useAlerts hook');
}

export interface Alert {
  id: string;
  caretaker_uid: string;
  patient_uid: string;
  patient_name: string;
  medication_name: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: any;
}

export function useAlerts(caretaker_uid: string) {
  const [alerts, setAlerts]   = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!caretaker_uid || !db) return;

    const q = query(
      collection(db, 'alerts'),
      where('caretaker_uid', '==', caretaker_uid),
      orderBy('created_at', 'desc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Alert));
      setAlerts(data);
      setLoading(false);
    });

    return () => unsub();
  }, [caretaker_uid]);

  const unreadCount = alerts.filter(a => !a.is_read).length;

  // Mark a single alert read in Firestore (backend handles Neon via PATCH /:id/read)
  const markRead = async (alertId: string) => {
    if (!db) return;
    await updateDoc(doc(db, 'alerts', alertId), { is_read: true });
  };

  const markAllRead = async () => {
    if (!db) return;
    const unread = alerts.filter(a => !a.is_read);
    await Promise.all(unread.map(a => updateDoc(doc(db, 'alerts', a.id), { is_read: true })));
  };

  return { alerts, loading, unreadCount, markRead, markAllRead };
}