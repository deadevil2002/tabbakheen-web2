const CLOUD_NAME = 'dv6n9vnly';
const UPLOAD_PRESET = 'tabbakheen_upload';
const UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
}

export async function uploadImageToCloudinary(
  fileUri: string,
  folder: string = 'tabbakheen/providers',
): Promise<CloudinaryUploadResult> {
  console.log('[Cloudinary] Starting upload from URI:', fileUri, 'to folder:', folder);

  const formData = new FormData();

  const file = {
    uri: fileUri,
    type: 'image/jpeg',
    name: 'upload.jpg',
  } as unknown as Blob;

  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', folder);

  const response = await fetch(UPLOAD_URL, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.log('[Cloudinary] Upload failed:', response.status, errorText);
    throw new Error(`Cloudinary upload failed: ${response.status}`);
  }

  const data = await response.json();
  console.log('[Cloudinary] Upload success. public_id:', data.public_id);

  return {
    secure_url: data.secure_url,
    public_id: data.public_id,
  };
}

export async function uploadProviderAvatar(fileUri: string): Promise<string> {
  const result = await uploadImageToCloudinary(fileUri, 'tabbakheen/avatars');
  return result.secure_url;
}

export async function uploadOfferImage(fileUri: string): Promise<string> {
  const result = await uploadImageToCloudinary(fileUri, 'tabbakheen/offers');
  return result.secure_url;
}

export async function uploadVehicleImage(fileUri: string): Promise<string> {
  const result = await uploadImageToCloudinary(fileUri, 'tabbakheen/vehicles');
  return result.secure_url;
}

export async function uploadPaymentProof(fileUri: string): Promise<string> {
  const result = await uploadImageToCloudinary(fileUri, 'tabbakheen/payment_proofs');
  return result.secure_url;
}
