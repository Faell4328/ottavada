# Score Maestro

Aplicativo desktop (Windows e Linux) para organizar partituras e arquivos musicais em um repositório local com versionamento e backups. Sem login/cadastro é abrir e usar.

## Problema

- Partituras ficam espalhadas e desorganizadas, com arquivos duplicados da mesma música para o mesmo instrumento.
- Não é possível saber qual versão de um arquivo é a mais recente.

## Objetivos

- Centralizar partituras com metadados e oferecer busca e filtros.
- Manter histórico completo de versões e rascunhos.
- Automatizar backups (local, pendrive e Google Drive).
- Preservar a estrutura de pastas existente do usuário.
- Deve ter uma opção para exporta/importa as partituras, categorias, metadados e todas as de mais informações.

## Metadados da partitura

Título, compositor, arranjador, instrumento, categoria, tags, data da última alteração, tamanho do arquivo e hash (opcional, configurável).

## Funcionalidades

### Indexação de diretório

- O usuário pode selecionar um diretório para varredura; o app detecta todas as partituras contidas nele.
- O nome e o instrumento são extraídos automaticamente do nome do arquivo (padrão esperado: `nome - instrumento.musx`). Caso não esteja nesse padrão o instrumento fica undefined e o nome é o nome completo do arquivo.

### Versionamento

- Clicar numa partitura abre o arquivo no aplicativo padrão do sistema.
- Alterações no arquivo são detectadas automaticamente e salvas como **rascunho**.
- Para criar uma nova versão oficial, o usuário confirma na interface ("definir nova versão").
- Versões anteriores permanecem disponíveis.
- Editar uma versão antiga gera um novo rascunho sem alterar o histórico original.

### Compactação de versões

- Versões antigas podem ser compactadas para economizar espaço, mas continuam acessíveis.
- Ao acessar uma versão compactada, o sistema a descompacta e pode marcar o resultado como temporário.
- **Não são compactadas:** a versão atual, a imediatamente anterior e rascunhos ativos (garantindo acesso rápido).

### Backup

- **Google Drive (obrigatório):** sincronização automática sempre que houver conexão com a internet.
- **Pendrive (opcional):** backup manual, disparado pelo usuário via interface.
- Antes de qualquer backup, o sistema deve verificar se o destino possui espaço suficiente, calculando o tamanho total dos arquivos a copiar.
- Ao acessar o aplicativo pela primeira vez, deve ser perguntando o nome da organização, logo (opcional). Também deve ter a opção de utilizar o google drive localmente (instaldo no computador) ou via API. Sendo recomendando localmente.

## Interface

### Header

- **Esquerda:** logo do Score Maestro.
- **Direita:** ações — adicionar arquivo, indexar diretório, configurações.

### Sidebar esquerda

- **Biblioteca:** "Todas as partituras" (padrão), "Favoritadas", "Rascunhos ativos".
- **Categorias:** categorias criadas pelo usuário (ex.: "Harpa Cristã").

### Área principal

- Reflete a seleção da sidebar esquerda (padrão: "Todas as partituras").
- Barra de pesquisa com sugestões enquanto digita, filtrando dentro da categoria selecionada.
- Ao clicar numa música, expande para mostrar todos os instrumentos disponíveis.

### Painel de versões (sidebar direita)

- Aparece somente ao selecionar um instrumento de uma música.
- Lista todas as versões do arquivo.
- Se houver rascunho, exibe a opção "definir nova versão".
- Permite deletar uma versão (com confirmação).
- Duplo clique em uma versão abre o arquivo no software padrão do sistema.

### Footer

- Status do último backup na nuvem (data/hora).
- Ícone de pendrive para disparar backup manual.

### Tela de configurações

- Ao final da tela de configurações deve ter a frase: "Made by Rhafaell with lots of coffee ☕".

## Arquitetura

Arquitetura orientada a domínio (Hexagonal / Clean Architecture): regras de versionamento e backup no domínio; adaptadores para persistência (SQLite via Tauri/Rust) e provedores externos; UI em React/TypeScript.

## Tecnologias

- **UI:** React + TypeScript + Vite + Tailwind CSS
- **Desktop:** Tauri (Rust)
- **Banco local:** SQLite (via Tauri)
- **Formatos:** .pdf, .mus, .musx
- **Backup remoto:** Google Drive (via rclone)
- **Backup removível:** pendrive / drives USB

## Decisões técnicas

### Backup com rclone

O [rclone](https://rclone.org/) será utilizado como **sidecar binary** do Tauri para o backup Google Drive via API. Justificativas:

- Sync incremental nativo — copia apenas arquivos alterados, comparando por hash/tamanho/data. Comparação com hash que demora deve ser ativada nas configurações.
- OAuth 2.0 com Google Drive já implementado e mantido pela comunidade.
- Retry automático com backoff exponencial em falhas de rede.
- Verificação de espaço disponível no destino (`rclone about`).
- Progresso em tempo real via `--progress` ou RC API (JSON over HTTP).
- Multiplataforma (Windows/Linux) — binário único sem dependências extras.
- Evita implementar manualmente toda a camada de comunicação com a API do Google Drive.

**Modos de backup Google Drive:**

| Modo | Implementação |
|------|--------------|
| Google Drive local (pasta sincronizada) | Cópia direta via Rust (`std::fs`) para a pasta do Google Drive no sistema |
| Google Drive via API | rclone como sidecar (`tauri::api::process::Command`) com remote configurado |

**Backup USB/pendrive:** cópia nativa em Rust (`std::fs`) com verificação de espaço via `fs2::available_space()`. Não utiliza rclone para manter a operação simples e sem dependências externas para um caso trivial.

O rclone será empacotado como sidecar do Tauri (`src-tauri/binaries/`) e gerenciado via `tauri-plugin-shell`. A configuração (`rclone.conf`) será armazenada no diretório de dados da aplicação.

### File watching com notify

A crate [notify](https://docs.rs/notify/) será usada para monitorar alterações nos arquivos de partitura. Quando o usuário abre um arquivo e o edita no software externo, o `notify` detecta a mudança e dispara a criação automática de rascunho. Suporta `inotify` (Linux) e `ReadDirectoryChangesW` (Windows) nativamente.

### Hashing com BLAKE3

O [BLAKE3](https://docs.rs/blake3/) será usado para calcular hashes dos arquivos. É significativamente mais rápido que SHA-256 (aproveita SIMD e paralelismo), ideal para comparar versões e detectar alterações reais no conteúdo. Utilizado no versionamento e na verificação de integridade do backup.

**Configuração:** o cálculo de hash vem **desativado por padrão** e pode ser habilitado na tela de configurações. Quando desativado, a detecção de alterações utiliza apenas tamanho do arquivo + data de modificação (rápido e suficiente para a maioria dos casos). Quando ativado, o hash BLAKE3 é calculado para detectar alterações reais no conteúdo mesmo que o tamanho permaneça igual.

### Compactação com zstd

O [zstd](https://docs.rs/zstd/) (Zstandard) será usado para compactar versões antigas. Oferece taxa de compressão superior ao gzip com velocidade de descompressão muito maior — essencial para que o acesso a versões compactadas seja rápido e transparente ao usuário.

### Busca com SQLite FTS5

A busca com sugestões será implementada via **FTS5** (Full-Text Search) do SQLite. Suporta busca por prefixo (autocompletar enquanto digita), ranking por relevância, e não adiciona dependência extra além do SQLite já utilizado.

## Crates Rust (backend Tauri)

| Crate | Uso |
|-------|-----|
| `rusqlite` + `bundled` feature | SQLite embutido com suporte a FTS5 |
| `notify` | File watching multiplataforma |
| `blake3` | Hash rápido de arquivos |
| `zstd` | Compressão/descompressão de versões |
| `fs2` | Verificar espaço disponível em disco/pendrive |
| `serde` + `serde_json` | Serialização de dados |
| `chrono` | Manipulação de datas (última alteração, timestamps de versão) |
| `walkdir` | Varredura recursiva de diretórios na indexação |
| `thiserror` | Erros tipados no domínio |

## Plugins Tauri

| Plugin | Uso |
|--------|-----|
| `tauri-plugin-shell` | Executar rclone como sidecar e abrir arquivos no app padrão do sistema |
| `tauri-plugin-dialog` | Diálogos nativos (selecionar diretório, confirmações) |
| `tauri-plugin-fs` | Acesso ao file system a partir do frontend |
| `tauri-plugin-store` | Persistir configurações da aplicação (nome da organização, logo, preferências) |
| `tauri-plugin-notification` | Notificar o usuário sobre status de backup |

## Libs Frontend (React)

| Lib | Uso |
|-----|-----|
| `@tanstack/react-virtual` | Virtualização de listas longas de partituras |
| `react-router` | Navegação entre telas (principal, configurações, primeiro acesso) |
| `lucide-react` | Ícones consistentes na interface |