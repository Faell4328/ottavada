# "Diário"

**19-03-2026** - Estava cogitando utilizando o `notify`, mas, ele vai dar mais problema que benefício. Então estou buscando uma alternativa melhor e mais robusta.
Solução:

- Será criado outra tabela chamado "diretório", ao invés de salvar o caminho completo do arquivo, será salvo apenas o nome e a extensão do arquivo, e o caminho será salvo nessa tabela.
- Esse problema não vai trazer otimizações significativas, mas vai trazer mais clareza e organização. Usando uma paginação por diretórios e ficando mais claro até para o usuário, ex: `analisando diretório: /musica/joel amarim`, também é bom para logs e debug.
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

**23-03-2026** - Mudanças e melhorias

- 1° Alteração no banco de dados, removendo tabelas inúteis e padronizando o nome.
  - Existiam muitas tabelas e campos que faziam sentidos no começo e em minha cabeça, mas agora não fazem mais.
- 2° Alteração de `.xz` para `.zst` (zstd - Zstandard).
  - Devido ao melhor equilibro, a melhor escolha é o `Zstandard`.
- 3° Adição de fluxos detalhados.

**24-03-2026** 

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

**26-03-2026**

Problemas e problemas

- Pensei em um possível problema: "E se o `{computerId}.msgpack` virar um monstrinho de 10MB ou mais".
- Pensei em separar o `{computerId}.msgpack` em pedaços: `{computerId}_{sequence}.msgpack`, criando sempre um novo arquivo assim que ele chegar a 1MB. Mas isso com tempo iria poluir muito o diretório.
- E em ambos os casos tem o mesmo problema: Se for adicionado um novo computador, ele teria que ler todos os arquivos, aplicar evento por evento até chegar no estado igual dos outros computadores. Seria um inferno de lento e complexidade.
- Solução: `{computerId}.msgpack` e `snapshot` do banco de dados. Quando os arquivos  `{computerId}.msgpack` chegarem a um determinado tamanho, o servidor vai gerar uma `snapshot` do banco de dados atual.

**27-03-2026**

Eu me precipitei

- Deveria ter elaborado melhor meus planos. Muita das coisas que eu pensei/implementei estavam errada ou seriam feitas erradas.
- Então, irei abandonar a versão 0.3 devido a bagunça que ela se tornou.
- Agora com a visão macro e micro do sistema, será mais fácil organizar as versões.
- A ideia agora é implementar uma funcionalidade e ir testando ela massivamente.

**30-03-2026**

Simplificando o óbvio

- O aplicativo até a versão estável `v1` será apenas `client read-only`.
- Isso vai reduzir MUITO a complexidade e acelerar MUITO o desenvolvimento.
- Como já tenho uma estrutura base, isso vai ajudar na visão ao longo prazo, se existir futuro nesse aplicativo (só Deus sabe e espero que sim).

Mudando o nome (mais simplificação)

- Irei alterar de `{computerId}.msgpack` para `events.msgpack` simplesmente, porque não faz sentido adicionar isso agora. É mais fácil e direito simplesmente colocar um nome padrão.
- Mas isso não quer dizer que vou descartar a ideia, por isso estou documentando aqui. No futuro pretendo implementar ela.

**01-04-2026**

Adeus Google Drive, sem pegadinha de 1° de Abril

- Encontrei um excelente substituto ao Google Drive. O que me chateava nele é a lerdeza devido as várias verificações e processamento sobre o arquivo.
- Eu queria apenas algo simples, para fazer upload e download, e que não desse problema.
- Estava cogitando o pCloud, mas devido a limitações da conta free e abortei ele. Encontrei um excelente substituto que chama Koofr, o único ponto negativo é que ele possui apenas 10GB de armazenamento no plano free, o que não é um problema. Fiz uma porrada de testes e realmente é muito bom, adicionando todas as músicas da orquestra onde toco, deve ficar com 2GB (arquivos comprimidos, óbvio).

Hoje também, fiz um monte de teste e encontrei muitos problemas e muitas melhorias possíveis. Estou MUITO satisfeito com o resultado obtido com esse projeto. Acredito que ele vai agregar muito aos usuários.

**02-04-2026**

`database.msgpack.zst` automáticos

- Estou com receio de algum problema no aplicativo, levando a travamento perda dos dados etc. Por questão de segurança, irei implementar copias periódicas do banco de dados.
- Com isso, caso aconteça algum problema, o usuário não vai precisar ter que colocar tudo na mão novamente.

**03-04-2026**

MicroScore

- Irei implementar **telemetria** e **licença** ao software, como é um software bem completinho e acredito eu, que vai ajudar bastante, nada justo que cobrar um valor.
- **Telemetria**: minha ideia é coletar informações simples: tempo de uso (por dia), quantidade de música e partitura adicionada (por dia), quantas vezes foram aberto partitura por ele, e quantidade de upload/download feitas. A ideia é saber se o aplicativo está sendo bem usado, tanto pelo servidor, quanto o cliente. Tendo uma noção, o que é mais utilizado, cliente ou servidor?
- **Licença**: minha é criar licença por organização, ex: orquestra xxx, licença de 1 ano para 8 computadores por 300 reais. Com isso a pessoa terá total suporte meu.
  - A licença deve ficar tanto no servidor, quanto localmente. Exigindo na instalação acesso a internet.
  - Com isso evita a pessoa enviar o instalador para outra pessoa e pronto.
    ! Estou anotando aqui apenas para colocar em meu "radar" esse assunto. Não sei ao certo como será feito.

**05-04-2026**

`rclone` dentro do projeto, antes da v1

- Acredito que seja melhor adicionar o `rclone` ao projeto e criar uma página de configurações.
- A configuração do `rclone` será feito pela aplicação. Acredito que isso irá facilitar de mais para o usuário final, não tendo que: instalar o `rclone`, configurar ele (tendo risco) e eventualmente realizar atualizações.
- Com isso também, irei assumir a responsabilidade por manter o `rclone` atualizado, sendo mais fácil, apenas atualizando o aplicativo com a nova versão. Não precisando orientar o usuário, acessar a máquina remotamente ou ter que ir no local do computador.
- Obviamente tem outras coisas que terei que implementar devido a licença `MIT`, mas faz parte. Mas no caso onde esse software irá começar a ser usado, onde a pessoal que irá utilizar é leiga (e no geral, na área de música), é a melhor opção.

**06-04-2026**

`score-maestro-x64` e `score-maestro-x32`

- Estava insatisfeito com o usuário tendo que escolher entre "rclone do aplicativo" ou "rclone do sistema", tudo isso para "diplar" sistemas x32.
- Estava muito bagunçado e difícil, agora o aplicativo terá a versão `x32` e `x64`, cada uma com o rclone correto.
- Também, só será utilizado o "rclone do aplicativo", é mais fácil para o usuário e não é necessário sobrecarregar ele com: instalação e configuração.

**09-04-2026**

Versão apenas para licença e atualização.

- Tive a ideia, irei distribuir o software enxuto, com apenas a função de licença e atualização.
- O objetivo é evitar pirataria, evitando que com instalador a pessoa consiga usar tudo.
- Evidentemente, o usuário é obrigado a ter internet na instalação. Se bem que qualquer forma ele é, porque se não ele não conseguiria configurar e testar o provedor de nuvem.
- Isso evita que o instalador seja compartilhado sem limites, já que cada licença tem um número limitados de instalação.

**10-04-2026**

Sem `over engineering`

- Anteriormente decidi fazer a separação, hoje, fiz o teste e cheguei a conclusão que não compensa, complexidade muito alta para pouco frutos.
- Solução: O usuário irá receber o aplicativo completo. Ao instalar a primeira coisa que será consultado é se tem atualização, caso tenha, já atualiza direto, sem criar nada no (banco de dados, tauri-plugin-store). Caso tenha atualização, deve abrir uma página informando que é necessário atualizar o aplicativo antes de instalar, com uma contagem regressiva.
- Com a última versão instalada, o usuário informa  o nome da organização e a próxima tela é a da licença.

**11-04-2026**

"bye bye money" (licença)

- Estava com uma grande dúvida, como iria limitar pirataria, como iria monetizar e etc, mas, acredito que por agora, a melhor solução seja deixar totalmente livre. Acredito que seja mais vantajoso deixar ele 100% vitrine e no máximo ir nas organizações pedi uma "ajuda financeira".
- Com isso irei implementar telemetria e outras coisas para melhorar na usabilidade e aprender onde e o que melhorar no software, ou se ele realmente está sendo utilizado.
- Acho que a melhor escolha é usar ele como vitrine e experiência para conseguir uma oportunidade como dev.
- Então, qual os planos: foca na telemetria, criar uma boa página de boas vindas, avisando meu telefone de contanto, uma boa apresentação do software.

**14-04-2026**

Arrumando o caminho

- A documentação está bem desatualizada, principalmente em relação aos fluxos. Eu irei lançar o software como está, ele está suficientemente estável para uso normal, ou seja, a `v1.0`.
- Como eu fiz o código com vibe coding, acredito que tem muitas lacunas, então eu irei tirar um bom tempo para estudar o código, arrumar e aprender.
- Além de mudar onde a documentação é feita e atualizada (obsidian, não sei qual ferramenta irei realmente usar), agora já tenho uma visão melhor do software, a documentação foi feita em uma epoca que não tinha uma visão completa do software e da enorme quantidade de fluxos existentes.
- Então para manter o software funcionando bem, a melhor escolha é atualizar e melhorar a documentação.

**15-04-2026**

Simplificando a telemetria

- Está sendo bem chato implementar a telemetria, devido a muitos eventos e possibilidades, então para `v1` o que importa mesmo é: o software está sendo usado, quais problemas os usuários estão tendo e algumas informações a mais.

**11/05/2026**

O maestro da minha orquestra não está usando a ferramenta e o feedback não veio, apesar das tentativas. Para evitar atrito e insistência improdutiva, vou mudar o foco para validar o produto em outra organização.

Erros identificado:

- Eu conhecia a dor como ajudante da orquestra, mas não observei o fluxo real do maestro antes de construir o software (tinha uma leve visão, mas não perguntei e investiguei).
- Deveria ter me preparado melhor na hora de mostrar, mesmo o software sendo "gratuito", devia ter sido melhor em "vender o peixe", mostrando como era feio antes e agora com o "peixe" fica mais fácil e bonito.

Próximo passo e correções:

- Buscar outra organização com problema parecido, com maior abertura para testar a ferramenta e dar retorno prático.
- Criar um powerpointer para ilustrar o problema e a solução.
- Treinar mais meu lado "vendedor" e confiante (levar isso a sério).
- Deixar o maestro usar a ferramenta, para "sentir ela".

Preciso tomar cuidado:

- Resolver uma dor concreta (ok)
- Exigir pouca mudança de hábito (não sei)
- Ser simples de explicar (mais ou menos)
  - Essa parte é mais complicada, porque coloque um monte de coisa para "facilitar" a vida, mas acaba aumentando a explicação e deixando mais cansativa. Então, quando for explicar vou focar apenas nas funcionalidades chave e não nos facilitadores.
- Mostrar ganho imediato (não sei).

Próximos passos e melhorias:

- Preciso ter bem documentando EXATAMENTE os problemas que o software resolve e conseguir explicar/dizer de forma clara para pessoa esse problemas.
- Preciso criar um laucher e arrumar um jeito de tirar a maldida mensagem do windows de software suspeito (Microsoft defender SmartScreen).
  - Nem que eu tenha que subir 1000 máquinas virtuais e baixar o Score Maestro nas 1000.

**23/05/2026**

Mudança radical do software e documentação. Recentemente foi na casa do maestro da orquestra que faço parte e vi o quanto meu software ainda está mal desenhado e implementando. Então, irei ajusta-ló, começando pela documentação, realmente não gosto da forma que a documentação está feita. Se eu ficar com dúvida ou precisar atualizar algo, quero ir direto e não ter que ficar procurando.

Mudanças:

- Indexar diretório vai realmente indexar diretórios.

- O Score Maestro irá inteferir mais diretamente nos arquivos.

- Utilizar metadados do sistema.

- Maior personalização do software.

**14/06/2026** - Dificuldade para identificar falsa alteração em arquivos músicas

Estou estudando forma de identificar falsas alterações, principalmente em Finale, já que ele tem o problema crônico de sugerir salvar, mesmo que não tenha alterado nada no arquivo. Mas está sendo um verdadeiro desafio, já que cada versão do Finale tem uma forma de salvar os dados, então um arquivo do `.mus` salvo em um Finale 11, for aberto e salvo (mesmo sem alteração na partitura) o hash do arquivo será alterado. Também tem esse problema com `.musx`, mesmo convertendo para `.zip`, descompactado e verificando o `score.dat`. Esse problema não é exclusivo do Finale.

Minha ideia de evitar falso positivo é evitar dor de cabeça para o usuário, uma partitura válida, por ficar `draft` e não ser enviada para o cliente, deixando o usuário na mão (já que partituras que são alterada é alterado para `draft` e não são enviadas para o cliente). 

Eu cheguei a adicionar essa função no **Score Maestro**, sempre que uma partitura for alterada (data e hora de última alteração), verificar o hash do arquivo para realmente ver se foi alterado. Mas simplesmente isso não resolve, preciso encontrar outra forma simples para evitar isso, não pretendo manter hash e ter que tratar cada arquivo música, ex: `.musx` converter para `.zip` para depois verificar o hash do `score.dat`, para ter chance de mesmo assim dar problema e o mesmo processo ou similar para as outras extensões. Então, prefiro manter a simplicidade do aplicativo, verificando apenas alteração de data/hora de última alteração e tamanho do arquivo.

A solução será deixar o modal de revisão de alteração mais organizado e inteligente: podendo marcar e desmarcar, efetivando apenas quando o usuário clicar em "confirmar".

**27/06/2026** - Foco na gringa

Ficar focado apenas no povo brasileira irá limitar muito minhas chances do Score Maestro dar certo. Isso ocorre porque o Brasil é país subdesenvolvido, com isso a maioria das pessoas usam Windows 7 (pessoal mais velho) e também o pessoal na gringa é mais para frente, sempre buscando modernizar e melhorar, diferente do Brasil, onde a maioria prefere manter o padrão. E sem contar a quantidade MUITO maior de orquestras e bandas.

Não estou falando mal do Brasil, essa é a realidade e funciona (não tão bem, mas funciona). Estou apenas tomando a melhor decisão para o futuro da minha ferramenta. E sem contar que posso promovela falando que é um aplicativo internacional, ganhando mais confiança.
