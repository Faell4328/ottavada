O servidor será um simples PHP e SQLite.

Para proteger contra bots. Será necessário enviar uma chave API que fica dentro do aplicativo e é enviada na requisição.

O site atual é `https://ottavada.com`, anteriormente: `https://scoremaestro.rhafaell.com.br`.

## Rota

**Usuário**
`GET /update.json` - retornando o `.json` com as informações para a atualização do aplicativo.

```json
{
    "version": "1.3.0",
    "notes": "Migração para Ottavada e suporte a multi-idioma",
    "pub_date": "2026-08-02T18:00:00Z",
    "platforms": {
        "windows-x86_64": {
            "signature": "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVUVGUxSzBnd2RES3dNQ3NhYkpVczM5L3FJY2k1RWZ4ZThyM2JKWlp4RkVSMjFRVjU5SHBaczJaQjhvYmRLR1VUcCtrMWxQTUhNVTBlR3lrNzRRdjVvVnFVQmY4UEJuUkE0PQp0cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDoxNzg1NzA0MTU3CWZpbGU6T3R0YXZhZGFfMS4zLjBfeDY0LXNldHVwLmV4ZQpneW8yR2JqRVRxbzM4VkoycTBseFRtemVrNkV6RW9qZ3dCakVoMXBhaEhiOUs2MGpUZk81MEpScmhjYzNnVGRvQnlSUjd2NUtzTjRvREFBUmZ6KzBDUT09Cg==",
            "url": "https://github.com/Faell4328/ottavada/releases/download/v1.3/Ottavada_x64-setup.exe"
        },
        "windows-i686": {
            "signature": "ASSINATURA_X86",
            "url": "https://github.com/Faell4328/ottavada/releases/download/v0.11/Ottavada_0.11.0_x86-setup.exe"
        },
        "linux-x86_64": {
            "signature": "ASSINATURA_LINUX_X64",
            "url": "https://github.com/Faell4328/ottavada/releases/download/v1.3/Ottavada_1.3.0_x86_64.AppImage"
        },
        "darwin-x86_64": {
            "signature": "ASSINATURA_MACOS_X64",
            "url": "https://github.com/Faell4328/ottavada/releases/download/v1.3/Ottavada_1.3.0_x64.dmg"
        },
        "darwin-aarch64": {
            "signature": "ASSINATURA_MACOS_ARM",
            "url": "https://github.com/Faell4328/ottavada/releases/download/v1.3/Ottavada_1.3.0_aarch64.dmg"
        }
    }
}
```

**Arquivos de download**: Eles ficam no `releases` no GitHub.

# Telemetria

A rota da telemetria é outra: `https://servidor.ottavada.com`, isso ocorre porque é enviado para meu homelab que não fica ligado o tempo todo. Caso falhe um envio, o Ottavada não apresenta problema e depois reenvia o que falhou.

Deve enviar no `header` o parâmetro `Token`, para que o servidor aceite a telemetria.

`POST /telemetry` - para enviar dados de telemetria.

```json
// Exemplo de telemetria enviada
{
    "computerId": "id do computador", // ID único do computador (persistido no tauri-plugin-store)
    "organizationName": "nome da organização", // Nome da organização/licença vinculada ao uso do software
    "computerName": "nome do computador", // Nome amigável definido pelo usuário
    "type": "server", // Modo de uso: "server" (modo Gerir) ou "client" (modo Consultar)
    "language": "en", // Idioma usado no sistema
    "appVersion": "0.9.1", // Versão do aplicativo em execução
    "os": "windows", // Sistema operacional (windows, linux, etc)
    "arch": "x64", // Arquitetura do sistema (x32 ou x64)
    "musicCount": 120, // Total de músicas cadastradas no banco local
    "musicMain": 100, // Quantidade de músicas com status "main" (válidas e sincronizadas)
    "musicDraft": 15, // Quantidade de músicas em rascunho (não sincronizadas)
    "scoresCount": 980, // Total de partituras cadastradas
    "scoresMain": 850, // Quantidade de partituras com status "main" (válidas e sincronizadas)
    "scoresDraft": 80, // Quantidade de partituras em rascunho (não sincronizadas)
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
