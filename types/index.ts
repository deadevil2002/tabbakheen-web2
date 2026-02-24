export interface UserLocation {
  lat: number;
  lng: number;
}

export type UserRole = 'customer' | 'provider' | 'driver';

export type DeliveryMethod = 'self_pickup' | 'driver' | 'driver_delivery';

export type DeliveryStatus =
  | 'pending_driver'
  | 'ready_for_driver'
  | 'driver_assigned'
  | 'driver_rejected'
  | 'in_transit'
  | 'delivered'
  | 'cancelled';

export type PaymentMethod = 'stc_pay' | 'bank_transfer' | 'cod';

export type DeliveryPaymentMethod = 'cod' | 'stc_pay_to_driver' | 'bank_transfer_to_driver';

export type PaymentStatus = 'unpaid' | 'paid' | 'failed' | 'refunded' | 'proof_sent' | 'paid_confirmed' | 'payment_rejected';

export type OrderStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'preparing'
  | 'ready_for_pickup'
  | 'searching_driver'
  | 'assigned_to_driver'
  | 'picked_up'
  | 'delivered'
  | 'cancelled';

export type SubscriptionStatus = 'trialing' | 'active' | 'expired' | 'canceled' | 'past_due';

export type VehicleType = 'car' | 'motorcycle' | 'bicycle';

export interface StcPayConfig {
  enabled: boolean;
  phone: string;
}

export interface BankTransferConfig {
  enabled: boolean;
  iban: string;
  accountName: string;
  bankName: string;
}

export interface ProviderPaymentMethods {
  stcPay: StcPayConfig;
  bankTransfer: BankTransferConfig;
}

export interface User {
  uid: string;
  email: string;
  displayName: string;
  phone: string;
  role: UserRole;
  photoUrl: string;
  socialLink: string;
  location: UserLocation | null;
  address: string;
  ratingAverage: number;
  ratingCount: number;
  fcmToken: string;
  createdAt: string;
  lastLoginAt?: string;
  paymentMethods?: ProviderPaymentMethods;
  vehicleType?: VehicleType;
  vehiclePlateNumber?: string;
  vehicleImageUrl?: string;
  city?: string;
  isAvailable?: boolean;
  maxDistanceKm?: number;
  hasAcceptedTerms?: boolean;
  isOwner?: boolean;
}

export interface Driver {
  uid: string;
  name: string;
  phone: string;
  vehicleType: string;
  isAvailable: boolean;
  location: UserLocation | null;
  ratingAverage: number;
  ratingCount: number;
}

export type OfferCategory = 'main' | 'dessert' | 'appetizer' | 'pastry' | 'drinks' | 'other';

export interface Offer {
  id: string;
  providerUid: string;
  title: string;
  description: string;
  price: number;
  imageUrl: string;
  isAvailable: boolean;
  category?: OfferCategory;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerUid: string;
  providerUid: string;
  driverUid: string | null;
  offerId: string;
  offerTitleSnapshot: string;
  priceSnapshot: number;
  deliveryFee: number;
  totalAmount: number;
  deliveryMethod: DeliveryMethod | null;
  paymentMethod: PaymentMethod;
  deliveryPaymentMethod: DeliveryPaymentMethod | null;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  providerComment: string;
  statusReason: string;
  driverStatus: string;
  deliveryStatus: DeliveryStatus | null;
  orderRef: string;
  transactionId: string;
  paidAt: string | null;
  ratingSubmitted: boolean;
  driverRatingSubmitted: boolean;
  note: string;
  deliveryNotes: string;
  stcPayProofImageUrl: string;
  stcPayProofNote: string;
  paymentReference: string;
  providerLat: number | null;
  providerLng: number | null;
  customerLat: number | null;
  customerLng: number | null;
  pickupAddress: string;
  dropoffAddress: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  orderId: string;
  customerUid: string;
  amount: number;
  method: PaymentMethod;
  gatewayResponse: string;
  status: PaymentStatus;
  createdAt: string;
}

export interface ProviderRating {
  id: string;
  providerUid: string;
  customerUid: string;
  orderId: string;
  stars: number;
  comment: string;
  createdAt: string;
}

export interface DriverRating {
  id: string;
  driverUid: string;
  customerUid: string;
  orderId: string;
  stars: number;
  comment: string;
  createdAt: string;
}

export interface DeliveryPricing {
  currency: string;
  baseFee: number;
  perKmInsideCity: number;
  perKmOutsideCity: number;
  maxFee: number;
}

export interface AppSettings {
  bannerImageUrl: string;
  supportEmail: string;
  supportWhatsapp: string;
  deliveryPricing: DeliveryPricing;
}

export interface Subscription {
  id: string;
  providerUid: string;
  planId: string;
  status: SubscriptionStatus;
  trialEndsAt: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  createdAt: string;
  updatedAt: string;
}

export type Locale = 'ar' | 'en';

export const SAUDI_BANKS = [
  'Al Rajhi Bank',
  'Saudi National Bank (SNB)',
  'Riyad Bank',
  'Banque Saudi Fransi',
  'Arab National Bank',
  'Saudi British Bank (SABB)',
  'Alinma Bank',
  'Bank AlJazira',
  'Bank Albilad',
  'Gulf International Bank',
  'Other',
] as const;

export type SaudiBank = (typeof SAUDI_BANKS)[number];
