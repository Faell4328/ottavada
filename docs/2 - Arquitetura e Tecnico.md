# Anotações

- Ao invés de `.json`, será utilizado `.msgpack` por ser mais rápido e leve.
- Antes da compressão os arquivos deve ser juntos em um `.tar`. Isso ocorre devido a possibilidade de uma partitura estar em um diretório e outra em outro.
- Todos os arquivos (Partituras e MessagePack) devem ser comprimidos em `.zst` para ocupar menos espaço, upload e download mais rápido.

---
# Diretórios do Projeto

## Local

Diretório raiz do projeto:
- `C:\Users\<user>\AppData\Roaming\ScoreMaestro\` (Windows).
- `/home/<user>/.local/share/com.rhafa.score-maestro` (Linux).

Diretório temporário do projeto:
- `C:\Users\<user>\AppData\Roaming\ScoreMaestro\temp` (Windows).
- `/home/<user>/.local/share/com.rhafa.score-maestro/temp` (Linux).

Diretório raiz da nuvem:
- `C:\Users\<user>\AppData\Roaming\ScoreMaestro\nuvem` (Windows).
- `/home/<user>/.local/share/com.rhafa.score-maestro/nuvem` (Linux).

Diretório com as partituras compactadas (baixado do drive):
- `C:\Users\<user>\AppData\Roaming\ScoreMaestro\nuvem\song` (Windows).
- `/home/<user>/.local/share/com.rhafa.score-maestro/nuvem/song` (Linux).

! É o mesmo diretório do `tauri-plugin-store`.

## Nuvem

- `Songs/` - diretório com todas as músicas.
- `Songs/{songId}.tar.zst` - arquivo compactado com todas as partituras de uma música.
- `Songs/database.msgpack.zst` - arquivo com todas as informações do banco de dados.

---
# Arquitetura Entre os Computadores

- **Servidor** é o computador mestre: ele mantém todas as partituras indexadas localmente e serve como referência para detectar alterações nos arquivos. É o computador do maestro/compositor/arranjador.
- **Cliente** não indexa o diretório local; consulta as partituras na versão `main` e pode propor alterações pontuais. Essas alterações só são aplicadas no diretório mestre após aprovação do servidor (ou seja, para efetivar a alteração). É o computador de utilidade nos ensaios, sendo mais utilizando para consulta.

# Status das Partituras

**Main**: é a versão definitiva, ela só pode ser especificada pelo servidor. Partituras com esse status, estão autorizados a fazer backup na Nuvem.
**Draft**: é a versão de rascunho, ela só pode ser especificada pelo servidor. Partituras com esse status, não estão autorizados a fazer backup na Nuvem.
**Not Found**: é quando na "verificação de alteração" o arquivo da partitura não é encontrada (podendo ter sido renomeada, movida ou deletada), sendo necessário intervenção, ela só pode ser especifica pelo servidor. Partituras com esse status, não estão autorizadas a fazer backup na Nuvem.
**Pending**: é quando o cliente faz uma alteração, podendo ser alguma informação da música, partitura ou o arquivo. O servidor precisa permitir essa atualização para que seja definitiva. Ela só pode ser especifica pelo Cliente.

! Quando uma partitura `main` for alterada, ela deve virar `draft`.

---
# Tecnologias Utilizadas

## Front-end

- React
- TypeScript
- Vite
- Tailwind CSS
- `@tanstack/react-virtual` - Virtualização de listas longas
- `react-router` - Navegação entre telas
- `lucide-react` - Ícones
- `react-hot-toast` - Notificações em tempo real

## Back-end

- Tauri (Rust)
- Google Drive API (backup)
- `xz` crate - Reduz tamanho para backup na nuvem
- `rusqlite` crate - SQLite com suporte a FTS5
- `serde` + `rmp-serde` - Leitura do arquivo `MessagePack`.
- `fs2` - Espaço em disco
- `thiserror` - Erros tipados
- `tauri-plugin-dialog` - Diálogos nativos (seleção de arquivos/pastas)
- `tauri-plugin-fs` - Acesso ao sistema de arquivos
- `tauri-plugin-store` - Persistência de configurações
- `tauri-plugin-notification` - Notificações ao usuário
- `tracing` + `tracing-subscriber` - Para criar e processar logs
- `tracing-appender` - Para salvar os logs

---
# Interface

### Header
- Logo do Score Maestro | Botões: adicionar música, adicionar arquivo, adicionar diretório, configurações

### Sidebar Esquerda
- **Biblioteca:** Todas as partituras | Favoritadas | Rascunhos ativos | Pendências ativas
- **Categorias:** Lista de categorias do usuário

### Área Principal
- Lista de músicas filtradas pela seleção da sidebar
- Pesquisa com sugestões automáticas
- Clique expande música para mostrar instrumentos
- Duplo clique abre arquivo no software padrão

#### Listagem de partituras
Ao clicar na música será expandido e mostrar uma lista de partituras/instrumentos.
- Deve trazer os intrumentos, extensão e status (`draft` - borda laranja, `pending` - borda amarela, `main` - borda verde, `not found` - borda vermelha)

### Footer
É um dos meios de comunicar com o usuário o que está sendo feito. Ele deve ser sempre visível.
- Status: data/hora do último backup
- Se em progresso: barra de progresso e porcentagem


### Configurações
- O usuário deve poder alterar o nome.
- Alterar o tipo de computador.