**Porque diabos msgpack?** Porque ele é mais leve e mais rápido, se fosse um arquivo de configuração onde alguém precisa ler e alterar faria sentido ser algo tipo JSON, mas é algo gerado por computador para computador, então é melhor ser um msgpack.

---

**Event Log** (`events.msgpack`)

Contém as alterações incrementais do sistema (inserções, atualizações e remoções).

É utilizado para sincronização contínua entre servidor e cliente, aplicando apenas as mudanças ocorridas desde a última sincronização.

**Fluxo atual:** servidor → cliente

---

**Snapshot** (`snapshot.msgpack`)

Contém o estado consolidado do banco de dados em um determinado momento (*checkpoint*).

É utilizado para inicialização e sincronização eficiente de clientes, evitando a necessidade de processar todo o histórico de eventos.

Ao conectar um cliente novo, o fluxo esperado é:

1. Carregar o `snapshot.msgpack`;
2. Restaurar o estado consolidado;
3. Aplicar apenas os eventos gerados após o snapshot.

Esse processo reduz o tempo de sincronização e evita a leitura completa do *Event Log*.

**Fluxo:** servidor → cliente

---

**Database Export** (`backup.msgpack`)

Contém uma exportação completa do banco de dados.

É utilizado para backup, migração e replicação entre servidores.

Diferente do `snapshot.msgpack`, o `backup.msgpack` tem finalidade administrativa e de persistência, não de sincronização operacional.

**Fluxo:** servidor → servidor
