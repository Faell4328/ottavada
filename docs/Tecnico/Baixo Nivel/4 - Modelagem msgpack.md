**Por questão de simplicidade, a documentação usa JSON nos exemplos, mas o arquivo real é um MessagePack.**

# 1. snapshot.msgpack

Um exemplo simplificado da estrutura.

```json
{
    "generatedAt": 1710684000,
    "categories": [
        {
            "id": "uuid-categoria-1",
            "name": "Clássica"
        }
    ],
    "categoriesSongs": [
        {
            "id": "uuid-relacao-1",
            "categoryId": "uuid-categoria-1",
            "songId": "uuid-musica-1"
        }
    ],
    "composers": [
        {
            "id": "uuid-compositor-1",
            "name": "Ludwig van Beethoven"
        }
    ],
    "composerSongs": [
        {
            "id": "uuid-relacao-2",
            "composerId": "uuid-compositor-1",
            "songId": "uuid-musica-1"
        }
    ],
    "arrangers": [
        {
            "id": "uuid-arranjador-1",
            "name": "Nikolai Rimsky-Korsakov"
        }
    ],
    "arrangerSongs": [
        {
            "id": "uuid-relacao-3",
            "arrangerId": "uuid-arranjador-1",
            "songId": "uuid-musica-1"
        }
    ],
    "songs": [
        {
            "id": "uuid-musica-1",
            "name": "Hino Nacional",
            "scores": [
                {
                    "id": "uuid-score-1",
                    "songId": "uuid-musica-1",
                    "name": "Flauta 1",
                    "fileExtension": ".musx"
                }
            ]
        }
    ]
}
```

---

# 2. events.msgpack

Os eventos são armazenados em ordem crescente de `timestamp`, com os novos registros adicionados ao final.

---

## 2.1. Categoria

Utiliza os `type`: `insert`, `update` e `delete`.

### 2.1.1. Inserção

```json
{
    "events": [
        {
            "id": "uuid-evento-1",
            "timestamp": 1710685000,
            "type": "insert",
            "entity": "categories",
            "entityId": "uuid-categoria-1",
            "data": [
                {
                    "field": "name",
                    "value": "Clássica"
                }
            ]
        }
    ]
}
```

### 2.1.2. Atualização

```json
{
    "events": [
        {
            "id": "uuid-evento-2",
            "timestamp": 1710685001,
            "type": "update",
            "entity": "categories",
            "entityId": "uuid-categoria-1",
            "data": [
                {
                    "field": "name",
                    "value": "Clássica 1"
                }
            ]
        }
    ]
}
```

### 2.1.3. Exclusão

```json
{
    "events": [
        {
            "id": "uuid-evento-3",
            "timestamp": 1710685002,
            "type": "delete",
            "entity": "categories",
            "entityId": "uuid-categoria-1"
        }
    ]
}
```

## 2.2. Relação categoria e música

Utiliza os `type`: `insert` e `delete`.

### 2.2.1. Inserção

```json
{
    "events": [
        {
            "id": "uuid-evento-4",
            "timestamp": 1710685003,
            "type": "insert",
            "entity": "categoriesSongs",
            "entityId": "uuid-relacao-1",
            "data": [
                {
                    "field": "categoryId",
                    "value": "uuid-categoria-1"
                },
                {
                    "field": "songId",
                    "value": "uuid-musica-1"
                }
            ]
        }
    ]
}
```

### 2.2.2. Exclusão

```json
{
    "events": [
        {
            "id": "uuid-evento-5",
            "timestamp": 1710685004,
            "type": "delete",
            "entity": "categoriesSongs",
            "entityId": "uuid-relacao-1"
        }
    ]
}
```

## 2.3. Compositores

Utiliza os `type`: `insert`, `update` e `delete`.

### 2.3.1. Inserção

```json
{
    "events": [
        {
            "id": "uuid-evento-6",
            "timestamp": 1710685005,
            "type": "insert",
            "entity": "composers",
            "entityId": "uuid-compositor-1",
            "data": [
                {
                    "field": "name",
                    "value": "Ludwig van Beethoven"
                }
            ]
        }
    ]
}
```

### 2.3.2. Atualização

```json
{
    "events": [
        {
            "id": "uuid-evento-7",
            "timestamp": 1710685006,
            "type": "update",
            "entity": "composers",
            "entityId": "uuid-compositor-1",
            "data": [
                {
                    "field": "name",
                    "value": "Beethoven"
                }
            ]
        }
    ]
}
```

### 2.3.3. Exclusão

```json
{
    "events": [
        {
            "id": "uuid-evento-8",
            "timestamp": 1710685007,
            "type": "delete",
            "entity": "composers",
            "entityId": "uuid-compositor-1"
        }
    ]
}
```

## 2.4. Relação compositor e música

Utiliza os `type`: `insert` e `delete`.

### 2.4.1. Inserção

```json
{
    "events": [
        {
            "id": "uuid-evento-9",
            "timestamp": 1710685008,
            "type": "insert",
            "entity": "composerSongs",
            "entityId": "uuid-relacao-2",
            "data": [
                {
                    "field": "composerId",
                    "value": "uuid-compositor-1"
                },
                {
                    "field": "songId",
                    "value": "uuid-musica-1"
                }
            ]
        }
    ]
}
```

### 2.4.2. Exclusão

```json
{
    "events": [
        {
            "id": "uuid-evento-10",
            "timestamp": 1710685009,
            "type": "delete",
            "entity": "composerSongs",
            "entityId": "uuid-relacao-2"
        }
    ]
}
```

## 2.5. Arranjadores

Utiliza os `type`: `insert`, `update` e `delete`.

### 2.5.1. Inserção

```json
{
    "events": [
        {
            "id": "uuid-evento-11",
            "timestamp": 1710685010,
            "type": "insert",
            "entity": "arrangers",
            "entityId": "uuid-arranjador-1",
            "data": [
                {
                    "field": "name",
                    "value": "Nikolai Rimsky-Korsakov"
                }
            ]
        }
    ]
}
```

### 2.5.2. Atualização

```json
{
    "events": [
        {
            "id": "uuid-evento-12",
            "timestamp": 1710685011,
            "type": "update",
            "entity": "arrangers",
            "entityId": "uuid-arranjador-1",
            "data": [
                {
                    "field": "name",
                    "value": "Korsakov"
                }
            ]
        }
    ]
}
```

### 2.5.3. Exclusão

```json
{
    "events": [
        {
            "id": "uuid-evento-13",
            "timestamp": 1710685012,
            "type": "delete",
            "entity": "arrangers",
            "entityId": "uuid-arranjador-1"
        }
    ]
}
```

## 2.6. Relação arranjador e música

Utiliza os `type`: `insert` e `delete`.

### 2.6.1. Inserção

```json
{
    "events": [
        {
            "id": "uuid-evento-14",
            "timestamp": 1710685013,
            "type": "insert",
            "entity": "arrangerSongs",
            "entityId": "uuid-relacao-3",
            "data": [
                {
                    "field": "arrangerId",
                    "value": "uuid-arranjador-1"
                },
                {
                    "field": "songId",
                    "value": "uuid-musica-1"
                }
            ]
        }
    ]
}
```

### 2.6.2. Exclusão

```json
{
    "events": [
        {
            "id": "uuid-evento-15",
            "timestamp": 1710685014,
            "type": "delete",
            "entity": "arrangerSongs",
            "entityId": "uuid-relacao-3"
        }
    ]
}
```

## 2.7. Músicas

Utiliza os `type`: `insert`, `update` e `delete`.

### 2.7.1. Inserção

```json
{
    "events": [
        {
            "id": "uuid-evento-16",
            "timestamp": 1710685015,
            "type": "insert",
            "entity": "songs",
            "entityId": "uuid-musica-1",
            "data": [
                {
                    "field": "name",
                    "value": "Hino Nacional"
                },
                {
                    "field": "path",
                    "value": "C:/Repertorio/Hino Nacional"
                }
            ]
        }
    ]
}
```

### 2.7.2. Atualização

```json
{
    "events": [
        {
            "id": "uuid-evento-17",
            "timestamp": 1710685016,
            "type": "update",
            "entity": "songs",
            "entityId": "uuid-musica-1",
            "data": [
                {
                    "field": "name",
                    "value": "Hino Nacional ##"
                }
            ]
        }
    ]
}
```

### 2.7.3. Exclusão

```json
{
    "events": [
        {
            "id": "uuid-evento-18",
            "timestamp": 1710685017,
            "type": "delete",
            "entity": "songs",
            "entityId": "uuid-musica-1"
        }
    ]
}
```

## 2.8. Partituras

Utiliza os `type`: `insert`, `update` e `delete`.

### 2.8.1. Inserção

```json
{
    "events": [
        {
            "id": "uuid-evento-19",
            "timestamp": 1710685018,
            "type": "insert",
            "entity": "scores",
            "entityId": "uuid-score-1",
            "data": [
                {
                    "field": "songId",
                    "value": "uuid-musica-1"
                },
                {
                    "field": "name",
                    "value": "Flauta 1"
                },
                {
                    "field": "fileExtension",
                    "value": ".musx"
                }
            ]
        }
    ]
}
```

### 2.8.2. Atualização

```json
{
    "events": [
        {
            "id": "uuid-evento-20",
            "timestamp": 1710685019,
            "type": "update",
            "entity": "scores",
            "entityId": "uuid-score-1",
            "data": [
                {
                    "field": "songId",
                    "value": "uuid-musica-1"
                },
                {
                    "field": "name",
                    "value": "Flauta 1 (Solo)"
                },
                {
                    "field": "fileExtension",
                    "value": ".musx"
                }
            ]
        }
    ]
}
```

### 2.8.3. Exclusão

```json
{
    "events": [
        {
            "id": "uuid-evento-21",
            "timestamp": 1710685020,
            "type": "delete",
            "entity": "scores",
            "entityId": "uuid-score-1"
        }
    ]
}
```