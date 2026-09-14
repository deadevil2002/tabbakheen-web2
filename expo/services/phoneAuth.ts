import { getFirebaseAuth } from './firebase';

const API_URL = 'https://tabbakheen-api.tabbakheen.workers.dev';

export interface PhoneAuthSettings {
  requirePhoneAtSignup: boolean;
  phonePasswordLoginEnabled: boolean;
}

const SAFE_DEFAULTS: PhoneAuthSettings = {
  requirePhoneAtSignup: true,
  phonePasswordLoginEnabled: false,
};

async function parseJson(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function getPhoneAuthSettings(): Promise<PhoneAuthSettings> {
  try {
    const response = await fetch(`${API_URL}/app-settings/auth`);
    const data = await parseJson(response);
    if (!response.ok || !data?.settings) return SAFE_DEFAULTS;
    return {
      requirePhoneAtSignup: data.settings.requirePhoneAtSignup !== false,
      phonePasswordLoginEnabled: data.settings.phonePasswordLoginEnabled === true,
    };
  } catch {
    return SAFE_DEFAULTS;
  }
}

export async function registerAuthoritativeProfile(profile: Record<string, unknown>): Promise<any> {
  const firebaseUser = getFirebaseAuth().currentUser;
  if (!firebaseUser) throw new Error('PROFILE_CREATE_FAILED');
  const idToken = await firebaseUser.getIdToken();
  const response = await fetch(`${API_URL}/profiles/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(profile),
  });
  const data = await parseJson(response);
  if (!response.ok || !data?.success) {
    if (data?.code === 'INVALID_PHONE') throw new Error('INVALID_PHONE');
    if (data?.code === 'PHONE_UNAVAILABLE') throw new Error('PHONE_UNAVAILABLE');
    throw new Error('PROFILE_CREATE_FAILED');
  }
  return data.profile;
}

export async function updateAuthoritativePhone(phone: string): Promise<string> {
  const firebaseUser = getFirebaseAuth().currentUser;
  if (!firebaseUser) throw new Error('PHONE_UPDATE_FAILED');
  const idToken = await firebaseUser.getIdToken();
  const response = await fetch(`${API_URL}/profiles/phone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify({ phone }),
  });
  const data = await parseJson(response);
  if (!response.ok || !data?.success || typeof data.phone !== 'string') {
    throw new Error(data?.code === 'PHONE_UNAVAILABLE' ? 'PHONE_UNAVAILABLE' : 'PHONE_UPDATE_FAILED');
  }
  return data.phone;
}

export async function getPhonePasswordCustomToken(phone: string, password: string): Promise<string> {
  const response = await fetch(`${API_URL}/auth/phone-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password }),
  });
  const data = await parseJson(response);
  if (!response.ok || !data?.success || typeof data.customToken !== 'string') {
    throw new Error(data?.code === 'INVALID_CREDENTIALS' ? 'INVALID_CREDENTIALS' : 'AUTH_ERROR');
  }
  return data.customToken;
}