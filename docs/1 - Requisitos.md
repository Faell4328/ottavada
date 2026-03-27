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

- Ao baixar os arquivos da Nuvem, eles viram compactados, ao dar duplo clique em uma partitura de alguma música (no aplicativo), ela deve ser descompactada (no diretório temporário do projeto) e aberto com o software padrão do sistema.
- Os logs deve ficar no diretório raiz do projeto.

## Nuvem

- Na nuvem só pode existir partituras com status `main` ou `pending`, os outros status são usado localmente.
- Utilizar `rclone sync origem destino --rc --rc-addr=127.0.0.1:5572` e consultar o progresso de download/upload com isso, a cada 1 segundo. Essas informações devem ser mostradas no `Footer` do site.

## Performance

- Todos os arquivos na nuvem devem ser compactados com `.zst`. Para ocupar menos espaço na Nuvem, maior velocidade de upload e download.
- Tanto a varredura, quanto o update e download, deve ser feito em thread separada. Para não interferir no funcionamento dos outros componentes.
- Os logs devem ser deletados depois de 30 dias, para não ficar poluindo o computador do usuário.
- O rclone deve sempre usar: `--transfers=12`.
- Uma `snapshot` deve ser gerada sempre quando o `{computerId}.msgpack` passar de 2MB.
- O `zstd` deve ser usado com essas configurações: `-10` (compressão equilibrada) e `-T0` (utilizar todos os núcleos)
- `VACUUM;` rodar a cada 30 dias para limpar o lixo do DB.

## Alteração em Partitura

- O sistema deve verificar alterações ao iniciar e quando o usuário clicar no botão.

## Restrições

- Não alterar o diretório e/ou arquivos do usuário sem a autorização direta dele.
- Os computadores não se comunicam entre si (diretamente). Não ficando expostos na internet.
- Controle de concorrência não é necessário, já que não vai ser feito alterações toda hora.
- Caso aja conflito entre cliente e servidor (que é improvável, porque é pouco provável ambos façam alterações ao mesmo tempo). A preferência deve ser do servidor, descartando as alterações do Cliente.
- Não será utilizado hash, devido a dificuldade de atualizar um arquivo no finale 14, é praticamente impossível "salvar sem querer". Então no momento não é necessário essa complicação. Sendo utilizado apenas a data e hora para saber que o arquivo foi alterado ou não.
- Quando tiver snapshot e o cliente estiver desatualizado, deve ser deletado todo o banco de dados e inserido com base no snapshot (full reset).
- Não é para o `tar` manter a estrutura original dos arquivos, é para todos os arquivos informados como argumento, ficar no diretório raiz do `tar`.
- Alterações do cliente nunca sobrescrevem diretamente o servidor. Sendo sempre necessário autorização do servidor para efetivar a alteração.