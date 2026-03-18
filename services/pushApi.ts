const PUSH_API_URL = 'https://tabbakheen-api.tabbakheen.workers.dev';
const PUSH_API_KEY = 'tbk_ntfy_Xk9R2mP7vL4nQ8wF3jH6sY1dA5cE0gBzW';

export type PushEvent =
  | 'order_accepted'
  | 'order_ready'
  | 'self_pickup_selected'
  | 'driver_delivery_requested'
  | 'driver_assigned'
  | 'picked_up'
  | 'arrived'
  | 'delivered'
  | 'self_pickup_completed';

export async function sendPushNotification(
  event: PushEvent,
  orderId: string,
): Promise<void> {
  try {
    console.log(`[PushAPI] Sending ${event} for order ${orderId}`);
    const response = await fetch(`${PUSH_API_URL}/notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': PUSH_API_KEY,
      },
      body: JSON.stringify({ event, orderId }),
    });
    const data = await response.json();
    console.log(`[PushAPI] Response:`, JSON.stringify(data));
  } catch (e) {
    console.log(`[PushAPI] Error sending ${event}:`, e);
  }
}

export interface DeliveryQuote {
  deliveryFee: number;
  totalAmount: number;
  deliveryDistanceKm: number;
  subtotal: number;
}

export interface DeliveryFinalizeResult {
  deliveryFee: number;
  totalAmount: number;
  deliveryDistanceKm: number;
  deliveryQuoteId?: string;
}

export async function getDeliveryQuote(
  orderId: string,
): Promise<DeliveryQuote> {
  try {
    console.log(`[PushAPI] Getting delivery quote for order ${orderId}`);
    const response = await fetch(`${PUSH_API_URL}/delivery-quote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': PUSH_API_KEY,
      },
      body: JSON.stringify({ orderId }),
    });
    const data = await response.json();
    console.log(`[PushAPI] Delivery quote response:`, JSON.stringify(data));
    if (!data.success) {
      throw new Error(data.error || 'Failed to get delivery quote');
    }
    return {
      deliveryFee: data.deliveryFee ?? 0,
      totalAmount: data.totalAmount ?? 0,
      deliveryDistanceKm: data.deliveryDistanceKm ?? 0,
      subtotal: data.subtotal ?? 0,
    };
  } catch (e: any) {
    console.log(`[PushAPI] Error getting delivery quote:`, e);
    throw e;
  }
}

export async function finalizeDeliveryMethod(
  orderId: string,
  method: 'self_pickup' | 'driver',
): Promise<DeliveryFinalizeResult> {
  try {
    console.log(`[PushAPI] Finalizing delivery: orderId=${orderId} method=${method}`);
    const response = await fetch(`${PUSH_API_URL}/finalize-delivery`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': PUSH_API_KEY,
      },
      body: JSON.stringify({ orderId, method }),
    });
    const data = await response.json();
    console.log(`[PushAPI] Finalize delivery response:`, JSON.stringify(data));
    if (!data.success) {
      throw new Error(data.error || 'Failed to finalize delivery');
    }
    return {
      deliveryFee: data.deliveryFee ?? 0,
      totalAmount: data.totalAmount ?? 0,
      deliveryDistanceKm: data.deliveryDistanceKm ?? 0,
      deliveryQuoteId: data.deliveryQuoteId,
    };
  } catch (e: any) {
    console.log(`[PushAPI] Error finalizing delivery:`, e);
    throw e;
  }
}

export async function aggregateRatingViaWorker(
  type: 'provider' | 'driver',
  uid: string,
): Promise<void> {
  try {
    console.log(`[PushAPI] Aggregating ${type} rating for ${uid}`);
    const response = await fetch(`${PUSH_API_URL}/aggregate-rating`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': PUSH_API_KEY,
      },
      body: JSON.stringify({ type, uid }),
    });
    const data = await response.json();
    console.log(`[PushAPI] Aggregate response:`, JSON.stringify(data));
  } catch (e) {
    console.log(`[PushAPI] Error aggregating ${type} rating:`, e);
  }
}
