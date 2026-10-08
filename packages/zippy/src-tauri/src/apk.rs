use crate::apk_analytics::{self, SizeAnalysis};
use apk_info::{Apk, CertificateInfo, Signature, ARSC, AXML};
use serde::Serialize;
use std::fs::{self, File};
use std::io::Read;
use std::path::{Component, Path, PathBuf};
use thiserror::Error;
use zip::ZipArchive;

const PAGE_16K: u64 = 16384;
const PREVIEW_DEFAULT_MAX: usize = 256 * 1024;

#[derive(Debug, Error)]
pub enum ApkError {
    #[error("{0}")]
    Message(String),
}

impl Serialize for ApkError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApkReport {
    pub path: String,
    pub file_name: String,
    pub format: String,
    pub size_bytes: u64,
    pub entry_count: usize,
    pub summary: ApkSummary,
    pub manifest: ManifestInfo,
    pub signing: SigningInfo,
    pub page16kb: Page16KbReport,
    pub size_analysis: SizeAnalysis,
    pub resources: ResourceBrowse,
    pub entries: Vec<ApkEntry>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApkSummary {
    pub package_name: Option<String>,
    pub version_name: Option<String>,
    pub version_code: Option<String>,
    pub min_sdk: Option<String>,
    pub target_sdk: u32,
    pub compile_sdk: Option<String>,
    pub label: Option<String>,
    pub debuggable: Option<String>,
    pub allow_backup: Option<String>,
    pub main_activity: Option<String>,
    pub abis: Vec<String>,
    pub multidex: bool,
    pub modules: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestInfo {
    pub xml: String,
    pub permissions: Vec<String>,
    pub features: Vec<String>,
    pub activities: Vec<ComponentInfo>,
    pub services: Vec<ComponentInfo>,
    pub receivers: Vec<ComponentInfo>,
    pub providers: Vec<ComponentInfo>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComponentInfo {
    pub name: String,
    pub exported: Option<String>,
    pub enabled: Option<String>,
    pub permission: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SigningInfo {
    pub schemes: Vec<String>,
    pub certificates: Vec<SignerCertificate>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignerCertificate {
    pub scheme: String,
    pub subject: String,
    pub issuer: String,
    pub serial_number: String,
    pub valid_from: String,
    pub valid_until: String,
    pub signature_type: String,
    pub sha256: String,
    pub sha1: String,
    pub md5: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Page16KbReport {
    pub compatible: bool,
    pub has_native_libs: bool,
    pub checked_abis: Vec<String>,
    pub summary: String,
    pub libraries: Vec<NativeLibCheck>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeLibCheck {
    pub path: String,
    pub abi: String,
    pub compressed: bool,
    pub zip_aligned: Option<bool>,
    pub zip_data_offset: Option<u64>,
    pub elf_aligned: Option<bool>,
    pub load_aligns: Vec<u64>,
    pub max_load_align: Option<u64>,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceBrowse {
    pub assets: Vec<ApkEntry>,
    pub raw: Vec<ApkEntry>,
    pub other_res: Vec<ApkEntry>,
    pub native_libs: Vec<ApkEntry>,
    pub dex: Vec<ApkEntry>,
    pub meta_inf: Vec<ApkEntry>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApkEntry {
    pub path: String,
    pub size: u64,
    pub compressed_size: u64,
    pub compressed: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UnpackResult {
    pub dest: String,
    pub extracted: usize,
    pub skipped: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EntryPreview {
    pub path: String,
    pub size: u64,
    pub truncated: bool,
    pub is_text: bool,
    pub text: Option<String>,
    pub base64: Option<String>,
    pub content_type: String,
}

pub fn analyze(path: &str) -> Result<ApkReport, ApkError> {
    let path = PathBuf::from(path);
    validate_apk_path(&path)?;

    let meta = fs::metadata(&path)
        .map_err(|e| ApkError::Message(format!("failed to read package: {e}")))?;
    let entries = list_zip_entries(&path)?;
    let format = detect_format(&path, &entries);
    let page16kb = check_16kb(&path, &entries)?;
    let resources = classify_resources(&entries);
    let abis = collect_abis(&entries);
    let size_analysis = apk_analytics::analyze_size(&path, &entries, meta.len())?;

    let file_name = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("app.apk")
        .to_string();

    if format == "aab" {
        return analyze_aab(
            &path,
            file_name,
            meta.len(),
            entries,
            page16kb,
            size_analysis,
            resources,
            abis,
        );
    }

    let apk = Apk::new(&path).map_err(|e| ApkError::Message(format!("apk parse failed: {e}")))?;
    let signing = parse_signing(&apk)?;
    let manifest = parse_manifest(&apk, &path);

    Ok(ApkReport {
        path: path.display().to_string(),
        file_name,
        format,
        size_bytes: meta.len(),
        entry_count: entries.len(),
        summary: ApkSummary {
            package_name: apk.get_package_name(),
            version_name: apk.get_version_name(),
            version_code: apk.get_version_code(),
            min_sdk: apk.get_min_sdk_version(),
            target_sdk: apk.get_target_sdk_version(),
            compile_sdk: apk.get_compile_sdk_version(),
            label: apk.get_application_label(),
            debuggable: apk.get_application_debuggable(),
            allow_backup: apk.get_application_allow_backup(),
            main_activity: apk.get_main_activity().map(|s| s.to_string()),
            abis: if apk.get_supported_abis().is_empty() {
                abis
            } else {
                apk.get_supported_abis()
            },
            multidex: apk.is_multidex(),
            modules: vec![],
        },
        manifest,
        signing,
        page16kb,
        size_analysis,
        resources,
        entries,
    })
}

fn analyze_aab(
    path: &Path,
    file_name: String,
    size_bytes: u64,
    entries: Vec<ApkEntry>,
    page16kb: Page16KbReport,
    size_analysis: SizeAnalysis,
    resources: ResourceBrowse,
    abis: Vec<String>,
) -> Result<ApkReport, ApkError> {
    let modules = collect_aab_modules(&entries);
    let multidex = entries
        .iter()
        .filter(|e| e.path.ends_with(".dex"))
        .count()
        > 1;
    let manifest_bytes = read_zip_entry_bytes(path, "base/manifest/AndroidManifest.xml")?;
    let parsed = crate::aab::parse_manifest_pb(&manifest_bytes, multidex)?;
    let signing = detect_jar_signing(&entries);

    Ok(ApkReport {
        path: path.display().to_string(),
        file_name,
        format: "aab".into(),
        size_bytes,
        entry_count: entries.len(),
        summary: ApkSummary {
            package_name: parsed.package_name,
            version_name: parsed.version_name,
            version_code: parsed.version_code,
            min_sdk: parsed.min_sdk,
            target_sdk: parsed.target_sdk,
            compile_sdk: parsed.compile_sdk,
            label: parsed.label,
            debuggable: parsed.debuggable,
            allow_backup: parsed.allow_backup,
            main_activity: parsed.main_activity,
            abis,
            multidex: parsed.multidex,
            modules,
        },
        manifest: parsed.manifest,
        signing,
        page16kb,
        size_analysis,
        resources,
        entries,
    })
}

pub fn unpack(path: &str, dest: &str) -> Result<UnpackResult, ApkError> {
    let path = PathBuf::from(path);
    let dest = PathBuf::from(dest);
    validate_apk_path(&path)?;

    if dest.as_os_str().is_empty() {
        return Err(ApkError::Message("destination directory is required".into()));
    }

    fs::create_dir_all(&dest)
        .map_err(|e| ApkError::Message(format!("failed to create dest: {e}")))?;

    let file = File::open(&path).map_err(|e| ApkError::Message(format!("open apk failed: {e}")))?;
    let mut archive =
        ZipArchive::new(file).map_err(|e| ApkError::Message(format!("zip open failed: {e}")))?;

    let mut extracted = 0usize;
    let mut skipped = 0usize;

    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| ApkError::Message(format!("zip entry failed: {e}")))?;
        let Some(rel) = entry.enclosed_name().map(|p| p.to_path_buf()) else {
            skipped += 1;
            continue;
        };
        if !is_safe_relative(&rel) {
            skipped += 1;
            continue;
        }

        let out_path = dest.join(&rel);
        if entry.is_dir() || entry.name().ends_with('/') {
            fs::create_dir_all(&out_path)
                .map_err(|e| ApkError::Message(format!("mkdir failed: {e}")))?;
            continue;
        }

        if let Some(parent) = out_path.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| ApkError::Message(format!("mkdir failed: {e}")))?;
        }

        let mut out = File::create(&out_path)
            .map_err(|e| ApkError::Message(format!("create file failed: {e}")))?;
        std::io::copy(&mut entry, &mut out)
            .map_err(|e| ApkError::Message(format!("extract failed: {e}")))?;
        extracted += 1;
    }

    Ok(UnpackResult {
        dest: dest.display().to_string(),
        extracted,
        skipped,
    })
}

pub fn read_entry(
    path: &str,
    entry: &str,
    max_bytes: Option<usize>,
) -> Result<EntryPreview, ApkError> {
    let path = PathBuf::from(path);
    validate_apk_path(&path)?;
    if entry.trim().is_empty() || entry.contains("..") {
        return Err(ApkError::Message("invalid entry path".into()));
    }

    let limit = max_bytes.unwrap_or(PREVIEW_DEFAULT_MAX).min(2 * 1024 * 1024);
    let file = File::open(&path).map_err(|e| ApkError::Message(format!("open apk failed: {e}")))?;
    let mut archive =
        ZipArchive::new(file).map_err(|e| ApkError::Message(format!("zip open failed: {e}")))?;
    let mut zip_file = archive
        .by_name(entry)
        .map_err(|_| ApkError::Message(format!("entry not found: {entry}")))?;

    let size = zip_file.size();
    let mut buf = Vec::new();
    if size as usize <= limit {
        zip_file
            .read_to_end(&mut buf)
            .map_err(|e| ApkError::Message(format!("read failed: {e}")))?;
    } else {
        buf.resize(limit, 0);
        zip_file
            .read_exact(&mut buf)
            .map_err(|e| ApkError::Message(format!("read failed: {e}")))?;
    }

    let truncated = (size as usize) > buf.len();
    let lower = entry.to_ascii_lowercase();

    // Binary AndroidManifest (AXML / AAB protobuf) must be decoded — never
    // shown as raw "text/xml" or the UI fills with mojibake.
    if is_manifest_entry(&lower) {
        if let Some(xml) = decode_manifest_bytes(&path, entry, &buf) {
            return Ok(EntryPreview {
                path: entry.to_string(),
                size,
                truncated,
                is_text: true,
                text: Some(xml),
                base64: None,
                content_type: "text/xml".into(),
            });
        }
    }

    let content_type = guess_content_type(&lower, &buf);
    let is_text = looks_like_text(&buf) && !is_binary_axml(&buf) && !is_likely_protobuf_xml(&buf);

    if is_text {
        let text = String::from_utf8_lossy(&buf).into_owned();
        Ok(EntryPreview {
            path: entry.to_string(),
            size,
            truncated,
            is_text: true,
            text: Some(text),
            base64: None,
            content_type,
        })
    } else {
        Ok(EntryPreview {
            path: entry.to_string(),
            size,
            truncated,
            is_text: false,
            text: None,
            base64: Some(base64::Engine::encode(
                &base64::engine::general_purpose::STANDARD,
                &buf,
            )),
            content_type,
        })
    }
}

fn validate_apk_path(path: &Path) -> Result<(), ApkError> {
    if !path.exists() {
        return Err(ApkError::Message(format!(
            "file not found: {}",
            path.display()
        )));
    }
    if !path.is_file() {
        return Err(ApkError::Message("path is not a file".into()));
    }
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if !matches!(ext.as_str(), "apk" | "aab" | "xapk" | "apkm" | "zip") {
        return Err(ApkError::Message(
            "please drop an .apk / .aab / .xapk / .apkm file".into(),
        ));
    }
    Ok(())
}

fn detect_format(path: &Path, entries: &[ApkEntry]) -> String {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if ext == "aab"
        || entries.iter().any(|e| e.path == "BundleConfig.pb")
        || entries
            .iter()
            .any(|e| e.path == "base/manifest/AndroidManifest.xml")
    {
        return "aab".into();
    }
    if ext == "xapk" {
        return "xapk".into();
    }
    if ext == "apkm" {
        return "apkm".into();
    }
    "apk".into()
}

fn collect_aab_modules(entries: &[ApkEntry]) -> Vec<String> {
    let mut modules = Vec::new();
    for entry in entries {
        let Some(module) = entry.path.split('/').next() else {
            continue;
        };
        if module.is_empty()
            || module == "META-INF"
            || module == "BUNDLE-METADATA"
            || module == "BundleConfig.pb"
        {
            continue;
        }
        if !modules.iter().any(|m| m == module) {
            modules.push(module.to_string());
        }
    }
    modules.sort();
    modules
}

fn collect_abis(entries: &[ApkEntry]) -> Vec<String> {
    let mut abis = Vec::new();
    for entry in entries {
        if let Some(abi) = native_lib_abi(&entry.path) {
            if !abis.iter().any(|a| a == &abi) {
                abis.push(abi);
            }
        }
    }
    abis.sort();
    abis
}

fn native_lib_abi(path: &str) -> Option<String> {
    if !path.ends_with(".so") {
        return None;
    }
    let parts: Vec<&str> = path.split('/').collect();
    for i in 0..parts.len().saturating_sub(1) {
        if parts[i] == "lib" {
            let abi = parts.get(i + 1)?;
            if parts.get(i + 2).is_some_and(|name| name.ends_with(".so")) {
                return Some((*abi).to_string());
            }
        }
    }
    None
}

fn is_native_lib_path(path: &str) -> bool {
    native_lib_abi(path).is_some()
}

fn path_has_segment_prefix(path: &str, folder: &str) -> bool {
    path == folder
        || path.starts_with(&format!("{folder}/"))
        || path.contains(&format!("/{folder}/"))
}

fn read_zip_entry_bytes(path: &Path, entry: &str) -> Result<Vec<u8>, ApkError> {
    let file = File::open(path).map_err(|e| ApkError::Message(format!("open package failed: {e}")))?;
    let mut archive =
        ZipArchive::new(file).map_err(|e| ApkError::Message(format!("zip open failed: {e}")))?;
    let mut zip_file = archive
        .by_name(entry)
        .map_err(|_| ApkError::Message(format!("entry not found: {entry}")))?;
    let mut buf = Vec::new();
    zip_file
        .read_to_end(&mut buf)
        .map_err(|e| ApkError::Message(format!("read failed: {e}")))?;
    Ok(buf)
}

fn detect_jar_signing(entries: &[ApkEntry]) -> SigningInfo {
    let mut schemes = Vec::new();
    let has_mf = entries.iter().any(|e| e.path == "META-INF/MANIFEST.MF");
    let has_sf = entries
        .iter()
        .any(|e| e.path.starts_with("META-INF/") && e.path.ends_with(".SF"));
    let sig_files: Vec<&str> = entries
        .iter()
        .filter(|e| {
            let p = e.path.to_ascii_uppercase();
            p.starts_with("META-INF/")
                && (p.ends_with(".RSA") || p.ends_with(".DSA") || p.ends_with(".EC"))
        })
        .map(|e| e.path.as_str())
        .collect();

    if has_mf && (has_sf || !sig_files.is_empty()) {
        schemes.push("v1".into());
    }
    if entries.iter().any(|e| e.path.contains("stamp-cert-sha256")) {
        schemes.push("stamp".into());
    }

    SigningInfo {
        schemes,
        certificates: sig_files
            .into_iter()
            .map(|path| SignerCertificate {
                scheme: "v1".into(),
                subject: format!("JAR signature block: {path}"),
                issuer: "—".into(),
                serial_number: "—".into(),
                valid_from: "—".into(),
                valid_until: "—".into(),
                signature_type: "JAR / PKCS#7".into(),
                sha256: "—".into(),
                sha1: "—".into(),
                md5: "—".into(),
            })
            .collect(),
    }
}

fn is_safe_relative(path: &Path) -> bool {
    path.components().all(|c| match c {
        Component::Normal(_) => true,
        Component::CurDir => true,
        _ => false,
    })
}

fn list_zip_entries(path: &Path) -> Result<Vec<ApkEntry>, ApkError> {
    let file = File::open(path).map_err(|e| ApkError::Message(format!("open apk failed: {e}")))?;
    let mut archive =
        ZipArchive::new(file).map_err(|e| ApkError::Message(format!("zip open failed: {e}")))?;
    let mut entries = Vec::with_capacity(archive.len());
    for i in 0..archive.len() {
        let entry = archive
            .by_index(i)
            .map_err(|e| ApkError::Message(format!("zip entry failed: {e}")))?;
        let name = entry.name().to_string();
        if name.ends_with('/') {
            continue;
        }
        entries.push(ApkEntry {
            path: name,
            size: entry.size(),
            compressed_size: entry.compressed_size(),
            compressed: entry.compression() != zip::CompressionMethod::Stored,
        });
    }
    entries.sort_by(|a, b| a.path.cmp(&b.path));
    Ok(entries)
}

fn classify_resources(entries: &[ApkEntry]) -> ResourceBrowse {
    let mut assets = Vec::new();
    let mut raw = Vec::new();
    let mut other_res = Vec::new();
    let mut native_libs = Vec::new();
    let mut dex = Vec::new();
    let mut meta_inf = Vec::new();

    for entry in entries {
        let p = &entry.path;
        if path_has_segment_prefix(p, "assets") {
            assets.push(entry.clone());
        } else if p.contains("/res/raw")
            || p.contains("/res/raw-")
            || p.starts_with("res/raw")
            || p.starts_with("res/raw-")
        {
            raw.push(entry.clone());
        } else if path_has_segment_prefix(p, "res") {
            other_res.push(entry.clone());
        } else if is_native_lib_path(p) {
            native_libs.push(entry.clone());
        } else if p.ends_with(".dex") {
            dex.push(entry.clone());
        } else if p.starts_with("META-INF/") {
            meta_inf.push(entry.clone());
        }
    }

    ResourceBrowse {
        assets,
        raw,
        other_res,
        native_libs,
        dex,
        meta_inf,
    }
}

fn parse_manifest(apk: &Apk, package_path: &Path) -> ManifestInfo {
    let permissions: Vec<String> = apk.get_permissions().map(|s| s.to_string()).collect();
    let features: Vec<String> = apk.get_features().map(|s| s.to_string()).collect();

    let activities = apk
        .get_activities()
        .filter_map(|a| {
            Some(ComponentInfo {
                name: a.name?.to_string(),
                exported: a.exported.map(|s| s.to_string()),
                enabled: a.enabled.map(|s| s.to_string()),
                permission: a.permission.map(|s| s.to_string()),
            })
        })
        .collect();

    let services = apk
        .get_services()
        .filter_map(|s| {
            Some(ComponentInfo {
                name: s.name?.to_string(),
                exported: s.exported.map(|v| v.to_string()),
                enabled: s.enabled.map(|v| v.to_string()),
                permission: s.permission.map(|v| v.to_string()),
            })
        })
        .collect();

    let receivers = apk
        .get_receivers()
        .filter_map(|r| {
            Some(ComponentInfo {
                name: r.name?.to_string(),
                exported: r.exported.map(|v| v.to_string()),
                enabled: r.enabled.map(|v| v.to_string()),
                permission: r.permission.map(|v| v.to_string()),
            })
        })
        .collect();

    let providers = apk
        .get_providers()
        .filter_map(|p| {
            Some(ComponentInfo {
                name: p.name?.to_string(),
                exported: p.exported.map(|v| v.to_string()),
                enabled: p.enabled.map(|v| v.to_string()),
                permission: p.permission.map(|v| v.to_string()),
            })
        })
        .collect();

    let xml = {
        let raw = apk.get_xml_string();
        if manifest_xml_looks_decoded(&raw) {
            raw
        } else {
            decode_manifest_bytes(package_path, "AndroidManifest.xml", &[])
                .or_else(|| {
                    read_zip_entry_bytes(package_path, "AndroidManifest.xml")
                        .ok()
                        .and_then(|bytes| {
                            let arsc = read_zip_entry_bytes(package_path, "resources.arsc").ok();
                            decode_axml_to_string(&bytes, arsc.as_deref())
                        })
                })
                .unwrap_or(raw)
        }
    };

    ManifestInfo {
        xml,
        permissions,
        features,
        activities,
        services,
        receivers,
        providers,
    }
}

fn parse_signing(apk: &Apk) -> Result<SigningInfo, ApkError> {
    let signatures = apk
        .get_signatures()
        .map_err(|e| ApkError::Message(format!("signature parse failed: {e}")))?;

    let mut schemes = Vec::new();
    let mut certificates = Vec::new();

    for sig in signatures {
        match sig {
            Signature::V1(certs) => {
                schemes.push("v1".into());
                push_certs(&mut certificates, "v1", certs);
            }
            Signature::V2(certs) => {
                schemes.push("v2".into());
                push_certs(&mut certificates, "v2", certs);
            }
            Signature::V3(certs) => {
                schemes.push("v3".into());
                push_certs(&mut certificates, "v3", certs);
            }
            Signature::V31(certs) => {
                schemes.push("v3.1".into());
                push_certs(&mut certificates, "v3.1", certs);
            }
            Signature::V4 => schemes.push("v4".into()),
            Signature::StampBlockV1(cert) => {
                schemes.push("stamp-v1".into());
                push_certs(&mut certificates, "stamp-v1", vec![cert]);
            }
            Signature::StampBlockV2(cert) => {
                schemes.push("stamp-v2".into());
                push_certs(&mut certificates, "stamp-v2", vec![cert]);
            }
            Signature::ApkChannelBlock(_) => schemes.push("channel".into()),
            Signature::PackerNextGenV2(_) => schemes.push("packer-ng-v2".into()),
            Signature::GooglePlayFrosting => schemes.push("play-frosting".into()),
            Signature::VasDollyV2(_) => schemes.push("vasdolly-v2".into()),
            Signature::Unknown => schemes.push("unknown".into()),
        }
    }

    schemes.sort();
    schemes.dedup();

    Ok(SigningInfo {
        schemes,
        certificates,
    })
}

fn push_certs(out: &mut Vec<SignerCertificate>, scheme: &str, certs: Vec<CertificateInfo>) {
    for cert in certs {
        out.push(SignerCertificate {
            scheme: scheme.to_string(),
            subject: cert.subject,
            issuer: cert.issuer,
            serial_number: cert.serial_number,
            valid_from: cert.valid_from,
            valid_until: cert.valid_until,
            signature_type: cert.signature_type,
            sha256: cert.sha256_fingerprint,
            sha1: cert.sha1_fingerprint,
            md5: cert.md5_fingerprint,
        });
    }
}

fn check_16kb(path: &Path, entries: &[ApkEntry]) -> Result<Page16KbReport, ApkError> {
    let native: Vec<&ApkEntry> = entries
        .iter()
        .filter(|e| is_native_lib_path(&e.path))
        .collect();

    if native.is_empty() {
        return Ok(Page16KbReport {
            compatible: true,
            has_native_libs: false,
            checked_abis: vec![],
            summary: "No native libraries — 16 KB page size requirement does not apply.".into(),
            libraries: vec![],
        });
    }

    let file = File::open(path).map_err(|e| ApkError::Message(format!("open package failed: {e}")))?;
    let mut archive =
        ZipArchive::new(file).map_err(|e| ApkError::Message(format!("zip open failed: {e}")))?;

    let mut libraries = Vec::new();
    let mut checked_abis = Vec::new();

    for entry_meta in native {
        let abi = native_lib_abi(&entry_meta.path).unwrap_or_else(|| "unknown".into());
        if !checked_abis.contains(&abi) {
            checked_abis.push(abi.clone());
        }

        let mut notes = Vec::new();
        let needs_16k_abi = matches!(abi.as_str(), "arm64-v8a" | "x86_64");

        match archive.by_name(&entry_meta.path) {
            Ok(mut zip_file) => {
                let data_start = zip_file.data_start();
                let compressed = zip_file.compression() != zip::CompressionMethod::Stored;

                let zip_aligned = if compressed {
                    notes.push(
                        "Library is compressed in APK; ZIP 16 KB alignment only applies to STORED entries."
                            .into(),
                    );
                    None
                } else {
                    let aligned = data_start % PAGE_16K == 0;
                    if !aligned {
                        notes.push(format!(
                            "ZIP data offset {data_start} is not 16 KB aligned (need offset % 16384 == 0)."
                        ));
                    }
                    Some(aligned)
                };

                let mut bytes = Vec::new();
                let (elf_aligned, load_aligns, max_load_align) =
                    if let Err(e) = zip_file.read_to_end(&mut bytes) {
                        notes.push(format!("failed to read library bytes: {e}"));
                        (None, Vec::new(), None)
                    } else {
                        match parse_elf_load_aligns(&bytes) {
                            Ok(aligns) => {
                                let max_align = aligns.iter().copied().max();
                                if aligns.is_empty() {
                                    notes.push("No PT_LOAD segments found.".into());
                                    (Some(true), aligns, max_align)
                                } else {
                                    let ok = aligns.iter().all(|a| *a >= PAGE_16K);
                                    if !ok {
                                        notes.push(format!(
                                            "ELF LOAD p_align values {:?} — need all >= 16384 (2**14).",
                                            aligns
                                        ));
                                    }
                                    (Some(ok), aligns, max_align)
                                }
                            }
                            Err(msg) => {
                                notes.push(msg);
                                (None, Vec::new(), None)
                            }
                        }
                    };

                if !needs_16k_abi {
                    notes.push(
                        "ABI is not arm64-v8a/x86_64; Android 16 KB checks focus on 64-bit ABIs."
                            .into(),
                    );
                }

                libraries.push(NativeLibCheck {
                    path: entry_meta.path.clone(),
                    abi,
                    compressed,
                    zip_aligned,
                    zip_data_offset: Some(data_start),
                    elf_aligned,
                    load_aligns,
                    max_load_align,
                    notes,
                });
            }
            Err(e) => {
                notes.push(format!("could not open entry: {e}"));
                libraries.push(NativeLibCheck {
                    path: entry_meta.path.clone(),
                    abi,
                    compressed: entry_meta.compressed,
                    zip_aligned: None,
                    zip_data_offset: None,
                    elf_aligned: None,
                    load_aligns: vec![],
                    max_load_align: None,
                    notes,
                });
            }
        }
    }

    let relevant: Vec<&NativeLibCheck> = libraries
        .iter()
        .filter(|l| matches!(l.abi.as_str(), "arm64-v8a" | "x86_64"))
        .collect();

    let compatible = if relevant.is_empty() {
        true
    } else {
        relevant.iter().all(|lib| {
            let elf_ok = lib.elf_aligned.unwrap_or(false);
            let zip_ok = match lib.zip_aligned {
                Some(v) => v,
                None => true, // compressed: ZIP page align N/A; ELF still required
            };
            elf_ok && zip_ok
        })
    };

    let fail_count = relevant
        .iter()
        .filter(|lib| {
            !(lib.elf_aligned.unwrap_or(false)
                && match lib.zip_aligned {
                    Some(v) => v,
                    None => true,
                })
        })
        .count();

    let summary = if relevant.is_empty() {
        "Native libs present, but no arm64-v8a/x86_64 libraries to check.".into()
    } else if compatible {
        format!(
            "Compatible: {} 64-bit native libraries pass ELF (≥16 KB) and ZIP alignment checks.",
            relevant.len()
        )
    } else {
        format!(
            "Not compatible: {fail_count}/{} 64-bit libraries fail 16 KB alignment (ELF and/or ZIP).",
            relevant.len()
        )
    };

    Ok(Page16KbReport {
        compatible,
        has_native_libs: true,
        checked_abis,
        summary,
        libraries,
    })
}

fn parse_elf_load_aligns(data: &[u8]) -> Result<Vec<u64>, String> {
    if data.len() < 64 {
        return Err("ELF too small".into());
    }
    if data[0..4] != [0x7f, b'E', b'L', b'F'] {
        return Err("Not a valid ELF file".into());
    }

    let class = data[4]; // 1=32, 2=64
    let data_enc = data[5]; // 1=LE, 2=BE
    if data_enc != 1 {
        return Err("Only little-endian ELF is supported".into());
    }

    let (phoff, phentsize, phnum) = if class == 2 {
        let phoff = read_u64_le(data, 32)?;
        let phentsize = read_u16_le(data, 54)? as usize;
        let phnum = read_u16_le(data, 56)? as usize;
        (phoff as usize, phentsize, phnum)
    } else if class == 1 {
        let phoff = read_u32_le(data, 28)? as usize;
        let phentsize = read_u16_le(data, 42)? as usize;
        let phnum = read_u16_le(data, 44)? as usize;
        (phoff, phentsize, phnum)
    } else {
        return Err(format!("unsupported ELF class {class}"));
    };

    if phentsize == 0 || phnum == 0 {
        return Ok(vec![]);
    }

    let mut aligns = Vec::new();
    for i in 0..phnum {
        let off = phoff.saturating_add(i.saturating_mul(phentsize));
        if off + phentsize > data.len() {
            break;
        }
        let p_type = read_u32_le(data, off)?;
        if p_type != 1 {
            // PT_LOAD
            continue;
        }
        let align = if class == 2 {
            read_u64_le(data, off + 48)?
        } else {
            read_u32_le(data, off + 28)? as u64
        };
        aligns.push(align);
    }
    Ok(aligns)
}

fn read_u16_le(data: &[u8], off: usize) -> Result<u16, String> {
    data.get(off..off + 2)
        .map(|b| u16::from_le_bytes([b[0], b[1]]))
        .ok_or_else(|| "ELF truncated".into())
}

fn read_u32_le(data: &[u8], off: usize) -> Result<u32, String> {
    data.get(off..off + 4)
        .map(|b| u32::from_le_bytes([b[0], b[1], b[2], b[3]]))
        .ok_or_else(|| "ELF truncated".into())
}

fn read_u64_le(data: &[u8], off: usize) -> Result<u64, String> {
    data.get(off..off + 8)
        .map(|b| {
            u64::from_le_bytes([b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]])
        })
        .ok_or_else(|| "ELF truncated".into())
}

fn looks_like_text(bytes: &[u8]) -> bool {
    if bytes.is_empty() {
        return true;
    }
    let sample = &bytes[..bytes.len().min(4096)];
    let mut printable = 0usize;
    for &b in sample {
        if b == 0 {
            return false;
        }
        if b == 9 || b == 10 || b == 13 || (32..127).contains(&b) || b >= 0x80 {
            printable += 1;
        }
    }
    printable * 100 / sample.len() >= 90
}

fn guess_content_type(path: &str, bytes: &[u8]) -> String {
    if is_binary_axml(bytes) || is_likely_protobuf_xml(bytes) {
        return "application/octet-stream".into();
    }
    if path.ends_with(".json") {
        "text/json".into()
    } else if path.ends_with(".xml") || path.ends_with(".axml") {
        if looks_like_text(bytes) {
            "text/xml".into()
        } else {
            "application/octet-stream".into()
        }
    } else if path.ends_with(".txt")
        || path.ends_with(".md")
        || path.ends_with(".properties")
        || path.ends_with(".csv")
        || path.ends_with(".html")
        || path.ends_with(".js")
        || path.ends_with(".css")
        || path.ends_with(".svg")
    {
        "text/plain".into()
    } else if path.ends_with(".png") {
        "image/png".into()
    } else if path.ends_with(".jpg") || path.ends_with(".jpeg") {
        "image/jpeg".into()
    } else if path.ends_with(".webp") {
        "image/webp".into()
    } else if path.ends_with(".so") {
        "application/x-sharedlib".into()
    } else if path.ends_with(".dex") {
        "application/octet-stream".into()
    } else {
        "application/octet-stream".into()
    }
}

fn is_manifest_entry(path: &str) -> bool {
    path.ends_with("androidmanifest.xml")
}

fn is_binary_axml(data: &[u8]) -> bool {
    // ResChunk_header: type = RES_XML_TYPE (0x0003), headerSize = 8
    data.len() >= 8 && data[0] == 0x03 && data[1] == 0x00 && data[2] == 0x08 && data[3] == 0x00
}

fn is_likely_protobuf_xml(data: &[u8]) -> bool {
    // AAB manifests are protobuf XmlNode, not textual XML and not AXML.
    !data.is_empty()
        && !is_binary_axml(data)
        && !data.starts_with(b"<?xml")
        && !data.starts_with(b"<manifest")
        && !looks_like_text(data)
}

fn manifest_xml_looks_decoded(xml: &str) -> bool {
    if xml.is_empty() {
        return false;
    }
    if xml.contains('\0') {
        return false;
    }
    let sample: String = xml.chars().take(200).collect();
    let has_tag = sample.contains("<manifest")
        || sample.contains("<?xml")
        || sample.contains("<application")
        || sample.contains("<activity");
    if !has_tag {
        return false;
    }
    let replacement = sample.chars().filter(|c| *c == '\u{FFFD}').count();
    replacement * 10 < sample.chars().count().max(1)
}

fn decode_manifest_bytes(package_path: &Path, entry: &str, buf: &[u8]) -> Option<String> {
    let bytes = if buf.is_empty() {
        read_zip_entry_bytes(package_path, entry).ok()?
    } else {
        buf.to_vec()
    };

    if is_binary_axml(&bytes) {
        let arsc = read_zip_entry_bytes(package_path, "resources.arsc").ok();
        return decode_axml_to_string(&bytes, arsc.as_deref());
    }

    // AAB protobuf manifest (or any non-AXML AndroidManifest.xml)
    if entry.ends_with("AndroidManifest.xml") || entry.ends_with("androidmanifest.xml") {
        if let Ok(parsed) = crate::aab::parse_manifest_pb(&bytes, false) {
            if manifest_xml_looks_decoded(&parsed.manifest.xml) {
                return Some(parsed.manifest.xml);
            }
        }
    }

    None
}

fn decode_axml_to_string(bytes: &[u8], arsc_bytes: Option<&[u8]>) -> Option<String> {
    let arsc = arsc_bytes.and_then(|b| ARSC::new(&mut &b[..]).ok());
    let axml = AXML::new(&mut &bytes[..], arsc.as_ref()).ok()?;
    let xml = axml.get_xml_string();
    if manifest_xml_looks_decoded(&xml) {
        Some(xml)
    } else {
        None
    }
}

