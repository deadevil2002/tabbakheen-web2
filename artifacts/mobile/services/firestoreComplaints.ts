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
  complaintStatus: string;
}

export interface CustomerComplaint {
  id: string;
  orderId: string;
  orderNumber: string;
  source: string;
  target: string;
  type: string;
  complaintStatus: string;
  note: string;
  adminNote: string;
  createdAt: number | null;
  updatedAt: number | null;
}

function toMillis(v: unknown): number | null {
  if (!v) return null;
  const ts = v as { toMillis?: () => number; seconds?: number };
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  const n = new Date(v as string).getTime();
  return isNaN(n) ? null : n;
}

function mapComplaintDoc(id: string, data: Record<string, unknown>): CustomerComplaint {
  return {
    id,
    orderId: (data.orderId as string) ?? '',
    orderNumber: (data.orderNumber as string) ?? '',
    source: (data.source as string) ?? '',
    target: (data.target as string) ?? '',
    type: (data.type as string) ?? '',
    complaintStatus: (data.complaintStatus as string) ?? '',
    note: (data.note as string) ?? '',
    adminNote: (data.adminNote as string) ?? '',
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
  };
}

/**
 * Subscribe to complaints CREATED BY the given user, identified by their role.
 *
 * Ownership is determined by creator identity (the `source` field), NOT by order
 * participation. A complaint doc stores all order participants
 * (customerUid/providerUid/driverUid), so filtering only by participation would
 * leak complaints created by other parties on the same order (e.g. a driver
 * seeing a customer-created complaint). We therefore filter by the participant
 * field for the query, then additionally require `source === role` client-side
 * so each role sees ONLY the complaints they themselves created.
 */
export function fsSubscribeComplaintsByCreator(
  role: 'customer' | 'provider' | 'driver',
  uid: string,
  cb: (complaints: CustomerComplaint[]) => void,
): Unsubscribe {
  const db = getFirebaseFirestore();
  const field = `${role}Uid`;
  const q = query(collection(db, COLLECTION), where(field, '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => mapComplaintDoc(d.id, d.data() as Record<string, unknown>))
        .filter((c) => !c.source || c.source === role);
      items.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      cb(items);
    },
    (err: unknown) => {
      const msg = (err as { message?: string })?.message ?? String(err);
      console.log('[fsComplaints] complaints-by-creator subscribe error for', role, ':', msg);
      cb([]);
    },
  );
}

export function fsSubscribeCustomerComplaints(
  customerUid: string,
  cb: (complaints: CustomerComplaint[]) => void,
): Unsubscribe {
  return fsSubscribeComplaintsByCreator('customer', customerUid, cb);
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
          const data = d.data() as { orderId?: string; source?: string; complaintStatus?: string };
          return {
            orderId: data.orderId ?? '',
            source: data.source ?? '',
            complaintStatus: data.complaintStatus ?? '',
          };
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
  target?: string;
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
    target: input.target ?? '',
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
