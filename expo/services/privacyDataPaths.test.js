import { afterEach, expect, mock, test } from 'bun:test';

const authenticatedUser = {
  getIdToken: mock(async () => 'test-id-token'),
};

// The service modules must get identity from Firebase, but these tests exercise
// their real request/mapping paths without initializing a Firebase app.
mock.module('./firebase', () => ({
  getFirebaseAuth: () => ({ currentUser: authenticatedUser }),
  getFirebaseFirestore: () => ({}),
}));

const { fsSubscribeAvailableDeliveries } = await import('./firestoreOrders');
const {
  createOrderViaWorker,
  getOrderContact,
  getOrderPaymentInstructions,
  updateDriverAvailabilityViaWorker,
  transitionProviderOrderViaWorker,
  updateDeliveryProgressViaWorker,
  confirmDeliveredViaWorker,
  completeSelfPickupViaWorker,
  submitPaymentProofViaWorker,
  decidePaymentViaWorker,
  submitRatingViaWorker,
  setPublicLocationPreference,
  getOrderChat,
  sendOrderChatMessage,
  markOrderChatRead,
  reportOrderChat,
  mergeOrderChatMessages,
  pendingOrderChatSend,
  preserveOlderChatCursor,
} = await import('./pushApi');
const { hasEnabledPublicLocation, isValidPublicLocation } = await import('../utils/publicLocation');
const { distanceToPublicProvider } = await import('../utils/publicLocation');
const { getOrderPickupNavigationTarget } = await import('../utils/orderPickupNavigation');

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  authenticatedUser.getIdToken.mockClear();
});

test('available-delivery subscription maps only the redacted Worker DTO', async () => {
  const fetchMock = mock(async () => ({
    ok: true,
    json: async () => ({
      success: true,
      deliveries: [{
        id: 'delivery-1',
        orderNumber: 'TB-100',
        offerTitleSnapshot: 'Kabsa',
        deliveryFee: 12,
        pickupAddress: 'Operational pickup point',
        pickupLocation: { lat: 24.7136, lng: 46.6753 },
        deliveryDistanceKm: 4.2,
        createdAt: '2026-01-02T03:04:05.000Z',
        customerUid: 'must-not-reach-driver',
        customerLat: 1,
        customerLng: 2,
        dropoffAddress: 'must-not-reach-driver',
        paymentReference: 'must-not-reach-driver',
      }],
    }),
  }));
  globalThis.fetch = fetchMock;

  let unsubscribe = () => {};
  const deliveries = await new Promise((resolve) => {
    unsubscribe = fsSubscribeAvailableDeliveries(resolve);
  });
  unsubscribe();

  expect(fetchMock).toHaveBeenCalledWith(
    'https://tabbakheen-api.tabbakheen.workers.dev/deliveries/available?limit=25',
    { headers: { Authorization: 'Bearer test-id-token' } },
  );
  expect(deliveries).toEqual([{
    id: 'delivery-1',
    orderNumber: 'TB-100',
    offerTitleSnapshot: 'Kabsa',
    deliveryFee: 12,
    pickupAddress: 'Operational pickup point',
    pickupLocation: { lat: 24.7136, lng: 46.6753 },
    deliveryDistanceKm: 4.2,
    createdAt: '2026-01-02T03:04:05.000Z',
  }]);
});

test('contact and payment clients make scoped authenticated Worker requests', async () => {
  const fetchMock = mock(async (url, options) => {
    if (url.endsWith('/order-contact')) {
      return { ok: true, json: async () => ({ success: true, phone: '+966500000000' }) };
    }
    return {
      ok: true,
      json: async () => ({
        success: true,
        method: 'bank_transfer',
        bankName: 'Bank',
        accountName: 'Provider',
        iban: 'SA0000000000000000000000',
      }),
    };
  });
  globalThis.fetch = fetchMock;

  await expect(getOrderContact('order-1', 'driver')).resolves.toEqual({ phone: '+966500000000' });
  await expect(getOrderPaymentInstructions('order-1')).resolves.toEqual({
    method: 'bank_transfer',
    bankName: 'Bank',
    accountName: 'Provider',
    iban: 'SA0000000000000000000000',
  });

  expect(fetchMock.mock.calls).toEqual([
    [
      'https://tabbakheen-api.tabbakheen.workers.dev/order-contact',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-id-token',
        },
        body: JSON.stringify({ orderId: 'order-1', target: 'driver', purpose: 'contact' }),
      },
    ],
    [
      'https://tabbakheen-api.tabbakheen.workers.dev/order-payment-instructions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-id-token',
        },
        body: JSON.stringify({ orderId: 'order-1', purpose: 'payment_instructions' }),
      },
    ],
  ]);
});

test('order creation and driver availability use authoritative Worker requests', async () => {
  const serverOrder = {
    id: 'order-1',
    orderNumber: 'TB-101',
    providerUid: 'provider-1',
    customerUid: 'customer-derived-by-server',
    pickupAddress: 'Authoritative pickup',
  };
  const fetchMock = mock(async (url) => {
    if (url.endsWith('/orders/create')) {
      return { ok: true, json: async () => ({ success: true, order: serverOrder }) };
    }
    return { ok: true, json: async () => ({ success: true }) };
  });
  globalThis.fetch = fetchMock;

  await expect(createOrderViaWorker({
    requestId: 'request-1',
    providerUid: 'provider-1',
    offerId: 'offer-1',
    note: 'No onions',
    paymentMethod: 'cod',
  })).resolves.toEqual(serverOrder);
  await expect(updateDriverAvailabilityViaWorker(true)).resolves.toBeUndefined();

  expect(fetchMock.mock.calls).toEqual([
    [
      'https://tabbakheen-api.tabbakheen.workers.dev/orders/create',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-id-token',
        },
        body: JSON.stringify({
          requestId: 'request-1',
          providerUid: 'provider-1',
          offerId: 'offer-1',
          quantity: 1,
          note: 'No onions',
          paymentMethod: 'cod',
        }),
      },
    ],
    [
      'https://tabbakheen-api.tabbakheen.workers.dev/drivers/availability',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-id-token',
        },
        body: JSON.stringify({ isAvailable: true }),
      },
    ],
  ]);
});

test('order mutations use only existing semantic Worker endpoints', async () => {
  const fetchMock = mock(async () => ({ ok: true, json: async () => ({ success: true }) }));
  globalThis.fetch = fetchMock;

  await transitionProviderOrderViaWorker('order-1', 'provider_reject', 'Unavailable today');
  await updateDeliveryProgressViaWorker('order-1', 'picked_up');
  await confirmDeliveredViaWorker('order-1');
  await completeSelfPickupViaWorker('order-2');
  await submitPaymentProofViaWorker('order-1', 'https://proof.example/image.jpg', 'Paid', 'ref-1');
  await decidePaymentViaWorker('order-1', 'confirm');
  await decidePaymentViaWorker('order-1', 'reject', 'Unreadable');
  await submitRatingViaWorker('order-1', 'provider', 5, 'Excellent');

  expect(fetchMock.mock.calls.map(([url, options]) => [url, JSON.parse(options.body)])).toEqual([
    ['https://tabbakheen-api.tabbakheen.workers.dev/order-transition', { orderId: 'order-1', action: 'provider_reject', reason: 'Unavailable today' }],
    ['https://tabbakheen-api.tabbakheen.workers.dev/delivery-transition', { orderId: 'order-1', action: 'picked_up' }],
    ['https://tabbakheen-api.tabbakheen.workers.dev/delivery-transition', { orderId: 'order-1', action: 'confirm_delivered' }],
    ['https://tabbakheen-api.tabbakheen.workers.dev/delivery-transition', { orderId: 'order-2', action: 'complete_self_pickup' }],
    ['https://tabbakheen-api.tabbakheen.workers.dev/orders/payment-proof', { orderId: 'order-1', proofImageUrl: 'https://proof.example/image.jpg', proofNote: 'Paid', paymentReference: 'ref-1' }],
    ['https://tabbakheen-api.tabbakheen.workers.dev/orders/payment-confirm', { orderId: 'order-1' }],
    ['https://tabbakheen-api.tabbakheen.workers.dev/orders/payment-reject', { orderId: 'order-1', reason: 'Unreadable' }],
    ['https://tabbakheen-api.tabbakheen.workers.dev/ratings/submit', { orderId: 'order-1', type: 'provider', stars: 5, comment: 'Excellent' }],
  ]);
});

test('map eligibility requires explicit public consent and never falls back to private coordinates', () => {
  const legacyProvider = {
    publicLocationEnabled: false,
    publicLocation: null,
    location: { lat: 24.7136, lng: 46.6753 },
  };
  const ambiguousLegacyDiscovery = {
    publicLocationEnabled: undefined,
    discoveryLocation: { lat: 24.7136, lng: 46.6753 },
  };
  const optedInProvider = {
    publicLocationEnabled: true,
    publicLocation: { lat: 24.8, lng: 46.7, city: 'Riyadh' },
  };
  expect(hasEnabledPublicLocation(legacyProvider)).toBe(false);
  expect(hasEnabledPublicLocation(ambiguousLegacyDiscovery)).toBe(false);
  expect(hasEnabledPublicLocation(optedInProvider)).toBe(true);
  expect(isValidPublicLocation({ lat: 24.8, lng: 46.7, city: '' })).toBe(false);
  expect(isValidPublicLocation({ lat: 50, lng: 46.7, city: 'Riyadh' })).toBe(false);
});

test('Home and map distance require both a real customer location and an opted-in provider location', () => {
  const optedInProvider = {
    publicLocationEnabled: true,
    publicLocation: { lat: 24.8, lng: 46.7, city: 'Riyadh' },
  };
  const noPublicLocationProvider = { publicLocationEnabled: false, publicLocation: null };
  expect(distanceToPublicProvider({ lat: 24.7, lng: 46.6 }, optedInProvider)).not.toBeNull();
  expect(distanceToPublicProvider(null, optedInProvider)).toBeNull();
  expect(distanceToPublicProvider({ lat: 24.7, lng: 46.6 }, noPublicLocationProvider)).toBeNull();
});

test('order pickup navigation uses only the authorized order pickup snapshot', () => {
  expect(getOrderPickupNavigationTarget({
    providerLat: 24.8,
    providerLng: 46.7,
    pickupAddress: 'Authorized pickup point',
  })).toEqual({
    kind: 'coordinates',
    lat: 24.8,
    lng: 46.7,
    address: 'Authorized pickup point',
  });
  expect(getOrderPickupNavigationTarget({ pickupAddress: 'Authorized pickup point' })).toEqual({
    kind: 'address',
    address: 'Authorized pickup point',
  });
  expect(getOrderPickupNavigationTarget(null)).toBeNull();
});

test('public-location preference has an authenticated allowlisted Worker outbound', async () => {
  const fetchMock = mock(async () => ({ ok: true, json: async () => ({ success: true, publicLocationEnabled: true }) }));
  globalThis.fetch = fetchMock;

  await setPublicLocationPreference(true, { lat: 24.8, lng: 46.7, city: 'Riyadh' });
  await setPublicLocationPreference(false);

  expect(fetchMock.mock.calls).toEqual([
    [
      'https://tabbakheen-api.tabbakheen.workers.dev/profile/public-discovery',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-id-token' },
        body: JSON.stringify({ publicLocationEnabled: true, publicLocation: { lat: 24.8, lng: 46.7, city: 'Riyadh' } }),
      },
    ],
    [
      'https://tabbakheen-api.tabbakheen.workers.dev/profile/public-discovery',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-id-token' },
        body: JSON.stringify({ publicLocationEnabled: false }),
      },
    ],
  ]);
});

test('order chat uses authenticated Worker-only bounded reads and allowlisted text/report payloads', async () => {
  const fetchMock = mock(async (url) => {
    if (url.includes('/orders/order-1/chat?')) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          writable: true,
          lastReadSequence: 0,
          unreadVisibleCount: 1,
          unreadMayExistOutsidePage: true,
          nextCursor: 'next-page',
          messages: [{
            messageId: 'message-1',
            orderId: 'order-1',
            senderUid: 'provider-1',
            senderRole: 'provider',
            text: 'وقت التحضير ساعتان',
            createdAt: '2026-01-01T00:00:00.000Z',
            sequence: 1,
            type: 'text',
            phone: 'must-not-reach-client',
          }],
        }),
      };
    }
    if (url.endsWith('/orders/chat/send')) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          message: {
            messageId: 'message-2',
            orderId: 'order-1',
            senderUid: 'customer-1',
            senderRole: 'customer',
            text: 'موافق',
            createdAt: '2026-01-01T00:01:00.000Z',
            sequence: 2,
            type: 'text',
          },
        }),
      };
    }
    if (url.endsWith('/orders/chat/read')) return { ok: true, json: async () => ({ success: true, lastReadSequence: 1 }) };
    return { ok: true, json: async () => ({ success: true }) };
  });
  globalThis.fetch = fetchMock;

  await expect(getOrderChat('order-1')).resolves.toEqual({
    writable: true,
    lastReadSequence: 0,
    unreadVisibleCount: 1,
    unreadMayExistOutsidePage: true,
    nextCursor: 'next-page',
    messages: [{
      messageId: 'message-1',
      orderId: 'order-1',
      senderUid: 'provider-1',
      senderRole: 'provider',
      text: 'وقت التحضير ساعتان',
      createdAt: '2026-01-01T00:00:00.000Z',
      sequence: 1,
      type: 'text',
    }],
  });
  await expect(sendOrderChatMessage('order-1', 'message-2', 'موافق')).resolves.toMatchObject({ messageId: 'message-2', text: 'موافق' });
  await markOrderChatRead('order-1', 'message-1', 1);
  await reportOrderChat('order-1', 'message-1', 'إساءة');

  expect(fetchMock.mock.calls).toEqual([
    ['https://tabbakheen-api.tabbakheen.workers.dev/orders/order-1/chat?limit=30', { headers: { Authorization: 'Bearer test-id-token' } }],
    ['https://tabbakheen-api.tabbakheen.workers.dev/orders/chat/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-id-token' },
      body: JSON.stringify({ orderId: 'order-1', requestId: 'message-2', text: 'موافق' }),
    }],
    ['https://tabbakheen-api.tabbakheen.workers.dev/orders/chat/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-id-token' },
      body: JSON.stringify({ orderId: 'order-1', lastVisibleMessageId: 'message-1', contiguousFromSequence: 1 }),
    }],
    ['https://tabbakheen-api.tabbakheen.workers.dev/orders/chat/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-id-token' },
      body: JSON.stringify({ orderId: 'order-1', messageId: 'message-1', note: 'إساءة' }),
    }],
  ]);
});

test('order chat polling and older-page merge is deduplicated, chronological, and non-lossy', () => {
  const message = (messageId, createdAt) => ({
    messageId,
    orderId: 'order-1',
    senderUid: 'provider-1',
    senderRole: 'provider',
    text: messageId,
    createdAt,
    type: 'text',
  });
  const firstPoll = [message('m3', '2026-01-01T00:03:00.000Z'), message('m2', '2026-01-01T00:02:00.000Z')];
  const olderPage = [message('m2', '2026-01-01T00:02:00.000Z'), message('m1', '2026-01-01T00:01:00.000Z')];
  const laterPoll = [message('m4', '2026-01-01T00:04:00.000Z'), message('m3', '2026-01-01T00:03:00.000Z')];

  // Simulates the worst completion order: user pages back while polling is
  // in flight, then the poll returns. Every loaded message remains visible.
  let visible = mergeOrderChatMessages([], firstPoll);
  visible = mergeOrderChatMessages(visible, olderPage);
  visible = mergeOrderChatMessages(visible, laterPoll);
  expect(visible.map((item) => item.messageId)).toEqual(['m1', 'm2', 'm3', 'm4']);
});

test('chat pagination cursor and ambiguous-send retry preserve server history and exact intent', () => {
  const initialized = preserveOlderChatCursor(null, 'order-1', null, 'older-page-1');
  const afterPaging = preserveOlderChatCursor(initialized.initializedOrderId, 'order-1', 'older-page-2', 'newest-page-cursor');
  expect(afterPaging).toEqual({ initializedOrderId: 'order-1', cursor: 'older-page-2' });

  const first = pendingOrderChatSend(null, 'request-1', 'رسالة 😀');
  // A changed draft/new random candidate after an ambiguous network error
  // cannot alter the durable request ID or original text.
  expect(pendingOrderChatSend(first, 'request-2', 'نص مختلف')).toEqual(first);
  expect(Array.from(first.text).length).toBe(7);
});