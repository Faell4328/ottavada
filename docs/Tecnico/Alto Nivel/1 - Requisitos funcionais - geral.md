# 1. Servidor Score Maestro

## 1.1. Telemetria

O sistema deve enviar dados de telemetria:

- a cada 5 minutos após sua abertura.

Os dados enviados deve ser:

- xxx

## 1.2. Atualizações

O sistema deve suportar atualização de versão. Utilizando o próprio mecanismo do Tauri.

---

# 2. Filtros

Os filtros devem operar de forma cumulativa.

## 2.1. Categoria

O usuário deve poder selecionar categorias específicas para visualizar apenas as músicas associadas.

## 2.2. Compositor e arranjador

O usuário deve poder selecionar:

- compositor;
- arranjador;

para filtrar músicas relacionadas.

## 2.3. Valores padrão

Os filtros devem iniciar com os seguintes valores:

- Categoria: nenhuma selecionada (**Todas as músicas**);
- Compositor: **Todos**;
- Arranjador: **Todos**.

---

# 3. Nuvem

## 3.1. Provedores suportados

O Score Maestro deve suportar:

- Koofr (provedor recomendado);
- Google Drive;
- WebDAV;
- SFTP.

## 3.2. Rclone

O Score Maestro deve utilizar internamente o `rclone` como mecanismo padrão para sincronização, envio e recebimento de arquivos.

O executável do `rclone` deve ser distribuído e incorporado ao sistema, não sendo necessária instalação, configuração ou interação manual por parte do usuário.

Toda configuração relacionada ao `rclone`, incluindo criação de remotes, autenticação, parâmetros de sincronização, diretórios, credenciais e gerenciamento de conexões, deve ser realizada exclusivamente pelo Score Maestro através de sua interface e fluxos internos.

O sistema deve abstrair completamente a utilização do `rclone`.

---

# 4. Transparência operacional

O sistema deve exibir o progresso de todas as etapas executadas.

## 4.1. Restrições durante sincronização

Durante sincronizações, o usuário poderá apenas:

- expandir partituras de uma música;
- abrir partituras com duplo clique;
- realizar pesquisas;
- utilizar filtros.

Demais operações devem permanecer bloqueadas.

---

# 5. Inicialização

Durante a iniciação do aplicativo, o sistema deve:

1. Verificar se existe atualização.

2. Enviar telemetria.

3. Verificar alterações.