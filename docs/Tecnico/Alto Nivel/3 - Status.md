# Partituras

- Arquivos **principal** (`main`) são enviados ao provedor de nuvem e disponibilizados aos clientes.

- Arquivos **rascunho** (`draft`) não são enviados ao provedor de nuvem.

- Arquivos **ignoradas** (`ignored`) são mantidas na interface, não participam da verificação de alterações e não são enviadas ao provedor de nuvem.

! Quando uma partitura passa de `main` para `draft`, sua última versão `main` não é mantida. Ela simplesmente não existe mais no provedor de nuvem/cliente.
