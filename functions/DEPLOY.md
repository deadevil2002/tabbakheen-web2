# Firebase Cloud Functions - Tabbakheen Push Notifications

## Prerequisites

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Make sure you're in the project root

## Setup

```bash
cd functions
npm install
```

## Deploy

```bash
firebase deploy --only functions
```

## What it does

The `onOrderUpdate` function triggers on every Firestore `orders/{orderId}` document update and sends push notifications via Expo Push API based on state transitions:

| Event | Trigger | Notified |
|-------|---------|----------|
| Provider accepted order | status: pending → accepted | Customer |
| Order ready for pickup | status: → ready_for_pickup | Customer |
| Customer chose self pickup | deliveryMethod → self_pickup | Provider |
| Customer chose driver delivery | deliveryStatus → ready_for_driver | Provider + All drivers |
| Driver accepted delivery | deliveryStatus → driver_assigned | Customer + Provider |
| Driver picked up order | deliveryStatus → picked_up | Customer |
| Driver arrived | deliveryStatus → arrived | Customer |
| Order delivered | deliveryStatus → delivered | Customer + Provider |
| Self-pickup completed | status → delivered (self_pickup) | Customer |

## Deduplication

Each notification only fires when the specific field value **changes** (before !== after), preventing duplicate sends on unrelated field updates.

## Firebase project

Project: tabbakheen-99883

Make sure your `.firebaserc` file points to the correct project:

```json
{
  "projects": {
    "default": "tabbakheen-99883"
  }
}
```
