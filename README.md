# Score Maestro

Aplicativo desktop para Windows e Linux que organiza partituras e arquivos musicais. Oferece controle de versões ("main" e "draft") e realiza backup na nuvem apenas das versões "main". Não há necessidade de login: basta abrir e usar.

## Problemas

- Partituras espalhadas e desorganizadas, frequentemente com arquivos duplicados da mesma música para o mesmo instrumento.
- Dificuldade em identificar qual versão de um arquivo é a mais recente.
- Fluxo de trabalho em dois computadores (um para criar/atualizar partituras e outro para consultar/imprimir), gerando divergências.

## Objetivos

- Centralizar partituras com metadados e fornecer busca e filtros eficientes.
- Controlar versões ("main" e "draft"): realizar backup no Google Drive apenas das versões "main" e manter os rascunhos localmente.
- Preservar a estrutura de pastas já existente do usuário.
- Permitir que outros computadores atualizem a lista de partituras.
- Estrutura de dados: cada "música" (ex.: "Serenade") contém arquivos por instrumento (os próprios arquivos representam os instrumentos).
- O backup será realizado via API do Google Drive.
- O sistema deve funcionar offline: haverá um diretório local onde os dados baixados do Google Drive serão armazenados.
- À medida que o usuário adiciona informações (por exemplo: instrumento, compositor, arranjador etc.), o sistema as memoriza para sugeri‑las em futuras edições.

O objetivo é lançar a versão 1.0 de forma simples e direta.

## Informações

**Computador**

- Nome: inicia com um UUID gerado aleatoriamente; o usuário pode alterá‑lo posteriormente.
- Dados para integração com o Google Drive.

**Música**

- id
- nome
- compositor
- arranjador
- categoria

**Instrumento / Partitura**

- id
- id da música
- nome do instrumento
- data/hora e tamanho do arquivo
- computador host
- caminho do arquivo

## Funcionalidades

- Adicionar música (por arquivo ou diretório)
- Editar música
- Abrir partitura
- Detectar/Verificar alterações
- Realizar backup
- Configurações
- Sugestão de músicas enquanto se digita na busca (contextual por escopo: todas, favoritas, categoria etc.)
- Favoritos
- Categorias (ex.: clássicas, "Harpa Cristã"); uma música pode pertencer a várias categorias
- Listar rascunhos ativos

## Fluxos detalhados

**Primeira execução**

Na primeira execução, o aplicativo solicita o nome do computador e a chave da API do Google Drive (Service Account). O campo de nome vem preenchido com um UUID que o usuário pode alterar.

**Adicionar música (cabeçalho)**

Ao clicar em "adicionar música", abre-se um modal solicitando o nome da música, com botões para cancelar e salvar.

**Adicionar arquivo (cabeçalho)**

Ao clicar em "adicionar arquivo", abre‑se o seletor com filtro para `.mus`, `.musx` e `.pdf` (um arquivo por vez). Se for escolhido um arquivo inválido, o sistema alerta e pede um arquivo válido.

As informações de música e instrumento são obtidas a partir do nome do arquivo; ex.: `EIS O NOSSO DEUS - Alto Sax. 1.mus`.

Se a música já existe, o arquivo é anexado à música correspondente. Se a música e o instrumento já existem, o sistema indica o conflito e orienta a usar o ícone de lápis da música para atualizar a partitura. Quando tudo estiver correto, um modal exibe os dados extraídos (nome da música, nome do instrumento e caminho), que podem ser editados.

**Adicionar diretório (cabeçalho)**

Ao clicar em "adicionar diretório", abre‑se o seletor de pastas. Se o diretório não contiver arquivos `.mus`, `.musx` ou `.pdf`, o sistema solicita outra pasta. As informações são extraídas dos nomes dos arquivos dentro da pasta.

**Adicionar arquivo dentro da música**

Ao passar o mouse sobre uma música ou ao clicar nela, aparece um ícone de "+" que permite adicionar uma partitura diretamente vinculada à música selecionada.

## Interface

**Header**

- Esquerda: logo do Score Maestro.
- Direita: botões — adicionar música, adicionar arquivo, indexar diretório e configurações.

**Sidebar esquerda**

- Biblioteca: "Todas as partituras" (padrão), "Favoritadas", "Rascunhos ativos".
- Categorias: categorias criadas pelo usuário (ex.: "Harpa Cristã").

**Área principal**

- Duplo clique deve abrir o arquivo com o software padrão do sistema.
- Reflete a seleção da sidebar esquerda (padrão: "Todas as partituras").
- Barra de pesquisa com sugestões enquanto se digita, filtrando dentro da categoria selecionada.
- Ao clicar numa música, expande para mostrar todos os instrumentos disponíveis.

**Sidebar direita**

- Aparece apenas ao selecionar um instrumento de uma música.
- Exibe informações sobre o arquivo e oferece opções para editar ou atualizar. Se o arquivo estiver em rascunho, deve haver um botão para torná‑lo "main".

**Footer**

- Status do último backup na nuvem (data/hora).
- Se houver backup em andamento, exibe a porcentagem (semelhante ao Google Drive).

**Tela de configurações**

- Função principal: alterar o nome do computador.
- Não deve exibir as credenciais ou detalhes da API do Google Drive.
- Ao final da tela de configurações deve constar a frase: "Made by Rhafaell with lots of coffee ☕".

## Arquitetura

Arquitetura orientada a domínio (Hexagonal / Clean Architecture): regras de versionamento e backup no domínio; adaptadores para persistência (SQLite via Tauri/Rust) e provedores externos; UI em React/TypeScript.

## Tecnologias

- **UI:** React + TypeScript + Vite + Tailwind CSS
- **Desktop:** Tauri (Rust)
- **Banco local:** SQLite (via Tauri)
- **Formatos suportados:** .pdf, .mus, .musx
- **Backup remoto:** Google Drive (Service Account)

## Decisões técnicas

### Monitoramento de arquivos com `notify`

A crate [notify](https://docs.rs/notify/) será usada para monitorar alterações nos arquivos de partitura. Quando o usuário edita um arquivo em um software externo, o `notify` detecta a mudança e pode disparar a criação automática de um rascunho. Suporta `inotify` (Linux) e `ReadDirectoryChangesW` (Windows).

### Busca com SQLite FTS5

A busca com sugestões será implementada via **FTS5** (Full-Text Search) do SQLite. Suporta busca por prefixo (autocompletar enquanto digita), ranking por relevância e não exige dependências adicionais além do SQLite.

## Crates Rust (backend Tauri)

| Crate | Uso |
|-------|-----|
| `rusqlite` (com feature `bundled`) | SQLite embutido com suporte a FTS5 |
| `notify` | Monitoramento de arquivos multiplataforma |
| `fs2` | Verificar espaço disponível em disco/pendrive |
| `serde` + `serde_json` | Serialização de dados |
| `chrono` | Manipulação de datas (timestamps de versão, última alteração) |
| `walkdir` | Varredura recursiva de diretórios na indexação |
| `thiserror` | Erros tipados no domínio |

## Plugins Tauri

| Plugin | Uso |
|--------|-----|
| `tauri-plugin-dialog` | Diálogos nativos (seleção de diretório, confirmações) |
| `tauri-plugin-fs` | Acesso ao sistema de arquivos a partir do frontend |
| `tauri-plugin-store` | Persistir configurações da aplicação |
| `tauri-plugin-notification` | Notificar o usuário sobre status de backup |

## Bibliotecas Frontend (React)

| Lib | Uso |
|-----|-----|
| `@tanstack/react-virtual` | Virtualização de listas longas de partituras |
| `react-router` | Navegação entre telas (principal, configurações, primeiro acesso) |
| `lucide-react` | Ícones consistentes na interface |
| `react-hot-toast` | Notificações (ex.: salvo, atualizando, erros) |
