# composers

Tabela responsável por armazenar todos os compositores.

| Campo | Tipo          | PK  | FK  | Referência | Obrigatório? | Onde?              |
| ----- | ------------- | --- | --- | ---------- | ------------ | ------------------ |
| id    | text (`uuid`) | Sim | Não | Não        | Sim          | Cliente / Servidor |
| name  | text          | Não | Não | Não        | Sim          | Cliente / Servidor |

# composersSongs

| Campo       | Tipo          | PK  | FK  | Referência  | Obrigatório? | Onde?              |
| ----------- | ------------- | --- | --- | ----------- | ------------ | ------------------ |
| id          | text (`uuid`) | Sim | Não | Não         | Sim          | Cliente / Servidor |
| composer_id | text (`uuid`) | Não | Sim | composer.id | Sim          | Cliente / Servidor |
| song_id     | text (`uuid`) | Não | Sim | songs.id    | Sim          | Cliente / Servidor |

# arrangers

Tabela responsável por armazenar todos os arranjadores.

| Campo | Tipo          | PK  | FK  | Referência | Obrigatório? | Onde?              |
| ----- | ------------- | --- | --- | ---------- | ------------ | ------------------ |
| id    | text (`uuid`) | Sim | Não | Não        | Sim          | Cliente / Servidor |
| name  | text          | Não | Não | Não        | Sim          | Cliente / Servidor |

# arrangersSongs

| Campo       | Tipo          | PK  | FK  | Referência  | Obrigatório? | Onde?              |
| ----------- | ------------- | --- | --- | ----------- | ------------ | ------------------ |
| id          | text (`uuid`) | Sim | Não | Não         | Sim          | Cliente / Servidor |
| arranger_id | text (`uuid`) | Não | Sim | arranger.id | Sim          | Cliente / Servidor |
| song_id     | text (`uuid`) | Não | Sim | songs.id    | Sim          | Cliente / Servidor |

# categories

Tabela responsável por armazenar todas as categorias.

| Campo | Tipo          | PK  | FK  | Referência | Obrigatório? | Onde?              |
| ----- | ------------- | --- | --- | ---------- | ------------ | ------------------ |
| id    | text (`uuid`) | Sim | Não | Não        | Sim          | Cliente / Servidor |
| name  | text          | Não | Não | Não        | Sim          | Cliente / Servidor |

# categoriesSongs

Tabela responsável por armazenar todas as relações entre categorias e música (N:N).

| Campo       | Tipo          | PK  | FK  | Referência    | Obrigatório? | Onde?              |
| ----------- | ------------- | --- | --- | ------------- | ------------ | ------------------ |
| id          | text (`uuid`) | Sim | Não | Não           | Sim          | Cliente / Servidor |
| category_id | text (`uuid`) | Não | Sim | categories.id | Sim          | Cliente / Servidor |
| song_id     | text (`uuid`) | Não | Sim | songs.id      | Sim          | Cliente / Servidor |

# songs

Tabela responsável por armazenar as informações das músicas.

| Campo                       | Tipo              | PK  | FK  | Referência | Obrigatório? | Onde?              |
| --------------------------- | ----------------- | --- | --- | ---------- | ------------ | ------------------ |
| id                          | text (`uuid`)     | Sim | Não | Não        | Sim          | Cliente / Servidor |
| name                        | text              | Não | Não | Não        | Sim          | Cliente / Servidor |
| is_favorite                 | bool              | Não | Não | Não        | Não          | Cliente / Servidor |
| path                        | text              | Não | Não | Não        | Sim          | Servidor           |
| last_score_file_modified_at | integer           | Não | Não | Não        | Sim          | Servidor           |
| status                      | (`main`  `draft`) | Não | Não | Não        | Sim          | Servidor           |

- `path` - diretório onde as partituras estão sendo indexadas.

# scores

Tabela responsável por armazenar as informações das partituras.

| Campo            | Tipo                           | PK  | FK  | Referência | Obrigatório? | Onde?              |
| ---------------- | ------------------------------ | --- | --- | ---------- | ------------ | ------------------ |
| id               | text (`uuid`)                  | Sim | Não | Não        | Sim          | Cliente / Servidor |
| song_id          | text (`uuid`)                  | Não | Sim | songs.id   | Sim          | Cliente / Servidor |
| name             | text                           | Não | Não | Não        | Sim          | Cliente / Servidor |
| file_name        | text                           | Não | Não | Não        | Sim          | Servidor           |
| file_extension   | text                           | Não | Não | Não        | Sim          | Cliente / Servidor |
| file_modified_at | integer                        | Não | Não | Não        | Sim          | Servidor           |
| file_size        | integer                        | Não | Não | Não        | Sim          | Servidor           |
| status           | (`main`, `draft` ou `ignored`) | Não | Não | Não        | Sim          | Servidor           |

- `file_name` - nome do arquivo e a extensão, ex: `flauta.mus`.

- `file_modified_at` - timestamp da última modificação do arquivo.

- `file_size` - tamanho do arquivo.

# changes

Tabela responsável por armazenar todas as alterações até gerar o arquivo `events.msgpack`.

| Campo     | Tipo                                                                                                               | PK  | FK  | Referência | Obrigatório? | Onde?    |
| --------- | ------------------------------------------------------------------------------------------------------------------ | --- | --- | ---------- | ------------ | -------- |
| id        | text (`uuid`)                                                                                                      | Sim | Não | Não        | Sim          | Servidor |
| type      | (`insert`, `update` ou `delete`)                                                                                   | Não | Não | Não        | Sim          | Servidor |
| entity    | (`categories`, `categoriesSongs`, `composers`, `composerSongs`, `arrangers`, `arrangerSongs`, `songs` ou `scores`) | Não | Não | Não        | Sim          | Servidor |
| entity_id | text (`uuid`)                                                                                                      | Não | Sim | entity.id  | Sim          | Servidor |
| field     | text                                                                                                               | Não | Não | Não        | Não          | Servidor |
| value     | text                                                                                                               | Não | Não | Não        | Não          | Servidor |
| timestamp | integer                                                                                                            | Não | Não | Não        | Sim          | Servidor |

- `type` - é o que foi feito: inserido, atualizado ou deletado.

- `entity` - é o nome da tabela que foi alterada.

- `entity_id` - é o id do elemento da tabela que foi alterado.

- `field` - é o nome do campo que foi alterado na tabela.

- `value` - é o valor que foi inserido ou atualizado.

# backupQueue

Essa tabela responsável por controlar a geração dos `{songId}.tar.zst` e que todos tenha sido feito o upload para a nuvem.

| Campo   | Tipo                             | PK  | FK  | Referência | Obrigatório? | Onde?    |
| ------- | -------------------------------- | --- | --- | ---------- | ------------ | -------- |
| song_id | text (`uuid`)                    | Sim | Não | Não        | Sim          | Servidor |
| status  | (`pending`, `processing` e `ok`) | Não | Não | Não        | Sim          | Servidor |

- `status`:
  
  - `pending` - a música está pronta para ser agrupada e compactada.
  
  - `processing` - a música foi agrupada e compactada, pronta para ser enviada a nuvem.
  
  - `ok` - a música já foi enviada para nuvem.

# errors

Tabela responsável por armazenar todos os erros.

| Campo     | Tipo          | PK  | FK  | Referência | Obrigatório? | Onde?              |
| --------- | ------------- | --- | --- | ---------- | ------------ | ------------------ |
| id        | text (`uuid`) | Sim | Não | Não        | Sim          | Cliente / Servidor |
| message   | text          | Não | Não | Não        | Sim          | Cliente / Servidor |
| timestamp | integer       | Não | Não | Não        | Sim          | Cliente / Servidor |