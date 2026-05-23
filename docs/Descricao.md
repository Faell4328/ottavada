# Descrição do Projeto



O **Score Maestro** é um software desenvolvido para facilitar o dia a dia de músicos e regentes no gerenciamento de músicas e partituras. Seu principal objetivo é resolver desafios comuns relacionados à organização, sincronização e distribuição de repertórios.

É importante destacar que o **Score Maestro** não é uma ferramenta de criação, edição ou leitura de partituras. Ele atua como um intermediário e facilitador, integrando e organizando o fluxo de trabalho já existente.

Para oferecer mais segurança e flexibilidade, o sistema não expõe diretamente os computadores à internet. A comunicação entre servidores e clientes é realizada por meio de um **provedor em nuvem** (Koofr ou Google Drive), responsável por intermediar a sincronização e a troca de dados entre os dispositivos.

O sistema oferece suporte aos formatos `.pdf`, `.mus`, `.musx`, `.mscx`, `.xml`, `.musicxml`, `.sib`, `.enc`, `.mid` e `.midi`. Arquivos com extensões diferentes dessas são automaticamente ignorados durante o processo de indexação do repertório.

O **Score Maestro** foi projetado para funcionar em conjunto com ferramentas amplamente utilizadas na criação e edição de partituras, como **Finale**, **MuseScore**, **Sibelius** e **Encore**, além de outros programas compatíveis com formatos como **MusicXML**, **MIDI** e **PDF**.

Dessa forma, o sistema se adapta ao fluxo de trabalho já estabelecido, permitindo que músicos e regentes continuem utilizando as ferramentas que já conhecem e preferem, sem necessidade de mudanças na rotina de trabalho.

## 1. Repertório organizado

O **Score Maestro** oferece diversos filtros para facilitar a organização e localização das músicas, incluindo:

- Categoria
- Compositor
- Arranjador
- Ordenação de partituras seguindo o padrão da grade.

Além disso, o sistema já possui uma **barra de pesquisa**, permitindo localizar músicas rapidamente dentro do repertório.

Atualmente, a pesquisa funciona de forma direta e depende da correspondência dos termos informados. Futuramente, está prevista a implementação de uma **pesquisa inteligente**, capaz de identificar músicas mesmo com erros de digitação, nomes incompletos ou pequenas variações na busca.

## 2. Evitar duplicação no repetório.

Para manter a organização do repertório, o Score Maestro não permite músicas com nomes duplicados e também impede partituras de instrumentos com o mesmo nome dentro de uma mesma música.

Quando for necessário criar variações, os nomes das músicas e dos instrumentos devem ser diferenciados manualmente.

**Exemplos de músicas**

- `Eis o Nosso Deus`
- `Eis o Nosso Deus (Com Coral)`

**Exemplos de partituras**

- `Violino I`
- `Violino I (Solo)`
- `Trompete 1`
- `Trompete 2`
- `Flauta 1`
- `Flauta 1 (Variação)`

Dessa forma, o sistema evita duplicações, reduz ambiguidades e mantém o repertório mais organizado e consistente.

## 3. Sincronização entre computadores

O **Score Maestro** utiliza uma arquitetura **cliente-servidor**, permitindo que múltiplos computadores mantenham suas partituras sincronizadas.

**Servidor**

O servidor atua como a fonte principal dos dados, sendo responsável por:

- Armazenar todas as músicas e partituras
- Adicionar, modificar e remover arquivos
- Distribuir as alterações para os clientes conectados

**Cliente**

O cliente funciona como um leitor e sincronizador local, permitindo:

- Baixar partituras do servidor
- Acessar versões atualizadas dos arquivos
- Consultar o acervo localmente

**Importante:** o sistema permite **apenas um servidor** e **vários clientes conectados**.

## 4. Partituras disponíveis offline

Com o **Score Maestro**, não é necessário estar conectado à internet para acessar as partituras já sincronizadas. Todos os arquivos ficam armazenados localmente no computador do cliente, garantindo acesso mesmo sem conexão.

**Observação:** para receber novas alterações e atualizações do servidor, é necessário acesso à internet. Entretanto, as partituras já baixadas permanecem disponíveis normalmente.

## 5. Seus arquivos continuam sendo seus

O **Score Maestro** não altera a estrutura atual dos seus arquivos e diretórios. O sistema se adapta à organização existente, evitando que você precise reorganizar manualmente todo o repertório.

Quando você edita ou deleta uma música ou partitura, você não está fazendo isso em seu repertório.

Para funcionar corretamente, apenas alguns padrões devem ser seguidos:

1. O nome da pasta deve ser o mesmo nome da música.
2. As partituras devem ficar dentro dessa pasta.
3. Os arquivos devem utilizar o nome do instrumento correspondente.

**Exemplo 1:**

```
Amazing Grace/
├── flute.mus
├── trumpet.mus
├── clarinet.mus
└── trombone.mus
```

Exemplo 2:

```
Amazing Grace/
├── Amazing Grace - flauta.mus
├── Amazing Grace - trompete.mus
├── Amazing Grace - clarinet.mus
└── Amazing Grace - trombone.mus 
```

# Limitações e filosofia do sistema

O **Score Maestro** possui uma limitação intencional: o sistema apenas indexa um diretório existente e as partituras existentes nele. Essa decisão faz parte da filosofia do projeto e não representa uma restrição técnica.

A proposta é que o usuário utilize o **Score Maestro** pela praticidade e qualidade da experiência oferecida. Por esse motivo, a organização das músicas e partituras continua baseada em uma estrutura de diretórios definida pelo próprio usuário. Ou seja, a ferramenta se modal a você e não você a ela.

Esse processo manual é proposital e garante maior independência e controle sobre os dados. Assim, caso o usuário decida deixar de utilizar o **Score Maestro** no futuro, toda a estrutura de arquivos permanecerá exatamente como sempre esteve: organizada, acessível e familiar. Em outras palavras, o sistema trabalha sobre a organização já existente, sem impor formatos proprietários ou criar dependências desnecessárias.





---



# Descrição do Projeto

O **Score Maestro** é um software desenvolvido para facilitar o dia a dia de músicos e regentes no gerenciamento de músicas e partituras. Seu principal objetivo é resolver desafios comuns relacionados à organização, sincronização e distribuição de repertórios.

É importante destacar que o **Score Maestro** não é uma ferramenta de criação, edição ou leitura de partituras. Ele atua como um intermediário e facilitador, integrando e organizando o fluxo de trabalho já existente.

Para oferecer mais segurança e flexibilidade, o sistema não expõe diretamente os computadores à internet. A comunicação entre servidores e clientes é realizada por meio de um **provedor em nuvem** (Koofr ou Google Drive), responsável por intermediar a sincronização e a troca de dados entre os dispositivos.

O sistema oferece suporte aos formatos `.pdf`, `.mus`, `.musx`, `.mscx`, `.xml`, `.musicxml`, `.sib`, `.enc`, `.mid` e `.midi`. Arquivos com extensões diferentes dessas são automaticamente ignorados durante o processo de indexação do repertório.

O **Score Maestro** foi projetado para funcionar em conjunto com ferramentas amplamente utilizadas na criação e edição de partituras, como **Finale**, **MuseScore**, **Sibelius** e **Encore**, além de outros programas compatíveis com formatos como **MusicXML**, **MIDI** e **PDF**.

Dessa forma, o sistema se adapta ao fluxo de trabalho já estabelecido, permitindo que músicos e regentes continuem utilizando as ferramentas que já conhecem e preferem, sem necessidade de mudanças na rotina de trabalho.

## 1. Repertório organizado

O **Score Maestro** oferece diversos filtros para facilitar a organização e a localização das músicas, incluindo:

- Categoria
- Compositor
- Arranjador
- Ordenação de partituras seguindo o padrão da grade

Além disso, o sistema já possui uma **barra de pesquisa**, permitindo localizar músicas rapidamente dentro do repertório.

Atualmente, a pesquisa funciona de forma direta e depende da correspondência dos termos informados. Futuramente, está prevista a implementação de uma **pesquisa inteligente**, capaz de identificar músicas mesmo com erros de digitação, nomes incompletos ou pequenas variações na busca.

## 2. Evitar duplicação no repertório

Para manter a organização do repertório, o Score Maestro não permite músicas com nomes duplicados e também impede partituras de instrumentos com o mesmo nome dentro de uma mesma música.

Quando for necessário criar variações, os nomes das músicas e dos instrumentos devem ser diferenciados manualmente.

**Exemplos de músicas**:

- `Eis o Nosso Deus`
- `Eis o Nosso Deus (Com Coral)`

**Exemplos de partituras**:

- `Violino I`
- `Violino I (Solo)`
- `Trompete 1`
- `Trompete 2`
- `Flauta 1`
- `Flauta 1 (Variação)`

Dessa forma, o sistema evita duplicações, reduz ambiguidades e mantém o repertório mais organizado e consistente.

## 3. Sincronização entre computadores

O **Score Maestro** utiliza uma arquitetura **cliente-servidor**, permitindo que múltiplos computadores mantenham suas partituras sincronizadas.

**Servidor**:

O servidor atua como a fonte principal dos dados, sendo responsável por:

- Armazenar todas as músicas e partituras
- Adicionar, modificar e remover arquivos
- Distribuir as alterações para os clientes conectados

**Cliente**:

O cliente funciona como um leitor e sincronizador local, permitindo:

- Baixar partituras do servidor
- Acessar versões atualizadas dos arquivos
- Consultar o acervo localmente

**Importante:** o sistema permite **apenas um servidor** e **vários clientes conectados**.

## 4. Partituras disponíveis offline

Com o **Score Maestro**, não é necessário estar conectado à internet para acessar as partituras já sincronizadas. Todos os arquivos ficam armazenados localmente no computador do cliente, garantindo acesso mesmo sem conexão.

**Observação:** para aplicar novas alterações ou receber, é necessário acesso à internet. Entretanto, as partituras já baixadas permanecem disponíveis normalmente.

## 5. Seus arquivos continuam sendo seus

O **Score Maestro** não altera a estrutura atual dos seus arquivos e diretórios. O sistema se adapta à organização existente, evitando que você precise reorganizar manualmente todo o repertório ou fique preso em um padrão que desconhece.

Quando você edita ou exclui uma música ou partitura, isso não altera diretamente o seu repertório original.

Para funcionar corretamente, apenas alguns padrões devem ser seguidos:

1. O nome da pasta deve ser o mesmo nome da música.
2. As partituras devem ficar dentro dessa pasta.
3. Os arquivos devem utilizar o nome do instrumento correspondente.

**Exemplo 1:**

```
Amazing Grace/
├── flute.mus
├── trumpet.mus
├── clarinet.mus
└── trombone.mus
```

**Exemplo 2:**

```
Amazing Grace/
├── Amazing Grace - flauta.mus
├── Amazing Grace - trompete.mus
├── Amazing Grace - clarinet.mus
└── Amazing Grace - trombone.mus
```

# Limitações e filosofia do sistema

O **Score Maestro** possui uma limitação intencional: o sistema apenas indexa um diretório existente e as partituras nele contidas. Essa decisão faz parte da filosofia do projeto e não representa uma restrição técnica.

A proposta é que o usuário utilize o **Score Maestro** pela praticidade e pela qualidade da experiência oferecida. Por esse motivo, a organização das músicas e partituras continua baseada em uma estrutura de diretórios definida pelo próprio usuário. Ou seja, a ferramenta se molda a você, e não o contrário.

Esse processo manual é proposital e garante maior independência e controle sobre os dados. Assim, caso o usuário decida deixar de utilizar o **Score Maestro** no futuro, toda a estrutura de arquivos permanecerá exatamente como sempre esteve: organizada, acessível e familiar. Em outras palavras, o sistema trabalha sobre a organização já existente, sem impor formatos proprietários ou criar dependências desnecessárias.
