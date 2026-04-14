O servidor será simples, feito em PHP e SQLite. Com único objetivo de gerenciar atualizações e coleta de telemetria. O cliente (quando aberto) irá enviar a cada 5 minutos para o servidor, apenas os campos com `send = false`.

Ele irá rodar em meu servidor local ZimaOS no contêiner `phpfpm-nginx` com o túnel cloudflare, para expor ele a internet. Ficando ligado de dia, tarde e parte da noite (horário que o aplicativo é usado).
- Como o servidor já fica ligado por causa dos meus outros contêineres, a escolha que tinha era assinar uma VPS ou usar meu servidor. Para não gastar atoa e como não é algo que vai ser usado sempre, a melhor escolha foi meu próprio servidor local.

Para proteger contra bots, irei implementar uma proteção "fezes", mas melhor que nada. Uma chave API no cliente, para qualquer requisição é necessário enviar essa chave. Óbvio que sei, que ela pode ser copiada, mas é só para proteger contra bots da internet (só para não deixar a portar aberta).

Para consultar, irei criar uma automação no `n8n`, que irá acessar diretamente o `database.db` e extrair as informações e enviar via bot telegram, que vai enviar um relatório diário.

## Anotações

! Na hora de inserir deve usar `INSERT OR IGNORE`, isso evita que tenha dados duplicados.

! Para simplificar, o cliente irá enviar em lote, com tudo que tem pendente em uma única request.

## Rotas

**Usuário**
`GET /v1/update` - retornando o `.json` com as informações para a atualização do aplicativo.
```json
{
	"version": "0.11.0",
	"notes": "Sei la",
	"pub_date": "2026-04-09T16:00:00Z",
	"platforms": {
		"windows-x86_64": {
			"signature": "ASSINATURA_X64",
			"url": "URL"
		},
		"windows-i686": {
			"signature": "ASSINATURA_X86",
			"url": "URL"
		}
	}
}
```

`GET /v1/programx64` - download do aplicativo em `x64`.
- Download
`GET /v1/programx32` - download do aplicativo em `x32`.
- Download
`POST /v1/telemetry` - para enviar dados de telemetria.
- Deve enviar no `header` o parâmetro `Token`, para que o servidor aceite a telemetria.

# Telemetria

! Esse é o JSON que será enviado na requisição. Essas informações serão tiradas das tabelas abaixas, de outras tabelas não listadas aqui e também do `tauri-plugin-store`.

```json
{
	"computerId": "id do computador", // ID único do computador (persistido no tauri-plugin-store)

	"organizationName": "nome da organização", // Nome da organização/licença vinculada ao uso do software
	
	"computerName": "nome do computador", // Nome amigável definido pelo usuário
	
	"type": "server", // Tipo do computador: "server" (gerencia) ou "client" (consulta)
	
	"appVersion": "0.9.1", // Versão do aplicativo em execução
	
	"os": "windows", // Sistema operacional (windows, linux, etc)
	
	"arch": "x64", // Arquitetura do sistema (x32 ou x64)
	
	"usage": [
		{
			"id": "uuid",
			
			"date": "2026-04-12",
		
			"lastAccessedAt": 1710684000, // Última vez que o usuário abriu/utilizou o app
			
			"totalTimeSpentMinutes": 300, // Tempo total de uso acumulado (em minutos)
			
			"openScoreCount": 120, // Quantidade total de vezes que uma partitura foi aberta
			
			"searchCount": 45, // Quantidade total de buscas realizadas
			
			"favoriteCount": 30, // Quantidade total de ações de favoritar/desfavoritar
			
			// server only
			"addMusicCount": 10, // Quantidade total de músicas adicionadas (apenas servidor)
			
			"editMusicCount": 8, // Quantidade total de edições feitas em músicas (apenas servidor)
			
			"deleteMusicCount": 2, // Quantidade total de músicas removidas (apenas servidor)
			
			"applyChangesCount": 15 // Quantidade total de vezes que o usuário aplicou alterações (sync servidor → nuvem)
		}
	],
	
	"library": [
		{
			"id": "uuid",
			
			"date": "2026-04-12",
			
			"musicCount": 120, // Total de músicas cadastradas no banco local
			
			"musicMain": 100, // Quantidade de músicas com status "main" (válidas e sincronizadas)
			
			"musicDraft": 15, // Quantidade de músicas em rascunho (não sincronizadas)
			
			"musicNotFound": 5, // Quantidade de músicas não encontradas no sistema de arquivos
			
			"scoresCount": 980, // Total de partituras cadastradas
			
			"scoresMain": 850, // Quantidade de partituras com status "main" (válidas e sincronizadas)
			
			"scoresDraft": 80, // Quantidade de partituras em rascunho (não sincronizadas)
			
			"scoresNotFound": 50 // Quantidade de partituras não encontradas no sistema de arquivos
		}
	],
	
	"sync": [
		{
			"id": "uuid",
			
			"date": "2026-04-12",
			
			"lastSyncAt": 1710684000, // Última vez que houve sincronização com a nuvem
			
			"uploadCount": 20, // Quantidade total de uploads realizados
			
			"uploadTotalBytes": 104857600, // Total de dados enviados (em bytes)
			
			"downloadCount": 50, // Quantidade total de downloads realizados
			
			"downloadTotalBytes": 209715200, // Total de dados baixados (em bytes)
			
			"errors": 3 // Quantidade total de erros ocorridos durante operações de sync
		}
	],
	
	"errors": [
		{
			"id": "uuid",
			
			"date": "2026-04-12",
			
			"message": "erro ao compactar arquivo", // Mensagem do erro ocorrido
			
			"timestamp": 1710684000 // Quando o erro aconteceu (epoch)
		}
	],
	
	"dailyUsage": [
		{
			"id": "uuid",
		
			"date": "2026-04-10",
			
			"timeSpentMinutes": 120, // Tempo de uso no dia (em minutos)
			
			"openedScores": 25 // Quantidade de partituras abertas nesse dia
		}
	]
}
```

# Banco de Dados Servidor

## computerInformation
- `computerId` - ID único do computador (persistido no tauri-plugin-store).
- `organizationName` - Nome da organização/licença vinculada ao uso do software
- `computerName` - Nome amigável definido pelo usuário
- `type` - Tipo do computador: "server" (gerencia) ou "client" (consulta)
- `appVersion` - Versão do aplicativo em execução
- `os` - Sistema operacional (windows, linux, etc)
- `arch` - Arquitetura do sistema (x32 ou x64)
- `date` - Data do snapshot (YYYY-MM-DD)
- `report` - Booleano, informando se já foi enviado ou não no relatório diário do bot.

## usage
- `id` - o `uuid` enviado pelo cliente. Deve ser único.
- `computerId` - ID único do computador (persistido no tauri-plugin-store).
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
- `report` - Booleano, informando se já foi enviado ou não no relatório diário do bot.

## library
- `id` - o `uuid` enviado pelo cliente. Deve ser único.
- `computerId` - ID único do computador (persistido no tauri-plugin-store).
- `date` - Quando foi
- `musicCount` - Total de músicas cadastradas no banco local
- `musicMain` - Quantidade de músicas com status "main" (válidas e sincronizadas)
- `musicDraft` - Quantidade de músicas em rascunho (não sincronizadas)
- `musicNotFound` - Quantidade de músicas não encontradas no sistema de arquivos
- `scoresCount` - Total de partituras cadastradas
- `scoresMain` - Quantidade de partituras com status "main" (válidas e sincronizadas)
- `scoresDraft` - Quantidade de partituras em rascunho (não sincronizadas)
- `scoresNotFound` - Quantidade de partituras não encontradas no sistema de arquivos
- `report` - Booleano, informando se já foi enviado ou não no relatório diário do bot.
## sync
- `id` - o `uuid` enviado pelo cliente. Deve ser único.
- `computerId` - ID único do computador (persistido no tauri-plugin-store).
- `date` - Quando foi (id)
- `lastSyncAt` - Última vez que houve sincronização com a nuvem
- `uploadCount` - Quantidade de uploads realizados
- `uploadTotalBytes` - Total de dados enviados (em bytes)
- `downloadCount` - Quantidade de downloads realizados
- `downloadTotalBytes` - Total de dados baixados (em bytes)
- `errors` - Quantidade de erros ocorridos durante operações de sync
- `report` - Booleano, informando se já foi enviado ou não no relatório diário do bot.

## errors
- `id` - o `uuid` enviado pelo cliente. Deve ser único.
- `computerId` - ID único do computador (persistido no tauri-plugin-store).
- `message` - Mensagem do erro ocorrido
- `timestamp` - Quando o erro aconteceu
- `report` - Booleano, informando se já foi enviado ou não no relatório diário do bot.

## dailyUsage
- `id` - o `uuid` enviado pelo cliente. Deve ser único.
- `computerId` - ID único do computador (persistido no tauri-plugin-store).
- `date` - Data da coleta diária
- `timeSpentMinutes` - Tempo de uso no dia (em minutos)
- `openedScores` - Quantidade de partituras abertas nesse dia
- `report` - Booleano, informando se já foi enviado ou não no relatório diário do bot.

Pode acontecer de o computador ficar sem internet e enviar de vários dias, por isso o campo `report`, enviando no relatório outros dias, porque não tinha sido enviado (está atrasado).

## Query do banco de dados

```sql
CREATE TABLE computerInformation (  
computerId TEXT PRIMARY KEY,  
organizationName TEXT,  
computerName TEXT,  
type TEXT CHECK(type IN ('server', 'client')) NOT NULL,  
appVersion TEXT,  
os TEXT,  
arch TEXT,  
date DATE NOT NULL,  
report BOOLEAN DEFAULT FALSE  
);  


CREATE TABLE usage (  
id TEXT PRIMARY KEY, -- UUID do cliente  
computerId TEXT NOT NULL,  
date DATETIME NOT NULL,  
lastAccessedAt DATETIME,  
totalTimeSpentMinutes INTEGER DEFAULT 0,  
openScoreCount INTEGER DEFAULT 0,  
searchCount INTEGER DEFAULT 0,  
favoriteCount INTEGER DEFAULT 0,  
addMusicCount INTEGER DEFAULT 0,  
editMusicCount INTEGER DEFAULT 0,  
deleteMusicCount INTEGER DEFAULT 0,  
applyChangesCount INTEGER DEFAULT 0,  
report BOOLEAN DEFAULT FALSE,  
  
FOREIGN KEY (computerId) REFERENCES computerInformation(computerId)  
);  


CREATE TABLE library (  
id TEXT PRIMARY KEY, -- UUID do cliente  
computerId TEXT NOT NULL,  
date DATETIME NOT NULL,  
musicCount INTEGER DEFAULT 0,  
musicMain INTEGER DEFAULT 0,  
musicDraft INTEGER DEFAULT 0,  
musicNotFound INTEGER DEFAULT 0,  
scoresCount INTEGER DEFAULT 0,  
scoresMain INTEGER DEFAULT 0,  
scoresDraft INTEGER DEFAULT 0,  
scoresNotFound INTEGER DEFAULT 0,  
report BOOLEAN DEFAULT FALSE,  
  
FOREIGN KEY (computerId) REFERENCES computerInformation(computerId)  
);  


CREATE TABLE sync (  
id TEXT PRIMARY KEY, -- UUID do cliente  
computerId TEXT NOT NULL,  
date DATETIME NOT NULL,  
lastSyncAt DATETIME,  
uploadCount INTEGER DEFAULT 0,  
uploadTotalBytes BIGINT DEFAULT 0,  
downloadCount INTEGER DEFAULT 0,  
downloadTotalBytes BIGINT DEFAULT 0,  
errors INTEGER DEFAULT 0,  
report BOOLEAN DEFAULT FALSE,  
  
FOREIGN KEY (computerId) REFERENCES computerInformation(computerId)  
);  


CREATE TABLE errors (  
id TEXT PRIMARY KEY, -- UUID do cliente  
computerId TEXT NOT NULL,  
message TEXT,  
timestamp DATETIME NOT NULL,  
report BOOLEAN DEFAULT FALSE,  
  
FOREIGN KEY (computerId) REFERENCES computerInformation(computerId)  
);  
  

CREATE TABLE dailyUsage (  
id TEXT PRIMARY KEY, -- UUID do cliente  
computerId TEXT NOT NULL,  
date DATE NOT NULL,  
timeSpentMinutes INTEGER DEFAULT 0,  
openedScores INTEGER DEFAULT 0,  
report BOOLEAN DEFAULT FALSE,  
  
FOREIGN KEY (computerId) REFERENCES computerInformation(computerId)  
);  


CREATE INDEX idx_usage_computerId ON usage(computerId);  
CREATE INDEX idx_library_computerId ON library(computerId);  
CREATE INDEX idx_sync_computerId ON sync(computerId);  
CREATE INDEX idx_errors_computerId ON errors(computerId);  
CREATE INDEX idx_dailyUsage_computerId ON dailyUsage(computerId);
```