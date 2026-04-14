# AGENTS.md

## 🎯 Objetivo

Definir regras CLARAS de como o agente deve escrever código.

Este documento NÃO descreve o projeto — apenas como implementar.

---

## 🧠 Regras Absolutas

### 1. Simplicidade acima de tudo

- Sempre escolha a solução mais simples possível
- Evite abstrações desnecessárias
- Código deve ser óbvio de entender

---

### 2. Modularidade obrigatória

- Uma função = uma responsabilidade
- Um módulo = um domínio claro
- Separar sempre:
  - lógica de negócio
  - acesso a banco
  - filesystem
  - rede

---

### 3. Implementar + Testar + Rodar

Toda tarefa DEVE seguir:

1. Implementar
2. Criar testes
3. Rodar testes
4. Só então finalizar

---

## 🧪 Testes (MANDATÓRIO)

### Regras

- ❗ Nenhum código sem teste
- ❗ Nenhuma entrega sem rodar testes
- ❗ Testar comportamento, não implementação

---

### Cobertura mínima

- Caso feliz
- Caso de erro
- Edge cases

---

## 🧩 Padrões de Código

### Funções

- Máx ~30 linhas
- Nome claro e direto
- Uma única responsabilidade

---

### Estado

- Evitar estado global
- Preferir imutabilidade
- Passar dados por parâmetro

---

### Erros

- Nunca ignorar erro
- Nunca usar try/catch vazio
- Sempre tratar ou propagar erro

---

## 🏗 Arquitetura (OBRIGATÓRIA)

Separação em camadas:

- Core → lógica pura
- Infra → DB, FS, rede
- Application → orquestração

Regra crítica:

Core NÃO depende de Infra

---

## 🚫 Proibições

- ❌ Funções grandes
- ❌ Código duplicado
- ❌ Acoplamento entre módulos
- ❌ Regra de negócio acessando DB direto
- ❌ Código sem teste
- ❌ Finalizar sem rodar testes

---

## ✅ Checklist de entrega

Antes de finalizar:

- [ ] Código simples
- [ ] Funções pequenas
- [ ] Sem acoplamento indevido
- [ ] Testes escritos
- [ ] Testes passando
- [ ] Sem código morto ou debug

---

## 🔄 Regra Final

Sem teste = errado  
Não rodou teste = incompleto  
Código complexo = refatorar