Essa é a documentação para o servidor que vai gerenciar upload e telemetria.

O servidor será simples, feito em PHP e SQLite. Com único objetivo de gerenciar atualizações e coleta de telemetria. O cliente (quando aberto) irá enviar a cada 5 minutos para o servidor, apenas os campos com `send = false`.

Ele irá rodar em meu servidor local ZimaOS no contêiner `phpfpm-nginx` com o túnel cloudflare, para expor ele a internet. Ficando ligado de dia, tarde e parte da noite (horário que o aplicativo é usado).
- Como o servidor já fica ligado por causa dos meus outros contêineres, a escolha que tinha era assinar uma VPS ou usar meu servidor. Para não gastar atoa e como não é algo que vai ser usado sempre, a melhor escolha foi meu próprio servidor local.

Para proteger contra bots, irei implementar uma proteção "fezes", mas melhor que nada. Uma chave API no cliente, para qualquer requisição é necessário enviar essa chave. Óbvio que sei, que ela pode ser copiada, mas é só para proteger contra bots da internet (só para não deixar a portar aberta).

Para consultar, irei criar uma automação no `n8n`, que irá acessar diretamente o `database.db` e extrair as informações e enviar via bot telegram, que vai enviar um relatório diário.

O site atual é `shttps://scoremaestro.rhafaell.com.br`.

## Anotações sobre a telemetria

! Caso o envido tenha um "uuid" já existente, deve retorna como tivesse salvo, mas o valor deve ser descartado internamento.

! O servidor não precisa retornar mensagem, apenas o status deve informar o usuário se deu certo ou não.

! A lógica do servidor será muito simplificada, irá apenas incrementa, não tem que atualizada nada. Mantendo uma timeline das alterações (sei que terá muita coisa repetida, mas não tem problema).

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
	
	"musicCount": 120, // Total de músicas cadastradas no banco local
	
	"musicMain": 100, // Quantidade de músicas com status "main" (válidas e sincronizadas)
			
	"musicDraft": 15, // Quantidade de músicas em rascunho (não sincronizadas)
			
	"musicNotFound": 5, // Quantidade de músicas não encontradas no sistema de arquivos
			
	"scoresCount": 980, // Total de partituras cadastradas
			
	"scoresMain": 850, // Quantidade de partituras com status "main" (válidas e sincronizadas)
			
	"scoresDraft": 80, // Quantidade de partituras em rascunho (não sincronizadas)
			
	"scoresNotFound": 50, // Quantidade de partituras não encontradas no sistema de arquivos
	
	"errors": [
		{
			"id": "uuid",
			
			"date": "2026-04-12",
			
			"message": "erro ao compactar arquivo", // Mensagem do erro ocorrido
			
			"timestamp": 1710684000 // Quando o erro aconteceu (epoch)
		}
	]
}
```
# Banco de Dados Servidor

## computerInformation
- `id` - auto incremental
- `timestamp` - Quando foi
- `computerId` - ID único do computador (persistido no tauri-plugin-store).
- `organizationName` - Nome da organização/licença vinculada ao uso do software
- `computerName` - Nome amigável definido pelo usuário
- `type` - Tipo do computador: "server" (gerencia) ou "client" (consulta)
- `appVersion` - Versão do aplicativo em execução
- `os` - Sistema operacional (windows, linux, etc)
- `arch` - Arquitetura do sistema (x32 ou x64)
- `report` - Booleano, informando se já foi enviado ou não no relatório diário do bot.

## usage
- `id` - auto incremental
- `timestamp` - Quando foi
- `computerId` - ID único do computador (persistido no tauri-plugin-store).
- `musicCount` - Total de músicas cadastradas no banco local
- `musicMain` - Quantidade de músicas com status "main" (válidas e sincronizadas)
- `musicDraft` - Quantidade de músicas em rascunho (não sincronizadas)
- `musicNotFound` - Quantidade de músicas não encontradas no sistema de arquivos
- `scoresCount` - Total de partituras cadastradas
- `scoresMain` - Quantidade de partituras com status "main" (válidas e sincronizadas)
- `scoresDraft` - Quantidade de partituras em rascunho (não sincronizadas)
- `scoresNotFound` - Quantidade de partituras não encontradas no sistema de arquivos
- `report` - Booleano, informando se já foi enviado ou não no relatório diário do bot.

## errors
- `id` - o `uuid` enviado pelo cliente. Deve ser único.
- `computerId` - ID único do computador (persistido no tauri-plugin-store).
- `message` - Mensagem do erro ocorrido
- `timestamp` - Quando o erro aconteceu
- `report` - Booleano, informando se já foi enviado ou não no relatório diário do bot.

Pode acontecer de o computador ficar sem internet e enviar de vários dias, por isso o campo `report`, enviando no relatório outros dias, porque não tinha sido enviado (está atrasado).

## SQL

```sql
CREATE TABLE computerInformation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME NOT NULL,
    computerId TEXT NOT NULL,
    organizationName TEXT,
    computerName TEXT,
    type TEXT CHECK(type IN ('server', 'client')) NOT NULL,
    appVersion TEXT,
    os TEXT,
    arch TEXT,
    report BOOLEAN DEFAULT FALSE
);

CREATE TABLE usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME NOT NULL,
    computerId TEXT NOT NULL,
    musicCount INTEGER DEFAULT 0,
    musicMain INTEGER DEFAULT 0,
    musicDraft INTEGER DEFAULT 0,
    musicNotFound INTEGER DEFAULT 0,
    scoresCount INTEGER DEFAULT 0,
    scoresMain INTEGER DEFAULT 0,
    scoresDraft INTEGER DEFAULT 0,
    scoresNotFound INTEGER DEFAULT 0,
    report BOOLEAN DEFAULT FALSE
);

CREATE TABLE errors (
    id TEXT PRIMARY KEY,
    computerId TEXT NOT NULL,
    date TEXT,
    message TEXT NOT NULL,
    timestamp DATETIME NOT NULL,
    report BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_computerInformation_computerId ON computerInformation(computerId);
CREATE INDEX idx_computerInformation_timestamp ON computerInformation(timestamp);
CREATE INDEX idx_usage_computerId ON usage(computerId);
CREATE INDEX idx_usage_timestamp ON usage(timestamp);
CREATE INDEX idx_errors_computerId ON errors(computerId);
CREATE INDEX idx_errors_timestamp ON errors(timestamp);
```