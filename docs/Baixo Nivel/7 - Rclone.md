# Configuração

O Ottavada utiliza um provedor por vez, você pode escolher entre **Koofr** ou **Google Drive**.

No **Koofr** é criado um `remote` chamado "koofr" e no **Google Drive** é "gdrive".

A instância do rclone é sempre encerrada (`taskkill`) quando o upload ou download é finalizado 

---

O rclone está configurado com:

- `transfers = 4`: 4 arquivos ao mesmo tempo
- `retries = 2`: tenta novamente 2 vezes se falhar
- `low_level_retries = 10`: mais tentativas em erros leves de rede
- `connect_timeout = 10s`: tempo máximo para conectar
- `io_timeout = 180s`: tempo sem atividade até falhar
- `rc_timeout_ms = 3000`: timeout de 3s para comandos via API (RC)

---

Para acompanhar o progresso é usado o parâmetro: `--rc-addr=127.0.0.1:5572`. A cada segundo é consultado (pelo front) ao servidor que o rclone cria, o progresso do upload/download.



#
