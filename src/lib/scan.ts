// Camera / photo library → resized JPEG → AI Worker → editable draft.
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import type { ReceiptResult } from '../../shared/schemas';
import { scanReceipt } from './api';
import { today } from './dates';
import { draftFromAI, type ReceiptDraft } from './receipt';

// Claude reads images up to ~1568px on the long edge without downscaling; bigger only costs more.
const MAX_EDGE = 1568;

export type PendingScan = { draft: ReceiptDraft; imageUri: string; raw: string; result: ReceiptResult };

// Hand-off between the AI tab and the review screen (kept in memory; nothing is written until Save).
const pending = new Map<string, PendingScan>();
export const takePendingScan = (id: string) => pending.get(id);
export const clearPendingScan = (id: string) => pending.delete(id);

export type PickSource = 'camera' | 'library';

export async function pickImage(source: PickSource): Promise<ImagePicker.ImagePickerAsset | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Camera access is off. Turn it on in Settings to scan receipts.');
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
  const result =
    source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled || !result.assets?.[0]) return null;
  return result.assets[0];
}

export async function prepareImage(asset: ImagePicker.ImagePickerAsset): Promise<{ uri: string; base64: string }> {
  const ctx = ImageManipulator.manipulate(asset.uri);
  const longEdge = Math.max(asset.width, asset.height);
  if (longEdge > MAX_EDGE) {
    ctx.resize(asset.width >= asset.height ? { width: MAX_EDGE } : { height: MAX_EDGE });
  }
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!saved.base64) throw new Error('Could not read the photo. Please try another one.');
  return { uri: saved.uri, base64: saved.base64 };
}

export async function runScan(
  asset: ImagePicker.ImagePickerAsset,
  ctx: { currency: string },
): Promise<{ id: string; trialRemaining: number | null }> {
  const { uri, base64 } = await prepareImage(asset);
  const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? 'en-US';
  const res = await scanReceipt({ image_base64: base64, media_type: 'image/jpeg', currency: ctx.currency, locale, today: today() });
  const id = `${Date.now()}`;
  pending.set(id, {
    draft: draftFromAI(res.receipt, { currency: ctx.currency, today: today() }),
    imageUri: uri,
    raw: res.raw,
    result: res.receipt,
  });
  return { id, trialRemaining: res.trialRemaining };
}
