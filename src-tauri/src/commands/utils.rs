use std::fs;
use std::path::PathBuf;
use tauri::command;

#[command]
pub fn save_pdf(filename: String, data: Vec<u8>) -> Result<String, String> {
    let download_dir = dirs::download_dir().ok_or("Could not find download directory")?;
    let mut file_path = download_dir.clone();
    file_path.push(filename);
    
    fs::write(&file_path, data).map_err(|e| e.to_string())?;
    
    Ok(file_path.to_string_lossy().to_string())
}

#[command]
pub fn open_file_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        Command::new("explorer")
            .arg("/select,")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        Command::new("open")
            .arg("-R")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        let parent = std::path::Path::new(&path).parent().unwrap_or(std::path::Path::new("/"));
        Command::new("xdg-open")
            .arg(parent)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}
