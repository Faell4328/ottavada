# 1. Indexação de pasta

O sistema deve permitir a indexação de pastas que contenham arquivos de partituras em [formatos compatíveis](4%20-%20Requisitos%20nao%20funcionais.md#3-extensões-suportadas).

## 1.1. Sugestão de Nome da Música

Durante o processo de indexação, o sistema deve utilizar o nome do diretório como sugestão para o nome da música.

**Exemplo:** `Hino Nacional/` - sugestão: **HINO NACIONAL**.

## 1.2. Sugestão de Instrumento

Durante o processo de indexação, o sistema deve utilizar o nome do arquivo para sugerir o instrumento associado à partitura.

**Exemplos:**

- `Tuba.mus` - sugestão: **Tuba**
- `Hino Nacional - Tuba.mus` - sugestão: **Tuba**

Caso não seja possível identificar o instrumento a partir do nome do arquivo, o campo de sugestão deverá permanecer vazio para preenchimento manual pelo usuário.

## 1.4. Ordem da partituras

Deve ser a mesma ordem que no **Requisitos funcional - ambos** em **Ordem de listagem na música**.

---

# 2. Músicas

## 2.1. Nome da música

O nome da música deve ser sempre escrito com todas as letras em maiúsculo.

Exemplo: `Hino Nacional` deve ser armazenado e exibido como `HINO NACIONAL`.

## 2.2. Operações disponíveis

### 2.2.1. Músicas com status "envio permitido"

O usuário deve poder:

- **abrir**, expande a música e mostrar todas as partituras;
- **abrir local**, abre no explorador de arquivos a pasta indexada daquela música;
- **adicionar/remover nos favoritos**;
- **editar** as informações da música, incluindo:
  - nome;
  - compositor;
  - arranjador;
  - categorias;
- **não permitir envio**, alterando o status da música e das partituras para `draft`;
- **remover música**, deve abrir um modal de dar duas opções para o usuário:
  - **parar de indexar pasta**, remove a música e partitura(s) do Ottavada;
  - **mover pasta e arquivos para lixeira** e arquivos (também parando de indexar).

### 2.2.2. Músicas com status "envio não permitido"

O usuário deve poder:

- **abrir**, expande a música e mostrar todas as partituras;

- **abrir local**, abre no explorador de arquivos a pasta indexada daquela música;

- **adicionar/remover nos favoritos**;

- **editar** as informações da música, incluindo:
  
  - nome;
  - compositor;
  - arranjador;
  - categorias;

- **permitir envio**, alterando o status da música e das partituras `main`;

- **remover música**, deve abrir um modal de dar duas opções para o usuário:
  
  - **parar de indexar pasta**, remove a música e partitura(s) do Ottavada;
  - **mover pasta e arquivos para lixeira** e arquivos (também parando de indexar).

### 2.2.3. Músicas com status "sem partitura"

O usuário deve poder:

- **reindexar música**, alterando caminho e nome da pasta referente aquela música;
- **parar de indexar pasta**, remove música do Ottavada.

---

# 3. Partituras

## 3.1. Operações disponíveis

### 3.1.1. Partituras com status "envio permitido"

O usuário deve poder:

- **abrir**, será aberto a partitura utilizando o aplicativo padrão associado a extensão do arquivo;
- **abrir local**, abre no explorador de arquivos na pasta indexada, com o arquivo da partitura selecionada;
- **editar**, permitindo alterar o nome do instrumento;
- **usar como base**, usa essa partitura como base para criar outra;
- **não permitir envio**, alterando o status da partitura para `draft`;
- **ignorar partitura**, atualiza o status da partitura para `ignored`;
- **mover para lixeira**, move o arquivo para lixeira.

### 3.1.2. Partituras com status "envio não permitido"

O usuário deve poder:

- **abrir**, será aberto a partitura utilizando o aplicativo padrão associado a extensão do arquivo;
- **abrir local**, abre no explorador de arquivos na pasta indexada, com o arquivo da partitura selecionada;
- **editar**, permitindo alterar o nome do instrumento;
- **usar como base**, usa essa partitura como base para criar outra;
- **permitir envio**, alterando o status da partitura para `main`;
- **ignorar partitura**, atualiza o status da partitura para `ignored`;
- **mover para lixeira**, move o arquivo para lixeira.

### 3.1.3. Partituras com status "ignorada"

O usuário deve poder:

- **abrir**, será aberto a partitura utilizando o aplicativo padrão associado a extensão do arquivo;
- **abrir local**, abre no explorador de arquivos na pasta indexada, com o arquivo da partitura selecionada;
- **editar**, permitindo alterar o nome do instrumento;
- **usar como base**, usa essa partitura como base para criar outra;
- **permitir envio**, alterando o status da partitura para `main`;
- **não permitir envio**, alterando o status da partitura para `draft`;
- **mover para lixeira**, move o arquivo para lixeira.

---

# 4. Identificar alterações

## 4.1. Verificar alterações

Ao clicar no botão de "aplicar alterações", o sistema deve identificar alterações nas pastas indexadas, identificando automaticamente:

- adição de nova(s) partitura(s);
- modificação da(s) partitura(s);
- remoção da(s) partitura(s).

É considerado **modificação** quando:

- renomeação;
- alteração da extensão;
- alteração do tamanho do arquivo;
- alteração da data/hora da última modificação;

## 4.2. Relatório de alterações

O relatório é mostrado após a etapa de "verificar alterações".

Ele é exibido em um modal; o usuário deve poder escolher: **continuar** ou **cancelar**.

### 4.2.1. Seções

- **adicionado** - mostra tudo que foi adicionado.
- **alterado** - mostra tudo que foi alterado.
- **removido** - mostra tudo que foi removido.
- **recusados** (<mark>Não implementado</mark>) - todas as ações que o usuário recusou no relatório.

### 4.2.2. Permitindo ou recusando alterações (<mark>Não implementado</mark>)

O usuário deve poder aceitar (marcado por padrão) ou recusar as ações no relatório, exemplo: "A partitura xxx saiu de **Envio permitido** e foi para **Envio não permitido**...", recusando essa opção, a partitura irá continuar com **Envio permitido**.

### 4.2.3. Resumo - adição/alteração/removação de várias partituras da mesma música

Quando tiver uma mesma ação de várias partituras, envolvendo a mesma música, deve agrupar tudo em uma linha. Evitando ter várias linhas para uma mesma coisa, ex: "Foi adicionado na música `xx` as partitura `aaa`, `bbb` e `ccc`".

---

# 5. Categorias

## 5.1. Operações disponíveis

O usuário deve poder:

- criar categorias;
- editar categorias;
- excluir categorias.

---

# 6. Compositores e Arranjadores

## 6.1. Criação automática

Compositores e arranjadores devem ser criados automaticamente quando forem associados a uma música durante sua criação ou edição da música.

## 6.2. Operações disponíveis

O usuário deve poder:

- alterar o nome de compositores;
- alterar o nome de arranjadores;
- remover compositores;
- remover arranjadores.

## 6.3. Sugestões durante digitação

Ao começar a digitar o nome do compositor ou arranjador na criação ou edição de uma música, o sistema deve sugerir os nomes que você já cadastrou, com base no que for sendo digitado.

---

# 7. Transparência operacional

## 7.1. Etapas upload para nuvem

Etapas:

1. Identificar alterações;
2. Gerar eventos e/ou snapshot;
3. Agrupar e compactar arquivos alterados;
4. Enviar arquivos novos ou modificados.

---

# 8. Processamento dos arquivos

## 8.1. Empacotamento com tar e compactar com zst

As partituras com status **envio permitido**, devem ser agrupadas em um `tar` e ser renomeada para o `id` da partitura. Os arquivos devem permanecer na raiz do `tar` (não existir subdiretórios). Depois de juntar tudo com `tar`, deve ser compactado com `zst`.

## 8.2. Snapshot

Um snapshot deve ser gerado quando o arquivo de eventos ultrapassar **1 MB**, antes da compressão.

O snapshot é destinado exclusivamente ao Ottavada no modo **Consultar**. Deve conter somente músicas com status `main` e partituras com status `main`.

Quando um snapshot é gerado, o arquivo de snapshot deve permanecer no diretório local de ações até ser enviado para a nuvem. O arquivo de eventos pode ser removido localmente após a consolidação, pois o snapshot contém todas as alterações anteriores a ele. Se o envio falhar, o snapshot permanece local e será reenviado na próxima sincronização.

Após a geração do snapshot:

1. O catálogo publicado atual deve ser persistido no arquivo de snapshot;
2. Os clientes devem descartar o estado publicado local existente;
3. O estado deve ser restaurado a partir do novo snapshot;
4. O arquivo de eventos do servidor deve ser reinicializado, removendo os eventos já consolidados no snapshot;
5. O snapshot local deve permanecer disponível até que o fluxo de sincronização o envie para a nuvem.

## 8.3. Backup

Essas partituras com status **envio não permitido** e **ignoradas** devem renomeadas com o `id` da partitura e enviadas para `/backup_scores_draft_ignored`, como são arquivos que podem ser alterados com frequência e em menor quantidade, não é compactado. Isso trás o benefício: quando várias partituras são enviada e algumas são alteradas, só é enviado as que foram alteradas e as outras não são reenviadas.

---

# 9. Configurações

O usuário deve poder:

- alterar o nome do computador;
- alterar o nome da organização;
- alterar o provedor de nuvem;
- exportar backup  (nuvem);
- importar backups (nuvem);
- alterar idioma.

---

# 10. Backup

O backup deve ser **gerado automaticamente** a cada 1 hora, com base no timestamp do último backup.

Um backup **não deve substituir** o outro. O sistema deve manter os 10 backups mais recentes no diretório de backup. Após a geração de um novo backup, os arquivos mais antigos que excederem esse limite devem ser removidos.

Cada backup deve ser salvo com um nome baseado no timestamp de geração, no formato `backup - {timestamp}.msgpack.zst`, sem substituir backups anteriores.

O backup completo deve conter o banco de dados do modo **Gerir**.

Deve ter um timer em loop de 1 hora para geração de backup em sessões longas (<mark>Não implementado</mark>).

## 10.1. Importar backup

No "importar backup", caso os arquivos das partituras já existam, o Ottavada deve verificar se os arquivos que ele tem é mais recente que o que tem no computador, caso seja, deve substituir o arquivo local pelo que o Ottavada baixou, caso não seja ou seja igual, deve manter o arquivo original (<mark>Não implementado</mark>).

---

# 11. Inicialização

Durante a iniciação do aplicativo, o sistema deve:

1. Verificar se existe atualização;

2. Enviar telemetria;

3. Gerar backup (se tiver na hora) e iniciar timer de backup (<mark>Não implementado</mark>).

---

# 12. Identificação de duplicação

## 12.1. Unicidade

O sistema deve impedir duplicidades conforme as regras abaixo:

- músicas: a combinação de nome, compositor e arranjador deve ser única; músicas com o mesmo nome podem existir quando houver compositor ou arranjador diferente;
- partituras: o nome do instrumento deve ser único dentro da mesma música;
- arquivos: o mesmo arquivo físico não pode ser indexado mais de uma vez;
- categorias: o nome deve ser único;
- compositores: o nome deve ser único;
- arranjadores: o nome deve ser único.

As comparações devem ignorar diferenças entre letras maiúsculas e minúsculas. O sistema deve informar o conflito e impedir a operação.

**Exemplo**:

| **Errado**                                                                                                                                    | **Correto**                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Música 1**: `Eis o Nosso Deus` com o mesmo compositor e arranjador<br/>**Música 2**: `Eis o Nosso Deus` com o mesmo compositor e arranjador | **Música 1**: `Eis o Nosso Deus` com compositor `A`<br/>**Música 2**: `Eis o Nosso Deus` com compositor `B`                              |
| **Partitura 1**: `Violino I`<br/>**Partitura 2**: `Violino I`<br/>**Partitura 3**: `Trompete`<br/>**Partitura 4**: `Trompete`                 | **Partitura 1**: `Violino I`<br/>**Partitura 2**: `Violino I (Solo)`<br/>**Partitura 3**: `Trompete 1`<br/>**Partitura 4**: `Trompete 2` |

> Isso evita redundância e dúvidas no repertório.

## 12.2. Ao indexar uma pasta já indexada

O sistema deve emitir um aviso e não deixar o usuário avançar.

## 12.3. Possíveis músicas duplicadas (<mark>Não implementado</mark>)

O sistema deve identificar nomes de músicas parecidos, ex: `"Hino Nacional"` e `"O Hino Nacional"`, o sistema deve identificar e reportar para o usuário.

Deve ser usado o **Trigram / N-gram Similarity** para identificar as possíveis músicas duplicadas, sendo executado no **indexar diretório**.

## 12.4. Adição de arquivo duplicado após a indexação (<mark>Não implementado</mark>)

O usuário por acidente pode adicionar um novo arquivo com nome, mas com extensão diferente ou um nome ligeiramente diferente, por exemplos: 

- `Hino Nacional - Oboe.mus` e `Hino Nacional - Oboe.musx`;

- `Hino Nacional - Score.musx` e `Hino Nacional - Score.pdf`;

- `Hino Nacional - Oboe.mscz` e `Hino Nacional - Oboe.mscz`.
