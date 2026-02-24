import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { getFirebaseFirestore } from './firebase';
import type { Order, AppSettings, PaymentMethod, PaymentStatus, DeliveryStatus } from '@/types';

const COLLECTION = 'orders';

function toFsPaymentMethod(val: string): string {
  const map: Record<string, string> = {
    cod: 'CASH',
    stc_pay: 'STC_PAY',
    bank_transfer: 'BANK_TRANSFER',
  };
  return map[val] || val;
}

function fromFsPaymentMethod(val: string): PaymentMethod {
  const map: Record<string, PaymentMethod> = {
    CASH: 'cod',
    STC_PAY: 'stc_pay',
    BANK_TRANSFER: 'bank_transfer',
  };
  return map[val] || (val as PaymentMethod);
}

function toFsPaymentStatus(val: string): string {
  const map: Record<string, string> = {
    unpaid: 'PENDING',
    proof_sent: 'PROOF_SENT',
    paid_confirmed: 'PAID_CONFIRMED',
    payment_rejected: 'PAYMENT_REJECTED',
    paid: 'PAID',
    refunded: 'REFUNDED',
    failed: 'FAILED',
  };
  return map[val] || val;
}

function fromFsPaymentStatus(val: string): PaymentStatus {
  const map: Record<string, PaymentStatus> = {
    PENDING: 'unpaid',
    PROOF_SENT: 'proof_sent',
    PAID_CONFIRMED: 'paid_confirmed',
    PAYMENT_REJECTED: 'payment_rejected',
    PAID: 'paid',
    REFUNDED: 'refunded',
    FAILED: 'failed',
  };
  return map[val] || (val as PaymentStatus);
}

function toOrder(id: string, d: Record<string, any>): Order {
  return {
    id,
    orderNumber: d.orderNumber ?? '',
    customerUid: d.customerUid ?? '',
    providerUid: d.providerUid ?? '',
    driverUid: d.driverUid ?? null,
    offerId: d.offerId ?? '',
    offerTitleSnapshot: d.offerTitleSnapshot ?? '',
    priceSnapshot: d.priceSnapshot ?? 0,
    deliveryFee: d.deliveryFee ?? 0,
    totalAmount: d.totalAmount ?? 0,
    deliveryMethod: d.deliveryMethod ?? null,
    paymentMethod: fromFsPaymentMethod(d.paymentMethod ?? 'CASH'),
    deliveryPaymentMethod: d.deliveryPaymentMethod ?? null,
    paymentStatus: fromFsPaymentStatus(d.paymentStatus ?? 'PENDING'),
    status: d.status ?? 'pending',
    providerComment: d.providerComment ?? '',
    statusReason: d.statusReason ?? '',
    driverStatus: d.driverStatus ?? '',
    deliveryStatus: d.deliveryStatus ?? null,
    orderRef: d.orderRef ?? '',
    transactionId: d.transactionId ?? '',
    paidAt: d.paidAt ?? null,
    ratingSubmitted: d.ratingSubmitted ?? false,
    driverRatingSubmitted: d.driverRatingSubmitted ?? false,
    note: d.note ?? '',
    deliveryNotes: d.deliveryNotes ?? '',
    stcPayProofImageUrl: d.stcPayProofImageUrl ?? '',
    stcPayProofNote: d.stcPayProofNote ?? '',
    paymentReference: d.paymentReference ?? '',
    providerLat: d.providerLat ?? null,
    providerLng: d.providerLng ?? null,
    customerLat: d.customerLat ?? null,
    customerLng: d.customerLng ?? null,
    pickupAddress: d.pickupAddress ?? '',
    dropoffAddress: d.dropoffAddress ?? '',
    createdAt:
      d.createdAt?.toDate?.()?.toISOString?.() ??
      d.createdAt ??
      new Date().toISOString(),
    updatedAt:
      d.updatedAt?.toDate?.()?.toISOString?.() ??
      d.updatedAt ??
      new Date().toISOString(),
  };
}

export function fsSubscribeOrders(
  field: string,
  value: string,
  cb: (orders: Order[]) => void,
): Unsubscribe {
  const db = getFirebaseFirestore();
  const q = query(collection(db, COLLECTION), where(field, '==', value));
  return onSnapshot(
    q,
    (snap) => {
      const orders = snap.docs.map((d) => toOrder(d.id, d.data()));
      orders.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      console.log('[fsOrders] snapshot for', field, ':', orders.length, 'orders');
      cb(orders);
    },
    (err) => {
      console.log('[fsOrders] subscribe error for', field, ':', err);
      cb([]);
    },
  );
}

export async function fsCreateOrder(
  data: Omit<Order, 'id'>,
): Promise<string> {
  const db = getFirebaseFirestore();
  const payload: Record<string, any> = { ...data };
  payload.paymentMethod = toFsPaymentMethod(payload.paymentMethod);
  payload.paymentStatus = toFsPaymentStatus(payload.paymentStatus);
  payload.createdAt = serverTimestamp();
  payload.updatedAt = serverTimestamp();
  console.log('[fsOrders] creating order payload:', JSON.stringify({
    customerUid: payload.customerUid,
    providerUid: payload.providerUid,
    paymentMethod: payload.paymentMethod,
    paymentStatus: payload.paymentStatus,
    offerId: payload.offerId,
  }));
  const ref = await addDoc(collection(db, COLLECTION), payload);
  console.log('[fsOrders] created:', ref.id);
  return ref.id;
}

export async function fsUpdateOrder(
  orderId: string,
  changes: Record<string, any>,
): Promise<void> {
  const db = getFirebaseFirestore();
  const payload = { ...changes };
  if (payload.paymentMethod) {
    payload.paymentMethod = toFsPaymentMethod(payload.paymentMethod);
  }
  if (payload.paymentStatus) {
    payload.paymentStatus = toFsPaymentStatus(payload.paymentStatus);
  }
  console.log('[fsOrders] updating order', orderId, 'with:', JSON.stringify(payload));
  await updateDoc(doc(db, COLLECTION, orderId), payload);
  console.log('[fsOrders] updated:', orderId);
}

export function fsSubscribeAvailableDeliveries(
  cb: (orders: Order[]) => void,
): Unsubscribe {
  const db = getFirebaseFirestore();
  const q = query(
    collection(db, COLLECTION),
    where('status', '==', 'ready_for_pickup'),
    where('deliveryMethod', '==', 'driver_delivery'),
  );
  return onSnapshot(
    q,
    (snap) => {
      const orders = snap.docs
        .map((d) => toOrder(d.id, d.data()))
        .filter((o) => !o.driverUid);
      console.log('[fsOrders] available deliveries:', orders.length);
      cb(orders);
    },
    (err) => {
      console.log('[fsOrders] available deliveries error:', err);
      cb([]);
    },
  );
}

export async function fsUpdateDeliveryStatus(
  orderId: string,
  deliveryStatus: DeliveryStatus,
): Promise<void> {
  const db = getFirebaseFirestore();
  console.log('[fsOrders] updating delivery status', orderId, '->', deliveryStatus);
  await updateDoc(doc(db, COLLECTION, orderId), { deliveryStatus });
  console.log('[fsOrders] delivery status updated:', orderId);
}

export async function fsSubmitProviderRating(
  providerUid: string,
  orderId: string,
  customerUid: string,
  stars: number,
  comment: string,
): Promise<void> {
  const db = getFirebaseFirestore();
  await setDoc(
    doc(db, 'provider_ratings', providerUid, 'ratings', orderId),
    {
      customerUid,
      providerUid,
      stars,
      comment,
      createdAt: serverTimestamp(),
    },
  );
  console.log('[fsOrders] provider rating submitted for order:', orderId);
}

export async function fsSubmitDriverRating(
  driverUid: string,
  orderId: string,
  customerUid: string,
  stars: number,
  comment: string,
): Promise<void> {
  const db = getFirebaseFirestore();
  await setDoc(
    doc(db, 'driver_ratings', driverUid, 'ratings', orderId),
    {
      customerUid,
      driverUid,
      stars,
      comment,
      createdAt: serverTimestamp(),
    },
  );
  console.log('[fsOrders] driver rating submitted for order:', orderId);
}

export function fsSubscribeAppSettings(
  cb: (settings: AppSettings | null) => void,
): Unsubscribe {
  const db = getFirebaseFirestore();
  return onSnapshot(
    doc(db, 'app_settings', 'main'),
    (snap) => {
      if (!snap.exists()) {
        console.log('[fsOrders] app_settings/main not found');
        cb(null);
        return;
      }
      console.log('[fsOrders] app_settings loaded');
      cb(snap.data() as AppSettings);
    },
    (err) => {
      console.log('[fsOrders] app_settings error:', err);
      cb(null);
    },
  );
}
