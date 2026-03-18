Um aplicativo desktop windows, para organizar, controlar status das partituras e fazer backup de partituras.

# Requisitos funcionais

- Sistema deve ser tolerante a falha.
- Sistema deve sempre verificar antes de agir.
- Sistema deve ser transparente com que está fazendo.
- Mais importante, sistema deve ser simples e confiável. Não é para adicionar firula, que não agregue ao objetivo principal.

## Arquitetura entre os computadores

- **Servidor** é o computador mestre: ele mantém todas as partituras indexadas localmente e serve como referência para detectar alterações nos arquivos. É o computador do maestro/compositor/arranjador.
- **Cliente** não indexa o diretório local; consulta as partituras na versão `main` e pode propor alterações pontuais. Essas alterações só são aplicadas no diretório mestre após aprovação do servidor (ou seja, para efetivar a alteração). É o computador de utilidade nos ensaios, sendo mais utilizando para consulta.

## Gerenciamento de Partituras

- **Adicionar:** música manualmente, arquivo individual, ou diretório inteiro
- **Editar:** nome, compositor, arranjador, categorias
- **Favoritar:** marcar/desmarcar como favoritos
- **Pesquisar:** com sugestões automáticas por escopo (todas, favoritas, categoria)
- **Visualizar:** duplo clique abre arquivo no software padrão do sistema

## Status das Partituras

- **Main:** versão sincronizável, autorizada para backup no Google Drive (definida pelo usuário)
- **Pending**: quando o cliente faz uma atualização e está pendente o server autorizar.
- **Draft:** rascunho automático quando arquivo é alterado (não é feito o backup no Google Drive)
- **Monitoramento:** detecta mudanças e converte automaticamente para draft (apenas no servidor)

## Google Drive

- **Sincronização:** Será utilizando um arquivo `MessagePack`, nele terá todas as informações do banco de dados.
- **Compactação**: É utilizando o algoritmo de compactação `xz`, para update e download mais rápidos, e ocupar menos espaço no Google Drive (apena 15GB disponível).

## Gerenciamento de Categorias

- Criar, editar, remover categorias (ex.: "Harpa Cristã", "Clássicas")
- Uma música pode pertencer a múltiplas categorias

## Configurações

- O usuário pode alterar o nome do computador
- O usuário pode adicionar API key do Google Drive (Service Account). O usuário não pode ver/obter informações da API key no front-end, podendo apenas atualizar a existente.
- Deve ter um sistema de log

# Requisitos não funcionais

- Os computadores não se comunicam entre si (diretamente).
- Controle de concorrência não é necessário, já que não vai ser feito alterações toda hora de todo lugar.
-  Não é necessário criptografar a API key do Google Drive, já que vai ser utilizado em computadores domésticos e não em servidores expostos na internet.
- Não é necessário ter um controle de histórico. Ao menos não nas versões iniciais.
- Informações da API key do Google Drive, deve ficar salva em `tauri-plugin-store`.
- Caso aja conflito entre cliente e servidor (que é improvável, porque é pouco provável ambos fazerem alterações ao mesmo tempo). A preferência será o Servidor, descartando as alterações do Cliente.
- Não será utilizado hash, devido a dificuldade de atualizar um arquivo no finale 14, é praticamente impossível "salvar sem querer". Então no momento não é necessário essa complicação. Sendo utilizado apenas a data e hora para saber que o arquivo foi alterado ou não.
- O diretório local onde é baixado as informações é no `/user/score-maestro`.
- Ao baixar os arquivos do Google Drive ele viram compactados, ao dar duplo clique em uma partitura de alguma música, ela deve ser descompactada em um diretório temporário do Sistema Operacional `C:\Windows\Temp`.
- Tanto a varredura, quanto o update e download, deve ser feito em thread separada. Para não interferir no funcionamento dos outros compoentens.

## Front-end

- React
- TypeScript
- Vite
- Tailwind CSS
- `@tanstack/react-virtual` - Virtualização de listas longas
- `react-router` - Navegação entre telas
- `lucide-react` - Ícones
- `react-hot-toast` - Notificações em tempo real

## Back-end

- Tauri (Rust)
- Google Drive API (backup)
- `notify` crate - Para monitoramento em arquivos de partitura (inotify no Linux, ReadDirectoryChangesW no Windows)
- `xz` crate - Reduz tamanho para backup na nuvem
- `rusqlite` crate - SQLite com suporte a FTS5
- `serde` + `rmp-serde` - Leitura do arquivo `MessagePack`.
- `fs2` - Espaço em disco
- `thiserror` - Erros tipados
- `yup-oauth2` - Para facilitar/automatizar a integração com Auth2
- `reqwest` - Para facilitar requisições HTTP para Google Drive
- `tauri-plugin-dialog` - Diálogos nativos (seleção de arquivos/pastas)
- `tauri-plugin-fs` - Acesso ao sistema de arquivos
- `tauri-plugin-store` - Persistência de configurações
- `tauri-plugin-notification` - Notificações ao usuário
- `tracing` + `tracing-subscriber` - Para criar e processar logs
- `tracing-appender` - Para salvar os logs

## Google Drive

- `Scores/` - diretório com todas as músicas.
- `Scores/{songId}.tar.xz` - arquivo compactado com todas as partituras de uma música.
- `database.msgpack.xz` - arquivo com todas as informações do banco de dados.

! Observação sobre `Scores/{songId}.tar.xz` - já foi feito testes e o arquivo possui no máximo 1MB a 2MB e a compressão e descompressão disso é muito rápido.

### Dentro do .tar.xz

Dentro do `.tar.xz`, vai ter os instrumentos, ex: `flauta.musx`, `violino.musx`, `horn.musx` e etc.

### `DataBase.msgpack`

Será documentando em JSON, mas na aplicação real é utilizando `MessagePack`.

```json
{
  "dataBaseUpdatedAt": 1710684000,
  "songs": [
    {
      "id": "abc123",
      "name": "Amazing Grace",
      "composerId": "flçasdf",
      "arrangerId": "fdasjkfkl",
      "categoriesId": ["fadslkçf1", "flçka1"],
      "isFavorite": true,
      "updatedAt": 1710684000,
      "scores": [
	      {
		      "id": "xyz123",
		      "name": "Flauta",
		      "status": "main",
		      "updatedAt": 1710684000
	      }
      ]
    }
  ]
}
```
## Banco de dados

- Essa estrutura é tanto para o Servidor, quanto para o Cliente. A diferença que o cliente não terá todas as informações, como: `filePath`, já que não possui necessidade.

### Categories
- `id`
- `name`

### Categories_Songs
- `id`
- `categoryId`
- `songsId`

### Songs
- `id`
- `name`
- `composer`
- `arranger`
- `isFavorite` - booleano
- `updatedAt` - timestamp

### Scores
- `id`
- `songId`
- `name`
- `hostId` - computador que contém o arquivo original monitorado
- `filePath`
- `updatedAt` - timestamp
- `status` - `draft`, `pending` e `main`.

## `tauri-plugin-store`

```json
computer: {
	"id": "lfajkdçf",
	"name": "Faell",
	"dataBaseUpdatedAt": 8021948012
	"apiKey": {
		"Client ID / Secret": "Identifica a aplicação",
		"Access Token": "Token usado para acessar recursos protegidos",
		
	}
}
backupDatabase: {
	"status": "pending" || "compressed" || "ok" || "error",
	"updatedAt": timestamp
}
backupSongs: [
	{
		"id": "jfkladsf",
		"songsId": "lkaf123",
		"status": "pending" || "compressed" || "ok" || "error"
	}
]
```
- `none` - nada foi feito, pronto para ser comprimido
- `compressed` - arquivo já comprimido, pronto para ser feito o update.
- `ok` - tudo certo, compressão e update feito.
- `error` - erro em alguma etapa (mensagem do erro).

! Primeiro é feito as pendências de `backupSongs` depois é feito de `backupDatabase`. 

# Casos de uso

## Para ambos

**Abrindo pela primeira vez o software**:
1. Aparecerá uma tela de boas vindas.
	1. Deve mostrar o ID gerado do computador.
	2. O usuário deve colocar o nome do computador.
	3. O usuário deve selecionar o arquivo `.json`, com as credências do Google Drive.
	4. É preciso selecionar entre Cliente e Servidor, deve ter um texto explicando a diferença entre eles (por padrão não vem selecionado nada).
2. Verifica se as informações são válidas.
	1. Se as informações não forem válidas, emite um alerta com `toast` e informa o campo errado (todos os campos são obrigatórios).
	2. Se as informações forem válidas, salva as informações e vai para tela inicial.

**Fechar o aplicativo**:
1. É feito uma verificação se não tem nada rodando no Backend.
	1. Caso não tenha, o programa fecha normalmente.
	2. Caso tenha, o programa emite um aviso, alertando que tem operação em andamento e pergunta se deseja cancelar essa operação e fechar o programa.

**Editar**: Editar é simples, será aberto exatamente o mesmo modal que aparece quando o usuário vai preencher/editar após selecionar o arquivo ou diretório. 

## Computador Servidor

### Abrindo o aplicativo:
1. Verifica se tem acesso a internet.
	1. Caso não tenha acesso a internet, emite um alerta com `toast`, avisando que as informações pode está desatualizadas e não segue o fluxo abaixo.
2. Faz uma varredura das partituras verificando se teve alguma alteração.
	1. As partituras que tiverem alteração, tem seu `status` alterado para `draft`.
3. Baixa o arquivo `DataBase.msgpack` do Google Drive.
	1. Vai descompactar em um diretório temporário, depois verifica o timestamp do `dataBaseUpdatedAt` do arquivo com o do banco local.
		1. Caso igual, o software não precisa baixar e atualizar nada. Ele está na versão recente.
		2. Caso seja diferente, o software verifica se o timestamp do arquivo é mais recente que o local. Caso seja, ele varre todas as música e procura a(s) música(s) que foram alteradas, logo em seguida baixado elas e substituindo as antigas pela atual.
		- Será procurado apenas no `Songs`, já que compacta a música com todas as partituras dentro, não sendo necessário identificar qual partitura isolada foi alterada.

### Adicionar música (manualmente):
1. Será aberto um modal solicitando o nome da música.
	1. Caso o usuário clique em cancelar ao invés de salvar, a operação é totalmente cancelada.
	2. Caso a música exista ele não cria e aparece um `toast` avisando que não é possível criar, porque ela já existe.
	3. Caso a música não exista, ela é criada e aparece um `toast` avisando que foi criada.

### Adicionar música (arquivo individual):
1. Será aberto um modal para selecionar um arquivo (com filtro em `.mus`, `.musx` e `.pdf`).
	1. Caso o usuário clique em cancelar ao invés de selecionar a música, a operação é totalmente cancelada.
	2. Caso o usuário clique em algum arquivo.
		1. É feito a verificação se foi selecionado uma extensão válida (`.mus`, `.musx` e `.pdf`).
			1. Caso não tenha selecionando uma extensão valida é emitido um `toast` avisando que é permitido apenas `.mus`, `.musx` e `.pdf`.
2. É extraindo do nome do arquivo o nome da música e o instrumento, um exemplo de arquivo: "Hino Nacional - Flaute.musx".
3. Será aberto um modal com as informações, para o usuário poder alterar e confirmar.
	- Os campos no modal vem preenchido com que foi extraindo no nome do arquivo, então o usuário pode confirmar da forma que está.
	- O modal deve ter os campos: Nome da música, Compositor, Arranjador, Nome do instrumento, Categorias (deve listar as criadas) e Caminho do arquivo (Deve aparecer o caminho completo do arquivo, se o usuário clicar, deve abrir um modal para selecionar o arquivo `.mus`, `.musx` e `.pdf`. Caso o usuário cancele, mante o que já estava antes).
4. Caso esteja tudo certo, é salvo no banco de dados.

! Caso a música já exista, deve salvar na música existente e não criar uma nova com o mesmo nome.

### Adicionar música (diretório):
1. Será aberto um modal para selecionar um diretório.
	1. Caso o usuário clique em cancelar ao invés de selecionar um diretório, a operação é totalmente cancelada.
	2. Caso o usuário clique em algum diretório.
		1. É feito a verificação se foi selecionando um diretório com arquivo(s) `.mus`, `.musx` e `.pdf`.
			1. Caso o diretório não tenha arquivos com essa extensão é emitido um `toast` avisando que é permitido apenas `.mus`, `.musx` e `.pdf`.
2. É extraindo do nome do arquivo o nome da música (da primeira partitura) e o instrumento (aqui já é individual), um exemplo de arquivo: "Hino Nacional - Flaute.musx".
3. Será aberto um modal com as informações, para o usuário poder alterar e confirmar.
	- Os campos no modal vem preenchido com que foi extraindo no nome do arquivo, então o usuário pode confirmar da forma que está.
	- O modal deve ter os campos: Nome da música, Compositor, Arranjador, Nome(s) do(s) instrumento(s), Categorias (deve listar as criadas) e Caminho(s) do(s) arquivo(s) (Deve aparecer o caminho completo do arquivo, se o usuário clicar, deve abrir um modal para selecionar o arquivo `.mus`, `.musx` e `.pdf`. Caso o usuário cancele, mante o que já estava antes).
4. Caso esteja tudo certo, é salvo no banco de dados.

! Caso a música já exista, deve salvar na música existente e não criar uma nova com o mesmo nome.
## Computador Cliente

### Abrindo o aplicativo:
1. Verifica se tem acesso a internet.
	1. Caso não tenha acesso a internet, emite um alerta com `toast`, avisando que as informações pode está desatualizadas e não segue o fluxo abaixo.
2. Faz uma varredura das partituras verificando se teve alguma alteração.
	1. As partituras que tiverem alteração, tem seu `status` alterado para `draft`.
3. Baixa o arquivo `DataBase.msgpack` do Google Drive.
	1. Vai descompactar em um diretório temporário, depois verifica o timestamp do `dataBaseUpdatedAt` do arquivo com o do banco local.
		1. Caso igual, o software não precisa baixar e atualizar nada. Ele está na versão recente.
		2. Caso seja diferente, o software verifica se o timestamp do arquivo é mais recente que o local. Caso seja, ele varre todas as música e procura a(s) música(s) que foram alteradas, logo em seguida baixado elas e substituindo as antigas pela atual.
		- Será procurado apenas no `Songs`, já que compacta a música com todas as partituras dentro, não sendo necessário identificar qual partitura isolada foi alterada.

### Adicionar música:
Não é permitido no cliente. Devido a ele não ter indexação de diretório, não faria sentido.

# Interface

### Header
- Logo do Score Maestro | Botões: adicionar música, adicionar arquivo, adicionar diretório, configurações

### Sidebar Esquerda
- **Biblioteca:** Todas as partituras | Favoritadas | Rascunhos ativos | Pendências ativas
- **Categorias:** Lista de categorias do usuário

### Área Principal
- Lista de músicas filtradas pela seleção da sidebar
- Pesquisa com sugestões automáticas
- Clique expande música para mostrar instrumentos
- Duplo clique abre arquivo no software padrão

#### Listagem de partituras
Ao clicar na música será expandido e mostrar uma lista de partituras/instrumentos.
- Deve trazer os intrumentos, extensão e status (`draft` - borda laranja, `pending` - borda amarela e `main` - borda verde)

### Footer
É um dos meios de comunicar com o usuário o que está sendo feito.
- Status: data/hora do último backup
- Se em progresso: barra de progresso e porcentagem

# Funcionalidades para cada versão

## Funcionalidades para v0.1 - base sólida
- [ ] Corrigir inconsistências da interface
	- [ ] Remover o `VersionPanel`.
	- [ ] Alterar de `Modificado` para `Categorias` (listar as categorias que faz parte, ex: "Harpa", "Clássica")
	- [ ] Remover os ícones de "favoritar", "adicionar partitura", "adicionar diretório" e "editar", passar tudo para um "overflow menu" com essas opções (com ícone de "...")
	- [ ] Adicionar "overflow menu", no momento deixar apenas a opção "teste", ao clicar vai ter um `toast` com a mensagem "testado".
- [ ] Atualizar estrutura do banco
- [ ] Criar camada de validação
- [ ] Revisar adicionar música/partitura
- [ ] Revisar atualizar música
- [ ] Revisar favoritos
- [ ] Adicionar sistema de log

## Funcionalidades para v0.2 - funcionamento local completo
- [ ] Detectar alteração de arquivos (notify)
- [ ] Implementar fluxo `draft` → `main`
- [ ] Adicionar função para listar todos os rascunhos ativos
- [ ] Adicionar testes
- [ ] Adicionar suporte Cliente/Servidor

## Funcionalidades para v0.3 - sincronização offline-ready
- [ ] Deletar partitura  
- [ ] Criar MessagePack  
- [ ] Ler e comparar MessagePack  
- [ ] Versionamento do schema  
- [ ] Testes

## Funcionalidades para v0.4 - cloud
- [ ] Integração com Google Drive
- [ ] Adicionar função para listar todas as pendências
- [ ] Tratamento de falhas
- [ ] Testes

## Funcionalidades para v2 (apenas rascunho/ideias)

- Backup utilizando pendrive ou outro meio local.