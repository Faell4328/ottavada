# Compressão

Dentro do `.tar.zst`, vai ter os instrumentos, ex: `flauta.musx`, `violino.musx`, `horn.musx` e etc. Também pode ter `.pdf`.

### `snapshot.msgpack`

Será documentando em JSON, mas na aplicação real é utilizando `MessagePack`.

```json
{
  // Versão do shema
  "schemaVersion": 1,
  // Quando foi gerado
  "generatorIn": 1710684000,
  // Lista as músicas
  "songs": [
    {
      "id": "abc123",
      "name": "Nome música",
      "composer": "Nome compositor",
      "arranger": "Nome arranjador",
      "categoriesId": ["Categoria 1", "Categoria 2"],
      "status": "main",
      // Última alteração de algum arquivo de partitura
      "lastScoreUpdateAt": 1710684000,
      // Quando foi atualizado por último
      "updatedAt": 1710684000,
      // Quem atualizou
      "updatedBy": "computerId",
      // Lista as partituras
      "scores": [
	      {
		      "id": "xyz123",
		      "name": "Flauta",
		      "status": "main",
		      // Quando foi atualizado por último
		      "updatedAt": 1710684000,
		      // Quem atualizou
		      "updatedBy": "computerId",
		      // Timestamp da última alteração do arquivo
		      "fileModifiedAt": 1710684000,
		      // Tamanho do arquivo (um inteiro que significa a quantidade de bytes)
		      "fileSize": 123124
	      }
      ],
    }
  ]
}
```

# Arquivo `{computerId}.msgpack`

Será documentando em JSON, mas na aplicação real é utilizando `MessagePack`.

```json
{
	// Versão do shema
	"schemaVersion": 1,
	"computerId": "1iu2312",
	"events": [
		{
			"timestamp": 1710685000,
			"origin": "server", // cliente | server

			"type": "insert", // insert | update | delete
			"entity": "songs", // songs | scores | categories

			"data": [
				{
					"field": "id",
					"newValue": "3219o38901f"
				},
				{
					"field": "name",
					"newValue": "HINO NACIONAL"
				},
				{
					"field": "composer",
					"newValue": "JOEL"
				},
			]
		},
		// Inserir nova música
		{
			"type": "insert",
			"entity": "songs",
			"data": [
				{
					"field": "id",
					"newValue": "3219o38901f"
				},
				{
					"field": "name",
					"newValue": "HINO NACIONAL"
				}
			]
		},
		// Inserir nova partitura (música já existe)
		{
			"type": "insert",
			"entity": "scores",
			"data": [
				{
					"field": "songId",
					"newValue": "faskdf312"
				},
				{
					"field": "name",
					"newValue": "Flauta"
				}
			]
		},
		// Atualizar
		{
			"type": "update",
			"entity": "songs",
			"entityId": "1",
			"data": [
				{
					"field": "name",
					"oldValue": "HINO NACIONAL",
					"newValue": "Hino Nacional"
				}
			]
		},
		// Deletar
		{
			"type": "delete",
			"entity": "songs",
			"entityId": "1"
		},
		
		// Inserindo nova categoria
		{
			"type": "insert",
			"entity": "categories",
			"data": [
				{
					"field": "id",
					"newValue": "fkasdljrlç23"
				},
				{
					"field": "name",
					"newValue": "Clássica"
				}
			]

		},
		// Inserindo nova relação categoria
		{
			"type": "insert",
			"entity": "categoriesSongs",
			"data": [
				{
					"field": "id",
					"newValue": "3912fadfkla"
				},
				{
					"field": "categoryId",
					"newValue": "çflkadsjl124"
				},
				{
					"field": "songId",
					"newValue": "fasdjfkl2345234"
				}
			]
		},
		// Deletando categoria
		{
			"type": "delete",
			"entity": "categoriesSongs",
			"entityId": "3912fadfkla",
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

! Caso o valor do `id` não seja informado, ele deve preencher com um `uuid` automaticamente.
## categories
- `id` - OB (SC)
- `name` - OB (SC)
- `updatedAt` - OB (SC)
- `updatedBy` - OB (SC)

## categoriesSongs
- `id` - OB (SC)
- `categoryId` - OB (SC)
- `songId` - OB (SC)
! É uma relação N:N.

## songs
- `id` - OB (SC)
- `name` - OB (SC)
- `composer` - OP (SC)
- `arranger` - OP (SC)
- `isFavorite` - OP (SC)
	- booleano
- `lastScoreUpdateAt` - OB (SC)
	- última alteração de algum arquivo de partitura (`main` ou `pendig`, não conta `draft` e `not found`)
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

! `fileModifiedAt` e `fileSize` NÃO são “verdade do sistema”, são apenas referência para detectar mudanças.

## changedField
- `id`
- `origin`
	- "client" ou "server"
- `type`
	- "insert", "update" ou "delete"
- `entity`
	- "categories", "categoriesSongs", "songs" ou "scores"
- `entityId`
	- `id` do `entity`
- `field`
	- "name", "composer", "arranger", "status", 
- `oldValue`
- `newValue`
- `timestamp`

! O objetivo dessa tabela é facilitar a ageração do arquivo com alterações `{computerId}.msgpack`.
! Após incrementado o arquivo  `{computerId}.msgpack` e fazer o upload com sucesso a Nuvem, os dados dessa tabela é delatado. Com referência do timestamp mais recente, não deletando as alterações mais recentes que não foram adicionada no `msgpack`.

## changedRelations
- `id`
- `origin`
	- "client" ou "server"
- `type`
	- "insert" ou "delete"
- `categoryId`
	- utilizado unicamente para relação N:N entre "category" e "song"
- `songId`
	- utilizado unicamente para relação N:N entre "category" e "song"
- `timestamp`

## backupSongs
- `songId`
- `lastBackupAt`
- `status` - "pending" || "processing" || "ok" || "error"
- `errorMessage`

! Essa tabela é responsável por controlar a geração dos arquivos `.tar.zst`, evitando regerar um arquivo que ainda está válido e controlar o status dele.

# `tauri-plugin-store`

```json
computer: {
	"id": "lfajkdçf",
	"name": "Faell",
	"type": "Client" | "Server",
	"rclone": {
		"name": "Nome salvo no rclone",
		"path": "Diretório no Google Drive",
		
	},
	"cloud": {
		"lastSnapshotTimestamp": 14821049124,
		"lastChangeTimestamp": 12903812039
	}
}
```

- `none` - nada foi feito, pronto para ser comprimido
- `compressed` - arquivo já comprimido, pronto para ser feito o update.
- `ok` - tudo certo, compressão e update feito.
- `error` - erro em alguma etapa (mensagem do erro).

! Primeiro é feito as pendências de `backupSongs` depois é feito de `backupDatabase`. 