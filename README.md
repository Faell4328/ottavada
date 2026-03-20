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
	- Faz o backup para o Google Drive, mas, ele precisa ser autorizado pelo servidor.
- **Draft:** rascunho automático quando arquivo é alterado (não é feito o backup no Google Drive)
- **Not Found**: partitura não encontrada (pode ter sido deletada ou renomeada)

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

- Não alterar o diretório e/ou arquivos do usuário sem a autorização direta dele.
	- A ideia é simples, se o usuário não gostar, ele pode voltar ao método antigo sem dor de cabeça.
- Os computadores não se comunicam entre si (diretamente).
- Controle de concorrência não é necessário, já que não vai ser feito alterações toda hora de todo lugar.
-  Não é necessário criptografar a API key do Google Drive, já que vai ser utilizado em computadores domésticos e não em servidores expostos na internet.
- Não é necessário ter um controle de histórico. Ao menos não nas versões iniciais.
- Informações da API key do Google Drive, deve ficar salva em `tauri-plugin-store`.
- Caso aja conflito entre cliente e servidor (que é improvável, porque é pouco provável ambos fazerem alterações ao mesmo tempo). A preferência será o Servidor, descartando as alterações do Cliente.
- Não será utilizado hash, devido a dificuldade de atualizar um arquivo no finale 14, é praticamente impossível "salvar sem querer". Então no momento não é necessário essa complicação. Sendo utilizado apenas a data e hora para saber que o arquivo foi alterado ou não.
- O diretório local onde é baixado as informações é no `/user/score-maestro`.
- Ao baixar os arquivos do Google Drive ele viram compactados, ao dar duplo clique em uma partitura de alguma música, ela deve ser descompactada em um diretório temporário do Sistema Operacional `C:\Users\<user>\AppData\Local\Temp`.
- Tanto a varredura, quanto o update e download, deve ser feito em thread separada. Para não interferir no funcionamento dos outros componentes.
- O computador deve fazer a verificação de alteração sempre quando ligar e quando o usuário clicar no botão.
- O `logs` deve ser salvo no mesmo diretório onde o `tauri-plugin-store` salva por padrão (`C:\Users\<seu-usuario>\AppData\Roaming\<nome-do-app>\`).
- O update no Google Drive deve ser dessa forma: comprimir com o nome: `database.msgpack.xz.tmp` e depois renomear para `database.msgpack.xz` (no Google Drive), o mesmo vale para as partituras. Objetivo é evitar arquivos corrompidos.

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
  // Versão do shema
  "schemaVersion": 1,
  // Quando foi gerado
  "updatedAt": 1710684000,
  // Lista as músicas
  "songs": [
    {
      "id": "abc123",
      "name": "Nome música",
      "composer": "Nome compositor",
      "arranger": "Nome arranjador",
      "categoriesId": ["Categoria 1", "Categoria 2"],
      "status": "main",
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
      "changeLists": [
	    {
	      "id": "fjadkslfj",
	      "entityType": "song",
	      "entityId": "abc123",
	      "createdBy": "computerId",
	      "createdAt": 1710685000,
	      "status": "pending",
	      "changes": [
	        {
	          "field": "name",
	          "oldValue": "Nome antigo",
	          "newValue": "Nome novo"
	        }
	      ]
	    }
	  ]
    }
  ]
}
```
## Banco de dados

### Categories
- `id`
- `name`

### Categories_Songs
- `id`
- `categoryId`
- `songsId`
! É uma relação N:N.

### Songs
- `id`
- `name`
- `composer`
- `arranger`
- `status` - `draft`, `pending`, `not found` e `main`.
- `isFavorite` - booleano
- `updatedAt` - última alteração da música (sempre que um `score` é atualizando, ele atualiza aqui também). Objetivo é agiliza a comparação com o `MessagePack` no Google Drive.
- `updatedBy` - quem atualizou por último.

### Directory
- `id`
- `pathName`
! É uma relação 1:N.

### Scores
- `id`
- `songId`
- `name`
- `hostId` - computador que contém o arquivo original monitorado
- `directoryId`
- `fileName`
- `fileModifiedAt` - última alteração no arquivo
- `fileSize` - tamanho do arquivo  (um inteiro que significa a quantidade de bytes)
- `status` - `draft`, `pending`, `not found` e `main`.
- `updatedBy` - quem atualizou por último.

! A junção de `directory` + `fineName` é um único.

### changeList  
- `id`
- `entityType` - o que foi alterado, ex: `song`, `score` e etc.
- `entityId` - id do elemento que foi alterado
- `status` - "pendding" (falta revisar) ou "ok" (já foi revisado).
- `createdBy` - quem alterou
- `createdAt`  - quando alterou
  
### changes
- `id`
- `changeListId`
- `field` - campo que foi alterado, ex: (`name`, `compositor`, `file` e etc)
- `oldValue`
- `newValue`
! Deve ter suporte a arquivo também.

## `tauri-plugin-store`

```json
computer: {
	"id": "lfajkdçf",
	"name": "Faell",
	"type": "Client" | "Server",
	"dataBaseLocal": 8021948012,
	"apiKey": {
		"Client ID / Secret": "Identifica a aplicação",
		"Access Token": "Token usado para acessar recursos protegidos",
		
	}
}
backupDataBaseStep: {
	"status": "pending" || "compressed" || "ok" || "error",
	"updatedAt": timestamp
}
backupSongsStep: [
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
A ser desenvolvido

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
- Deve trazer os intrumentos, extensão e status (`draft` - borda laranja, `pending` - borda amarela, `main` - borda verde, `not found` - borda vermelha)

### Footer
É um dos meios de comunicar com o usuário o que está sendo feito. Ele deve ser sempre visível.
- Status: data/hora do último backup
- Se em progresso: barra de progresso e porcentagem

# Funcionalidades para cada versão

## Funcionalidades para v0.1 - base sólida
- [x] Corrigir inconsistências da interface
	- [x] Remover o `VersionPanel`.
	- [x] Alterar de `Modificado` para `Categorias` (listar as categorias que faz parte, ex: "Harpa", "Clássica")
	- [x] Remover os ícones de "favoritar", "adicionar partitura", "adicionar diretório" e "editar", passar tudo para um "overflow menu" com essas opções (com ícone de "...")
	- [x] Adicionar "overflow menu" na partitura/instrumento, no momento deixar apenas a opção "teste", ao clicar vai ter um `toast` com a mensagem "testado".
	- [x] Remover o efeito de seleção ao clicar em alguma partitura/instrumento dentro da música.
- [x] Atualizar estrutura do banco
- [x] Revisar adicionar música/partitura
- [x] Revisar atualizar música
- [x] Revisar favoritos
- [x] Verificar dependências do projeto (se tem alguma não utilizada e se tem todas instaladas)
- [x] Adicionar sistema de log
	- [x] Garantir que está salvando o `C:\Users\<seu-usuario>\AppData\Roaming\<nome-do-app>\`
- [x] Deletar música e partitura  (apenas no programa).
	- [x] O programa deve abrir um modal de confirmação (igual para alterar o status da partitura).

## Funcionalidades para v0.2 - funcionamento local completo
- [x] Mudar as informações do sistema do banco de dados para o `tauri-plugin-store`
- [x] Implementar a função para detectar alteração no arquivo
	- [x] Implementar no Rust
	- [x] Implementar no Front
	- [x] Testar
- [x] Implementar fluxo `draft` → `main`
	- [x] No overflow menu das partituras, deve ter a opção (Definir como `main` - aparecer e funcionar apenas se tiver `draft`). Ao clicar deve abrir um modal de confirmação, "você realmente deseja mudar o arquivo para `main`?"
	- [x] Também no overflow menu das partituras deve ter a opção (Definir como `draft` - aparecer e funcionar apenas se tiver como `main`). Ao clicar deve abrir um modal de confirmação, "você realmente deseja mudar o arquivo para `draft`?"
- [x] Adicionar função para listar todos os rascunhos ativos
- [x] Refatoração e adicionar testes
	- [x] Refatorar e adicionar teste no front
	- [x] Refatorar e adicionar teste no back
- [x] Atualizar o banco de dados (back e front), adicionando a tabela de `directory`
- [x] Adicionar o status e funcionalidade do `not found`
- [x] Adicione "Partituras não encontradas" na Sidebar.
- [x] Atualizar banco de dados, para ficar igual o documento. Também atualize o `tauri-plugin-store`.
- [x] Adicione um bloquei para que o usuário não fique clicando várias vezes em "verificar alterações".
- [x] Adicionar suporte Cliente/Servidor
	- [x] Atualizar o `tauri-plugin-store` adicionando o `type`. 
	- [x] Atualizar página de primeiro acesso (é preciso adicionar a opção para o usuário escolher entre "Cliente" e "Servidor"). Coloque um textinho orientando o que cada um faz.
	- [x] Adicione nas configurações a opção para alterar (quando for marcada deve pedi confirmação, tipo para deletar uma partitura).
	- [x] Implementar restrições (toda restrição deve ser implementada no front e back).
		- [x] Não permitir que o cliente adicione música diretamente (adicionar nova música, adicionar arquivo e indexar diretório).
		- [x] Não permitir que o cliente delete uma partitura.
		- [x] Não permitir que o cliente muda o status da partitura.
		- [x] Alterar o status para `pending`.
			- [x] Caso o Cliente altere informações da música, a música deve ficar com status de `pending`.
			- [x] Caso o Cliente altere informação da partitura, a música deve ficar com status de `pending`.
			- [x] Caso o Cliente adicione uma categoria não é necessário atualizar, mas caso ele mude a categoria ou adicione uma nova categoria a uma música, a música deve ficar com status `pending`.
		- [x] Adicionar alterações nas tabelas de alterações.
		- Um detalhe importante, quando for arquivo, não vai ter `oldValue` e `newValue`, vai ter apenas `field` com o valor `file`.
	- [x] O botão de "verificar alterações" no Cliente, deve ter o comportamento diferente. No Servidor ele busca nos diretórios e depois vai buscar no Drive (não implementado), no Cliente é apenas no Drive (não implementando).
- [x] Adicionar modal para confirmar alteração de tipo do computador.
- Em hipótese alguma deve alterar antes do usuário confirmar no modal.
- Deve ser um modal e não um confirm genérico.
- Para a pessoa mudar, ela precisa esperar 5 segundos (botão desativado com contagem de tempo).
- O modal deve transmitir o impactado da mudança, tendo uma grande exclamação no topo.
- [ ] Refatoração
	- [ ] Refatorar front
	- [ ] Refatorar back

## Funcionalidades para v0.3 - cloud
- [ ] Criar MessagePack com base nas informações do banco de dados.
- [ ] Integração com Google Drive
- [ ] Implementar função para leitura e comparação do que mudou do MessagePack que outro enviou.
- [ ] Atualizar o "Siderbar":
	- [ ] Adicionar o campo de "pendente revisão".
	- [ ] Ao clicar deve listar de forma organizar e por música, todas as alterações feitas e por quem.
	- [ ] A opções "rascunhos ativos", "partituras não encontras" e "pendente revisão" deve aparecer apenas para o computador com `type` de servidor e não cliente.
- [ ] Tratamento de falhas
- [ ] Testes

## Funcionalidade para v0.4 - colete de balas
- [ ] Testar massivamente e corrigir qualquer problema relacionado a adição de música e partituras.
- [ ] Testar massivamente e corrigir qualquer problema relacionado a detecção de arquivos modificados.
- [ ] Testar massivamente e corrigir qualquer problema relacionado a backup (todas as etapas).
- [ ] Testar massivamente os possíveis e altamente prováveis problemas entre Cliente e Servidor.
- [ ] Adicionar um diretório de backup para os arquivos `MessagePack`.

## Funcionalidades para v2 (apenas rascunho/ideias)

- Backup utilizando pendrive ou outro meio local.

# Anotações

19-03-2026 - Estava cogitando utilizando o `notify`, mas, ele vai dar mais problema que benefício. Então estou buscando uma alternativa melhor e mais robusta.
Solução:
- Será criado outra tabela chamado "diretório", ao invés de salvar o caminho completo do arquivo, será salvo apenas o nome e a extensão do arquivo, e o caminho será salvo nessa tabela.
- Esse problema não vai trazer otimizações significativas, mas vai trazer mais clareza e organização. Usando uma paginação por diretórios e ficando mais claro até para o usuário, ex: `analizando diretório: /musica/joel amarim`, também é bom para logs e debug.
- Com isso a verificação será feita "manualmente", comparando o "size + timestamp" dos arquivos no diretório para ver se teve alteração ou não.
- Caso seja encontrado um arquivo no diretório que não está no banco de dados, ele deve ser ignorado (pula).

20-03-2026 - Estou com dúvida em como integrar o Cliente e Servidor na aplicação. Não sei como vai ser o fluxo, o banco de dados e etc.
- A ideia é simples: o cliente altera, o sistema deve marcar que foi alterado. Vou partir do principio de confiança, já que é um software local e que pessoas leigas iram utilizar.
- Solução:
	- Criar um tabela para as alterações. Nessa tabela deve ter as informações antigas e novas.
	- Com base nisso, vai ter um modal ou página, que vai listar todas as alterações pendentes (para servidor) que foi feita pelo cliente, ele vai aprovar ou recusar.
	- Os que foram aprovados são aplicados na tabela definitiva, os que são recusados vão ser descartados.
	- Caso seja um arquivo, deve ter a opção para o usuário clicar para ver o original e o alterado.
- ! Atenção: Quando a alteração (`field`) for  `file`, preciso tomar cuidado e elaborar um bom plano para que não dê conflito ou fique desorganizado. 

20-03-2026 - Problemas futuros que preciso ter resolvido ou pensando em uma solução para resolver.
- Alterações grandes no banco dados.
- Alterações grande no shema (MessagePack).
- Melhor resolução de conflitos (vários computadores atualizando ao mesmo tempo)