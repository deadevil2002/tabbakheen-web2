import type { PublicLocation, User } from '@/types';
import { calculateDistance } from '@/utils/helpers';

export function isValidPublicLocation(value: unknown): value is PublicLocation {
  if (!value || typeof value !== 'object') return false;
  const location = value as Partial<PublicLocation>;
  return typeof location.lat === 'number'
    && Number.isFinite(location.lat)
    && typeof location.lng === 'number'
    && Number.isFinite(location.lng)
    && typeof location.city === 'string'
    && location.city.trim().length > 0
    && location.city.trim().length <= 120
    && location.lat >= 12
    && location.lat <= 34
    && location.lng >= 34
    && location.lng <= 61
    && !(location.lat === 0 && location.lng === 0);
}

/** Chooses a readable reverse-geocoded label without using private profile data. */
export function getPublicLocationLabel(value: unknown): string {
  if (!Array.isArray(value)) return '';
  for (const place of value) {
    if (!place || typeof place !== 'object') continue;
    const record = place as Record<string, unknown>;
    for (const key of ['city', 'district', 'subregion', 'region']) {
      const label = record[key];
      if (typeof label === 'string' && label.trim()) return label.trim();
    }
  }
  return '';
}

export function samePublicLocationCoordinates(
  first: { lat: number; lng: number } | null | undefined,
  second: { lat: number; lng: number },
): boolean {
  return first?.lat === second.lat && first?.lng === second.lng;
}

/** A changed map point must not inherit the previous point's city label. */
export function shouldReverseGeocodePublicLocation(
  previous: { lat: number; lng: number } | null | undefined,
  selected: { lat: number; lng: number },
  cityEditedAfterSelection: boolean,
): boolean {
  return !samePublicLocationCoordinates(previous, selected) && !cityEditedAfterSelection;
}

export async function resolvePublicLocationCity(
  existingCity: string,
  shouldReverseGeocode: boolean,
  reverseGeocode: () => Promise<unknown>,
): Promise<string> {
  if (!shouldReverseGeocode) return existingCity.trim();
  try {
    return getPublicLocationLabel(await reverseGeocode());
  } catch {
    return '';
  }
}

export function hasEnabledPublicLocation(
  provider: Pick<User, 'publicLocationEnabled' | 'publicLocation'>,
): provider is Pick<User, 'publicLocationEnabled' | 'publicLocation'> & {
  publicLocationEnabled: true;
  publicLocation: PublicLocation;
} {
  return provider.publicLocationEnabled === true && isValidPublicLocation(provider.publicLocation);
}

export function distanceToPublicProvider(
  customerLocation: { lat: number; lng: number } | null | undefined,
  provider: Pick<User, 'publicLocationEnabled' | 'publicLocation'>,
): number | null {
  if (!customerLocation
    || !Number.isFinite(customerLocation.lat)
    || !Number.isFinite(customerLocation.lng)
    || !hasEnabledPublicLocation(provider)) {
    return null;
  }
  return calculateDistance(
    customerLocation.lat,
    customerLocation.lng,
    provider.publicLocation.lat,
    provider.publicLocation.lng,
  );
}