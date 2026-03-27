# Verificar alteração dos arquivos

```markdown
1. Pegar a primeira música (ex: Hino Nacional)

2. Lista todas as partituras desta música

3. Faz a verifica de todas as partituras: compara o timestamp da última alteração e o tamanho, do arquivo local com a do banco de dados:
	- Caso tenha alteração, atualiza o campo na tabela "score":
		- status = "draft";
	- Caso o arquivo não sejá encontrado, atualiza o campo na tabela "score":
		- status = "not found"
	- Caso não tenha alteração:
		- Não faz nada

4. Após verificar todas as partituras da música, pega a próxima música e o ciclo se repete até acabar todas as músicas cadastradas.

5. Ao verifiar todas as músicas é encerrado o fluxo
```

# Alterar partitura de `draft` para `main` (pelo botão na interface)

```markdown
⚠️ Esta operação deve ser executada dentro de uma transação

1. Buscar estado atual da partitura (ANTES de alterar)

2. O usuário clica para definir o status da partitura para "main", estava em "draft"
	- Atualiza os campos na tabela "score":
		- fileModifiedAt; Timestamp atual
		- fileSize; Se tiver mudado
		- status; Muda para "main"
		- updateAt; Se tiver mudado
		- updatedBy; Se tiver mudado

3. Atualizar a tabela "songs":
	- Atualiza os campos:
		- updateAt; Timestamp atual
		- updatedBy; Timestamp atual
		- lastScoreUpdateAt; Timestamp atual
		  
4. Inserir na tabela "changed": com OLD e NEW reais

5. Confirmar (commit) a transação
```

# Alterar partitura de `main` para `draft` (pelo botão na interface)

```markdown
⚠️ Esta operação deve ser executada dentro de uma transação

1. Pega o valor antigo na tabela "changed"
	// Se não existir significa que foi feito o upload (ai é crazy) 
	- Caso não exista:
		- Emite um toast: "Não é possível voltar o arquivo para 'draft', pois ele já foi replicado para a nuvem. Caso tenha sido errado, você precisa arrumar ele e subir o correto na nuvem"

2. O usuário clica para definir o status da partitura para "main", estava em "draft"
	- Volta os valore antigos aos campos na tabela "score":
		- fileModifiedAt;
		- fileSize;
		- status;
		- updateAt;
		- updatedBy;

3. Atualizar a tabela "songs":
	- Volta os valores dos campos:
		- updateAt;
		- updatedBy;
		- lastScoreUpdateAt;
		  
4. Remove todas as alterações da tebela "changed" referente a essa alteração (descartando ela)

5. Confirmar (commit) a transação
```

! Um exemplo: O usuário por engano muda de `draft` para `main` uma partitura errada, ele pode querer voltar atrás da alteração.

# Salvar alteração no `changed`

## Usuário adicionou uma música (sem partituras)

```markdown
⚠️ Esta operação deve ser executada dentro de uma transação

1. O usuário adicionou a música "Hino a Bandeira"

2. É inserido na tabela "changed" a música

3. Confirmar (commit) a transação
```

## Usuário adicionou uma música com partitura(s)

```markdown
⚠️ Esta operação deve ser executada dentro de uma transação

1. O usuário adicionou a música "Hino a Bandeira"

2. É inserido na tabela "changed" a música

3. É inserido na tabela "changed" a(s) partitura(s)

4. Confirmar (commit) a transação
```

## Usuário alterando nome da música

```markdown
⚠️ Esta operação deve ser executada dentro de uma transação

1. O usuário altera o nome da música, de "HINO NACIONAL" para "Hino Nacional"

2. O sistema procura se já existe com mesmos: "entity", "entityId" e "field"
	- Caso exista, atualiza o campo na tabela "changed":
		- value;
		- timestamp;
	- Caso não exista, insere a alteração na tabela "changed"

3. Confirmar (commit) a transação
```

## Usuário deletando uma música ou partitura

```markdown
⚠️ Esta operação deve ser executada dentro de uma transação
1. O usuário deletar a música "Hino Nacional"

2. O sistema procura se já existe com mesmo: "entity", "entityId" e "field"
	- Caso exista, deleta eles da tabela (como se não existisse) e adiciona na tabela de "changed"
	- Caso não exista, adiciona na tabela de "changed"

3. Confirmar (commit) a transação
```

# Gerando o arquivo de alteração `{computerId}.msgpack`

```markdown
1. É listados todas as alterações na tebela "changed"
   
2. Verifica se o arquivo `{computerId}.msgpack.zst` tem 1MB
	- Se for igual ou maior:
		- Incrementa o valor em "eventSequenceCounter"
		- Criar um novo arquivo com o valor novo da sequência: `{computerId}_{sequence}.msgpack`
		- Adiciona as alteração do "changed"
	- Se não tiver:
		- Descompacta o arquivo
		- Incrementa com as alterações do "changed"

3. Compacta o arquivo
	- Caso de erro:
		- Tentar compactar mais uma vez
		- Se o erro novamente, deve ser emitido um toast avisando o usuário que não é possível compactar o arquivo de alteração.
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
	- Caso de sucesso:
		- Vai para a próxima etapa
```

# Gerando arquivos das músicas com as partituras

```markdown
1. Faz uma consulta via SQL: Realizar um "LEFT JOIN" entre "songs" e "backupSongs" utilizando a condição "songs.id = backupSongs.songId". O resultado deve conter todos os registros de "songs", incluindo o campo `backupSongId` quando houver correspondência na tabela "backupSongs"; caso contrário, o valor deve ser "NULL".
   
2. Analisa todos os valores retornados
	- Caso exista alguma coisa:
		- Atualiza o "status" = "processing"
		- Vai para etapa 4
	- Caso seja retornado "NULL":
		- Adicionar ao banco de dados
		- Atualiza o "status" = "processing"
		- Vai para etapa 5 (pula a 4)

3. Verifica o timestamp de ambos
	- Caso o "lastScoreUpdateAt" do "song" é maior que "lastBackupAt" e "backupSongs":
		- Deleta o arquivo antigo do {songId}.tar.zts (caso ele exista)
		- Atualizar o "lastBackupAt" de "backupSongs" para o mesmo valor de "lastScoreUpdateAt" de "song"

4. Junta todas as partituras em um .tar.zst (as partituras podem estar em locais diferentes, então é necessário utilizar o diretório+nome+entensão para todos)
	- Caso de erro:
		- Tenta mais uma vez
		- Se o erro novamente, deve ser emitido um toast avisando o usuário que não é possível compactar o arquivo da música.
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)

5. Repete esse ciclo com todas as música, assim que acaba as partituras vai para a próxima etapa
```

# Consultar Nuvem

```markdown
1. Chama o rclone para sincronizar a pasta local "/nuvem" com a Nuvem
	- Caso de erro:
		- Tenta mais uma vez
		- Se o erro novamente, deve ser emitido um toast avisando o usuário que não é possível consultar a nuvem.
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
```

# Consultar alterações remota

```markdown
1. Executa o fluxo "Consultar Nuvem"
   
2. 
```

# Ao clicar na botão de "verificar alteração"

```markdown
⚠️ Esta operação deve ser executada dentro de uma transação

1. Verifica se o computador possui internet
	- Caso não tenha:
		- Emite um toast de erro "Você não possui acesso a internet, não é possível fazer backup na Nuvem"
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)
	- Caso tenha:
		- Continua o fluxo

2. Executa o fluxo "Consultar alterações remota"

3. Executa o fluxo "Gerando o arquivo de alteração {computerId}.msgpack"
	- Caso ocorra tudo certo vai para o próximo
	- Caso ocorra algum erro, emite um toast avisando e interrompe o fluxo

4. Executa o fluxo "Gerando arquivos das músicas com as partituras"
	- Caso ocorra tudo certo vai para o próximo
	- Caso ocorra algum erro, emite um toast avisando e interrompe o fluxo

5. Faz o upload para a nuvem com rclone (sync)
	- Caso de erro:
		- Tenta mais uma vez
		- Se o erro novamente, deve ser emitido um toast avisando o usuário que não é possível compactar o arquivo de alteração.
		- O fluxo deve ser encerrado (caso esse fluxo esteja em outro, o fluxo pai deve ser encerrado também)

6. Deleta todas as alterações (changed) utilizando como referência o timestamp mais recente das alterações feitas. Apagando a apartir dele e todos os menores

7. Confirmar (commit) a transação
```