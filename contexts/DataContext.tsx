import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import {
  Offer,
  Order,
  ProviderRating,
  DriverRating,
  User,
  PaymentMethod,
  PaymentStatus,
  OrderStatus,
  Subscription,
  AppSettings,
  DeliveryMethod,
  DeliveryPaymentMethod,
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
import { isFirebaseConfigured } from '@/services/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { fsSubscribeByRole, fsUpdateUser } from '@/services/firestoreUsers';
import { fsSubscribeOffers, fsCreateOffer, fsUpdateOffer } from '@/services/firestoreOffers';
import {
  fsSubscribeOrders,
  fsCreateOrder,
  fsUpdateOrder,
  fsUpdateDeliveryStatus,
  fsSubscribeAvailableDeliveries,
  fsDriverAcceptOrder,
  fsSubmitProviderRating,
  fsSubmitDriverRating,
  fsSubscribeAppSettings,
} from '@/services/firestoreOrders';

const OFFERS_KEY = 'tabbakheen_offers';
const ORDERS_KEY = 'tabbakheen_orders';
const RATINGS_KEY = 'tabbakheen_ratings';
const DRIVER_RATINGS_KEY = 'tabbakheen_driver_ratings';
const USERS_KEY = 'tabbakheen_users';
const SUBSCRIPTIONS_KEY = 'tabbakheen_subscriptions';
const APP_SETTINGS_KEY = 'tabbakheen_app_settings';

export const [DataProvider, useData] = createContextHook(() => {
  const { user: authUser } = useAuth();
  const fb = isFirebaseConfigured();

  const [offers, setOffers] = useState<Offer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ratings, setRatings] = useState<ProviderRating[]>([]);
  const [driverRatings, setDriverRatings] = useState<DriverRating[]>([]);
  const [providers, setProviders] = useState<User[]>([]);
  const [drivers, setDrivers] = useState<User[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>(MOCK_APP_SETTINGS);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const driverAssigned = useRef<Order[]>([]);
  const driverAvailable = useRef<Order[]>([]);

  const mergeDriverOrders = useCallback(() => {
    const map = new Map<string, Order>();
    for (const o of [...driverAssigned.current, ...driverAvailable.current]) {
      map.set(o.id, o);
    }
    setOrders(
      Array.from(map.values()).sort(
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
      return;
    }

    console.log('[DataContext] Setting up order subscriptions for', authUser.role, authUser.uid);
    const unsubs: (() => void)[] = [];

    if (authUser.role === 'driver') {
      unsubs.push(
        fsSubscribeOrders('driverUid', authUser.uid, (data) => {
          driverAssigned.current = data;
          mergeDriverOrders();
        }),
      );
      unsubs.push(
        fsSubscribeAvailableDeliveries((data) => {
          driverAvailable.current = data;
          mergeDriverOrders();
        }),
      );
    } else {
      const field = authUser.role === 'customer' ? 'customerUid' : 'providerUid';
      unsubs.push(fsSubscribeOrders(field, authUser.uid, setOrders));
    }

    return () => {
      unsubs.forEach((fn) => fn());
      driverAssigned.current = [];
      driverAvailable.current = [];
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fb, authUser?.uid, authUser?.role, mergeDriverOrders]);

  // ======= CRUD: Offers =======

  const createOffer = useCallback(
    async (offer: Omit<Offer, 'id' | 'createdAt'>) => {
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
    [offers, fb],
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
        await fsUpdateOffer(id, { isAvailable: false });
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
      const now = new Date().toISOString();
      const provider = providers.find((p) => p.uid === order.providerUid);

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
        note: order.note,
        deliveryNotes: '',
        stcPayProofImageUrl: '',
        stcPayProofNote: '',
        paymentReference: '',
        providerLat: provider?.location?.lat ?? null,
        providerLng: provider?.location?.lng ?? null,
        customerLat: authUser?.location?.lat ?? null,
        customerLng: authUser?.location?.lng ?? null,
        pickupAddress: provider?.address ?? '',
        dropoffAddress: authUser?.address ?? '',
        createdAt: now,
        updatedAt: now,
      };

      if (fb) {
        const id = await fsCreateOrder(base);
        const newOrder: Order = { ...base, id };
        console.log('[DataContext] Order created via Firestore:', id, 'Number:', base.orderNumber);
        return newOrder;
      }

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
        await fsUpdateDeliveryStatus(orderId, newStatus);
        console.log('[DataContext] Delivery status updated via Firestore:', orderId, '->', newStatus);
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
      const now = new Date().toISOString();

      if (fb) {
        const order = orders.find((o) => o.id === orderId);
        const changes: Record<string, any> = { status };
        if (comment) changes.providerComment = comment;
        if (reason) changes.statusReason = reason;
        if (status === 'delivered' && order?.paymentMethod === 'cod') {
          changes.paymentStatus = 'paid_confirmed';
        }
        if (status === 'cancelled' && order?.paymentStatus === 'paid') {
          changes.paymentStatus = 'payment_rejected';
        }
        await fsUpdateOrder(orderId, changes);
        console.log('[DataContext] Order status updated via Firestore:', orderId, '->', status, 'changes:', JSON.stringify(changes));
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
    [orders, fb],
  );

  const submitPaymentProof = useCallback(
    async (orderId: string, proofImageUrl: string, proofNote: string, paymentReference?: string) => {
      if (fb) {
        await fsUpdateOrder(orderId, {
          stcPayProofImageUrl: proofImageUrl,
          stcPayProofNote: proofNote,
          paymentReference: paymentReference ?? '',
          paymentStatus: 'proof_sent',
        });
        console.log('[DataContext] Payment proof submitted via Firestore:', orderId);
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
        await fsUpdateOrder(orderId, {
          paymentStatus: 'paid_confirmed',
        });
        console.log('[DataContext] Payment confirmed via Firestore:', orderId);
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
        await fsUpdateOrder(orderId, { paymentStatus: 'payment_rejected' });
        console.log('[DataContext] Payment rejected via Firestore:', orderId);
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
        const changes: Record<string, any> = {
          deliveryMethod: method,
        };
        if (method === 'self_pickup') {
          changes.deliveryStatus = 'self_pickup_selected';
          console.log('[DataContext] Customer chose SELF PICKUP for order:', orderId);
        } else if (method === 'driver') {
          changes.deliveryStatus = 'ready_for_driver';
          console.log('[DataContext] Customer chose DRIVER DELIVERY for order:', orderId);
        }
        console.log('[DataContext] setDeliveryMethod Firestore payload (customer-safe):', JSON.stringify(changes));
        await fsUpdateOrder(orderId, changes);
        console.log('[DataContext] Delivery method persisted to Firestore:', orderId, '->', method);
        return;
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
    },
    [orders, fb],
  );

  const assignDriver = useCallback(
    async (
      orderId: string,
      driverUid: string,
      deliveryFee?: number,
      deliveryPaymentMethod?: DeliveryPaymentMethod,
    ) => {
      const fee = deliveryFee ?? 0;

      if (fb) {
        const order = orders.find((o) => o.id === orderId);
        await fsUpdateOrder(orderId, {
          driverUid,
          deliveryMethod: 'driver_delivery',
          deliveryFee: fee,
          totalAmount: (order?.priceSnapshot ?? 0) + fee,
          deliveryPaymentMethod: deliveryPaymentMethod ?? 'cod',
          status: 'assigned_to_driver',
          driverStatus: 'assigned',
        });
        console.log('[DataContext] Driver assigned via Firestore:', driverUid, 'to order:', orderId);
        return;
      }

      const now = new Date().toISOString();
      const updated = orders.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          driverUid,
          deliveryMethod: 'driver_delivery' as DeliveryMethod,
          deliveryFee: fee,
          totalAmount: o.priceSnapshot + fee,
          deliveryPaymentMethod: deliveryPaymentMethod ?? ('cod' as DeliveryPaymentMethod),
          status: 'assigned_to_driver' as OrderStatus,
          driverStatus: 'assigned',
          updatedAt: now,
        };
      });
      await saveOrders(updated);
      console.log('[DataContext] Driver assigned:', driverUid, 'to order:', orderId, 'fee:', deliveryFee);
    },
    [orders, fb],
  );

  const driverAcceptDelivery = useCallback(
    async (orderId: string, driverUid: string) => {
      if (fb) {
        await fsDriverAcceptOrder(orderId, driverUid);
        console.log('[DataContext] Driver self-accepted delivery via Firestore:', driverUid, 'order:', orderId);
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
    [orders, fb],
  );

  const updateDriverStatus = useCallback(
    async (orderId: string, driverStatus: string, orderStatus: OrderStatus) => {
      const now = new Date().toISOString();

      if (fb) {
        const order = orders.find((o) => o.id === orderId);
        const changes: Record<string, any> = { driverStatus, status: orderStatus };
        if (orderStatus === 'delivered' && order?.paymentMethod === 'cod') {
          changes.paymentStatus = 'paid_confirmed';
        }
        await fsUpdateOrder(orderId, changes);
        console.log('[DataContext] Driver status updated via Firestore:', orderId, '->', driverStatus);
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

      if (fb) {
        const order = orders.find((o) => o.id === orderId);
        const changes: Record<string, any> = { status: 'delivered', deliveryStatus: 'delivered' };
        if (order?.paymentMethod === 'cod') {
          changes.paymentStatus = 'paid_confirmed';
        }
        await fsUpdateOrder(orderId, changes);
        console.log('[DataContext] Order marked delivered via Firestore (provider action):', orderId);
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
          await fsSubmitProviderRating(
            rating.providerUid,
            rating.orderId,
            rating.customerUid,
            rating.stars,
            rating.comment,
          );
          await fsUpdateOrder(rating.orderId, { ratingSubmitted: true });
        } catch (e) {
          console.log('[DataContext] Error submitting rating to Firestore:', e);
        }
        setOrders((prev) =>
          prev.map((o) => (o.id === rating.orderId ? { ...o, ratingSubmitted: true } : o)),
        );
      } else {
        const updatedOrders = orders.map((o) =>
          o.id === rating.orderId ? { ...o, ratingSubmitted: true } : o,
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
          await fsSubmitDriverRating(
            rating.driverUid,
            rating.orderId,
            rating.customerUid,
            rating.stars,
            rating.comment,
          );
          await fsUpdateOrder(rating.orderId, { driverRatingSubmitted: true });
        } catch (e) {
          console.log('[DataContext] Error submitting driver rating to Firestore:', e);
        }
        setOrders((prev) =>
          prev.map((o) => (o.id === rating.orderId ? { ...o, driverRatingSubmitted: true } : o)),
        );
      } else {
        const updatedOrders = orders.map((o) =>
          o.id === rating.orderId ? { ...o, driverRatingSubmitted: true } : o,
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
        await fsUpdateUser(driverUid, { isAvailable });
        console.log('[DataContext] Driver availability updated via Firestore:', driverUid, '->', isAvailable);
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
    [fb],
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

  const getAvailableDeliveries = useCallback((): Order[] => {
    return orders.filter(
      (o) =>
        o.deliveryMethod === 'driver' &&
        o.deliveryStatus === 'ready_for_driver' &&
        !o.driverUid,
    );
  }, [orders]);

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
        await fsUpdateOrder(orderId, {
          status: 'ready_for_pickup',
        });
        console.log('[DataContext] Order marked ready via Firestore (customer will choose delivery):', orderId);
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
      if (!provider?.location || !customerLat || !customerLng) {
        return appSettings.deliveryPricing.baseFee;
      }
      return calculateDeliveryFee(
        provider.location.lat,
        provider.location.lng,
        customerLat,
        customerLng,
        appSettings.deliveryPricing,
      );
    },
    [providers, appSettings],
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
    assignDriver,
    updateDriverStatus,
    markOrderDelivered,
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
    markOrderReady,
  }), [
    offers, orders, ratings, driverRatings, providers, drivers, subscriptions, appSettings,
    activeProviders, availableOffers, isLoading,
    createOffer, updateOffer, deleteOffer, createOrder, updateOrderStatus,
    submitPaymentProof, confirmPayment, rejectPayment, setDeliveryMethod,
    assignDriver, updateDriverStatus, markOrderDelivered, submitRating, submitDriverRating,
    getProviderById, getDriverById, getOffersByProvider, getOrdersByCustomer,
    getOrdersByProvider, getOrdersByDriver, getAvailableDeliveries, getAvailableDrivers,
    getRatingsByProvider, getRatingsByDriver, getSubscription, isProviderSubscriptionValid,
    createSubscription, updateProviderPaymentMethods, updateDriverAvailability,
    updateDeliveryStatusAsDriver, driverAcceptDelivery, computeDeliveryFee, markOrderReady,
  ]);
});
