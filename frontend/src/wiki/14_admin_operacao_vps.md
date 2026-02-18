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
cd /opt/cjm-patrimonio/current
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
- recriação **somente** do(s) container(s) do alvo escolhido:
  - `frontend` recria apenas `cjm_frontend` (o backend deve permanecer no ar).
  - `backend` recria apenas `cjm_backend` (o frontend deve permanecer no ar).
- (quando `backend` ou `all`) aguarda o backend responder `GET /health` para evitar 502 logo após o restart.

Se após um deploy você vir `502 Bad Gateway` na UI (especialmente em "Consulta de Bens"):
- o backend pode ter sido derrubado; rode `./scripts/vps_deploy.sh all` para subir tudo novamente.

## Rebuild/restart (manual)

Se você preferir executar manualmente, rode no diretório do repositório na VPS (exemplo):

```bash
cd /opt/cjm-patrimonio/current
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

## Upload de fotos para o Drive (via n8n)

Uso:

- A UI permite anexar **foto do item** e **foto de referência do SKU** no modal de "Detalhes do bem".
- O binário da foto não fica no banco: o backend envia a imagem ao n8n (webhook) que faz upload no Google Drive e devolve uma URL. O sistema grava apenas o link.

Pré-requisitos:

1. Importar no n8n o workflow: `automations/n8n_drive_upload_fotos_webhook.json`
2. Configurar a credencial do Google Drive no node "Google Drive - Upload" do workflow.
3. Definir no `.env` da VPS:

```bash
N8N_DRIVE_PHOTOS_WEBHOOK_URL=<production_url_do_webhook_no_n8n>
DRIVE_PHOTOS_FOLDER_ID=1DN-hBXCZ21t4Mx4Pel_w3QisitOkc9MI
```

4. Garantir que o `docker-compose.vps.yml` repassa as variáveis `N8N_DRIVE_PHOTOS_WEBHOOK_URL` e `DRIVE_PHOTOS_FOLDER_ID` para o serviço `backend`.
5. Deploy do backend:

```bash
./scripts/vps_deploy.sh backend
```

## Ativar autenticação (login) em produção

Pré-requisitos:

1. Banco (Supabase) precisa ter as colunas de autenticação em `perfis`.
   - Migração: `database/006_auth_and_access.sql`
2. Backend precisa de um segredo JWT configurado no `.env`.
3. O `docker-compose.vps.yml` precisa repassar `AUTH_*` para o serviço `backend` (já previsto no repo).

Passo a passo (VPS):

1. Editar o arquivo de ambiente do backend (no repo da VPS):

```bash
cd /opt/cjm-patrimonio/current
nano .env
```

2. Adicionar/ajustar:

```bash
AUTH_ENABLED=true
AUTH_JWT_SECRET=<defina_um_segredo_forte_aqui>
AUTH_JWT_EXPIRES_IN=12h
```

3. Rebuild do backend:

```bash
./scripts/vps_deploy.sh backend
```

4. Validar:

- `curl -sS https://patrimonio2cjm.johnsontn.com.br/api/health` retorna `authEnabled: true`.
- Abrir o site e confirmar que aparece a tela de **Login**.

Operação:

- Um perfil existente (matrícula já cadastrada) usa "Primeiro acesso" para definir senha.
- O primeiro "primeiro acesso" vira `ADMIN` se ainda não existir nenhum `ADMIN` cadastrado (bootstrap controlado).

## Padronização do diretório "current" (governança)

Regra operacional:

- **Sempre** subir backend/frontend a partir de um único diretório: `/opt/cjm-patrimonio/current`.
- Não misturar "deploy" entre caminhos diferentes (ex.: `/opt/cjm-patrimonio/current` e `/opt/cjm-patrimonio/releases/...`).

Se você herdou uma VPS com múltiplos diretórios, o alvo é:

1. Ter um repo Git em `/opt/cjm-patrimonio/current` (com `.git`, `docker-compose.vps.yml` e `scripts/vps_deploy.sh`).
2. Rodar deploys sempre desse caminho.

Nunca coloque segredos no repositório nem no Wiki.

## Recuperação rápida (checklist)

Se "Failed to fetch" aparecer no site:

1. `curl http://127.0.0.1:3001/health` no host.
2. Se falhar: backend caiu (ver logs).
3. Se ok: conferir Nginx `/api` no host e no container frontend.
4. Recarregar Nginx host: `nginx -t && systemctl reload nginx`.
