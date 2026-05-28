# TLS certificates

Place Nginx PEM files here before starting `docker compose` (HTTPS server blocks require them).

| File | Domain |
|------|--------|
| `www.admin.chenchar.com.fullchain.pem` | Admin UI |
| `www.admin.chenchar.com.key` | Admin UI |
| `api.chenchar.com.fullchain.pem` | API gateway |
| `api.chenchar.com.key` | API gateway |

Apply for free certificates in [Tencent Cloud SSL](https://console.cloud.tencent.com/ssl), download the Nginx bundle, and rename files to match the table above.
