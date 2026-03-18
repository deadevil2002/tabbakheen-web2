const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { Expo } = require("expo-server-sdk");

admin.initializeApp();
const db = admin.firestore();
const expo = new Expo();

async function getUserPushToken(uid) {
  try {
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      console.log(`[Push] No user doc for uid: ${uid}`);
      return null;
    }
    const data = userDoc.data();
    const token = data?.expoPushToken ?? null;
    if (!token || !Expo.isExpoPushToken(token)) {
      console.log(`[Push] No valid push token for uid: ${uid}, token: ${token}`);
      return null;
    }
    return token;
  } catch (e) {
    console.error(`[Push] Error fetching user token for ${uid}:`, e);
    return null;
  }
}

async function getDriverPushTokens() {
  try {
    const snapshot = await db
      .collection("users")
      .where("role", "==", "driver")
      .where("pushNotificationsEnabled", "==", true)
      .get();

    const tokens = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.expoPushToken && Expo.isExpoPushToken(data.expoPushToken)) {
        tokens.push({ uid: doc.id, token: data.expoPushToken });
      }
    });
    console.log(`[Push] Found ${tokens.length} driver tokens`);
    return tokens;
  } catch (e) {
    console.error("[Push] Error fetching driver tokens:", e);
    return [];
  }
}

async function sendPushNotifications(messages) {
  if (messages.length === 0) {
    console.log("[Push] No messages to send");
    return;
  }

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      console.log("[Push] Tickets:", JSON.stringify(ticketChunk));

      for (const ticket of ticketChunk) {
        if (ticket.status === "error") {
          console.error("[Push] Ticket error:", ticket.message);
          if (ticket.details && ticket.details.error === "DeviceNotRegistered") {
            console.log("[Push] Device not registered, should clean up token");
          }
        }
      }
    } catch (e) {
      console.error("[Push] Error sending chunk:", e);
    }
  }
}

exports.onOrderUpdate = functions.firestore
  .document("orders/{orderId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const orderId = context.params.orderId;

    console.log(
      `[Push] Order ${orderId} updated. ` +
        `Before: status=${before.status}, deliveryStatus=${before.deliveryStatus}, deliveryMethod=${before.deliveryMethod}, driverUid=${before.driverUid}. ` +
        `After: status=${after.status}, deliveryStatus=${after.deliveryStatus}, deliveryMethod=${after.deliveryMethod}, driverUid=${after.driverUid}`
    );

    const messages = [];
    const orderLabel = after.offerTitleSnapshot || after.orderNumber || orderId;

    // A. Provider accepted the order (status: pending -> accepted)
    if (before.status !== "accepted" && after.status === "accepted") {
      console.log(`[Push] Event: Provider accepted order ${orderId}`);
      if (after.customerUid) {
        const token = await getUserPushToken(after.customerUid);
        if (token) {
          messages.push({
            to: token,
            title: "تم قبول طلبك ✅",
            body: `طلبك "${orderLabel}" تم قبوله وجاري التحضير`,
            data: { type: "order_accepted", orderId, role: "customer" },
            sound: "default",
          });
        }
      }
    }

    // B. Provider marked order ready (status: -> ready_for_pickup)
    if (
      before.status !== "ready_for_pickup" &&
      after.status === "ready_for_pickup"
    ) {
      console.log(`[Push] Event: Order ${orderId} ready for pickup`);
      if (after.customerUid) {
        const token = await getUserPushToken(after.customerUid);
        if (token) {
          messages.push({
            to: token,
            title: "طلبك جاهز 🍽️",
            body: `طلبك "${orderLabel}" جاهز. اختر طريقة الاستلام`,
            data: { type: "order_ready", orderId, role: "customer" },
            sound: "default",
          });
        }
      }
    }

    // C. Customer selected self pickup
    if (
      before.deliveryMethod !== "self_pickup" &&
      after.deliveryMethod === "self_pickup" &&
      after.deliveryStatus === "self_pickup_selected"
    ) {
      console.log(`[Push] Event: Customer chose self pickup for ${orderId}`);
      if (after.providerUid) {
        const token = await getUserPushToken(after.providerUid);
        if (token) {
          messages.push({
            to: token,
            title: "استلام ذاتي 📦",
            body: `العميل سيستلم الطلب "${orderLabel}" بنفسه`,
            data: { type: "self_pickup_selected", orderId, role: "provider" },
            sound: "default",
          });
        }
      }
    }

    // D. Customer selected driver delivery
    if (
      before.deliveryStatus !== "ready_for_driver" &&
      after.deliveryStatus === "ready_for_driver" &&
      after.deliveryMethod === "driver"
    ) {
      console.log(`[Push] Event: Customer requested driver for ${orderId}`);

      if (after.providerUid) {
        const providerToken = await getUserPushToken(after.providerUid);
        if (providerToken) {
          messages.push({
            to: providerToken,
            title: "توصيل بمندوب 🚗",
            body: `العميل طلب توصيل الطلب "${orderLabel}" بواسطة مندوب`,
            data: { type: "driver_delivery_requested", orderId, role: "provider" },
            sound: "default",
          });
        }
      }

      const driverTokens = await getDriverPushTokens();
      for (const { token } of driverTokens) {
        messages.push({
          to: token,
          title: "توصيلة جديدة متاحة 🚀",
          body: `توصيلة جديدة متاحة للطلب "${orderLabel}"`,
          data: { type: "new_delivery_available", orderId, role: "driver" },
          sound: "default",
        });
      }
    }

    // E. Driver accepted the delivery
    if (
      before.deliveryStatus !== "driver_assigned" &&
      after.deliveryStatus === "driver_assigned" &&
      after.driverUid &&
      !before.driverUid
    ) {
      console.log(`[Push] Event: Driver ${after.driverUid} accepted ${orderId}`);

      if (after.customerUid) {
        const customerToken = await getUserPushToken(after.customerUid);
        if (customerToken) {
          messages.push({
            to: customerToken,
            title: "تم تعيين مندوب 🏍️",
            body: `تم تعيين مندوب لتوصيل طلبك "${orderLabel}"`,
            data: { type: "driver_assigned", orderId, role: "customer" },
            sound: "default",
          });
        }
      }

      if (after.providerUid) {
        const providerToken = await getUserPushToken(after.providerUid);
        if (providerToken) {
          messages.push({
            to: providerToken,
            title: "مندوب في الطريق 🏍️",
            body: `مندوب في طريقه لاستلام الطلب "${orderLabel}"`,
            data: { type: "driver_assigned", orderId, role: "provider" },
            sound: "default",
          });
        }
      }
    }

    // F. Driver picked up the order
    if (
      before.deliveryStatus !== "picked_up" &&
      after.deliveryStatus === "picked_up"
    ) {
      console.log(`[Push] Event: Driver picked up order ${orderId}`);
      if (after.customerUid) {
        const token = await getUserPushToken(after.customerUid);
        if (token) {
          messages.push({
            to: token,
            title: "المندوب استلم طلبك 📦",
            body: `المندوب استلم طلبك "${orderLabel}" وفي الطريق إليك`,
            data: { type: "order_picked_up", orderId, role: "customer" },
            sound: "default",
          });
        }
      }
    }

    // G. Driver arrived
    if (
      before.deliveryStatus !== "arrived" &&
      after.deliveryStatus === "arrived"
    ) {
      console.log(`[Push] Event: Driver arrived for order ${orderId}`);
      if (after.customerUid) {
        const token = await getUserPushToken(after.customerUid);
        if (token) {
          messages.push({
            to: token,
            title: "المندوب وصل 📍",
            body: `المندوب وصل لموقعك بطلبك "${orderLabel}"`,
            data: { type: "driver_arrived", orderId, role: "customer" },
            sound: "default",
          });
        }
      }
    }

    // H. Order delivered (deliveryStatus)
    if (
      before.deliveryStatus !== "delivered" &&
      after.deliveryStatus === "delivered"
    ) {
      console.log(`[Push] Event: Order ${orderId} delivered`);

      if (after.customerUid) {
        const customerToken = await getUserPushToken(after.customerUid);
        if (customerToken) {
          messages.push({
            to: customerToken,
            title: "تم التوصيل ✅",
            body: `طلبك "${orderLabel}" تم توصيله بنجاح`,
            data: { type: "order_delivered", orderId, role: "customer" },
            sound: "default",
          });
        }
      }

      if (after.providerUid) {
        const providerToken = await getUserPushToken(after.providerUid);
        if (providerToken) {
          messages.push({
            to: providerToken,
            title: "تم التوصيل ✅",
            body: `الطلب "${orderLabel}" تم توصيله للعميل بنجاح`,
            data: { type: "order_delivered", orderId, role: "provider" },
            sound: "default",
          });
        }
      }
    }

    // I. Self-pickup completion (status -> delivered with self_pickup method)
    if (
      before.status !== "delivered" &&
      after.status === "delivered" &&
      after.deliveryMethod === "self_pickup"
    ) {
      console.log(`[Push] Event: Self-pickup order ${orderId} completed`);
      if (after.customerUid) {
        const token = await getUserPushToken(after.customerUid);
        if (token) {
          messages.push({
            to: token,
            title: "تم تسليم الطلب ✅",
            body: `طلبك "${orderLabel}" تم تسليمه بنجاح`,
            data: { type: "order_completed", orderId, role: "customer" },
            sound: "default",
          });
        }
      }
    }

    if (messages.length > 0) {
      console.log(`[Push] Sending ${messages.length} notifications for order ${orderId}`);
      await sendPushNotifications(messages);
    } else {
      console.log(`[Push] No notifications to send for order ${orderId}`);
    }
  });
