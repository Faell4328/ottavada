O projeto foi desenvolvido com foco em Windows, por isso a explicação será apenas no Windows.

# Instalação e Configuração no Windows

1° Baixe o Git: https://git-scm.com/install/windows

1° Baixe o Rust: https://rust-lang.org/tools/install/

2° Baixe o Node: https://nodejs.org/pt-br/download

3° Baixe o Rclone: https://rclone.org/downloads/

- Você deve baixar de acordo com sua arquitetura de CPU.

4° Depois de baixar e extrair o rclone: renomei para `rclone.exe` e coloque no diretório: `src-tauri/rclone/rclone.exe`.

5° No diretório raiz do projeto, rode: `npm install` ou `npm i`.

6° Se você pretende buildar o projeto, é recomendando baixar:

- `rustup target add i686-pc-windows-msvc` - se seu computador for `x32`.

- `rustup target add x86_64-pc-windows-msvc` - se seu computador for `x64`.

## Atualização



A atualização utiliza o mecanismo nativo do Tauri. Para gerar as chaves privada e pública, execute o comando: `tauri signer generate`. Você será solicitado a informar uma senha. Após fornecê-la, serão geradas as chaves pública e privada. 

Em seguida, adicione as chaves nos seguintes locais:

- No arquivo `.env`

- No arquivo `tauri.config.json`

## Autoassinado

O aplicativo usa uma assinatura autoassinada.

**Caso você tenha o .pfx**:

1. Abra ele e instale no seu computador.

2. Depois abra em: `certmgr.msc` > pessoal > certificados > Abra o certificado > Detalhes > Thumbprint (impressão digital).

3. Com base no que foi retornado é para adicionar no `tauri.config.json`, no campo: `certificateThumbprint`.

**Caso não tenha o .pfx**:

1. Simplesmente remova as linhas:

```json
"certificateThumbprint": "04f52bc09d3206c1938b96532d251cacc78adcce",
"digestAlgorithm": "sha256",
"timestampUrl": "http://timestamp.digicert.com",
```

---

# Comandos

**Rodar**

- `npm run tauri:win` - Esse comando roda o aplicativo em modo Dev.

**Teste**

- `npm run test:front` - Esse comando roda todos os testes do Front.

- `npm run test:back` - Esse comando roda todos os testes do Back.

- `npm run test:full` - Roda o teste do Front e Back.

**Compilar**

- `npm run tauri:build:win:x64` - Compila o projeto para Windows x64.

- `npm run tauri:build:win:x32` - Compila o projeto para Windows x32.
