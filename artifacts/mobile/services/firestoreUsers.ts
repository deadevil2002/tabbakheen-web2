import {
  doc,
  getDoc,
  getDocs,
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
  'providerRatingAvg', 'providerRatingCount',
  'driverRatingAvg', 'driverRatingCount',
  'accountStatus', 'subscriptionStatus', 'subscriptionPlan',
  'trialEndsAt', 'subscriptionEndsAt',
  'activatedByAdmin', 'approvedByAdmin', 'isApproved',
  'disabledAt', 'disabledReason',
  'suspendedReason', 'suspendedAt', 'suspendedBy',
  // Verification fields are written ONLY by the Worker/Admin SDK — never by the client.
  'verificationStatus', 'verificationSource', 'crNumber', 'verifiedAt',
  'verificationCrName', 'verificationError', 'verificationCheckedAt',
];

// Fields a client MAY legitimately set at create time (immutable afterwards).
// Everything else in FORBIDDEN_FIELDS (ratings, admin, subscription, verification,
// disabled) must be absent from the create payload or Firestore rules reject the
// self-create on `users/{uid}`.
const CREATE_ALLOWED_FIELDS = new Set(['email', 'role', 'createdAt']);

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
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? data.createdAt ?? new Date().toISOString(),
    lastLoginAt: data.lastLoginAt,
    paymentMethods: data.paymentMethods,
    vehicleType: data.vehicleType,
    vehiclePlateNumber: data.vehiclePlateNumber,
    vehicleImageUrl: data.vehicleImageUrl,
    city: data.city,
    isAvailable: data.isAvailable,
    maxDistanceKm: data.maxDistanceKm,
    hasAcceptedTerms: data.hasAcceptedTerms,
    accountStatus: data.accountStatus,
    subscriptionStatus: data.subscriptionStatus,
    subscriptionPlan: data.subscriptionPlan,
    trialEndsAt: data.trialEndsAt?.toDate?.()?.toISOString?.() ?? data.trialEndsAt,
    subscriptionEndsAt: data.subscriptionEndsAt?.toDate?.()?.toISOString?.() ?? data.subscriptionEndsAt,
    activatedByAdmin: data.activatedByAdmin,
    disabledReason: data.disabledReason,
    suspendedReason: data.suspendedReason,
    suspendedAt: data.suspendedAt?.toDate?.()?.toISOString?.() ?? data.suspendedAt,
    suspendedBy: data.suspendedBy,
    expoPushToken: data.expoPushToken,
    pushNotificationsEnabled: data.pushNotificationsEnabled,
    // Only PUBLIC verification fields are hydrated client-side. Sensitive CR data
    // (crNumber, legal name, internal error) is stored in `verifications/{uid}`
    // and must never be mapped into the broadly-readable provider User object.
    verificationStatus: data.verificationStatus,
    verificationSource: data.verificationSource,
    verifiedAt: data.verifiedAt?.toDate?.()?.toISOString?.() ?? data.verifiedAt,
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

/**
 * Read the verified CR national number from `verifications/{uid}` for the CURRENT
 * owner only (this is only ever called with the signed-in user's own uid; Firestore
 * rules restrict reads of this doc to its owner). Sensitive CR data lives here and is
 * never mapped into the public `users/{uid}` object.
 */
export async function fsGetVerificationCrNumber(
  uid: string,
): Promise<string | null> {
  try {
    const db = getFirebaseFirestore();
    const snap = await getDoc(doc(db, 'verifications', uid));
    if (!snap.exists()) return null;
    const cr = snap.data()?.crNumber;
    return typeof cr === 'string' && cr.length > 0 ? cr : null;
  } catch (e: any) {
    console.log('[fsUsers] getVerificationCrNumber error:', e?.code);
    return null;
  }
}

export interface FreelanceCertReview {
  certificateNumber?: string;
  fileUrl?: string;
  submittedAt?: string;
  reviewStatus?: 'pending' | 'approved' | 'rejected';
  internalReviewNote?: string;
  reviewedAt?: string;
}

/**
 * Subscribe to the freelance certificate review state stored under
 * `verifications/{uid}.freelanceCertificate` for the CURRENT owner only
 * (Firestore rules restrict reads of this doc to its owner). This sensitive
 * review data is never mapped into the broadly-readable `users/{uid}` object.
 */
export function fsSubscribeToFreelanceCertificate(
  uid: string,
  cb: (fc: FreelanceCertReview | null) => void,
): Unsubscribe {
  const db = getFirebaseFirestore();
  return onSnapshot(
    doc(db, 'verifications', uid),
    (snap) => {
      const fc = snap.exists() ? snap.data()?.freelanceCertificate : null;
      cb(fc && typeof fc === 'object' ? (fc as FreelanceCertReview) : null);
    },
    (err) => {
      console.log('[fsUsers] freelanceCert subscribe error:', err);
      cb(null);
    },
  );
}

export async function fsUserExistsByEmail(
  email: string,
): Promise<boolean | null> {
  try {
    const db = getFirebaseFirestore();
    const q = query(
      collection(db, COLLECTION),
      where('email', '==', email),
    );
    const snap = await getDocs(q);
    return !snap.empty;
  } catch (e) {
    console.log('[fsUsers] userExistsByEmail error:', e);
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
  const { uid, ...rest } = user;
  const data: Record<string, any> = { ...rest };
  // Never send server-managed fields on create — they would be rejected by rules.
  for (const f of FORBIDDEN_FIELDS) {
    if (!CREATE_ALLOWED_FIELDS.has(f)) delete data[f];
  }
  try {
    await setDoc(doc(db, COLLECTION, uid), data);
    console.log('[fsUsers] created:', uid, 'fields:', Object.keys(data).join(', '));
  } catch (e: any) {
    // Surface the real reason (e.g. permission-denied) so the caller can roll back.
    console.log('[fsUsers] create failed:', uid, e?.code, e?.message);
    throw e;
  }
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
