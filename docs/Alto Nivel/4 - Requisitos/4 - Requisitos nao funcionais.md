# 1. Idiomas

O aplicativo deve dar suporte aos idiomas:

- Português;

- Inglês <mark>(Não implementado)</mark>;

- Espanhol <mark> (Não implementado)</mark>;

- Italiano <mark> (Não implementado)</mark>.

# 1. Categorias

## 1.1. Associação

Uma música pode possuir entre **0 e N categorias**.

Quando nenhuma categoria for definida, a categoria **Sem categoria** deve ser atribuída automaticamente.

## 1.2. Categoria “Sem categoria”

A categoria **Sem categoria**:

- não pode ser editada;
- não pode ser removida;
- deve ser atribuída automaticamente quando nenhuma categoria for atribuída a música.

---

# 2. Extensões suportadas

O sistema deve aceitar os seguintes formatos: `.pdf`, `.mus`, `.musx`, `.mscz`, `.xml`, `.musicxml`, `.sib`, `.enc`, `.mid` e `.midi`.

---

# 3. Sistemas operacionais suportados

O sistema deve suportar o sistema operacionais:

- Windows 10;
- Windows 11;
- Linux <mark>(Não implementado)</mark>;
- Mac <mark>(Não implementado)</mark>.

Arquiteturas:

- arquiteturas x32;
- arquiteturas x64.

---

# 4. Unicidade

Não deve existir duplicidade entre músicas, partituras, categorias, compositores e arranjadores. Todos os nomes devem ser únicos, caso o usuário tente adicionar, ele deve ser barrado pelo sistema.

**Exemplo**:

| **Errado**                                                                                                                    | **Correto**                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Música 1**: `Eis o Nosso Deus`<br/>**Música 2**: `Eis o Nosso Deus`                                                         | **Música 1**: `Eis o Nosso Deus`<br/>**Música 2**: `Eis o Nosso Deus (Com Coral)`                                                        |
| **Partitura 1**: `Violino I`<br/>**Partitura 2**: `Violino I`<br/>**Partitura 3**: `Trompete`<br/>**Partitura 4**: `Trompete` | **Partitura 1**: `Violino I`<br/>**Partitura 2**: `Violino I (Solo)`<br/>**Partitura 3**: `Trompete 1`<br/>**Partitura 4**: `Trompete 2` |

>  Isso evita redundância e dúvidas no repertório.

---

# 5. Computador de Ensaio - Cliente

## 5.1. Armazenamento de partituras localmente

Partituras baixadas devem permanecer compactadas e somente podem ser descompactadas em diretórios temporários quando forem abertas.

---

# 6. Rclone

O `rclone` deve ser executado utilizando:

```
rclone sync origem destino --rc --rc-addr=127.0.0.1:5572
```

O parâmetro é necessário para consulta e exibição do progresso.

O comando `rclone check` não deve ser utilizado.

---

# 7. Segurança

O sistema deve:

- ser tolerante a falhas;
- validar pré-condições antes da execução de qualquer operação;
- apresentar ao usuário informações claras sobre as operações executadas.

## 7.1. Logs

- Os logs devem ser mantidos por **30 dias**.

- Os logs devem ser armazenados no diretório raiz do projeto.

## 7.2. Exclusão

O sistema deve solicitar confirmação antes da remoção definitiva de qualquer item.

---

# 8. Servidor Ottavada

## 8.1. Telemetria

Em caso de falha no envio: nenhuma notificação visível deve ser apresentada ao usuário.

Em caso de sucesso: a tabela `errors` deve ser limpa.

## 8.2. Atualizações

O usuário deve poder adiar a atualização.

- Caso o usuário adie: deve aparecer um aviso (botão), para que ele possa atualizar facilmente.

---

# 9. Compactação

## 9.1. Desempenho e nível de compressão

Todas as etapas devem ser executadas em threads independentes para evitar bloqueios ou sobrecarga da thread principal.

A compactação `zst` deve utilizar:

- `-10` para compressão balanceada;
- `-T0` para utilização de todos os núcleos disponíveis.

## 9.2. Upload e Download para a nuvem

Todos os arquivos devem ser compactados com `zst` antes de ser enviado para a nuvem.
