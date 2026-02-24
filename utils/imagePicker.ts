import * as ImagePicker from 'expo-image-picker';
import { Platform, Alert } from 'react-native';

export interface PickImageResult {
  uri: string;
  cancelled: false;
}

export async function pickImageFromGallery(): Promise<PickImageResult | null> {
  try {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        console.log('[ImagePicker] Permission denied');
        return null;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      console.log('[ImagePicker] User cancelled');
      return null;
    }

    console.log('[ImagePicker] Image selected:', result.assets[0].uri.substring(0, 60));
    return { uri: result.assets[0].uri, cancelled: false };
  } catch (e) {
    console.log('[ImagePicker] Error:', e);
    return null;
  }
}

export async function pickImageFreeAspect(): Promise<PickImageResult | null> {
  try {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        console.log('[ImagePicker] Permission denied');
        return null;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      console.log('[ImagePicker] User cancelled');
      return null;
    }

    console.log('[ImagePicker] Image selected:', result.assets[0].uri.substring(0, 60));
    return { uri: result.assets[0].uri, cancelled: false };
  } catch (e) {
    console.log('[ImagePicker] Error:', e);
    return null;
  }
}
