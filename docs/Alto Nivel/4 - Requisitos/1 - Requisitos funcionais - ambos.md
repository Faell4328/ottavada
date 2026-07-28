# 1. Suporte a multi-idiomas

O sistema deve suportar os idiomas:

- Português Brasil;

- Inglês;

- Espanhol;

- Francês;

- Italiano;

- Alemão.

---

# 2. Servidor Ottavada

## 2.1. Telemetria

O sistema deve enviar dados de telemetria:

- ao ser aberto;
- a cada 5 minutos.

Os dados enviados devem ser:

- ID do computador (gerado aleatoriamente na instalação);
- Nome do computador;
- Nome da organização;
- Tipo de computador;
- Versão do aplicativo;
- Sistema operacional;
- Arquitetura (x32 ou x64);
- Quantidade de músicas;
- Quantidade de músicas em status `main`;
- Quantidade de músicas em status `draft`;
- Quantidade de músicas em status `not_found`;
- Quantidade de partituras em status `main`;
- Quantidade de partituras em status `draft`;
- Quantidade de partituras em status `ignored`;
- Erros que aconteceram.

>  Não é feito coleta de dados sensíveis, o único objetivo da telemetria é saber se o aplicativo está sendo realmente usado, por quem e quais problemas está ocorrendo no Ottavada.

## 2.2. Atualizações

O sistema deve suportar atualização de versão, utilizando o próprio mecanismo do Tauri.

O usuário deve poder recusar atualizar o aplicativo, ficando um botão, que ao clicar pergunta se ele gostaria de iniciar a atualização.

---

# 3. Filtros

Os filtros devem operar de forma acumulativa.

## 3.1. Seções

Deve ter as seções:

- **Todas as músicas** - Lista todas as músicas;

- **Favoritos** - Lista todas as músicas favoritas;

- **Não permitidas** - Lista todas as músicas que tenham alguma partitura com status **Envio não permitido**;

- **Sem partituras** - Lista todas as músicas que não têm partitura.

## 3.2. Categoria

Quando o usuário selecionar uma categoria, deve mostrar as músicas, compositores e arranjadores que tenham naquela categoria.

A categoria deve ter por padrão a opção: **Sem categoria**.

## 3.3. Compositor e arranjador

Quando o usuário selecionar um compositor, só deve mostrar as músicas e os arranjadores que tenham relação com o compositor. O mesmo vale caso seja selecionado o arranjador.

O compositor deve ter por padrão as opções: **Todos** e **Sem compositor**.

O arranjador deve ter por padrão as opções: **Todos** e **Sem arranjador**.

## 3.4. Barra de pesquisa

A pesquisa por música deve se feita com base no(s) filtro(s) que o usuário aplicou.

A busca deve ser simples, utilizando o método de procurar por substrings no nome da música.

## 3.5. Valores selecionados por padrão

Os filtros devem iniciar com os seguintes valores:

- Seção: Todas as músicas;
- Categoria: *Nenhuma selecionada*;
- Compositor: Todos;
- Arranjador: Todos.

---

# 4. Nuvem

## 4.1. Provedores suportados

O Ottavada deve suportar:

- Koofr (**Provedor recomendado**);
- Google Drive.

Opções avançadas: <mark>(Não implementado)</mark>

- WebDAV;
- SFTP.

## 4.2. Engine para envio e recebimento com a nuvem

O Ottavada deve utilizar internamente o `rclone`.

O executável do `rclone` deve ser distribuído e incorporado ao sistema, não sendo necessária instalação, configuração ou interação manual por parte do usuário.

Toda configuração relacionada ao `rclone`, incluindo criação de remotes, autenticação, parâmetros de sincronização, diretórios, credenciais e gerenciamento de conexões, deve ser realizada exclusivamente pelo Ottavada através de sua interface e fluxos internos. Abstraindo completamente a utilização do `rclone`.

---

# 5. Transparência operacional

## 5.1. Barra de progresso

O sistema deve mostrar o progresso das ações: "aplicar alterações" e "consultar alterações".

## 5.2. Restrições durante sincronização

Durante sincronizações, o usuário poderá apenas:

- expandir partituras de uma música;
- abrir partituras com duplo clique;
- realizar pesquisas;
- utilizar filtros.

Demais operações devem permanecer bloqueadas, por questão de segurança e integridade.

---

# 6. Instrumentos e ordenação

## 6.1. Ordem de listagem na música

Os instrumentos suportados e ordem deles é baseado na ordem interna do Finale e Sibelius, que utiliza o padrão da convenção da *New German School* (Wagner, Strauss, Mahler) que é o padrão internacional.

1° Deve vir os instrumentos sem nome;

2° Deve ser os instrumentos identificados (em ordem que está na lista em **5.2**);

3° Deve ser os instrumentos que foram identificados, mas está fora da lista (em ordem alfabética).

## 6.2. Instrumentos suportados e a ordem

**Madeira**

| Posição | Instrumento (Português)  | Instrumento (Inglês)      |
| ------- | ------------------------ | ------------------------- |
| 1       | Flautim                  | Piccolo                   |
| 2       | Flauta                   | Flute                     |
| 3       | Flauta Alto              | Alto Flute                |
| 4       | Oboé                     | Oboe                      |
| 5       | Oboé d'Amore             | Oboe d'Amore              |
| 6       | Corne Inglês             | English Horn/ Cor Anglais |
| 7       | Heckelfone               | Heckelphone               |
| 8       | Clarinete Mib (Soprinho) | E♭ Clarinet               |
| 9       | Clarinete (Sib/Lá)       | Clarinet (B♭/A)           |
| 10      | Clarinete Baixo          | Bass Clarinet             |
| 11      | Clarinete Contralto      | Contralto Clarinet        |
| 12      | Clarinete Contrabaixo    | Contrabass Clarinet       |
| 13      | Saxofone Soprano         | Soprano Saxophone         |
| 14      | Saxofone Alto            | Alto Saxophone            |
| 15      | Saxofone Tenor           | Tenor Saxophone           |
| 16      | Saxofone Barítono        | Baritone Saxophone        |
| 17      | Saxofone Baixo           | Bass Saxophone            |
| 18      | Fagote                   | Bassoon                   |
| 19      | Contrafagote             | Contrabassoon             |

**Metais**

| Posição | Instrumento (Português)  | Instrumento (Inglês)      |
| ------- | ------------------------ | ------------------------- |
| 20      | Trompa (Trompa Francesa) | Horn (French Horn)        |
| 21      | Trompa Wagneriana        | Wagner Tuba               |
| 22      | Trompete Piccolo         | Piccolo Trumpet           |
| 23      | Trompete                 | Trumpet                   |
| 24      | Trompete Baixo           | Bass Trumpet              |
| 25      | Cornetim                 | Cornet (B♭)               |
| 26      | Fliscorno                | Flugelhorn                |
| 27      | Trombone Alto            | Alto Trombone             |
| 28      | Trombone (Tenor)         | Trombone                  |
| 29      | Trombone Baixo           | Bass Trombone             |
| 30      | Eufônio (Barítono)       | Euphonium / Baritone Horn |
| 31      | Tuba                     | Tuba                      |

**Percussão**

| Posição | Instrumento (Português) | Instrumento (Inglês)   |
| ------- | ----------------------- | ---------------------- |
| 32      | Tímpanos                | Timpani                |
| 33      | Caixa Clara             | Snare Drum             |
| 34      | Bumbo                   | Bass Drum              |
| 35      | Tom-tom                 | Tom-tom (single drum)  |
| 36      | Bateria                 | Drum set               |
| 37      | Bongôs                  | Bongos                 |
| 38      | Congas                  | Congas                 |
| 39      | Pratos                  | Cymbals (crash & ride) |
| 40      | Triângulo               | Triangle               |
| 41      | Pandeiro                | Tambourine             |
| 42      | Adufe                   | Tambour (frame drum)   |
| 43      | Sinos de Mão            | Handbells              |
| 44      | Sinos de Trenó          | Sleigh bells           |
| 45      | Castanholas             | Castanets              |
| 46      | Bloco de Madeira        | Wood block             |
| 47      | Blocos de Templo        | Temple blocks          |
| 48      | Maracas                 | Maracas                |
| 49      | Tam-Tam (Gongo)         | Tam-tam (gong)         |
| 50      | Crótalos                | Crotales               |
| 51      | Glockenspiel            | Glockenspiel           |
| 52      | Xilofone                | Xylophone              |
| 53      | Marimba                 | Marimba                |
| 54      | Vibrafone               | Vibraphone             |
| 55      | Sinos Tubulares         | Tubular bells          |

**Teclados**

| Posição | Instrumento (Português) | Instrumento (Inglês) |
| ------- | ----------------------- | -------------------- |
| 56      | Celesta                 | Celesta              |
| 57      | Piano                   | Piano                |
| 58      | Cravo                   | Harpsichord          |
| 59      | Órgão de Tubos          | Pipe organ           |
| 60      | Acordeão                | Accordion            |

**Harpa**

| Posição | Instrumento (Português) | Instrumento (Inglês) |
| ------- | ----------------------- | -------------------- |
| 61      | Harpa                   | Harp                 |

**Cordas de Arco**

| Posição | Instrumento (Português) | Instrumento (Inglês)     |
| ------- | ----------------------- | ------------------------ |
| 62      | Violino                 | Violin                   |
| 63      | Viola                   | Viola                    |
| 64      | Violoncelo              | Cello / Violoncello      |
| 65      | Contrabaixo             | Double bass / Contrabass |
