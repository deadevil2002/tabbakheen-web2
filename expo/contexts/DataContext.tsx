import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import {
  Offer,
  Order,
  AvailableDelivery,
  ProviderRating,
  DriverRating,
  User,
  PaymentMethod,
  PaymentStatus,
  OrderStatus,
  Subscription,
  AppSettings,
  DeliveryMethod,
  DeliveryStatus,
  ProviderPaymentMethods,
} from '@/types';
import {
  MOCK_OFFERS,
  MOCK_ORDERS,
  MOCK_RATINGS,
  MOCK_DRIVER_RATINGS,
  MOCK_PROVIDERS,
  MOCK_DRIVERS,
  MOCK_SUBSCRIPTIONS,
  MOCK_APP_SETTINGS,
} from '@/mocks/data';
import { generateId, generateOrderNumber, generateOrderRef, calculateDeliveryFee } from '@/utils/helpers';
import { hasEnabledPublicLocation } from '@/utils/publicLocation';
import { isFirebaseConfigured } from '@/services/firebase';
import {
  sendPushNotification,
  getDeliveryQuote,
  finalizeDeliveryMethod as workerFinalizeDelivery,
  acceptDeliveryViaWorker,
  createOrderViaWorker,
  transitionProviderOrderViaWorker,
  updateDeliveryProgressViaWorker,
  confirmDeliveredViaWorker,
  completeSelfPickupViaWorker,
  submitPaymentProofViaWorker,
  decidePaymentViaWorker,
  submitRatingViaWorker,
  updateDriverAvailabilityViaWorker,
  deleteOfferViaWorker,
  createDeliveryComplaintViaWorker,
  getMyComplaintsViaWorker,
  type ComplaintRef as WorkerComplaintRef,
} from '@/services/pushApi';
import { useAuth } from '@/contexts/AuthContext';
import { fsSubscribeByRole, fsUpdateUser } from '@/services/firestoreUsers';
import { fsSubscribeOffers, fsCreateOffer, fsUpdateOffer } from '@/services/firestoreOffers';
import {
  fsSubscribeOrders,
  fsSubscribeAvailableDeliveries,
  fsSubscribeAppSettings,
} from '@/services/firestoreOrders';

const OFFERS_KEY = 'tabbakheen_offers';
const ORDERS_KEY = 'tabbakheen_orders';
const RATINGS_KEY = 'tabbakheen_ratings';
const DRIVER_RATINGS_KEY = 'tabbakheen_driver_ratings';
const USERS_KEY = 'tabbakheen_users';
const SUBSCRIPTIONS_KEY = 'tabbakheen_subscriptions';
const APP_SETTINGS_KEY = 'tabbakheen_app_settings';

const SUSPENDED_ACCOUNT_MESSAGE =
  'تم إيقاف حسابك مؤقتًا. يمكنك تقديم اعتراض من خلال رابط الاعتراض المرسل لك.';

type ComplaintRef = Pick<WorkerComplaintRef, 'orderId' | 'source' | 'complaintStatus'>;

const isComplaintActive = (complaintStatus?: string): boolean =>
  complaintStatus !== 'resolved' && complaintStatus !== 'closed';

export const [DataProvider, useData] = createContextHook(() => {
  const { user: authUser } = useAuth();
  const fb = isFirebaseConfigured();

  const [offers, setOffers] = useState<Offer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [myComplaints, setMyComplaints] = useState<ComplaintRef[]>([]);
  const [ratings, setRatings] = useState<ProviderRating[]>([]);
  const [driverRatings, setDriverRatings] = useState<DriverRating[]>([]);
  const [providers, setProviders] = useState<User[]>([]);
  const [drivers, setDrivers] = useState<User[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>(MOCK_APP_SETTINGS);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const driverAssigned = useRef<Order[]>([]);
  const [availableDeliveries, setAvailableDeliveries] = useState<AvailableDelivery[]>([]);

  const setDriverAssignedOrders = useCallback((assigned: Order[]) => {
    driverAssigned.current = assigned;
    setOrders(
      [...assigned].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    );
  }, []);

  // ======= MOCK DATA HELPERS =======

  const saveOffers = async (updated: Offer[]) => {
    setOffers(updated);
    await AsyncStorage.setItem(OFFERS_KEY, JSON.stringify(updated));
  };

  const saveOrders = async (updated: Order[]) => {
    setOrders(updated);
    await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(updated));
  };

  const saveRatings = async (updated: ProviderRating[]) => {
    setRatings(updated);
    await AsyncStorage.setItem(RATINGS_KEY, JSON.stringify(updated));
  };

  const saveDriverRatings = async (updated: DriverRating[]) => {
    setDriverRatings(updated);
    await AsyncStorage.setItem(DRIVER_RATINGS_KEY, JSON.stringify(updated));
  };

  const saveSubscriptions = async (updated: Subscription[]) => {
    setSubscriptions(updated);
    await AsyncStorage.setItem(SUBSCRIPTIONS_KEY, JSON.stringify(updated));
  };

  const loadMockData = async () => {
    try {
      const [offersData, ordersData, ratingsData, driverRatingsData, usersData, subsData, settingsData] =
        await Promise.all([
          AsyncStorage.getItem(OFFERS_KEY),
          AsyncStorage.getItem(ORDERS_KEY),
          AsyncStorage.getItem(RATINGS_KEY),
          AsyncStorage.getItem(DRIVER_RATINGS_KEY),
          AsyncStorage.getItem(USERS_KEY),
          AsyncStorage.getItem(SUBSCRIPTIONS_KEY),
          AsyncStorage.getItem(APP_SETTINGS_KEY),
        ]);

      const loadedOffers = offersData ? JSON.parse(offersData) : MOCK_OFFERS;
      const loadedOrders = ordersData ? JSON.parse(ordersData) : MOCK_ORDERS;
      const loadedRatings = ratingsData ? JSON.parse(ratingsData) : MOCK_RATINGS;
      const loadedDriverRatings = driverRatingsData ? JSON.parse(driverRatingsData) : MOCK_DRIVER_RATINGS;
      const loadedUsers: User[] = usersData ? JSON.parse(usersData) : [...MOCK_PROVIDERS, ...MOCK_DRIVERS];
      const loadedSubs = subsData ? JSON.parse(subsData) : MOCK_SUBSCRIPTIONS;
      const loadedSettings = settingsData ? JSON.parse(settingsData) : MOCK_APP_SETTINGS;

      if (!offersData) await AsyncStorage.setItem(OFFERS_KEY, JSON.stringify(MOCK_OFFERS));
      if (!ordersData) await AsyncStorage.setItem(ORDERS_KEY, JSON.stringify(MOCK_ORDERS));
      if (!ratingsData) await AsyncStorage.setItem(RATINGS_KEY, JSON.stringify(MOCK_RATINGS));
      if (!driverRatingsData) await AsyncStorage.setItem(DRIVER_RATINGS_KEY, JSON.stringify(MOCK_DRIVER_RATINGS));
      if (!subsData) await AsyncStorage.setItem(SUBSCRIPTIONS_KEY, JSON.stringify(MOCK_SUBSCRIPTIONS));
      if (!settingsData) await AsyncStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(MOCK_APP_SETTINGS));

      setOffers(loadedOffers);
      setOrders(loadedOrders);
      setRatings(loadedRatings);
      setDriverRatings(loadedDriverRatings);
      setProviders(loadedUsers.filter((u: User) => u.role === 'provider'));
      setDrivers(loadedUsers.filter((u: User) => u.role === 'driver'));
      setSubscriptions(loadedSubs);
      setAppSettings(loadedSettings);
    } catch (e) {
      console.log('[DataContext] Error loading mock data:', e);
      setOffers(MOCK_OFFERS);
      setOrders(MOCK_ORDERS);
      setRatings(MOCK_RATINGS);
      setDriverRatings(MOCK_DRIVER_RATINGS);
      setProviders(MOCK_PROVIDERS);
      setDrivers(MOCK_DRIVERS);
      setSubscriptions(MOCK_SUBSCRIPTIONS);
      setAppSettings(MOCK_APP_SETTINGS);
    } finally {
      setIsLoading(false);
    }
  };

  // ======= FIRESTORE: Public subscriptions (offers, providers, drivers, settings) =======

  useEffect(() => {
    if (!fb) {
      void loadMockData();
      return;
    }

    console.log('[DataContext] Setting up Firestore public subscriptions');
    let initialLoaded = false;
    const unsubs: (() => void)[] = [];

    unsubs.push(
      fsSubscribeOffers((data) => {
        setOffers(data);
        if (!initialLoaded) {
          initialLoaded = true;
          setIsLoading(false);
        }
      }),
    );

    unsubs.push(fsSubscribeByRole('provider', (data) => {
      console.log('[DataContext] Providers loaded:', data.length);
      setProviders(data);
    }));

    unsubs.push(fsSubscribeByRole('driver', (data) => {
      console.log('[DataContext] Drivers loaded:', data.length);
      setDrivers(data);
    }));

    unsubs.push(
      fsSubscribeAppSettings((data) => {
        if (data) {
          console.log('[DataContext] App settings loaded from Firestore');
          setAppSettings(data);
        }
      }),
    );

    Promise.all([
      AsyncStorage.getItem(RATINGS_KEY),
      AsyncStorage.getItem(DRIVER_RATINGS_KEY),
      AsyncStorage.getItem(SUBSCRIPTIONS_KEY),
    ])
      .then(([r, dr, s]) => {
        if (r) setRatings(JSON.parse(r));
        if (dr) setDriverRatings(JSON.parse(dr));
        if (s) setSubscriptions(JSON.parse(s));
      })
      .catch(() => {});

    const timeout = setTimeout(() => {
      if (!initialLoaded) {
        console.log('[DataContext] Timeout: setting isLoading=false');
        setIsLoading(false);
      }
    }, 5000);

    return () => {
      unsubs.forEach((fn) => fn());
      clearTimeout(timeout);
    };
  }, [fb]);

  // ======= FIRESTORE: User-dependent subscriptions (orders) =======

  useEffect(() => {
    if (!fb) return;

    if (!authUser) {
      setOrders([]);
      setMyComplaints([]);
      return;
    }

    console.log('[DataContext] Setting up order subscriptions for', authUser.role, authUser.uid);
    const unsubs: (() => void)[] = [];

    // Complaints are private Worker DTOs. Do not query participant UID fields
    // directly: that legacy pattern can expose another participant's report.
    let complaintsActive = true;
    const refreshMyComplaints = async () => {
      try {
        const complaints = await getMyComplaintsViaWorker();
        if (complaintsActive) setMyComplaints(complaints);
      } catch {
        if (complaintsActive) setMyComplaints([]);
      }
    };
    void refreshMyComplaints();
    const complaintPoll = setInterval(() => { void refreshMyComplaints(); }, 30_000);
    unsubs.push(() => {
      complaintsActive = false;
      clearInterval(complaintPoll);
    });

    if (authUser.role === 'driver') {
      unsubs.push(
        fsSubscribeOrders('driverUid', authUser.uid, (data) => {
          setDriverAssignedOrders(data);
        }),
      );
      unsubs.push(
        fsSubscribeAvailableDeliveries((data) => {
          setAvailableDeliveries(data);
        }),
      );
    } else {
      const field = authUser.role === 'customer' ? 'customerUid' : 'providerUid';
      unsubs.push(fsSubscribeOrders(field, authUser.uid, setOrders));
    }

    return () => {
      unsubs.forEach((fn) => fn());
      driverAssigned.current = [];
      setAvailableDeliveries([]);
      setMyComplaints([]);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fb, authUser?.uid, authUser?.role, setDriverAssignedOrders]);

  // ======= CRUD: Offers =======

  const createOffer = useCallback(
    async (offer: Omit<Offer, 'id' | 'createdAt'>) => {
      if (authUser?.accountStatus === 'suspended') {
        throw new Error(SUSPENDED_ACCOUNT_MESSAGE);
      }
      if (authUser?.role === 'provider' && !hasEnabledPublicLocation(authUser)) {
        throw new Error('PUBLIC_LOCATION_REQUIRED');
      }
      if (fb) {
        const id = await fsCreateOffer(offer);
        const newOffer: Offer = { ...offer, id, createdAt: new Date().toISOString() };
        console.log('[DataContext] Offer created via Firestore:', id);
        return newOffer;
      }
      const newOffer: Offer = { ...offer, id: generateId(), createdAt: new Date().toISOString() };
      await saveOffers([newOffer, ...offers]);
      return newOffer;
    },
    [offers, fb, authUser],
  );

  const updateOffer = useCallback(
    async (id: string, updates: Partial<Offer>) => {
      if (fb) {
        await fsUpdateOffer(id, updates);
        return;
      }
      const updated = offers.map((o) => (o.id === id ? { ...o, ...updates } : o));
      await saveOffers(updated);
    },
    [offers, fb],
  );

  const deleteOffer = useCallback(
    async (id: string) => {
      if (fb) {
        await deleteOfferViaWorker(id);
        return;
      }
      const updated = offers.filter((o) => o.id !== id);
      await saveOffers(updated);
    },
    [offers, fb],
  );

  // ======= CRUD: Orders =======

  const createOrder = useCallback(
    async (order: {
      customerUid: string;
      providerUid: string;
      offerId: string;
      offerTitleSnapshot: string;
      priceSnapshot: number;
      note: string;
      paymentMethod: PaymentMethod;
    }) => {
      if (fb) {
        const newOrder = await createOrderViaWorker({
          requestId: generateId(),
          providerUid: order.providerUid,
          offerId: order.offerId,
          note: order.note,
          paymentMethod: order.paymentMethod,
        });
        console.log('[DataContext] Order created via Worker:', newOrder.id, 'Number:', newOrder.orderNumber);
        return newOrder;
      }

      const now = new Date().toISOString();
      const provider = providers.find((p) => p.uid === order.providerUid);
      const publicProviderLocation = provider && hasEnabledPublicLocation(provider)
        ? provider.publicLocation
        : null;
      const base: Omit<Order, 'id'> = {
        orderNumber: generateOrderNumber(),
        customerUid: order.customerUid,
        providerUid: order.providerUid,
        driverUid: null,
        offerId: order.offerId,
        offerTitleSnapshot: order.offerTitleSnapshot,
        priceSnapshot: order.priceSnapshot,
        deliveryFee: 0,
        totalAmount: order.priceSnapshot,
        deliveryMethod: null,
        paymentMethod: order.paymentMethod,
        deliveryPaymentMethod: null,
        paymentStatus: 'unpaid',
        status: 'pending',
        providerComment: '',
        statusReason: '',
        driverStatus: '',
        deliveryStatus: null,
        orderRef: generateOrderRef(),
        transactionId: '',
        paidAt: null,
        ratingSubmitted: false,
        driverRatingSubmitted: false,
        providerHasRating: false,
        driverHasRating: false,
        note: order.note,
        deliveryNotes: '',
        stcPayProofImageUrl: '',
        stcPayProofNote: '',
        paymentReference: '',
        providerLat: publicProviderLocation?.lat ?? null,
        providerLng: publicProviderLocation?.lng ?? null,
        customerLat: authUser?.location?.lat ?? null,
        customerLng: authUser?.location?.lng ?? null,
        pickupAddress: publicProviderLocation?.city ?? '',
        dropoffAddress: authUser?.address ?? '',
        deliveryDistanceKm: 0,
        deliveryQuoteId: '',
        deliveryPricingVersion: '',
        createdAt: now,
        updatedAt: now,
      };

      const usersData = await AsyncStorage.getItem(USERS_KEY);
      const allUsers: User[] = usersData ? JSON.parse(usersData) : [];
      const customer = allUsers.find((u) => u.uid === order.customerUid);

      const newOrder: Order = {
        ...base,
        id: generateId(),
        customerLat: customer?.location?.lat ?? null,
        customerLng: customer?.location?.lng ?? null,
        dropoffAddress: customer?.address ?? '',
      };
      const updated = [newOrder, ...orders];
      await saveOrders(updated);
      console.log('[DataContext] Order created:', newOrder.id, 'Number:', newOrder.orderNumber);
      return newOrder;
    },
    [orders, providers, authUser, fb],
  );

  const updateDeliveryStatusAsDriver = useCallback(
    async (orderId: string, newStatus: DeliveryStatus) => {
      if (fb) {
        const action = {
          driver_rejected: 'reject',
          picked_up: 'picked_up',
          arrived: 'arrived',
          delivered_pending_confirmation: 'delivered_pending_confirmation',
        } as const;
        const selectedAction = action[newStatus as keyof typeof action];
        if (!selectedAction) throw new Error('Unsupported driver delivery transition');
        await updateDeliveryProgressViaWorker(orderId, selectedAction);
        console.log('[DataContext] Delivery status updated via Worker:', orderId, '->', newStatus);
        if (newStatus === 'picked_up') {
          void sendPushNotification('picked_up', orderId);
        } else if (newStatus === 'arrived') {
          void sendPushNotification('arrived', orderId);
        } else if (newStatus === 'delivered') {
          void sendPushNotification('delivered', orderId);
        }
        return;
      }

      const now = new Date().toISOString();
      const updated = orders.map((o) => {
        if (o.id !== orderId) return o;
        return { ...o, deliveryStatus: newStatus, updatedAt: now };
      });
      await saveOrders(updated);
      console.log('[DataContext] Delivery status updated:', orderId, '->', newStatus);
    },
    [orders, fb],
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, status: OrderStatus, comment?: string, reason?: string) => {
      if ((status === 'accepted' || status === 'preparing') && authUser?.accountStatus === 'suspended') {
        throw new Error(SUSPENDED_ACCOUNT_MESSAGE);
      }
      const now = new Date().toISOString();

      if (fb) {
        const order = orders.find((item) => item.id === orderId);
        const action = {
          accepted: 'provider_accept',
          rejected: 'provider_reject',
          preparing: 'provider_preparing',
          ready_for_pickup: 'provider_ready',
        } as const;
        const selectedAction = action[status as keyof typeof action];
        if (!selectedAction) throw new Error('Unsupported provider order transition');
        await transitionProviderOrderViaWorker(orderId, selectedAction, reason ?? comment);
        console.log('[DataContext] Order status updated via Worker:', orderId, '->', status);
        if (status === 'accepted') {
          void sendPushNotification('order_accepted', orderId);
        } else if (status === 'delivered' && order?.deliveryMethod === 'self_pickup') {
          void sendPushNotification('self_pickup_completed', orderId);
        }
        return;
      }

      const updated = orders.map((o) => {
        if (o.id !== orderId) return o;
        const updates: Partial<Order> = { status, updatedAt: now };
        if (comment) updates.providerComment = comment;
        if (reason) updates.statusReason = reason;
        if (status === 'delivered' && o.paymentMethod === 'cod') {
          updates.paymentStatus = 'paid';
          updates.paidAt = now;
        }
        if (status === 'cancelled') {
          if (o.paymentStatus === 'paid') {
            updates.paymentStatus = 'refunded';
          }
        }
        return { ...o, ...updates };
      });
      await saveOrders(updated);
      console.log('[DataContext] Order status updated:', orderId, '->', status);
    },
    [orders, fb, authUser],
  );

  const submitPaymentProof = useCallback(
    async (orderId: string, proofImageUrl: string, proofNote: string, paymentReference?: string) => {
      if (fb) {
        await submitPaymentProofViaWorker(orderId, proofImageUrl, proofNote, paymentReference ?? '');
        console.log('[DataContext] Payment proof submitted via Worker:', orderId);
        return;
      }

      const now = new Date().toISOString();
      const updated = orders.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          stcPayProofImageUrl: proofImageUrl,
          stcPayProofNote: proofNote,
          paymentReference: paymentReference ?? o.paymentReference,
          paymentStatus: 'proof_sent' as PaymentStatus,
          updatedAt: now,
        };
      });
      await saveOrders(updated);
      console.log('[DataContext] Payment proof submitted:', orderId);
    },
    [orders, fb],
  );

  const confirmPayment = useCallback(
    async (orderId: string) => {
      if (fb) {
        await decidePaymentViaWorker(orderId, 'confirm');
        console.log('[DataContext] Payment confirmed via Worker:', orderId);
        return;
      }

      const now = new Date().toISOString();
      const updated = orders.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          paymentStatus: 'paid_confirmed' as PaymentStatus,
          paidAt: now,
          updatedAt: now,
        };
      });
      await saveOrders(updated);
      console.log('[DataContext] Payment confirmed:', orderId);
    },
    [orders, fb],
  );

  const rejectPayment = useCallback(
    async (orderId: string) => {
      if (fb) {
        await decidePaymentViaWorker(orderId, 'reject');
        console.log('[DataContext] Payment rejected via Worker:', orderId);
        return;
      }

      const now = new Date().toISOString();
      const updated = orders.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          paymentStatus: 'payment_rejected' as PaymentStatus,
          updatedAt: now,
        };
      });
      await saveOrders(updated);
      console.log('[DataContext] Payment rejected:', orderId);
    },
    [orders, fb],
  );

  const setDeliveryMethod = useCallback(
    async (orderId: string, method: DeliveryMethod, deliveryNotes?: string) => {
      if (fb) {
        const isPickup = method === 'self_pickup';
        const expectedStatus = isPickup ? 'self_pickup_selected' : 'ready_for_driver';
        console.log(
          '[setDeliveryMethod] START orderId=' + orderId + ' method=' + method +
            ' (isPickup=' + isPickup + ')',
        );

        const result = await workerFinalizeDelivery(orderId, isPickup ? 'self_pickup' : 'driver');
        console.log('[setDeliveryMethod] Worker finalized delivery selection:', orderId, expectedStatus);
        return result;
      }

      const now = new Date().toISOString();
      const updated = orders.map((o) => {
        if (o.id !== orderId) return o;
        const updates: Partial<Order> = { deliveryMethod: method, updatedAt: now };
        if (deliveryNotes) updates.deliveryNotes = deliveryNotes;
        if (method === 'self_pickup') {
          updates.deliveryFee = 0;
          updates.totalAmount = o.priceSnapshot;
          updates.deliveryPaymentMethod = null;
          updates.driverUid = null;
          updates.deliveryStatus = 'self_pickup_selected' as DeliveryStatus;
        } else if (method === 'driver') {
          updates.deliveryStatus = 'ready_for_driver' as DeliveryStatus;
          updates.driverUid = null;
        }
        return { ...o, ...updates };
      });
      await saveOrders(updated);
      console.log('[DataContext] Delivery method set:', orderId, '->', method);
      return undefined;
    },
    [orders, fb],
  );

  const driverAcceptDelivery = useCallback(
    async (orderId: string, driverUid: string) => {
      if (authUser?.accountStatus === 'suspended') {
        throw new Error(SUSPENDED_ACCOUNT_MESSAGE);
      }
      if (fb) {
        await acceptDeliveryViaWorker(orderId);
        console.log('[DataContext] Driver self-accepted delivery via Worker:', driverUid, 'order:', orderId);
        void sendPushNotification('driver_assigned', orderId);
        return;
      }

      const now = new Date().toISOString();
      const updated = orders.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          driverUid,
          deliveryStatus: 'driver_assigned' as DeliveryStatus,
          updatedAt: now,
        };
      });
      await saveOrders(updated);
      console.log('[DataContext] Driver self-accepted delivery:', driverUid, 'order:', orderId);
    },
    [orders, fb, authUser],
  );

  const updateDriverStatus = useCallback(
    async (orderId: string, driverStatus: string, orderStatus: OrderStatus) => {
      const now = new Date().toISOString();

      if (fb) {
        const action = {
          driver_rejected: 'reject',
          picked_up: 'picked_up',
          arrived: 'arrived',
          delivered: 'delivered_pending_confirmation',
          delivered_pending_confirmation: 'delivered_pending_confirmation',
        } as const;
        const selectedAction = action[driverStatus as keyof typeof action];
        if (!selectedAction) throw new Error('Unsupported driver delivery transition');
        await updateDeliveryProgressViaWorker(orderId, selectedAction);
        console.log('[DataContext] Driver progress updated via Worker:', orderId, '->', driverStatus);
        return;
      }

      const updated = orders.map((o) => {
        if (o.id !== orderId) return o;
        const updates: Partial<Order> = { driverStatus, status: orderStatus, updatedAt: now };
        if (orderStatus === 'delivered' && o.paymentMethod === 'cod') {
          updates.paymentStatus = 'paid';
          updates.paidAt = now;
        }
        return { ...o, ...updates };
      });
      await saveOrders(updated);
      console.log('[DataContext] Driver status updated:', orderId, '->', driverStatus);
    },
    [orders, fb],
  );

  const markOrderDelivered = useCallback(
    async (orderId: string) => {
      const now = new Date().toISOString();

      const existing = orders.find((o) => o.id === orderId);
      // A self-pickup order (no assigned driver) is completed by the owning
      // provider at handover — there is no driver/customer confirmation step.
      // Driver deliveries remain customer-finalized only.
      const isOwnerProviderSelfPickup =
        !!existing && !!authUser && existing.providerUid === authUser.uid && !existing.driverUid;
      // Only the order's customer may finalize the order (defense-in-depth,
      // independent of UI gating) — except the self-pickup case above.
      if (existing && authUser && authUser.uid !== existing.customerUid && !isOwnerProviderSelfPickup) {
        console.log('[DataContext] markOrderDelivered BLOCKED: only the customer can finalize the order:', orderId, authUser.role);
        throw new Error('Only the customer can confirm receipt of the order');
      }
      if (existing?.driverUid && existing.deliveryStatus !== 'delivered_pending_confirmation' && existing.deliveryStatus !== 'arrived') {
        console.log('[DataContext] markOrderDelivered BLOCKED: driver-delivery order not awaiting customer confirmation:', orderId, existing.deliveryStatus);
        throw new Error('Cannot finalize a driver delivery before customer confirmation');
      }

      if (fb) {
        if (isOwnerProviderSelfPickup) {
          await completeSelfPickupViaWorker(orderId);
        } else {
          await confirmDeliveredViaWorker(orderId);
        }
        console.log('[DataContext] Order confirmed delivered by Worker:', orderId);
        void sendPushNotification('delivered', orderId);
        return;
      }

      const updated = orders.map((o) => {
        if (o.id !== orderId) return o;
        const updates: Partial<Order> = {
          status: 'delivered' as OrderStatus,
          deliveryStatus: 'delivered' as DeliveryStatus,
          updatedAt: now,
        };
        if (o.paymentMethod === 'cod') {
          updates.paymentStatus = 'paid';
          updates.paidAt = now;
        }
        return { ...o, ...updates };
      });
      await saveOrders(updated);
      console.log('[DataContext] Order marked delivered:', orderId);
    },
    [orders, fb],
  );

  const raiseDeliveryComplaint = useCallback(
    async (
      order: Order,
      opts?: { source?: 'customer' | 'driver' | 'provider'; note?: string; type?: string; target?: 'provider' | 'driver' | 'customer' },
    ) => {
      const source = opts?.source ?? 'driver';
      const type =
        opts?.type ??
        (source === 'customer' ? 'customer_rejected_receipt' : 'delivery_not_confirmed');
      const payload = {
        orderId: order.id,
        orderNumber: order.orderNumber ?? '',
        orderRef: order.orderRef ?? '',
        customerUid: order.customerUid,
        providerUid: order.providerUid,
        driverUid: order.driverUid ?? '',
        status: order.status,
        deliveryStatus: order.deliveryStatus ?? '',
        type,
        note: opts?.note ?? '',
        source,
        target: opts?.target ?? '',
      };
      const alreadyActive = myComplaints.some(
        (c) => c.orderId === order.id && isComplaintActive(c.complaintStatus),
      );
      if (alreadyActive) {
        console.log('[DataContext] Active complaint already exists; skipped');
        return;
      }
      if (fb) {
        const complaintType = type as 'customer_rejected_receipt' | 'delivery_not_confirmed' | 'customer_complaint' | 'provider_complaint';
        if (!['customer_rejected_receipt', 'delivery_not_confirmed', 'customer_complaint', 'provider_complaint'].includes(complaintType)) {
          throw new Error('Unsupported complaint type');
        }
        await createDeliveryComplaintViaWorker(
          order.id,
          complaintType,
          opts?.note ?? '',
          opts?.target,
        );
        setMyComplaints((prev) =>
          prev.some((c) => c.orderId === order.id && c.source === source)
            ? prev
            : [...prev, { orderId: order.id, source, complaintStatus: 'pending' }],
        );
        console.log('[DataContext] Delivery complaint created');
        return;
      }
      setMyComplaints((prev) =>
        prev.some((c) => c.orderId === order.id && c.source === source)
          ? prev
          : [...prev, { orderId: order.id, source, complaintStatus: 'pending' }],
      );
      console.log('[DataContext] Delivery complaint retained locally');
    },
    [fb, myComplaints],
  );

  const hasComplaint = useCallback(
    (orderId: string, source?: 'customer' | 'driver' | 'provider') =>
      myComplaints.some(
        (c) =>
          c.orderId === orderId &&
          isComplaintActive(c.complaintStatus) &&
          (!source || c.source === source),
      ),
    [myComplaints],
  );

  // ======= CRUD: Ratings =======

  const submitRating = useCallback(
    async (rating: Omit<ProviderRating, 'id' | 'createdAt'>) => {
      const newRating: ProviderRating = {
        ...rating,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };
      const updatedRatings = [newRating, ...ratings];
      await saveRatings(updatedRatings);

      if (fb) {
        try {
          await submitRatingViaWorker(rating.orderId, 'provider', rating.stars, rating.comment);
          console.log('[DataContext] Provider rating submitted through Worker');
        } catch (e) {
          console.log('[DataContext] Error submitting rating to Firestore:', e);
          throw e;
        }
        setOrders((prev) =>
          prev.map((o) => (o.id === rating.orderId ? { ...o, ratingSubmitted: true, providerHasRating: true } : o)),
        );
      } else {
        const updatedOrders = orders.map((o) =>
          o.id === rating.orderId ? { ...o, ratingSubmitted: true, providerHasRating: true } : o,
        );
        await saveOrders(updatedOrders);
      }

      const providerRatings = updatedRatings.filter((r) => r.providerUid === rating.providerUid);
      const avg = providerRatings.reduce((sum, r) => sum + r.stars, 0) / providerRatings.length;

      if (!fb) {
        const usersData = await AsyncStorage.getItem(USERS_KEY);
        if (usersData) {
          const users: User[] = JSON.parse(usersData);
          const updatedUsers = users.map((u) =>
            u.uid === rating.providerUid
              ? { ...u, ratingAverage: Math.round(avg * 10) / 10, ratingCount: providerRatings.length }
              : u,
          );
          await AsyncStorage.setItem(USERS_KEY, JSON.stringify(updatedUsers));
          setProviders(updatedUsers.filter((u) => u.role === 'provider'));
        }
      }

      return newRating;
    },
    [ratings, orders, fb],
  );

  const submitDriverRating = useCallback(
    async (rating: Omit<DriverRating, 'id' | 'createdAt'>) => {
      const newRating: DriverRating = {
        ...rating,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };
      const updatedRatings = [newRating, ...driverRatings];
      await saveDriverRatings(updatedRatings);

      if (fb) {
        try {
          await submitRatingViaWorker(rating.orderId, 'driver', rating.stars, rating.comment);
          console.log('[DataContext] Driver rating submitted through Worker');
        } catch (e) {
          console.log('[DataContext] Error submitting driver rating to Firestore:', e);
          throw e;
        }
        setOrders((prev) =>
          prev.map((o) => (o.id === rating.orderId ? { ...o, driverRatingSubmitted: true, driverHasRating: true } : o)),
        );
      } else {
        const updatedOrders = orders.map((o) =>
          o.id === rating.orderId ? { ...o, driverRatingSubmitted: true, driverHasRating: true } : o,
        );
        await saveOrders(updatedOrders);
      }

      const driverAllRatings = updatedRatings.filter((r) => r.driverUid === rating.driverUid);
      const avg = driverAllRatings.reduce((sum, r) => sum + r.stars, 0) / driverAllRatings.length;

      if (!fb) {
        const usersData = await AsyncStorage.getItem(USERS_KEY);
        if (usersData) {
          const users: User[] = JSON.parse(usersData);
          const updatedUsers = users.map((u) =>
            u.uid === rating.driverUid
              ? {
                  ...u,
                  ratingAverage: Math.round(avg * 10) / 10,
                  ratingCount: driverAllRatings.length,
                }
              : u,
          );
          await AsyncStorage.setItem(USERS_KEY, JSON.stringify(updatedUsers));
          setDrivers(updatedUsers.filter((u) => u.role === 'driver'));
        }
      }

      return newRating;
    },
    [driverRatings, orders, fb],
  );

  // ======= CRUD: User fields (provider payment methods, driver availability) =======

  const updateProviderPaymentMethods = useCallback(
    async (providerUid: string, paymentMethods: ProviderPaymentMethods) => {
      if (fb) {
        await fsUpdateUser(providerUid, { paymentMethods });
        console.log('[DataContext] Provider payment methods updated via Firestore:', providerUid);
        return;
      }
      const usersData = await AsyncStorage.getItem(USERS_KEY);
      if (usersData) {
        const users: User[] = JSON.parse(usersData);
        const updatedUsers = users.map((u) =>
          u.uid === providerUid ? { ...u, paymentMethods } : u,
        );
        await AsyncStorage.setItem(USERS_KEY, JSON.stringify(updatedUsers));
        setProviders(updatedUsers.filter((u) => u.role === 'provider'));
      }
      console.log('[DataContext] Provider payment methods updated:', providerUid);
    },
    [fb],
  );

  const updateDriverAvailability = useCallback(
    async (driverUid: string, isAvailable: boolean) => {
      if (fb) {
        if (authUser?.uid !== driverUid || authUser.role !== 'driver') {
          throw new Error('Only the signed-in driver can update availability');
        }
        await updateDriverAvailabilityViaWorker(isAvailable);
        setDrivers((current) =>
          current.map((driver) => (driver.uid === driverUid ? { ...driver, isAvailable } : driver)),
        );
        console.log('[DataContext] Driver availability updated via Worker:', driverUid, '->', isAvailable);
        return;
      }
      const usersData = await AsyncStorage.getItem(USERS_KEY);
      if (usersData) {
        const users: User[] = JSON.parse(usersData);
        const updatedUsers = users.map((u) =>
          u.uid === driverUid ? { ...u, isAvailable } : u,
        );
        await AsyncStorage.setItem(USERS_KEY, JSON.stringify(updatedUsers));
        setDrivers(updatedUsers.filter((u) => u.role === 'driver'));
      }
      console.log('[DataContext] Driver availability updated:', driverUid, '->', isAvailable);
    },
    [fb, authUser],
  );

  // ======= CRUD: Subscriptions (local only) =======

  const createSubscription = useCallback(
    async (providerUid: string) => {
      const now = new Date();
      const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const newSub: Subscription = {
        id: generateId(),
        providerUid,
        planId: 'tabbakheen_basic',
        status: 'trialing',
        trialEndsAt: trialEnd.toISOString(),
        currentPeriodStart: now.toISOString(),
        currentPeriodEnd: trialEnd.toISOString(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      const updated = [...subscriptions, newSub];
      await saveSubscriptions(updated);
      console.log('[DataContext] Subscription created for:', providerUid);
      return newSub;
    },
    [subscriptions],
  );

  // ======= GETTERS =======

  const getProviderById = useCallback(
    (uid: string): User | undefined => {
      return providers.find((p) => p.uid === uid);
    },
    [providers],
  );

  const getDriverById = useCallback(
    (uid: string): User | undefined => {
      return drivers.find((d) => d.uid === uid);
    },
    [drivers],
  );

  const getOffersByProvider = useCallback(
    (providerUid: string): Offer[] => {
      return offers.filter((o) => o.providerUid === providerUid);
    },
    [offers],
  );

  const getOrdersByCustomer = useCallback(
    (customerUid: string): Order[] => {
      return orders.filter((o) => o.customerUid === customerUid);
    },
    [orders],
  );

  const getOrdersByProvider = useCallback(
    (providerUid: string): Order[] => {
      return orders.filter((o) => o.providerUid === providerUid);
    },
    [orders],
  );

  const getOrdersByDriver = useCallback(
    (driverUid: string): Order[] => {
      return orders.filter((o) => o.driverUid === driverUid);
    },
    [orders],
  );

  const getAvailableDeliveries = useCallback((): AvailableDelivery[] => {
    // Firebase-backed discovery is the redacted Worker DTO. The mock path mirrors
    // its eligibility rule only, so development previews preserve the same UX.
    // deliveryStatus === ready_for_driver is set only for driver deliveries.
    if (fb) return availableDeliveries;
    return orders
      .filter((o) => o.deliveryStatus === 'ready_for_driver' && !o.driverUid)
      .map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        offerTitleSnapshot: o.offerTitleSnapshot,
        deliveryFee: o.deliveryFee,
        pickupAddress: o.pickupAddress,
        // Mock orders predate the operational pickupLocation contract. Do not
        // repurpose their private provider coordinates as a public delivery DTO.
        pickupLocation: null,
        deliveryDistanceKm: o.deliveryDistanceKm,
        createdAt: o.createdAt,
      }));
  }, [fb, availableDeliveries, orders]);

  const getAvailableDrivers = useCallback((): User[] => {
    return drivers.filter((d) => d.isAvailable === true);
  }, [drivers]);

  const getRatingsByProvider = useCallback(
    (providerUid: string): ProviderRating[] => {
      return ratings.filter((r) => r.providerUid === providerUid);
    },
    [ratings],
  );

  const getRatingsByDriver = useCallback(
    (driverUid: string): DriverRating[] => {
      return driverRatings.filter((r) => r.driverUid === driverUid);
    },
    [driverRatings],
  );

  const getSubscription = useCallback(
    (providerUid: string): Subscription | undefined => {
      return subscriptions.find((s) => s.providerUid === providerUid);
    },
    [subscriptions],
  );

  const isProviderSubscriptionValid = useCallback(
    (providerUid: string): boolean => {
      if (fb) {
        const provider = providers.find((p) => p.uid === providerUid);
        if (provider?.isOwner === true) {
          return true;
        }
        const sub = subscriptions.find((s) => s.providerUid === providerUid);
        if (!sub) {
          console.log('[DataContext] No subscription found for provider (Firebase mode), treating as active:', providerUid);
          return true;
        }
        if (sub.status === 'trialing') {
          return new Date(sub.trialEndsAt).getTime() > Date.now();
        }
        if (sub.status === 'active') {
          return new Date(sub.currentPeriodEnd).getTime() > Date.now();
        }
        return true;
      }

      const sub = subscriptions.find((s) => s.providerUid === providerUid);
      if (!sub) return false;
      if (sub.status === 'trialing') {
        return new Date(sub.trialEndsAt).getTime() > Date.now();
      }
      if (sub.status === 'active') {
        return new Date(sub.currentPeriodEnd).getTime() > Date.now();
      }
      return false;
    },
    [subscriptions, fb, providers],
  );

  const markOrderReady = useCallback(
    async (orderId: string) => {
      if (fb) {
        await transitionProviderOrderViaWorker(orderId, 'provider_ready');
        console.log('[DataContext] Order marked ready via Worker (customer will choose delivery):', orderId);
        void sendPushNotification('order_ready', orderId);
        return;
      }
      const now = new Date().toISOString();
      const updated = orders.map((o) => {
        if (o.id !== orderId) return o;
        return { ...o, status: 'ready_for_pickup' as OrderStatus, updatedAt: now };
      });
      await saveOrders(updated);
      console.log('[DataContext] Order marked ready:', orderId);
    },
    [orders, fb],
  );

  const computeDeliveryFee = useCallback(
    (providerUid: string, customerLat?: number, customerLng?: number): number => {
      const provider = providers.find((p) => p.uid === providerUid);
      if (!provider || !hasEnabledPublicLocation(provider) || !customerLat || !customerLng) {
        return appSettings.deliveryPricing?.baseFee ?? 5;
      }
      return calculateDeliveryFee(
        provider.publicLocation.lat,
        provider.publicLocation.lng,
        customerLat,
        customerLng,
        appSettings.deliveryPricing,
      );
    },
    [providers, appSettings],
  );

  const fetchDeliveryQuote = useCallback(
    async (orderId: string) => {
      if (fb) {
        console.log('[DataContext] Fetching delivery quote from Worker for order:', orderId);
        const quote = await getDeliveryQuote(orderId);
        console.log('[DataContext] Delivery quote:', JSON.stringify(quote));
        return quote;
      }
      const order = orders.find((o) => o.id === orderId);
      if (!order) return { deliveryFee: 0, totalAmount: 0, deliveryDistanceKm: 0, subtotal: 0 };
      const fee = computeDeliveryFee(order.providerUid, order.customerLat ?? undefined, order.customerLng ?? undefined);
      return {
        deliveryFee: fee,
        totalAmount: order.priceSnapshot + fee,
        deliveryDistanceKm: 0,
        subtotal: order.priceSnapshot,
      };
    },
    [orders, fb, computeDeliveryFee],
  );

  // ======= COMPUTED =======

  const activeProviders = useMemo(() => {
    return providers.filter((p) => isProviderSubscriptionValid(p.uid));
  }, [providers, isProviderSubscriptionValid]);

  const availableOffers = useMemo(() => {
    const validProviderUids = new Set(activeProviders.map((p) => p.uid));
    return offers.filter((o) => o.isAvailable && validProviderUids.has(o.providerUid));
  }, [offers, activeProviders]);

  return useMemo(() => ({
    offers,
    orders,
    ratings,
    driverRatings,
    providers,
    drivers,
    subscriptions,
    appSettings,
    activeProviders,
    availableOffers,
    isLoading,
    createOffer,
    updateOffer,
    deleteOffer,
    createOrder,
    updateOrderStatus,
    submitPaymentProof,
    confirmPayment,
    rejectPayment,
    setDeliveryMethod,
    updateDriverStatus,
    markOrderDelivered,
    raiseDeliveryComplaint,
    hasComplaint,
    submitRating,
    submitDriverRating,
    getProviderById,
    getDriverById,
    getOffersByProvider,
    getOrdersByCustomer,
    getOrdersByProvider,
    getOrdersByDriver,
    getAvailableDeliveries,
    getAvailableDrivers,
    getRatingsByProvider,
    getRatingsByDriver,
    getSubscription,
    isProviderSubscriptionValid,
    createSubscription,
    updateProviderPaymentMethods,
    updateDriverAvailability,
    updateDeliveryStatusAsDriver,
    driverAcceptDelivery,
    computeDeliveryFee,
    fetchDeliveryQuote,
    markOrderReady,
  }), [
    offers, orders, ratings, driverRatings, providers, drivers, subscriptions, appSettings,
    activeProviders, availableOffers, isLoading,
    createOffer, updateOffer, deleteOffer, createOrder, updateOrderStatus,
    submitPaymentProof, confirmPayment, rejectPayment, setDeliveryMethod,
    updateDriverStatus, markOrderDelivered, raiseDeliveryComplaint, hasComplaint, submitRating, submitDriverRating,
    getProviderById, getDriverById, getOffersByProvider, getOrdersByCustomer,
    getOrdersByProvider, getOrdersByDriver, getAvailableDeliveries, getAvailableDrivers,
    getRatingsByProvider, getRatingsByDriver, getSubscription, isProviderSubscriptionValid,
    createSubscription, updateProviderPaymentMethods, updateDriverAvailability,
    updateDeliveryStatusAsDriver, driverAcceptDelivery, computeDeliveryFee, fetchDeliveryQuote, markOrderReady,
  ]);
});
