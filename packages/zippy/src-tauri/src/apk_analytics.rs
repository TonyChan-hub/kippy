//! Package size breakdown, DEX optimization, obfuscation & shrink heuristics.

use crate::apk::{ApkEntry, ApkError};
use serde::Serialize;
use std::io::Read;
use std::path::Path;
use zip::ZipArchive;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SizeAnalysis {
    pub file_size_bytes: u64,
    pub total_uncompressed: u64,
    pub total_compressed: u64,
    /// ZIP 压缩带来的体积缩减百分比：(1 - compressed/uncompressed) * 100
    pub zip_shrink_pct: f64,
    pub categories: Vec<SizeCategory>,
    pub top_entries: Vec<SizeEntryShare>,
    pub dex: DexAnalysis,
    pub obfuscation: ObfuscationAnalysis,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SizeCategory {
    pub id: String,
    pub label: String,
    pub uncompressed: u64,
    pub compressed: u64,
    pub file_count: usize,
    /// 占解压体积百分比
    pub install_pct: f64,
    /// 占压缩体积百分比（近似下载体积）
    pub download_pct: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SizeEntryShare {
    pub path: String,
    pub uncompressed: u64,
    pub compressed: u64,
    pub install_pct: f64,
    pub category: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DexAnalysis {
    pub file_count: usize,
    pub total_size: u64,
    pub classes: u32,
    pub methods: u32,
    pub fields: u32,
    pub strings: u32,
    pub proto_ids: u32,
    pub has_debug_info: bool,
    pub debug_info_items: u32,
    /// 是否具备 R8/D8 优化特征（无 debug info + 高混淆等）
    pub optimized: bool,
    pub optimization_score_pct: f64,
    pub notes: Vec<String>,
    pub files: Vec<DexFileStats>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DexFileStats {
    pub path: String,
    pub size: u64,
    pub version: String,
    pub classes: u32,
    pub methods: u32,
    pub fields: u32,
    pub strings: u32,
    pub has_debug_info: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ObfuscationAnalysis {
    /// 类名混淆百分比
    pub obfuscation_pct: f64,
    pub obfuscated_classes: u32,
    pub readable_classes: u32,
    pub total_classes: u32,
    /// 综合缩减估计：ZIP 压缩 + 代码侧启发式
    pub shrink_pct: f64,
    pub zip_shrink_pct: f64,
    pub code_shrink_hint_pct: f64,
    pub samples_obfuscated: Vec<String>,
    pub samples_readable: Vec<String>,
    pub notes: Vec<String>,
}

pub fn analyze_size(
    path: &Path,
    entries: &[ApkEntry],
    file_size_bytes: u64,
) -> Result<SizeAnalysis, ApkError> {
    let total_uncompressed: u64 = entries.iter().map(|e| e.size).sum();
    let total_compressed: u64 = entries.iter().map(|e| e.compressed_size).sum();
    let zip_shrink_pct = shrink_pct(total_uncompressed, total_compressed);

    let categories = build_categories(entries, total_uncompressed, total_compressed);
    let top_entries = build_top_entries(entries, total_uncompressed);
    let (dex, class_names) = analyze_dex_files(path, entries)?;
    let obfuscation = build_obfuscation(&dex, &class_names, zip_shrink_pct);

    Ok(SizeAnalysis {
        file_size_bytes,
        total_uncompressed,
        total_compressed,
        zip_shrink_pct: round2(zip_shrink_pct),
        categories,
        top_entries,
        dex,
        obfuscation,
    })
}

fn build_categories(
    entries: &[ApkEntry],
    total_uncompressed: u64,
    total_compressed: u64,
) -> Vec<SizeCategory> {
    let mut buckets: Vec<(&str, &str, u64, u64, usize)> = vec![
        ("dex", "DEX / 代码", 0, 0, 0),
        ("native", "Native (.so)", 0, 0, 0),
        ("resources", "Resources (res)", 0, 0, 0),
        ("assets", "Assets", 0, 0, 0),
        ("manifest", "Manifest", 0, 0, 0),
        ("arsc", "resources.arsc", 0, 0, 0),
        ("meta", "META-INF / 签名", 0, 0, 0),
        ("other", "Other", 0, 0, 0),
    ];

    for entry in entries {
        let id = categorize(&entry.path);
        if let Some(bucket) = buckets.iter_mut().find(|b| b.0 == id) {
            bucket.2 += entry.size;
            bucket.3 += entry.compressed_size;
            bucket.4 += 1;
        }
    }

    buckets
        .into_iter()
        .filter(|b| b.4 > 0)
        .map(|(id, label, uncompressed, compressed, file_count)| SizeCategory {
            id: id.into(),
            label: label.into(),
            uncompressed,
            compressed,
            file_count,
            install_pct: round2(pct(uncompressed, total_uncompressed)),
            download_pct: round2(pct(compressed, total_compressed)),
        })
        .collect()
}

fn build_top_entries(entries: &[ApkEntry], total_uncompressed: u64) -> Vec<SizeEntryShare> {
    let mut sorted: Vec<&ApkEntry> = entries.iter().collect();
    sorted.sort_by(|a, b| b.size.cmp(&a.size));
    sorted
        .into_iter()
        .take(25)
        .map(|e| SizeEntryShare {
            path: e.path.clone(),
            uncompressed: e.size,
            compressed: e.compressed_size,
            install_pct: round2(pct(e.size, total_uncompressed)),
            category: categorize(&e.path).into(),
        })
        .collect()
}

fn categorize(path: &str) -> &'static str {
    let lower = path.to_ascii_lowercase();
    if lower.ends_with(".dex") {
        "dex"
    } else if lower.ends_with(".so") || lower.contains("/lib/") {
        "native"
    } else if lower.ends_with("resources.arsc") || lower.ends_with("/resources.pb") {
        "arsc"
    } else if lower.ends_with("androidmanifest.xml") {
        "manifest"
    } else if lower.contains("/assets/") || lower.starts_with("assets/") {
        "assets"
    } else if lower.contains("/res/") || lower.starts_with("res/") {
        "resources"
    } else if lower.starts_with("meta-inf/") {
        "meta"
    } else {
        "other"
    }
}

fn analyze_dex_files(
    path: &Path,
    entries: &[ApkEntry],
) -> Result<(DexAnalysis, Vec<String>), ApkError> {
    let dex_entries: Vec<&ApkEntry> = entries.iter().filter(|e| e.path.ends_with(".dex")).collect();
    if dex_entries.is_empty() {
        return Ok((
            DexAnalysis {
                file_count: 0,
                total_size: 0,
                classes: 0,
                methods: 0,
                fields: 0,
                strings: 0,
                proto_ids: 0,
                has_debug_info: false,
                debug_info_items: 0,
                optimized: false,
                optimization_score_pct: 0.0,
                notes: vec!["No DEX files found.".into()],
                files: vec![],
            },
            vec![],
        ));
    }

    let file = std::fs::File::open(path)
        .map_err(|e| ApkError::Message(format!("open package failed: {e}")))?;
    let mut archive =
        ZipArchive::new(file).map_err(|e| ApkError::Message(format!("zip open failed: {e}")))?;

    let mut files = Vec::new();
    let mut total_classes = 0u32;
    let mut total_methods = 0u32;
    let mut total_fields = 0u32;
    let mut total_strings = 0u32;
    let mut total_protos = 0u32;
    let mut total_debug = 0u32;
    let mut any_debug = false;
    let mut all_class_names: Vec<String> = Vec::new();
    let mut notes = Vec::new();

    for entry_meta in &dex_entries {
        let mut zf = match archive.by_name(&entry_meta.path) {
            Ok(f) => f,
            Err(e) => {
                notes.push(format!("{}: read failed ({e})", entry_meta.path));
                continue;
            }
        };
        let mut bytes = Vec::new();
        if let Err(e) = zf.read_to_end(&mut bytes) {
            notes.push(format!("{}: {e}", entry_meta.path));
            continue;
        }

        match parse_dex(&bytes) {
            Ok(stats) => {
                total_classes += stats.classes;
                total_methods += stats.methods;
                total_fields += stats.fields;
                total_strings += stats.strings;
                total_protos += stats.proto_ids;
                total_debug += stats.debug_info_items;
                if stats.has_debug_info {
                    any_debug = true;
                }
                all_class_names.extend(stats.class_names);
                files.push(DexFileStats {
                    path: entry_meta.path.clone(),
                    size: entry_meta.size,
                    version: stats.version,
                    classes: stats.classes,
                    methods: stats.methods,
                    fields: stats.fields,
                    strings: stats.strings,
                    has_debug_info: stats.has_debug_info,
                });
            }
            Err(msg) => notes.push(format!("{}: {msg}", entry_meta.path)),
        }
    }

    let total_size: u64 = dex_entries.iter().map(|e| e.size).sum();
    let (obf_pct, _, _, _) = obfuscation_from_names(&all_class_names);
    let mut score: f64 = 0.0;
    if !any_debug {
        score += 40.0;
        notes.push("Debug info stripped — typical of release/R8 builds.".into());
    } else {
        notes.push("Debug info present — likely debuggable or unstripped build.".into());
        score += 5.0;
    }
    if obf_pct >= 50.0 {
        score += 35.0;
        notes.push(format!(
            "High class-name obfuscation ({obf_pct:.1}%) suggests R8/ProGuard minify."
        ));
    } else if obf_pct >= 20.0 {
        score += 20.0;
        notes.push(format!("Partial obfuscation detected ({obf_pct:.1}%)."));
    } else {
        notes.push(format!(
            "Low obfuscation ({obf_pct:.1}%) — names mostly readable."
        ));
        score += 5.0;
    }
    if dex_entries.len() > 1 {
        score += 10.0;
        notes.push(format!("Multidex: {} DEX files.", dex_entries.len()));
    }
    if total_classes > 0 {
        let methods_per_class = total_methods as f64 / total_classes as f64;
        if (2.0..25.0).contains(&methods_per_class) {
            score += 10.0;
        }
    }
    score = score.clamp(0.0, 100.0);
    let optimized = score >= 55.0 && !any_debug;

    if optimized {
        notes.insert(
            0,
            "DEX looks optimized (stripped debug + minify/obfuscation signals).".into(),
        );
    } else {
        notes.insert(
            0,
            "DEX optimization signals are weak or mixed — may be debug/unminified.".into(),
        );
    }

    Ok((
        DexAnalysis {
            file_count: files.len(),
            total_size,
            classes: total_classes,
            methods: total_methods,
            fields: total_fields,
            strings: total_strings,
            proto_ids: total_protos,
            has_debug_info: any_debug,
            debug_info_items: total_debug,
            optimized,
            optimization_score_pct: round2(score),
            notes,
            files,
        },
        all_class_names,
    ))
}

fn build_obfuscation(
    dex: &DexAnalysis,
    class_names: &[String],
    zip_shrink_pct: f64,
) -> ObfuscationAnalysis {
    let (obfuscation_pct, obfuscated, readable, (samples_obf, samples_read)) =
        obfuscation_from_names(class_names);
    let total = obfuscated + readable;

    let mut code_hint = 0.0;
    if !dex.has_debug_info {
        code_hint += 12.0;
    }
    code_hint += obfuscation_pct * 0.35;
    if dex.optimized {
        code_hint += 8.0;
    }
    code_hint = code_hint.clamp(0.0, 70.0);

    let shrink_pct = round2((zip_shrink_pct * 0.65 + code_hint * 0.35).clamp(0.0, 90.0));

    let mut notes = Vec::new();
    notes.push(format!(
        "ZIP compression shrinks package by {zip_shrink_pct:.1}% (uncompressed → stored/deflated)."
    ));
    notes.push(format!(
        "Estimated code-side shrink hint {code_hint:.1}% (debug strip + minify/obfuscation signals)."
    ));
    notes.push(format!(
        "Class obfuscation {obfuscation_pct:.1}% ({obfuscated}/{total}) based on DEX descriptors."
    ));

    ObfuscationAnalysis {
        obfuscation_pct: round2(obfuscation_pct),
        obfuscated_classes: obfuscated,
        readable_classes: readable,
        total_classes: total,
        shrink_pct,
        zip_shrink_pct: round2(zip_shrink_pct),
        code_shrink_hint_pct: round2(code_hint),
        samples_obfuscated: samples_obf,
        samples_readable: samples_read,
        notes,
    }
}

// —— DEX parsing ——

struct DexParseResult {
    version: String,
    classes: u32,
    methods: u32,
    fields: u32,
    strings: u32,
    proto_ids: u32,
    has_debug_info: bool,
    debug_info_items: u32,
    class_names: Vec<String>,
}

fn parse_dex(data: &[u8]) -> Result<DexParseResult, String> {
    if data.len() < 0x70 {
        return Err("DEX too small".into());
    }
    if &data[0..4] != b"dex\n" {
        return Err("not a DEX file".into());
    }
    let version = String::from_utf8_lossy(&data[4..7]).into_owned();

    let string_ids_size = read_u32(data, 56)?;
    let string_ids_off = read_u32(data, 60)? as usize;
    let type_ids_size = read_u32(data, 64)?;
    let type_ids_off = read_u32(data, 68)? as usize;
    let proto_ids_size = read_u32(data, 72)?;
    let field_ids_size = read_u32(data, 80)?;
    let method_ids_size = read_u32(data, 88)?;
    let class_defs_size = read_u32(data, 96)?;
    let class_defs_off = read_u32(data, 100)? as usize;
    let map_off = read_u32(data, 52)? as usize;

    let (has_debug_info, debug_info_items) = parse_map_debug(data, map_off);

    let mut class_names = Vec::with_capacity(class_defs_size.min(20_000) as usize);
    let limit = class_defs_size.min(20_000);
    for i in 0..limit {
        let off = class_defs_off.saturating_add((i as usize).saturating_mul(32));
        let class_idx = read_u32(data, off)? as usize;
        if let Some(name) = type_name(data, type_ids_off, type_ids_size, string_ids_off, string_ids_size, class_idx)
        {
            class_names.push(name);
        }
    }

    Ok(DexParseResult {
        version,
        classes: class_defs_size,
        methods: method_ids_size,
        fields: field_ids_size,
        strings: string_ids_size,
        proto_ids: proto_ids_size,
        has_debug_info,
        debug_info_items,
        class_names,
    })
}

fn parse_map_debug(data: &[u8], map_off: usize) -> (bool, u32) {
    if map_off == 0 || map_off + 4 > data.len() {
        return (false, 0);
    }
    let Ok(size) = read_u32(data, map_off) else {
        return (false, 0);
    };
    let mut debug_items = 0u32;
    for i in 0..size.min(512) {
        let entry = map_off + 4 + (i as usize) * 12;
        if entry + 12 > data.len() {
            break;
        }
        let type_code = match read_u16(data, entry) {
            Ok(v) => v,
            Err(_) => break,
        };
        // TYPE_DEBUG_INFO_ITEM = 0x2003
        if type_code == 0x2003 {
            if let Ok(count) = read_u32(data, entry + 4) {
                debug_items = debug_items.saturating_add(count);
            }
        }
    }
    (debug_items > 0, debug_items)
}

fn type_name(
    data: &[u8],
    type_ids_off: usize,
    type_ids_size: u32,
    string_ids_off: usize,
    string_ids_size: u32,
    type_idx: usize,
) -> Option<String> {
    if type_idx as u32 >= type_ids_size {
        return None;
    }
    let desc_idx = read_u32(data, type_ids_off + type_idx * 4).ok()? as usize;
    string_at(data, string_ids_off, string_ids_size, desc_idx)
}

fn string_at(
    data: &[u8],
    string_ids_off: usize,
    string_ids_size: u32,
    string_idx: usize,
) -> Option<String> {
    if string_idx as u32 >= string_ids_size {
        return None;
    }
    let data_off = read_u32(data, string_ids_off + string_idx * 4).ok()? as usize;
    read_mutf8(data, data_off)
}

fn read_mutf8(data: &[u8], mut off: usize) -> Option<String> {
    // uleb128 utf16_size then MUTF-8 bytes until \0
    let mut _utf16_len = 0u32;
    let mut shift = 0u32;
    loop {
        let b = *data.get(off)?;
        off += 1;
        _utf16_len |= u32::from(b & 0x7f) << shift;
        if b & 0x80 == 0 {
            break;
        }
        shift += 7;
        if shift > 28 {
            return None;
        }
    }
    let start = off;
    while off < data.len() && data[off] != 0 {
        off += 1;
        if off - start > 16_384 {
            break;
        }
    }
    let bytes = data.get(start..off)?;
    Some(String::from_utf8_lossy(bytes).into_owned())
}

fn obfuscation_from_names(names: &[String]) -> (f64, u32, u32, (Vec<String>, Vec<String>)) {
    let mut obfuscated = 0u32;
    let mut readable = 0u32;
    let mut samples_obf = Vec::new();
    let mut samples_read = Vec::new();

    for name in names {
        let simple = class_simple_name(name);
        if is_obfuscated_name(&simple, name) {
            obfuscated += 1;
            if samples_obf.len() < 8 {
                samples_obf.push(name.clone());
            }
        } else {
            readable += 1;
            if samples_read.len() < 8 {
                samples_read.push(name.clone());
            }
        }
    }

    let total = obfuscated + readable;
    let pct = if total == 0 {
        0.0
    } else {
        (obfuscated as f64) * 100.0 / (total as f64)
    };
    (pct, obfuscated, readable, (samples_obf, samples_read))
}

fn class_simple_name(descriptor: &str) -> String {
    // Lcom/example/Foo; → Foo ; Lz/a; → a
    let trimmed = descriptor.trim_start_matches('L').trim_end_matches(';');
    trimmed
        .rsplit('/')
        .next()
        .unwrap_or(trimmed)
        .replace('$', ".")
        .split('.')
        .next()
        .unwrap_or(trimmed)
        .to_string()
}

fn is_obfuscated_name(simple: &str, full: &str) -> bool {
    if simple.is_empty() {
        return false;
    }
    // Skip common non-app prefixes that are rarely obfuscated the same way
    if full.starts_with("Landroid/")
        || full.starts_with("Landroidx/")
        || full.starts_with("Ljava/")
        || full.starts_with("Lkotlin/")
        || full.starts_with("Lkotlinx/")
        || full.starts_with("Lcom/google/")
        || full.starts_with("Lcom/android/")
    {
        // Still count short names inside support libs as obfuscated if tiny
        if simple.len() <= 2 && simple.chars().all(|c| c.is_ascii_lowercase()) {
            return true;
        }
        return false;
    }

    let chars: Vec<char> = simple.chars().collect();
    if chars.len() <= 3 && chars.iter().all(|c| c.is_ascii_lowercase()) {
        return true;
    }
    // R8 full-mode sometimes uses mixed short alnum
    if chars.len() <= 3
        && chars
            .iter()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit())
        && chars.iter().any(|c| c.is_ascii_lowercase())
    {
        return true;
    }
    // Package path like La/b/c/d;
    let parts: Vec<&str> = full
        .trim_start_matches('L')
        .trim_end_matches(';')
        .split('/')
        .collect();
    if parts.len() >= 2
        && parts
            .iter()
            .all(|p| p.len() <= 2 && p.chars().all(|c| c.is_ascii_lowercase()))
    {
        return true;
    }
    false
}

fn shrink_pct(uncompressed: u64, compressed: u64) -> f64 {
    if uncompressed == 0 {
        return 0.0;
    }
    let c = compressed.min(uncompressed);
    (1.0 - (c as f64 / uncompressed as f64)) * 100.0
}

fn pct(part: u64, total: u64) -> f64 {
    if total == 0 {
        0.0
    } else {
        (part as f64) * 100.0 / (total as f64)
    }
}

fn round2(v: f64) -> f64 {
    (v * 100.0).round() / 100.0
}

fn read_u16(data: &[u8], off: usize) -> Result<u16, String> {
    data.get(off..off + 2)
        .map(|b| u16::from_le_bytes([b[0], b[1]]))
        .ok_or_else(|| "DEX truncated".into())
}

fn read_u32(data: &[u8], off: usize) -> Result<u32, String> {
    data.get(off..off + 4)
        .map(|b| u32::from_le_bytes([b[0], b[1], b[2], b[3]]))
        .ok_or_else(|| "DEX truncated".into())
}
