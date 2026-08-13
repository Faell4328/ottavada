# Configuração

O Ottavada utiliza um provedor por vez, você pode escolher entre **Koofr** ou **Google Drive**.

No **Koofr** é criado um `remote` chamado "koofr" e no **Google Drive** é "gdrive".

A instância do rclone é encerrada quando a operação termina. No Windows, processos residuais também são finalizados na inicialização; não se deve assumir `taskkill` como mecanismo universal, pois Linux e macOS usam outro processo de encerramento.

---

O rclone está configurado com:

- `transfers = 4`: 4 arquivos ao mesmo tempo
- `retries = 2`: tenta novamente 2 vezes se falhar
- `low_level_retries = 10`: mais tentativas em erros leves de rede
- `connect_timeout = 10s`: tempo máximo para conectar
- `io_timeout = 180s`: tempo sem atividade até falhar
- `rc_timeout_ms = 3000`: timeout de 3s para comandos via API (RC)

---

Para acompanhar o progresso é usado o parâmetro `--rc --rc-addr=127.0.0.1:5572`. O frontend consulta periodicamente a API RC do processo para obter bytes, porcentagem, velocidade e ETA. A porta é local e não deve ser exposta à rede.



#
