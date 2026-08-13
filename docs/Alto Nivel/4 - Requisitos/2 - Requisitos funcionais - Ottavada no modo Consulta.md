# 1. Músicas

## 1.1. Operações disponíveis

O usuário deve poder:

- **abrir**, expande a música e mostrar todas as partituras;
- **abrir local**, abre no explorador de arquivos em uma pasta temporária com as partituras daquela música descompactadas;
- **adicionar/remover nos favoritos**.

---

# 2. Partituras

## 2.1. Operações disponíveis

O usuário deve poder:

- **abrir**, será aberto a partitura utilizando o aplicativo padrão associado a extensão do arquivo.

---

# 3. Transparência operacional

O sistema deve exibir o progresso de todas as etapas executadas.

## 3.1. Etapas download da nuvem (consultar alterações)

Etapas:

1. Identificar alterações;
2. Aplicar eventos e/ou snapshot;
3. Baixar arquivos novos ou modificados.

Só deve passar para a etapa 2 e 3 se for identificado algo na etapa 1.

---

# 4. Configurações

O usuário deve poder:

- alterar o nome do computador;
- alterar o nome da organização;
- alterar o modo do Ottavada;
- alterar o provedor de nuvem;
- consultar atualização;
- alterar idioma;

---

# 5. Inicialização

Durante a iniciação do aplicativo, o sistema deve:

1. Verificar se existe atualização.

2. Enviar telemetria.

3. Consultar alterações.
