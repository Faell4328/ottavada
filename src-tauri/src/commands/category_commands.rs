use tauri::State;
use tracing::{info, error};

use crate::domain::errors::AppError;
use crate::domain::models::Category;
use crate::infrastructure::database::Database;

#[tauri::command]
pub fn get_categories(db: State<'_, Database>) -> Result<Vec<Category>, AppError> {
    info!("Buscando todas as categorias");
    match db.get_all_categories() {
        Ok(categories) => {
            info!("Retornou {} categorias", categories.len());
            Ok(categories)
        }
        Err(e) => {
            error!("Erro ao buscar categorias: {:?}", e);
            Err(e)
        }
    }
}

#[tauri::command]
pub fn create_category(db: State<'_, Database>, name: String) -> Result<Category, AppError> {
    info!("Criando nova categoria: {}", name);
    let category = Category {
        id: uuid::Uuid::new_v4().to_string(),
        name,
    };
    match db.insert_category(&category) {
        Ok(_) => {
            info!("Categoria criada com sucesso: {}", category.id);
            Ok(category)
        }
        Err(e) => {
            error!("Erro ao criar categoria: {:?}", e);
            Err(e)
        }
    }
}

#[tauri::command]
pub fn delete_category(db: State<'_, Database>, category_id: String) -> Result<(), AppError> {
    info!("Deletando categoria: {}", category_id);
    match db.delete_category(&category_id) {
        Ok(_) => {
            info!("Categoria deletada com sucesso: {}", category_id);
            Ok(())
        }
        Err(e) => {
            error!("Erro ao deletar categoria: {:?}", e);
            Err(e)
        }
    }
}
