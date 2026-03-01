use chrono::Local;
use tauri::State;

use crate::domain::errors::AppError;
use crate::domain::models::Category;
use crate::infrastructure::database::Database;

#[tauri::command]
pub fn get_categories(db: State<'_, Database>) -> Result<Vec<Category>, AppError> {
    db.get_all_categories()
}

#[tauri::command]
pub fn create_category(db: State<'_, Database>, name: String) -> Result<Category, AppError> {
    let category = Category {
        id: uuid::Uuid::new_v4().to_string(),
        name,
        created_at: Local::now().naive_local(),
    };
    db.insert_category(&category)?;
    Ok(category)
}

#[tauri::command]
pub fn delete_category(db: State<'_, Database>, category_id: String) -> Result<(), AppError> {
    db.delete_category(&category_id)
}
