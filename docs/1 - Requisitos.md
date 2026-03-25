# Requisitos funcionais

## Geral
- Sistema deve ser tolerante a falha.
- Sistema deve sempre verificar antes de agir.
- Sistema deve ser transparente com que está fazendo.
- Mais importante, sistema deve ser simples e confiável. Não é para adicionar firula, que não agregue ao objetivo principal.

## Gerenciamento de Músicas e Partituras

- **Adicionar:** música manualmente, arquivo individual, ou diretório inteiro
- **Editar:** nome, compositor, arranjador, categorias, arquivo e status.
- **Favoritar:** marcar/desmarcar como favoritos
- **Pesquisar:** com sugestões automáticas por escopo (todas, favoritas, categoria)
- **Visualizar:** duplo clique abre arquivo no software padrão do sistema
- **Monitoramento:** detecta mudanças e converte automaticamente para draft (apenas no servidor).

## Gerenciamento de Categorias

- Criar, editar, remover categorias (ex.: "Harpa Cristã", "Clássicas")
- Uma música pode pertencer a múltiplas categorias e uma categoria pode pertencer a múltiplas músicas.

## Configurações

- O usuário pode alterar o nome do computador
- O usuário pode alterar o tipo de computador dele (entre cliente e servidor).

---
# Requisitos Não Funcionais

## Armazenamento Local

- Ao baixar os arquivos da Nuvem, eles viram compactados, ao dar duplo clique em uma partitura de alguma música, ela deve ser descompactada (em um diretório temporário) e aberto com o software padrão do sistema.
- Os logs deve ficar no diretório raiz do projeto.

## Nuvem

- Todos os arquivos que **serão enviados** devem ter o nome renomeado para final `xz.tmp` e após finalizar o upload deve voltar para `.zst`.
- O arquivo que foi feito o download deve ter o nome renomeado de `.zst.tmp` para `.zst`.
- Na nuvem só pode existir partituras com status `main` ou `pending`

## Performance

- Tanto a varredura, quanto o update e download, deve ser feito em thread separada. Para não interferir no funcionamento dos outros componentes.
- Os logs devem ser deletados depois de 30 dias, para não ficar poluindo o computador do usuário.

## Alteração em Partitura

- O sistema deve verificar alterações ao iniciar e quando o usuário clicar no botão.
- Partituras podem em alterações no Servidor não podem ir para a Nuvem, consequentemente nem para o Cliente.

## Restrições

- Não alterar o diretório e/ou arquivos do usuário sem a autorização direta dele.
- Os computadores não se comunicam entre si (diretamente). Não ficando expostos na internet.
- Controle de concorrência não é necessário, já que não vai ser feito alterações toda hora.
- Caso aja conflito entre cliente e servidor (que é improvável, porque é pouco provável ambos façam alterações ao mesmo tempo). A preferência deve ser do servidor, descartando as alterações do Cliente.
- Não será utilizado hash, devido a dificuldade de atualizar um arquivo no finale 14, é praticamente impossível "salvar sem querer". Então no momento não é necessário essa complicação. Sendo utilizado apenas a data e hora para saber que o arquivo foi alterado ou não.