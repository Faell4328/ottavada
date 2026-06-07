# Músicas

- **Principal (`main`)**: a música possui pelo menos uma partitura com status **main**.

- **Rascunho (`draft`)**: todas as partituras da música estão com status **draft**.

- **Sem partitura (`not_found`)**: a música não possui nenhuma partitura disponível.
  
  - Isso ocorre quando a música foi previamente indexada com partituras, mas, por algum motivo, o diretório ou os arquivos não foram encontrados.

---

# Partituras

- **Principal (`main`)**: são enviadas ao provedor de nuvem e ficam disponíveis para os clientes.
- **Rascunho (`draft`)**: não são enviadas ao provedor de nuvem.
- **Ignoradas (`ignored`)**: permanecem na interface, mas não participam da verificação de alterações nem são enviadas ao provedor de nuvem.

---

# Observações

- Músicas com status **`draft`** ou **`not_found`** não são disponibilizadas para o cliente e são removidas caso já existam nele.

- Partituras com status **`draft`** ou **`ignored`** não são enviadas ao cliente. Se já estiverem presentes, também são removidas.

- Quando uma partitura é alterada de **`main`** para **`draft`**, sua versão anterior em `main` não é preservada, sendo removida do provedor de nuvem e, consequentemente, do cliente.
