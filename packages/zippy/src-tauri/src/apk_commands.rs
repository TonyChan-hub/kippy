use crate::apk::{self, ApkError, ApkReport, EntryPreview, UnpackResult};

#[tauri::command]
pub fn apk_analyze(path: String) -> Result<ApkReport, ApkError> {
    apk::analyze(&path)
}

#[tauri::command]
pub fn apk_unpack(path: String, dest: String) -> Result<UnpackResult, ApkError> {
    apk::unpack(&path, &dest)
}

#[tauri::command]
pub fn apk_read_entry(
    path: String,
    entry: String,
    max_bytes: Option<usize>,
) -> Result<EntryPreview, ApkError> {
    apk::read_entry(&path, &entry, max_bytes)
}
