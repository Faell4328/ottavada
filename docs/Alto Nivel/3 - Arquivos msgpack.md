**Porque msgpack?** Porque ele é mais leve e mais rápido, se fosse um arquivo de configuração onde alguém precisa ler e alterar faria sentido ser algo tipo JSON, mas é algo gerado por computador para computador, então é melhor ser um msgpack.

---

# Event Log (events.msgpack.zst)

Contém as alterações incrementais do sistema (inserções, atualizações e remoções).

É utilizado para sincronização contínua entre servidor e cliente, aplicando apenas as mudanças ocorridas desde a última sincronização.

**Fluxo atual:** servidor → cliente

---

# Snapshot (snapshot.msgpack.zst)

Contém o estado consolidado e publicado do catálogo em um determinado momento (*checkpoint*).

O snapshot é destinado ao Ottavada no modo **Consultar**. Ele contém somente músicas com status `main` e partituras com status `main`. Dados `draft`, `ignored` e músicas `not_found` pertencem ao backup completo do modo **Gerir**, não ao snapshot do cliente.

É utilizado para inicialização e sincronização eficiente de clientes, evitando a necessidade de processar todo o histórico de eventos.

Ao conectar um cliente novo, o fluxo esperado é:

1. Carregar o `snapshot.msgpack.zst`;
2. Restaurar o estado consolidado;
3. Aplicar apenas os eventos gerados após o snapshot.

Esse processo reduz o tempo de sincronização e evita a leitura completa do *Event Log*.

**Fluxo:** servidor → cliente

---

# Database Export (backup.msgpack.zst)

Contém uma exportação completa do banco de dados do modo **Gerir**, incluindo os registros e estados que não são publicados para clientes.

Os arquivos de partituras `draft` e `ignored` são mantidos separadamente no diretório de backup de partituras e também fazem parte do fluxo de backup do modo **Gerir**.

É utilizado para backup, migração e replicação entre servidores.

Diferente do `snapshot.msgpack.zst`, o `backup.msgpack.zst` tem finalidade administrativa e de persistência, não de sincronização operacional.

**Fluxo:** servidor → servidor
