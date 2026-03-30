use chrono::Local;
use tauri::State;
use tracing::{error, info};

use crate::domain::errors::AppError;
use crate::domain::models::{Category, OperationGuard};
use crate::infrastructure::{database::Database, store::SystemStore};

#[tauri::command]
pub fn get_categories(db: State<'_, Database>) -> Result<Vec<Category>, AppError> {
    info!("Buscando todas as categorias");
    db.get_all_categories()
        .map(|categories| {
            info!("Retornou {} categorias", categories.len());
            categories
        })
        .map_err(|e| {
            error!("Erro ao buscar categorias: {:?}", e);
            e
        })
}

#[tauri::command]
pub fn create_category(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    name: String,
) -> Result<Category, AppError> {
    info!("Criando nova categoria: {}", name);

    let settings = store.get_app_settings()?;
    settings.require_server_only()?;

    if name.trim().is_empty() {
        return Err(AppError::Generic(
            "Nome da categoria não pode estar vazio".into(),
        ));
    }

    let updated_by = settings.computer_id.clone();

    let category = Category {
        id: uuid::Uuid::new_v4().to_string(),
        name: name.trim().to_string(),
        updated_at: Local::now().naive_local(),
        updated_by,
    };
    db.insert_category(&category)
        .map(|_| {
            info!("Categoria criada com sucesso: {}", category.id);
            category
        })
        .map_err(|e| {
            error!("Erro ao criar categoria: {:?}", e);
            e
        })
}

#[tauri::command]
pub fn delete_category(
    db: State<'_, Database>,
    store: State<'_, SystemStore>,
    category_id: String,
) -> Result<(), AppError> {
    let settings = store.get_app_settings()?;
    settings.require_server_only()?;

    info!("Deletando categoria: {}", category_id);
    db.delete_category(&category_id)
        .map(|_| {
            info!("Categoria deletada com sucesso: {}", category_id);
        })
        .map_err(|e| {
            error!("Erro ao deletar categoria: {:?}", e);
            e
        })
}
