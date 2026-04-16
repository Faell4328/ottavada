use std::env;
use std::fs;
use std::path::PathBuf;

fn main() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR ausente"));
    let env_path = manifest_dir.join(".env");

    if let Ok(content) = fs::read_to_string(&env_path) {
        for line in content.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() || trimmed.starts_with('#') {
                continue;
            }

            if let Some((key, value)) = trimmed.split_once('=') {
                let key = key.trim();
                let value = value.trim().trim_matches('"');

                if key == "TELEMETRY_ENDPOINT" || key == "TELEMETRY_API_TOKEN" {
                    println!("cargo:rustc-env={}={}", key, value);
                }
            }
        }
    }

    tauri_build::build()
}
