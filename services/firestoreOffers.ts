import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { getFirebaseFirestore } from './firebase';
import type { Offer } from '@/types';

const COLLECTION = 'offers';

function toOffer(id: string, d: Record<string, any>): Offer {
  return {
    id,
    providerUid: d.providerId ?? d.providerUid ?? '',
    title: d.title ?? '',
    description: d.description ?? '',
    price: d.price ?? 0,
    imageUrl: d.imageUrl ?? '',
    isAvailable: d.isAvailable ?? true,
    category: d.category ?? undefined,
    createdAt:
      d.createdAt?.toDate?.()?.toISOString?.() ??
      d.createdAt ??
      new Date().toISOString(),
  };
}

export function fsSubscribeOffers(
  cb: (offers: Offer[]) => void,
): Unsubscribe {
  const db = getFirebaseFirestore();
  return onSnapshot(
    query(collection(db, COLLECTION)),
    (snap) => {
      const offers = snap.docs.map((d) => toOffer(d.id, d.data()));
      offers.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      console.log('[fsOffers] snapshot:', offers.length, 'offers');
      cb(offers);
    },
    (err) => {
      console.log('[fsOffers] subscribe error:', err);
      cb([]);
    },
  );
}

export async function fsCreateOffer(
  data: Omit<Offer, 'id' | 'createdAt'>,
): Promise<string> {
  const db = getFirebaseFirestore();
  const { providerUid, ...rest } = data;
  const ref = await addDoc(collection(db, COLLECTION), {
    ...rest,
    providerId: providerUid,
    createdAt: serverTimestamp(),
  });
  console.log('[fsOffers] created:', ref.id);
  return ref.id;
}

export async function fsUpdateOffer(
  id: string,
  partial: Partial<Offer>,
): Promise<void> {
  const db = getFirebaseFirestore();
  const clean: Record<string, any> = { ...partial };
  delete clean.id;
  delete clean.createdAt;
  if (clean.providerUid) {
    clean.providerId = clean.providerUid;
    delete clean.providerUid;
  }
  await updateDoc(doc(db, COLLECTION, id), clean);
  console.log('[fsOffers] updated:', id);
}
