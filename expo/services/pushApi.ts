import { getFirebaseAuth } from './firebase';
import type { Order, PaymentMethod, PublicRating } from '@/types';

const PUSH_API_URL = 'https://tabbakheen-api.tabbakheen.workers.dev';

async function getIdToken(): Promise<string | null> {
  try {
    const user = getFirebaseAuth().currentUser;
    if (!user) return null;
    return await user.getIdToken();
  } catch {
    return null;
  }
}

async function authorizedWorkerRequest<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const idToken = await getIdToken();
  if (!idToken) throw new Error('Not authenticated');
  const response = await fetch(`${PUSH_API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || !data?.success) throw new Error(data?.error || 'Request failed');
  return data as T;
}

export interface OrderContact {
  phone: string;
}

export interface OrderPaymentInstructions {
  method: 'stc_pay' | 'bank_transfer';
  stcPayPhone?: string;
  bankName?: string;
  accountName?: string;
  iban?: string;
}

export interface CreateOrderRequest {
  requestId: string;
  providerUid: string;
  offerId: string;
  note: string;
  paymentMethod: PaymentMethod;
}

/**
 * Creates an order through the authoritative Worker. The Worker obtains the
 * customer from the token and snapshots offer, pickup, pricing, and payment
 * data itself; callers must not construct those privileged fields.
 */
export async function createOrderViaWorker(request: CreateOrderRequest): Promise<Order> {
  const data = await authorizedWorkerRequest<{ order?: unknown }>('/orders/create', {
    requestId: request.requestId,
    providerUid: request.providerUid,
    offerId: request.offerId,
    quantity: 1,
    note: request.note,
    paymentMethod: request.paymentMethod,
  });
  if (!data.order || typeof data.order !== 'object' || typeof (data.order as { id?: unknown }).id !== 'string') {
    throw new Error('Order creation returned an invalid order');
  }
  return data.order as Order;
}

/** Updates the signed-in driver's availability through the Worker only. */
export async function updateDriverAvailabilityViaWorker(isAvailable: boolean): Promise<void> {
  await authorizedWorkerRequest('/drivers/availability', { isAvailable });
}

/**
 * Server-authoritative order state mutation. The Worker validates the caller,
 * participant role, current state and allowed payload for each action.
 */
export async function transitionProviderOrderViaWorker(
  orderId: string,
  action: 'provider_accept' | 'provider_reject' | 'provider_preparing' | 'provider_ready',
  reason?: string,
): Promise<void> {
  await authorizedWorkerRequest('/order-transition', {
    orderId,
    action,
    ...(action === 'provider_reject' && reason ? { reason } : {}),
  });
}

export async function updateDeliveryProgressViaWorker(
  orderId: string,
  action: 'reject' | 'picked_up' | 'arrived' | 'delivered_pending_confirmation',
): Promise<void> {
  await authorizedWorkerRequest('/delivery-transition', { orderId, action });
}

export async function confirmDeliveredViaWorker(orderId: string): Promise<void> {
  await authorizedWorkerRequest('/delivery-transition', { orderId, action: 'confirm_delivered' });
}

export async function completeSelfPickupViaWorker(orderId: string): Promise<void> {
  await authorizedWorkerRequest('/delivery-transition', { orderId, action: 'complete_self_pickup' });
}

export async function submitPaymentProofViaWorker(
  orderId: string,
  proofImageUrl: string,
  proofNote: string,
  paymentReference: string,
): Promise<void> {
  await authorizedWorkerRequest('/orders/payment-proof', { orderId, proofImageUrl, proofNote, paymentReference });
}

export async function decidePaymentViaWorker(
  orderId: string,
  decision: 'confirm' | 'reject',
  reason?: string,
): Promise<void> {
  if (decision === 'confirm') {
    await authorizedWorkerRequest('/orders/payment-confirm', { orderId });
    return;
  }
  await authorizedWorkerRequest('/orders/payment-reject', { orderId, reason: reason ?? '' });
}

export async function submitRatingViaWorker(
  orderId: string,
  type: 'provider' | 'driver',
  stars: number,
  comment: string,
): Promise<void> {
  await authorizedWorkerRequest('/ratings/submit', { orderId, type, stars, comment });
}

/**
 * Reads the server-redacted public representation of reviews. The endpoint
 * deliberately has no customer or order identifiers in its response contract.
 */
export async function getPublicRatings(
  uid: string,
  kind: 'provider' | 'driver',
): Promise<PublicRating[]> {
  const response = await fetch(
    `${PUSH_API_URL}/profiles/${encodeURIComponent(uid)}/ratings?kind=${kind}`,
  );
  const data = await response.json();
  if (!response.ok || !Array.isArray(data?.ratings)) {
    throw new Error(data?.error || 'Public ratings request failed');
  }
  const ratingsPayload: unknown[] = data.ratings;
  return ratingsPayload
    .filter((rating: unknown): rating is Record<string, unknown> => !!rating && typeof rating === 'object')
    .map((rating: Record<string, unknown>) => ({
      stars: typeof rating.stars === 'number' ? rating.stars : 0,
      comment: typeof rating.comment === 'string' ? rating.comment : '',
      createdAt: typeof rating.createdAt === 'string' ? rating.createdAt : '',
    }));
}

/** Gets minimum order-authorized data; it is deliberately not a UID lookup. */
export async function getOrderContact(orderId: string, target: 'provider' | 'driver'): Promise<OrderContact | null> {
  try {
    const data = await authorizedWorkerRequest<{ phone?: unknown }>('/order-contact', {
      orderId,
      target,
      purpose: 'contact',
    });
    return typeof data.phone === 'string' && data.phone.length > 0 ? { phone: data.phone } : null;
  } catch (error) {
    console.log('[PushAPI] order contact unavailable:', error);
    return null;
  }
}

export async function getOrderPaymentInstructions(orderId: string): Promise<OrderPaymentInstructions | null> {
  try {
    const data = await authorizedWorkerRequest<{
      method?: unknown;
      stcPayPhone?: unknown;
      bankName?: unknown;
      accountName?: unknown;
      iban?: unknown;
    }>('/order-payment-instructions', { orderId, purpose: 'payment_instructions' });
    if (data.method !== 'stc_pay' && data.method !== 'bank_transfer') return null;
    return {
      method: data.method,
      ...(typeof data.stcPayPhone === 'string' ? { stcPayPhone: data.stcPayPhone } : {}),
      ...(typeof data.bankName === 'string' ? { bankName: data.bankName } : {}),
      ...(typeof data.accountName === 'string' ? { accountName: data.accountName } : {}),
      ...(typeof data.iban === 'string' ? { iban: data.iban } : {}),
    };
  } catch (error) {
    console.log('[PushAPI] payment instructions unavailable:', error);
    return null;
  }
}

export async function registerPrivateDeviceToken(token: string | null): Promise<void> {
  await authorizedWorkerRequest('/devices/register', { token, platform: typeof navigator === 'undefined' ? 'native' : 'web' });
}

export async function setDiscoveryLocationPublication(
  publishDiscoveryLocation: boolean,
  discoveryLocation?: { lat: number; lng: number } | null,
): Promise<void> {
  await authorizedWorkerRequest('/profile/public-discovery', {
    publishDiscoveryLocation,
    ...(publishDiscoveryLocation ? { discoveryLocation } : {}),
  });
}

export async function syncMyPublicProfile(): Promise<void> {
  await authorizedWorkerRequest('/profile/public-discovery', { action: 'sync' });
}

export async function getProviderPaymentAvailability(providerUid: string): Promise<{ cod: boolean; stcPay: boolean; bankTransfer: boolean }> {
  const idToken = await getIdToken();
  if (!idToken) throw new Error('Not authenticated');
  const response = await fetch(`${PUSH_API_URL}/providers/payment-availability?providerUid=${encodeURIComponent(providerUid)}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const data = await response.json();
  if (!response.ok || !data?.success) throw new Error(data?.error || 'Payment availability request failed');
  return { cod: data.cod === true, stcPay: data.stcPay === true, bankTransfer: data.bankTransfer === true };
}

export async function acceptDeliveryViaWorker(orderId: string): Promise<void> {
  await authorizedWorkerRequest('/delivery-transition', { orderId, action: 'accept' });
}

export type PushEvent =
  | 'order_accepted'
  | 'order_ready'
  | 'self_pickup_selected'
  | 'driver_delivery_requested'
  | 'driver_assigned'
  | 'picked_up'
  | 'arrived'
  | 'delivered'
  | 'self_pickup_completed';

export async function sendPushNotification(
  event: PushEvent,
  orderId: string,
): Promise<void> {
  try {
    const idToken = await getIdToken();
    if (!idToken) {
      console.log(`[PushAPI] No auth token — skipping ${event} for order ${orderId}`);
      return;
    }
    console.log(`[PushAPI] Sending ${event} for order ${orderId}`);
    const response = await fetch(`${PUSH_API_URL}/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ event, orderId }),
    });
    const data = await response.json();
    console.log(`[PushAPI] Response:`, JSON.stringify(data));
  } catch (e) {
    console.log(`[PushAPI] Error sending ${event}:`, e);
  }
}

export interface DeliveryQuote {
  deliveryFee: number;
  totalAmount: number;
  deliveryDistanceKm: number;
  subtotal: number;
}

export interface DeliveryFinalizeResult {
  deliveryFee: number;
  totalAmount: number;
  deliveryDistanceKm: number;
  deliveryQuoteId?: string;
}

export async function getDeliveryQuote(
  orderId: string,
): Promise<DeliveryQuote> {
  const idToken = await getIdToken();
  if (!idToken) throw new Error('Not authenticated');
  console.log(`[PushAPI] Getting delivery quote for order ${orderId}`);
  const response = await fetch(`${PUSH_API_URL}/delivery-quote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ orderId }),
  });
  const data = await response.json();
  console.log(`[PushAPI] Delivery quote response:`, JSON.stringify(data));
  if (!data.success) {
    throw new Error(data.error || 'Failed to get delivery quote');
  }
  return {
    deliveryFee: data.deliveryFee ?? 0,
    totalAmount: data.totalAmount ?? 0,
    deliveryDistanceKm: data.deliveryDistanceKm ?? 0,
    subtotal: data.subtotal ?? 0,
  };
}

export async function finalizeDeliveryMethod(
  orderId: string,
  method: 'self_pickup' | 'driver',
): Promise<DeliveryFinalizeResult> {
  const idToken = await getIdToken();
  if (!idToken) throw new Error('Not authenticated');
  console.log(`[PushAPI] Finalizing delivery: orderId=${orderId} method=${method}`);
  const response = await fetch(`${PUSH_API_URL}/finalize-delivery`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ orderId, method }),
  });
  const data = await response.json();
  console.log(`[PushAPI] Finalize delivery response:`, JSON.stringify(data));
  if (!data.success) {
    throw new Error(data.error || 'Failed to finalize delivery');
  }
  return {
    deliveryFee: data.deliveryFee ?? 0,
    totalAmount: data.totalAmount ?? 0,
    deliveryDistanceKm: data.deliveryDistanceKm ?? 0,
    deliveryQuoteId: data.deliveryQuoteId,
  };
}

export type CrVerificationStatus = 'verified' | 'pending_review' | 'unverified';

export interface CrVerificationResult {
  success: boolean;
  verificationStatus: CrVerificationStatus;
}

/**
 * Submit a Commercial Registration number for optional verification.
 * Wathq is NEVER called from the app — this only hits the Worker, which holds the
 * Wathq secret. We deliberately do NOT log the CR number, uid, or raw response.
 * Any unclear/inactive/timeout/error result resolves to 'pending_review' (no public "failed").
 */
export async function verifyCommercialRegistration(
  uid: string,
  crNumber: string,
): Promise<CrVerificationResult> {
  try {
    const currentUser = getFirebaseAuth().currentUser;
    if (!currentUser) {
      return { success: false, verificationStatus: 'pending_review' };
    }
    const idToken = await currentUser.getIdToken();
    const response = await fetch(`${PUSH_API_URL}/verify-cr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ uid, crNumber }),
    });
    const data = await response.json();
    const raw = data?.verificationStatus;
    const verificationStatus: CrVerificationStatus =
      raw === 'verified' || raw === 'pending_review' || raw === 'unverified'
        ? raw
        : 'pending_review';
    console.log('[PushAPI] CR verification result status:', verificationStatus);
    return { success: !!data?.success, verificationStatus };
  } catch {
    console.log('[PushAPI] CR verification request failed (network)');
    return { success: false, verificationStatus: 'pending_review' };
  }
}

export interface FreelanceCertificatePayload {
  certificateNumber: string;
  fileUrl: string;
  publicId?: string;
  mimeType: 'image/jpeg' | 'image/png';
  filename?: string;
}

/**
 * Submit a Freelance Certificate for OPTIONAL manual (admin) verification.
 * The certificate image is uploaded to Cloudinary client-side first; this call
 * sends only the resulting metadata to the Worker, which (Admin SDK) writes the
 * sensitive record to `verifications/{uid}.freelanceCertificate` and sets the
 * public `users/{uid}.verificationStatus = pending_review`. The client never
 * writes public verification fields directly. We deliberately do NOT log the
 * certificate number, file URL, or uid. Any error resolves to 'pending_review'
 * (no public "failed").
 */
export async function submitFreelanceCertificate(
  uid: string,
  payload: FreelanceCertificatePayload,
): Promise<CrVerificationResult> {
  try {
    const currentUser = getFirebaseAuth().currentUser;
    if (!currentUser) {
      return { success: false, verificationStatus: 'pending_review' };
    }
    const idToken = await currentUser.getIdToken();
    const response = await fetch(`${PUSH_API_URL}/submit-freelance-cert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ uid, ...payload }),
    });
    const data = await response.json();
    const raw = data?.verificationStatus;
    const verificationStatus: CrVerificationStatus =
      raw === 'verified' || raw === 'pending_review' || raw === 'unverified'
        ? raw
        : 'pending_review';
    console.log('[PushAPI] Freelance certificate submit status:', verificationStatus);
    return { success: !!data?.success, verificationStatus };
  } catch {
    console.log('[PushAPI] Freelance certificate submit failed (network)');
    return { success: false, verificationStatus: 'pending_review' };
  }
}

export async function uploadPaymentProofViaWorker(
  fileUri: string,
  orderId: string,
): Promise<string> {
  const currentUser = getFirebaseAuth().currentUser;
  if (!currentUser) throw new Error('فشل التحقق من الهوية');
  const idToken = await currentUser.getIdToken();

  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    type: 'image/jpeg',
    name: 'payment_proof.jpg',
  } as unknown as Blob);
  formData.append('orderId', orderId);

  const response = await fetch(`${PUSH_API_URL}/upload/payment-proof`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    body: formData,
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    const msg = data?.error || 'فشل رفع صورة إثبات الدفع';
    throw new Error(msg);
  }
  if (!data.url) throw new Error('لم يتم استلام رابط الصورة');
  return data.url as string;
}
