import {
  addDoc,
  collection,
  serverTimestamp,
} from 'firebase/firestore';
import { getFirebaseFirestore } from './firebase';

const COLLECTION = 'complaints';

export interface ComplaintInput {
  orderId: string;
  orderRef: string;
  customerUid: string;
  providerUid: string;
  driverUid: string;
  status: string;
  deliveryStatus: string;
  driverNote: string;
  type: string;
  orderCreatedAt: string;
  orderUpdatedAt: string;
}

export async function fsCreateComplaint(input: ComplaintInput): Promise<string> {
  const db = getFirebaseFirestore();
  console.log('[fsComplaints] creating complaint for order', input.orderId);
  const ref = await addDoc(collection(db, COLLECTION), {
    ...input,
    resolved: false,
    resolvedAt: null,
    createdAt: serverTimestamp(),
  });
  console.log('[fsComplaints] complaint created:', ref.id);
  return ref.id;
}
