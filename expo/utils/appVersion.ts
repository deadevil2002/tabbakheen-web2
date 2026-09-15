import Constants from 'expo-constants';

/**
 * Prefer the version embedded in the installed native binary. The Expo
 * manifest is the compatible fallback for web/preview environments.
 */
export function getInstalledAppVersion(): string {
  const nativeVersion = Constants.nativeAppVersion?.trim();
  const manifestVersion = Constants.expoConfig?.version?.trim();
  return nativeVersion || manifestVersion || '—';
}