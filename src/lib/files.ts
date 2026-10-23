import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

// Receipt photos live only on the device, in the app's documents folder.
const receiptsDir = () => new Directory(Paths.document, 'receipts');

export function persistReceiptImage(cacheUri: string, id: string): string | null {
  if (Platform.OS === 'web') return null;
  try {
    const dir = receiptsDir();
    if (!dir.exists) dir.create({ intermediates: true });
    const dest = new File(dir, `${id}.jpg`);
    new File(cacheUri).copySync(dest);
    return dest.uri;
  } catch {
    return null;
  }
}

export function deleteReceiptImage(uri: string): void {
  if (Platform.OS === 'web') return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // Already gone; nothing to clean up.
  }
}

/** Writes a text file to the cache folder and returns its URI (native only). */
export function writeCacheFile(name: string, contents: string): string {
  const f = new File(Paths.cache, name);
  if (f.exists) f.delete();
  f.create();
  f.writeSync(contents);
  return f.uri;
}
