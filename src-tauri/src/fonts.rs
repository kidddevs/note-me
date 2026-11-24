use std::collections::{BTreeMap, HashSet};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;

const MAX_FONT_FILE_BYTES: u64 = 25 * 1024 * 1024;
const FONT_EXTENSIONS: [&str; 3] = ["ttf", "otf", "ttc"];

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FontAxis {
    pub tag: String,
    pub min: f32,
    pub default: f32,
    pub max: f32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemFontAsset {
    pub family: String,
    pub path: String,
    pub extension: String,
    pub bytes: u64,
    pub weight: u16,
    pub style: String,
    pub axes: Vec<FontAxis>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemFontAssetData {
    pub path: String,
    pub extension: String,
    pub bytes: Vec<u8>,
}

#[tauri::command]
pub fn list_system_fonts() -> Result<Vec<String>, String> {
    let mut names = BTreeMap::new();
    for path in system_font_files() {
        let Ok(metadata) = fs::metadata(&path) else {
            continue;
        };
        if metadata.len() > MAX_FONT_FILE_BYTES {
            continue;
        }
        let Ok(bytes) = fs::read(&path) else {
            continue;
        };
        for face in font_faces(&bytes) {
            for name in face.families {
                let key = name.to_lowercase();
                names.entry(key).or_insert(name);
            }
        }
    }
    Ok(names.into_values().collect())
}

#[tauri::command]
pub fn list_system_font_assets() -> Result<Vec<SystemFontAsset>, String> {
    let mut assets = Vec::new();
    for path in system_font_files() {
        let Ok(metadata) = fs::metadata(&path) else {
            continue;
        };
        if metadata.len() > MAX_FONT_FILE_BYTES {
            continue;
        }
        let Ok(bytes) = fs::read(&path) else {
            continue;
        };
        let Some(extension) = font_extension(&path) else {
            continue;
        };
        let path = path.to_string_lossy().into_owned();
        for face in font_faces(&bytes) {
            for family in face.families {
                assets.push(SystemFontAsset {
                    family,
                    path: path.clone(),
                    extension: extension.to_string(),
                    bytes: metadata.len(),
                    weight: face.weight,
                    style: face.style.clone(),
                    axes: face.axes.clone(),
                });
            }
        }
    }
    assets.sort_by(|left, right| {
        left.family
            .to_lowercase()
            .cmp(&right.family.to_lowercase())
            .then_with(|| left.weight.cmp(&right.weight))
            .then_with(|| left.style.cmp(&right.style))
            .then_with(|| left.axes.len().cmp(&right.axes.len()))
            .then_with(|| left.path.cmp(&right.path))
    });
    assets.dedup_by(|left, right| {
        left.family.eq_ignore_ascii_case(&right.family)
            && left.path == right.path
            && left.weight == right.weight
            && left.style == right.style
            && left.axes == right.axes
    });
    Ok(assets)
}

#[tauri::command]
pub fn read_system_font_asset(path: String) -> Result<SystemFontAssetData, String> {
    let path = validated_font_path(&path)
        .ok_or_else(|| "Font file is not available for export".to_string())?;
    let bytes = fs::read(&path).map_err(|error| format!("Could not read font file: {error}"))?;
    let extension = font_extension(&path).unwrap_or_else(|| "ttf".to_string());
    Ok(SystemFontAssetData {
        path: path.to_string_lossy().into_owned(),
        extension,
        bytes,
    })
}

fn system_font_files() -> Vec<PathBuf> {
    let mut files = Vec::new();
    let mut visited = HashSet::new();
    for root in font_roots() {
        collect_font_files(&root, &mut visited, &mut files);
    }
    files.sort();
    files
}

fn font_extension(path: &Path) -> Option<String> {
    let extension = path.extension()?.to_str()?.to_ascii_lowercase();
    if FONT_EXTENSIONS.contains(&extension.as_str()) {
        Some(extension)
    } else {
        None
    }
}

fn validated_font_path(value: &str) -> Option<PathBuf> {
    let path = fs::canonicalize(value).ok()?;
    let extension = font_extension(&path)?;
    let metadata = fs::metadata(&path).ok()?;
    if metadata.len() > MAX_FONT_FILE_BYTES
        || !FONT_EXTENSIONS
            .iter()
            .any(|candidate| *candidate == extension)
    {
        return None;
    }
    let inside_font_root = font_roots()
        .into_iter()
        .filter_map(|root| fs::canonicalize(root).ok())
        .any(|root| path.starts_with(root));
    inside_font_root.then_some(path)
}

fn font_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();
    let home = env::var_os("HOME")
        .or_else(|| env::var_os("USERPROFILE"))
        .map(PathBuf::from);

    #[cfg(target_os = "macos")]
    {
        if let Some(home) = &home {
            roots.push(home.join("Library/Fonts"));
        }
        roots.extend([
            PathBuf::from("/Library/Fonts"),
            PathBuf::from("/System/Library/Fonts"),
            PathBuf::from("/System/Library/Fonts/Supplemental"),
        ]);
    }

    #[cfg(target_os = "windows")]
    {
        if let Some(home) = &home {
            roots.push(home.join("AppData/Local/Microsoft/Windows/Fonts"));
            roots.push(home.join("AppData/Roaming/Microsoft/Windows/Fonts"));
        }
        if let Some(local_app_data) = env::var_os("LOCALAPPDATA") {
            roots.push(PathBuf::from(local_app_data).join("Microsoft/Windows/Fonts"));
        }
        if let Some(windir) = env::var_os("WINDIR") {
            roots.push(PathBuf::from(windir).join("Fonts"));
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Some(home) = &home {
            roots.extend([home.join(".local/share/fonts"), home.join(".fonts")]);
        }
        if let Some(data_home) = env::var_os("XDG_DATA_HOME") {
            roots.push(PathBuf::from(data_home).join("fonts"));
        }
        roots.extend([
            PathBuf::from("/usr/local/share/fonts"),
            PathBuf::from("/usr/share/fonts"),
        ]);
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "linux")))]
    {
        if let Some(home) = &home {
            roots.push(home.join(".local/share/fonts"));
        }
        roots.push(PathBuf::from("/usr/share/fonts"));
    }

    roots
}

fn collect_font_files(path: &Path, visited: &mut HashSet<PathBuf>, files: &mut Vec<PathBuf>) {
    if !path.is_dir() {
        return;
    }
    let key = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    if !visited.insert(key) {
        return;
    }
    let Ok(entries) = fs::read_dir(path) else {
        return;
    };
    for entry in entries.flatten() {
        let child = entry.path();
        if child.is_dir() {
            collect_font_files(&child, visited, files);
            continue;
        }
        let Some(extension) = child.extension().and_then(|value| value.to_str()) else {
            continue;
        };
        if FONT_EXTENSIONS.contains(&extension.to_ascii_lowercase().as_str()) {
            files.push(child);
        }
    }
}

fn read_u16(data: &[u8], offset: usize) -> Option<u16> {
    let bytes = data.get(offset..offset.checked_add(2)?)?;
    Some(u16::from_be_bytes([bytes[0], bytes[1]]))
}

fn read_u32(data: &[u8], offset: usize) -> Option<u32> {
    let bytes = data.get(offset..offset.checked_add(4)?)?;
    Some(u32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
}

fn read_i32(data: &[u8], offset: usize) -> Option<i32> {
    let bytes = data.get(offset..offset.checked_add(4)?)?;
    Some(i32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
}

#[derive(Debug)]
struct FontFace {
    families: Vec<String>,
    weight: u16,
    style: String,
    axes: Vec<FontAxis>,
}

fn sfnt_offsets(data: &[u8]) -> Vec<usize> {
    if !data.starts_with(b"ttcf") {
        return vec![0];
    }
    let Some(count) = read_u32(data, 8) else {
        return Vec::new();
    };
    (0..count.min(2048))
        .filter_map(|index| read_u32(data, 12 + index as usize * 4).map(|offset| offset as usize))
        .collect()
}

#[cfg(test)]
fn font_family_names(data: &[u8]) -> Vec<String> {
    font_faces(data)
        .into_iter()
        .flat_map(|face| face.families)
        .collect()
}

fn font_faces(data: &[u8]) -> Vec<FontFace> {
    let mut faces = Vec::new();
    for sfnt_offset in sfnt_offsets(data) {
        let Some(table_count_offset) = sfnt_offset.checked_add(4) else {
            continue;
        };
        let Some(table_count) = read_u16(data, table_count_offset) else {
            continue;
        };
        let mut name_table = None;
        let mut os2_table = None;
        let mut head_table = None;
        let mut fvar_table = None;
        for index in 0..table_count as usize {
            let Some(record) = sfnt_offset
                .checked_add(12)
                .and_then(|value| value.checked_add(index * 16))
            else {
                continue;
            };
            let Some(tag_end) = record.checked_add(4) else {
                continue;
            };
            let Some(table_offset) = read_u32(data, record + 8).map(|value| value as usize) else {
                continue;
            };
            let Some(table_length) = read_u32(data, record + 12).map(|value| value as usize) else {
                continue;
            };
            let Some(table_end) = table_offset.checked_add(table_length) else {
                continue;
            };
            if table_end > data.len() {
                continue;
            }
            match data.get(record..tag_end) {
                Some(b"name") => name_table = Some((table_offset, table_end)),
                Some(b"OS/2") => os2_table = Some((table_offset, table_end)),
                Some(b"head") => head_table = Some((table_offset, table_end)),
                Some(b"fvar") => fvar_table = Some((table_offset, table_end)),
                _ => {}
            }
        }
        let Some((name_offset, name_end)) = name_table else {
            continue;
        };
        let families = parse_name_table(data, name_offset, name_end);
        if families.is_empty() {
            continue;
        }
        let weight = os2_table
            .and_then(|(offset, end)| read_u16(data, offset + 4).filter(|_| offset + 6 <= end))
            .map(normalize_font_weight)
            .unwrap_or(400);
        let style = head_table
            .and_then(|(offset, end)| read_u16(data, offset + 44).filter(|_| offset + 46 <= end))
            .map(|mac_style| {
                if mac_style & 0x0002 != 0 {
                    "italic".to_string()
                } else {
                    "normal".to_string()
                }
            })
            .unwrap_or_else(|| "normal".to_string());
        let axes = fvar_table
            .map(|table| parse_fvar(data, table))
            .unwrap_or_default();
        faces.push(FontFace {
            families,
            weight,
            style,
            axes,
        });
    }
    faces
}

fn parse_fvar(data: &[u8], (table_offset, table_end): (usize, usize)) -> Vec<FontAxis> {
    let Some(axis_array_offset) = read_u16(data, table_offset + 4).map(|value| value as usize)
    else {
        return Vec::new();
    };
    let Some(axis_count) = read_u16(data, table_offset + 8) else {
        return Vec::new();
    };
    let Some(axis_size) = read_u16(data, table_offset + 10).map(|value| value as usize) else {
        return Vec::new();
    };
    if axis_size < 20 || axis_count > 128 {
        return Vec::new();
    }
    let Some(axis_start) = table_offset.checked_add(axis_array_offset) else {
        return Vec::new();
    };
    let mut axes = Vec::new();
    for index in 0..axis_count as usize {
        let Some(record) = axis_start.checked_add(index.saturating_mul(axis_size)) else {
            continue;
        };
        let Some(record_end) = record.checked_add(20) else {
            continue;
        };
        if record_end > table_end {
            continue;
        }
        let Some(tag_bytes) = data.get(record..record + 4) else {
            continue;
        };
        if !tag_bytes.iter().all(|byte| byte.is_ascii_alphanumeric()) {
            continue;
        }
        let tag = String::from_utf8(tag_bytes.to_vec()).unwrap_or_default();
        let Some(min) = read_i32(data, record + 4).map(|value| value as f32 / 65536.0) else {
            continue;
        };
        let Some(default) = read_i32(data, record + 8).map(|value| value as f32 / 65536.0) else {
            continue;
        };
        let Some(max) = read_i32(data, record + 12).map(|value| value as f32 / 65536.0) else {
            continue;
        };
        if !min.is_finite()
            || !default.is_finite()
            || !max.is_finite()
            || min > max
            || default < min
            || default > max
        {
            continue;
        }
        axes.push(FontAxis {
            tag,
            min,
            default,
            max,
        });
    }
    axes
}

fn normalize_font_weight(value: u16) -> u16 {
    let value = value.clamp(100, 900);
    (((value + 50) / 100) * 100).clamp(100, 900)
}

fn parse_name_table(data: &[u8], table_offset: usize, table_end: usize) -> Vec<String> {
    let Some(record_count_offset) = table_offset.checked_add(2) else {
        return Vec::new();
    };
    let Some(record_count) = read_u16(data, record_count_offset) else {
        return Vec::new();
    };
    let Some(string_offset_position) = table_offset.checked_add(4) else {
        return Vec::new();
    };
    let Some(string_offset) = read_u16(data, string_offset_position).map(|value| value as usize)
    else {
        return Vec::new();
    };
    let mut candidates: Vec<(u8, String)> = Vec::new();
    for index in 0..record_count as usize {
        let Some(record) = table_offset
            .checked_add(6)
            .and_then(|value| value.checked_add(index * 12))
        else {
            continue;
        };
        let Some(platform) = read_u16(data, record) else {
            continue;
        };
        let Some(encoding) = read_u16(data, record + 2) else {
            continue;
        };
        let Some(name_id) = read_u16(data, record + 6) else {
            continue;
        };
        if name_id != 1 && name_id != 16 {
            continue;
        }
        let Some(length) = read_u16(data, record + 8).map(|value| value as usize) else {
            continue;
        };
        let Some(offset) = read_u16(data, record + 10).map(|value| value as usize) else {
            continue;
        };
        let Some(start) = table_offset
            .checked_add(string_offset)
            .and_then(|value| value.checked_add(offset))
        else {
            continue;
        };
        let Some(end) = start.checked_add(length) else {
            continue;
        };
        if end > table_end {
            continue;
        }
        let Some(decoded) =
            decode_name(data.get(start..end).unwrap_or_default(), platform, encoding)
        else {
            continue;
        };
        let Some(normalized) = normalize_font_name(&decoded) else {
            continue;
        };
        let preference =
            if name_id == 16 { 0 } else { 10 } + if platform == 0 || platform == 3 { 0 } else { 2 };
        candidates.push((preference, normalized));
    }
    candidates.sort_by_key(|(preference, _)| *preference);
    candidates.into_iter().map(|(_, name)| name).collect()
}

fn decode_name(bytes: &[u8], platform: u16, _encoding: u16) -> Option<String> {
    if platform == 0 || platform == 3 {
        let mut units = Vec::with_capacity(bytes.len() / 2);
        for pair in bytes.chunks_exact(2) {
            units.push(u16::from_be_bytes([pair[0], pair[1]]));
        }
        String::from_utf16(&units).ok()
    } else {
        Some(String::from_utf8_lossy(bytes).into_owned())
    }
}

fn normalize_font_name(value: &str) -> Option<String> {
    let normalized = value.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.is_empty() || normalized.chars().count() > 120 {
        return None;
    }
    if !normalized
        .chars()
        .any(|character| character.is_alphanumeric())
    {
        return None;
    }
    if normalized.chars().all(|character| {
        character.is_alphanumeric() || character.is_whitespace() || ",._-'&()+".contains(character)
    }) {
        Some(normalized)
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::{
        font_faces, font_family_names, normalize_font_name, normalize_font_weight, parse_fvar,
    };

    fn write_u16(data: &mut [u8], offset: usize, value: u16) {
        data[offset..offset + 2].copy_from_slice(&value.to_be_bytes());
    }

    fn write_u32(data: &mut [u8], offset: usize, value: u32) {
        data[offset..offset + 4].copy_from_slice(&value.to_be_bytes());
    }

    fn write_i32(data: &mut [u8], offset: usize, value: i32) {
        data[offset..offset + 4].copy_from_slice(&value.to_be_bytes());
    }

    fn synthetic_font() -> Vec<u8> {
        let family = "Book Sans";
        let typographic_family = "Book Sans Text";
        let family_bytes: Vec<u8> = family.encode_utf16().flat_map(u16::to_be_bytes).collect();
        let typographic_bytes: Vec<u8> = typographic_family
            .encode_utf16()
            .flat_map(u16::to_be_bytes)
            .collect();
        let table_offset = 28;
        let string_offset = 30;
        let table_length = string_offset + family_bytes.len() + typographic_bytes.len();
        let mut data = vec![0; table_offset + table_length];
        write_u16(&mut data, 4, 1);
        data[12..16].copy_from_slice(b"name");
        write_u32(&mut data, 20, table_offset as u32);
        write_u32(&mut data, 24, table_length as u32);
        write_u16(&mut data, table_offset + 2, 2);
        write_u16(&mut data, table_offset + 4, string_offset as u16);
        let first_record = table_offset + 6;
        write_u16(&mut data, first_record, 3);
        write_u16(&mut data, first_record + 2, 1);
        write_u16(&mut data, first_record + 4, 0x0409);
        write_u16(&mut data, first_record + 6, 1);
        write_u16(&mut data, first_record + 8, family_bytes.len() as u16);
        let second_record = first_record + 12;
        write_u16(&mut data, second_record, 3);
        write_u16(&mut data, second_record + 2, 1);
        write_u16(&mut data, second_record + 4, 0x0409);
        write_u16(&mut data, second_record + 6, 16);
        write_u16(&mut data, second_record + 8, typographic_bytes.len() as u16);
        write_u16(&mut data, second_record + 10, family_bytes.len() as u16);
        let strings = table_offset + string_offset;
        data[strings..strings + family_bytes.len()].copy_from_slice(&family_bytes);
        data[strings + family_bytes.len()..].copy_from_slice(&typographic_bytes);
        data
    }

    fn synthetic_fvar() -> Vec<u8> {
        let table_offset = 16;
        let axis_offset = table_offset + 16;
        let mut data = vec![0; axis_offset + 20];
        write_u16(&mut data, table_offset + 4, 16);
        write_u16(&mut data, table_offset + 8, 1);
        write_u16(&mut data, table_offset + 10, 20);
        data[axis_offset..axis_offset + 4].copy_from_slice(b"wght");
        write_i32(&mut data, axis_offset + 4, 100 << 16);
        write_i32(&mut data, axis_offset + 8, 400 << 16);
        write_i32(&mut data, axis_offset + 12, 900 << 16);
        data
    }

    #[test]
    fn extracts_family_names_from_name_table() {
        let names = font_family_names(&synthetic_font());
        assert!(names.iter().any(|name| name == "Book Sans"));
        assert!(names.iter().any(|name| name == "Book Sans Text"));
    }

    #[test]
    fn font_faces_default_to_regular_when_optional_metrics_are_missing() {
        let faces = font_faces(&synthetic_font());
        assert_eq!(faces.len(), 1);
        assert_eq!(faces[0].weight, 400);
        assert_eq!(faces[0].style, "normal");
    }

    #[test]
    fn font_weights_normalize_to_css_steps() {
        assert_eq!(normalize_font_weight(50), 100);
        assert_eq!(normalize_font_weight(550), 600);
        assert_eq!(normalize_font_weight(950), 900);
    }

    #[test]
    fn extracts_variable_font_axis_ranges() {
        let axes = parse_fvar(&synthetic_fvar(), (16, 52));
        assert_eq!(axes.len(), 1);
        assert_eq!(axes[0].tag, "wght");
        assert_eq!(axes[0].min, 100.0);
        assert_eq!(axes[0].default, 400.0);
        assert_eq!(axes[0].max, 900.0);
    }

    #[test]
    fn rejects_unsafe_or_empty_family_names() {
        assert_eq!(normalize_font_name(""), None);
        assert_eq!(normalize_font_name("font; color: red"), None);
        assert_eq!(
            normalize_font_name("Noto Sans CJK"),
            Some("Noto Sans CJK".to_string())
        );
    }
}
