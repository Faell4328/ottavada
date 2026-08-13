# AGENTS.md

## 🎯 Objective

Define CLEAR rules for how the agent should write code.

This document does NOT describe the project — only how to implement it.

---

## 🧠 Absolute Rules

### 1. Simplicity above all

- Always choose the simplest possible solution
- Avoid unnecessary abstractions
- Code must be obvious to understand

---

### 2. Mandatory modularity

- One function = one responsibility
- One module = one clear domain
- Always separate:
  - business logic
  - database access
  - filesystem
  - network

---

### 3. Implement + Test + Run

Every task MUST follow:

1. Implement
2. Create tests
3. Run tests
4. Only then finish

---

## 🧪 Tests (MANDATORY)

### Rules

- ❗ No code without a test
- ❗ No delivery without running tests
- ❗ Test behavior, not implementation

---

### Minimum coverage

- Happy path
- Error case
- Edge cases

---

## 🧩 Code Standards

### Functions

- Max ~30 lines
- Clear and direct name
- A single responsibility

---

### State

- Avoid global state
- Prefer immutability
- Pass data by parameter

---

### Errors

- Never ignore an error
- Never use an empty try/catch
- Always handle or propagate the error

---

## 🏗 Architecture (MANDATORY)

Separation into layers:

- Core → pure logic
- Infra → DB, FS, network
- Application → orchestration

Critical rule:

Core does NOT depend on Infra

---

## 🚫 Prohibitions

- ❌ Large functions
- ❌ Duplicated code
- ❌ Coupling between modules
- ❌ Business rule accessing the DB directly
- ❌ Code without tests
- ❌ Finishing without running tests

---

## ✅ Delivery checklist

Before finishing:

- [ ] Simple code
- [ ] Small functions
- [ ] No undue coupling
- [ ] Tests written
- [ ] Tests passing
- [ ] No dead or debug code

---

## 🔄 Final Rule

No test = wrong  
Didn't run tests = incomplete  
Complex code = refactor
