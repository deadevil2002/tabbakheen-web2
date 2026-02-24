import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { getFirebaseFirestore } from './firebase';
import type { User } from '@/types';

const COLLECTION = 'users';

const FORBIDDEN_FIELDS = [
  'uid', 'role', 'email', 'createdAt',
  'successfulOrders', 'ratingAvg', 'ratingAverage', 'ratingCount',
];

function toUser(id: string, data: Record<string, any>): User {
  return {
    uid: id,
    email: data.email ?? '',
    displayName: data.displayName ?? '',
    phone: data.phone ?? '',
    role: data.role ?? 'customer',
    photoUrl: data.photoUrl ?? '',
    socialLink: data.socialLink ?? '',
    location: data.location ?? null,
    address: data.address ?? '',
    ratingAverage: data.ratingAverage ?? 0,
    ratingCount: data.ratingCount ?? 0,
    fcmToken: data.fcmToken ?? '',
    createdAt: data.createdAt ?? new Date().toISOString(),
    lastLoginAt: data.lastLoginAt,
    paymentMethods: data.paymentMethods,
    vehicleType: data.vehicleType,
    vehiclePlateNumber: data.vehiclePlateNumber,
    vehicleImageUrl: data.vehicleImageUrl,
    city: data.city,
    isAvailable: data.isAvailable,
    maxDistanceKm: data.maxDistanceKm,
    hasAcceptedTerms: data.hasAcceptedTerms,
  };
}

export async function fsGetUser(uid: string): Promise<User | null> {
  try {
    const db = getFirebaseFirestore();
    const snap = await getDoc(doc(db, COLLECTION, uid));
    if (!snap.exists()) return null;
    console.log('[fsUsers] getUser success:', uid);
    return toUser(snap.id, snap.data());
  } catch (e) {
    console.log('[fsUsers] getUser error:', e);
    return null;
  }
}

export function fsSubscribeToUser(
  uid: string,
  cb: (u: User | null) => void,
): Unsubscribe {
  const db = getFirebaseFirestore();
  return onSnapshot(
    doc(db, COLLECTION, uid),
    (snap) => cb(snap.exists() ? toUser(snap.id, snap.data()) : null),
    (err) => {
      console.log('[fsUsers] subscribe error:', err);
      cb(null);
    },
  );
}

export async function fsCreateUser(user: User): Promise<void> {
  const db = getFirebaseFirestore();
  const { uid, ...data } = user;
  await setDoc(doc(db, COLLECTION, uid), data);
  console.log('[fsUsers] created:', uid);
}

export async function fsUpdateUser(
  uid: string,
  partial: Partial<User>,
): Promise<void> {
  const db = getFirebaseFirestore();
  const clean: Record<string, any> = { ...partial };
  for (const f of FORBIDDEN_FIELDS) delete clean[f];
  console.log('[fsUsers] updating user', uid, 'with fields:', Object.keys(clean).join(', '));
  await updateDoc(doc(db, COLLECTION, uid), clean);
  console.log('[fsUsers] updated successfully:', uid);
}

export function fsSubscribeByRole(
  role: string,
  cb: (users: User[]) => void,
): Unsubscribe {
  const db = getFirebaseFirestore();
  const q = query(collection(db, COLLECTION), where('role', '==', role));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => toUser(d.id, d.data()))),
    (err) => {
      console.log('[fsUsers] byRole error:', err);
      cb([]);
    },
  );
}
