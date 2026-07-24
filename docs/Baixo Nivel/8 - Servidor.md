O servidor será um simples PHP e SQLite.

Para proteger contra bots. Será necessário enviar uma chave API que fica dentro do aplicativo e é enviada na requisição.

O site atual é `https://ottavada.com`, anterioremente: `https://scoremaestro.rhafaell.com.br`.

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

**Download**

`GET /v1/programx32` - download do aplicativo em `x32`.

`GET /v1/programx64` - download do aplicativo em `x64`.

**Telemetria** - Deve enviar no `header` o parâmetro `Token`, para que o servidor aceite a telemetria.

`POST /v1/telemetry` - para enviar dados de telemetria.


# Telemetria

```json
// Exemplo de telemetria enviada
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

#
