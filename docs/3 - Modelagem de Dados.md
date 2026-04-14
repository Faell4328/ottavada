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
### usage
- `id` - o `uuid` enviado pelo cliente. Deve ser único.
- `date` - Quando foi
- `lastAccessedAt` - Última vez que o usuário abriu/utilizou o app
- `totalTimeSpentMinutes` - Tempo total de uso acumulado (em minutos)
- `openScoreCount` - Quantidade de vezes que uma partitura foi aberta
- `searchCount` - Quantidade de buscas realizadas
- `favoriteCount` - Quantidade de ações de favoritar/desfavoritar
- `addMusicCount` - Quantidade de músicas adicionadas (apenas servidor)
- `editMusicCount` - Quantidade de edições feitas em músicas (apenas servidor)
- `deleteMusicCount` - Quantidade de músicas removidas (apenas servidor)
- `applyChangesCount` - Quantidade de vezes que o usuário aplicou alterações (sync servidor → nuvem)
- `send` - Booleano, informando se já foi enviado ou não.

### library
- `id` - o `uuid` enviado pelo cliente. Deve ser único.
- `date` - Quando foi
- `musicCount` - Total de músicas cadastradas no banco local
- `musicMain` - Quantidade de músicas com status "main" (válidas e sincronizadas)
- `musicDraft` - Quantidade de músicas em rascunho (não sincronizadas)
- `musicNotFound` - Quantidade de músicas não encontradas no sistema de arquivos
- `scoresCount` - Total de partituras cadastradas
- `scoresMain` - Quantidade de partituras com status "main" (válidas e sincronizadas)
- `scoresDraft` - Quantidade de partituras em rascunho (não sincronizadas)
- `scoresNotFound` - Quantidade de partituras não encontradas no sistema de arquivos
- `send` - Booleano, informando se já foi enviado ou não.

### sync
- `id` - o `uuid` enviado pelo cliente. Deve ser único.
- `date` - Quando foi (id)
- `lastSyncAt` - Última vez que houve sincronização com a nuvem
- `uploadCount` - Quantidade de uploads realizados
- `uploadTotalBytes` - Total de dados enviados (em bytes)
- `downloadCount` - Quantidade de downloads realizados
- `downloadTotalBytes` - Total de dados baixados (em bytes)
- `errors` - Quantidade de erros ocorridos durante operações de sync
- `send` - Booleano, informando se já foi enviado ou não.

### errors
- `id` - o `uuid` enviado pelo cliente. Deve ser único.
- `message` - Mensagem do erro ocorrido
- `timestamp` - Quando o erro aconteceu
- `send` - Booleano, informando se já foi enviado ou não.

### dailyUsage
- `id` - o `uuid` enviado pelo cliente. Deve ser único.
- `date` - Data da coleta diária
- `timeSpentMinutes` - Tempo de uso no dia (em minutos)
- `openedScores` - Quantidade de partituras abertas nesse dia
- `send` - Booleano, informando se já foi enviado ou não.

- Campos que não são eventos (ou seja, não são adicionado e sim atualizados), sempre que for alterado, o `send` ficará como `false` e quando for enviado fica como `true`. No servidor, ele vai atualizar os campos. Já os eventos, eles vão ser inseridos no servidor e não atualizados. Sendo atualizado no cliente, apenas com retorno positivo do servidor, informando que foi salvo.
- Caso exista de outros dias com `send = false` é enviado os anteriores (ordem crescente) até o dia atual.
- Caso o servidor não retorne (caiu), deve interromper e não enviar os próximos, caso tenha. Deve esperar os 5 minutos e tentar novamente.

### Query do banco de dados

```sql
CREATE TABLE usage (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  lastAccessedAt TEXT,
  totalTimeSpentMinutes INTEGER DEFAULT 0,
  openScoreCount INTEGER DEFAULT 0,
  searchCount INTEGER DEFAULT 0,
  favoriteCount INTEGER DEFAULT 0,
  addMusicCount INTEGER DEFAULT 0,
  editMusicCount INTEGER DEFAULT 0,
  deleteMusicCount INTEGER DEFAULT 0,
  applyChangesCount INTEGER DEFAULT 0,
  send INTEGER DEFAULT 0
);


CREATE TABLE library (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  musicCount INTEGER DEFAULT 0,
  musicMain INTEGER DEFAULT 0,
  musicDraft INTEGER DEFAULT 0,
  musicNotFound INTEGER DEFAULT 0,
  scoresCount INTEGER DEFAULT 0,
  scoresMain INTEGER DEFAULT 0,
  scoresDraft INTEGER DEFAULT 0,
  scoresNotFound INTEGER DEFAULT 0,
  send INTEGER DEFAULT 0
);


CREATE TABLE sync (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  lastSyncAt TEXT,
  uploadCount INTEGER DEFAULT 0,
  uploadTotalBytes INTEGER DEFAULT 0,
  downloadCount INTEGER DEFAULT 0,
  downloadTotalBytes INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  send INTEGER DEFAULT 0
);


CREATE TABLE errors (
  id TEXT PRIMARY KEY,
  message TEXT,
  timestamp TEXT,
  send INTEGER DEFAULT 0
);


CREATE TABLE dailyUsage (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  timeSpentMinutes INTEGER DEFAULT 0,
  openedScores INTEGER DEFAULT 0,
  send INTEGER DEFAULT 0
);
```

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