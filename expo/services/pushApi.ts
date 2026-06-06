import { getFirebaseAuth } from './firebase';

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

export async function aggregateRatingViaWorker(
  type: 'provider' | 'driver',
  uid: string,
): Promise<void> {
  try {
    const idToken = await getIdToken();
    if (!idToken) {
      console.log(`[PushAPI] No auth token — skipping ${type} rating aggregation`);
      return;
    }
    console.log(`[PushAPI] Aggregating ${type} rating for ${uid}`);
    const response = await fetch(`${PUSH_API_URL}/aggregate-rating`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ type, uid }),
    });
    const data = await response.json();
    console.log(`[PushAPI] Aggregate response:`, JSON.stringify(data));
  } catch (e) {
    console.log(`[PushAPI] Error aggregating ${type} rating:`, e);
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
