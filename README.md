# Score Maestro

Aplicativo desktop (Windows e Linux) para organizar partituras e arquivos musicais. Oferece controle de versões (main e draft) e realiza backup na nuvem apenas das versões **main**. Sem necessidade de login ou cadastro: abra e use.
## Problemas

- Partituras espalhadas e desorganizadas, muitas vezes com arquivos duplicados da mesma música para o mesmo instrumento.
- Dificuldade para identificar qual versão de um arquivo é a mais recente.
- Fluxo de trabalho em dois computadores: um para criar/atualizar partituras e outro apenas para consultar e imprimir, gerando divergências.
## Objetivos

- Centralizar partituras com metadados e fornecer busca e filtros eficientes.
- Controlar versões (main e draft): fazer backup no Google Drive apenas das versões **main** e manter os **drafts** localmente.
- Preservar a estrutura de pastas existente do usuário.
- Permitir que outros computadores atualizem a lista de partituras.
- Estrutura de dados: cada “música” (ex.: Serenade) contém arquivos por instrumento (os próprios arquivos são os instrumentos).
- O backup será realizado via API do Google Drive.
- O sistema deve funcionar offline: será criado um diretório onde os dados baixados do Google Drive são armazenados localmente.
- À medida que o usuário adiciona informações (por exemplo: instrumento, compositor, arranjador etc.), o sistema as guarda para sugeri‑las durante edições.

Lançar a versão 1.0 de forma simples e direta.
## Informações

**Computador**
- Nome: inicia com um UUID gerado aleatoriamente; o usuário pode alterá‑lo depois.
- Dados para integração com o Google Drive.

**Música**
- id
- nome
- compositor
- arranjador
- categoria

**Instrumento/Partitura**
- id
- id da música
- nome do instrumento
- data/hora e tamanho do arquivo
- computador host
- caminho do arquivo

## Funcionalidades

- Adicionar música (por arquivo ou diretório)
- Alterar música
- Abrir partitura
- Verificar alterações
- Realizar backup
- Configurações
- Sugestão de músicas ao digitar na pesquisa (busca contextual conforme o escopo: todas, favoritas, categoria etc.)
- Favoritos
- Categorias (ex.: clássicas, harpa cristã etc.) — uma música pode pertencer a várias categorias
- Listar rascunhos ativos

## Funcionalidades detalhadas

**Ao abrir o sistema pela primeira vez**
- Na primeira execução, o aplicativo solicita o nome do computador e a chave da API do Google Drive (Service Account). O campo de nome virá preenchido com um UUID que o usuário pode modificar.
**Adicionar música – cabeçalho:**
- Ao clicar em "adicionar música", abre‑se um modal solicitando o nome da música, com botões de cancelar e salvar.
- Se a música já existir, é mostrado um erro indicando a duplicação.
- Se não existir, a música é criada (mesmo sem partitura/instrumento).
**Adicionar música (por arquivo) – cabeçalho:**
- Ao clicar em "adicionar arquivo", abre‑se o seletor com filtro para `.mus`, `.musx` e `.pdf` (um arquivo por vez).
- Se for escolhido um arquivo inválido (mesmo contornando o filtro), o sistema avisa e pede um arquivo válido.
- As informações de música e instrumento são obtidas do nome do arquivo; ex.: `EIS O NOSSO DEUS - Alto Sax. 1.mus`.
- Se a música já existe, o arquivo é anexado à música correspondente.
- Se a música e o instrumento já existem, o sistema apresenta um erro e orienta a usar o ícone de lápis da música para atualizar a partitura.
- Com tudo correto, um modal exibe os dados extraídos (nome da música, nome do instrumento e caminho), que podem ser editados pelo usuário.
**Adicionar música (por diretório) – cabeçalho:**
- Ao clicar em "adicionar diretório", abre‑se o seletor de pastas (somente diretórios).
- Se o diretório não contiver arquivos `.mus`, `.musx` ou `.pdf`, o sistema alerta e pede outra pasta.
- As informações de música e instrumento são extraídas dos nomes dos arquivos dentro da pasta (ex.: `EIS O NOSSO DEUS - Alto Sax. 1.mus`).
- Se a música já existe, os arquivos são adicionados à música correspondente.
- Se a música e o instrumento já existem, o sistema mostra um erro e orienta a usar o ícone de lápis da música para atualizá‑los.
- Com tudo correto, um modal apresenta os dados extraídos (nome da música, nome do instrumento e caminho), que podem ser ajustados.
**Adicionar música (por arquivo) – dentro da música:**
- Ao passar o mouse sobre uma música ou ao clicar nela, aparece um ícone de “+” que permite adicionar uma partitura. O fluxo é o mesmo do cabeçalho, mas já está vinculado à música selecionada.
## Interface

### Header

- **Esquerda:** logo do Score Maestro.
- **Direita:** botões — adicionar música, adicionar arquivo, indexar diretório e configurações.
### Sidebar esquerda

- **Biblioteca:** "Todas as partituras" (padrão), "Favoritadas", "Rascunhos ativos".
- **Categorias:** categorias criadas pelo usuário (ex.: "Harpa Cristã").

### Área principal

- Duplo clique deve abrir o arquivo com o software padrão do sistema.
- Reflete a seleção da sidebar esquerda (padrão: "Todas as partituras").
- Barra de pesquisa com sugestões enquanto digita, filtrando dentro da categoria selecionada.
- Ao clicar numa música, expande para mostrar todos os instrumentos disponíveis.

### Sidebar direita

- Aparece somente ao selecionar um instrumento de uma música.
- Exibe informações sobre o arquivo e oferece opções para editar ou atualizar. Se o arquivo estiver em draft, deve haver um botão para torná‑lo **main**.
### Footer

- Status do último backup na nuvem (data/hora).
- Caso exista algum backup em andamento, deve aparecer aqui a porcentagem (parecido com o Google Drive).
### Tela de configurações

- Única função é alterar o nome do computador.
- Não deve mostrar as informações de API do Google Drive.
- Ao final da tela de configurações deve constar a frase: "Made by Rhafaell with lots of coffee ☕".

## Arquitetura

Arquitetura orientada a domínio (Hexagonal / Clean Architecture): regras de versionamento e backup no domínio; adaptadores para persistência (SQLite via Tauri/Rust) e provedores externos; UI em React/TypeScript.

## Tecnologias

- **UI:** React + TypeScript + Vite + Tailwind CSS
- **Desktop:** Tauri (Rust)
- **Banco local:** SQLite (via Tauri)
- **Formatos:** .pdf, .mus, .musx
- **Backup remoto:** Google Drive (Service Account)

## Decisões técnicas

### File watching com notify

A crate [notify](https://docs.rs/notify/) será usada para monitorar alterações nos arquivos de partitura. Quando o usuário abre um arquivo e o edita no software externo, o `notify` detecta a mudança e dispara a criação automática de rascunho. Suporta `inotify` (Linux) e `ReadDirectoryChangesW` (Windows) nativamente.

### Busca com SQLite FTS5

A busca com sugestões será implementada via **FTS5** (Full-Text Search) do SQLite. Suporta busca por prefixo (autocompletar enquanto digita), ranking por relevância, e não adiciona dependência extra além do SQLite já utilizado.

## Crates Rust (backend Tauri)

| Crate | Uso |
|-------|-----|
| `rusqlite` + `bundled` feature | SQLite embutido com suporte a FTS5 |
| `notify` | File watching multiplataforma |
| `fs2` | Verificar espaço disponível em disco/pendrive |
| `serde` + `serde_json` | Serialização de dados |
| `chrono` | Manipulação de datas (última alteração, timestamps de versão) |
| `walkdir` | Varredura recursiva de diretórios na indexação |
| `thiserror` | Erros tipados no domínio |

## Plugins Tauri

| Plugin | Uso |
|--------|-----|
| `tauri-plugin-dialog` | Diálogos nativos (selecionar diretório, confirmações) |
| `tauri-plugin-fs` | Acesso ao file system a partir do frontend |
| `tauri-plugin-store` | Persistir configurações da aplicação |
| `tauri-plugin-notification` | Notificar o usuário sobre status de backup |

## Libs Frontend (React)

| Lib | Uso |
|-----|-----|
| `@tanstack/react-virtual` | Virtualização de listas longas de partituras |
| `react-router` | Navegação entre telas (principal, configurações, primeiro acesso) |
| `lucide-react` | Ícones consistentes na interface |
| `react-hot-toast` | Para notificações (ex: salvo, atualizando e até erros) |