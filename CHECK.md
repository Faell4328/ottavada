# CHECK — Lista de Verificação de Funcionalidades

Objetivo: testar e validar todas as funcionalidades do Score Maestro.

Instruções: marque cada item conforme for testado. Adicione notas e evidências quando necessário.

## Indexação e Importação
- [ ] Selecionar diretório para indexação abre diálogo de seleção
- [ ] Varredura recursiva detecta arquivos em subpastas
- [ ] Arquivos suportados identificáveis: `.pdf`, `.mus`, `.musx`
- [ ] Extração de `nome` e `instrumento` a partir do padrão `nome - instrumento.ext`
- [ ] Caso o padrão não exista, `instrumento` fica `undefined` e `nome` é o nome do arquivo
- [ ] Metadados (tamanho, data modificação) salvos corretamente no banco

## Adicionar / Abrir Partitura
- [ ] Adicionar arquivo via UI insere registro no repositório
- [ ] Abrir partitura usa o aplicativo padrão do sistema
- [ ] Ao abrir, o watch detecta edições externas e cria rascunho

## Versionamento e Rascunhos
- [ ] Alterações detectadas criam rascunho automaticamente
- [ ] UI mostra opção `definir nova versão` quando há rascunho
- [ ] Criar nova versão preserva versões anteriores
- [ ] Editar versão antiga cria novo rascunho, não altera histórico
- [ ] Deletar versão exige confirmação e remove corretamente a versão escolhida

## Compactação de Versões (zstd)
- [ ] Versões antigas podem ser compactadas manualmente
- [ ] Versões atual, imediatamente anterior e rascunhos ativos NÃO são compactadas
- [ ] Acessar versão compactada descompacta e marca como temporária (se aplicável)
- [ ] Integridade do arquivo após descompressão está correta

## Backup — Google Drive (rclone) e Modo Local
- [ ] Backup via rclone executa sem erros quando remoto configurado
- [ ] `rclone about` retorna espaço disponível e é verificado antes do backup
- [ ] Modo Google Drive local (pasta sincronizada) copia via `std::fs` corretamente
- [ ] Modo Google Drive via API (rclone sidecar) sincroniza incrementalmente
- [ ] Retry e backoff em falhas de rede funcionando (teste com simulação de falha)
- [ ] Progresso do backup exibido na UI (/logs ou progress indicator)
- [ ] Rclone está empacotado como sidecar em `src-tauri/binaries/` quando aplicável

## Backup — Pendrive (USB)
- [ ] Backup manual para pendrive inicia a cópia corretamente
- [ ] Verificação de espaço via `fs2::available_space()` detecta falta de espaço antes da cópia
- [ ] Mensagem clara ao usuário quando não há espaço suficiente

## File Watching (notify)
- [ ] Abrir arquivo e editá-lo externamente gera evento detectado
- [ ] Eventos duplicados (save temporário do editor) são tratados sem criar múltiplos rascunhos
- [ ] Monitoramento é robusto em Linux (inotify) e Windows (ReadDirectoryChangesW)

## Hashing (BLAKE3)
- [ ] Cálculo de hash executável quando habilitado nas configurações
- [ ] Quando hash desativado, detecção usa tamanho + data modificação
- [ ] Hashes iguais descartam criação de nova versão/rascunho
- [ ] Performance do hashing aceitável em arquivos grandes (testar com >100MB)

## Busca (SQLite FTS5)
- [ ] Busca por prefixo (autocompletar) retorna sugestões enquanto digita
- [ ] Rankings e relevância funcionam para termos compostos
- [ ] Filtros por categoria / tags funcionam em conjunto com a busca

## UI — Componentes e Fluxos
- [ ] Header: logo à esquerda, ações (adicionar, indexar, configurações) à direita
- [ ] Sidebar esquerda: Biblioteca (Todas, Favoritadas, Rascunhos) visível e navegável
- [ ] Categorias aparecem e são filtráveis
- [ ] Área principal: resultados condizem com seleção da sidebar
- [ ] Barra de pesquisa filtra resultados em tempo real
- [ ] Ao clicar numa música, expande instrumentos disponíveis
- [ ] Painel de versões (sidebar direita) aparece ao selecionar instrumento
- [ ] Painel exibe todas as versões e opções de rascunho/definir nova versão
- [ ] Footer mostra status do último backup na nuvem (data/hora) e ícone de pendrive
- [ ] Tela de configurações contém frase final: "Made by Rhafaell with lots of coffee ☕"

## Integração Tauri / Rust
- [ ] `tauri.conf.json` contém configurações de sidecar quando aplicável
- [ ] Comandos Tauri (`commands/*`) são invocados corretamente pela UI
- [ ] Acesso ao sistema de arquivos (leitura/escrita) autorizado e sem erros de permissão

## Crates / Funcionalidades Backend
- [ ] `notify` está integrado e notifica corretamente mudanças de arquivo
- [ ] `blake3` funciona quando ativado — hashes consistentes
- [ ] `zstd` usa níveis esperados de compressão/descompressão sem corromper arquivos
- [ ] `fs2` retorna espaço disponível correto em diferentes dispositivos

## Logs, Erros e Mensagens ao Usuário
- [ ] Mensagens de erro são informativas e orientam ação (ex.: falta de espaço)
- [ ] Logs de operação (indexação, backup, compactação) estão disponíveis para diagnóstico

## Performance e Escalabilidade
- [ ] Indexação de grandes diretórios (>10k arquivos) completa sem travar a UI
- [ ] Uso de CPU/memória durante hashing e compactação está dentro do esperado

## Segurança e Permissões
- [ ] Aplicação não tenta acessar arquivos fora do diretório autorizado sem permissão
- [ ] Arquivos temporários gerados são removidos após uso

## Edge Cases
- [ ] Arquivos com nomes idênticos em instrumentos diferentes não causam conflito
- [ ] Arquivos com caracteres especiais em nomes são indexados corretamente
- [ ] Interrupção de backup (remover pendrive) deixa sistema em estado consistente

## Testes Manuais Sugeridos (passo a passo)
- [ ] Teste rápido: adicionar 3 arquivos com nomes corretos e verificar exibição
- [ ] Teste de edição externa: abrir arquivo, editar e salvar; confirmar criação de rascunho
- [ ] Teste de backup: simular conexão/rede e executar backup via rclone
- [ ] Teste de compactação: compactar versão antiga e abrir depois

## Observações e Evidências
- [ ] Anexar logs, screenshots ou gravações de tela para itens falhos
- [ ] Registrar data, ambiente (OS/version) e passos realizados para reprodução