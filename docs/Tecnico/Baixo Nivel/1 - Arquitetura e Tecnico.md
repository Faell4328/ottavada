# Anotações

- Ao invés de `.json`, será utilizado `.msgpack` por ser mais rápido e leve.
- Antes da compressão os arquivos deve ser juntos em um `.tar` (arquivos de partituras). Isso ocorre devido a possibilidade das partituras da música estarem em diretórios diferentes.

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
- `C:\Users\<user>\AppData\Roaming\ScoreMaestro\cloud` (Windows).
- `/home/<user>/.local/share/com.rhafa.score-maestro/cloud` (Linux).
! Esse diretório é utilizado para sincronizar com a nuvem

Diretório com as partituras compactadas:
- `C:\Users\<user>\AppData\Roaming\ScoreMaestro\cloud\songs` (Windows).
- `/home/<user>/.local/share/com.rhafa.score-maestro/cloud/songs` (Linux).

Diretório com os eventos:
- `C:\Users\<user>\AppData\Roaming\ScoreMaestro\cloud\events` (Windows).
- `/home/<user>/.local/share/com.rhafa.score-maestro/cloud/events` (Linux).
! Esse é o diretório onde é salvo os arquivos `events.msgpack.zst`.

Diretório das configurações do `rclone`:
- `C:\Users\<user>\AppData\Roaming\ScoreMaestro\rclone` (Windows).
- `/home/<user>/.local/share/com.rhafa.score-maestro/rclone` (Linux).

! É o mesmo diretório do `tauri-plugin-store`.

## Nuvem

- `events.msgpack.zst` - arquivo com as alterações recentes feitas. Cada computador terá o seu (até a `v1` apenas o Servidor gera)
- `snapshot.msgpack.zst` - arquivo com a snapshot do banco de dados (gerado exclusivamente pelo servidor).
- `pending/` - diretório com todas as músicas pendentes.
	- Músicas que foram enviadas pelo Cliente e precisam ser aprovadas pelo servidor.
- `songs/` - diretório com todas as músicas e partituras.
- `songs/{songId}.tar.zst` - arquivo compactado com todas as partituras de uma música.
! O diretório raiz é definido no `rclone`, por exemplo: `/Score Maestro/Songs`

---
# Arquitetura Entre os Computadores

- **Servidor** é o computador mestre: ele mantém todas as partituras indexadas localmente e serve como referência para detectar alterações nos arquivos. É o computador do maestro/compositor/arranjador.
- **Cliente** não indexa o diretório local; consulta as partituras na versão `main` e pode propor alterações pontuais. Essas alterações ficam com status `pending` em um diretório separado (aguardando aprovação ou rejeição) e só são aplicadas no diretório `main` após aprovação do servidor. É o computador de utilidade nos ensaios, sendo mais utilizando para consulta.

! Por questões de simplificação e entregar um protótipo simples que já resolve o problema (da orquestra que pertenço), o cliente será `read-only` até a versão `v1`, após isso, ele irá ser alterado para ter a função falada acima.

# Status das Partituras  
  
**Main**: é a versão definitiva. Só pode ser definida pelo servidor. Partituras com esse status estão autorizadas a realizar backup na nuvem.
**Draft**: é a versão de rascunho. Só pode ser definida pelo servidor. Partituras com esse status não estão autorizadas a realizar backup na nuvem.
**Not Found**: ocorre quando, durante a verificação de alterações, o arquivo da partitura não é encontrado (podendo ter sido renomeado, movido ou deletado). Requer intervenção do usuário (voltando o nome original ou reindexando o arquivo). Partituras com esse status não estão autorizadas a realizar backup na nuvem.
**Pending**: ocorre quando o cliente propõe uma alteração (em metadados ou no arquivo da partitura). O servidor precisa aprovar essa alteração para que ela se torne definitiva. Esse status só pode ser definido pelo cliente.

! Quando uma partitura `main` for alterada, ela deve passar para o status `draft`. 
! Caso já exista uma partitura `main` no diretório `/cloud/songs` e a partitura passe para `draft`, o arquivo previamente armazenado como `main` deve ser mantido. O mesmo vale para o status `not found`.
! O status `pending` não será utilizado até a versão `v1`, mas já estará previsto no sistema.

# Diferença entre Event Log, Snapshot e Database Export  

**Event Log (`events.msgpack`)**:
- Contém as alterações incrementais do sistema (inserções, atualizações e deleções).
- Utilizado para sincronização contínua entre servidor e cliente, aplicando apenas o que mudou desde a última atualização.
- Fluxo: servidor → cliente (v1)
- Em versões futuras, cada computador poderá gerar seu próprio Event Log, mas a sincronização continuará sendo centralizada via servidor (sem comunicação direta entre clientes).

**Snapshot (`snapshot.msgpack`)**:
- Contém um estado parcial do sistema.
- Utilizado para sincronização entre servidor e cliente.
- Fluxo: servidor → cliente.

**Database Export (`backup.msgpack`)**:
- Contém o estado completo do banco de dados.
- Utilizado para backup, migração ou replicação entre servidores.
- Fluxo: servidor → servidor.

---
# Tecnologias Utilizadas

## Front-end

- React
- TypeScript
- Vite
- Tailwind CSS
- `react-router` - Navegação entre telas
- `lucide-react` - Ícones
- `react-hot-toast` - Notificações em tempo real

## Back-end

- Tauri (Rust)
- `zst` crate - Reduz tamanho para backup na nuvem
- `rusqlite` crate - SQLite com suporte a FTS5
- `serde` + `rmp-serde` - Leitura do arquivo `MessagePack`.
- `fs2` - Espaço em disco
- `thiserror` - Erros tipados
- `tauri-plugin-dialog` - Diálogos nativos (seleção de arquivos/pastas)
- `tauri-plugin-fs` - Acesso ao sistema de arquivos
- `tauri-plugin-store` - Persistência de configurações
- `tracing` + `tracing-subscriber` - Para criar e processar logs
- `tracing-appender` - Para salvar os logs

---
# Interface
### Primeiro acesso
- O usuário pode importar um arquivo `backup.msgpack`.

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
- Pode forçar a geração de snapshot.
	- Caso o usuário queira por algum motivo, força a geração de um snapshot.
- Importar um arquivo de snapshot.
	- O usuário pode carregar um arquivo `snapshot.msgpack` ou `snapshot.msgpack.zst` para carregar um estado do banco de dados.

### Configurações  
  
- O usuário deve poder alterar o nome do dispositivo.
- O usuário deve poder alterar o tipo de computador (ex: servidor ou cliente).
- O usuário deve poder forçar a geração de um snapshot.
- O usuário deve poder exportar o bando de dados e o `tauri-plugin-store`.
	- Permitir gerar um `backup.msgpack` com todas as informações do banco de dados.
- O usuário deve poder importar `backup.msgpack`.