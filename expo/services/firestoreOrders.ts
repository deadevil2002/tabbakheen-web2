import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { getFirebaseFirestore, getFirebaseAuth } from './firebase';
import type {
  AvailableDelivery,
  Order,
  AppSettings,
  PaymentMethod,
  PaymentStatus,
  DeliveryStatus,
  UserLocation,
} from '@/types';

const COLLECTION = 'orders';
const WORKER_URL = 'https://tabbakheen-api.tabbakheen.workers.dev';

function fromFsPaymentMethod(val: string): PaymentMethod {
  const map: Record<string, PaymentMethod> = {
    CASH: 'cod',
    STC_PAY: 'stc_pay',
    BANK_TRANSFER: 'bank_transfer',
  };
  return map[val] || (val as PaymentMethod);
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
    ratingSubmitted: d.ratingSubmitted ?? d.providerHasRating ?? d.hasRating ?? false,
    driverRatingSubmitted: d.driverRatingSubmitted ?? d.driverHasRating ?? false,
    providerHasRating: d.providerHasRating ?? d.hasRating ?? d.ratingSubmitted ?? false,
    driverHasRating: d.driverHasRating ?? d.driverRatingSubmitted ?? false,
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
    deliveryDistanceKm: d.deliveryDistanceKm ?? 0,
    deliveryQuoteId: d.deliveryQuoteId ?? '',
    deliveryPricingVersion: d.deliveryPricingVersion ?? '',
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

function toIsoString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

function toPickupLocation(value: unknown): UserLocation | null {
  if (!value || typeof value !== 'object') return null;
  const { lat, lng } = value as Record<string, unknown>;
  return typeof lat === 'number' && Number.isFinite(lat) && typeof lng === 'number' && Number.isFinite(lng)
    ? { lat, lng }
    : null;
}

/**
 * Maps only the documented Worker delivery-discovery fields. Keeping this
 * separate from toOrder prevents a redacted payload from being fabricated into
 * a complete Order with misleading empty private fields.
 */
export function toAvailableDelivery(id: string, data: Record<string, unknown>): AvailableDelivery {
  return {
    id,
    orderNumber: typeof data.orderNumber === 'string' ? data.orderNumber : '',
    offerTitleSnapshot: typeof data.offerTitleSnapshot === 'string' ? data.offerTitleSnapshot : '',
    deliveryFee: typeof data.deliveryFee === 'number' ? data.deliveryFee : 0,
    pickupAddress: typeof data.pickupAddress === 'string' ? data.pickupAddress : '',
    pickupLocation: toPickupLocation(data.pickupLocation),
    deliveryDistanceKm: typeof data.deliveryDistanceKm === 'number' ? data.deliveryDistanceKm : 0,
    createdAt: toIsoString(data.createdAt),
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

export function fsSubscribeAvailableDeliveries(
  cb: (deliveries: AvailableDelivery[]) => void,
): Unsubscribe {
  // Unassigned orders are not subscribed from Firestore. The Worker returns a
  // purpose-built DTO that omits customer UID, contact details, notes, payment
  // data and destination coordinates until assignment.
  let disposed = false;
  const load = async () => {
    try {
      const auth = getFirebaseAuth().currentUser;
      const token = auth ? await auth.getIdToken() : null;
      if (!token) throw new Error('Not authenticated');
      const response = await fetch(`${WORKER_URL}/deliveries/available?limit=25`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Available delivery request failed');
      const deliveryPayload: unknown[] = Array.isArray(data?.deliveries) ? data.deliveries : [];
      const deliveries = deliveryPayload
        .filter((item: unknown): item is Record<string, unknown> =>
          !!item && typeof item === 'object' && typeof (item as Record<string, unknown>).id === 'string',
        )
        .map((item: Record<string, unknown>) => toAvailableDelivery(item.id as string, item));
      if (!disposed) cb(deliveries);
    } catch (error) {
      console.log('[fsOrders] available deliveries worker error:', error);
      if (!disposed) cb([]);
    }
  };
  void load();
  const interval = setInterval(() => { void load(); }, 20_000);
  return () => {
    disposed = true;
    clearInterval(interval);
  };
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
