#![deny(clippy::all)]

use napi_derive::napi;
use rusqlite::{params, Connection, Result as SqlResult};
use std::path::PathBuf;
use directories::ProjectDirs;

// Note: ring and base64 imports commented out until AES encryption is implemented
// use ring::aead::{Aad, LessSafeKey, Nonce, UnboundKey, AES_256_GCM};
// use ring::rand::{SecureRandom, SystemRandom};
// use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

/// Secret item returned to JavaScript
#[napi(object)]
pub struct SecretItem {
    pub id: u32,
    pub key: String,
    pub value_masked: String,
}

/// Get the database path
fn get_db_path() -> PathBuf {
    if let Some(proj_dirs) = ProjectDirs::from("com", "envvault", "EnvVault") {
        let data_dir = proj_dirs.data_dir();
        std::fs::create_dir_all(data_dir).ok();
        data_dir.join("vault.db")
    } else {
        PathBuf::from("vault.db")
    }
}

/// Initialize the database
#[napi]
pub fn init_database() -> bool {
    let conn = match Connection::open(get_db_path()) {
        Ok(c) => c,
        Err(_) => return false,
    };

    let result = conn.execute(
        "CREATE TABLE IF NOT EXISTS secrets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT NOT NULL UNIQUE,
            value TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    );

    result.is_ok()
}

/// Mask a value for display (show first 8 chars + ...)
fn mask_value(value: &str) -> String {
    if value.len() <= 8 {
        "*".repeat(value.len())
    } else {
        format!("{}...{}", &value[..4], &value[value.len()-4..])
    }
}

/// Search secrets by key pattern
#[napi]
pub fn search_vault(query: String) -> Vec<SecretItem> {
    let conn = match Connection::open(get_db_path()) {
        Ok(c) => c,
        Err(_) => return vec![],
    };

    let search_pattern = format!("%{}%", query);
    let mut stmt = match conn.prepare(
        "SELECT id, key, value FROM secrets WHERE key LIKE ?1 COLLATE NOCASE ORDER BY key ASC LIMIT 20"
    ) {
        Ok(s) => s,
        Err(_) => return vec![],
    };

    let rows = match stmt.query_map(params![search_pattern], |row| {
        let id: u32 = row.get(0)?;
        let key: String = row.get(1)?;
        let value: String = row.get(2)?;
        Ok(SecretItem {
            id,
            key,
            value_masked: mask_value(&value),
        })
    }) {
        Ok(r) => r,
        Err(_) => return vec![],
    };

    rows.filter_map(|r| r.ok()).collect()
}

/// Get all secrets (for initial display)
#[napi]
pub fn get_all_secrets() -> Vec<SecretItem> {
    let conn = match Connection::open(get_db_path()) {
        Ok(c) => c,
        Err(_) => return vec![],
    };

    let mut stmt = match conn.prepare(
        "SELECT id, key, value FROM secrets ORDER BY key ASC LIMIT 50"
    ) {
        Ok(s) => s,
        Err(_) => return vec![],
    };

    let rows = match stmt.query_map([], |row| {
        let id: u32 = row.get(0)?;
        let key: String = row.get(1)?;
        let value: String = row.get(2)?;
        Ok(SecretItem {
            id,
            key,
            value_masked: mask_value(&value),
        })
    }) {
        Ok(r) => r,
        Err(_) => return vec![],
    };

    rows.filter_map(|r| r.ok()).collect()
}

/// Get the full decrypted secret value by ID
#[napi]
pub fn get_full_secret(id: u32) -> Option<String> {
    let conn = match Connection::open(get_db_path()) {
        Ok(c) => c,
        Err(_) => return None,
    };

    let result: SqlResult<String> = conn.query_row(
        "SELECT value FROM secrets WHERE id = ?1",
        params![id],
        |row| row.get(0),
    );

    result.ok()
}

/// Add a new secret
#[napi]
pub fn add_secret(key: String, value: String) -> bool {
    let conn = match Connection::open(get_db_path()) {
        Ok(c) => c,
        Err(_) => return false,
    };

    let result = conn.execute(
        "INSERT OR REPLACE INTO secrets (key, value, updated_at) VALUES (?1, ?2, CURRENT_TIMESTAMP)",
        params![key, value],
    );

    result.is_ok()
}

/// Delete a secret by ID
#[napi]
pub fn delete_secret(id: u32) -> bool {
    let conn = match Connection::open(get_db_path()) {
        Ok(c) => c,
        Err(_) => return false,
    };

    let result = conn.execute(
        "DELETE FROM secrets WHERE id = ?1",
        params![id],
    );

    result.is_ok()
}

/// Update an existing secret
#[napi]
pub fn update_secret(id: u32, value: String) -> bool {
    let conn = match Connection::open(get_db_path()) {
        Ok(c) => c,
        Err(_) => return false,
    };

    let result = conn.execute(
        "UPDATE secrets SET value = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
        params![value, id],
    );

    result.is_ok()
}

/// Import secrets from a .env file format (KEY=VALUE per line)
#[napi]
pub fn import_from_env_string(content: String) -> u32 {
    let conn = match Connection::open(get_db_path()) {
        Ok(c) => c,
        Err(_) => return 0,
    };

    let mut imported = 0u32;
    
    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        
        if let Some((key, value)) = line.split_once('=') {
            let key = key.trim();
            let value = value.trim().trim_matches('"').trim_matches('\'');
            
            if !key.is_empty() {
                let result = conn.execute(
                    "INSERT OR REPLACE INTO secrets (key, value, updated_at) VALUES (?1, ?2, CURRENT_TIMESTAMP)",
                    params![key, value],
                );
                if result.is_ok() {
                    imported += 1;
                }
            }
        }
    }

    imported
}

/// Export all secrets to .env format
#[napi]
pub fn export_to_env_string() -> String {
    let conn = match Connection::open(get_db_path()) {
        Ok(c) => c,
        Err(_) => return String::new(),
    };

    let mut stmt = match conn.prepare("SELECT key, value FROM secrets ORDER BY key ASC") {
        Ok(s) => s,
        Err(_) => return String::new(),
    };

    let rows: Vec<(String, String)> = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .ok()
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default();

    rows.into_iter()
        .map(|(k, v)| format!("{}=\"{}\"", k, v.replace('"', "\\\"")))
        .collect::<Vec<_>>()
        .join("\n")
}

/// Get the path to the envvault shell file
fn get_envvault_path() -> PathBuf {
    if let Some(home) = dirs::home_dir() {
        home.join(".envvault")
    } else {
        PathBuf::from(".envvault")
    }
}

/// Sync all secrets to ~/.envvault file for shell sourcing
#[napi]
pub fn sync_to_shell() -> bool {
    let conn = match Connection::open(get_db_path()) {
        Ok(c) => c,
        Err(_) => return false,
    };

    let mut stmt = match conn.prepare("SELECT key, value FROM secrets ORDER BY key ASC") {
        Ok(s) => s,
        Err(_) => return false,
    };

    let rows: Vec<(String, String)> = stmt
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .ok()
        .map(|rows| rows.filter_map(|r| r.ok()).collect())
        .unwrap_or_default();

    // Generate export statements for shell
    let content: String = rows.into_iter()
        .map(|(k, v)| format!("export {}=\"{}\"", k, v.replace('"', "\\\"")))
        .collect::<Vec<_>>()
        .join("\n");

    let envvault_path = get_envvault_path();
    
    // Write to ~/.envvault
    if std::fs::write(&envvault_path, &content).is_err() {
        return false;
    }

    // Add source line to shell profiles if not already present
    let source_line = "\n# EnvVault secrets\n[ -f ~/.envvault ] && source ~/.envvault\n";
    
    for profile in &[".zshrc", ".bashrc", ".bash_profile"] {
        if let Some(home) = dirs::home_dir() {
            let profile_path = home.join(profile);
            if profile_path.exists() {
                if let Ok(content) = std::fs::read_to_string(&profile_path) {
                    if !content.contains("source ~/.envvault") && !content.contains(". ~/.envvault") {
                        // Append source line
                        let mut file = match std::fs::OpenOptions::new()
                            .append(true)
                            .open(&profile_path) {
                            Ok(f) => f,
                            Err(_) => continue,
                        };
                        use std::io::Write;
                        let _ = file.write_all(source_line.as_bytes());
                    }
                }
            }
        }
    }

    true
}

/// Get the envvault file path for display
#[napi]
pub fn get_envvault_file_path() -> String {
    get_envvault_path().to_string_lossy().to_string()
}

