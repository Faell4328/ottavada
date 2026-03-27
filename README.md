Um gerenciador de partituras para Windows que organiza, acompanha o progresso e mantém backups seguros da sua biblioteca musical. Desenvolvido para dar liberdade ao músico: seus arquivos continuam sendo seus, sem dependência do aplicativo. Ele foi projetado para ter um computador Servidor e um ou vários computadores Clientes.

# Estrutura da Documentação

A documentação do projeto está organizada para manter clareza, simplicidade e facilidade de manutenção. Ela está no diretório: `/docs`, separada igual a descrição abaixo.

## 1. Requisitos (o que)
Define o que o sistema deve fazer.

Inclui:
- Requisitos funcionais
- Requisitos não funcionais

> Este é o núcleo do projeto. Todas as decisões devem respeitar este documento.

## 2. Arquitetura (como)
Define como o sistema é estruturado.

Inclui:
- Arquitetura geral (Cliente/Servidor)
- Componentes (Frontend, Backend, Cloud)
- Decisões técnicas

## 3. Modelagem de Dados (como os dados existem)
Define como os dados são organizados e persistidos.

Inclui:
- Estrutura do banco de dados (SQLite)
- Estrutura do MessagePack
- Arquivos de configuração (`tauri-plugin-store`)

## 4. Fluxos (como acontece na prática)
Define o comportamento do sistema em execução.

Inclui:
- Passo a passo das funcionalidades
- Exemplos: verificar alterações, backup, inicialização

## 5. Versões (evolução)
Define a evolução do sistema ao longo do tempo.

Inclui:
- Funcionalidades por versão
- Roadmap do projeto

## 6. Decisões (histórico técnico)
Registra decisões técnicas e seus motivos.

Inclui:
- Escolhas de tecnologia (ex: pCloud vs Google Drive)
- Trade-offs
- Problemas encontrados e soluções adotadas

> Este documento serve como histórico técnico do projeto.