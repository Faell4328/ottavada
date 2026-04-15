! O software será simplificado até a versão `v1`, com isso, ele será desenvolvido com o seguinte cenário: 1 servidor, 1 ou vários clientes (`read-only`).

**Responsabilidades Arquivos**:
- `events.msgpack` - É usado para sincronizar as alterações feitas no computador entre os computadores.
- `snapshot.msgpack` - É responsável por consolidar as alterações, o objetivo dele é limpar os eventos e agilizar a sincronização de novos computadores.
- `backup.msgpack` - É usado para exportar todo o banco de dados, podendo ser uma copia de segurança ou importar em outro servidor.

**Responsabilidades Tabelas**:
- `changedField` - Possui a única função de gerar o `events.msgpack` com as alterações feitas.
- `backupSongs` - Tem o objetivo de controlar os arquivos com as partitura que vai para o servidor. Gerando só o que for necessário, se os arquivos das partitura não foi alterado, não tem porque gerar novamente.

# Compressão

Dentro do `.tar.zst`, vai ter os instrumentos, ex: `flauta.musx`, `violino.musx`, `horn.musx` e etc. Também pode ter `.pdf`.

# `snapshot.msgpack`

Será documentando em JSON, mas na aplicação real é utilizando `MessagePack`.

```json
{
  // Quando foi gerado
  "generatedAt": 1710684000,
  // Lista as músicas
  "songs": [
    {
      "id": "abc123",
      "name": "Nome música",
      "composer": "Nome compositor",
      "arranger": "Nome arranjador",
      "categoriesId": ["Categoria 1", "Categoria 2"],
      // Implementando apenas na v1
      //"status": "main",
      // Última alteração de algum arquivo de partitura (implementando apenas na v1)
      //"lastScoreUpdateAt": 1710684000,
      // Quando foi atualizado por último (implementando apenas na v1)
      //"updatedAt": 1710684000,
      // Quem atualizou (implementando apenas na v1)
      //"updatedBy": "computerId",
      // Lista as partituras
      "scores": [
	      {
		      "id": "xyz123",
		      "name": "Flauta",
		      "status": "main",
		      // Quando foi atualizado por último
		      "updatedAt": 1710684000,
		      "extension": "extensão do arquivo"
		      // Quem atualizou (implementando apenas na v1)
		      //"updatedBy": "computerId",
		      // Timestamp da última alteração do arquivo (implementando apenas na v1)
		      //"fileModifiedAt": 1710684000,
		      // Tamanho do arquivo (um inteiro que significa a quantidade de bytes, implementando apenas na v1)
		      //"fileSize": 123124
	      }
      ],
    }
  ]
}
```

# `backup.msgpack`

## Automático
! Esse arquivo é o backup que é gerado automaticamente a cada 3 dias. Caso o usuário não tenha alterado nada em três dias, não é gerado um backup. Seguindo a mesma estrutura e definição do `backup.msgpack`.
! Ele é salvo em `/cloud/backup/`.

## Manual
! Esse arquivo é o backup manualmente pelo usuário. Ele deve possuir todas as informações do banco de dados, não sendo necessário configurações do `tauri-plugin-store`.
! Ele é salvo aonde o usuário escolher.

# `events.msgpack`

Será documentando em JSON, mas na aplicação real é utilizando `MessagePack`.

```json
{
	"computerId": "1iu2312",
	// Implementando apenas na v1
	//"origin": "server", // cliente | server
	// Implementando apenas na v1
	//"name": "Nome do computador no tauri-plugin-store",
	"events": [
		{
			"id": "uuid",
			"timestamp": 1710685000,

			"type": "insert", // insert | update | delete
			"entity": "songs", // songs | scores | categories
			"entityId": "2141ko24",

			"data":[
				{
					"field": "name",
					"newValue": "HINO NACIONAL"
				},
				{
					"field": "composer",
					"newValue": "JOEL"
				}
			]
		},
		// Inserir nova música
		{
			"id": "uuid",
			"timestamp": 1710685000,
			
			"type": "insert",
			"entity": "songs",
			"entityId": "2141ko24",
			
			"data": [
				{
					"field": "name",
					"newValue": "Da dus Glória"
				}
			]
		},
		// Inserir nova partitura (música já existe)
		{
			"id": "uuid",
			"timestamp": 1710685000,
			
			"type": "insert",
			"entity": "scores",
			"entityId": "3k123lj12l",
			
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
			"id": "uuid",
			"timestamp": 1710685000,
			
			"type": "update",
			"entity": "songs",
			"entityId": "2141ko24",
			
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
			"id": "uuid",
			"timestamp": 1710685000,
			
			"type": "delete",
			"entity": "songs",
			"entityId": "2141ko24"
		},
		
		// Inserindo nova categoria
		{
			"id": "uuid",
			"timestamp": 1710685000,
			
			"type": "insert",
			"entity": "categories",
			"entityId": "1234klj4",
			
			"data": [
				{
					"field": "name",
					"newValue": "Clássica"
				}
			]

		},
		// Inserindo nova relação categoria
		{
			"id": "uuid",
			"timestamp": 1710685000,
			
			"type": "insert",
			"entity": "categoriesSongs",
			"entityId": "3k12lj3l12çk",
			
			"data": [
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
			"id": "uuid",
			"timestamp": 1710685000,
			
			"type": "delete",
			"entity": "categoriesSongs",
			"entityId": "3k12lj3l12çk",
		}
	]
}
```

! Os eventos ficam em ordem crescente. Os novos eventos são adicionados ao final

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
```
// NÃO SERÁ ADICIONADO ATÉ A VERSÃO V1 (apenas para documentação)
- `updatedAt` - OB (SC)
- `updatedBy` - OB (SC)
```

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
- `lastScoreFileModifiedAt` - OB (SC)
	- timestamp da última alteração de algum arquivo de partitura.
- `extension` - OB (SC)
	- extensão do arquivo
```
// NÃO SERÁ ADICIONADO ATÉ A VERSÃO V1 (apenas para documentação)
- `updatedAt` - OB (SC)
	- última alteração da música (qualquer campo).
- `updatedBy` - OB (SC)
	- ID do computador que alterou por último (qualquer campo).
```

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
```
// NÃO SERÁ ADICIONADO ATÉ A VERSÃO V1 (apenas para documentação)
- `updatedAt` - OB (SC)
- `updatedBy` - OB (SC)
	- quem atualizou por último.
```

! `fileModifiedAt` e `fileSize` NÃO são “verdade do sistema”, são apenas referência para detectar mudanças.

## changedField
- `id`
	- Um `uuid`
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

! O objetivo dessa tabela é facilitar a ageração do arquivo com alterações `events.msgpack`.
! Após incrementado o arquivo  `events.msgpack` e fazer o upload com sucesso a Nuvem, os dados dessa tabela é delatado. Com referência do timestamp mais recente, não deletando as alterações mais recentes que não foram adicionada no `msgpack`.`

## backupSongs
- `songId`
- `lastBackupAt`
- `status` - "processing" || "ok" || "error"

! Essa tabela é responsável por controlar a geração dos arquivos `.tar.zst`, evitando regerar um arquivo que ainda está válido e controlar o status dele.

## Para telemetria

- Não precisa criar as tabelas `computerInformation` e `usage`, já que essas informações podem ser obtidas facilmente. 

### errors
- `id` - o `uuid` enviado pelo cliente. Deve ser único.
- `message` - Mensagem do erro ocorrido
- `timestamp` - Quando o erro aconteceu

# `tauri-plugin-store`

```json
{
	"id": "lfajkdçf",
	"computerName": "Faell",
	"organization": "Sei la",
	"type": "client",
	"rclone": {
		"provider": "drive" || "koofr",
	},
	"cloud": {
		// Timestamp do último snapshot implementado
		"lastSnapshotTimestamp": 14821049124,
		// Timestamp do último evento de alteração implementado
		"lastChangeTimestamp": 12903812039,
		// Timestamp do último backup automático gerado.
		"lastBackupTimestamp": 12903812903,
	}
}
```

! O `type` pode ser `client` ou `server`.