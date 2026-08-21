use tauri::State;
use tracing::{error, info};

use crate::commands::common::require_server_settings;
use crate::domain::errors::AppError;
use crate::domain::models::Category;
use crate::infrastructure::{database::Database, store::SystemStore};

#[tauri::command]
pub fn get_categories(db: State<'_, Database>) -> Result<Vec<Category>, AppError> {
    info!("Fetching all categories");
    db.get_all_categories()
        .map(|categories| {
            info!("Returned {} categories", categories.len());
            categories
        })
        .map_err(|e| {
            error!("Error fetching categories: {:?}", e);
            e
        })
}

#[tauri::command]
pub fn create_category(db: State<'_, Database>, name: String) -> Result<Category, AppError> {
    info!("Creating new category: {}", name);

    if name.trim().is_empty() {
        return Err(AppError::Generic("Category name cannot be empty".into()));
    }

    let category = Category {
        id: uuid::Uuid::new_v4().to_string(),
        name: name.trim().to_string(),
    };
    db.insert_category(&category)
        .map(|_| {
            info!("Category created successfully: {}", category.id);
            category
        })
        .map_err(|e| {
            error!("Error creating category: {:?}", e);
            e
        })
}

#[tauri::command]
pub fn update_category(
    db: State<'_, Database>,
    category_id: String,
    name: String,
) -> Result<Category, AppError> {
    info!("Updating category: {}", category_id);

    let trimmed_name = name.trim();

    if trimmed_name.is_empty() {
        return Err(AppError::Generic("Category name cannot be empty".into()));
    }

    db.update_category(&category_id, trimmed_name)
        .map(|_| {
            info!("Category updated successfully: {}", category_id);
            Category {
                id: category_id,
                name: trimmed_name.to_string(),
            }
        })
        .map_err(|e| {
            error!("Error updating category: {:?}", e);
            e
        })
}

#[tauri::command]
pub fn delete_category(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    category_id: String,
) -> Result<(), AppError> {
    require_server_settings(&store)?;

    info!("Deleting category: {}", category_id);
    db.delete_category(&category_id)
        .map(|_| {
            info!("Category deleted successfully: {}", category_id);
        })
        .map_err(|e| {
            error!("Error deleting category: {:?}", e);
            e
        })
}
