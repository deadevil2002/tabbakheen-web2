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
} = await import('./pushApi');

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