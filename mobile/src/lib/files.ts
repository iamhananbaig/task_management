import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';

import { api } from '@/lib/api';
import type { Attachment } from '@/lib/types';

export type PickedFile = { uri: string; name: string; type: string; webFile?: Blob };

/** Take a photo (e.g. a receipt or a signed document). */
export async function takePhoto(): Promise<PickedFile | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new Error('Allow camera access in Settings to take a photo.');
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, name: asset.fileName ?? `photo-${Date.now()}.jpg`, type: asset.mimeType ?? 'image/jpeg' };
}

export async function pickPhoto(): Promise<PickedFile | null> {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, name: asset.fileName ?? `image-${Date.now()}.jpg`, type: asset.mimeType ?? 'image/jpeg', webFile: asset.file };
}

/** PDF, Excel, Word and other documents. */
export async function pickDocument(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/octet-stream', webFile: asset.file };
}

/** POST /tasks/{id}/attachments as multipart form data. */
export async function uploadAttachment(taskId: number, file: PickedFile): Promise<void> {
  const form = new FormData();
  if (Platform.OS === 'web' && file.webFile) {
    form.append('file', file.webFile, file.name);
  } else {
    // React Native's FormData takes a { uri, name, type } descriptor for a local file
    form.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
  }
  await api.post(`/tasks/${taskId}/attachments`, form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120_000 });
}

/** Download an attachment with the sign-in token, then open it (Quick Look / viewer) or share it. */
export async function openAttachment(attachment: Attachment): Promise<void> {
  const url = `${api.defaults.baseURL}/attachments/${attachment.id}/download`;
  const authorization = String(api.defaults.headers.common.Authorization ?? '');

  if (Platform.OS === 'web') {
    const response = await fetch(url, { headers: { Authorization: authorization } });
    if (!response.ok) throw new Error('Could not download the file.');
    const blobUrl = URL.createObjectURL(await response.blob());
    window.open(blobUrl, '_blank');
    return;
  }

  const safeName = attachment.original_name.replace(/[^\w.\- ]+/g, '_');
  const destination = new File(Paths.cache, `${attachment.id}-${safeName}`);
  if (destination.exists) destination.delete();
  const file = await File.createDownloadTask(url, destination, { headers: { Authorization: authorization } }).downloadAsync();
  if (!file) throw new Error('The download was interrupted.');

  if (await File.canPreview(file)) {
    await file.preview({ title: attachment.original_name, mimeType: attachment.mime_type ?? undefined });
    return;
  }
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType: attachment.mime_type ?? undefined, dialogTitle: attachment.original_name });
  }
}
