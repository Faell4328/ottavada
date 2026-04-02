! Em caso de problema, deve ser feito o rallback das alterações. Ou é feito tudo ou nada.

# Verificar alteração dos arquivos

**Apenas Servidor**

```markdown
1. Lista todos as músicas no banco de dados "songs"

2. Pega a primeira música da lista

3. Lista todas as partituras desta música
   
4. Cria variáveis para listar todas partituras com status "draft" e "not found"

5. Faz a verifica de todas as partituras: compara o timestamp da última alteração e o tamanho, do arquivo local (filesystem) com a do banco de dados:
	- Caso tenha alteração:
		- Adiciona na variável "draft" o id do "score"
	- Caso o arquivo não sejá encontrado:
		- Adiciona na variável "not found" o id do "score"
	- Caso não tenha alteração:
		- Não faz nada

6. Após verificar todas as partituras da música, pega a próxima música e o ciclo se repete até acabar todas as músicas cadastradas

7. Ao verifiar todas as músicas
	- Atualiza tudo:
		! Deve ser uma transação as duas
		- Atualizar todas as músicas para "draft" que estão na variável (único SQL)
		- Atualizar todas as músicas para "not found" que estão na variável (único SQL)

! Em caso de problema em alguma das etapas:
	- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
	- Não é necessário reverter nada
	- Registra no log
	- Avisa o usuário que ocorreu um erro (toast)
```

# Alterar partitura de `draft` para `main` (pelo botão na interface) - Precisa arrumar no código

**Apenas Servidor**

```markdown
1. Usuário clica para definir o status da partitura para "main", ela estava em "draft"
   
2. Parece um modal de confirmação, "Isso não poderá ser desfeito posteriormente".
	- Caso clique em "Cancelar":
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
	- Caso clique em "Confirmar"
		- O fluxo continua

3. Consulta se a partitura selecionada está com "status == draft"
	- Caso não esteja
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- Avisa o usuário que ocorreu um erro (toast)
	- Caso esteja
		- O fluxo continua

4. Pega as informações do arquivo da partitura (filesystem) e armazena em uma variável
	- Em caso de problema:
		- Tanta mais uma vez
		- Se der erro novamente, deve ser emitido um toast avisando o usuário que não é possível mudar o status da partitura.
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)

⚠️ As operações abaixo devem ser executada dentro de uma transação

5. Pega as informações da partitura na tabela "score" e salvar em uma variável

6. Atualiza a tabela "score" com as informações da variável (arquivo da partitura - filesystem):
	- Atualiza os campos:
		- fileModifiedAt; Timestamp da última alteração do arquivo
		- fileSize; Tamanho do arquvo
		- status; Muda para "main"
		- updateAt; Timestamp atual
		- fileModifiedAt; Timestamp atual
		- updatedBy; ID do computador atual

7. Atualizar a tabela "songs":
	- Atualiza os campos:
		- updateAt; Timestamp atual
		- updatedBy; Timestamp atual
		- lastScoreUpdateAt; Timestamp atual
		  
8. Insere na tabela "changedField" as alterações, com os valores da variável antes da alteração (oldValue) e os valores novos (newValue).

9. Confirmar (commit) a transação
	- Em caso de problema:
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- Avisa o usuário que ocorreu um erro (toast)
```
# Usuário adicionou uma música

## Apenas a música

```markdown
1. O usuário clica para adicionar música
! Existe a etapa onde o usuário adiciona o nome da música, no caso, já foi feito essa etapa
   
⚠️ As operações abaixo devem ser executada dentro de uma transação

2. O sistema adiciona a música em "songs"
	- Em caso de problema:
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- Avisa o usuário que ocorreu um erro (toast)

3. Adiciona o evento na tabela "changedField"

4. Confirmar (commit) a transação
	- Em caso de problema:
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- Avisa o usuário que ocorreu um erro (toast)
```

## Partitura em uma música existente

```markdown
1. O usuário clica para adicionar partitura em uma música existente
! Existe a etapa onde o usuário seleciona a partitura no filesystem, no caso, já foi feito essa etapa
   
⚠️ As operações abaixo devem ser executada dentro de uma transação
		  
1. O sistema adiciona a partitura em "scores"
	- Em caso de problema:
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- Avisa o usuário que ocorreu um erro (toast)
		  
2. O sistema verifica se existe a  música em "backupSongs"
	- Se existe, atualiza os campos:
		- "lastBackupAt" = 0
		- "status" = "processing"
	- Se não existe, adiciona com os campos:
		- "lastBackupAt" = 0
		- "status" = "processing"
! Na próxima vez que for gerado os arquivos para backup, será gerado desse

3. Adiciona o evento na tabela "changedField"

4. Confirmar (commit) a transação
	- Em caso de problema:
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- Avisa o usuário que ocorreu um erro (toast)
```

## Com partitura(s)

**Apenas Servidor**

```markdown
1. O usuário clica para adicionar música com partituras e seleciona o diretório (com os arquivos)
! Existe a etapa onde o usuário pode verifica os dados da música/partitura antes de confirmar, no caso, já foi feito essa etapa
   
⚠️ As operações abaixo devem ser executada dentro de uma transação

1. O sistema adiciona a música em "songs"
	- Em caso de problema:
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- Avisa o usuário que ocorreu um erro (toast)
		  
2. O sistema adiciona as partituras em "scores"
	- Em caso de problema:
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- Avisa o usuário que ocorreu um erro (toast)
		  
3. O sistema adiciona a música em "backupSongs"
	- Os campos:
		- "lastBackupAt" = 0
		- "status" = "processing"
! Na próxima vez que for gerado os arquivos para backup, será gerado desse

4. Adiciona o evento na tabela "changedField"
! Deve registrar de tudo, adicionando a música e as partituras (individual)

5. Confirmar (commit) a transação
	- Em caso de problema:
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- Avisa o usuário que ocorreu um erro (toast)
```

# Usuário alterando nome

### Música

**Apenas Servidor**

```markdown

1. O usuário clica para alterar o nome da música, de "HINO NACIONAL" para "Hino Nacional"
   
⚠️ As operações abaixo devem ser executada dentro de uma transação

1. O sistema verifica se existe a música no "songs"
	- Se existe:
		- Atualiza em "songs"
		- Adiciona o evento na tabela "changedField"
	- Em caso de problema ou se não existir:
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- Avisa o usuário que ocorreu um erro (toast)
		  
2. Confirmar (commit) a transação
	- Em caso de problema:
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- Avisa o usuário que ocorreu um erro (toast)
```

### Partitura

**Apenas Servidor**

```markdown
1. O usuário clica para alterar o nome do instrumento "FLAUTA" para "flauta" da música "Hino Nacional"
   
⚠️ As operações abaixo devem ser executada dentro de uma transação

1. O sistema verifica se existe a partitura no "scores"
	- Se existe:
		- Atualiza em "scores"
		- Adiciona o evento na tabela "changedField"
	- Em caso de problema ou se não existir:
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- Avisa o usuário que ocorreu um erro (toast)
		  
2. Confirmar (commit) a transação
	- Em caso de problema:
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- Avisa o usuário que ocorreu um erro (toast)
```

# Usuário deletando

### Música

**Apenas Servidor**

```markdown
1. O usuário clica para deletar a música "Hino Nacional"
   
⚠️ As operações abaixo devem ser executada dentro de uma transação

2. O sistema verifica se existe a música no "songs"
	- Se existe:
		- Deleta o "songs"
		- Deleta as "scores" dessa música
		- Deleta em "categoriesSongs" as relações N:N com essa música
		- Adiciona o evento na tabela "changedField"
	- Em caso de problema:
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- Avisa o usuário que ocorreu um erro (toast)
		  
3. Confirmar (commit) a transação
	- Em caso de problema:
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- Avisa o usuário que ocorreu um erro (toast)
		  
4. Verifica se existe o arquivo {songId}.tar.zst
	- Se existir:
		- Deleta o arquivo
	- Se não existir:
		- Não faz nada
```

! O arquivo do usuário deve se manter no diretório local dele.

### Partituras

**Apenas Servidor**

```markdown
1. O usuário clica para deletar a partitura "Flauta" da música "Hino Nacional"
   
⚠️ As operações abaixo devem ser executada dentro de uma transação

2. O sistema verifica se existe a partitura em "scores"
	- Se existe:
		- Deleta a partitura em "scores"
		- Adiciona o evento na tabela "changedField"
		- Atualiza o "lastScoreFileModifiedAt" da tabela "songs"
		- Atualiza o "lastBackupAt" para 0 e "status" = "processing" no "backupSongs", para regerar o arquivo (se ele existir)
	- Se não existir:
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- Avisa o usuário que ocorreu um erro (toast)
	- Em caso de problema:
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- Avisa o usuário que ocorreu um erro (toast)
		  
3. Confirmar (commit) a transação
	- Em caso de problema:
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- Avisa o usuário que ocorreu um erro (toast)
```

! O arquivo do usuário deve se manter no diretório local dele.

# Gerando o arquivo de alteração `events.msgpack`

**Apenas Servidor**

```markdown
1. É listados todas as alterações na tebela "changedField"
	- Em caso de problema:
		- Aborta do fluxo
		- Avisa o usuário que ocorreu um erro (toast)

2. Verifica se o arquivo `events.msgpack.zst` tem 2MB
	- Se for igual ou maior:
		- Executa o fluxo de "Gerar Snapshot"
		- StatusBar deve adicionar uma etapa extra: "Gerando snapshot" antes do upload final
		- Encerra esse fluxo
	- Se não tiver 2MB:
		- Descompacta o arquivo no diretório: "/temp/events/"
		- Incrementa com as alterações no "changedField" (ordenada pelo timestamp - crescente)
	- Se o arquivo não exister:
		- Criar um novo arquivo `events.msgpack` no diretório: "/temp/events/"
		- Adiciona as alteração do "changedField" no arquivo (ordenada pelo timestamp - crescente)

3. Compacta o arquivo
	- Caso de erro:
		- Tentar compactar mais uma vez
		- Se ocorrer erro novamente, deve ser emitido um toast avisando o usuário que não é possível compactar o arquivo de alteração.
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
	- Caso de sucesso:
		- Deleta o arquivo `events.msgpack` e deixa apenas o `events.msgpack.zst`
		- Vai para a próxima etapa
		  
4. Chama o rclone para sincronizar a pasta local com a "Nuvem"
	- Antes de iniciar a transferência, resetar estatísticas RC (`core/stats-reset`) para o progresso começar em 0
	- Caso de erro:
		- Tentar compactar mais uma vez
		- Se ocorrer erro novamente, deve ser emitido um toast avisando o usuário que não é possível compactar o arquivo de alteração.
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
```

# Gerar Snapshot

**Apenas Servidor**

```markdown
1. Verifica se existe o arquivo `snapshot.msgpack.zst`
	- Se existe:
		- Deleta o arquivo `snapshot.msgpack.zst`

2. Cria o arquivo `snapshot.msgpack`
   
3. Adiciona todo o banco de dados no `snapshot.msgpack`

4. Compacta o arquivo `snapshot.msgpack`
	- Caso de erro:
		- Tentar compactar mais uma vez
		- Se ocorrer erro novamente, deve ser emitido um toast avisando o usuário que não é possível compactar o arquivo de alteração.
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
	- Caso de sucesso:
		- Deleta o arquivo `snapshot.msgpack` e deixa apenas o `snapshot.msgpack.zst`
		- Vai para a próxima etapa


5. Deleta os dados dentro da tabela "changedField"

6. Deleta o arquivo `events.msgpack.zst`

6.1. Deleta todos os arquivos `{songId}.tar.zst` existentes em `/cloud/songs` para forçar a regeneração completa

7. Chama o rclone para sincronizar a pasta local com a "Nuvem"
	- Antes de iniciar a transferência, resetar estatísticas RC (`core/stats-reset`) para o progresso começar em 0
	- Caso de erro:
		- Tentar compactar mais uma vez
		- Se ocorrer erro novamente, deve ser emitido um toast avisando o usuário que não é possível compactar o arquivo de alteração.
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)

```
# Gerando arquivos das músicas com as partituras

```markdown
1. Faz uma consulta via SQL: Realizar um "LEFT JOIN" entre "songs" e "backupSongs" utilizando a condição "songs.id = backupSongs.songId". O resultado deve conter todos os registros de "songs", incluindo o campo `backupSongId` quando houver correspondência na tabela "backupSongs"; caso contrário, o valor deve ser "NULL".
		  
2. Para cada registro:
	- Caso "backupSongs.songId" seja NULL:
		- Inserir registro em "backupSongs"
		- status = "processing"
		- Vai para etapa 4 (não precisa comparar timestamp)

	- Caso exista:
		- status = "processing"
		- Vai para etapa 3

3. Verifica o timestamp de ambos
	- Caso o "lastScoreFileModifiedAt" do "song" é maior que "lastBackupAt" e "backupSongs":
		- Deleta o arquivo antigo do {songId}.tar.zst (caso ele exista)
	- Caso o não seja:
		- status = "ok"
		- Vai para o próximo (etapa 6)

4. Cria um diretório temporário, copia e renomeia as partituras (uma a uma), deve ser renomeada para "id" de "scores"
	- Caso de erro:
		- Tenta mais uma vez
		- Se ocorrer erro novamente, deve ser emitido um toast avisando o usuário que não é possível compactar o arquivo da música.
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- status = "error"
		- Deletar o diretório temporário e seus arquivos
	  
5. Ao finalizar a etapa anterior, gerar um "{songId}.tar.zst.tmp" de todas as partituras
	- Caso de erro:
		- Tenta mais uma vez
		- Se ocorrer erro novamente, deve ser emitido um toast avisando o usuário que não é possível compactar o arquivo da música.
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- status = "error"
		- Deletar o arquivo "{songId}.tar.zst.tmp" e o diretório temporário criado
 
6. Mover para o diretório correto (/cloud/songs) e renomear para "{songId}.tar.zst"
	- Caso de erro:
		- Tenta mais uma vez
		- Se ocorrer erro novamente, deve ser emitido um toast avisando o usuário que não é possível compactar o arquivo da música.
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- status = "error"
		- Deletar o arquivo "{songId}.tar.zst" (caso tenha gerado), "{songId}.tar.zst.tmp" e o diretório temporário
	- Caso de sucesso:
		- Atualizar o "lastBackupAt" de "backupSongs" para o mesmo valor de "lastScoreFileModifiedAt" de "songs"
		- status = "ok"

7. Limpar o diretório temporário criado

8. Repete esse ciclo com todas as música, assim que acaba as partituras vai para a próxima etapa
```

# Consultar Nuvem

**Servidor**: Não precisa fazer esse fluxo, já que ele é o líder e nenhum outro computador vai fazer alteração.

**Cliente**

```markdown
1. Chama o rclone para sincronizar a pasta local "/nuvem" com a Nuvem
	- Antes de iniciar a transferência, resetar estatísticas RC (`core/stats-reset`) para o progresso começar em 0
	- Caso de erro:
		- Tenta mais uma vez
		- Se ocorrer erro novamente, deve ser emitido um toast avisando o usuário que não é possível consultar a nuvem.
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		  
2. Consulta o arquivo "snapshot.msgpack.zst"
	- Caso não exista:
		- Vai para a etapa 6
	- Caso exista:
		- Vai para próxima etapa

3. Descompacta o arquivo "snapshot.msgpack.zst" para "snapshot.msgpack" no diretório: "/temp/snapshot/"

4. Consulta o arquivo "snapshot.msgpack" e verifica se o "generatorIn" é maior que o "lastSnapshotTimestamp" do "tauri-plugin-store"
	- Caso seja, deve aplicar o snapshot ao banco de dados:
		- Deleta todo o banco de dados
		- Inserir os valores informados no "snapshot.msgpack" (em transação)
		- Atualiza o "lastSnapshotTimestamp" do "tauri-plugin-store", com o valor de "generatorIn"
		  
5. Deleta o diretório "/temp/snapshot/" e o arquivo

6. Consulta o arquivo no diretório "events"
	- Caso não exista:
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
	- Caso exista:
		- Vai para próxima etapa

7. Verifica se existe apenas um arquivo
	// Deve existir apenas um (servidor)
	- Caso não exita:
		- Deve ser emitido um toast avisando o usuário que existe algo errado e deve chamar o desenvolvedor responsável para investigar
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
	- Caso exista:
		- Vai para próxima etapa

8. Descompacta o arquivo "events.msgpack.zst" para "events.msgpack" no diretório: "/temp/events/"

9. Pega o arquivo e verifica se o tipo dele é "server", pelo campo "origin" no arquivo "events.msgpack"
	- Caso não seja:
		- Deve ser emitido um toast avisando o usuário que existe algo errado e deve chamar o desenvolvedor responsável para investigar
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
	- Caso seja:
		- Vai para próxima etapa

10. Verifica em seu "tauri-plugin-store" o "lastChangeTimestamp" e verifica se possui algum evento novo, com base no "timestamp" de cada evento
	- Caso exista:
		- Lista eles em uma variável
	- Cao não exista
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)

11. Caso exista algum valor na variável
	- Aplica todas as alterações:
		- feitas no banco de dados (em transação)
		- Atualiza o "lastChangeTimestamp" com o maior valor do "timestamp" (último evento adicionado).
	  
12. Após finalizar a etapa anterior, deve deletar o diretório temporário: "/temp/events/"
```

# Ao clicar na botão de "verificar alteração"

**Apenas Servidor**

```markdown
1. Verifica se o computador possui internet
	- Caso não tenha:
		- Emite um toast de erro "Você não possui acesso a internet, não é possível fazer backup na Nuvem"
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
	- Caso tenha:
		- Continua o fluxo

2. Não executa o fluxo "Consultar Nuvem" (no cenário atual com cliente read-only)

3. Executa o fluxo "Verificar alteração dos arquivos"
	- Caso ocorra tudo certo vai para o próximo
	- Caso ocorra algum erro, emite um toast avisando e interrompe o fluxo

4. Executa o fluxo "Gerando arquivos das músicas com as partituras"
	- Caso ocorra tudo certo vai para o próximo
	- Caso ocorra algum erro, emite um toast avisando e interrompe o fluxo

5. Executa o fluxo "Gerando o arquivo de alteração events.msgpack"
	- Caso ocorra tudo certo vai para o próximo
	- Caso ocorra algum erro, emite um toast avisando e interrompe o fluxo

6. Faz o upload para a nuvem apenas se houver alteração nova (`.tar.zst`, `events.msgpack.zst` ou `snapshot.msgpack.zst`)
	- Antes de iniciar a transferência, resetar estatísticas RC (`core/stats-reset`) para o progresso começar em 0
	- Se o `events.msgpack.zst` atingiu o limite e gerou snapshot, o StatusBar deve mostrar a etapa extra "Gerando snapshot" antes desta etapa de upload
	- Padrão: upload incremental apenas dos caminhos alterados
	- Exceção: usa `rclone sync` completo quando precisar refletir remoções no remoto (ex: limpeza de `events.msgpack.zst`)
	- Caso de erro:
		- Tenta mais uma vez
		- Se ocorrer erro novamente, deve ser emitido um toast avisando o usuário que não é possível compactar o arquivo de alteração.
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)

7. Deleta todas as alterações (changedField) utilizando como referência o timestamp mais recente das alterações feitas. Apagando a apartir dele e todos os menores
```

! Em caso de problema, deve ser feito o rallback das alterações. Ou é feito tudo ou nada.

# Verificar alteração dos arquivos

**Apenas Servidor**

```markdown
1. Lista todos as músicas no banco de dados "songs"

2. Pega a primeira música da lista

3. Lista todas as partituras desta música
   
4. Cria variáveis para listar todas partituras com status "draft" e "not found"

5. Faz a verifica de todas as partituras: compara o timestamp da última alteração e o tamanho, do arquivo local (filesystem) com a do banco de dados:
	- Caso tenha alteração:
		- Adiciona na variável "draft" o id do "score"
	- Caso o arquivo não sejá encontrado:
		- Adiciona na variável "not found" o id do "score"
	- Caso não tenha alteração:
		- Não faz nada

6. Após verificar todas as partituras da música, pega a próxima música e o ciclo se repete até acabar todas as músicas cadastradas

7. Ao verifiar todas as músicas
	- Atualiza tudo:
		! Deve ser uma transação as duas
		- Atualizar todas as músicas para "draft" que estão na variável (único SQL)
		- Atualizar todas as músicas para "not found" que estão na variável (único SQL)

! Em caso de problema em alguma das etapas:
	- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
	- Não é necessário reverter nada
	- Registra no log
	- Avisa o usuário que ocorreu um erro (toast)
```

# Alterar partitura de `draft` para `main` (pelo botão na interface) - Precisa arrumar no código

**Apenas Servidor**

```markdown
1. Usuário clica para definir o status da partitura para "main", ela estava em "draft"
   
2. Parece um modal de confirmação, "Isso não poderá ser desfeito posteriormente".
	- Caso clique em "Cancelar":
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
	- Caso clique em "Confirmar"
		- O fluxo continua

3. Consulta se a partitura selecionada está com "status == draft"
	- Caso não esteja
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- Avisa o usuário que ocorreu um erro (toast)
	- Caso esteja
		- O fluxo continua

4. Pega as informações do arquivo da partitura (filesystem) e armazena em uma variável
	- Em caso de problema:
		- Tanta mais uma vez
		- Se der erro novamente, deve ser emitido um toast avisando o usuário que não é possível mudar o status da partitura.
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)

⚠️ As operações abaixo devem ser executada dentro de uma transação

5. Pega as informações da partitura na tabela "score" e salvar em uma variável

6. Atualiza a tabela "score" com as informações da variável (arquivo da partitura - filesystem):
	- Atualiza os campos:
		- fileModifiedAt; Timestamp da última alteração do arquivo
		- fileSize; Tamanho do arquvo
		- status; Muda para "main"
		- updateAt; Timestamp atual
		- fileModifiedAt; Timestamp atual
		- updatedBy; ID do computador atual

7. Atualizar a tabela "songs":
	- Atualiza os campos:
		- updateAt; Timestamp atual
		- updatedBy; Timestamp atual
		- lastScoreUpdateAt; Timestamp atual
		  
8. Insere na tabela "changedField" as alterações, com os valores da variável antes da alteração (oldValue) e os valores novos (newValue).

9. Confirmar (commit) a transação
	- Em caso de problema:
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- Avisa o usuário que ocorreu um erro (toast)
```
# Usuário adicionou uma música

## Apenas a música

```markdown
1. O usuário clica para adicionar música
! Existe a etapa onde o usuário adiciona o nome da música, no caso, já foi feito essa etapa
   
⚠️ As operações abaixo devem ser executada dentro de uma transação

2. O sistema adiciona a música em "songs"
	- Em caso de problema:
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- Avisa o usuário que ocorreu um erro (toast)

3. Adiciona o evento na tabela "changedField"

4. Confirmar (commit) a transação
	- Em caso de problema:
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- Avisa o usuário que ocorreu um erro (toast)
```

## Partitura em uma música existente

```markdown
1. O usuário clica para adicionar partitura em uma música existente
! Existe a etapa onde o usuário seleciona a partitura no filesystem, no caso, já foi feito essa etapa
   
⚠️ As operações abaixo devem ser executada dentro de uma transação
		  
2. O sistema adiciona a partitura em "scores"
	- Em caso de problema:
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- Avisa o usuário que ocorreu um erro (toast)
		  
3. O sistema verifica se existe a  música em "backupSongs"
	- Se existe, atualiza os campos:
		- "lastBackupAt" = 0
		- "status" = "processing"
	- Se não existe, adiciona com os campos:
		- "lastBackupAt" = 0
		- "status" = "processing"
! Na próxima vez que for gerado os arquivos para backup, será gerado desse

4. Adiciona o evento na tabela "changedField"

5. Confirmar (commit) a transação
	- Em caso de problema:
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- Avisa o usuário que ocorreu um erro (toast)
```

## Com partitura(s)

**Apenas Servidor**

```markdown
1. O usuário clica para adicionar música com partituras e seleciona o diretório (com os arquivos)
! Existe a etapa onde o usuário pode verifica os dados da música/partitura antes de confirmar, no caso, já foi feito essa etapa
   
⚠️ As operações abaixo devem ser executada dentro de uma transação

2. O sistema adiciona a música em "songs"
	- Em caso de problema:
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- Avisa o usuário que ocorreu um erro (toast)
		  
3. O sistema adiciona as partituras em "scores"
	- Em caso de problema:
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- Avisa o usuário que ocorreu um erro (toast)
		  
4. O sistema adiciona a música em "backupSongs"
	- Os campos:
		- "lastBackupAt" = 0
		- "status" = "processing"
! Na próxima vez que for gerado os arquivos para backup, será gerado desse

4. Adiciona o evento na tabela "changedField"
! Deve registrar de tudo, adicionando a música e as partituras (individual)

5. Confirmar (commit) a transação
	- Em caso de problema:
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- Avisa o usuário que ocorreu um erro (toast)
```

# Usuário alterando nome

### Música

**Apenas Servidor**

```markdown

1. O usuário clica para alterar o nome da música, de "HINO NACIONAL" para "Hino Nacional"
   
⚠️ As operações abaixo devem ser executada dentro de uma transação

2. O sistema verifica se existe a música no "songs"
	- Se existe:
		- Atualiza em "songs"
		- Adiciona o evento na tabela "changedField"
	- Em caso de problema ou se não existir:
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- Avisa o usuário que ocorreu um erro (toast)
		  
3. Confirmar (commit) a transação
	- Em caso de problema:
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- Avisa o usuário que ocorreu um erro (toast)
```

### Partitura

**Apenas Servidor**

```markdown
1. O usuário clica para alterar o nome do instrumento "FLAUTA" para "flauta" da música "Hino Nacional"
   
⚠️ As operações abaixo devem ser executada dentro de uma transação

2. O sistema verifica se existe a partitura no "scores"
	- Se existe:
		- Atualiza em "scores"
		- Adiciona o evento na tabela "changedField"
	- Em caso de problema ou se não existir:
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- Avisa o usuário que ocorreu um erro (toast)
		  
3. Confirmar (commit) a transação
	- Em caso de problema:
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- Avisa o usuário que ocorreu um erro (toast)
```

# Usuário deletando

### Música

**Apenas Servidor**

```markdown
1. O usuário clica para deletar a música "Hino Nacional"
   
⚠️ As operações abaixo devem ser executada dentro de uma transação

2. O sistema verifica se existe a música no "songs"
	- Se existe:
		- Deleta o "songs"
		- Deleta as "scores" dessa música
		- Deleta em "categoriesSongs" as relações N:N com essa música
		- Adiciona o evento na tabela "changedField"
	- Em caso de problema:
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- Avisa o usuário que ocorreu um erro (toast)
		  
3. Confirmar (commit) a transação
	- Em caso de problema:
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- Avisa o usuário que ocorreu um erro (toast)
		  
4. Verifica se existe o arquivo {songId}.tar.zst
	- Se existir:
		- Deleta o arquivo
	- Se não existir:
		- Não faz nada
```

! O arquivo do usuário deve se manter no diretório local dele.

### Partituras

**Apenas Servidor**

```markdown
1. O usuário clica para deletar a partitura "Flauta" da música "Hino Nacional"
   
⚠️ As operações abaixo devem ser executada dentro de uma transação

2. O sistema verifica se existe a partitura em "scores"
	- Se existe:
		- Deleta a partitura em "scores"
		- Adiciona o evento na tabela "changedField"
		- Atualiza o "lastScoreFileModifiedAt" da tabela "songs"
		- Atualiza o "lastBackupAt" para 0 e "status" = "processing" no "backupSongs", para regerar o arquivo (se ele existir)
	- Se não existir:
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- Avisa o usuário que ocorreu um erro (toast)
	- Em caso de problema:
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- Avisa o usuário que ocorreu um erro (toast)
		  
3. Confirmar (commit) a transação
	- Em caso de problema:
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- Avisa o usuário que ocorreu um erro (toast)
```

! O arquivo do usuário deve se manter no diretório local dele.

# Gerando o arquivo de alteração `events.msgpack`

**Apenas Servidor**

```markdown
1. É listados todas as alterações na tebela "changedField"
	- Em caso de problema:
		- Aborta do fluxo
		- Avisa o usuário que ocorreu um erro (toast)

2. Verifica se o arquivo `events.msgpack.zst` tem 2MB
	- Se for igual ou maior:
		- Executa o fluxo de "Gerar Snapshot"
		- StatusBar deve adicionar uma etapa extra: "Gerando snapshot" antes do upload final
		- Encerra esse fluxo
	- Se não tiver 2MB:
		- Descompacta o arquivo no diretório: "/temp/events/"
		- Incrementa com as alterações no "changedField" (ordenada pelo timestamp - crescente)
	- Se o arquivo não exister:
		- Criar um novo arquivo `events.msgpack` no diretório: "/temp/events/"
		- Adiciona as alteração do "changedField" no arquivo (ordenada pelo timestamp - crescente)

3. Compacta o arquivo
	- Caso de erro:
		- Tentar compactar mais uma vez
		- Se ocorrer erro novamente, deve ser emitido um toast avisando o usuário que não é possível compactar o arquivo de alteração.
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
	- Caso de sucesso:
		- Deleta o arquivo `events.msgpack` e deixa apenas o `events.msgpack.zst`
		- Vai para a próxima etapa
		  
4. Chama o rclone para sincronizar a pasta local com a "Nuvem"
	- Antes de iniciar a transferência, resetar estatísticas RC (`core/stats-reset`) para o progresso começar em 0
	- Caso de erro:
		- Tentar compactar mais uma vez
		- Se ocorrer erro novamente, deve ser emitido um toast avisando o usuário que não é possível compactar o arquivo de alteração.
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
```

# Gerar Snapshot

**Apenas Servidor**

```markdown
1. Verifica se existe o arquivo `snapshot.msgpack.zst`
	- Se existe:
		- Deleta o arquivo `snapshot.msgpack.zst`

2. Cria o arquivo `snapshot.msgpack`
   
3. Adiciona todo o banco de dados no `snapshot.msgpack`

4. Compacta o arquivo `snapshot.msgpack`
	- Caso de erro:
		- Tentar compactar mais uma vez
		- Se ocorrer erro novamente, deve ser emitido um toast avisando o usuário que não é possível compactar o arquivo de alteração.
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
	- Caso de sucesso:
		- Deleta o arquivo `snapshot.msgpack` e deixa apenas o `snapshot.msgpack.zst`
		- Vai para a próxima etapa


5. Deleta os dados dentro da tabela "changedField"

6. Deleta o arquivo `events.msgpack.zst`

7. Chama o rclone para sincronizar a pasta local com a "Nuvem"
	- Antes de iniciar a transferência, resetar estatísticas RC (`core/stats-reset`) para o progresso começar em 0
	- Caso de erro:
		- Tentar compactar mais uma vez
		- Se ocorrer erro novamente, deve ser emitido um toast avisando o usuário que não é possível compactar o arquivo de alteração.
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)

```
# Gerando arquivos das músicas com as partituras

```markdown
1. Faz uma consulta via SQL: Realizar um "LEFT JOIN" entre "songs" e "backupSongs" utilizando a condição "songs.id = backupSongs.songId". O resultado deve conter todos os registros de "songs", incluindo o campo `backupSongId` quando houver correspondência na tabela "backupSongs"; caso contrário, o valor deve ser "NULL".
		  
2. Para cada registro:
	- Caso "backupSongs.songId" seja NULL:
		- Inserir registro em "backupSongs"
		- status = "processing"
		- Vai para etapa 4 (não precisa comparar timestamp)

	- Caso exista:
		- status = "processing"
		- Vai para etapa 3

3. Verifica o timestamp de ambos
	- Caso o "lastScoreFileModifiedAt" do "song" é maior que "lastBackupAt" e "backupSongs":
		- Deleta o arquivo antigo do {songId}.tar.zst (caso ele exista)
	- Caso o não seja:
		- status = "ok"
		- Vai para o próximo (etapa 6)

4. Cria um diretório temporário, copia e renomeia as partituras (uma a uma), deve ser renomeada para "id" de "scores"
	- Caso de erro:
		- Tenta mais uma vez
		- Se ocorrer erro novamente, deve ser emitido um toast avisando o usuário que não é possível compactar o arquivo da música.
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- status = "error"
		- Deletar o diretório temporário e seus arquivos
	  
5. Ao finalizar a etapa anterior, gerar um "{songId}.tar.zst.tmp" de todas as partituras
	- Caso de erro:
		- Tenta mais uma vez
		- Se ocorrer erro novamente, deve ser emitido um toast avisando o usuário que não é possível compactar o arquivo da música.
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- status = "error"
		- Deletar o arquivo "{songId}.tar.zst.tmp" e o diretório temporário criado
 
6. Mover para o diretório correto (/cloud/songs) e renomear para "{songId}.tar.zst"
	- Caso de erro:
		- Tenta mais uma vez
		- Se ocorrer erro novamente, deve ser emitido um toast avisando o usuário que não é possível compactar o arquivo da música.
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		- status = "error"
		- Deletar o arquivo "{songId}.tar.zst" (caso tenha gerado), "{songId}.tar.zst.tmp" e o diretório temporário
	- Caso de sucesso:
		- Atualizar o "lastBackupAt" de "backupSongs" para o mesmo valor de "lastScoreFileModifiedAt" de "songs"
		- status = "ok"

7. Limpar o diretório temporário criado

8. Repete esse ciclo com todas as música, assim que acaba as partituras vai para a próxima etapa
```

# Consultar Nuvem

**Servidor**: Não precisa fazer esse fluxo, já que ele é o líder e nenhum outro computador vai fazer alteração.

**Cliente**

```markdown
1. Chama o rclone para sincronizar a pasta local "/nuvem" com a Nuvem
	- Antes de iniciar a transferência, resetar estatísticas RC (`core/stats-reset`) para o progresso começar em 0
	- Caso de erro:
		- Tenta mais uma vez
		- Se ocorrer erro novamente, deve ser emitido um toast avisando o usuário que não é possível consultar a nuvem.
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
		  
2. Consulta o arquivo "snapshot.msgpack.zst"
	- Caso não exista:
		- Vai para a etapa 6
	- Caso exista:
		- Vai para próxima etapa

3. Descompacta o arquivo "snapshot.msgpack.zst" para "snapshot.msgpack" no diretório: "/temp/snapshot/"

4. Consulta o arquivo "snapshot.msgpack" e verifica se o "generatorIn" é maior que o "lastSnapshotTimestamp" do "tauri-plugin-store"
	- Caso seja, deve aplicar o snapshot ao banco de dados:
		- Deleta todo o banco de dados
		- Inserir os valores informados no "snapshot.msgpack" (em transação)
		- Atualiza o "lastSnapshotTimestamp" do "tauri-plugin-store", com o valor de "generatorIn"
		  
5. Deleta o diretório "/temp/snapshot/"

6. Consulta todos os arquivos no diretório "events"
	- Caso não exista:
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
	- Caso exista:
		- Vai para próxima etapa

7. Verifica se existe apenas um arquivo
	// Deve existir apenas um (servidor)
	- Caso não exita:
		- Deve ser emitido um toast avisando o usuário que existe algo errado e deve chamar o desenvolvedor responsável para investigar
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
	- Caso exista:
		- Vai para próxima etapa

8. Copia o arquivo em um diretório temporário e descompacta
	- Diretório: "/temp/events/"

9. Pega o arquivo e verifica se o tipo dele é "server", pelo campo "origin" no arquivo "events.msgpack"
	- Caso não seja:
		- Deve ser emitido um toast avisando o usuário que existe algo errado e deve chamar o desenvolvedor responsável para investigar
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
	- Caso seja:
		- Vai para próxima etapa

10. Verifica em seu "tauri-plugin-store" o "lastChangeTimestamp" e verifica se possui algum evento novo, com base no "timestamp" de cada evento
	- Caso exista:
		- Lista eles em uma variável
	- Cao não exista
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)

11. Caso exista algum valor na variável
	- Aplica todas as alterações:
		- feitas no banco de dados (em transação)
		- Atualiza o "lastChangeTimestamp" com o maior valor do "timestamp" (último evento adicionado).
	  
12. Após finalizar a etapa anterior, deve deletar a parta temporária: "/temp/events/"
```

# Ao clicar na botão de "verificar alteração"

**Apenas Servidor**

```markdown
1. Verifica se o computador possui internet
	- Caso não tenha:
		- Emite um toast de erro "Você não possui acesso a internet, não é possível fazer backup na Nuvem"
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
	- Caso tenha:
		- Continua o fluxo

2. Não executa o fluxo "Consultar Nuvem" (no cenário atual com cliente read-only)

3. Executa o fluxo "Verificar alteração dos arquivos"
	- Caso ocorra tudo certo vai para o próximo
	- Caso ocorra algum erro, emite um toast avisando e interrompe o fluxo

4. Executa o fluxo "Gerando arquivos das músicas com as partituras"
	- Caso ocorra tudo certo vai para o próximo
	- Caso ocorra algum erro, emite um toast avisando e interrompe o fluxo

5. Executa o fluxo "Gerando o arquivo de alteração events.msgpack"
	- Caso ocorra tudo certo vai para o próximo
	- Caso ocorra algum erro, emite um toast avisando e interrompe o fluxo

6. Faz o upload para a nuvem apenas se houver alteração nova (`.tar.zst`, `events.msgpack.zst` ou `snapshot.msgpack.zst`)
	- Antes de iniciar a transferência, resetar estatísticas RC (`core/stats-reset`) para o progresso começar em 0
	- Se o `events.msgpack.zst` atingiu o limite e gerou snapshot, o StatusBar deve mostrar a etapa extra "Gerando snapshot" antes desta etapa de upload
	- Padrão: upload incremental apenas dos caminhos alterados
	- Exceção: usa `rclone sync` completo quando precisar refletir remoções no remoto (ex: limpeza de `events.msgpack.zst`)
	- Caso de erro:
		- Tenta mais uma vez
		- Se ocorrer erro novamente, deve ser emitido um toast avisando o usuário que não é possível compactar o arquivo de alteração.
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)

7. Deleta todas as alterações (changedField) utilizando como referência o timestamp mais recente das alterações feitas. Apagando a apartir dele e todos os menores
```

**Apenas Cliente**

```markdown
1. Verifica se o computador possui internet
	- Caso não tenha:
		- Emite um toast de erro "Você não possui acesso a internet, não é possível fazer backup na Nuvem"
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
	- Caso tenha:
		- Continua o fluxo

2. Executa o fluxo "Consultar Nuvem"
```