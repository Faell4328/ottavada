// REMOVIDO: Funcionalidade de exportar banco de dados completo para MessagePack
//
// A exportação de banco de dados completo foi removida conforme mudança na documentação v0.3.
// 
// A estratégia correta é:
// - Exportar apenas as mudanças (tabela "changed") como {computerId}.msgpack.zst
// - Não exportar todo o banco de dados como database.msgpack.zst
// 
// TODO para próximas versões:
// - Implementar export_changes_to_msgpack() que lê a tabela "changed" e gera {computerId}.msgpack
// - Isso será feito quando o fluxo de sincronização for completamente definido

