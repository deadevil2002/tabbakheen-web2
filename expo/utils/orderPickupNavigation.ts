export interface OrderPickupSnapshot {
  providerLat?: number | null;
  providerLng?: number | null;
  pickupAddress?: string | null;
}

export type PickupNavigationTarget =
  | { kind: 'coordinates'; lat: number; lng: number; address: string }
  | { kind: 'address'; address: string }
  | null;

/** Uses only the order-authorized pickup snapshot, never a public profile. */
export function getOrderPickupNavigationTarget(
  order: OrderPickupSnapshot | null | undefined,
): PickupNavigationTarget {
  const address = typeof order?.pickupAddress === 'string' ? order.pickupAddress.trim() : '';
  const lat = order?.providerLat;
  const lng = order?.providerLng;
  if (typeof lat === 'number' && Number.isFinite(lat)
    && typeof lng === 'number' && Number.isFinite(lng)) {
    return { kind: 'coordinates', lat, lng, address };
  }
  return address ? { kind: 'address', address } : null;
}