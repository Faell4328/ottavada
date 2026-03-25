# Verificar alteração dos arquivos

```markdown
1. Pegar a primeira música (ex: Hino Nacional)
2. Lista todas as partituras da música (ex: Flauta)
3. Faz a verifica de todas as partituras: compara o timestamp da última alteração e o tamanho do arquivo local e no banco de dados:
	- Caso tenha alteração, atualiza os campos (tabela "score"):
		- status = "draft";
	- Caso o arquivo não sejá encontrado, atualiza os campos (tabela "score"):
		- status = "not found"
	- Caso não tenha alteração:
		- Não faz nada
4. Após verificar todas as partituras a música, pega a próxima música e o ciclo se repete.
5. Ao verifiar todas as músicas é encerrado.
```

# Alterar partitura de `draft` para `main`

```markdown
1. Usuário altera o arquivo (está com status "draft") e clica para mudar o status da partitura para "main"
	- Atualiza os campos (tabela "score"):
		- fileModifiedAt; Timestamp atual
		- fileSize; Se tiver mudado
		- status; Muda para "main"
		- updateAt; Se tiver mudado
		- updateby; Se tiver mudado
2. Atualizar a tabela "songs":
	- Atualiza os campos:
		- updateAt;
		- updateby;
```

# Verificar alteração no banco de dados

# Verificar alteração nas informações 

# Compressão das partituras

# Verifica Alteração

```
1 - Para cada música:

1.1 - Verificar:
- `status != draft`
- `updatedAt > lastBackupAt`

1.2 - Se não precisa de backup
- Pular para a próxima música

1.3 - Se precisa de backup: Agrupa todas as músicas em um `.tar` e comprimi com `.zst` (direto sem gerar `.tar` separado).

1.3.1 - Se sucesso:
	- Renomeia: `{songId}.taz.zst.tmp` -> `{songId}.tar.zst`.
	- Atualizar: `backSong.lastBAckupAt = updateAt` e `backupSongs.status = ok`
	
1.3.1 - Se erro:
	- Atualiza: `backupsongs.status = error`.
	- Registrar log detalhado.
	- Continua para a próxima música

2 - Após todas as músicas:

2.1 - Verifica se houve alguma mudança (no banco de dados).
```

! Outros fluxo que aqui é dependente:
- Comparação de alteração no banco de dados.
- Comparação de alteração nas partituras.


```

2. Após todas as músicas:

   2.1 Verificar se houve alguma mudança (músicas ou metadados)

   2.2 Se houve mudança:
	   - criar arquivo temporário:
		 database.msgpack.zst.tmp

	   - gerar e comprimir o database.msgpack

	   - renomear:
		 database.msgpack.zst.tmp → database.msgpack.zst

1. Executar sincronização com rclone

2. Finalização:

   4.1 Atualizar status geral:
	   - ok → sem erros
	   - warning → erros parciais
	   - error → falha crítica

   4.2 Registrar logs finais
```

Estava pensando no seguinte fluxo, imagine o cenário: flauta está em main e Tuba em draft. O maestro quer que seja atualizado a flauta na Nuvem/Cliente.
- O servidor possui a música em `.tar.zst`, então ele vai descompactar e extrair.
- Vai substituir a flauta vai gerar um novo `.tar.zst` com a flauta atualizada.