Para a organização (orquestra) que estou em mente que estou desenvolvendo o software, possui o seguinte cenário: 
- 1 computador na Igreja (utilizando no ensaio), utilizando para consultar e tirar copia, e raramente faz alterações diretamente nele.
- 1 computador na Casa do Maestro, utilizado para fazer alteração nas partituras e as vezes tirar copia.

! Irei resolver esse caso especifico até a versão v1, depois, posso tentar expandir.

# Documentação velha - Apenas anotação
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
- [x] Refatoração
	- [x] Refatorar front
	- [x] Refatorar back

## Funcionalidades para v0.3 - cloud
- [x] Criar MessagePack com base nas informações do banco de dados.
- [x] Atualizar na página de primeiro acesso.
	- [x] Remover a solicitação do arquivo json do Accout Service.
	- [x] Adicionar no lugar a pagina de configuração do rclone.
	- [x] Deve ter um botão de "fazer teste", onde será gerado um arquivo no diretório do `tauri-plugin-store`, dentro de (`/{tauri-plugin-store}/nuvem`): `nuvem/`. Esse arquivo é um .txt que vai ter o conteúdo "Upload feito com sucesso". Ao clicar no botão será executado a criação e o upload do arquivo.
- [x] Atualizar a página de configurações.
	- [x] Adicione um botão de "testar rclone", com objetivo de testar se o rclone está funcionando. O teste deve ser o mesmo que no primeiro acesso.
- [x] Atualizar para os arquivos `msgpack.zst` será gerado dentro do diretório `/nuvem`
- [x] Atualizar estrutura do `tauri-plugin-store`.
- [x] Salvar as informações digitadas na página de primeiro acesso. No path o default deve ser "ScoreMaestro", a pessoa pode alterar o valor do input se quiser, mas será preenchido com isso.
- [x] Atualizar as configurações para buscar as informações do `tauri-plugin-store`.
- [x] Implementar o rclone para fazer upload ao Google Drive.
- [x] Atualize a estrutura do `database.msgpack` gerado.
- [x] Verificar se os campos de data estão sendo devidamente atualizado.
- [x] Atualizar o banco de dados para implementar uma tabela nova.
- [ ] Remover o `main` para `draft` do overflow menu.
- [ ] Atualizar o banco de dados e verificar se está correto o tauri-plugin-store.
- [ ] Atualizar o "verificar alterações".
! Deve mostrar no `statusBar` todo o progresso e etapas que está sendo feito.
- [ ] Implementar função para leitura e comparação do que mudou do MessagePack que outro enviou.
- [ ] Atualizar o "Siderbar":
- [ ] Adicionar o campo de "pendente revisão".
- [ ] Ao clicar deve listar de forma organizar e por música, todas as alterações feitas e por quem.
- [ ] A opções "rascunhos ativos", "partituras não encontras" e "pendente revisão" deve aparecer apenas para o computador com `type` de servidor e não cliente.
- [ ] Tratamento de falhas

# Documentação Nova - Apenas anotação

! Para agilizar o desenvolvimento, essa funcionalidades abaixo só serão implementadas na v1:
- O cliente pode fazer proposta de alteração.
	- O cliente até a v1, será 100% consumidor, não podendo alterar NADA.
	- O objetivo é agilizar o desenvolvimento até a v1. O fluxo de aprovação e implementação de alteração no servidor é complicado e chato.

## Etapas
- v0.4 - Casa limpa
- v0.5 - Implementando as funcionalidades
- v0.6 - Foco no `client`
- v0.7 - Lapidando
- v0.8 - Melhorias na usabilidade
- v0.9 - Backup automático, adição do `rclone` ao sistema, facilidade na troca de provedor (`koofr` ou `google drive`), correção de progresso no `StatusBar`, entre outras melhorias e correções.
- v0.10 - Melhorias e correções que foram encontradas, durante uso e testes massivos
- v1.0 - Adição de licença e telemetria.
## v0.4
- [x] Atualizar bando de dados
- [x] Atualizar `tauri-plugin-store`
- [x] Corrigir o código que utiliza o banco de dados e `tauri-plugin-store`
- [x] Corrigir os fluxos existentes
- [x] Refatorar o código e valide os teste
- [x] Atualiza o front, altere: "Todas as Partituras" para "Todas as Músicas", quantidade de partituras para quantidade de música e "Nenhuma partitura encontrada" para "Nenhuma música encontrada"

## v0.5
- [x] Adicionar a geração dos arquivos `{songId}.tar.zst`.
- [x] Adicionar a função de `changedField` em todos os fluxos necessário (ex: adicionar música, partitura, editar, deletar, mudar status e etc e etc)
- [x] Adicionar a geração de `events.msgpack`.
- [x] Adicionar a geração de  `snapshot.msgpack`.
	- [x] Adicionar botão para forçar a geração do `snapthost.msgpack` (configurações).
! Ao força a geração do `snapshot.msgpack` ele deve só ignorar a regra do 2MB (forçando a geração).
- [x] Adicionar o `backup.msgpack`.
	- [x] Adicionar botão para exportar o `backup.msgpack` (configurações)
	- [x] Adicionar botão para importar o `backup.msgpack` (configurações)
- [x] Refatorar o front e back.

## v0.6
- [x] Sincronização do rclone na Nuvem
- [x] Consultar e implementar as alterações do servidor no cliente
- [x] Corrigir cliente
	- [x] Não é para aparecer os opções no overflow menu e tirar essa merda de texto: "não permitido para cliente"
	- [x] Adicionar fluxo para abrir a partitura localmente, como especificado
- [x] Limpar o diretório `/tmp` ao iniciar o aplicativo
- [x] Corrigir o problema e estar enviado partitura "not found" para a nuvem
	- [x] Removendo o registro do evento "not found" no "changedField"
- [x] Corrigindo o problema de estar enviando partitura "draft" para a nuvem

## v0.7
- [x] Quando clicar em "verificar alterações" e não tiver internet, deve emitir um toast avisando.
- [x] Corrigir problema de não deletar o arquivo de partitura ao deletar a música/partituras no aplicativo.
- [x] Corrigir problema de não gerar o `{songId}.tar.zst` ao deletar uma partitura da música.
- [x] Ajustes
	- [x] Remover a opção "adicionar diretório" no overflow menu de uma música.
	- [x] Regerar o `{songId}.tar.zst` quando uma nova partitura for adicionada a música.
	- [x] Atualizar a lista da música quando uma nova partitura for adicionada a música.
- [x] Reduza a quantidade de toast do "verificar alterações". Principalmente no servidor que fala quantos eventos foram adicionados. Deixe apenas os toast importantes
- [x] Arrumar o testar rclone na página de primeiro acesso e configurações, para que seja assíncrono.
- [x] Atualizar o banco de dados, eventos e extensão do cliente.
	- [x] Adicionar extensão no cliente, está como default `.score` (o que está horrível). Mostrar a extensão real.
- [x] Tirar a opção offline na página de primeiro acesso e no back.
- [x] Arrumar o diretório temporário não é `/cloud/tmp` é `/tmp`, igual na documentação.
! Se não for dessa forma vai arquivo temporário para o cliente.
- [x] Arrumar a geração de snapshot (não está gerado)
	- [x] Verificar se está forçando o cliente a implementar o snapshot, igual a documentação
- [x] Ordenar tanto o servidor e cliente em ordem alfabetica (música e partitura)
- [x] Refatorar o front e back
	- [x] Mostrando o progresso de upload e download
	- [x] Melhorando o rclone e a compressão (`tar.zst`) e outras melhorias
	- [x] Corrigindo problema de nome truncado ao adicionar música com partitura
	- [x] Melhorando o `StatusBar`.
- [x] Mais refatoração
- [x] Forçando a regerar os arquivos `{songId}.tar.zst` ao "importar database" e "força snaphost"
- [x] Melhorando a sincronização do servidor com a nuvem

## v0.8
- [x] Arrumar bug no windows. Ao adicionar uma música com diretório, ele mostra do arquivo, ex: "VIVALDE TIME - Alto Sax 1.musx" e abaixo mostra o diretório, ex: "/home/rhafa/Documents/arranjo Lopes/PEÇAS CLASSÍCAS/VIVALDE TIME". No windows isso não está funcionando. Ambos estão com o mesmo texto.
- [x] Aumentar o tamanho do ícone do aplicativo (ocupando todo o espaço).
- [x] Mudar a mensagem do botão de "verificar alteração" para "aplicar alterações", apenas no servidor. Mantendo como estava no cliente.
- [x] Onde for um elemento clicável ou interativo, deve mudar o cursor.
- [x] Adicionar uma modal de confirmação avisado o usuário para "aplicar alterações" antes de fechar. Apenas se o usuário tiver criado um evento (adicionando, alterando ou deletando algo).
- [x] Corrigir o "força geração de snapshot". Após o fluxo normal, ele deve chamar o "aplicar alterações".
- [x] Padronizar os nomes
	- [x] Padronizar a formatação do nome da música (tudo em maiúsculo). Quando o usuário digitar, deve ser escrito em maiúsculo (mesmo com CAPS desligado), na adição da música com partitura, edição do nome, na hora que extrai o nome do arquivo e etc..
	- [x] Padroniza a formatação dos nomes das partituras/instrumentos (permitido número apenas após o nome, ex: `flute 1` e não `0001 flute1`). Quando o usuário digitar, deve ser escrito em minúsculo (mesmo com CAPS ligado), na adição da música com partitura, edição do nome, na hora que extrai o nome do arquivo e etc.
- [x] O nome da música deve ser pego do diretório mãe do arquivo e não do arquivo. Já o nome das partituras/instrumentos sim, ex: Eis o nosso deus - Flute, fica apenas "Flute".
- [x] Não adicionar partituras de subdiretórios (ex: cliquei para "adicionar diretório" e selecione a música "FIEL É DEUS", dentro dele tem outro diretório chamado "HINO 08). Não é para adicionar arquivos de subdiretórios ao diretórios escolhido.
- [x] As partituras/instrumentos devem seguir a seguinte ordem (tanto na listagem na música, como na revisão ao adicionar uma música):
	- Sem nome (normalmente a grade com todos os instrumentos)
	- Flute
	- Oboe
	- Bassoon
	- Clarinet Bb 1
	- Clarinet Bb 2
	- Clarinet Bb 3
	- Bass Clarinet
	- Alto Saxophone 1
	- Alto Saxophone 2
	- Tenor Saxophone
	- Baritone Saxophone
	- Trumpet Bb 1
	- Trumpet Bb 2
	- Trumpet Bb 3
	- Horn F 1
	- Horn F 2
	- Horn F 3
	- Trombone 1
	- Trombone 2
	- Trombone 3
	- Baritone (T.C.)
	- Tuba
	- Violino 1
	- Violino 2
	- Viola
	- Cello
	- Contrabass
	- Outros instrumentos (que não são convencionais, em ordem alfabética)
! Alguns não vão ter partitura/instrumento e está tudo certo, vai apenas "pular" eles. Caso seja adicionando posteriormente, deve ter essa ordem.
! Os nomes podem ser um pouco diferente, ex: Clarinet **in** Bb 1 e já outros serem como está acima.
- [x] Quando digito em um campo vazio, ele muda de posição, está errado. E outro detalhe, não consigo colocar espaço no nome (no final, quando eu volto consigo). O usuário pode deixar espaço no começo e no final (front), mas o back deve corrigir isso.
- [x] Na revisão ao adicionar "um arquivo" ou "indexar um diretório", adicionar um botão para abrir a partitura com o aplicativo padrão daquele arquivo e também adicionar um botão para "abrir local". Ter cuidado para não ficar próximo da lixeira, levando o usuário a clicar na lixeira sem querer.
- [x] Adicionar essas opções na hora de editar partitura/instrumento.
- [x] Mudar o método que é chamado o aplicativo padrão do `.mus`, `.musx` e etc, para ficar igual a como é chamado o `rclone`, objetivo é não aparece a merda de um cmd preto na tela.
- [x] Pode acontecer a música não ter esse padrão: `nome música - instrumento`, sendo `instrumento`, é necessário conseguir identificar esse cenário e arrumar.
- [x] Atualizar o StatusBar mostrar quantos "foram enviados"/"quantos faltam" e também, não fique alterando toda hora, voltando para o texto "etapa 3". Quando for a etapa de upload, mostre o texto de etapa 3 e depois fique mostrando o quanto já foi feito o upload ou download (no caso do cliente).
- [x] Quando o cliente abrir uma partitura pelo aplicativo, a partitura é descompactada e aberta em um diretório temporário, mas preciso que ela seja renomeada, para não ficar aparecendo um ID (estranho para usuário) no aplicativo de visualização de partitura. Preciso que antes de abrir, deve renomear para: `{nome da música} - {nome da partitura}`.
- [x] Gerar log para adicionar música, adicionar arquivo e adicionar partitura. Está dando erro em toast, com uma mensagem genérica, que nada ajuda.
- [x] Corrigir bug que limpada o diretório `songs` ao gerar snapshot automáticamente. Apenas o "força geração de snapshot" que limpa e recria os `songs`, o snapshot automático não deve fazer isso.
- [x] Resolver o problema: arquivo em rascunho e foi regerado o `{songId}.tar.zst`, resultado foi removido perdido o arquivo antigo em `main` ficando sem nada.
- [x] Ajuste na adição, revisão e música já existente.
	- [x] Remover a opção "adicionar arquivo" do header da página inicial.
	- [x] Ao clicar para adicionar arquivo na música, caso já exista uma música com mesmo diretório e nome, deve aparecer um toast de erro, avisando que já existe uma música com esse arquivo indexado "{nome da partitura/instrumento}" e não um erro genérico.
	- [x] Ajuste a função: "Pode acontecer a música não ter esse padrão: `nome música - instrumento`, sendo `instrumento`, é necessário conseguir identificar esse cenário e arrumar". Caso não seja um instrumento, deve ficar vazio, ex: `flauta 1 & 2` é possível identificar que é flauta, agora `EIS O NOSSO DEUS` não fala nada. Ou seja, essa regra só se aplicar se for possível identificar o instrumento, caso não seja, deve ficar vazio.
- [x] Na listagem de instrumentos, o violino não está segundo a ordem anteriormente especificada. Ele também deve suportar, português e inglês (nome).
- [x] Refatoração do front
- [x] Refatoração do back
- [x] Arrumar bug: no windows, ao criar uma música e clicar para "adicionar arquivo", depois selecionar o arquivo, não é feito absolutamente nada.
- [x] Procurar outros possíveis bugs do mesmo padrão e corrigir.
- [x] Arrumar bug: quando rodar o fluxo "Listar partituras `draft` e `not found` que possuem versão anterior `main`". As partituras que forem `draft` e `not found` e não tiverem uma `main`anterior, deve ficar com `not found` no cliente (seja `event` ou `snapshot`).
- [x] Arrumar bug: Ao dar duplo clique, clicar no overflow menu para abrir uma partitura ou abrir pelo editar partitura, está abrindo um diretório nada aver. Isso ocorre apenas no servidor.
! Copiar como está no revisar (ao indexar um diretório).
- [x] Arrumar bug: Ao clicar em editar uma partitura e clicar para abrir local do arquivo, está abrindo um diretório nada aver. Isso ocorre apenas no servidor.
! Copiar como está no revisar (ao indexar um diretório).
- [x] Se não teve alteração, não é necessário executar nenhuma etapa do upload ao clicar "aplicar alterações".
- [x] Ao iniciar o aplicativo, deve fazer consultar a nuvem (apenas cliente).

## v0.9
- [x]  Ao adicionar um arquivo na música, deve aparecer um modal (igual ao indexar diretório), mas com o diferencial: o nome da música não pode ser alterado (fica no input text, mas apenas `onlyread`), permitindo o usuário alterar nome da partitura/instrumento, abrir partitura e abrir local.

- [x] Adicionar função para o cliente favoritar uma música via menu overflow da música.
- [x] Remover as bibliotecas que não são utilizadas no projeto.
- [x] Atualizar o `tauri-plugin-store` com o novo campo.


- [x] Corrigindo o StatusBar, não está mostrando progresso real (internet lenta).
- [x] Quando o aplicativo estiver fazendo alguma procura na nuvem, quando o aplicativo for fechado o rclone deve parar a execução.
	! O rclone continua a execução, com isso se a pessoa fechar e abri o aplicativo, não irá conseguir utilizar o rclone no aplicativo.
- [x] Corrigindo o `snapshot` gerado automaticamente para não apagar o `cloud/songs/`.

- [x] Alterar o "exportar database.msgpack" para "exportar backup local".
- [x] Alterar o "importar dabase.msgpack" para "importar backup local".
	- [x] Ao importar, deve aparecer um toast avisando que "foi importando com sucesso e o backup é da data de xxx e hora yyy, alterações posteriores a isso não são inclusas" (melhorar essa mensagem, mas será esse padrão). O toast deve ficar uns 8 segundos.
	- [x] Ao finalizar a importação ele deve "força a geração de um snapshot".
- [x] Gerar `backup.msgpack` (automático) a cada três dias e fazer o upload para o cloud. O objetivo é garantir em caso de perda total por algum motivo, o usuário não tenha que colocar TUDO novamente.
	! A verificação é feita quando o aplicativo é iniciado e é feito a sincronização, para o cloud, apenas do diretório `cloud/backup`. Para não sincronizar os outros diretórios e ser mais rápido.
	! Seguir praticamente o mesmo fluxo do "exportar database.msgpack" nas configurações.
- [x] Adicionar nas configurações um botão para "importar backup cloud"
	- [x] Ao importar, deve aparecer um toast avisando que foi importando com sucesso e o backup é da data de xxx. O toast deve ficar uns 8 segundos.
	! Seguir praticamente o mesmo fluxo do "importar database.msgpack" nas configurações.
- [x] Adicionar nas configurações um botão para "exportar backup cloud"
	! Ele deve atualizar no `tauri-plugin-store` o campo responsável pelo timestamp do último backup na nuvem.
- [x] Adicionar validação de integridade em ambos os métodos de exportação (local e cloud). Para garantir que na hora que o usuário precisar não vai ter arquivo corrompido.

**rclone**
- [x] Implementar o `rclone` ao projeto, `/src-tauri/bin/rclone.exe`.
- [x] Adicionar nas configurações um campo chamado "Sobre".
	- [x] Adicionar nesse campo o texto: "Este software utiliza rclone (licença MIT)". Ao clicar deve abrir a licença completa. Caso o usuário parar o mouse sobre ele, irá aparecer "abrir licença". Deve ter um estilização de link (bonito).
	- [x] A licença deve abrir em um modal com o texto da licença.

- [x] Ajustando página de primeiro acesso, etapa de "Configure o Rclone".
	- [x] Atualize o texto do primeiro acesso, não é necessário mais baixar o rclone.
	- [x] Antes do usuário testar o rclone, o usuário deve escolher o campo "provedor de nuvem". Sendo "koofr" e "google drive", sendo o "koofr" marcado por padrão. Deve ter um texto descrevendo, avisando que o koofr e o google drive, tendo um texto em cima do "koofr": "recomendado".
	- Na parte de baixo deve ter as configurações, refletindo a opção escolhida:
	- [x] Koofr - O usuário precisa adicionar as credências do "koofr" (`https://app.koofr.net/`), solicitando a senha do aplicativo criada no site (`rclone obscure "SUA_SENHA"` e depois `rclone --config ./rclone.conf config create meuKoofr koofr user=email password=senha_obscure`, precisa ajustar o caminho do config igual na documentação)
	- [x] Google Drive - O usuário precisar autenticar via navegador web (`rclone --config ./rclone.conf authorize "drive"` e depois `rclone --config ./rclone.conf config create meuDrive drive token='JSON_AQUI'`, precisa ajustar o caminho do config igual na documentação).
	! Depois disso, deve ir para etapa de teste (igual o fluxo normal)
	! O usuário não pode mais colocar nome e nem o caminho, será padrão: GoogleDrive é `gdrive` e Koofr é `koofr`, o caminho será: `ScoreMaestro`.
- [x] Ajustar também as configurações.
- [x] Migrar do "rclone do sistema operacional" para o "rclone do projeto". O binário está em: `src-tauri/bin/rclone.exe`. Para chamar é necessário: `rclone --config /caminho/do/seu/rclone.conf ...`, precisa ajustar o caminho do config igual na documentação.

## v0.10

**Melhorias**
- [x] Mudar o carregamento das partituras na página inicial. Listar apenas as músicas, carregar a partitura apenas quando for clicado para expandir a música. Quando for fechada, deve ser descartado a lista de partituras da música fechada.
	- Eu realizei teste e adicionei em torno de 290 músicas, quer seria 40 a 45% de todas as músicas da orquestra. Com apenas essa quantidade, ao mover o cursor rapidamente, senti uma lerdeza e até bugs visuais para renderizar tudo (mesmo não mostrando).
- [x] Adicionar uma barreira para o usuário não adicionar novas música, mexer em configurações ou editar alguma informação de música, partitura e etc.
	- Limitando o cliente no backend.
	- E boqueando o usuário quando clica para: "aplicar alterações", "verificar alterações", "forçar geração de snapshot". Para por exemplo: o usuário não adicione uma música enquanto o sistema está fazendo upload, o que pode quebrar ou causar inconsistências.
		- É evidente, que o correto é o sistema permitir isso, mas não tenho tempo para fazer o correto, isso ficara para próximas versões. No atual momento, minhas escolha é a "gambiarra".
- [x] Quando o usuário expande uma música, a lista deve rolar para que a linha da música fique alinhada ao topo da área de listagem (visível logo abaixo do header), exceto se já estiver visível no topo ou não for possível.
	- O problema atual: quando se tem aberto uma música com muitas partituras e é aberto uma música com poucas, o usuário pode ficar perdido, porque a música e partituras foi para cima.
- [x] Não está sendo pegado o nome de todos as partituras/instrumentos, que ficam depois do "-", ex: `298H.C. AVANTE SERVO DE JEOVA - Bass Guitar.mus`. Como é um instrumentos não listado, deve fica após os listados em ordem alfabética.
- [x] Padronizar a duração de todos os toast para 8 segundos.
- [x] Tratamento especial quando a música e/ou partitura existir, valendo tanto para o "adicionar música", "indexar diretório" e "adicionar arquivo" (na música):
	- Música já existe:
	- [x] Deve aparecer uma mensagem acima do nome: "Essa música já existe em seu repertorio".
	- [x] Não deve ser possível alterar o nome da música (sendo readonly).
	- [x] No caso de "adicionar música", o botão de salvar deve ficar desativado.
	- [x] No caso de "indexar diretório", não deve aparecer para adicionar compositor, arranjador e categorias.
	- Partitura já existe:
	- [x] Deve aparecer uma mensagem acima do nome: "Essa partitura já foi adicionada".
	- [x] Não deve ser possível alterar o nome da partitura (sendo readonly).
	- [x] Não deve ser possível deletar a partitura.
	- [x] No caso de "adicionar arquivo", o botão de salvar deve estar desativado.
	- Toast:
	- [x] O toast deve aparecer apenas a quantidade de partituras realmente adicionadas e não total.
	- Outras;
	- [x] No caso de "indexar diretório", se a música já existir e todas as partituras existirem também, o botão de salvar deve ficar desativado.
- [x] Muda texto para "selecionar arquivo(s)" no overflow menu, permitir também o usuário escolher 1 ou mais arquivos.
- [x] Ao editar informação da música, não precisa abrir para mostrar as partituras/instrumentos.
- [x] Ao selecionar uma categoria de SideBar, ao adicionar uma música ou indexar ele já deve vir com a categoria marcada por padrão.
- [x] Ao trocar de provedor ou de conta com sucesso nas configurações, executar o fluxo de força snapshot.
- [x] Retirar toast duplicado ao configurar e testar provedor no primeiro acesso.
- [x] Ao iniciar o aplicativo (servidor), deve iniciar fluxo de "aplicar alterações"
- [x] Adicionar uma categoria default, que é a categoria "Sem categoria", quando uma música não possui categoria, ela virá para essa categoria.
- [x] Caso o nome da música possua número, ex: 1, 2, 3, 4, 5, 6, 7, 8 e 9, adicionar um 0 antes, ex: 01, 02, 03, 04, 05, 06, 07, 08 e 09.
- [x] Adicionar nas configurações/Sobre a quantidade de músicas e partituras (separadas por: main, pedding e not foud).
	- [x] Ter cache no `tauri-plugin-store`, para não ter que ficar recalculando tudo.
- [x] Arrumar a ordenação das músicas, está ficando bugada quando o nome tem algum sinal na letra.
- [x] As músicas e partituras `pedding` não está sendo listados corretamente nas configurações.
- [x] Se a música tiver aberta e for clicado em "aplicar alterações" e "consultar alterações" deve atualizar as partituras abertas. Também quando alguma informação da partitura, ex: nome e etc.
- [x] Atualizar bloqueio das partitura assim que sair a etapa de "aplicar alterações", para não ter que fechar e abrir a música.

**Correção**
- [x] Quando estou com uma música aberta e clico para abrir outra, as vezes ocorre da música ficar sem partitura (sendo que ela tem), precisando abrir e fechar novamente para aparecer.
- [x] A aplicação trava ao "importa backup local" e possivelmente da nuvem também.
- [x] Quando está sendo feito o upload dos arquivos no servidor, o aplicativo é fechado e aberto novamente, não se dá continuidade ao upload. Isso funcionava anteriormente.
- [ ] Arrumar barra de pesquisa
	- [ ] Não ir mostrando as possíveis música, deve ir filtrando na página Home a medida que é digitado. Removendo a sugestão que tinha antes.
	- [ ] A pesquisa deve ser com referência onde o usuário está, na categoria especifica, em todas as música, favoritas e etc.

**Tenho que pensar mais um pouco**
- [ ] Aumentar a quantidade de `transfers` no `rclone` sem quebrar o StatusBar.

## v1.0
- [ ] Montar um plano para atualizar o software.
- [ ] Montar um manual para o usuário, explicando cada detalhe do software para que ele consiga utilizar com o máximo de tranquilidade.
- [ ] Criar licença (por organização/computadores)
- [ ] Criar telemetria (quantas músicas, partituras, tempo de uso, versão atual e etc).
- [ ] Adicionar instruções nas configurações, informando o que cada um faz.
	- Deve ter uma estilização diferente, para que o usuário entenda que é uma explicação.

## Funcionalidades para v2 (apenas rascunho/ideias)

- Tirar o cliente de `read-only`.
- Backup utilizando pendrive ou outro meio local.
- Baixar backup da nuvem.
	! A ideia dessa funcionalidade é o seguinte. Por algum motivo, o usuário deletou os arquivos ou está em um novo computador, ele pode baixar todos os arquivos na nuvem para sua máquina.
	! Evidentemente que partituras com `draft` ou que não possuem partitura sem versão `main`, não são possíveis de baixar.
- Adicionar uma camada de cibersegurança.
	- No começo, ele será utilizado em uma orquestra local (onde sou o único com conhecimento em informática). Mas futuramente esse software pode abranger outras organizações.
- Possível adição de um novo `type` de computador `semi-server`.
- Embutir o `rclone` no projeto: `/src-tauri/bin/rclone.exe`.
- Implementar hash de verificação de arquivos.