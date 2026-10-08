import { invoke } from '@tauri-apps/api/core';
import type { ApkReport, EntryPreview, UnpackResult } from '../types/apk';

export const apkApi = {
  analyze: (path: string) => invoke<ApkReport>('apk_analyze', { path }),
  unpack: (path: string, dest: string) =>
    invoke<UnpackResult>('apk_unpack', { path, dest }),
  readEntry: (path: string, entry: string, maxBytes?: number | null) =>
    invoke<EntryPreview>('apk_read_entry', {
      path,
      entry,
      maxBytes: maxBytes ?? null,
    }),
};
