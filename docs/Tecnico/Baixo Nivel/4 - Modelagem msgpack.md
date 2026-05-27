**Por questão de simplicidade, irei documenta com `JSON`, mas o arquivo real é um `MessagePack`**.

# snapshot.msgpack

```json
{
  "generatedAt": 1710684000,
  // Categorias
  "categories": [
    {
      "id": "ID Categoria 1"
      "name": "Nome Categoria 1"
    }
  ],
  // Músicas
  "songs": [
    {
      "id": "ID Música 1",
      "name": "Nome Música 1",
      "composer": "ID Compositor 1",
      "arranger": "ID Arranjador 1",
      "categoriesId": ["ID Categoria 1", "ID Categoria 2"],
      "path": "caminho indexado23"
      // Partituras da música
      "scores": [
          {
              "id": "xyz123",
              "name": "Flauta",
              "fileExtension": "musx",
              "status": "main"
          }
      ],
    }
  ]
}
```

# events.msgpack

```json
{
    "computerId": "1iu2312",
    "events": [
        {
            "id": "uuid",
            "timestamp": 1710685000,

            "type": "insert", // insert | update | delete
            "entity": "songs", // songs | scores | categories
            "entityId": "2141ko24",

            "data":[
                {
                    "field": "name",
                    "newValue": "HINO NACIONAL"
                },
                {
                    "field": "composer",
                    "newValue": "JOEL"
                }
            ]
        },
        // Inserir nova música
        {
            "id": "uuid",
            "timestamp": 1710685000,

            "type": "insert",
            "entity": "songs",
            "entityId": "2141ko24",

            "data": [
                {
                    "field": "name",
                    "value": "Da dus Glória"
                }
            ]
        },
        // Inserir nova partitura (música já existe)
        {
            "id": "uuid",
            "timestamp": 1710685000,

            "type": "insert",
            "entity": "scores",
            "entityId": "3k123lj12l",

            "data": [
                {
                    "field": "songId",
                    "newValue": "faskdf312"
                },
                {
                    "field": "name",
                    "value": "Flauta"
                }
            ]
        },
        // Atualizar
        {
            "id": "uuid",
            "timestamp": 1710685000,

            "type": "update",
            "entity": "songs",
            "entityId": "2141ko24",

            "data": [
                {
                    "field": "name",
                    "value": "Hino Nacional"
                }
            ]
        },
        // Deletar
        {
            "id": "uuid",
            "timestamp": 1710685000,

            "type": "delete",
            "entity": "songs",
            "entityId": "2141ko24"
        },

        // Inserindo nova categoria
        {
            "id": "uuid",
            "timestamp": 1710685000,

            "type": "insert",
            "entity": "categories",
            "entityId": "1234klj4",

            "data": [
                {
                    "field": "name",
                    "value": "Clássica"
                }
            ]

        },
        // Inserindo nova relação categoria
        {
            "id": "uuid",
            "timestamp": 1710685000,

            "type": "insert",
            "entity": "categoriesSongs",
            "entityId": "3k12lj3l12çk",

            "data": [
                {
                    "field": "categoryId",
                    "value": "çflkadsjl124"
                },
                {
                    "field": "songId",
                    "value": "fasdjfkl2345234"
                }
            ]
        },
        // Deletando categoria
        {
            "id": "uuid",
            "timestamp": 1710685000,

            "type": "delete",
            "entity": "categoriesSongs",
            "entityId": "3k12lj3l12çk",
        }
    ]
}
```

! Os eventos ficam em ordem crescente. Os novos eventos são adicionados ao final