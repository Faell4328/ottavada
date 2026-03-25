# Compressão

Dentro do `.tar.zst`, vai ter os instrumentos, ex: `flauta.musx`, `violino.musx`, `horn.musx` e etc.
# Arquivo `{computerId}.msgpack`

Será documentando em JSON, mas na aplicação real é utilizando `MessagePack`.

```json
{
	"computerId": "1iu2312",
	"computerName": "lkasdjfka",
	"events": [
		{
			"hash": "pc-a-1710685000-1",
			"timestamp": 1710685000,
			"origin": "client" || "server",

			"type": "insert", // insert | update | delete
			"entity": "songs", // songs | scores | categories
			"entityId": "fajksdlfja",  

			"data": {
				"name": "Hino Nacional",
				"composer": "Sei la",
				"arranger": "Sei la"
			}
		},
		// Inserir música
		{
			"type": "insert",
			"entity": "songs",
			"entityId": "1",
			"data": {
				"name": "Hino Nacional"  
			}
		},
		// Inserir partitura
		{
			"type": "insert",
			"entity": "scores",
			"entityId": "2",
			"data": {
				"songId": "1",
				"name": "Flauta"
			}
		},
		// Atualizar
		{
			"type": "update",
			"entity": "songs",
			"entityId": "1",
			"data": {
				"name": "Hino Nacional"
			}
		},
		// Deletar
		{
		  "type": "delete",
		  "entity": "songs",
		  "entityId": "1"
		}
	]
}
```

---
# Banco de dados

**Sumário**:
- OB = Obrigatório.
- OP = Opcional.
- (C) = Será utilizando no Cliente.
- (S) = Será utilizado no Servidor.
- (SC) = Será utilizado em Ambos.
## categories
- `id` - OB (SC)
- `name` - OB (SC)
- `updatedAt` - OB (SC)
- `updatedBy` - OB (SC)

## categoriesSongs
- `id` - OB (SC)
- `categoryId` - OB (SC)
- `songsId` - OB (SC)
! É uma relação N:N.

## songs
- `id` - OB (SC)
- `name` - OB (SC)
- `composer` - OP (SC)
- `arranger` - OP (SC)
- `isFavorite` - OP (SC)
	- booleano
- `updatedAt` - OB (SC)
	- última alteração da música
- `updatedBy` - OB (SC)
	- ID do computador que alterou por último.

## scores
- `id` - OB (SC)
- `songId` - OB (SC)
- `name` - OB (SC)
- `hostId` - OB (SC)
	- computador que contém o arquivo original localmente (indexado)
- `filePath` - OB (S)
	- diretório onde está o arquivo.
- `fileName` - OB (S)
	- nome + extensão do arquivo
- `fileModifiedAt` - OB (S)
	- última alteração no arquivo
- `fileSize` - OB (S)
	- tamanho do arquivo  (um inteiro que significa a quantidade de bytes)
- `status` - OB (SC)
	- `draft`, `pending`, `not found` e `main`.
- `updatedAt` - OB (SC)
- `updatedBy` - OB (SC)
	- quem atualizou por último.

## changed  
- `id`
- `origin`
- `type`
- `entity`
- `entityId`
- `field`
- `value`
- `timestamp`

! Após incrementado o arquivo  `{computerId}.msgpack` e fazer o upload com sucesso a Nuvem, os dados dessa tabela é delatado. Com referência do timestamp mais recente, não deletando as alterações mais recentes que não foram adicionada no `msgpack`.

## backupSongs
- `songId`
- `lastBackupAt`
- `status` - "pending" || "processing" || "ok" || "error"
- `errorMessage`

# `tauri-plugin-store`

```json
computer: {
	"id": "lfajkdçf",
	"name": "Faell",
	"type": "Client" | "Server",
	"dataBaseLocal": 8021948012,
	"rclone": {
		"name": "Nome salvo no rclone",
		"path": "Diretório no Google Drive",
		
	}
}
```

- `none` - nada foi feito, pronto para ser comprimido
- `compressed` - arquivo já comprimido, pronto para ser feito o update.
- `ok` - tudo certo, compressão e update feito.
- `error` - erro em alguma etapa (mensagem do erro).

! Primeiro é feito as pendências de `backupSongs` depois é feito de `backupDatabase`. 