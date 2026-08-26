mod commands;
mod db;
mod models;

use tauri::{AppHandle, Emitter, Manager, TitleBarStyle, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_global_shortcut::{Code, Modifiers, Shortcut, ShortcutState};

use commands::*;

fn maintenance(app: &AppHandle) {
    match purge_old_trash(app.clone(), app.state::<db::Db>()) {
        Ok(0) => {}
        Ok(n) => println!("purged {n} old trashed notes"),
        Err(e) => eprintln!("purge failed: {e}"),
    }
}

fn setup_global_shortcuts(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let quick_capture: Shortcut = Shortcut::new(Some(Modifiers::SHIFT | Modifiers::SUPER), Code::KeyN);
    let toggle_clipboard: Shortcut = Shortcut::new(Some(Modifiers::SHIFT | Modifiers::SUPER), Code::KeyV);

    let plugin = tauri_plugin_global_shortcut::Builder::new()
        .with_shortcuts([quick_capture.clone(), toggle_clipboard.clone()])?
        .with_handler(move |app, shortcut, event| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            if shortcut == &quick_capture {
                let _ = app.emit("global-shortcut", "quick-capture");
            } else if shortcut == &toggle_clipboard {
                let _ = app.emit("global-shortcut", "toggle-clipboard");
            }
        })
        .build();

    app.plugin(plugin)?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn setup_macos_menu(app: &tauri::App) -> tauri::Result<()> {
    use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};

    let handle = app.handle();
    let sep = || PredefinedMenuItem::separator(handle);
    let about = MenuItem::with_id(handle, "about", "About NoteMe", true, None::<&str>)?;
    let check_updates = MenuItem::with_id(handle, "check-updates", "Check for Updates…", true, None::<&str>)?;

    let app_menu = Submenu::with_items(
        handle,
        "NoteMe",
        true,
        &[
            &about,
            &check_updates,
            &sep()?,
            &PredefinedMenuItem::services(handle, None)?,
            &sep()?,
            &PredefinedMenuItem::hide(handle, None)?,
            &PredefinedMenuItem::hide_others(handle, None)?,
            &PredefinedMenuItem::show_all(handle, None)?,
            &sep()?,
            &PredefinedMenuItem::quit(handle, None)?,
        ],
    )?;

    let new_note = MenuItem::with_id(handle, "new-note", "New Note", true, Some("Cmd+N"))?;
    let new_tab = MenuItem::with_id(handle, "new-tab", "New Tab", true, Some("Cmd+T"))?;
    let close_tab = MenuItem::with_id(handle, "close-tab", "Close Tab", true, Some("Cmd+W"))?;
    let close_window = PredefinedMenuItem::close_window(handle, None)?;
    let export_all = MenuItem::with_id(handle, "export-all", "Export All Notes…", true, None::<&str>)?;
    let import_files = MenuItem::with_id(handle, "import-files", "Import Files…", true, None::<&str>)?;
    let print_note = MenuItem::with_id(handle, "print-note", "Print Note…", true, Some("Cmd+P"))?;
    let file_menu = Submenu::with_items(
        handle,
        "File",
        true,
        &[
            &new_note,
            &new_tab,
            &sep()?,
            &import_files,
            &export_all,
            &sep()?,
            &close_tab,
            &close_window,
            &sep()?,
            &print_note,
        ],
    )?;

    let edit_menu = Submenu::with_items(
        handle,
        "Edit",
        true,
        &[
            &PredefinedMenuItem::undo(handle, None)?,
            &PredefinedMenuItem::redo(handle, None)?,
            &sep()?,
            &PredefinedMenuItem::cut(handle, None)?,
            &PredefinedMenuItem::copy(handle, None)?,
            &PredefinedMenuItem::paste(handle, None)?,
            &PredefinedMenuItem::select_all(handle, None)?,
        ],
    )?;

    let palette = MenuItem::with_id(handle, "palette", "Command Palette…", true, Some("Cmd+Shift+P"))?;
    let quick_capture = MenuItem::with_id(handle, "quick-capture", "Quick Capture", true, Some("Cmd+Shift+N"))?;
    let clipboard = MenuItem::with_id(handle, "toggle-clipboard", "Clipboard History", true, Some("Cmd+Shift+V"))?;
    let toggle_sidebar = MenuItem::with_id(handle, "toggle-sidebar", "Toggle Sidebar", true, Some("Cmd+Ctrl+S"))?;
    let toggle_theme = MenuItem::with_id(handle, "toggle-theme", "Toggle Appearance", true, Some("Cmd+Shift+T"))?;
    let enter_fullscreen = PredefinedMenuItem::fullscreen(handle, None)?;
    let view_menu = Submenu::with_items(
        handle,
        "View",
        true,
        &[
            &palette,
            &quick_capture,
            &clipboard,
            &sep()?,
            &toggle_sidebar,
            &toggle_theme,
            &sep()?,
            &enter_fullscreen,
        ],
    )?;

    let next_tab = MenuItem::with_id(handle, "next-tab", "Next Tab", true, Some("Cmd+Shift+}"))?;
    let prev_tab = MenuItem::with_id(handle, "prev-tab", "Previous Tab", true, Some("Cmd+Shift+{"))?;
    let minimize = PredefinedMenuItem::minimize(handle, None)?;
    let zoom = PredefinedMenuItem::maximize(handle, Some("Zoom"))?;
    let window_menu = Submenu::with_items(
        handle,
        "Window",
        true,
        &[&next_tab, &prev_tab, &sep()?, &minimize, &zoom],
    )?;

    let shortcuts_item = MenuItem::with_id(handle, "shortcuts", "Keyboard Shortcuts", true, Some("Cmd+/"))?;
    let help_menu = Submenu::with_items(
        handle,
        "Help",
        true,
        &[&shortcuts_item],
    )?;

    let menu = Menu::with_items(handle, &[&app_menu, &file_menu, &edit_menu, &view_menu, &window_menu, &help_menu])?;
    app.set_menu(menu)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            db::init(app.handle())?;
            setup_global_shortcuts(app.handle())?;
            maintenance(app.handle());

            #[cfg(target_os = "macos")]
            setup_macos_menu(app)?;

            let window = WebviewWindowBuilder::new(app, "main", WebviewUrl::default())
                .title("NoteMe")
                .inner_size(980.0, 640.0)
                .min_inner_size(360.0, 400.0)
                .center();

            #[cfg(target_os = "macos")]
            let window = window
                .decorations(true)
                .title_bar_style(TitleBarStyle::Overlay)
                .hidden_title(true)
                .traffic_light_position(tauri::LogicalPosition::new(16.0, 24.0))
                .shadow(true);

            #[cfg(not(target_os = "macos"))]
            let window = window.decorations(false);

            window.build()?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "quick-capture" => {
                    let _ = app.emit("global-shortcut", "quick-capture");
                }
                "toggle-clipboard" => {
                    let _ = app.emit("global-shortcut", "toggle-clipboard");
                }
                id => {
                    let _ = app.emit("menu", id);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            list_notes,
            list_archived,
            list_trashed,
            list_favorites,
            notes_by_category,
            notes_by_tag,
            search_notes,
            get_note,
            create_note,
            update_note,
            set_note_category,
            toggle_pin,
            toggle_favorite,
            toggle_archive,
            trash_note,
            restore_note,
            delete_note_forever,
            empty_trash,
            list_categories,
            create_category,
            update_category,
            delete_category,
            list_tags,
            create_tag,
            delete_tag,
            set_note_tags,
            list_clipboard_items,
            save_clipboard_item,
            delete_clipboard_item,
            clear_clipboard_history,
            get_setting,
            set_setting,
            app_stats,
            list_tasks,
            save_attachment,
            purge_old_trash,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = event {
                if let Some(w) = app_handle.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.unminimize();
                    let _ = w.set_focus();
                }
            }
        });
}
