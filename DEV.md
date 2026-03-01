# Score Maestro — Guia do Desenvolvedor

> **Stack**: Tauri 2 (Rust backend) + React 19 + TypeScript 5.8 + Vite 7 + Tailwind CSS 4

---

## Sumário

1. [Visão Geral da Arquitetura](#visão-geral-da-arquitetura)
2. [Estrutura de pastas](#estrutura-de-pastas)
3. [Backend (Rust / Tauri)](#backend-rust--tauri)
   - [Entrypoints](#entrypoints)
   - [Domain](#domain)
   - [Infrastructure](#infrastructure)
   - [Services](#services)
   - [Commands (IPC)](#commands-ipc)
4. [Frontend (React / TypeScript)](#frontend-react--typescript)
   - [Types](#types)
   - [API Layer](#api-layer)
   - [Context / State](#context--state)
   - [Componentes](#componentes)
5. [Banco de Dados (SQLite)](#banco-de-dados-sqlite)
6. [Fluxo de Dados](#fluxo-de-dados)
7. [Executando o projeto](#executando-o-projeto)
8. [Testes](#testes)
   - [Testes do backend (Rust)](#testes-do-backend-rust)
   - [Testes do frontend (Vitest)](#testes-do-frontend-vitest)
9. [Convenções do projeto](#convenções-do-projeto)

---

## Visão Geral da Arquitetura

```
┌─────────────────────────────────────────────────┐
│               React Frontend (Vite)             │
│  components → context → api/commands.ts         │
│                  │   invoke()                    │
│                  ▼                               │
│  ────────── Tauri IPC Bridge ──────────         │
│                  │                               │
│                  ▼                               │
│  commands/ → services/ → infrastructure/        │
│                              database.rs        │
│                              (SQLite + FTS5)    │
└─────────────────────────────────────────────────┘
```

O projeto segue **Clean Architecture** no backend:

| Camada           | Pasta                          | Responsabilidade                         |
|------------------|--------------------------------|------------------------------------------|
| **Domain**       | `src-tauri/src/domain/`        | Modelos, enums e tipos de erro           |
| **Infrastructure** | `src-tauri/src/infrastructure/` | Acesso a dados (SQLite)                 |
| **Services**     | `src-tauri/src/services/`      | Lógica de negócio (indexar, versionar, hash) |
| **Commands**     | `src-tauri/src/commands/`      | Handlers para IPC Tauri (expostos ao frontend) |

---

## Estrutura de pastas

```
Score-Maestro/
├── index.html                  # HTML host do Vite
├── package.json                # Dependências frontend
├── tsconfig.json               # Config TypeScript
├── vite.config.ts              # Config Vite + Tailwind plugin
│
├── src/                        # ── Frontend ──
│   ├── main.tsx                # Ponto de entrada React
│   ├── App.tsx                 # Componente raiz + roteamento de telas
│   ├── App.css                 # CSS legado (vazio)
│   ├── index.css               # Import Tailwind CSS
│   ├── vite-env.d.ts           # Tipos do Vite
│   │
│   ├── types/
│   │   └── index.ts            # Interfaces TypeScript espelhando os modelos Rust
│   │
│   ├── api/
│   │   └── commands.ts         # Wrappers de invoke() para todos os 16 comandos Tauri
│   │
│   ├── context/
│   │   └── AppContext.tsx       # Estado global (useReducer + Context API)
│   │
│   └── components/
│       ├── index.ts            # Barrel exports
│       ├── TopBar.tsx           # Header com ações (indexar dir, configurações)
│       ├── Sidebar.tsx          # Navegação (All/Favorites/Drafts + Categorias)
│       ├── ScoreList.tsx        # Lista de partituras com busca e grupos expansíveis
│       ├── VersionPanel.tsx     # Painel lateral de versões do arquivo selecionado
│       ├── StatusBar.tsx        # Barra de status (Google Drive / USB)
│       ├── SettingsPage.tsx     # Página de configurações
│       └── FirstRunPage.tsx     # Onboarding (primeira execução)
│
├── public/                     # Arquivos estáticos
│
└── src-tauri/                  # ── Backend Rust ──
    ├── Cargo.toml              # Dependências Rust
    ├── build.rs                # Build script (tauri_build::build)
    ├── tauri.conf.json         # Config do Tauri (nome, janela, plugins)
    ├── capabilities/
    │   └── default.json        # Permissões de plugins Tauri
    │
    └── src/
        ├── main.rs             # Entrypoint (windows_subsystem)
        ├── lib.rs              # Configuração do Tauri app (plugins, setup, commands)
        │
        ├── domain/
        │   ├── mod.rs          # Re-exports
        │   ├── models.rs       # Structs e enums do domínio
        │   └── errors.rs       # AppError (thiserror)
        │
        ├── infrastructure/
        │   ├── mod.rs          # Re-exports
        │   └── database.rs     # Database struct (SQLite + FTS5, todas as queries)
        │
        ├── services/
        │   ├── mod.rs          # Re-exports
        │   ├── indexer.rs      # Escaneamento de diretórios (walkdir)
        │   ├── versioning.rs   # Criação de drafts, promoção, versão inicial
        │   └── hasher.rs       # BLAKE3 hashing + detecção de mudanças
        │
        └── commands/
            ├── mod.rs          # Re-exports
            ├── score_commands.rs    # 8 comandos de partituras
            ├── version_commands.rs  # 4 comandos de versões
            ├── category_commands.rs # 3 comandos de categorias
            └── settings_commands.rs # 4 comandos de configurações
```

---

## Backend (Rust / Tauri)

### Entrypoints

#### `main.rs`
```rust
fn main() {
    score_maestro_lib::run();
}
```
- Usa `#[cfg_attr(not(debug_assertions), windows_subsystem = "windows")]` para ocultar o console no Windows em release.

#### `lib.rs`
```rust
pub fn run() { ... }
```
- Registra **6 plugins**: opener, dialog, shell, fs, store, notification.
- No `setup()`: cria o diretório `app_data_dir`, instancia `Database` e registra como `State` via `app.manage()`.
- Registra **16 comandos IPC** com `generate_handler![]`.

---

### Domain

#### `domain/models.rs` — Modelos do domínio

| Struct/Enum         | Descrição                                              |
|---------------------|--------------------------------------------------------|
| `Score`             | Partitura — pode ter múltiplos `ScoreFile` (instrumentos) |
| `ScoreFile`         | Arquivo de partitura (um instrumento de uma música)    |
| `FileVersion`       | Versão de um `ScoreFile` (Current, Previous, Draft, Compressed) |
| `VersionStatus`     | Enum com `as_str()` e `from_str()` para persistência   |
| `Category`          | Categoria criada pelo usuário (ex: "Harpa Cristã")     |
| `AppSettings`       | Configurações globais (org, drive mode, hash_enabled)  |
| `GoogleDriveMode`   | `Local` (pasta do Drive) ou `Api` (rclone)             |
| `BackupInfo`        | Estado do backup (timestamps + status)                 |
| `BackupStatus`      | `Synced`, `Pending`, `Error(String)`, `NeverSynced`    |
| `ScoreListItem`     | DTO para listar partituras (com `Vec<ScoreFileItem>`)  |
| `ScoreFileItem`     | DTO de arquivo na listagem (version_count, has_draft)  |
| `IndexedFile`       | Resultado da varredura de diretório                    |

Todos derivam `Debug, Clone, Serialize, Deserialize`.

#### `domain/errors.rs` — Tratamento de erros

```rust
pub enum AppError {
    Database(rusqlite::Error),
    Io(std::io::Error),
    FileNotFound(String),
    ScoreNotFound(String),
    VersionNotFound(String),
    CategoryNotFound(String),
    InvalidDirectory(String),
    InsufficientSpace(u64),
    Generic(String),
}
```

- Usa `thiserror` para derivar `Display`.
- Implementação manual de `serde::Serialize` para serializar via Tauri IPC.

---

### Infrastructure

#### `infrastructure/database.rs` — Camada de dados SQLite

**Struct**: `Database { conn: Mutex<Connection> }`

A `Mutex` permite acesso seguro entre threads (necessário no Tauri).

##### Inicialização

| Método            | Descrição                                           |
|-------------------|-----------------------------------------------------|
| `new(db_path)`    | Abre conexão SQLite e executa migrações             |
| `run_migrations()`| Cria tabelas, FTS5, triggers e índices (idempotente)|

##### Schema SQL

| Tabela          | Colunas principais                                   |
|-----------------|------------------------------------------------------|
| `categories`    | id, name (UNIQUE), created_at                        |
| `scores`        | id, title, composer, arranger, category_id (FK), tags (JSON), favorited |
| `score_files`   | id, score_id (FK CASCADE), instrument, original_path, file_extension, file_size, hash |
| `file_versions` | id, score_file_id (FK CASCADE), version_number, status, file_path, file_size, hash, is_compressed |
| `app_settings`  | key (PK), value — armazenamento chave-valor          |
| `scores_fts`    | FTS5 virtual table para busca full-text em scores    |

**Triggers FTS** (`scores_ai`, `scores_ad`, `scores_au`): mantêm `scores_fts` sincronizado com `scores`.

**Índices**: `idx_score_files_score_id`, `idx_file_versions_score_file_id`, `idx_scores_category_id`, `idx_scores_favorited`.

**PRAGMA**: `journal_mode=WAL` (write-ahead logging), `foreign_keys=ON`.

##### Métodos CRUD

**Scores:**
| Método                         | Retorno                   | Descrição                                     |
|--------------------------------|---------------------------|-----------------------------------------------|
| `insert_score(score)`          | `()`                      | Insere partitura + trigger popula FTS          |
| `get_all_scores()`             | `Vec<ScoreListItem>`      | Lista todas com instrumentos (ORDER BY updated_at DESC) |
| `get_favorited_scores()`       | `Vec<ScoreListItem>`      | Somente favoritas                             |
| `get_scores_with_drafts()`     | `Vec<ScoreListItem>`      | Partituras que possuem rascunho ativo         |
| `toggle_favorite(score_id)`    | `bool`                    | Alterna favorito, retorna novo estado         |
| `search_scores(query)`         | `Vec<ScoreListItem>`      | FTS5 MATCH com prefix wildcard (`query*`)     |
| `get_scores_by_category(id)`   | `Vec<ScoreListItem>`      | Filtra por categoria                          |

**Score Files:**
| Método                              | Retorno             |
|-------------------------------------|----------------------|
| `insert_score_file(file)`           | `()`                 |
| `get_score_files_for_list(conn, id)`| `Vec<ScoreFileItem>` — privado, usado internamente |

**Versions:**
| Método                            | Retorno              | Descrição                          |
|-----------------------------------|----------------------|------------------------------------|
| `insert_version(version)`         | `()`                 | Insere FileVersion                 |
| `get_versions_for_file(file_id)`  | `Vec<FileVersion>`   | Todas as versões de um arquivo     |
| `promote_draft_to_version(id)`    | `()`                 | Draft → Current (Previous recedem) |
| `delete_version(id)`              | `()`                 | Só deleta se status ≠ Current      |

**Categories:**
| Método                     | Retorno            |
|----------------------------|--------------------|
| `insert_category(cat)`    | `()`               |
| `get_all_categories()`    | `Vec<Category>`    |
| `delete_category(id)`     | `()`               |

**Settings:**
| Método                          | Retorno          | Descrição                       |
|---------------------------------|------------------|---------------------------------|
| `get_setting(key)`              | `Option<String>` | Lê uma configuração             |
| `set_setting(key, val)`         | `()`             | INSERT OR REPLACE               |
| `get_app_settings()`            | `AppSettings`    | Monta struct a partir de várias keys |
| `save_app_settings(settings)`   | `()`             | Persiste todas as keys          |

**Helper:**
- `parse_datetime(s)` — Converte string `"%Y-%m-%d %H:%M:%S"` para `NaiveDateTime`.

---

### Services

#### `services/indexer.rs` — Indexação de diretórios

| Função / Constante           | Descrição                                              |
|------------------------------|--------------------------------------------------------|
| `SUPPORTED_EXTENSIONS`       | `["pdf", "mus", "musx"]`                               |
| `scan_directory(dir_path)`   | Percorre recursivamente via `walkdir`, filtra extensões, retorna `Vec<IndexedFile>` |
| `parse_filename(file_stem)`  | Extrai `(name, instrument)` do padrão `"nome - instrumento"` usando `rfind(" - ")` |

#### `services/versioning.rs` — Controle de versões

| Função                                  | Descrição                                            |
|-----------------------------------------|------------------------------------------------------|
| `versions_dir(app_data_dir)`            | Retorna `{app_data}/versions` (privada)              |
| `create_draft(db, dir, file_id, src, hash)` | Copia arquivo para `versions/{id}/drafts/`, calcula hash opcional, insere no DB |
| `promote_draft(db, version_id)`         | Delega para `db.promote_draft_to_version()`          |
| `store_initial_version(db, dir, file, hash)` | Copia arquivo para `versions/{id}/v1_{uuid}.ext`, cria versão v1 como Current |
| `compute_hash(path)`                    | BLAKE3 hash interno (privada)                        |

#### `services/hasher.rs` — Hashing e detecção de mudanças

| Função                              | Descrição                                       |
|-------------------------------------|-------------------------------------------------|
| `hash_file(path)`                   | Lê o arquivo inteiro e retorna hex BLAKE3       |
| `file_changed(path, size, hash, hash_enabled)` | Compara tamanho primeiro; se igual e `hash_enabled`, compara hash |

---

### Commands (IPC)

Os comandos são expostos ao frontend como funções async via `invoke()` do Tauri.

#### `commands/score_commands.rs`

| Comando                  | Parâmetros                              | Retorno                |
|--------------------------|-----------------------------------------|------------------------|
| `get_all_scores`         | —                                       | `Vec<ScoreListItem>`   |
| `get_favorited_scores`   | —                                       | `Vec<ScoreListItem>`   |
| `get_scores_with_drafts` | —                                       | `Vec<ScoreListItem>`   |
| `search_scores`          | `query: String`                         | `Vec<ScoreListItem>`   |
| `toggle_favorite`        | `score_id: String`                      | `bool`                 |
| `scan_directory`         | `directory: String`                     | `Vec<IndexedFile>`     |
| `import_indexed_files`   | `files: Vec<IndexedFile>`, `category_id: Option<String>` | `Vec<ScoreListItem>` |
| `get_scores_by_category` | `category_id: String`                   | `Vec<ScoreListItem>`   |

> `import_indexed_files` agrupa os arquivos por nome, cria um `Score` por grupo e um `ScoreFile` por instrumento, armazenando a versão inicial de cada um.

#### `commands/version_commands.rs`

| Comando          | Parâmetros                                | Retorno        |
|------------------|-------------------------------------------|----------------|
| `get_versions`   | `score_file_id: String`                   | `Vec<FileVersion>` |
| `promote_draft`  | `version_id: String`                      | `()`           |
| `delete_version` | `version_id: String`                      | `()`           |
| `create_draft`   | `score_file_id: String`, `source_path: String` | `FileVersion` |

#### `commands/category_commands.rs`

| Comando           | Parâmetros          | Retorno     |
|-------------------|---------------------|-------------|
| `get_categories`  | —                   | `Vec<Category>` |
| `create_category` | `name: String`      | `Category`  |
| `delete_category` | `category_id: String` | `()`      |

#### `commands/settings_commands.rs`

| Comando              | Parâmetros                                         | Retorno       |
|----------------------|----------------------------------------------------|---------------|
| `get_settings`       | —                                                  | `AppSettings` |
| `save_settings`      | `settings: AppSettings`                            | `()`          |
| `is_first_run`       | —                                                  | `bool`        |
| `complete_first_run` | `organization_name: Option<String>`, `google_drive_mode: String` | `()` |

---

## Frontend (React / TypeScript)

### Types

**`src/types/index.ts`** — Interfaces que espelham os DTOs do Rust:

| Interface       | Corresponde a (Rust)   |
|-----------------|------------------------|
| `ScoreListItem` | `ScoreListItem`        |
| `ScoreFileItem` | `ScoreFileItem`        |
| `FileVersion`   | `FileVersion`          |
| `Category`      | `Category`             |
| `AppSettings`   | `AppSettings`          |
| `IndexedFile`   | `IndexedFile`          |
| `SidebarView`   | —  (tipo discriminado: `"all" \| "favorites" \| "drafts" \| { type: "category"; id; name }`) |
| `AppState`      | — (estado do frontend) |

### API Layer

**`src/api/commands.ts`** — 16 funções async que encapsulam `invoke()`:

```typescript
// Scores (8)
getAllScores, getFavoritedScores, getScoresWithDrafts, searchScores,
toggleFavorite, scanDirectory, importIndexedFiles, getScoresByCategory

// Versions (4)
getVersions, promoteDraft, deleteVersion, createDraft

// Categories (3)
getCategories, createCategory, deleteCategory

// Settings (4)
getSettings, saveSettings, isFirstRun, completeFirstRun
```

### Context / State

**`src/context/AppContext.tsx`** — Gerenciamento de estado com `useReducer`:

**State** contém: `scores`, `categories`, `settings`, `sidebarView`, `selectedScore`, `selectedFile`, `versions`, `searchQuery`, `isFirstRun`, `isLoading`.

**Actions** (11 tipos):
`SET_SCORES`, `SET_CATEGORIES`, `SET_SETTINGS`, `SET_SIDEBAR_VIEW`, `SET_SELECTED_SCORE`, `SET_SELECTED_FILE`, `SET_VERSIONS`, `SET_SEARCH_QUERY`, `SET_FIRST_RUN`, `SET_LOADING`, `TOGGLE_FAVORITE`.

**AppContextValue** fornece:
- `state` — estado imutável
- `loadScores()` — carrega scores conforme `sidebarView` e `searchQuery`
- `loadCategories()` — carrega categorias do backend
- `loadSettings()` — carrega configurações do backend
- `setSidebarView(view)` — muda visualização + limpa seleção e busca
- `selectScore(score)` — seleciona partitura (limpa arquivo e versões)
- `selectFile(file)` — seleciona arquivo e carrega versões
- `loadVersions(id)` — carrega versões de um `scoreFileId`
- `setSearchQuery(query)` — atualiza query (recarrega scores via effect)
- `toggleFavorite(id)` — toggle + atualização otimista local
- `promoteDraft(id)` — promove draft e recarrega versões/scores
- `deleteVersion(id)` — deleta versão e recarrega
- `createCategory(name)` / `deleteCategory(id)` — CRUD de categorias
- `saveSettings(settings)` — persiste configurações
- `completeFirstRun(org, mode)` — finaliza onboarding

**Hook**: `useAppState()` — acessa o contexto (lança erro se fora do provider).

**Inicialização** (effect no mount):
1. Verifica `isFirstRun()` — se `true`, mostra onboarding
2. Se não, carrega em paralelo: `loadScores()`, `loadCategories()`, `loadSettings()`

**Reatividade**: effect que recarrega scores ao mudar `sidebarView` ou `searchQuery`.

### Componentes

#### `App.tsx`
- **`App`** — Wraps `AppContent` em `AppProvider`
- **`AppContent`** — Roteamento de telas:
  - `isLoading` → loading spinner
  - `isFirstRun` → `<FirstRunPage />`
  - `showSettings` → `<SettingsPage />`
  - Default → layout principal com TopBar + Sidebar + ScoreList + VersionPanel + StatusBar

#### `TopBar.tsx`
- Header com ícone Music e título "Score Maestro"
- **ActionButton** (sub-componente): botões de ação
- Ações: Adicionar arquivo (placeholder), Indexar diretório (abre dialog nativa → scanDirectory + importIndexedFiles → loadScores), Configurações
- `data-tauri-drag-region` permite arrastar a janela pelo header

#### `Sidebar.tsx`
- Seção **Biblioteca**: 3 links (Todas as Partituras, Favoritos, Rascunhos Ativos)
- Seção **Categorias**: lista dinâmica com botão + para criar, botão lixeira para deletar
- **SidebarItem** (sub-componente): botão de navegação com ícone, texto e estado ativo
- `isActive()` compara `SidebarView` (string ou objeto)

#### `ScoreList.tsx`
- Input de busca com **debounce** (300ms) via `useRef<setTimeout>`
- Label dinâmico conforme `sidebarView`
- **ScoreGroup** (sub-componente): linha expansível por partitura
  - Mostra título, compositor/arranjador, data formatada
  - Botão de favorito (Heart, fill vermelho quando ativo)
  - Ao expandir, lista instrumentos (ScoreFileItem)
  - Indicador de rascunho ativo (bolinha amber)
- **formatDate** — Helper que formata "Hoje HH:MM", "Ontem HH:MM" ou "DD/MM/YYYY"
- Estado vazio: ícone FileMusic + mensagem

#### `VersionPanel.tsx`
- Sidebar direita (300px) para histórico de versões
- Estado vazio: ícone History + mensagem "Selecione um instrumento..."
- Header mostra título da partitura + instrumento selecionado
- **VersionCard** (sub-componente): card estilizado conforme status
  - `Current` → gradiente azul + CheckCircle2
  - `Draft` → borda amber + FileEdit
  - `Compressed` → Archive + fundo claro
  - `Previous` → Circle + fundo claro
- Botão "Deletar" com confirmação em 2 cliques (Confirmar/Cancelar)
- Botão "Definir Nova Versão" (só aparece se há draft) → promoteDraft
- **getStatusConfig** — Retorna ícone, cor e estilo baseado no status
- **formatDate** — DD/MM/YYYY HH:MM

#### `StatusBar.tsx`
- Footer com indicadores de status:
  - Google Drive: "Sincronizado" (com ícone Cloud)
  - Backup USB: "Fazer backup" (com ícone Usb)
- Botão "Configurações"
- **StatusIndicator** (sub-componente): ícone + label + status/ação

#### `SettingsPage.tsx`
- Layout com header (botão voltar + título)
- Seções:
  - **Organização**: input de nome
  - **Backup Google Drive**: cards Local vs API
  - **Verificação de integridade**: toggle BLAKE3 (OFF por padrão)
- Botão "Salvar" (chama `saveSettings` + volta)
- Footer: "Made by Rhafaell with lots of coffee ☕"
- Sub-componentes: **Section**, **Field**, **DriveOption**, **Toggle**

#### `FirstRunPage.tsx`
- Tela de onboarding centralizada com fundo gradiente
- Input de nome da organização (opcional)
- Seleção de modo Google Drive (Local com badge "Recomendado")
- Botão "Começar a usar" → `completeFirstRun()`
- **DriveOption** (sub-componente): card selecionável com badge opcional

---

## Banco de Dados (SQLite)

### Diagrama de Relacionamentos

```
categories (1) ──┐
                  │ FK (ON DELETE SET NULL)
                  ▼
scores (N) ──────────────── scores_fts (FTS5, synced via triggers)
    │
    │ FK (ON DELETE CASCADE)
    ▼
score_files (N)
    │
    │ FK (ON DELETE CASCADE)
    ▼
file_versions (N)

app_settings (key-value store independente)
```

### PRAGMAs

- `journal_mode=WAL` — Write-Ahead Logging para performance de leitura concorrente
- `foreign_keys=ON` — Garante integridade referencial

---

## Fluxo de Dados

### Indexação de diretório

```
1. Usuário clica "Indexar diretório" (TopBar)
2. Dialog nativa do OS (tauri-plugin-dialog) seleciona pasta
3. Frontend chama invoke("scan_directory", { directory })
4. Backend: indexer::scan_directory() percorre com walkdir
5. Retorna Vec<IndexedFile> ao frontend
6. Frontend chama invoke("import_indexed_files", { files })
7. Backend:
   a. Agrupa files por nome
   b. Para cada grupo: cria Score, itera instrumentos
   c. Para cada instrumento: cria ScoreFile, store_initial_version()
   d. store_initial_version() copia arquivo para versions/{id}/ e insere FileVersion v1
8. Frontend: loadScores() atualiza a lista
```

### Criação e promoção de draft

```
1. create_draft() copia arquivo para versions/{id}/drafts/
2. Insere FileVersion com status=Draft, version_number=0
3. promote_draft() é chamado:
   a. Marca a versão "current" existente como "previous"
   b. Calcula próximo version_number
   c. Atualiza o draft para status="current" com novo version_number
```

### Busca full-text (FTS5)

```
1. Usuário digita no campo de busca
2. Debounce de 300ms
3. invoke("search_scores", { query })
4. Backend executa: scores_fts MATCH "{query}*"
5. Join com tabela scores, ordered by rank
6. Retorna scores com instrumentos
```

## Como o front envia / o back salva (resumo prático)

- Chamadas do frontend usam `invoke()` (via `src/api/commands.ts`) e passam objetos simples ou primitivos; exemplos:
  - `invoke("scan_directory", { directory: "/path/to/dir" })` → retorna `IndexedFile[]`
  - `invoke("import_indexed_files", { files: IndexedFile[], categoryId?: string })` → importa e persiste registros, retorna `ScoreListItem[]`
  - `invoke("create_draft", { scoreFileId, sourcePath })` → copia arquivo para `versions/{score_file_id}/drafts/` e retorna `FileVersion`
  - `invoke("promote_draft", { versionId })` → atualiza DB (draft → current)
  - `invoke("get_settings")` / `invoke("save_settings", { settings: AppSettings })`

- Formatos (TypeScript interfaces em `src/types/index.ts`):
  - `IndexedFile` { `path: string`, `name: string`, `instrument: string | null`, `extension: string`, `size: number` }
  - `AppSettings` { `organization_name: string | null`, `logo_path: string | null`, `google_drive_mode: "Local" | "Api"`, `hash_enabled: boolean`, `first_run_completed: boolean` }
  - `FileVersion` contém `id`, `score_file_id`, `version_number`, `status` (`Current|Previous|Draft|Compressed`), `file_path`, `file_size`, `hash`, `created_at`.

- Onde os arquivos são armazenados (backend):
  - diretório base: `<app_data_dir>/versions/`
  - versão inicial: `versions/{score_file_id}/v1_{uuid}.ext`
  - rascunhos: `versions/{score_file_id}/drafts/{uuid}.{ext}`
  - a cópia física é feita por `services::versioning::store_initial_version` e `create_draft` (usam `std::fs::copy`).

- Persistência e DB (SQLite — `src-tauri/src/infrastructure/database.rs`):
  - `scores`, `score_files`, `file_versions`, `categories`, `app_settings` (key/value)
  - `file_versions.status` é usado para distinguir `draft` / `current` / `previous`
  - `insert_version`, `promote_draft_to_version` e `delete_version` cuidam da coerência de números/estados
  - `scores_fts` (FTS5 virtual table) mantém busca full-text sincronizada via triggers

- Observações operacionais:
  - Hashing (BLAKE3) é opcional: controlado por `settings.hash_enabled`; quando ativo, hashes são calculados e salvos em `file_versions.hash` e `score_files.hash`.
  - `import_indexed_files` agrupa arquivos por `name`, cria `Score` + `ScoreFile` para cada instrumento e chama `store_initial_version` para cada `ScoreFile`.


---

## Executando o projeto

### Pré-requisitos

- **Rust** / **Cargo** (rustup)
- **Node.js** ≥ 18 + **npm**
- Dependências do sistema para Tauri (Linux): `webkit2gtk-4.1`, `libappindicator3-dev`, etc.

### Desenvolvimento

```bash
# Instalar dependências frontend
npm install

# Executar em modo dev (Vite + Tauri)
npm run tauri dev
```

### Build de produção

```bash
npm run tauri build
```

---

## Testes

### Testes do backend (Rust)

```bash
cd src-tauri
cargo test
```

Módulos testados:
- **`services::indexer`** — parse_filename com/sem instrumento, múltiplos traços, scan_directory com tempdir
- **`infrastructure::database`** — CRUD completo (in-memory SQLite): insert/get scores, favoritos, categorias, FTS5, versões, settings
- **`services::hasher`** — hash_file, file_changed com/sem hash
- **`services::versioning`** — create_draft, store_initial_version, promote_draft

Os testes do database usam `Connection::open_in_memory()` para execução rápida sem dependência de disco.

**Dev-dependencies** (Cargo.toml):
```toml
[dev-dependencies]
tempfile = "3"
```

### Testes do frontend (Vitest)

```bash
npm test           # roda uma vez
npm run test:watch # modo watch
npm run test:ui    # interface visual do Vitest
```

Arquivos de teste ficam em `src/__tests__/`.

Módulos testados:
- **`types`** — Verificação de tipagem e valores default
- **`context/AppContext`** — Reducer (todas as Actions), estado inicial

**Dev-dependencies** (package.json):
```json
"vitest": "^3.2.4",
"@testing-library/react": "^16.3.0",
"@testing-library/jest-dom": "^6.6.3",
"jsdom": "^26.1.0"
```

---

## Convenções do projeto

| Convenção            | Detalhe                                                    |
|----------------------|------------------------------------------------------------|
| **Idioma do código** | Nomes de variáveis/funções em inglês; strings de UI em português (pt-BR) |
| **IDs**              | UUID v4 em formato string                                  |
| **Datas**            | `NaiveDateTime` (Rust) / `string` ISO-like (TS), sem timezone |
| **Hash**             | BLAKE3 (64 hex chars), desabilitado por padrão             |
| **Serialização**     | `serde` no Rust, `camelCase` nos comandos Tauri (snake_case interno) |
| **Erros**            | `Result<T, AppError>` no Rust, `try/catch` com `console.error` no TS |
| **State management** | `useReducer` + Context (sem libs externas)                 |
| **Estilização**      | Tailwind CSS 4 com classes utilitárias inline              |
| **Componentes**      | Default exports + barrel file (`components/index.ts`)      |
