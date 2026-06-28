# Como funciona por baixo do capô?

O sistema utiliza `Tauri` por baixo de tudo. A interface fica no frontend e as rotinas de arquivo, banco e integração nativa ficam no backend em Rust.

# 1. Front

- `React` e `TypeScript` - constroem a interface e deixam os componentes tipados.
- `Vite` - faz o servidor de desenvolvimento e o build rápido da aplicação web.

## 1.1. Dependências de front

- `@tauri-apps/api` - ponte do frontend com as APIs nativas do Tauri.
- `@tauri-apps/plugin-dialog` - abre caixas nativas de seleção de arquivo e pasta.
- `dotenv-cli` - carrega variáveis de ambiente nos scripts locais.
- `lucide-react` - fornece ícones prontos para a interface.
- `react-hot-toast` - mostra notificações rápidas de sucesso, erro e aviso.
- `react-router` - controla a navegação entre telas e rotas.

## 1.2. Dependências de desenvolvimento e testes

- `@tauri-apps/cli` - compila e empacota o app Tauri no ambiente de desenvolvimento e release.
- `@testing-library/jest-dom` - adiciona matchers mais legíveis aos testes de UI.
- `@testing-library/react` - testa componentes React pelo comportamento.
- `jsdom` - simula o navegador para rodar testes no Node.
- `tailwindcss` - gera estilos utilitários usados pelo frontend.
- `typescript` - faz a checagem de tipos do código.
- `vite` - também participa do pipeline de build e preview.
- `vitest` - executa os testes automatizados do frontend.

# 2. Back

- `Rust` - implementa a lógica local, acesso ao banco e integração com o sistema operacional.
- `tauri` - fornece a base do app desktop e o runtime do backend.
- `tauri-build` - gera a configuração e os arquivos necessários para compilar o app Tauri.
- `tauri-plugin-updater` - gerencia o fluxo de atualização automática.
- `tauri-plugin-single-instance` - controla a execução de uma única instância do aplicativo.
- `tauri-plugin-opener` - abre recursos externos a partir do backend.
- `tauri-plugin-dialog` - exibe diálogos nativos para o usuário.
- `tauri-plugin-shell` - permite executar comandos externos com segurança controlada.
- `tauri-plugin-fs` - acessa arquivos e diretórios pelo backend.
- `tauri-plugin-store` - armazena preferências locais do app.
- `tauri-plugin-notification` - dispara notificações nativas em resposta a eventos do app.
- `rusqlite` - acesso ao SQLite com suporte compilado localmente.
- `chrono` - manipula datas e horários do domínio e do banco.
- `serde` e `rmp-serde` - serializam e desserializam os arquivos `MessagePack`.
- `reqwest` - faz requisições HTTP, por exemplo para checagem de atualização e integrações de rede.
- `notify` - observa mudanças no sistema de arquivos.
- `walkdir` - percorre diretórios de forma segura e previsível.
- `tar` - monta os arquivos `.tar` usados no fluxo de backup.
- `zstd` - comprime os backups em `.zst` para reduzir tamanho.
- `fs2` - ajuda a medir espaço livre e uso de disco.
- `uuid` - gera identificadores únicos para registros do banco e eventos.
- `url` - valida e manipula URLs.
- `thiserror` - simplifica a definição de erros tipados.
- `tracing` e `tracing-subscriber` - registram e organizam logs da aplicação.
- `tracing-appender` - grava logs em arquivo.
- `windows-sys` - expõe APIs específicas do Windows quando necessário.

# 3. Banco de Dados e Armazenamento

- `SQLite` - guarda os dados locais da biblioteca, backups e estados do app.
- `MessagePack` (`.msgpack`) - formato compacto usado nos dados exportados e sincronizados.
- `FTS5` - extensão do SQLite usada para busca textual mais rápida e flexível.

# 4. Outros

- `rclone` - faz a sincronização com a nuvem.
- `.tar` + `.zst` - empacotam e comprimem os arquivos de música para backup.
