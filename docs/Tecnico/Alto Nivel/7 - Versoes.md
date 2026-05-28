# Linha do tempo resumida

# Versão 0.1

## Funcionalidades

- corrigir inconsistências da interface;
- revisar inclusão e edição de músicas, partituras e favoritos;
- adicionar o sistema de log.

## Melhorias

- remover elementos de interface que poluem a experiência;
- organizar ações comuns no overflow menu;
- validar dependências do projeto.

## Correções

- eliminar seleção visual indevida ao clicar em partituras/instrumentos;
- ajustar o modal de confirmação para exclusões;
- garantir o armazenamento correto dos logs no diretório do usuário.

# Versão 0.2

## Funcionalidades

- migrar informações do sistema para o `tauri-plugin-store`;
- detectar alteração em arquivo no Rust e no front;
- implementar o fluxo `draft` -> `main`;
- listar rascunhos ativos e introduzir `not_found`;
- começar o suporte cliente/servidor.

## Melhorias

- atualizar banco de dados, front e back;
- ajustar a página de primeiro acesso e as configurações;
- revisar a experiência de confirmação em mudanças críticas.

## Correções

- impedir cliques repetidos em "verificar alterações";
- bloquear ações indevidas no cliente;
- reforçar a troca de tipo do computador com modal e contagem regressiva.

# Versão 0.3

## Funcionalidades

- gerar `MessagePack` a partir do banco;
- integrar o fluxo de rclone com a nuvem;
- atualizar o primeiro acesso e as configurações para o provedor;
- salvar a configuração inicial no `tauri-plugin-store`.

## Melhorias

- mudar os arquivos de nuvem para a estrutura correta;
- preparar o upload de teste e a validação do provedor;
- alinhar o banco gerado com a nova estrutura.

## Correções

- revisar datas e campos gerados;
- ajustar nomes de diretórios e configuração do `tauri-plugin-store`;
- organizar o texto e a navegação do fluxo de nuvem.

# Versão 0.4

## Funcionalidades

- limpar a base e corrigir os fluxos existentes;
- atualizar banco e `tauri-plugin-store`;
- consolidar a nomenclatura da interface.

## Melhorias

- trocar textos para refletir "músicas" em vez de "partituras";
- manter a interface mais coerente com a visão do produto.

## Correções

- corrigir o código que usa banco e store;
- validar os testes após a refatoração.

# Versão 0.5

## Funcionalidades

- gerar `{songId}.tar.zst`;
- registrar `changedField` em todos os fluxos;
- gerar `events.msgpack`, `snapshot.msgpack` e `backup.msgpack`;
- permitir exportação e importação do backup.

## Melhorias

- refatorar front e back;
- facilitar futuras sincronizações;
- reforçar a geração forçada de snapshot nas configurações.

## Correções

- garantir integridade dos arquivos exportados;
- ajustar o fluxo de importação para manter consistência.

# Versão 0.6

## Funcionalidades

- consolidar rclone na nuvem;
- consultar alterações do servidor no cliente;
- criar regras para o fluxo de cliente read-only;
- limpar o diretório temporário na inicialização.

## Melhorias

- reduzir ruído de toast no processo de verificação;
- ordenar músicas e partituras;
- melhorar progresso e compressão no upload/download.

## Correções

- corrigir envio indevido de `draft` e `not_found`;
- ajustar extensão real dos arquivos no cliente;
- estabilizar a geração de snapshot.

# Versão 0.7

## Funcionalidades

- exibir aviso quando não houver internet;
- reforçar o fluxo de backup local e cloud;
- melhorar o comportamento de alterações e reprocessamento de arquivos.

## Melhorias

- reduzir toasts duplicados;
- fortalecer o `StatusBar` com progresso mais útil;
- melhorar a sincronização com a nuvem.

## Correções

- corrigir abertura errada de diretórios;
- corrigir geração de snapshot e reprocessamento;
- garantir que o app pare o rclone quando for fechado.

# Versão 0.8

## Funcionalidades

- ajustar o modo de exibição das partituras;
- fortalecer a confirmação de alterações;
- padronizar nomes de músicas e partituras;
- garantir ordenação correta dos instrumentos.

## Melhorias

- melhorar a experiência do usuário ao abrir, editar e localizar arquivos;
- permitir múltiplos arquivos no overflow menu;
- reforçar a lógica de nomeação e identificação.

## Correções

- corrigir problemas específicos do Windows;
- ajustar o cursor em elementos interativos;
- corrigir o fluxo ao expandir músicas e ao abrir arquivos temporários.

# Versão 0.9

## Funcionalidades

- adicionar favorita na música;
- padronizar backup local e cloud;
- integrar a configuração de provedores de nuvem;
- tornar o uso de rclone parte do projeto.

## Melhorias

- mostrar quantidade de músicas e partituras por status;
- deixar o teste de provedores e backup mais amigável;
- melhorar o primeiro acesso e as configurações.

## Correções

- ajustar o snapshot automático para não apagar `cloud/songs/`;
- corrigir o progresso real do StatusBar;
- resolver duplicidade de toasts e falhas ao alternar provedor.

# Versão 0.10

## Funcionalidades

- exibir apenas músicas na lista inicial e carregar partituras sob demanda;
- bloquear ações durante processos críticos;
- tratar duplicidades de música e partitura antes do salvamento.

## Melhorias

- melhorar busca, ordenação e feedback do usuário;
- simplificar os fluxos de revisão e edição;
- manter o cliente e o servidor mais estáveis.

## Correções

- corrigir travas, bugs visuais e inconsistências de pesquisa;
- ajustar o comportamento do StatusBar;
- consertar problemas de partitura aberta e atualização da lista.

# Versão 0.11

## Funcionalidades

- adicionar o fluxo de atualização do software;
- permitir adiar atualização;
- mostrar a versão nas configurações e consultar updates;
- iniciar a checagem de atualização ao abrir o app.

## Melhorias

- organizar a experiência de atualização no cliente e no servidor;
- ler chaves e senhas do `.env`.

## Correções

- evitar conflitos com a atualização no momento errado;
- corrigir comportamento visual do app após atualizar.

# Versão 0.12

## Funcionalidades

- melhorar backup diário;
- tratar partitura já usada em outra música;
- impedir nomes duplicados para partituras;
- destacar pendências antes do botão salvar.

## Melhorias

- consultar contagem de músicas e partituras sem cache;
- reforçar a validação de status anterior em `not_found`;
- alinhar o modal de revisão com o fluxo de indexação.

## Correções

- ajustar `open local` e `open score` no modal de revisão;
- corrigir geração de `{songId}.tar.zst` ao adicionar partituras;
- garantir que backup e snapshot sigam para a nuvem corretamente.

# Versão 0.13

## Funcionalidades

- consolidar a refatoração do front e do back;
- atualizar `tauri-plugin-store` de acordo com a documentação;
- incluir telemetria e banco de dados do cliente;
- reorganizar o primeiro acesso para mostrar o tipo do computador.

## Melhorias

- incluir nome da organização;
- melhorar o fluxo de contatos e telemetria;
- preparar o caminho para a v1 com mais estabilidade.

## Correções

- corrigir sincronização ao aplicar alterações rapidamente;
- corrigir importação de backup local com geração de snapshot;
- travar a navegação após redirecionar para home.

# Versão 1.0

## Funcionalidades

- bloquear ações durante atualização disponível;
- adicionar nome da organização no cliente;
- incluir vídeo introdutório antes do primeiro acesso;
- adicionar contatos de suporte.

## Melhorias

- melhorar mensagens de toast e do modal de revisão;
- adicionar feedback visual em operações longas;
- corrigir inconsistências de interface.

## Correções

- corrigir instabilidade no Windows ao aplicar e consultar alterações;
- corrigir exibição de partituras ao expandir música;
- ajustar rolagem com poucas músicas no Windows;
- corrigir bug de cursor ao editar texto no meio da linha.

# Versão 1.1

## Funcionalidades

- mover arquivos de cloud para a estrutura correta;
- permitir usar partitura como base;
- suportar mais formatos de arquivo musical;
- adicionar compositores e arranjadores com autocomplete.

## Melhorias

- guardar backup cloud ao trocar de provedor;
- atualizar o fluxo de nuvem quando iniciar o aplicativo;
- organizar filtros de categoria, compositor e arranjador.

## Correções

- corrigir problemas de perda de backup;
- impedir múltiplas instâncias do app;
- revisar a estrutura de upload, consulta e integração com nuvem.

# Versão 1.2

## Funcionalidades

- indexação de diretórios.

## Melhorias

- atualizando a modelagem do banco de dados.
- atualizando os arquivos `*.msgpack`.

! Refatoração completa do código (ex: arquivo do db gitante).

## Correções

- removendo duplicações e padronizando os campos no `tauri-store`.
- removendo completamente o status `pedding` do código.
- removendo inconsistências no status `draft`.
- removendo o criar música.
- corrigindo o indexar diretório para o novo padrão.
- removendo a opção "adicionar arquivo(s)".
