O Ottavada no modo **Gerir** mantém todas as músicas e partituras no catálogo local. O status define quais dados são publicados para o provedor de nuvem e exibidos pelo Ottavada no modo **Consultar**.

# Músicas

- **Envio permitido**: a música possui pelo menos uma partitura com status **Envio permitido**. Internamente utiliza `main` para esse controle.

- **Envio não permitido**: não possui nenhuma partitura com status **Envio permitido**, mas possui ao menos uma partitura com status **Envio não permitido**. Internamente utiliza `draft` para esse controle.

- **Sem partitura**: a música não possui nenhuma partitura disponível. Internamente utiliza `not_found` para esse controle.
  
  - Isso ocorre quando a música foi previamente indexada com partituras, mas, por algum motivo, o diretório ou os arquivos não foram encontrados.

## Observações

Os status **Envio permitido** e **Envio não permitido** podem ser definidos manualmente ou automaticamente, já o status **Sem partitura** é sempre automático.

Quando o status da música é alterado manualmente, o Ottavada propaga a alteração para todas as suas partituras, exceto as partituras com status ignorada (`ignored`). Uma partitura ignorada permanece ignorada até que o usuário altere seu status individualmente.

Quando o status de uma partitura é alterado individualmente, o status da música é recalculado seguindo as regras definidas acima.

---

# Partituras

- **Envio permitido**: são enviadas ao provedor de nuvem e ficam disponíveis para os clientes. Internamente utiliza `main` para esse controle.
- **Envio não permitido**: não são enviadas ao provedor de nuvem. Internamente utiliza `draft` para esse controle.
- **Ignorada**: permanece na interface, mas não participa da verificação de alterações nem é enviada ao provedor de nuvem. Internamente utiliza `ignored` para esse controle. Esse status não é alterado automaticamente quando o status da música muda.

---

# Na prática

- Músicas com status **envio não permitido** ou **sem partitura** não são disponibilizadas para o cliente e são removidas caso já existam nele.

- Partituras com status **envio não permitido** ou **ignorada** não são enviadas ao cliente. Se já estiverem presentes, também são removidas.

- Quando uma partitura é alterada de **envio permitido** para **envio não permitido**, sua versão anterior em **envio permitido** não é preservada, sendo removida do provedor de nuvem e, consequentemente, do cliente.
