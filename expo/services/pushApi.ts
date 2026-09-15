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

async function authorizedWorkerGet<T>(path: string): Promise<T> {
  const idToken = await getIdToken();
  if (!idToken) throw new Error('Not authenticated');
  const response = await fetch(`${PUSH_API_URL}${path}`, {
    headers: { Authorization: `Bearer ${idToken}` },
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

export type OrderChatRole = 'customer' | 'provider';

export interface OrderChatMessage {
  messageId: string;
  orderId: string;
  senderUid: string;
  senderRole: OrderChatRole;
  text: string;
  createdAt: string;
  sequence: number;
  type: 'text';
}

export interface OrderChatPage {
  writable: boolean;
  messages: OrderChatMessage[];
  lastReadSequence: number;
  unreadVisibleCount: number;
  unreadMayExistOutsidePage: boolean;
  nextCursor: string | null;
}

export interface PendingOrderChatSend {
  requestId: string;
  text: string;
}

/** A poll can merge newer messages, but may never rewind older-page progress. */
export function preserveOlderChatCursor(
  initializedOrderId: string | null,
  orderId: string,
  currentCursor: string | null,
  newestPageCursor: string | null,
): { initializedOrderId: string; cursor: string | null } {
  return initializedOrderId === orderId
    ? { initializedOrderId: orderId, cursor: currentCursor }
    : { initializedOrderId: orderId, cursor: newestPageCursor };
}

/** Retrying after an ambiguous network failure must reuse byte-for-byte intent. */
export function pendingOrderChatSend(
  existing: PendingOrderChatSend | null,
  requestId: string,
  text: string,
): PendingOrderChatSend {
  return existing ?? { requestId, text };
}

/** Stable UI merge for a polling/page race: no fetched message is discarded. */
export function mergeOrderChatMessages(
  existing: OrderChatMessage[],
  incoming: OrderChatMessage[],
): OrderChatMessage[] {
  const byId = new Map<string, OrderChatMessage>();
  for (const message of [...existing, ...incoming]) byId.set(message.messageId, message);
  return [...byId.values()].sort((a, b) => a.sequence - b.sequence || a.createdAt.localeCompare(b.createdAt));
}

/** Matches an ambiguous send against the Worker idempotency document. */
export function findReconciledOrderChatMessage(
  messages: OrderChatMessage[],
  pending: PendingOrderChatSend,
  senderUid: string,
): OrderChatMessage | null {
  return messages.find(
    (message) =>
      message.messageId === pending.requestId
      && message.senderUid === senderUid
      && message.text === pending.text,
  ) ?? null;
}

function parseChatPage(data: {
  writable?: unknown;
  messages?: unknown;
  lastReadSequence?: unknown;
  unreadVisibleCount?: unknown;
  unreadMayExistOutsidePage?: unknown;
  nextCursor?: unknown;
}): OrderChatPage {
  const messages = Array.isArray(data.messages)
    ? data.messages
      .filter((message): message is Record<string, unknown> => !!message && typeof message === 'object')
      .filter((message) =>
        typeof message.messageId === 'string'
        && typeof message.orderId === 'string'
        && typeof message.senderUid === 'string'
        && (message.senderRole === 'customer' || message.senderRole === 'provider')
        && typeof message.text === 'string'
        && typeof message.createdAt === 'string'
        && message.type === 'text',
      )
      .map((message) => ({
        messageId: message.messageId as string,
        orderId: message.orderId as string,
        senderUid: message.senderUid as string,
        senderRole: message.senderRole as OrderChatRole,
        text: message.text as string,
        createdAt: message.createdAt as string,
        sequence: typeof message.sequence === 'number' && Number.isInteger(message.sequence) && message.sequence >= 0 ? message.sequence : 0,
        type: 'text' as const,
      }))
    : [];
  return {
    writable: data.writable === true,
    messages,
    lastReadSequence: typeof data.lastReadSequence === 'number' && Number.isInteger(data.lastReadSequence) && data.lastReadSequence >= 0 ? data.lastReadSequence : 0,
    unreadVisibleCount: typeof data.unreadVisibleCount === 'number' && Number.isInteger(data.unreadVisibleCount) && data.unreadVisibleCount >= 0 ? data.unreadVisibleCount : 0,
    unreadMayExistOutsidePage: data.unreadMayExistOutsidePage === true,
    nextCursor: typeof data.nextCursor === 'string' ? data.nextCursor : null,
  };
}

/** Server-authoritative, bounded page of order negotiation messages. */
export async function getOrderChat(orderId: string, cursor?: string | null): Promise<OrderChatPage> {
  const query = cursor ? `?limit=30&cursor=${encodeURIComponent(cursor)}` : '?limit=30';
  const data = await authorizedWorkerGet<{
    writable?: unknown;
    messages?: unknown;
    lastReadSequence?: unknown;
    unreadVisibleCount?: unknown;
    unreadMayExistOutsidePage?: unknown;
    nextCursor?: unknown;
  }>(`/orders/${encodeURIComponent(orderId)}/chat${query}`);
  return parseChatPage(data);
}

export async function sendOrderChatMessage(
  orderId: string,
  requestId: string,
  text: string,
): Promise<OrderChatMessage> {
  const data = await authorizedWorkerRequest<{ message?: unknown }>('/orders/chat/send', {
    orderId,
    requestId,
    text,
  });
  const page = parseChatPage({ messages: data.message ? [data.message] : [] });
  const message = page.messages[0];
  if (!message) throw new Error('Chat message response was invalid');
  return message;
}

/** Acknowledgement time is assigned and fenced by the Worker, not the client. */
export async function markOrderChatRead(
  orderId: string,
  lastVisibleMessageId: string,
  contiguousFromSequence: number,
): Promise<number> {
  const data = await authorizedWorkerRequest<{ lastReadSequence?: unknown }>('/orders/chat/read', {
    orderId,
    lastVisibleMessageId,
    contiguousFromSequence,
  });
  if (typeof data.lastReadSequence !== 'number' || !Number.isInteger(data.lastReadSequence) || data.lastReadSequence < 0) throw new Error('Chat read response was invalid');
  return data.lastReadSequence;
}

export interface ComplaintRef {
  id: string;
  orderId: string;
  orderNumber: string;
  source: string;
  target: string;
  type: string;
  complaintStatus: string;
  note: string;
  adminNote: string;
  createdAt: string;
  updatedAt: string;
}

export async function getMyComplaintsViaWorker(): Promise<ComplaintRef[]> {
  const data = await authorizedWorkerGet<{ complaints?: unknown }>('/complaints/mine');
  if (!Array.isArray(data.complaints)) return [];
  return data.complaints
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .filter((item) => typeof item.orderId === 'string' && typeof item.source === 'string' && typeof item.complaintStatus === 'string')
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : '',
      orderId: item.orderId as string,
      orderNumber: typeof item.orderNumber === 'string' ? item.orderNumber : '',
      source: item.source as string,
      target: typeof item.target === 'string' ? item.target : '',
      type: typeof item.type === 'string' ? item.type : '',
      complaintStatus: item.complaintStatus as string,
      note: typeof item.note === 'string' ? item.note : '',
      adminNote: typeof item.adminNote === 'string' ? item.adminNote : '',
      createdAt: typeof item.createdAt === 'string' ? item.createdAt : '',
      updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : '',
    }));
}

export async function createDeliveryComplaintViaWorker(
  orderId: string,
  type: 'customer_rejected_receipt' | 'delivery_not_confirmed' | 'customer_complaint' | 'provider_complaint',
  note: string,
  target?: 'customer' | 'provider' | 'driver',
): Promise<ComplaintRef> {
  const data = await authorizedWorkerRequest<{ complaint?: unknown }>('/complaints/create', {
    orderId,
    type,
    note,
    ...(target ? { target } : {}),
  });
  const complaint = data.complaint as Record<string, unknown> | undefined;
  if (!complaint || typeof complaint.orderId !== 'string' || typeof complaint.source !== 'string' || typeof complaint.complaintStatus !== 'string') throw new Error('Complaint response was invalid');
  return {
    id: typeof complaint.id === 'string' ? complaint.id : '',
    orderId: complaint.orderId,
    orderNumber: typeof complaint.orderNumber === 'string' ? complaint.orderNumber : '',
    source: complaint.source,
    target: typeof complaint.target === 'string' ? complaint.target : '',
    type: typeof complaint.type === 'string' ? complaint.type : '',
    complaintStatus: complaint.complaintStatus,
    note: typeof complaint.note === 'string' ? complaint.note : '',
    adminNote: typeof complaint.adminNote === 'string' ? complaint.adminNote : '',
    createdAt: typeof complaint.createdAt === 'string' ? complaint.createdAt : '',
    updatedAt: typeof complaint.updatedAt === 'string' ? complaint.updatedAt : '',
  };
}

export async function reportOrderChat(
  orderId: string,
  messageId?: string,
  note?: string,
): Promise<void> {
  await authorizedWorkerRequest('/orders/chat/report', {
    orderId,
    ...(messageId ? { messageId } : {}),
    ...(note?.trim() ? { note: note.trim() } : {}),
  });
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
  } catch {
    console.log('[PushAPI] order contact unavailable');
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
  } catch {
    console.log('[PushAPI] payment instructions unavailable');
    return null;
  }
}

export async function registerPrivateDeviceToken(token: string | null): Promise<void> {
  await authorizedWorkerRequest('/devices/register', { token, platform: typeof navigator === 'undefined' ? 'native' : 'web' });
}

export async function setPublicLocationPreference(
  publicLocationEnabled: boolean,
  publicLocation?: { lat: number; lng: number; city: string } | null,
): Promise<void> {
  await authorizedWorkerRequest('/profile/public-discovery', {
    publicLocationEnabled,
    ...(publicLocationEnabled ? { publicLocation } : {}),
  });
}

/** Deletes the provider's own offer through the ownership-checked Worker path. */
export async function deleteOfferViaWorker(offerId: string): Promise<void> {
  await authorizedWorkerRequest(`/offers/${encodeURIComponent(offerId)}/delete`, {});
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
      console.log('[PushAPI] No auth token; notification skipped');
      return;
    }
    const response = await fetch(`${PUSH_API_URL}/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ event, orderId }),
    });
    await response.json();
  } catch {
    console.log('[PushAPI] Notification request failed');
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
  const response = await fetch(`${PUSH_API_URL}/delivery-quote`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ orderId }),
  });
  const data = await response.json();
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
  const response = await fetch(`${PUSH_API_URL}/finalize-delivery`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ orderId, method }),
  });
  const data = await response.json();
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
