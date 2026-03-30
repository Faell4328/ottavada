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
- [ ] Testes

# Documentação Nova - Apenas anotação

! Para agilizar o desenvolvimento, essa funcionalidades abaixo só serão implementadas na v1:
- O cliente pode fazer proposta de alteração.
	- O cliente até a v1, será 100% consumidor, não podendo alterar NADA.
	- O objetivo é agilizar o desenvolvimento até a v1. O fluxo de aprovação e implementação de alteração no servidor é complicado e chato.

## Etapas
- v0.4 - Casa limpa
	- O objetivo dessa versão é "limpar a casa".
	- Corrigir tudo que está errado ou obsoleto.

## v0.4
- [x] Atualizar bando de dados
- [x] Atualizar `tauri-plugin-store`
- [x] Corrigir o código que utiliza o banco de dados e `tauri-plugin-store`
- [x] Corrigir os fluxos existentes
- [ ] Refatorar o código e valide os teste
- [x] Atualiza o front, altere: "Todas as Partituras" para "Todas as Músicas", quantidade de partituras para quantidade de música e "Nenhuma partitura encontrada" para "Nenhuma música encontrada"

## v0.5
- [ ] Adicionar a função de `changedField`

## Funcionalidades para v2 (apenas rascunho/ideias)

- Tirar o cliente de `read-only`.
- Backup utilizando pendrive ou outro meio local.
- Adicionar uma camada de cibersegurança.
	- No começo, ele será utilizado em uma orquestra local (onde sou o único com conhecimento em informática). Mas futuramente esse software pode abranger outras organizações.
- Suporte a vários servidores (no momento o recomendado é ter apenas um)
- Adicionar snapshot do banco de dados e remover os arquivos de events.
	- Simplificando a sincronização de computadores novos
	- Reduzir a quantidade de arquivos `{computerId}_{sequence}.msgpack`.
- Possível adição de um novo `type` de computador `semi-server`.
- Embutir o `rclone` no projeto: `/src-tauri/bin/rclone.exe`