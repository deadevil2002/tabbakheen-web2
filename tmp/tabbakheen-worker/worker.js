const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/tabbakheen-99883/databases/(default)/documents';
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

function base64url(buffer) {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlStr(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importPrivateKey(pem) {
  const cleaned = pem
    .replace(/\\n/g, '\n')
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const binaryDer = Uint8Array.from(atob(cleaned), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    binaryDer.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

async function createJWT(clientEmail, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/datastore'
  };
  const encodedHeader = base64urlStr(JSON.stringify(header));
  const encodedPayload = base64urlStr(JSON.stringify(payload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const key = await importPrivateKey(privateKey);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${base64url(signature)}`;
}

async function getAccessToken(clientEmail, privateKey) {
  const jwt = await createJWT(clientEmail, privateKey);
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${text}`);
  }
  const data = await response.json();
  return data.access_token;
}

function parseFirestoreValue(value) {
  if (!value) return null;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return parseInt(value.integerValue, 10);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return value.timestampValue;
  if ('mapValue' in value && value.mapValue.fields) {
    const result = {};
    for (const [k, v] of Object.entries(value.mapValue.fields)) {
      result[k] = parseFirestoreValue(v);
    }
    return result;
  }
  if ('arrayValue' in value) {
    return (value.arrayValue.values || []).map(parseFirestoreValue);
  }
  return null;
}

function parseFirestoreDoc(doc) {
  if (!doc || !doc.fields) return null;
  const result = {};
  for (const [key, value] of Object.entries(doc.fields)) {
    result[key] = parseFirestoreValue(value);
  }
  if (doc.name) {
    const parts = doc.name.split('/');
    result._id = parts[parts.length - 1];
  }
  return result;
}

async function getFirestoreDoc(collection, docId, accessToken) {
  const url = `${FIRESTORE_BASE}/${collection}/${docId}`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (!response.ok) {
    if (response.status === 404) return null;
    const text = await response.text();
    throw new Error(`Firestore GET ${collection}/${docId} failed: ${response.status} ${text}`);
  }
  const doc = await response.json();
  return parseFirestoreDoc(doc);
}

async function queryFirestore(collectionId, fieldPath, op, value, accessToken) {
  const url = `${FIRESTORE_BASE}:runQuery`;
  let firestoreValue;
  if (value === null) firestoreValue = { nullValue: null };
  else if (typeof value === 'string') firestoreValue = { stringValue: value };
  else if (typeof value === 'number') firestoreValue = { integerValue: String(value) };
  else if (typeof value === 'boolean') firestoreValue = { booleanValue: value };
  else firestoreValue = { stringValue: String(value) };

  const body = {
    structuredQuery: {
      from: [{ collectionId }],
      where: {
        fieldFilter: {
          field: { fieldPath },
          op,
          value: firestoreValue
        }
      }
    }
  };
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Firestore query failed: ${response.status} ${text}`);
  }
  const results = await response.json();
  return results.filter(r => r.document).map(r => parseFirestoreDoc(r.document));
}

function isExpoPushToken(token) {
  return typeof token === 'string' && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['));
}

async function getUserPushToken(uid, accessToken) {
  const user = await getFirestoreDoc('users', uid, accessToken);
  if (!user) return null;
  const token = user.expoPushToken;
  if (!token || !isExpoPushToken(token)) return null;
  return token;
}

async function getDriverPushTokens(accessToken) {
  const drivers = await queryFirestore('users', 'role', 'EQUAL', 'driver', accessToken);
  return drivers
    .filter(d => d && d.pushNotificationsEnabled === true && d.expoPushToken && isExpoPushToken(d.expoPushToken))
    .map(d => d.expoPushToken);
}

async function sendExpoPush(messages) {
  if (!messages.length) return;
  const chunks = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }
  for (const chunk of chunks) {
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(chunk)
      });
      const result = await response.json();
      console.log('[Push] Expo response:', JSON.stringify(result));
    } catch (e) {
      console.error('[Push] Error sending chunk:', e);
    }
  }
}

async function handleEvent(event, orderId, accessToken) {
  const order = await getFirestoreDoc('orders', orderId, accessToken);
  if (!order) {
    return { success: false, error: 'Order not found' };
  }

  const orderLabel = order.offerTitleSnapshot || order.orderNumber || orderId;
  const messages = [];

  switch (event) {
    case 'order_accepted': {
      if (order.customerUid) {
        const token = await getUserPushToken(order.customerUid, accessToken);
        if (token) {
          messages.push({
            to: token,
            title: '\u062A\u0645 \u0642\u0628\u0648\u0644 \u0637\u0644\u0628\u0643 \u2705',
            body: `\u0637\u0644\u0628\u0643 "${orderLabel}" \u062A\u0645 \u0642\u0628\u0648\u0644\u0647 \u0648\u062C\u0627\u0631\u064A \u0627\u0644\u062A\u062D\u0636\u064A\u0631`,
            data: { type: 'order_accepted', orderId, role: 'customer' },
            sound: 'default'
          });
        }
      }
      break;
    }

    case 'order_ready': {
      if (order.customerUid) {
        const token = await getUserPushToken(order.customerUid, accessToken);
        if (token) {
          messages.push({
            to: token,
            title: '\u0637\u0644\u0628\u0643 \u062C\u0627\u0647\u0632 \uD83C\uDF7D\uFE0F',
            body: `\u0637\u0644\u0628\u0643 "${orderLabel}" \u062C\u0627\u0647\u0632. \u0627\u062E\u062A\u0631 \u0637\u0631\u064A\u0642\u0629 \u0627\u0644\u0627\u0633\u062A\u0644\u0627\u0645`,
            data: { type: 'order_ready', orderId, role: 'customer' },
            sound: 'default'
          });
        }
      }
      break;
    }

    case 'self_pickup_selected': {
      if (order.providerUid) {
        const token = await getUserPushToken(order.providerUid, accessToken);
        if (token) {
          messages.push({
            to: token,
            title: '\u0627\u0633\u062A\u0644\u0627\u0645 \u0630\u0627\u062A\u064A \uD83D\uDCE6',
            body: `\u0627\u0644\u0639\u0645\u064A\u0644 \u0633\u064A\u0633\u062A\u0644\u0645 \u0627\u0644\u0637\u0644\u0628 "${orderLabel}" \u0628\u0646\u0641\u0633\u0647`,
            data: { type: 'self_pickup_selected', orderId, role: 'provider' },
            sound: 'default'
          });
        }
      }
      break;
    }

    case 'driver_delivery_requested': {
      if (order.providerUid) {
        const providerToken = await getUserPushToken(order.providerUid, accessToken);
        if (providerToken) {
          messages.push({
            to: providerToken,
            title: '\u062A\u0648\u0635\u064A\u0644 \u0628\u0645\u0646\u062F\u0648\u0628 \uD83D\uDE97',
            body: `\u0627\u0644\u0639\u0645\u064A\u0644 \u0637\u0644\u0628 \u062A\u0648\u0635\u064A\u0644 \u0627\u0644\u0637\u0644\u0628 "${orderLabel}" \u0628\u0648\u0627\u0633\u0637\u0629 \u0645\u0646\u062F\u0648\u0628`,
            data: { type: 'driver_delivery_requested', orderId, role: 'provider' },
            sound: 'default'
          });
        }
      }
      const driverTokens = await getDriverPushTokens(accessToken);
      for (const token of driverTokens) {
        messages.push({
          to: token,
          title: '\u062A\u0648\u0635\u064A\u0644\u0629 \u062C\u062F\u064A\u062F\u0629 \u0645\u062A\u0627\u062D\u0629 \uD83D\uDE80',
          body: `\u062A\u0648\u0635\u064A\u0644\u0629 \u062C\u062F\u064A\u062F\u0629 \u0645\u062A\u0627\u062D\u0629 \u0644\u0644\u0637\u0644\u0628 "${orderLabel}"`,
          data: { type: 'new_delivery_available', orderId, role: 'driver' },
          sound: 'default'
        });
      }
      break;
    }

    case 'driver_assigned': {
      if (order.customerUid) {
        const customerToken = await getUserPushToken(order.customerUid, accessToken);
        if (customerToken) {
          messages.push({
            to: customerToken,
            title: '\u062A\u0645 \u062A\u0639\u064A\u064A\u0646 \u0645\u0646\u062F\u0648\u0628 \uD83C\uDFCD\uFE0F',
            body: `\u062A\u0645 \u062A\u0639\u064A\u064A\u0646 \u0645\u0646\u062F\u0648\u0628 \u0644\u062A\u0648\u0635\u064A\u0644 \u0637\u0644\u0628\u0643 "${orderLabel}"`,
            data: { type: 'driver_assigned', orderId, role: 'customer' },
            sound: 'default'
          });
        }
      }
      if (order.providerUid) {
        const providerToken = await getUserPushToken(order.providerUid, accessToken);
        if (providerToken) {
          messages.push({
            to: providerToken,
            title: '\u0645\u0646\u062F\u0648\u0628 \u0641\u064A \u0627\u0644\u0637\u0631\u064A\u0642 \uD83C\uDFCD\uFE0F',
            body: `\u0645\u0646\u062F\u0648\u0628 \u0641\u064A \u0637\u0631\u064A\u0642\u0647 \u0644\u0627\u0633\u062A\u0644\u0627\u0645 \u0627\u0644\u0637\u0644\u0628 "${orderLabel}"`,
            data: { type: 'driver_assigned', orderId, role: 'provider' },
            sound: 'default'
          });
        }
      }
      break;
    }

    case 'picked_up': {
      if (order.customerUid) {
        const token = await getUserPushToken(order.customerUid, accessToken);
        if (token) {
          messages.push({
            to: token,
            title: '\u0627\u0644\u0645\u0646\u062F\u0648\u0628 \u0627\u0633\u062A\u0644\u0645 \u0637\u0644\u0628\u0643 \uD83D\uDCE6',
            body: `\u0627\u0644\u0645\u0646\u062F\u0648\u0628 \u0627\u0633\u062A\u0644\u0645 \u0637\u0644\u0628\u0643 "${orderLabel}" \u0648\u0641\u064A \u0627\u0644\u0637\u0631\u064A\u0642 \u0625\u0644\u064A\u0643`,
            data: { type: 'order_picked_up', orderId, role: 'customer' },
            sound: 'default'
          });
        }
      }
      break;
    }

    case 'arrived': {
      if (order.customerUid) {
        const token = await getUserPushToken(order.customerUid, accessToken);
        if (token) {
          messages.push({
            to: token,
            title: '\u0627\u0644\u0645\u0646\u062F\u0648\u0628 \u0648\u0635\u0644 \uD83D\uDCCD',
            body: `\u0627\u0644\u0645\u0646\u062F\u0648\u0628 \u0648\u0635\u0644 \u0644\u0645\u0648\u0642\u0639\u0643 \u0628\u0637\u0644\u0628\u0643 "${orderLabel}"`,
            data: { type: 'driver_arrived', orderId, role: 'customer' },
            sound: 'default'
          });
        }
      }
      break;
    }

    case 'delivered': {
      if (order.customerUid) {
        const customerToken = await getUserPushToken(order.customerUid, accessToken);
        if (customerToken) {
          messages.push({
            to: customerToken,
            title: '\u062A\u0645 \u0627\u0644\u062A\u0648\u0635\u064A\u0644 \u2705',
            body: `\u0637\u0644\u0628\u0643 "${orderLabel}" \u062A\u0645 \u062A\u0648\u0635\u064A\u0644\u0647 \u0628\u0646\u062C\u0627\u062D`,
            data: { type: 'order_delivered', orderId, role: 'customer' },
            sound: 'default'
          });
        }
      }
      if (order.providerUid) {
        const providerToken = await getUserPushToken(order.providerUid, accessToken);
        if (providerToken) {
          messages.push({
            to: providerToken,
            title: '\u062A\u0645 \u0627\u0644\u062A\u0648\u0635\u064A\u0644 \u2705',
            body: `\u0627\u0644\u0637\u0644\u0628 "${orderLabel}" \u062A\u0645 \u062A\u0648\u0635\u064A\u0644\u0647 \u0644\u0644\u0639\u0645\u064A\u0644 \u0628\u0646\u062C\u0627\u062D`,
            data: { type: 'order_delivered', orderId, role: 'provider' },
            sound: 'default'
          });
        }
      }
      break;
    }

    case 'self_pickup_completed': {
      if (order.customerUid) {
        const token = await getUserPushToken(order.customerUid, accessToken);
        if (token) {
          messages.push({
            to: token,
            title: '\u062A\u0645 \u062A\u0633\u0644\u064A\u0645 \u0627\u0644\u0637\u0644\u0628 \u2705',
            body: `\u0637\u0644\u0628\u0643 "${orderLabel}" \u062A\u0645 \u062A\u0633\u0644\u064A\u0645\u0647 \u0628\u0646\u062C\u0627\u062D`,
            data: { type: 'order_completed', orderId, role: 'customer' },
            sound: 'default'
          });
        }
      }
      break;
    }

    default:
      return { success: false, error: `Unknown event: ${event}` };
  }

  if (messages.length > 0) {
    await sendExpoPush(messages);
    console.log(`[Push] Sent ${messages.length} notifications for ${event} on order ${orderId}`);
  }

  return { success: true, notificationsSent: messages.length };
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, x-api-key'
        }
      });
    }

    const url = new URL(request.url);

    if (url.pathname === '/' && request.method === 'GET') {
      return Response.json({ status: 'ok', service: 'tabbakheen-push-api' });
    }

    if (url.pathname !== '/notify' || request.method !== 'POST') {
      return Response.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    const apiKey = request.headers.get('x-api-key');
    if (!apiKey || apiKey !== env.API_KEY) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const body = await request.json();
      const { event, orderId } = body;

      if (!event || !orderId) {
        return Response.json({ success: false, error: 'Missing event or orderId' }, { status: 400 });
      }

      console.log(`[Worker] Processing event: ${event} for order: ${orderId}`);

      const accessToken = await getAccessToken(env.FIREBASE_CLIENT_EMAIL, env.FIREBASE_PRIVATE_KEY);
      const result = await handleEvent(event, orderId, accessToken);

      return Response.json(result, {
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    } catch (e) {
      console.error('[Worker] Error:', e);
      return Response.json({ success: false, error: e.message || 'Internal error' }, {
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }
  }
};
