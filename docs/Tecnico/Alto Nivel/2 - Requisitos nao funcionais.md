# 1. Categorias

## 1.1 Associação

Uma música pode possuir entre **0 e N categorias**.

Quando nenhuma categoria for definida, a categoria **Sem categoria** deve ser atribuída automaticamente.

## 1.2 Categoria “Sem categoria”

A categoria **Sem categoria**:

- não pode ser editada;
- não pode ser removida;
- deve ser atribuída automaticamente quando nenhuma categoria for informada.

---

# 2. Extensões suportadas

O sistema deve aceitar os seguintes formatos:

- `.pdf`
- `.mus`
- `.musx`
- `.mscx`
- `.xml`
- `.musicxml`
- `.sib`
- `.enc`
- `.mid`
- `.midi`

---

# 3. Sistemas operacionais suportados

O sistema deve suportar:

- Windows 10;
- Windows 11;
- arquiteturas x32;
- arquiteturas x64.

---

# 4. Unicidade

Não deve existir duplicidade entre músicas e partituras.

Todos os nomes devem ser únicos.

---

# 5. Configuração do sistema

O usuário não deve poder alterar o modo de operação entre:

- **Cliente**
- **Servidor**

---

# 5. Cliente

## 6.1 Armazenamento local

Partituras baixadas devem permanecer compactadas e somente podem ser descompactadas em diretórios temporários quando forem abertas.

---

# 7. Rclone

O `rclone` deve ser executado utilizando:

```
rclone sync origem destino --rc --rc-addr=127.0.0.1:5572
```

O parâmetro é necessário para consulta e exibição do progresso.

O comando `rclone check` não deve ser utilizado.

---

# 8. Comunicação

A comunicação entre cliente e servidor deve ocorrer por meio de:

- `events`;
- `snapshot`;

utilizando armazenamento em nuvem e arquivos no formato `.msgpack`.

---

# 9. Segurança

O sistema deve:

- ser tolerante a falhas;
- validar pré-condições antes da execução de qualquer operação;
- apresentar ao usuário informações claras sobre as operações executadas.

## 9.1 Logs

- Os logs devem ser mantidos por **30 dias**.

- Os logs devem ser armazenados no diretório raiz do projeto.

## 9.2 Exclusão

O sistema deve solicitar confirmação antes da remoção definitiva de qualquer item.

---

# 10. Servidor Score Maestro

## 10.1 Telemetria

Em caso de falha no envio: nenhuma notificação visível deve ser apresentada ao usuário.

Em caso de sucesso: a tabela `errors` deve ser limpa.

## 10.2 Atualizações

O usuário deve poder adiar a atualização.

- Caso o usuário adie: deve aparecer um aviso (botão), para que ele possa atualizar facilmente.

---

# 11. Compactação

## 11.1 Desempenho e nível de compressão

Todas as etapas devem ser executadas em threads independentes para evitar bloqueios ou sobrecarga da thread principal.

A compactação `zst` deve utilizar:

- `-10` para compressão balanceada;
- `-T0` para utilização de todos os núcleos disponíveis.

## 11.2 Upload e Download para a nuvem

Todos os arquivos devem ser compactados com `zst` antes de ser enviado para a nuvem.   