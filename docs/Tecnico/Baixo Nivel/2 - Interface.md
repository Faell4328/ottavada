# 1. Primeiro acesso

## 1.1. Tela de apresentação

A tela deve ter um texto informando se o usuário for novo, é recomendado assistir o tutorial para aprender a usar a ferramenta. Deve ter um botão que abre o navegador padrão com o link do tutorial.

Também deve ter a intro do Score Maestro

---

## 1.2. Selecionar o tipo do computador

O usuário deve selecionar entre cliente e servidor. Deve ter um breve texto explicando a diferença de cada um.

---

## 1.3. Adicionar nome do computador e organização

O usuário deve informar o nome do computador e da organização

# 2. Modal de revisão de alteração

## 2.1. Agrupamento de mesmo tipo e música

Quando várias partituras são alteradas com o mesmo tipo, ex: "adicionada" para a música "HINO NACIONAL", todas as partitura devem ser agrupadas na mesma linha.

## 2.2. Deletando e Adicionando

Quando uma música e/ou partitura for deletada e adicionada, o modal deve mostrar que foi alterada e não que foi deletada e adicionada (podendo confundir o usuário).

---

### Header

- Logo do Score Maestro | Botões: adicionar música, adicionar arquivo, adicionar diretório, configurações

### Sidebar Esquerda

- **Biblioteca:** Todas as partituras | Favoritadas | Rascunhos ativos | Pendências ativas
- **Categorias:** Lista de categorias do usuário

### Área Principal

- Lista de músicas filtradas pela seleção da sidebar
- Pesquisa com sugestões automáticas
- Clique expande música para mostrar instrumentos
- Duplo clique abre arquivo no software padrão

#### Listagem de partituras

Ao clicar na música será expandido e mostrar uma lista de partituras/instrumentos.

- Deve trazer os intrumentos, extensão e status (`draft` - borda laranja, `pending` - borda amarela, `main` - borda verde, `not found` - borda vermelha)

### Footer

É um dos meios de comunicar com o usuário o que está sendo feito. Ele deve ser sempre visível.

- Status: data/hora do último backup
- Se em progresso: barra de progresso e porcentagem

### Configurações

- O usuário deve poder alterar o nome.
- Alterar o tipo de computador.
- Pode forçar a geração de snapshot.
  - Caso o usuário queira por algum motivo, força a geração de um snapshot.
- Importar um arquivo de snapshot.
  - O usuário pode carregar um arquivo `snapshot.msgpack` ou `snapshot.msgpack.zst` para carregar um estado do banco de dados.

### Configurações

- O usuário deve poder alterar o nome do dispositivo.
- O usuário deve poder alterar o tipo de computador (ex: servidor ou cliente).
- O usuário deve poder forçar a geração de um snapshot.
- O usuário deve poder exportar o bando de dados e o `tauri-plugin-store`.
  - Permitir gerar um `backup.msgpack` com todas as informações do banco de dados.
- O usuário deve poder importar `backup.msgpack`.