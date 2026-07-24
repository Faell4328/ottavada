# Computador do Maestro - Servidor

É o computador principal do sistema e atua como a **fonte da verdade** do repertório, normalmente usado pelo maestro, regente ou responsável pela organização das partituras. Podendo ter apenas um Ottavada desse tipo.

Nele é possível adicionar, editar e excluir músicas, partituras, categorias, compositores e arranjadores, além de gerenciar o status das músicas e partituras.

Internamente no sistema é o tipo `server`.

# Computador de Ensaio - Cliente

É o computador utilizado para consulta ao repertório, normalmente usado na sala de ensaio, tendo permissão apenas para ler o repertório. Podendo ter um ou vários Ottavada desse tipo.

Ele baixa e atualiza as músicas, partituras, categorias, compositores e arranjadores com base no que o **Computador do Maestro** disponibiliza no **provedor de nuvem**, músicas e partituras com o status **Envio permitido** (`main` - internamente), mantendo os arquivos localmente para acesso mesmo offline.

Internamente no sistema é o tipo `client`.

# Fluxo Simplificado

```mermaid
flowchart TD
 A[Computador do Maestro - Servidor] -->  B@{ shape: cloud, label: "Provedor de Nuvem" }
 B --> C[Computador de Ensaio - Cliente]
```
