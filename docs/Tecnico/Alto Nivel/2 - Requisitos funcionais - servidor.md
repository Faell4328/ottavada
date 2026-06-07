# 1. Indexação de Diretórios

O sistema deve permitir a indexação de diretórios que contenham arquivos de partituras em formatos compatíveis.

Após a indexação, o sistema deve monitorar os diretórios indexados por meio da funcionalidade **Consultar Alterações**, identificando automaticamente a adição, modificação ou remoção de arquivos de partitura.

As alterações detectadas devem ser refletidas automaticamente no repertório gerenciado pelo sistema.

## 1.1. Sugestão de Nome da Música

Durante o processo de indexação, o sistema deve utilizar o nome do diretório como sugestão para o nome da música.

**Exemplo:** `Hino Nacional/` - sugestão: **Hino Nacional**

## 1.2. Sugestão de Instrumento

Durante o processo de indexação, o sistema deve utilizar o nome do arquivo para sugerir o instrumento associado à partitura.

**Exemplos:**

- `Tuba.mus` - sugestão: **Tuba**
- `Hino Nacional - Tuba.mus` - sugestão: **Tuba**

Caso não seja possível identificar o instrumento a partir do nome do arquivo, o campo de sugestão deverá permanecer vazio para preenchimento manual pelo usuário.

---

# 2. Músicas

## 2.1. Operações disponíveis

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
- deletar música (aqui tem duas escolhas)
  - parar de indexar diretório
  - deletar diretório e arquivos (também parando de indexar)

## 2.2. Visualização expandida

Quando uma música estiver expandida e exibindo suas partituras, o sistema deve monitorar continuamente o diretório indexado e atualizar a interface sempre que alterações forem identificadas.

---

# 3. Partituras

## 3.1. Operações disponíveis

O usuário deve poder:

- abrir a partitura utilizando o aplicativo padrão do sistema operacional associado ao tipo do arquivo;
- abrir o diretório da partitura no Explorador de Arquivos do Windows;
- editar o nome do instrumento;
- utilizar uma partitura como base para criar uma nova;
- excluir definitivamente o arquivo da partitura;
- definir uma partitura como **principal**.

## 3.2. Partitura indisponível

Caso o diretório seja movido, renomeado ou removido, o sistema deve:

- notificar o usuário;
- disponibilizar opções para reindexação;
- permitir a exclusão da música.

## 3.3. Detecção de alterações nas partituras

O sistema deve monitorar continuamente os arquivos das partituras pertencentes aos diretórios indexados e identificar alterações.

As seguintes alterações devem ser detectadas:

- renomeação e exclusão do arquivo;
- alteração da extensão;
- alteração do tamanho do arquivo;
- alteração da data/hora da última modificação;

---

# 4. Categorias

## 4.1. Operações disponíveis

O usuário deve poder:

- criar categorias;
- editar categorias;
- excluir categorias.

## 4.2. Categoria padrão

O sistema deve manter permanentemente a categoria **Sem categoria**.

---

# 5. Compositores e Arranjadores

## 5.1. Criação automática

Compositores e arranjadores devem ser criados automaticamente quando forem associados a uma música durante sua criação ou edição.

## 5.2. Operações disponíveis

O usuário deve poder:

- alterar o nome de compositores;
- alterar o nome de arranjadores;
- remover compositores;
- remover arranjadores.

## 5.3. Sugestões durante digitação

Ao informar compositores ou arranjadores durante a criação ou edição de músicas, o sistema deve sugerir registros já existentes.

---

# 6. Transparência operacional

O sistema deve exibir o progresso de todas as etapas executadas.

### 6.1 Verificar alterações

Após a verificação de alteração, deve abrir um modal informando tudo que foi alterado.

O usuário deve poder escolher continuar ou cancelar.

- Caso o usuário cancele, deve alterar nada internamente (como se não tivesse feito).

## 6.2. Empacotamento com tar e compactar

Ao agrupar partituras:

- o tar deve ser nomeador com o id da música;
- os arquivos devem permanecer na raiz do tar;
  - não devem existir subdiretórios;
- os arquivos devem ser renomeados utilizando o ID da partitura;
- após agrupar e renomear com tar, é preciso comprimir com `zst`.

## 6.3. Etapas upload para nuvem

Etapas:

1. Identificar alterações;
2. Gerar eventos e/ou snapshot;
3. Agrupar e compactar arquivos alterados;
4. Enviar arquivos novos ou modificados.

## 6.4. Snapshot

Um snapshot deve ser gerado quando o arquivo de eventos ultrapassar **2 MB**.

Após a geração do snapshot:

1. O estado consolidado atual deve ser persistido no arquivo de snapshot;
2. Os clientes devem descartar o estado local existente;
3. O estado deve ser restaurado a partir do novo snapshot;
4. O arquivo de eventos do servidor deve ser reinicializado, removendo os eventos já consolidados no snapshot.

---

# 7. Configurações

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

# 8. Backup

O backup deve ser **gerado automaticamente todos os dias**.

Um backup **não deve substituir** o outro.

Backups **mais velhos que 7 dias** devem ser **deletados**.