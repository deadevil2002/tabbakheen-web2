import {
  addDoc,
  collection,
  serverTimestamp,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseFirestore } from './firebase';

const COLLECTION = 'delivery_complaints';

export interface ComplaintRef {
  orderId: string;
  source: string;
}

export function fsSubscribeMyComplaints(
  field: 'customerUid' | 'providerUid' | 'driverUid',
  value: string,
  cb: (complaints: ComplaintRef[]) => void,
): Unsubscribe {
  const db = getFirebaseFirestore();
  const q = query(collection(db, COLLECTION), where(field, '==', value));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => {
          const data = d.data() as { orderId?: string; source?: string };
          return { orderId: data.orderId ?? '', source: data.source ?? '' };
        })
        .filter((c) => !!c.orderId);
      cb(items);
    },
    (err: unknown) => {
      const msg = (err as { message?: string })?.message ?? String(err);
      console.log('[fsComplaints] subscribe error for', field, ':', msg);
      cb([]);
    },
  );
}

export interface ComplaintInput {
  orderId: string;
  orderNumber: string;
  orderRef: string;
  customerUid: string;
  providerUid: string;
  driverUid: string;
  status: string;
  deliveryStatus: string;
  type: string;
  note: string;
  source: string;
}

export async function fsCreateComplaint(input: ComplaintInput): Promise<string> {
  const db = getFirebaseFirestore();
  const payload = {
    orderId: input.orderId,
    orderNumber: input.orderNumber ?? '',
    orderRef: input.orderRef ?? '',
    customerUid: input.customerUid,
    providerUid: input.providerUid,
    driverUid: input.driverUid ?? '',
    status: input.status ?? '',
    deliveryStatus: input.deliveryStatus ?? '',
    complaintStatus: 'pending',
    source: input.source ?? '',
    type: input.type ?? '',
    note: input.note ?? '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  console.log('[fsComplaints] creating complaint', {
    collection: COLLECTION,
    orderId: input.orderId,
    source: input.source,
    payloadKeys: Object.keys(payload),
  });
  try {
    const ref = await addDoc(collection(db, COLLECTION), payload);
    console.log('[fsComplaints] complaint created:', ref.id);
    return ref.id;
  } catch (e: any) {
    console.log('[fsComplaints] create FAILED', {
      collection: COLLECTION,
      orderId: input.orderId,
      code: e?.code,
      message: e?.message,
    });
    throw e;
  }
}
