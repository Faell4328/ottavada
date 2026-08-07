# IMPORTANTE

Os scripts de build preparam o arquivo `rclone` antes do build:

- Windows: copia `rclone64.exe` ou `rclone.exe` para `rclone`.
- macOS/Linux: espera o binário Unix em `rclone`.

O arquivo `rclone` é ignorado pelo Git porque é um binário específico da plataforma.
