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
