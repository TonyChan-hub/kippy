//! Minimal Android App Bundle (AAB) support.
//!
//! AABs store `base/manifest/AndroidManifest.xml` as protobuf `aapt.pb.XmlNode`
//! (not binary AXML). This module hand-rolls a small protobuf walker for the
//! fields we need and turns the tree into a readable XML string + summary.

use crate::apk::{ApkError, ComponentInfo, ManifestInfo};
use std::collections::BTreeMap;

const MAX_DEPTH: usize = 64;
const WIRE_VARINT: u8 = 0;
const WIRE_I64: u8 = 1;
const WIRE_LEN: u8 = 2;
const WIRE_I32: u8 = 5;

#[derive(Debug, Clone)]
struct XmlElement {
    name: String,
    attributes: BTreeMap<String, String>,
    children: Vec<XmlElement>,
}

#[derive(Debug, Clone)]
pub struct AabManifestSummary {
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
    pub multidex: bool,
    pub manifest: ManifestInfo,
}

pub fn parse_manifest_pb(bytes: &[u8], multidex: bool) -> Result<AabManifestSummary, ApkError> {
    let root = decode_xml_node(bytes, 0)?;
    let xml = element_to_xml(&root, 0);
    let mut permissions = Vec::new();
    let mut features = Vec::new();
    let mut activities = Vec::new();
    let mut services = Vec::new();
    let mut receivers = Vec::new();
    let mut providers = Vec::new();

    let mut package_name = None;
    let mut version_name = None;
    let mut version_code = None;
    let mut min_sdk = None;
    let mut target_sdk = 1u32;
    let mut compile_sdk = None;
    let mut label = None;
    let mut debuggable = None;
    let mut allow_backup = None;
    let mut main_activity = None;

    walk(&root, &mut |el| {
        match el.name.as_str() {
            "manifest" => {
                package_name = attr(el, "package");
                version_name = attr(el, "versionName").or_else(|| attr(el, "android:versionName"));
                version_code = attr(el, "versionCode").or_else(|| attr(el, "android:versionCode"));
                compile_sdk = attr(el, "compileSdkVersion")
                    .or_else(|| attr(el, "android:compileSdkVersion"))
                    .or_else(|| attr(el, "platformBuildVersionCode"));
            }
            "uses-sdk" => {
                min_sdk = attr(el, "minSdkVersion").or_else(|| attr(el, "android:minSdkVersion"));
                if let Some(t) = attr(el, "targetSdkVersion").or_else(|| attr(el, "android:targetSdkVersion"))
                {
                    if let Ok(n) = t.parse::<u32>() {
                        target_sdk = n;
                    }
                } else if let Some(m) = &min_sdk {
                    if let Ok(n) = m.parse::<u32>() {
                        target_sdk = n;
                    }
                }
            }
            "uses-permission" | "uses-permission-sdk-23" => {
                if let Some(name) = attr(el, "name").or_else(|| attr(el, "android:name")) {
                    permissions.push(name);
                }
            }
            "uses-feature" => {
                if let Some(name) = attr(el, "name").or_else(|| attr(el, "android:name")) {
                    features.push(name);
                }
            }
            "application" => {
                label = attr(el, "label").or_else(|| attr(el, "android:label"));
                debuggable = attr(el, "debuggable").or_else(|| attr(el, "android:debuggable"));
                allow_backup = attr(el, "allowBackup").or_else(|| attr(el, "android:allowBackup"));
            }
            "activity" | "activity-alias" => {
                if let Some(comp) = component_from(el) {
                    if is_launcher(el) && main_activity.is_none() {
                        main_activity = Some(comp.name.clone());
                    }
                    activities.push(comp);
                }
            }
            "service" => {
                if let Some(comp) = component_from(el) {
                    services.push(comp);
                }
            }
            "receiver" => {
                if let Some(comp) = component_from(el) {
                    receivers.push(comp);
                }
            }
            "provider" => {
                if let Some(comp) = component_from(el) {
                    providers.push(comp);
                }
            }
            _ => {}
        }
    });

    permissions.sort();
    permissions.dedup();
    features.sort();
    features.dedup();

    Ok(AabManifestSummary {
        package_name,
        version_name,
        version_code,
        min_sdk,
        target_sdk,
        compile_sdk,
        label,
        debuggable,
        allow_backup,
        main_activity,
        multidex,
        manifest: ManifestInfo {
            xml,
            permissions,
            features,
            activities,
            services,
            receivers,
            providers,
        },
    })
}

fn component_from(el: &XmlElement) -> Option<ComponentInfo> {
    let name = attr(el, "name").or_else(|| attr(el, "android:name"))?;
    Some(ComponentInfo {
        name,
        exported: attr(el, "exported").or_else(|| attr(el, "android:exported")),
        enabled: attr(el, "enabled").or_else(|| attr(el, "android:enabled")),
        permission: attr(el, "permission").or_else(|| attr(el, "android:permission")),
    })
}

fn is_launcher(el: &XmlElement) -> bool {
    let mut has_main = false;
    let mut has_launcher = false;
    for child in &el.children {
        if child.name != "intent-filter" {
            continue;
        }
        for nested in &child.children {
            if nested.name == "action" {
                let n = attr(nested, "name").or_else(|| attr(nested, "android:name"));
                if n.as_deref() == Some("android.intent.action.MAIN") {
                    has_main = true;
                }
            }
            if nested.name == "category" {
                let n = attr(nested, "name").or_else(|| attr(nested, "android:name"));
                if matches!(
                    n.as_deref(),
                    Some("android.intent.category.LAUNCHER") | Some("android.intent.category.INFO")
                ) {
                    has_launcher = true;
                }
            }
        }
    }
    has_main && has_launcher
}

fn attr(el: &XmlElement, key: &str) -> Option<String> {
    if let Some(v) = el.attributes.get(key) {
        if !v.is_empty() {
            return Some(v.clone());
        }
    }
    // Attributes may be stored without android: prefix in protobuf.
    let short = key.strip_prefix("android:").unwrap_or(key);
    el.attributes.get(short).cloned().filter(|v| !v.is_empty())
}

fn walk(el: &XmlElement, f: &mut dyn FnMut(&XmlElement)) {
    f(el);
    for child in &el.children {
        walk(child, f);
    }
}

fn element_to_xml(el: &XmlElement, depth: usize) -> String {
    let indent = "  ".repeat(depth);
    let mut attrs = String::new();
    for (k, v) in &el.attributes {
        attrs.push_str(&format!(" {}=\"{}\"", k, xml_escape(v)));
    }
    if el.children.is_empty() {
        format!("{indent}<{}{attrs} />\n", el.name)
    } else {
        let mut out = format!("{indent}<{}{attrs}>\n", el.name);
        for child in &el.children {
            out.push_str(&element_to_xml(child, depth + 1));
        }
        out.push_str(&format!("{indent}</{}>\n", el.name));
        out
    }
}

fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('"', "&quot;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

fn decode_xml_node(buf: &[u8], depth: usize) -> Result<XmlElement, ApkError> {
    if depth >= MAX_DEPTH {
        return Err(ApkError::Message("AAB manifest nesting too deep".into()));
    }
    let mut pos = 0;
    while pos < buf.len() {
        let (field, wire) = read_tag(buf, &mut pos)?;
        match (field, wire) {
            (1, WIRE_LEN) => {
                let slice = read_len(buf, &mut pos)?;
                return decode_xml_element(slice, depth);
            }
            _ => skip_field(buf, &mut pos, wire)?,
        }
    }
    Err(ApkError::Message("AAB XmlNode has no element".into()))
}

fn decode_xml_element(buf: &[u8], depth: usize) -> Result<XmlElement, ApkError> {
    let mut name = String::new();
    let mut attributes = BTreeMap::new();
    let mut children = Vec::new();
    let mut pos = 0;
    while pos < buf.len() {
        let (field, wire) = read_tag(buf, &mut pos)?;
        match (field, wire) {
            (1, WIRE_LEN) => {
                let _ = read_len(buf, &mut pos)?;
            }
            (2, WIRE_LEN) => {
                let _ = read_len(buf, &mut pos)?;
            }
            (3, WIRE_LEN) => {
                name = read_string(buf, &mut pos)?;
            }
            (4, WIRE_LEN) => {
                let slice = read_len(buf, &mut pos)?;
                let (key, value) = decode_xml_attribute(slice)?;
                if !key.is_empty() {
                    attributes.insert(key, value);
                }
            }
            (5, WIRE_LEN) => {
                let slice = read_len(buf, &mut pos)?;
                if let Ok(child) = decode_xml_node(slice, depth + 1) {
                    children.push(child);
                }
            }
            _ => skip_field(buf, &mut pos, wire)?,
        }
    }
    Ok(XmlElement {
        name,
        attributes,
        children,
    })
}

fn decode_xml_attribute(buf: &[u8]) -> Result<(String, String), ApkError> {
    let mut ns = String::new();
    let mut name = String::new();
    let mut value = String::new();
    let mut compiled = None::<String>;
    let mut pos = 0;
    while pos < buf.len() {
        let (field, wire) = read_tag(buf, &mut pos)?;
        match (field, wire) {
            (1, WIRE_LEN) => ns = read_string(buf, &mut pos)?,
            (2, WIRE_LEN) => name = read_string(buf, &mut pos)?,
            (3, WIRE_LEN) => value = read_string(buf, &mut pos)?,
            (6, WIRE_LEN) => {
                let slice = read_len(buf, &mut pos)?;
                compiled = decode_item(slice)?;
            }
            _ => skip_field(buf, &mut pos, wire)?,
        }
    }

    let key = if ns.contains("android.com/apk/res/android") || ns.ends_with("/apk/res/android") {
        format!("android:{name}")
    } else if ns.is_empty() {
        name
    } else {
        name
    };

    let final_value = if !value.is_empty() {
        value
    } else {
        compiled.unwrap_or_default()
    };
    Ok((key, final_value))
}

fn decode_item(buf: &[u8]) -> Result<Option<String>, ApkError> {
    let mut pos = 0;
    while pos < buf.len() {
        let (field, wire) = read_tag(buf, &mut pos)?;
        match (field, wire) {
            (1, WIRE_LEN) => {
                let slice = read_len(buf, &mut pos)?;
                return Ok(Some(decode_reference(slice)?));
            }
            (2, WIRE_LEN) => {
                let slice = read_len(buf, &mut pos)?;
                return Ok(Some(decode_string_message(slice)?));
            }
            (7, WIRE_LEN) => {
                let slice = read_len(buf, &mut pos)?;
                return Ok(Some(decode_primitive(slice)?));
            }
            _ => skip_field(buf, &mut pos, wire)?,
        }
    }
    Ok(None)
}

fn decode_reference(buf: &[u8]) -> Result<String, ApkError> {
    let mut id = 0u32;
    let mut name = String::new();
    let mut pos = 0;
    while pos < buf.len() {
        let (field, wire) = read_tag(buf, &mut pos)?;
        match (field, wire) {
            (1, WIRE_VARINT) => id = read_varint(buf, &mut pos)? as u32,
            (2, WIRE_LEN) => name = read_string(buf, &mut pos)?,
            _ => skip_field(buf, &mut pos, wire)?,
        }
    }
    if !name.is_empty() {
        Ok(name)
    } else if id != 0 {
        Ok(format!("@{id:#x}"))
    } else {
        Ok(String::new())
    }
}

fn decode_string_message(buf: &[u8]) -> Result<String, ApkError> {
    let mut pos = 0;
    while pos < buf.len() {
        let (field, wire) = read_tag(buf, &mut pos)?;
        match (field, wire) {
            (1, WIRE_LEN) => return read_string(buf, &mut pos),
            _ => skip_field(buf, &mut pos, wire)?,
        }
    }
    Ok(String::new())
}

fn decode_primitive(buf: &[u8]) -> Result<String, ApkError> {
    let mut pos = 0;
    while pos < buf.len() {
        let (field, wire) = read_tag(buf, &mut pos)?;
        match (field, wire) {
            // null_value = 1
            (1, WIRE_VARINT) => {
                let _ = read_varint(buf, &mut pos)?;
                return Ok(String::new());
            }
            // float_value = 2 (fixed32)
            (2, WIRE_I32) => {
                let bits = read_fixed32(buf, &mut pos)?;
                return Ok(f32::from_bits(bits).to_string());
            }
            // int_decimal_value = 4
            (4, WIRE_VARINT) => {
                let v = read_varint(buf, &mut pos)? as i32;
                return Ok(v.to_string());
            }
            // int_hexadecimal_value = 5
            (5, WIRE_VARINT) => {
                let v = read_varint(buf, &mut pos)? as u32;
                return Ok(format!("{v:#x}"));
            }
            // boolean_value = 6
            (6, WIRE_VARINT) => {
                let v = read_varint(buf, &mut pos)?;
                return Ok(if v != 0 { "true".into() } else { "false".into() });
            }
            _ => skip_field(buf, &mut pos, wire)?,
        }
    }
    Ok(String::new())
}

fn read_tag(buf: &[u8], pos: &mut usize) -> Result<(u32, u8), ApkError> {
    let tag = read_varint(buf, pos)?;
    Ok(((tag >> 3) as u32, (tag & 0x07) as u8))
}

fn read_varint(buf: &[u8], pos: &mut usize) -> Result<u64, ApkError> {
    let mut result = 0u64;
    let mut shift = 0u32;
    loop {
        let b = *buf
            .get(*pos)
            .ok_or_else(|| ApkError::Message("truncated protobuf varint".into()))?;
        *pos += 1;
        result |= u64::from(b & 0x7f) << shift;
        if b & 0x80 == 0 {
            return Ok(result);
        }
        shift += 7;
        if shift >= 64 {
            return Err(ApkError::Message("protobuf varint overflow".into()));
        }
    }
}

fn read_len<'a>(buf: &'a [u8], pos: &mut usize) -> Result<&'a [u8], ApkError> {
    let len = read_varint(buf, pos)? as usize;
    let end = pos
        .checked_add(len)
        .ok_or_else(|| ApkError::Message("protobuf length overflow".into()))?;
    let slice = buf
        .get(*pos..end)
        .ok_or_else(|| ApkError::Message("truncated protobuf length-delimited field".into()))?;
    *pos = end;
    Ok(slice)
}

fn read_string(buf: &[u8], pos: &mut usize) -> Result<String, ApkError> {
    let slice = read_len(buf, pos)?;
    Ok(String::from_utf8_lossy(slice).into_owned())
}

fn read_fixed32(buf: &[u8], pos: &mut usize) -> Result<u32, ApkError> {
    let end = pos
        .checked_add(4)
        .ok_or_else(|| ApkError::Message("protobuf fixed32 overflow".into()))?;
    let bytes = buf
        .get(*pos..end)
        .ok_or_else(|| ApkError::Message("truncated protobuf fixed32".into()))?;
    *pos = end;
    Ok(u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
}

fn skip_field(buf: &[u8], pos: &mut usize, wire: u8) -> Result<(), ApkError> {
    match wire {
        WIRE_VARINT => {
            read_varint(buf, pos)?;
        }
        WIRE_I64 => {
            *pos = pos
                .checked_add(8)
                .ok_or_else(|| ApkError::Message("protobuf skip overflow".into()))?;
            if *pos > buf.len() {
                return Err(ApkError::Message("protobuf skip overrun".into()));
            }
        }
        WIRE_LEN => {
            let _ = read_len(buf, pos)?;
        }
        WIRE_I32 => {
            *pos = pos
                .checked_add(4)
                .ok_or_else(|| ApkError::Message("protobuf skip overflow".into()))?;
            if *pos > buf.len() {
                return Err(ApkError::Message("protobuf skip overrun".into()));
            }
        }
        _ => return Err(ApkError::Message(format!("unknown protobuf wire type {wire}"))),
    }
    Ok(())
}
