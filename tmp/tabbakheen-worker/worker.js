const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1/projects/tabbakheen-99883/databases/(default)/documents';
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CLOUDINARY_CLOUD = 'dv6n9vnly';
const CLOUDINARY_PRESET = 'tabbakheen_upload';

// ============================================================
// FIRESTORE HELPERS (existing)
// ============================================================

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

// ============================================================
// NEW: Admin Firestore helpers
// ============================================================

function toFirestoreValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') {
    if (Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: value };
  }
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'object' && !Array.isArray(value)) {
    const fields = {};
    for (const [k, v] of Object.entries(value)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  return { stringValue: String(value) };
}

async function listAllUsers(accessToken) {
  const users = [];
  let pageToken = null;
  do {
    let url = `${FIRESTORE_BASE}/users?pageSize=300`;
    if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to list users: ${response.status} ${text}`);
    }
    const data = await response.json();
    if (data.documents) {
      for (const doc of data.documents) {
        const parsed = parseFirestoreDoc(doc);
        if (parsed) users.push(parsed);
      }
    }
    pageToken = data.nextPageToken || null;
  } while (pageToken);
  return users;
}

async function updateFirestoreDocument(collectionPath, docId, fields, accessToken) {
  const fieldPaths = Object.keys(fields);
  const maskParams = fieldPaths.map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join('&');
  const url = `${FIRESTORE_BASE}/${collectionPath}/${docId}?${maskParams}`;
  const firestoreFields = {};
  for (const [key, value] of Object.entries(fields)) {
    firestoreFields[key] = toFirestoreValue(value);
  }
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields: firestoreFields })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Firestore PATCH ${collectionPath}/${docId} failed: ${response.status} ${text}`);
  }
  return await response.json();
}

// ============================================================
// PUSH NOTIFICATION HELPERS (existing, unchanged)
// ============================================================

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

// ============================================================
// PUSH EVENT HANDLER (existing, unchanged)
// ============================================================

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

// ============================================================
// ADMIN AUTH
// ============================================================

async function createAdminToken(env) {
  const exp = Date.now() + 24 * 60 * 60 * 1000;
  const payload = btoa(JSON.stringify({ exp, r: Math.random().toString(36).slice(2) }));
  const secret = env.ADMIN_TOKEN_SECRET || env.ADMIN_PASSWORD;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${payload}.${sigB64}`;
}

async function verifyAdminToken(token, env) {
  try {
    if (!token) return false;
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const [payload, sigB64] = parts;
    const data = JSON.parse(atob(payload));
    if (Date.now() > data.exp) return false;
    const secret = env.ADMIN_TOKEN_SECRET || env.ADMIN_PASSWORD;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const normalizedSig = sigB64.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalizedSig + '='.repeat((4 - normalizedSig.length % 4) % 4);
    const sig = Uint8Array.from(atob(padded), c => c.charCodeAt(0));
    return await crypto.subtle.verify('HMAC', key, sig, new TextEncoder().encode(payload));
  } catch (e) {
    console.error('[Admin] Token verify error:', e);
    return false;
  }
}

function getTokenFromRequest(request) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    }
  });
}

// ============================================================
// ADMIN DASHBOARD HTML
// ============================================================

function getAdminHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Tabbakheen Admin</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--primary:#0d9488;--primary-dark:#0f766e;--bg:#f1f5f9;--sidebar:#0f172a;--sidebar-hover:#1e293b;--card:#fff;--text:#0f172a;--text2:#64748b;--text3:#94a3b8;--border:#e2e8f0;--success:#10b981;--warning:#f59e0b;--error:#ef4444;--info:#3b82f6;--orange:#e8722a;--radius:12px}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--text);min-height:100vh}
#login-view{display:flex;align-items:center;justify-content:center;min-height:100vh;background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%)}
.login-card{background:var(--card);border-radius:16px;padding:40px;width:380px;max-width:90vw;box-shadow:0 25px 50px rgba(0,0,0,0.25)}
.login-logo{text-align:center;margin-bottom:24px}
.login-logo h1{font-size:24px;color:var(--orange);margin-bottom:4px}
.login-logo p{color:var(--text2);font-size:14px}
.form-group{margin-bottom:16px}
.form-group label{display:block;font-size:13px;font-weight:600;color:var(--text2);margin-bottom:6px}
.form-group input,.form-group select,.form-group textarea{width:100%;padding:10px 14px;border:1.5px solid var(--border);border-radius:8px;font-size:14px;outline:none;transition:border .2s}
.form-group input:focus,.form-group select:focus,.form-group textarea:focus{border-color:var(--primary)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:10px 20px;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:all .15s}
.btn-primary{background:var(--primary);color:#fff}.btn-primary:hover{background:var(--primary-dark)}
.btn-success{background:var(--success);color:#fff}.btn-success:hover{opacity:.9}
.btn-warning{background:var(--warning);color:#fff}.btn-warning:hover{opacity:.9}
.btn-danger{background:var(--error);color:#fff}.btn-danger:hover{opacity:.9}
.btn-secondary{background:var(--border);color:var(--text)}.btn-secondary:hover{background:#cbd5e1}
.btn-sm{padding:6px 12px;font-size:12px;border-radius:6px}
.btn-block{width:100%;padding:12px}
.err-msg{background:#fef2f2;color:var(--error);padding:10px;border-radius:8px;font-size:13px;margin-bottom:12px;display:none}
#main-view{display:none}
.layout{display:flex;min-height:100vh}
.sidebar{width:240px;background:var(--sidebar);padding:20px 0;display:flex;flex-direction:column;position:fixed;top:0;left:0;bottom:0;z-index:100}
.sidebar-logo{padding:0 20px 24px;border-bottom:1px solid rgba(255,255,255,.08)}
.sidebar-logo h2{color:var(--orange);font-size:18px}
.sidebar-logo span{color:var(--text3);font-size:12px}
.sidebar-nav{flex:1;padding:16px 0}
.nav-item{display:flex;align-items:center;gap:10px;padding:10px 20px;color:var(--text3);font-size:14px;cursor:pointer;transition:all .15s;border-left:3px solid transparent}
.nav-item:hover{background:var(--sidebar-hover);color:#fff}
.nav-item.active{background:var(--sidebar-hover);color:#fff;border-left-color:var(--primary)}
.nav-item svg{width:18px;height:18px;flex-shrink:0}
.sidebar-footer{padding:16px 20px;border-top:1px solid rgba(255,255,255,.08)}
.sidebar-footer .nav-item{padding:10px 0}
.main{margin-left:240px;flex:1;padding:24px 32px;min-height:100vh}
.page-title{font-size:24px;font-weight:700;margin-bottom:24px}
.stats-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:16px;margin-bottom:32px}
.stat-card{background:var(--card);border-radius:var(--radius);padding:20px;border-top:4px solid var(--border);box-shadow:0 1px 3px rgba(0,0,0,.06)}
.stat-card .label{font-size:13px;color:var(--text2);margin-bottom:8px}
.stat-card .value{font-size:28px;font-weight:700}
.stat-card.blue{border-top-color:var(--info)}.stat-card.blue .value{color:var(--info)}
.stat-card.green{border-top-color:var(--success)}.stat-card.green .value{color:var(--success)}
.stat-card.orange{border-top-color:var(--orange)}.stat-card.orange .value{color:var(--orange)}
.stat-card.purple{border-top-color:#8b5cf6}.stat-card.purple .value{color:#8b5cf6}
.stat-card.amber{border-top-color:var(--warning)}.stat-card.amber .value{color:var(--warning)}
.stat-card.red{border-top-color:var(--error)}.stat-card.red .value{color:var(--error)}
.stat-card.teal{border-top-color:var(--primary)}.stat-card.teal .value{color:var(--primary)}
.filters{display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;align-items:center}
.filters select,.filters input{padding:8px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;outline:none;background:var(--card)}
.filters input{min-width:200px}
.table-wrap{background:var(--card);border-radius:var(--radius);overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)}
table{width:100%;border-collapse:collapse}
th{background:#f8fafc;padding:12px 16px;text-align:left;font-size:12px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid var(--border)}
td{padding:12px 16px;font-size:13px;border-bottom:1px solid #f1f5f9;vertical-align:middle}
tr:hover td{background:#f8fafc}
.badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600}
.badge-green{background:#d1fae5;color:#065f46}
.badge-blue{background:#dbeafe;color:#1e40af}
.badge-yellow{background:#fef3c7;color:#92400e}
.badge-red{background:#fee2e2;color:#991b1b}
.badge-gray{background:#f3f4f6;color:#374151}
.badge-purple{background:#ede9fe;color:#5b21b6}
.modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;align-items:center;justify-content:center}
.modal-overlay.show{display:flex}
.modal{background:var(--card);border-radius:16px;padding:28px;width:480px;max-width:92vw;max-height:90vh;overflow-y:auto;box-shadow:0 25px 50px rgba(0,0,0,.2)}
.modal h3{font-size:18px;margin-bottom:20px;padding-bottom:12px;border-bottom:1px solid var(--border)}
.modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px;padding-top:16px;border-top:1px solid var(--border)}
.toggle{display:flex;align-items:center;gap:10px;cursor:pointer}
.toggle input{width:18px;height:18px;accent-color:var(--primary)}
.settings-section{background:var(--card);border-radius:var(--radius);padding:24px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
.settings-section h3{font-size:16px;font-weight:600;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid var(--border)}
.banner-preview{width:100%;max-width:400px;aspect-ratio:16/7;object-fit:cover;border-radius:8px;border:1px solid var(--border);margin-bottom:12px;background:#f1f5f9}
.upload-row{display:flex;gap:10px;align-items:center;margin-bottom:12px}
.file-input{font-size:13px}
.loading{text-align:center;padding:40px;color:var(--text2)}
.empty{text-align:center;padding:40px;color:var(--text3)}
.user-info-row{display:flex;gap:8px;align-items:center;margin-bottom:4px}
.user-info-row .name{font-weight:600;color:var(--text)}
.user-info-row .email{color:var(--text2);font-size:12px}
.toast{position:fixed;top:20px;right:20px;padding:12px 20px;border-radius:8px;color:#fff;font-size:14px;font-weight:500;z-index:999;opacity:0;transform:translateY(-10px);transition:all .3s}
.toast.show{opacity:1;transform:translateY(0)}
.toast.success{background:var(--success)}.toast.error{background:var(--error)}
@media(max-width:768px){
  .sidebar{width:60px}.sidebar-logo h2,.sidebar-logo span,.nav-item span{display:none}.nav-item{justify-content:center;padding:12px}.main{margin-left:60px;padding:16px}
  .stats-grid{grid-template-columns:repeat(2,1fr)}.filters{flex-direction:column}.filters select,.filters input{width:100%}
}
</style>
</head>
<body>

<div id="login-view">
  <div class="login-card">
    <div class="login-logo">
      <h1>Tabbakheen</h1>
      <p>Admin Dashboard</p>
    </div>
    <div id="login-error" class="err-msg"></div>
    <div class="form-group">
      <label>Admin Password</label>
      <input type="password" id="login-password" placeholder="Enter admin password" onkeydown="if(event.key==='Enter')doLogin()">
    </div>
    <button class="btn btn-primary btn-block" onclick="doLogin()">Sign In</button>
  </div>
</div>

<div id="main-view">
  <div class="layout">
    <div class="sidebar">
      <div class="sidebar-logo">
        <h2>Tabbakheen</h2>
        <span>Admin Panel</span>
      </div>
      <div class="sidebar-nav">
        <div class="nav-item active" data-page="dashboard" onclick="navigate('dashboard')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          <span>Dashboard</span>
        </div>
        <div class="nav-item" data-page="users" onclick="navigate('users')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span>Users</span>
        </div>
        <div class="nav-item" data-page="settings" onclick="navigate('settings')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          <span>Settings</span>
        </div>
      </div>
      <div class="sidebar-footer">
        <div class="nav-item" onclick="doLogout()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          <span>Logout</span>
        </div>
      </div>
    </div>
    <div class="main">
      <div id="page-content"></div>
    </div>
  </div>
</div>

<div id="modal-overlay" class="modal-overlay" onclick="if(event.target===this)closeModal()">
  <div class="modal" id="modal-content"></div>
</div>

<div id="toast" class="toast"></div>

<script>
let TOKEN = sessionStorage.getItem('tbk_admin_token');
let currentPage = 'dashboard';
let allUsers = [];
let appSettings = {};

async function api(path, opts = {}) {
  const res = await fetch('/admin/api' + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + TOKEN,
      ...(opts.headers || {})
    }
  });
  if (res.status === 401) {
    sessionStorage.removeItem('tbk_admin_token');
    TOKEN = null;
    showLogin();
    return null;
  }
  return res.json();
}

function showLogin() {
  document.getElementById('login-view').style.display = 'flex';
  document.getElementById('main-view').style.display = 'none';
}

function showMain() {
  document.getElementById('login-view').style.display = 'none';
  document.getElementById('main-view').style.display = 'block';
  navigate('dashboard');
}

async function doLogin() {
  const pw = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  if (!pw) { errEl.textContent = 'Please enter password'; errEl.style.display = 'block'; return; }
  errEl.style.display = 'none';
  try {
    const res = await fetch('/admin/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw })
    });
    const data = await res.json();
    if (data.token) {
      TOKEN = data.token;
      sessionStorage.setItem('tbk_admin_token', TOKEN);
      showMain();
    } else {
      errEl.textContent = data.error || 'Invalid password';
      errEl.style.display = 'block';
    }
  } catch (e) {
    errEl.textContent = 'Connection error';
    errEl.style.display = 'block';
  }
}

function doLogout() {
  TOKEN = null;
  sessionStorage.removeItem('tbk_admin_token');
  showLogin();
}

function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  renderPage();
}

function toast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => t.className = 'toast', 3000);
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('show');
}

function openModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-overlay').classList.add('show');
}

function roleBadge(role) {
  const m = { customer: 'blue', provider: 'orange', driver: 'purple' };
  const l = { customer: 'Customer', provider: 'Provider', driver: 'Driver' };
  return '<span class="badge badge-' + (m[role]||'gray') + '">' + (l[role]||role) + '</span>';
}

function statusBadge(status) {
  const m = { active: 'green', trial: 'yellow', suspended: 'yellow', disabled: 'red' };
  return '<span class="badge badge-' + (m[status]||'gray') + '">' + (status||'N/A') + '</span>';
}

function subBadge(status) {
  const m = { active: 'green', trialing: 'blue', expired: 'red', canceled: 'gray', past_due: 'yellow' };
  return '<span class="badge badge-' + (m[status]||'gray') + '">' + (status||'N/A') + '</span>';
}

async function renderPage() {
  const c = document.getElementById('page-content');
  c.innerHTML = '<div class="loading">Loading...</div>';
  try {
    if (currentPage === 'dashboard') await renderDashboard(c);
    else if (currentPage === 'users') await renderUsers(c);
    else if (currentPage === 'settings') await renderSettings(c);
  } catch (e) {
    c.innerHTML = '<div class="empty">Error: ' + e.message + '</div>';
  }
}

async function renderDashboard(c) {
  const data = await api('/stats');
  if (!data) return;
  const s = data.stats;
  c.innerHTML = '<h1 class="page-title">Dashboard</h1>' +
    '<div class="stats-grid">' +
    statCard('Total Users', s.totalUsers, 'blue') +
    statCard('Customers', s.customers, 'green') +
    statCard('Providers', s.providers, 'orange') +
    statCard('Drivers', s.drivers, 'purple') +
    statCard('Providers in Trial', s.providersInTrial, 'amber') +
    statCard('Drivers in Trial', s.driversInTrial, 'amber') +
    statCard('Suspended', s.suspendedAccounts, 'red') +
    statCard('Active Subs', s.activeSubscriptions, 'teal') +
    '</div>';
}

function statCard(label, value, color) {
  return '<div class="stat-card ' + color + '"><div class="label">' + label + '</div><div class="value">' + (value||0) + '</div></div>';
}

async function renderUsers(c) {
  const data = await api('/users');
  if (!data) return;
  allUsers = data.users || [];
  c.innerHTML = '<h1 class="page-title">Users (' + allUsers.length + ')</h1>' +
    '<div class="filters">' +
    '<select id="f-role" onchange="filterUsers()"><option value="">All Roles</option><option value="customer">Customer</option><option value="provider">Provider</option><option value="driver">Driver</option></select>' +
    '<select id="f-status" onchange="filterUsers()"><option value="">All Status</option><option value="active">Active</option><option value="trial">Trial</option><option value="suspended">Suspended</option><option value="disabled">Disabled</option></select>' +
    '<select id="f-sub" onchange="filterUsers()"><option value="">All Subscriptions</option><option value="trialing">Trialing</option><option value="active">Active</option><option value="expired">Expired</option><option value="canceled">Canceled</option><option value="past_due">Past Due</option></select>' +
    '<input type="text" id="f-search" placeholder="Search name, email, phone..." oninput="filterUsers()">' +
    '</div>' +
    '<div class="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Account</th><th>Subscription</th><th>Created</th><th>Actions</th></tr></thead><tbody id="users-tbody"></tbody></table></div>';
  filterUsers();
}

function filterUsers() {
  const role = document.getElementById('f-role')?.value || '';
  const status = document.getElementById('f-status')?.value || '';
  const sub = document.getElementById('f-sub')?.value || '';
  const search = (document.getElementById('f-search')?.value || '').toLowerCase();
  let filtered = allUsers;
  if (role) filtered = filtered.filter(u => u.role === role);
  if (status) filtered = filtered.filter(u => u.accountStatus === status);
  if (sub) filtered = filtered.filter(u => u.subscriptionStatus === sub);
  if (search) filtered = filtered.filter(u =>
    (u.displayName||'').toLowerCase().includes(search) ||
    (u.email||'').toLowerCase().includes(search) ||
    (u.phone||'').includes(search)
  );
  const tbody = document.getElementById('users-tbody');
  if (!tbody) return;
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty">No users found</td></tr>';
    return;
  }
  tbody.innerHTML = filtered.map(u => {
    const created = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A';
    return '<tr>' +
      '<td><div class="user-info-row"><span class="name">' + esc(u.displayName||'No name') + '</span></div><div class="user-info-row"><span class="email">' + esc(u.email||'') + '</span></div></td>' +
      '<td>' + roleBadge(u.role) + '</td>' +
      '<td>' + statusBadge(u.accountStatus) + '</td>' +
      '<td>' + subBadge(u.subscriptionStatus) + '</td>' +
      '<td style="font-size:12px;color:var(--text2)">' + created + '</td>' +
      '<td><button class="btn btn-sm btn-primary" onclick="editUser(\\'' + u._id + '\\')">Edit</button></td>' +
      '</tr>';
  }).join('');
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function editUser(uid) {
  const u = allUsers.find(x => x._id === uid);
  if (!u) return;
  const trialDate = u.trialEndsAt ? u.trialEndsAt.split('T')[0] : '';
  const subDate = u.subscriptionEndsAt ? u.subscriptionEndsAt.split('T')[0] : '';
  openModal(
    '<h3>Edit User: ' + esc(u.displayName || u.email || uid) + '</h3>' +
    '<div style="margin-bottom:12px;font-size:13px;color:var(--text2)">UID: ' + uid + '<br>Role: ' + (u.role||'N/A') + ' | Email: ' + esc(u.email||'') + '</div>' +
    '<div class="form-group"><label>Account Status</label><select id="eu-accountStatus"><option value="">-- Not Set --</option><option value="active"' + (u.accountStatus==='active'?' selected':'') + '>Active</option><option value="trial"' + (u.accountStatus==='trial'?' selected':'') + '>Trial</option><option value="suspended"' + (u.accountStatus==='suspended'?' selected':'') + '>Suspended</option><option value="disabled"' + (u.accountStatus==='disabled'?' selected':'') + '>Disabled</option></select></div>' +
    '<div class="form-group"><label>Subscription Status</label><select id="eu-subscriptionStatus"><option value="">-- Not Set --</option><option value="trialing"' + (u.subscriptionStatus==='trialing'?' selected':'') + '>Trialing</option><option value="active"' + (u.subscriptionStatus==='active'?' selected':'') + '>Active</option><option value="expired"' + (u.subscriptionStatus==='expired'?' selected':'') + '>Expired</option><option value="canceled"' + (u.subscriptionStatus==='canceled'?' selected':'') + '>Canceled</option><option value="past_due"' + (u.subscriptionStatus==='past_due'?' selected':'') + '>Past Due</option></select></div>' +
    '<div class="form-group"><label>Subscription Plan</label><input id="eu-subscriptionPlan" value="' + esc(u.subscriptionPlan||'') + '" placeholder="e.g. tabbakheen_basic"></div>' +
    '<div class="form-group"><label>Trial Ends At</label><input type="date" id="eu-trialEndsAt" value="' + trialDate + '"></div>' +
    '<div class="form-group"><label>Subscription Ends At</label><input type="date" id="eu-subscriptionEndsAt" value="' + subDate + '"></div>' +
    '<div class="form-group"><label class="toggle"><input type="checkbox" id="eu-activatedByAdmin"' + (u.activatedByAdmin?' checked':'') + '> Activated by Admin</label></div>' +
    '<div class="form-group"><label>Disabled Reason</label><textarea id="eu-disabledReason" rows="2" placeholder="Reason for disabling...">' + esc(u.disabledReason||'') + '</textarea></div>' +
    '<div class="modal-actions">' +
    '<button class="btn btn-secondary" onclick="closeModal()">Cancel</button>' +
    '<button class="btn btn-success" onclick="quickAction(\\'' + uid + '\\',\\'activate\\')">Activate</button>' +
    '<button class="btn btn-warning" onclick="quickAction(\\'' + uid + '\\',\\'suspend\\')">Suspend</button>' +
    '<button class="btn btn-primary" onclick="saveUser(\\'' + uid + '\\')">Save Changes</button>' +
    '</div>'
  );
}

async function quickAction(uid, action) {
  let fields = {};
  if (action === 'activate') {
    fields = { accountStatus: 'active', subscriptionStatus: 'active', activatedByAdmin: true, disabledReason: '' };
  } else if (action === 'suspend') {
    fields = { accountStatus: 'suspended' };
  }
  const data = await api('/users/' + uid + '/update', { method: 'POST', body: JSON.stringify(fields) });
  if (data && data.success) {
    toast('User updated successfully');
    closeModal();
    renderPage();
  } else {
    toast(data?.error || 'Failed to update user', 'error');
  }
}

async function saveUser(uid) {
  const fields = {};
  const accountStatus = document.getElementById('eu-accountStatus').value;
  const subscriptionStatus = document.getElementById('eu-subscriptionStatus').value;
  const subscriptionPlan = document.getElementById('eu-subscriptionPlan').value;
  const trialEndsAt = document.getElementById('eu-trialEndsAt').value;
  const subscriptionEndsAt = document.getElementById('eu-subscriptionEndsAt').value;
  const activatedByAdmin = document.getElementById('eu-activatedByAdmin').checked;
  const disabledReason = document.getElementById('eu-disabledReason').value;

  if (accountStatus) fields.accountStatus = accountStatus;
  if (subscriptionStatus) fields.subscriptionStatus = subscriptionStatus;
  if (subscriptionPlan) fields.subscriptionPlan = subscriptionPlan;
  if (trialEndsAt) fields.trialEndsAt = new Date(trialEndsAt).toISOString();
  if (subscriptionEndsAt) fields.subscriptionEndsAt = new Date(subscriptionEndsAt).toISOString();
  fields.activatedByAdmin = activatedByAdmin;
  if (disabledReason) fields.disabledReason = disabledReason;
  else fields.disabledReason = '';

  if (Object.keys(fields).length === 0) { toast('No changes to save', 'error'); return; }

  const data = await api('/users/' + uid + '/update', { method: 'POST', body: JSON.stringify(fields) });
  if (data && data.success) {
    toast('User saved successfully');
    closeModal();
    renderPage();
  } else {
    toast(data?.error || 'Failed to save', 'error');
  }
}

async function renderSettings(c) {
  const data = await api('/settings');
  if (!data) return;
  appSettings = data.settings || {};
  const bannerUrl = appSettings.bannerImageUrl || '';
  const bannerEnabled = appSettings.bannerEnabled !== false;
  c.innerHTML = '<h1 class="page-title">App Settings</h1>' +
    '<div class="settings-section"><h3>Home Banner</h3>' +
    (bannerUrl ? '<img class="banner-preview" src="' + esc(bannerUrl) + '" alt="Banner">' : '<div class="banner-preview" style="display:flex;align-items:center;justify-content:center;color:var(--text3)">No banner set</div>') +
    '<div class="upload-row"><input type="file" id="banner-file" accept="image/*" class="file-input"><button class="btn btn-sm btn-primary" onclick="uploadBanner()">Upload</button></div>' +
    '<div class="form-group"><label>Banner Image URL</label><input id="s-bannerImageUrl" value="' + esc(bannerUrl) + '" placeholder="https://..."></div>' +
    '<div class="form-group"><label class="toggle"><input type="checkbox" id="s-bannerEnabled"' + (bannerEnabled?' checked':'') + '> Banner Enabled</label></div>' +
    '</div>' +
    '<div class="settings-section"><h3>Support Contact</h3>' +
    '<div class="form-group"><label>Support Email</label><input id="s-supportEmail" value="' + esc(appSettings.supportEmail||'') + '" placeholder="support@example.com"></div>' +
    '<div class="form-group"><label>Support WhatsApp</label><input id="s-supportWhatsapp" value="' + esc(appSettings.supportWhatsapp||'') + '" placeholder="966500000000"></div>' +
    '</div>' +
    '<div class="settings-section"><h3>Delivery Pricing</h3>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
    '<div class="form-group"><label>Base Fee (SAR)</label><input type="number" id="s-baseFee" value="' + (appSettings.deliveryPricing?.baseFee||15) + '"></div>' +
    '<div class="form-group"><label>Per KM (City)</label><input type="number" step="0.5" id="s-perKmCity" value="' + (appSettings.deliveryPricing?.perKmInsideCity||2) + '"></div>' +
    '<div class="form-group"><label>Per KM (Outside)</label><input type="number" step="0.5" id="s-perKmOut" value="' + (appSettings.deliveryPricing?.perKmOutsideCity||3) + '"></div>' +
    '<div class="form-group"><label>Max Fee (SAR)</label><input type="number" id="s-maxFee" value="' + (appSettings.deliveryPricing?.maxFee||50) + '"></div>' +
    '</div></div>' +
    '<button class="btn btn-primary" onclick="saveSettings()">Save Settings</button>';
}

async function uploadBanner() {
  const fileInput = document.getElementById('banner-file');
  if (!fileInput.files.length) { toast('Select a file first', 'error'); return; }
  const file = fileInput.files[0];
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', '${CLOUDINARY_PRESET}');
  formData.append('folder', 'tabbakheen/banners');
  toast('Uploading...');
  try {
    const res = await fetch('https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.secure_url) {
      document.getElementById('s-bannerImageUrl').value = data.secure_url;
      toast('Image uploaded successfully');
    } else {
      toast('Upload failed: ' + (data.error?.message || 'Unknown error'), 'error');
    }
  } catch (e) {
    toast('Upload error: ' + e.message, 'error');
  }
}

async function saveSettings() {
  const fields = {
    bannerImageUrl: document.getElementById('s-bannerImageUrl').value,
    bannerEnabled: document.getElementById('s-bannerEnabled').checked,
    supportEmail: document.getElementById('s-supportEmail').value,
    supportWhatsapp: document.getElementById('s-supportWhatsapp').value,
    deliveryPricing: {
      currency: 'SAR',
      baseFee: parseFloat(document.getElementById('s-baseFee').value) || 15,
      perKmInsideCity: parseFloat(document.getElementById('s-perKmCity').value) || 2,
      perKmOutsideCity: parseFloat(document.getElementById('s-perKmOut').value) || 3,
      maxFee: parseFloat(document.getElementById('s-maxFee').value) || 50
    }
  };
  const data = await api('/settings', { method: 'POST', body: JSON.stringify(fields) });
  if (data && data.success) {
    toast('Settings saved successfully');
    renderPage();
  } else {
    toast(data?.error || 'Failed to save settings', 'error');
  }
}

// Init
if (TOKEN) {
  api('/stats').then(d => {
    if (d) showMain(); else showLogin();
  }).catch(() => showLogin());
} else {
  showLogin();
}
</script>
</body>
</html>`;
}

// ============================================================
// MAIN WORKER HANDLER
// ============================================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, x-api-key, Authorization'
        }
      });
    }

    // ---- Health check ----
    if (path === '/' && request.method === 'GET') {
      return Response.json({ status: 'ok', service: 'tabbakheen-api', admin: true });
    }

    // ============================================================
    // ADMIN ROUTES
    // ============================================================

    // Serve admin dashboard HTML
    if (path === '/admin' || path === '/admin/') {
      return new Response(getAdminHTML(), {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
      });
    }

    // Admin login
    if (path === '/admin/api/login' && request.method === 'POST') {
      try {
        const body = await request.json();
        if (!body.password || body.password !== env.ADMIN_PASSWORD) {
          return jsonResponse({ error: 'Invalid password' }, 401);
        }
        const token = await createAdminToken(env);
        console.log('[Admin] Login successful');
        return jsonResponse({ success: true, token });
      } catch (e) {
        console.error('[Admin] Login error:', e);
        return jsonResponse({ error: 'Login failed' }, 500);
      }
    }

    // All other admin API routes require auth
    if (path.startsWith('/admin/api/')) {
      const token = getTokenFromRequest(request);
      const valid = await verifyAdminToken(token, env);
      if (!valid) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }

      try {
        const accessToken = await getAccessToken(env.FIREBASE_CLIENT_EMAIL, env.FIREBASE_PRIVATE_KEY);

        // Stats
        if (path === '/admin/api/stats' && request.method === 'GET') {
          const users = await listAllUsers(accessToken);
          const stats = {
            totalUsers: users.length,
            customers: users.filter(u => u.role === 'customer').length,
            providers: users.filter(u => u.role === 'provider').length,
            drivers: users.filter(u => u.role === 'driver').length,
            providersInTrial: users.filter(u => u.role === 'provider' && (u.accountStatus === 'trial' || u.subscriptionStatus === 'trialing')).length,
            driversInTrial: users.filter(u => u.role === 'driver' && (u.accountStatus === 'trial' || u.subscriptionStatus === 'trialing')).length,
            suspendedAccounts: users.filter(u => u.accountStatus === 'suspended' || u.accountStatus === 'disabled').length,
            activeSubscriptions: users.filter(u => u.subscriptionStatus === 'active').length,
          };
          console.log('[Admin] Stats:', JSON.stringify(stats));
          return jsonResponse({ success: true, stats });
        }

        // List users
        if (path === '/admin/api/users' && request.method === 'GET') {
          const users = await listAllUsers(accessToken);
          console.log('[Admin] Listed', users.length, 'users');
          return jsonResponse({ success: true, users });
        }

        // Update user
        const userUpdateMatch = path.match(/^\/admin\/api\/users\/([^/]+)\/update$/);
        if (userUpdateMatch && request.method === 'POST') {
          const uid = userUpdateMatch[1];
          const body = await request.json();
          const allowed = [
            'accountStatus', 'subscriptionStatus', 'subscriptionPlan',
            'trialEndsAt', 'subscriptionEndsAt', 'activatedByAdmin',
            'disabledReason', 'approvedByAdmin', 'isApproved', 'disabledAt'
          ];
          const fields = {};
          for (const key of allowed) {
            if (key in body) fields[key] = body[key];
          }
          if (Object.keys(fields).length === 0) {
            return jsonResponse({ error: 'No valid fields' }, 400);
          }
          console.log('[Admin] Updating user', uid, 'fields:', Object.keys(fields).join(', '));
          await updateFirestoreDocument('users', uid, fields, accessToken);
          console.log('[Admin] User updated:', uid);
          return jsonResponse({ success: true, updated: Object.keys(fields) });
        }

        // Get settings
        if (path === '/admin/api/settings' && request.method === 'GET') {
          const settings = await getFirestoreDoc('app_settings', 'main', accessToken);
          console.log('[Admin] Settings loaded:', settings ? 'found' : 'not found');
          return jsonResponse({ success: true, settings: settings || {} });
        }

        // Update settings
        if (path === '/admin/api/settings' && request.method === 'POST') {
          const body = await request.json();
          const allowedSettings = [
            'bannerImageUrl', 'bannerEnabled', 'supportEmail', 'supportWhatsapp', 'deliveryPricing'
          ];
          const fields = {};
          for (const key of allowedSettings) {
            if (key in body) fields[key] = body[key];
          }
          if (Object.keys(fields).length === 0) {
            return jsonResponse({ error: 'No valid settings fields' }, 400);
          }
          console.log('[Admin] Updating settings, fields:', Object.keys(fields).join(', '));
          await updateFirestoreDocument('app_settings', 'main', fields, accessToken);
          console.log('[Admin] Settings updated');
          return jsonResponse({ success: true, updated: Object.keys(fields) });
        }

        return jsonResponse({ error: 'Admin endpoint not found' }, 404);

      } catch (e) {
        console.error('[Admin] API error:', e);
        return jsonResponse({ error: e.message || 'Internal error' }, 500);
      }
    }

    // ============================================================
    // EXISTING API ROUTES (unchanged)
    // ============================================================

    const apiKey = request.headers.get('x-api-key');
    if (!apiKey || apiKey !== env.API_KEY) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401, headers: { 'Access-Control-Allow-Origin': '*' } });
    }

    // Push notification
    if (path === '/notify' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { event, orderId } = body;
        if (!event || !orderId) {
          return Response.json({ success: false, error: 'Missing event or orderId' }, { status: 400 });
        }
        console.log(`[Worker] Processing event: ${event} for order: ${orderId}`);
        const accessToken = await getAccessToken(env.FIREBASE_CLIENT_EMAIL, env.FIREBASE_PRIVATE_KEY);
        const result = await handleEvent(event, orderId, accessToken);
        return Response.json(result, { headers: { 'Access-Control-Allow-Origin': '*' } });
      } catch (e) {
        console.error('[Worker] Error:', e);
        return Response.json({ success: false, error: e.message || 'Internal error' }, {
          status: 500,
          headers: { 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    // Rating aggregation
    if (path === '/aggregate-rating' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { type, uid } = body;
        if (!type || !uid || !['provider', 'driver'].includes(type)) {
          return Response.json({ success: false, error: 'Missing or invalid type/uid' }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        console.log(`[Worker] Aggregating ${type} rating for ${uid}`);
        const accessToken = await getAccessToken(env.FIREBASE_CLIENT_EMAIL, env.FIREBASE_PRIVATE_KEY);
        const collectionPath = type === 'provider' ? 'provider_ratings' : 'driver_ratings';
        const ratingsUrl = `${FIRESTORE_BASE}/${collectionPath}/${uid}/ratings`;
        const ratingsResponse = await fetch(ratingsUrl, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        let ratings = [];
        if (ratingsResponse.ok) {
          const ratingsData = await ratingsResponse.json();
          if (ratingsData.documents) {
            ratings = ratingsData.documents.map(doc => parseFirestoreDoc(doc)).filter(Boolean);
          }
        }
        const count = ratings.length;
        const avg = count > 0 ? ratings.reduce((sum, r) => sum + (r.stars || 0), 0) / count : 0;
        const roundedAvg = Math.round(avg * 10) / 10;
        console.log(`[Worker] ${type} ${uid}: ${count} ratings, avg ${roundedAvg}`);
        const updateUrl = `${FIRESTORE_BASE}/users/${uid}?updateMask.fieldPaths=ratingAverage&updateMask.fieldPaths=ratingCount`;
        const updateResponse = await fetch(updateUrl, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fields: {
              ratingAverage: { doubleValue: roundedAvg },
              ratingCount: { integerValue: String(count) }
            }
          })
        });
        if (!updateResponse.ok) {
          const errText = await updateResponse.text();
          console.error(`[Worker] Failed to update user rating: ${errText}`);
          return Response.json({ success: false, error: 'Failed to update user rating' }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
        }
        console.log(`[Worker] Updated ${type} ${uid} rating: avg=${roundedAvg}, count=${count}`);
        return Response.json({ success: true, ratingAverage: roundedAvg, ratingCount: count }, {
          headers: { 'Access-Control-Allow-Origin': '*' }
        });
      } catch (e) {
        console.error('[Worker] Aggregate rating error:', e);
        return Response.json({ success: false, error: e.message || 'Internal error' }, {
          status: 500,
          headers: { 'Access-Control-Allow-Origin': '*' }
        });
      }
    }

    return Response.json({ success: false, error: 'Not found' }, { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
  }
};
