# 1. Manipulação de diretórios e arquivos

## 1.1 Renomear arquivos

O sistema só pode mudar o nome com o novo nome sugerido pelo usuário e sua autorização, apenas em caso de conflito.

## 1.2 Remoção de diretórios e arquivos

O sistema só pode deletar o diretório ou arquivo com autorização do usuário.

---

# 2. Status

## 2.1 Música

Para a música ser definida automaticamente como:

- **principal** (`main`) - quando possuir ao menos uma partitura definida como principal;

- **rascunho** (`draft`) - quando todas as partituras estiverem definidas como rascunho;

- **não encontrada** (`not_found`) - quando todas as partituras estiverem definidas como não encontradas.

O usuário deve poder mudar a música de **principal** -> **rascunho** ou **rascunho** -> **principal**.

## 2.2 Partitura

Para uma partitura ser definida automaticamente como:

- **rascunho** (`draft`) - a partitura precisa ser alteradas ou ser substituída ou mudar de extensão;

- **não encontrado** (`not_found`) - a partitura precisa ser renomeada ou deletada, ou o diretório ser alterado ou deletado (alterado TODAS as partituras para esse status).

O usuário deve poder mudar a música de **principal** -> **rascunho** ou **rascunho** -> **principal**.

---

# 3. Músicas

## 3.1 Indexação

O sistema deve permitir a indexação de diretórios que contenham partituras.

Durante o processo de indexação, o sistema deve:

- utilizar o nome do diretório como sugestão automática para o nome da música;
- identificar os instrumentos com base nos nomes dos arquivos encontrados;
- sugerir automaticamente ao usuário os instrumentos detectados.

## 3.2 Operações disponíveis

O usuário deve poder:

- adicionar músicas aos favoritos, tornando-as visíveis na seção **Favoritos**;
- abrir o diretório da música no Explorador de Arquivos do Windows;
- editar as informações da música, incluindo:
  - nome;
  - compositor;
  - arranjador;
  - categorias;
- definir música como **rascunho** (apenas se a música estiver como **principal**);
- definir música como **principal** (apenas se a música estiver como **rascunho**);
- interromper a indexação do diretório, removendo a música e suas partituras apenas do Score Maestro, mantendo os arquivos no computador;
- excluir definitivamente o diretório da música, interrompendo também sua indexação.

## 3.3 Visualização expandida

Quando uma música estiver expandida e exibindo suas partituras, o sistema deve monitorar continuamente o diretório indexado e atualizar a interface sempre que alterações forem identificadas.

## 3.4 Diretório indisponível

Caso o diretório seja movido, renomeado ou removido, o sistema deve:

- notificar o usuário;
- disponibilizar as opções: 
  - reindexação;
  - exclusão da música.

---

# 4. Partituras

## 4.1 Operações disponíveis

O usuário deve poder:

- abrir a partitura utilizando o aplicativo padrão do sistema operacional associado ao tipo do arquivo;
- abrir o diretório da partitura no Explorador de Arquivos do Windows;
- editar o nome do instrumento;
- utilizar uma partitura como base para criar uma nova;
- excluir definitivamente o arquivo da partitura;
- definir uma partitura como **principal**.

## 4.2 Partitura indisponível

Caso o diretório seja movido, renomeado ou removido, o sistema deve:

- notificar o usuário;
- disponibilizar opções para reindexação;
- permitir a exclusão da música.

## 4.3 Detecção de alterações nas partituras

O sistema deve monitorar continuamente os arquivos das partituras pertencentes aos diretórios indexados e identificar alterações.

As seguintes alterações devem ser detectadas:

- renomeação e exclusão do arquivo;
- alteração da extensão;
- alteração do tamanho do arquivo;
- alteração da data/hora da última modificação;

---

# 5. Categorias

## 5.1 Operações disponíveis

O usuário deve poder:

- criar categorias;
- editar categorias;
- excluir categorias.

## 5.2 Categoria padrão

O sistema deve manter permanentemente a categoria **Sem categoria**.

---

# 6. Compositores e Arranjadores

## 6.1 Criação automática

Compositores e arranjadores devem ser criados automaticamente quando forem associados a uma música durante sua criação ou edição.

## 6.2 Operações disponíveis

O usuário deve poder:

- alterar o nome de compositores;
- alterar o nome de arranjadores;
- remover compositores;
- remover arranjadores.

## 6.3 Sugestões durante digitação

Ao informar compositores ou arranjadores durante a criação ou edição de músicas, o sistema deve sugerir registros já existentes.

---

# 7. Servidor Score Maestro

## 7.1 Telemetria

O sistema deve enviar dados de telemetria:

- a cada 5 minutos após sua abertura.

Os dados enviados deve ser:

- xxx

## 7.2 Atualizações

O sistema deve suportar atualização de versão. Utilizando o próprio mecanismo do Tauri.

---

# 8. Filtros

Os filtros devem operar de forma cumulativa.

## 8.1 Categoria

O usuário deve poder selecionar categorias específicas para visualizar apenas as músicas associadas.

## 8.2 Compositor e arranjador

O usuário deve poder selecionar:

- compositor;
- arranjador;

para filtrar músicas relacionadas.

## 8.3 Valores padrão

Os filtros devem iniciar com os seguintes valores:

- Categoria: nenhuma selecionada (**Todas as músicas**);
- Compositor: **Todos**;
- Arranjador: **Todos**.

---

# 9. Configurações

O usuário deve poder:

- alterar o nome do computador;
- alterar o nome da organização;
- alterar o provedor de nuvem;
- forçar a geração de snapshots;
- importar backups locais;
- exportar backups locais;
- importar backups em nuvem;
- exportar backups em nuvem.

---

# 10. Nuvem

## 10.1 Provedores suportados

O Score Maestro deve suportar:

- Koofr (provedor recomendado);
- Google Drive;
- WebDAV;
- SFTP.

## 10.2 Rclone

O Score Maestro deve utilizar internamente o `rclone` como mecanismo padrão para sincronização, envio e recebimento de arquivos.

O executável do `rclone` deve ser distribuído e incorporado ao sistema, não sendo necessária instalação, configuração ou interação manual por parte do usuário.

Toda configuração relacionada ao `rclone`, incluindo criação de remotes, autenticação, parâmetros de sincronização, diretórios, credenciais e gerenciamento de conexões, deve ser realizada exclusivamente pelo Score Maestro através de sua interface e fluxos internos.

O sistema deve abstrair completamente a utilização do `rclone`.

----

# 11. Transparência operacional

O sistema deve exibir o progresso de todas as etapas executadas.

## 11.1 Etapas upload para nuvem

Etapas:

1. Identificar alterações;
2. Gerar eventos e/ou snapshot;
3. Agrupar e compactar arquivos alterados;
4. Enviar arquivos novos ou modificados.

## 11.2 Etapas download da nuvem

Etapas:

1. Identificar alterações;
2. Aplicar eventos e/ou snapshot;
3. Baixar arquivos novos ou modificados.

## 11.4 Restrições durante sincronização

Durante sincronizações, o usuário poderá apenas:

- expandir partituras de uma música;
- abrir partituras com duplo clique;
- realizar pesquisas;
- utilizar filtros.

Demais operações devem permanecer bloqueadas.

## 11.5 Empacotamento com `tar`

Ao agrupar partituras:

- os arquivos devem permanecer na raiz do pacote;
- não devem existir subdiretórios;
- os arquivos devem ser renomeados utilizando o ID da partitura.

## 11.6 Snapshot

Um snapshot deve ser gerado quando o arquivo de eventos ultrapassar **2 MB**.

Após a geração:

- o cliente deve limpar os dados locais e os dados devem ser restaurados a partir do snapshot.
- o arquivo de events do servidor é zarado.

### 11.6 Snapshot

Um snapshot deve ser gerado quando o arquivo de eventos ultrapassar **2 MB**.

Após a geração do snapshot:

1. O estado consolidado atual deve ser persistido no arquivo de snapshot;
2. Os clientes devem descartar o estado local existente;
3. O estado deve ser restaurado a partir do novo snapshot;
4. O arquivo de eventos do servidor deve ser reinicializado, removendo os eventos já consolidados no snapshot.

## 11.7 Persistência

Durante a geração dos arquivos agrupados (`tar`) e sua compactação (`zst`), caso a partitura esteja nos estados `draft` ou `not_found`, o sistema deve manter a última versão disponível marcada como `main`.

---

# 12. Inicialização

Durante a iniciação do aplicativo, o sistema deve:

1. Verificar se existe atualização.

2. Enviar telemetria.

3. Verificar alterações.