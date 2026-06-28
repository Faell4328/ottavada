# 1. Indexação de Diretórios

O sistema deve permitir a indexação de diretórios que contenham arquivos de partituras em formatos compatíveis.

Após a indexação, o sistema deve monitorar os diretórios indexados por meio da funcionalidade **Consultar Alterações**, identificando automaticamente a adição, modificação ou remoção de arquivos de partitura no diretório.

As alterações detectadas devem ser refletidas automaticamente no repertório gerenciado pelo sistema.

## 1.1. Sugestão de Nome da Música

Durante o processo de indexação, o sistema deve utilizar o nome do diretório como sugestão para o nome da música.

**Exemplo:** `Hino Nacional/` - sugestão: **HINO NACIONAL**.

## 1.2. Sugestão de Instrumento

Durante o processo de indexação, o sistema deve utilizar o nome do arquivo para sugerir o instrumento associado à partitura.

**Exemplos:**

- `Tuba.mus` - sugestão: **Tuba**
- `Hino Nacional - Tuba.mus` - sugestão: **Tuba**

Caso não seja possível identificar o instrumento a partir do nome do arquivo, o campo de sugestão deverá permanecer vazio para preenchimento manual pelo usuário.

## 1.3. Ordem das partituras

1° Deve vir as partituras sem nome;

2° Deve vir as partituras que tiveram o instrumento identificado;

3° Deve vir os instrumentos que foram identificados, mas não está na lista. Eles devem ficar em ordem alfabética.

---

# 2. Músicas

## 2.1. Nome da música

O nome da música deve ser todo em maiúsculo, por questão de padronização.

## 2.2. Operações disponíveis

O usuário deve poder:

- adicionar músicas aos favoritos, tornando-as visíveis na seção **Favoritos**;
- abrir o diretório da música no Explorador de Arquivos do Windows;
- editar as informações da música, incluindo:
  - nome;
  - compositor;
  - arranjador;
  - categorias;
- definir música como **não permitir envio** (apenas se a música estiver como **permitir envio**);
- definir música como **permitir envio** (apenas se a música estiver como **não permitir envio**);
- deletar música (aqui tem duas escolhas)
  - parar de indexar diretório
  - deletar diretório e arquivos (também parando de indexar)

## 2.3. Visualização expandida

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
- definir uma partitura como **permitir envio**.

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

- Caso o usuário cancele, não deve alterar nada internamente (como se não tivesse feito).

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

Um snapshot deve ser gerado quando o arquivo de eventos ultrapassar **1 MB**.

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

---

# 9. Relatório de alterações

O relatório é executado quando o usuário clica em "aplicar alterações", depois da etapa de "consultar alterações". O objetivo é mostrar o que foi adicionado, alterado e deletado, permitindo o usuário cancelar adições, alterações e remoções.

O relatório deve ser direto e resumido, sendo claro para o usuário.

## 9.1. Seções

- **adicionado** - mostra tudo que foi adicionado.

- **alterado** - mostra tudo que foi alterado.

- **removido** - mostra tudo que foi removido.

### 9.2. Música adicionada

Quando uma música for adicionada via indexação, deve mostrar: "A músicas `xxx` foi adicionada com `xxx` partituras".

---

# 10. Inicialização

Durante a iniciação do aplicativo, o sistema deve:

1. Verificar se existe atualização.

2. Enviar telemetria.

---

# 11. Identificação de duplicação (<mark>Não implementado</mark>)

## 11.1. Possíveis músicas duplicadas

O sistema deve identificar nomes de músicas parecidos, ex: `"Hino Nacional"` e `"O Hino Nacional"`, o sistema deve identificar e reportar para o usuário.

Deve ser usado o **Trigram / N-gram Similarity** para identificar as possíveis músicas duplicadas, sendo executado no **indexar diretório**.

## 11.2. Varredura de alterações (etapa do "aplicar alterações")

Como o sistema indexa diretório, o usuário pode por fora duplicar uma partitura já indexada, por exemplo: 

- `Hino Nacional - Oboé.mus` e `Hino Nacional - Oboé.musx`;

- `Hino Nacional - Oboé.mscz` e `Hino Nacional - Oboe.mscz`.

o sistema deve identificar e reportar para o usuário.