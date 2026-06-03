import {
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import { getFirebaseFirestore } from './firebase';

const COLLECTION = 'delivery_complaints';

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
