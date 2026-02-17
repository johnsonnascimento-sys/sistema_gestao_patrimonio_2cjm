<!--
Modulo: wiki
Arquivo: frontend/src/wiki/14_admin_operacao_vps.md
Funcao no sistema: manual de operacao para administradores (VPS + Docker + Nginx), sem segredos.
-->

# Admin: operação na VPS (Docker/Nginx)

Esta página é para quem administra o servidor (VPS Hostinger + CloudPanel).

## Premissas (o que não mudar sem motivo)

- Docker Compose roda com `network_mode: host`.
- Frontend (container Nginx) atende em `127.0.0.1:8080`.
- Backend (Node) atende em `127.0.0.1:3001`.
- Nginx do host (CloudPanel) faz:
  - SSL/TLS do dominio
  - reverse proxy para `127.0.0.1:8080`
  - proxy dedicado `/api/` para `127.0.0.1:3001` (recomendado para evitar 504)

## Ver se o site está de pé

No host:

- `curl -i https://patrimonio2cjm.johnsontn.com.br/` deve retornar `200` e HTML da SPA.
- `curl -i https://patrimonio2cjm.johnsontn.com.br/api/health` deve retornar `200`.

## Logs (diagnóstico)

Docker:

- `docker ps`
- `docker logs -f cjm_backend`
- `docker logs -f cjm_frontend`

Nginx host:

- `tail -f /var/log/nginx/patrimonio2cjm.error.log`
- `tail -f /var/log/nginx/patrimonio2cjm.access.log`

## Deploy recomendado (script)

O jeito mais simples e consistente é usar o script de deploy do repositório:

```bash
cd /opt/cjm-patrimonio/releases/cjm-patrimonio
./scripts/vps_deploy.sh all
```

Para subir só uma parte:

```bash
./scripts/vps_deploy.sh backend
./scripts/vps_deploy.sh frontend
```

O script faz:

- `git pull` (ff-only)
- rebuild
- recriação dos containers (`cjm_backend`/`cjm_frontend`)

## Rebuild/restart (manual)

Se você preferir executar manualmente, rode no diretório do repositório na VPS (exemplo):

```bash
cd /opt/cjm-patrimonio/releases/cjm-patrimonio
docker compose -f docker-compose.vps.yml build backend
docker compose -f docker-compose.vps.yml up -d --no-deps --force-recreate backend
docker compose -f docker-compose.vps.yml build frontend
docker compose -f docker-compose.vps.yml up -d --no-deps --force-recreate frontend
```

Observação:

- Rebuild do frontend troca os arquivos estaticos.
- Por causa do Service Worker (PWA), alguns navegadores podem manter cache. Use hard refresh.

## Importacao GEAFIN e timeouts

Importação pode demorar (milhares de linhas). Para evitar 504:

- Aumente timeouts no Nginx (host e/ou container).
- Garanta `proxy_request_buffering off` no `location /api/`.
- Garanta `client_max_body_size` adequado (ex.: 15m).

## Onde ficam variáveis de ambiente

Por padrão:

- `.env` fica apenas na VPS, não versionado.
- `DATABASE_URL` aponta para Supabase (Postgres).

Nunca coloque segredos no repositório nem no Wiki.

## Recuperação rápida (checklist)

Se "Failed to fetch" aparecer no site:

1. `curl http://127.0.0.1:3001/health` no host.
2. Se falhar: backend caiu (ver logs).
3. Se ok: conferir Nginx `/api` no host e no container frontend.
4. Recarregar Nginx host: `nginx -t && systemctl reload nginx`.
