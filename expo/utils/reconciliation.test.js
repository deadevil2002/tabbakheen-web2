import { expect, test } from 'bun:test';

const { hasOfferImage } = await import('./offerPresentation');
const { createWhatsAppUrl } = await import('./supportLinks');
const {
  getPublicLocationLabel,
  hasEnabledPublicLocation,
  resolvePublicLocationCity,
} = await import('./publicLocation');
const {
  publicLocationSettingsPath,
  offersReturnPath,
  shouldReopenOfferDraft,
} = await import('./offerCreationNavigation');

test('offer image presentation never treats an empty image as uploaded media', () => {
  expect(hasOfferImage('')).toBe(false);
  expect(hasOfferImage('   ')).toBe(false);
  expect(hasOfferImage('https://example.com/offer.jpg')).toBe(true);
});

test('WhatsApp links use the configured number and reject missing configuration', () => {
  expect(createWhatsAppUrl('+966 50 123 4567', 'طلب دعم')).toBe(
    'https://wa.me/966501234567?text=%D8%B7%D9%84%D8%A8%20%D8%AF%D8%B9%D9%85',
  );
  expect(createWhatsAppUrl(undefined)).toBeNull();
  expect(createWhatsAppUrl('not-a-phone')).toBeNull();
});

test('map reverse geocoding supplies a city label while coordinates remain authoritative', () => {
  expect(getPublicLocationLabel([{ city: '', district: 'العليا', region: 'الرياض' }])).toBe('العليا');
  expect(getPublicLocationLabel([{ region: 'الرياض' }])).toBe('الرياض');
  expect(getPublicLocationLabel([])).toBe('');
  expect(hasEnabledPublicLocation({
    publicLocationEnabled: true,
    publicLocation: { lat: 24.7, lng: 46.6, city: 'الرياض' },
  })).toBe(true);
});

test('public-location navigation closes and reopens the offer draft without resetting it', () => {
  expect(publicLocationSettingsPath(true)).toContain('openCreate=1');
  expect(offersReturnPath(true)).toBe('/(provider)/my-offers?openCreate=1');
  expect(shouldReopenOfferDraft('1')).toBe(true);
  expect(shouldReopenOfferDraft(undefined)).toBe(false);
});

test('a newly selected point is reverse-geocoded unless its city was edited afterward', async () => {
  const { shouldReverseGeocodePublicLocation } = await import('./publicLocation');
  expect(shouldReverseGeocodePublicLocation(
    { lat: 24.7, lng: 46.6 },
    { lat: 24.71, lng: 46.61 },
    false,
  )).toBe(true);
  expect(shouldReverseGeocodePublicLocation(
    { lat: 24.7, lng: 46.6 },
    { lat: 24.71, lng: 46.61 },
    true,
  )).toBe(false);
});

test('a rejecting geocoder clears stale city text for a changed point', async () => {
  await expect(resolvePublicLocationCity(
    'الرياض',
    true,
    async () => { throw new Error('geocoder unavailable'); },
  )).resolves.toBe('');
});