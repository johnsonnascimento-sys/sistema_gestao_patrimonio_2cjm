# Deploy Hostinger + Supabase

## Cabecalho

- Modulo: `docs`
- Funcao: checklist de deploy do backend e frontend para ambiente VPS Hostinger com banco Supabase.

## 1. Preparacao do servidor

1. Confirmar Docker ativo no Ubuntu 24.04.
2. Criar pasta de aplicacao no VPS.
3. Garantir porta externa livre para o backend (publica pode ser diferente da interna 3001).

## 2. Variaveis de ambiente backend

1. Definir `DATABASE_URL` apontando para Supabase.
2. Definir `DB_SSL=require`.
3. Definir `FRONTEND_ORIGIN` com a URL publica do frontend.
4. Definir `BACKEND_HOST_PORT` conforme porta escolhida.

### Observacao: IPv6 (Supabase)

- Alguns projetos Supabase expõem o host do Postgres apenas em IPv6 (registro DNS `AAAA`, sem `A`).
- Se o backend em Docker nao conseguir conectar (erro tipo `ENETUNREACH` para endereco IPv6), o servidor precisa ter conectividade IPv6 ativa.
- Alternativa: usar a string de conexao do **pooler** do Supabase (quando disponivel) que costuma oferecer IPv4.

## 3. Build e subida do backend

1. `docker compose build`
2. `docker compose up -d`
3. Validar `GET /health` e `GET /docs`.

## Deploy recomendado (VPS, sem CloudPanel)

Para rodar tudo por Docker na VPS (frontend + backend):

1. Criar um `.env` no diretorio do projeto com:
   - `DATABASE_URL=postgresql://postgres:<senha>@db.<ref>.supabase.co:5432/postgres`
   - `DB_SSL=require`
2. Subir:
   - `docker compose -f docker-compose.vps.yml up -d --build`
3. Acessar:
   - Frontend: `http://<IP_DA_VPS>:8080`
   - API (via proxy): `http://<IP_DA_VPS>:8080/api/health`

## 4. Build e publicacao do frontend

1. Em `frontend/.env`, definir `VITE_API_BASE_URL` para URL publica do backend.
2. `npm run --prefix frontend build`
3. Publicar conteudo de `frontend/dist` no Nginx/CloudPanel.

## 5. Validacao funcional

1. Testar `/health` pela tela `Operacoes API`.
2. Testar upload de CSV no `POST /importar-geafin`.
3. Testar fluxo de transferencia/cautela no `POST /movimentar`.

## 6. Pos-deploy

1. Habilitar backup do banco Supabase.
2. Monitorar logs do container backend.
3. Registrar versao implantada em changelog interno.

## 7. Migracoes SQL (quando nao houver `psql` no host)

Se o host nao tiver `psql` instalado, execute migracoes usando um container temporario do Postgres:

```bash
cd /opt/cjm-patrimonio/current
set -a; . ./.env; set +a

docker run --rm --network host \
  -v "$PWD":/work -w /work \
  postgres:16-alpine \
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/002_history_and_rules.sql
```
