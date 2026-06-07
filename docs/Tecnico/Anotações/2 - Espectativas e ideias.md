**Score Maestro** - boas

- backup utilizando pendrive ou outro meio local.
- atualização automática do rclone.
  - Caso um dia eu precise abandonar o projeto, não quero que ele pare de funcionar por causa do rclone desatualizado, então preciso encontrar um meio de manter o rclone atualizando.
- implementar hash de verificação de arquivos.
  - a ideia é verificar apenas os arquivos que tiveram sua data/hora de última alteração alterados.
- implementar pesquisa inteligente (mesmo com erro de digitação).
- implementar identificação de instrumento inteligente.
  - removendo lixo no nome, ex: "_", "-" e etc.
- limpar modal ao fechar (`return () {}`).
  - atualmente, ao abrir o modal de revisão ao indexar um partitura, costuma já ter avisos e depois sumir. Tenho que arrumar isso.
- permitir música com mesmo nome, mas compositor e/ou arranjador diferentes.
- tenho vontade de implementar uma forma de realizar a leitura do arquivo. Com isso, consigo fazer sugestão mais inteligentes e seguir a ordem da grade que está no arquivo de grade.

---

**Score Maestro** - viajadas

- tirar o cliente de `read-only`.
- baixar backup da nuvem.
- adicionar uma camada de cibersegurança.
- possível adição de um novo `type` de computador `semi-server`.
- padronização no nome das músicas.
  - tendo uma lista interna de todas as músicas existentes (muito ambicioso e doido).

---

**Score Maestro Server** -  viajadas

- no site do Score Maestro, os músicos poderem ler as partituras de seus instrumentos e poderem ouvir.
  - isso é melhor, porque nem todo músico tem computador, pelo site trás mais acessibilidade.
