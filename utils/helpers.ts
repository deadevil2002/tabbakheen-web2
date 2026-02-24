import { Locale, DeliveryPricing } from '@/types';

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

let orderCounter = 10005;

export function generateOrderNumber(): string {
  const num = orderCounter++;
  return `TB-${num}`;
}

export function generateOrderRef(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const suffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TAB-${y}${m}${d}-${suffix}`;
}

export function formatPrice(price: number, locale: Locale): string {
  if (locale === 'ar') {
    return `${price} ر.س`;
  }
  return `${price} SAR`;
}

export function formatDate(dateStr: string, locale: Locale): string {
  const date = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  return date.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', options);
}

export function formatDateShort(dateStr: string, locale: Locale): string {
  const date = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
  };
  return date.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', options);
}

export function formatDateOnly(dateStr: string, locale: Locale): string {
  const date = new Date(dateStr);
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  return date.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-US', options);
}

export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function formatDistance(km: number, locale: Locale): string {
  if (km < 1) {
    const m = Math.round(km * 1000);
    return locale === 'ar' ? `${m} م` : `${m}m`;
  }
  return locale === 'ar' ? `${km.toFixed(1)} كم` : `${km.toFixed(1)}km`;
}

export function calculateDeliveryFee(
  providerLat: number,
  providerLng: number,
  customerLat: number,
  customerLng: number,
  pricing: DeliveryPricing,
  sameCity: boolean = true,
): number {
  const distanceKm = calculateDistance(providerLat, providerLng, customerLat, customerLng);
  const perKm = sameCity ? pricing.perKmInsideCity : pricing.perKmOutsideCity;
  const fee = pricing.baseFee + distanceKm * perKm;
  const rounded = Math.round(fee);
  return Math.min(rounded, pricing.maxFee);
}

export function getStatusColor(status: string): {
  text: string;
  bg: string;
} {
  switch (status) {
    case 'pending':
      return { text: '#2563EB', bg: '#DBEAFE' };
    case 'accepted':
      return { text: '#16A34A', bg: '#DCFCE7' };
    case 'rejected':
      return { text: '#DC2626', bg: '#FEE2E2' };
    case 'preparing':
      return { text: '#D97706', bg: '#FEF3C7' };
    case 'ready_for_pickup':
      return { text: '#0891B2', bg: '#CFFAFE' };
    case 'searching_driver':
      return { text: '#8B5CF6', bg: '#EDE9FE' };
    case 'assigned_to_driver':
      return { text: '#6366F1', bg: '#E0E7FF' };
    case 'picked_up':
      return { text: '#7C3AED', bg: '#EDE9FE' };
    case 'delivered':
      return { text: '#059669', bg: '#D1FAE5' };
    case 'cancelled':
      return { text: '#6B7280', bg: '#F3F4F6' };
    case 'done':
      return { text: '#7C3AED', bg: '#EDE9FE' };
    default:
      return { text: '#6B7280', bg: '#F3F4F6' };
  }
}

export function getPaymentMethodColor(method: string): {
  text: string;
  bg: string;
} {
  switch (method) {
    case 'stc_pay':
      return { text: '#4F2D7F', bg: '#F3EDFF' };
    case 'bank_transfer':
      return { text: '#1D4ED8', bg: '#DBEAFE' };
    case 'cod':
      return { text: '#92400E', bg: '#FEF3C7' };
    default:
      return { text: '#6B7280', bg: '#F3F4F6' };
  }
}

export function getPaymentStatusColor(status: string): {
  text: string;
  bg: string;
} {
  switch (status) {
    case 'unpaid':
      return { text: '#D97706', bg: '#FEF3C7' };
    case 'proof_sent':
      return { text: '#2563EB', bg: '#DBEAFE' };
    case 'paid':
    case 'paid_confirmed':
      return { text: '#059669', bg: '#D1FAE5' };
    case 'payment_rejected':
      return { text: '#DC2626', bg: '#FEE2E2' };
    case 'failed':
      return { text: '#DC2626', bg: '#FEE2E2' };
    case 'refunded':
      return { text: '#6B7280', bg: '#F3F4F6' };
    default:
      return { text: '#6B7280', bg: '#F3F4F6' };
  }
}

export function getSubscriptionStatusColor(status: string): {
  text: string;
  bg: string;
} {
  switch (status) {
    case 'trialing':
      return { text: '#2563EB', bg: '#DBEAFE' };
    case 'active':
      return { text: '#059669', bg: '#D1FAE5' };
    case 'expired':
      return { text: '#DC2626', bg: '#FEE2E2' };
    case 'canceled':
      return { text: '#6B7280', bg: '#F3F4F6' };
    case 'past_due':
      return { text: '#D97706', bg: '#FEF3C7' };
    default:
      return { text: '#6B7280', bg: '#F3F4F6' };
  }
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function daysRemaining(dateStr: string): number {
  const target = new Date(dateStr).getTime();
  const now = Date.now();
  const diff = target - now;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
