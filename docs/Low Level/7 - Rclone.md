# Configuration

Ottavada uses one provider at a time; you can choose between **Koofr** or **Google Drive**.

In **Koofr** a `remote` named "koofr" is created and in **Google Drive** it is "gdrive".

The rclone instance is terminated when the operation finishes. On Windows, residual processes are also terminated at startup; `taskkill` should not be assumed as a universal mechanism, because Linux and macOS use another termination process.

---

rclone is configured with:

- `transfers = 4`: 4 files at the same time
- `retries = 2`: tries again 2 times if it fails
- `low_level_retries = 10`: more attempts on light network errors
- `connect_timeout = 10s`: maximum time to connect
- `io_timeout = 180s`: time without activity until failure
- `rc_timeout_ms = 3000`: 3s timeout for commands via API (RC)

---

To track progress, the `--rc --rc-addr=127.0.0.1:5572` parameter is used. The frontend periodically queries the process's RC API to obtain bytes, percentage, speed and ETA. The port is local and must not be exposed to the network.



#
