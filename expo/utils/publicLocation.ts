import type { PublicLocation, User } from '@/types';

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

export function hasEnabledPublicLocation(
  provider: Pick<User, 'publicLocationEnabled' | 'publicLocation'>,
): provider is Pick<User, 'publicLocationEnabled' | 'publicLocation'> & {
  publicLocationEnabled: true;
  publicLocation: PublicLocation;
} {
  return provider.publicLocationEnabled === true && isValidPublicLocation(provider.publicLocation);
}