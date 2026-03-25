# Observações

- Os arquivos com as partituras em `.tar.zst` possuem em média 1MB e compressão e descompressão é quase instantânea.

---

**19-03-2026** - Estava cogitando utilizando o `notify`, mas, ele vai dar mais problema que benefício. Então estou buscando uma alternativa melhor e mais robusta.
Solução:
- Será criado outra tabela chamado "diretório", ao invés de salvar o caminho completo do arquivo, será salvo apenas o nome e a extensão do arquivo, e o caminho será salvo nessa tabela.
- Esse problema não vai trazer otimizações significativas, mas vai trazer mais clareza e organização. Usando uma paginação por diretórios e ficando mais claro até para o usuário, ex: `analizando diretório: /musica/joel amarim`, também é bom para logs e debug.
- Com isso a verificação será feita "manualmente", comparando o "size + timestamp" dos arquivos no diretório para ver se teve alteração ou não.
- Caso seja encontrado um arquivo no diretório que não está no banco de dados, ele deve ser ignorado (pula).

**20-03-2026** - Estou com dúvida em como integrar o Cliente e Servidor na aplicação. Não sei como vai ser o fluxo, o banco de dados e etc.
- A ideia é simples: o cliente altera, o sistema deve marcar que foi alterado. Vou partir do principio de confiança, já que é um software local e que pessoas leigas iram utilizar.
- Solução:
	- Criar um tabela para as alterações. Nessa tabela deve ter as informações antigas e novas.
	- Com base nisso, vai ter um modal ou página, que vai listar todas as alterações pendentes (para servidor) que foi feita pelo cliente, ele vai aprovar ou recusar.
	- Os que foram aprovados são aplicados na tabela definitiva, os que são recusados vão ser descartados.
	- Caso seja um arquivo, deve ter a opção para o usuário clicar para ver o original e o alterado.
- ! Atenção: Quando a alteração (`field`) for  `file`, preciso tomar cuidado e elaborar um bom plano para que não dê conflito ou fique desorganizado. 

**20-03-2026** - Problemas futuros que preciso ter resolvido ou pensando em uma solução para resolver.
- Alterações grandes no banco dados.
- Alterações grande no shema (MessagePack).
- Melhor resolução de conflitos (vários computadores atualizando ao mesmo tempo)

**21-03-2026** - Problema com Google Drive.
- Quebrei a cabeça ontem e hoje tentando fazer um simples update.
- Então cheguei a três possibilidades:
	1. Utilizar python de fundo com SKD.
	- Tem os seguintes problemas:
		1. Teria que ter python instalado no computador.
		2. Teria que dar manutenção (atualização e ajuste no código).
	1. Utilizar outro provedor de nuvem, pCloud.
	- Tem os seguinte problemas:
		1. Não é tão robusto e confiável como o Google Drive (padrão do mercado).
		2. Nunca utilize e não faço ideia como funciona. Aparenta ser mais simples.
	1. Utilizar rclone para tomar conta.
	- Tem o seguinte problema:
		1. Precisa ter o rclone instalado e manter atualizado.
! Minha escolha foi utilizar o rclone, devido a ter que fazer menos manutenção no código, é só simplesmente atualizar ele e pronto.
! Mas, caso eu veja que vai dar muita dor de cabeça, posso utilizar o rclone com pCloud (ou via API direto no código). Agora, minha decisão é o Google Drive, mas estarei estudando e testando o pCloud em paralelo.

23-03-2026 - Mudanças e melhorias
- 1° Alteração no banco de dados, removendo tabelas inúteis e padronizando o nome.
	- Existiam muitas tabelas e campos que faziam sentidos no começo e em minha cabeça, mas agora não fazem mais.
- 2° Alteração de `.xz` para `.zst` (zstd - Zstandard).
	- Devido ao melhor equilibro, a melhor escolha é o `Zstandard`.
- 3° Adição de fluxos detalhados.

24-03-20226 

Mudando estrategia de upload para Nuvem
- Estava pensando em só fazer upload para a Nuvem quanto todas as partituras da música fossem `main`. Mas isso pode frustar o usuário.
- Cenário: Foi feito alteração na partitura da Flauta e Tuba, a flauta foi finalizada e já pode ser utilizada dos ensaios, já a Tuba precisa de mais alterações.
- A escolha de fazer upload Nuvem apenas quando a música toda estiver como `main` é mais simples. A alternativa de ser individual por partitura é mais complexa, mas vai agregar para o usuário.

Mudando estratégia: de banco de dados completo para incrementação/alteração/remoção
- Ao invés de criar um único arquivo `database.msgpack`, que tem:
	- Risco de ser sobrescrito.
	- Demora para identificar e implementar alterações.
	- Maior complexidade para sincronização.
- Será utilizado `{computerId}.msgpack`, que fará:
	- O que foi implementado.
	- O que foi alterado.
	- O que foi deletado.