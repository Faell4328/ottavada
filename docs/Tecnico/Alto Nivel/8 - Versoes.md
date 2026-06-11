# Linha do tempo resumida

# Versão 0.1

## Funcionalidades

- correção de inconsistências da interface;
- revisão da inclusão e edição de músicas, partituras e favoritos;
- adição do sistema de log.

## Melhorias

- remoção de elementos de interface que poluem a experiência;
- organização de ações comuns no overflow menu;
- validação das dependências do projeto.

## Correções

- eliminação da seleção visual indevida ao clicar em partituras/instrumentos;
- ajuste do modal de confirmação para exclusões;
- garantia do armazenamento correto dos logs no diretório do usuário.

# Versão 0.2

## Funcionalidades

- migração das informações do sistema para o `tauri-plugin-store`;
- detecção de alteração em arquivo no Rust e no front;
- implementação do fluxo `draft` -> `main`;
- listagem de rascunhos ativos e revisão do fluxo de status;
- início do suporte cliente/servidor.

## Melhorias

- atualização do banco de dados, front e back;
- ajuste da página de primeiro acesso e das configurações;
- revisão da experiência de confirmação em mudanças críticas.

## Correções

- bloqueio de cliques repetidos em "verificar alterações";
- bloqueio de ações indevidas no cliente;
- reforço da troca de tipo do computador com modal e contagem regressiva.

# Versão 0.3

## Funcionalidades

- geração de `MessagePack` a partir do banco;
- integração do fluxo de rclone com a nuvem;
- atualização do primeiro acesso e das configurações para o provedor;
- salvamento da configuração inicial no `tauri-plugin-store`.

## Melhorias

- migração dos arquivos de nuvem para a estrutura correta;
- preparação do upload de teste e da validação do provedor;
- alinhamento do banco gerado com a nova estrutura.

## Correções

- revisão de datas e campos gerados;
- ajuste de nomes de diretórios e configuração do `tauri-plugin-store`;
- organização do texto e da navegação do fluxo de nuvem.

# Versão 0.4

## Funcionalidades

- limpeza da base e correção dos fluxos existentes;
- atualização do banco e do `tauri-plugin-store`;
- consolidação da nomenclatura da interface.

## Melhorias

- substituição de textos para refletir "músicas" em vez de "partituras";
- manutenção da interface mais coerente com a visão do produto.

## Correções

- correção do código que usa banco e store;
- validação dos testes após a refatoração.

# Versão 0.5

## Funcionalidades

- geração de `{songId}.tar.zst`;
- registro de `changedField` em todos os fluxos;
- geração de `events.msgpack`, `snapshot.msgpack` e `backup.msgpack`;
- exportação e importação do backup.

## Melhorias

- refatoração do front e back;
- facilitação de futuras sincronizações;
- reforço da geração forçada de snapshot nas configurações.

## Correções

- garantia da integridade dos arquivos exportados;
- ajuste do fluxo de importação para manter consistência.

# Versão 0.6

## Funcionalidades

- consolidação do rclone na nuvem;
- consulta de alterações do servidor no cliente;
- criação de regras para o fluxo de cliente read-only;
- limpeza do diretório temporário na inicialização.

## Melhorias

- redução de ruído de toast no processo de verificação;
- ordenação de músicas e partituras;
- melhoria do progresso e compressão no upload/download.

## Correções

- correção do envio indevido de `draft`;
- ajuste da extensão real dos arquivos no cliente;
- estabilização da geração de snapshot.

# Versão 0.7

## Funcionalidades

- exibição de aviso quando não houver internet;
- reforço do fluxo de backup local e cloud;
- melhoria do comportamento de alterações e reprocessamento de arquivos.

## Melhorias

- redução de toasts duplicados;
- fortalecimento do `StatusBar` com progresso mais útil;
- melhoria da sincronização com a nuvem.

## Correções

- correção da abertura errada de diretórios;
- correção da geração de snapshot e reprocessamento;
- garantia de que o app pare o rclone quando for fechado.

# Versão 0.8

## Funcionalidades

- ajuste do modo de exibição das partituras;
- fortalecimento da confirmação de alterações;
- padronização de nomes de músicas e partituras;
- garantia da ordenação correta dos instrumentos.

## Melhorias

- melhoria da experiência do usuário ao abrir, editar e localizar arquivos;
- permissão de múltiplos arquivos no overflow menu;
- reforço da lógica de nomeação e identificação.

## Correções

- correção de problemas específicos do Windows;
- ajuste do cursor em elementos interativos;
- correção do fluxo ao expandir músicas e ao abrir arquivos temporários.

# Versão 0.9

## Funcionalidades

- adição de favorita na música;
- padronização do backup local e cloud;
- integração da configuração de provedores de nuvem;
- incorporação do uso de rclone ao projeto.

## Melhorias

- exibição da quantidade de músicas e partituras por status;
- melhoria do teste de provedores e backup;
- melhoria do primeiro acesso e das configurações.

## Correções

- ajuste do snapshot automático para não apagar `cloud/songs/`;
- correção do progresso real do StatusBar;
- resolução da duplicidade de toasts e falhas ao alternar provedor.

# Versão 0.10

## Funcionalidades

- exibição apenas de músicas na lista inicial e carregamento de partituras sob demanda;
- bloqueio de ações durante processos críticos;
- tratamento de duplicidades de música e partitura antes do salvamento.

## Melhorias

- melhoria da busca, ordenação e feedback do usuário;
- simplificação dos fluxos de revisão e edição;
- mais estabilidade para o cliente e o servidor.

## Correções

- correção de travas, bugs visuais e inconsistências de pesquisa;
- ajuste do comportamento do StatusBar;
- correção de problemas de partitura aberta e atualização da lista.

# Versão 0.11

## Funcionalidades

- adição do fluxo de atualização do software;
- possibilidade de adiar atualização;
- exibição da versão nas configurações e consulta de updates;
- checagem de atualização ao abrir o app.

## Melhorias

- organização da experiência de atualização no cliente e no servidor;
- leitura de chaves e senhas do `.env`.

## Correções

- prevenção de conflitos com a atualização no momento errado;
- correção do comportamento visual do app após atualizar.

# Versão 0.12

## Funcionalidades

- melhoria do backup diário;
- tratamento de partitura já usada em outra música;
- impedimento de nomes duplicados para partituras;
- destaque de pendências antes do botão salvar.

## Melhorias

- consulta da contagem de músicas e partituras sem cache;
- reforço da validação de status anterior;
- alinhamento do modal de revisão com o fluxo de indexação.

## Correções

- ajuste de `open local` e `open score` no modal de revisão;
- correção da geração de `{songId}.tar.zst` ao adicionar partituras;
- garantia de que backup e snapshot sigam para a nuvem corretamente.

# Versão 0.13

## Funcionalidades

- consolidação da refatoração do front e do back;
- atualização do `tauri-plugin-store` de acordo com a documentação;
- inclusão de telemetria e banco de dados do cliente;
- reorganização do primeiro acesso para mostrar o tipo do computador.

## Melhorias

- inclusão do nome da organização;
- melhoria do fluxo de contatos e telemetria;
- preparação do caminho para a v1 com mais estabilidade.

## Correções

- correção da sincronização ao aplicar alterações rapidamente;
- correção da importação de backup local com geração de snapshot;
- travamento da navegação após redirecionar para home.

# Versão 1.0

## Funcionalidades

- bloqueio de ações durante atualização disponível;
- adição do nome da organização no cliente;
- inclusão de vídeo introdutório antes do primeiro acesso;
- adição de contatos de suporte.

## Melhorias

- melhoria das mensagens de toast e do modal de revisão;
- adição de feedback visual em operações longas;
- correção de inconsistências de interface.

## Correções

- correção de instabilidade no Windows ao aplicar e consultar alterações;
- correção da exibição de partituras ao expandir música;
- ajuste da rolagem com poucas músicas no Windows;
- correção de bug de cursor ao editar texto no meio da linha.

# Versão 1.1

## Funcionalidades

- migração dos arquivos de cloud para a estrutura correta;
- permissão de uso de partitura como base;
- suporte a mais formatos de arquivo musical;
- adição de compositores e arranjadores com autocomplete.

## Melhorias

- preservação do backup cloud ao trocar de provedor;
- atualização do fluxo de nuvem ao iniciar o aplicativo;
- organização dos filtros de categoria, compositor e arranjador.

## Correções

- correção de problemas de perda de backup;
- impedimento de múltiplas instâncias do app;
- revisão da estrutura de upload, consulta e integração com nuvem.

# Versão 1.2

## Funcionalidades

- edição e exclusão facilitada de categoria, compositor e arranjador;
- adicionado status `ignored` na partitura;

- adicionado status `main`, `draft` e `not_found` na música.

## Melhorias

- indexação de diretórios;
- modelagem do banco de dados;
- modelagem dos arquivos `*.msgpack`;

- 
- sugestão de instrumentos no modal de adição;
- melhorias na interface;
- substituição da exclusão permanente por envio para lixeira;
- geração de snapshot automático com 1MB.

## Correções

- remoção de duplicações e padronização dos campos no `tauri-plugin-store`;
- remoção de inconsistências no status `draft`;
- remoção da criação manual de música;

- remoção da opção "adicionar arquivo(s)";
- remoção dos status `not_found` na partitura.
