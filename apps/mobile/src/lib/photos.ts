import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { notify } from './notify';

export type PickedImage = {
  uri: string;
  base64: string | null;
  mimeType: string | null;
};

function mapAsset(asset: ImagePicker.ImagePickerAsset): PickedImage {
  return {
    uri: asset.uri,
    base64: asset.base64 ?? null,
    mimeType: asset.mimeType ?? null,
  };
}

/**
 * Android 13+ opens the system photo picker and does not grant READ_MEDIA_IMAGES.
 * Treating a denied permission as a hard stop is why Gallery never opened.
 */
async function ensureLibrary(): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  if (Platform.OS === 'android' && Number(Platform.Version) >= 33) return true;
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (perm.granted || perm.accessPrivileges === 'limited') return true;
  notify('Permission needed', 'Allow photo library access to add a picture.');
  return false;
}

export async function pickFromLibrary(options?: {
  multiple?: boolean;
  limit?: number;
  aspect?: [number, number];
  /** Default: native crop when single + not web. Pass false for in-app Edit Image. */
  allowsEditing?: boolean;
}): Promise<PickedImage[]> {
  if (!(await ensureLibrary())) return [];
  const multiple = !!options?.multiple;
  const allowsEditing =
    options?.allowsEditing ?? (!multiple && Platform.OS !== 'web');
  const shared = {
    mediaTypes: ['images'] as ImagePicker.MediaType[],
    quality: 0.65,
    base64: true,
    exif: false,
    allowsMultipleSelection: multiple,
    selectionLimit: options?.limit ?? (multiple ? 4 : 1),
  };
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      ...shared,
      allowsEditing: allowsEditing && !multiple && Platform.OS !== 'web',
      aspect: options?.aspect,
    });
    if (result.canceled) return [];
    return result.assets.map(mapAsset);
  } catch (e) {
    console.warn('[photos] retry without crop', e);
    const result = await ImagePicker.launchImageLibraryAsync(shared);
    if (result.canceled) return [];
    return result.assets.map(mapAsset);
  }
}

export async function pickFromCamera(
  aspect?: [number, number],
  options?: { allowsEditing?: boolean }
): Promise<PickedImage | null> {
  const allowsEditing = options?.allowsEditing ?? true;
  if (Platform.OS === 'web') {
    const picked = await pickFromLibrary({ aspect, allowsEditing: false });
    return picked[0] ?? null;
  }
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    notify('Permission needed', 'Allow camera access to take a photo.');
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.65,
    base64: true,
    exif: false,
    allowsEditing,
    aspect,
  });
  if (result.canceled || !result.assets[0]) return null;
  return mapAsset(result.assets[0]);
}
