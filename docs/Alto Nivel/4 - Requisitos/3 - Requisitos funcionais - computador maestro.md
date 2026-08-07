# 1. Indexação de diretório (pasta)

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

## 1.3. Ordem da partituras

Deve ser a mesma ordem que no **Requisitos funcional - ambos** em **Ordem de listagem na música**.

---

# 2. Músicas

## 2.1. Nome da música

O nome da música deve ser sempre em maiúsculo.

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

## 2.3. Monitoramento de alterações <mark>(Não implementado)</mark>

Quando uma música estiver expandida e exibindo suas partituras, o sistema deve monitorar continuamente o diretório indexado e atualizar a interface sempre que alterações forem identificadas.

---

# 3. Partituras

## 3.1. Operações disponíveis

### 3.2.1. Partituras com status "envio permitido"

O usuário deve poder:

- **abrir**, será aberto a partitura utilizando o aplicativo padrão associado a extensão do arquivo;
- **abrir local**, abre no explorador de arquivos na pasta indexada, com o arquivo da partitura selecionada;
- **editar**, permitindo alterar o nome do instrumento;
- **usar como base**, usa essa partitura como base para criar outra;
- **não permitir envio**, alterando o status da partitura para `draft`;
- **ignorar partitura**, atualiza o status da partitura para `ignored`;
- **mover para lixeira**, move o arquivo para lixeira.

### 3.2.2. Partituras com status "envio não permitido"

O usuário deve poder:

- **abrir**, será aberto a partitura utilizando o aplicativo padrão associado a extensão do arquivo;
- **abrir local**, abre no explorador de arquivos na pasta indexada, com o arquivo da partitura selecionada;
- **editar**, permitindo alterar o nome do instrumento;
- **usar como base**, usa essa partitura como base para criar outra;
- **permitir envio**, alterando o status da partitura para `main`;
- **ignorar partitura**, atualiza o status da partitura para `ignored`;
- **mover para lixeira**, move o arquivo para lixeira.

### 3.2.3. Partituras com status "ignorada"

O usuário deve poder:

- **abrir**, será aberto a partitura utilizando o aplicativo padrão associado a extensão do arquivo;
- **abrir local**, abre no explorador de arquivos na pasta indexada, com o arquivo da partitura selecionada;
- **editar**, permitindo alterar o nome do instrumento;
- **usar como base**, usa essa partitura como base para criar outra;
- **permitir envio**, alterando o status da partitura para `main`;
- **não permitir envio**, alterando o status da partitura para `draft`;
- **mover para lixeira**, move o arquivo para lixeira.

## 3.3. Detecção de alterações nas partituras <mark>(Possível duplicada: "verificar alterações")</mark>

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

Ao começar a digitar o nome do compositor ou arranjador na criação ou edição de uma música, o sistema deve sugerir com base no que for sendo digitado.

---

# 6. Transparência operacional

O sistema deve exibir o progresso de todas as etapas executadas.

### 6.1 Verificar alterações

Após a verificação de alteração, deve abrir um modal informando tudo que foi alterado.

O usuário deve poder escolher: continuar ou cancelar.

## 6.2. Etapas upload para nuvem

Etapas:

1. Identificar alterações;
2. Gerar eventos e/ou snapshot;
3. Agrupar e compactar arquivos alterados;
4. Enviar arquivos novos ou modificados.

---

# 7. Processamento de arquivos

## 7.1. Empacotamento com tar e compactar com zst

### Música e partituras com status envio permitido

As partituras devem ser agrupadas em um `tar` e ser renomeada para o `id` da partitura;

Os arquivos devem permanecer na raiz do `tar` (não existir subdiretórios);

Depois de juntar tudo com `tar`, deve ser compactado com `zst`.

## 7.2. Snapshot

Um snapshot deve ser gerado quando o arquivo de eventos ultrapassar **1 MB**.

Quando um snapshot é gerado, deve deletar o arquivo de eventos.

Após a geração do snapshot:

1. O estado consolidado atual deve ser persistido no arquivo de snapshot;
2. Os clientes devem descartar o estado local existente;
3. O estado deve ser restaurado a partir do novo snapshot;
4. O arquivo de eventos do servidor deve ser reinicializado, removendo os eventos já consolidados no snapshot.

---

# 8. Configurações

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

# 9. Backup

O backup deve ser **gerado automaticamente** a cada 1 hora.

Um backup **não deve substituir** o outro.

O sistema deve manter os 10 últimos arquivos de bakcup, o restante deve ser deletado.

Deve ter um time em loop de 1 hora para geração de backup em seções longas <mark>(Não implementado)</mark>.

## 9.1 Importar backup

No "importar backup", caso os arquivos já existam, o Ottavada deve verificar se os arquivos que ele tem é mais recente que o que tem no computador, caso seja, deve substituir o arquivo local pelo que o Ottavada baixou, caso não seja ou seja igual, deve manter o arquivo original <mark>(Não implementado)</mark>.

---

# 10. Relatório de alterações

O relatório é executado quando o usuário clica em "aplicar alterações", depois da etapa de "verificar alterações". O objetivo é mostrar o que foi adicionado, alterado e deletado.

O relatório deve ser direto e resumido, sendo claro para o usuário.

## 10.1. Seções

- **adicionado** - mostra tudo que foi adicionado.

- **alterado** - mostra tudo que foi alterado.

- **removido** - mostra tudo que foi removido.

### 10.2. Resumo

Quando tiver uma mesma ação de várias partituras, envolvendo a mesma música, deve agrupar tudo em uma linha. Evitando ter várias linhas para uma mesma coisa, ex: "Foi adicionado a música `xx` as partitura `aaa`, `bbb` e `ccc`".

---

# 11. Inicialização

Durante a iniciação do aplicativo, o sistema deve:

1. Verificar se existe atualização.

2. Enviar telemetria.

3. Gerar backup (se tiver na hora) e iniciar timer de backup <mark>(Não implementado)</mark>.

---

# 12. Identificação de duplicação <mark>(Não implementado)</mark>

## 12.1. Possíveis músicas duplicadas

O sistema deve identificar nomes de músicas parecidos, ex: `"Hino Nacional"` e `"O Hino Nacional"`, o sistema deve identificar e reportar para o usuário.

Deve ser usado o **Trigram / N-gram Similarity** para identificar as possíveis músicas duplicadas, sendo executado no **indexar diretório**.

## 12.2. Varredura de alterações (etapa do "aplicar alterações")

Como o sistema indexa diretório, o usuário pode por fora duplicar uma partitura já indexada, por exemplo: 

- `Hino Nacional - Oboé.mus` e `Hino Nacional - Oboé.musx`;

- `Hino Nacional - Oboé.mscz` e `Hino Nacional - Oboe.mscz`.

o sistema deve identificar e reportar para o usuário.
