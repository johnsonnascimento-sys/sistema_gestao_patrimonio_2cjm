# Sistema de Gestao Patrimonial - 2a CJM

## Cabecalho

- Modulo: `repositorio`
- Arquivo: `README.md`
- Funcao no sistema: ponto de entrada para entender, rodar e operar o projeto localmente.
- Objetivo: sistema deterministico (sem IA na execucao), auditavel e aderente ao ATN 303/2008.

## O que voce precisa saber (em 60 segundos)

- O banco (Supabase/Postgres) e a fonte de verdade do patrimonio.
- O backend (`/backend`) e uma API HTTP que aplica validacoes e grava no banco.
- O frontend (`/frontend`) e um site React que chama a API.
- O n8n e apenas automacao (geracao de PDF + upload), descrito em `/automations`.

## O que funciona hoje

- Banco com schema, triggers e migracoes de compliance (ver `database/001_initial_schema.sql` e `database/002_history_and_rules.sql`).
- Carga GEAFIN ja realizada no Supabase (3833 bens).
- API backend:
  - `GET /health` (saude)
  - `GET /stats` (contagens basicas)
  - `GET /bens` (consulta paginada de bens)
  - `POST /importar-geafin` (importacao CSV Latin1)
  - `POST /movimentar` (transferencia/cautela)
  - `GET /inventario/eventos` (listar eventos)
  - `POST /inventario/eventos` (abrir evento EM_ANDAMENTO)
  - `PATCH /inventario/eventos/:id/status` (encerrar/cancelar)
  - `POST /inventario/sync` (sincronizacao offline-first de contagens)
  - `GET /docs` (Swagger)
- Frontend:
  - Aba `Consulta de Bens`: mostra dados reais via `/stats` e `/bens`
  - Aba `Operacoes API`: testa `/health`, importa CSV, executa `/movimentar`
  - Aba `Modo Inventario`: offline-first (fila em IndexedDB) + sync deterministico via `/inventario/sync`
  - Aba `Wizard Art. 141`: UI de compliance (fluxo guiado) para classificar inserviveis

## Como ver o site (local)

### 1) Subir o backend

Em PowerShell:

```powershell
cd backend
npm install

$env:PORT="3001"
$env:DB_SSL="require"
$env:FRONTEND_ORIGIN="http://localhost:5173"
$env:DATABASE_URL="postgresql://postgres:<SUA_SENHA>@db.<SEU_REF>.supabase.co:5432/postgres"

npm run start
```

Verifique:

- Swagger: `http://localhost:3001/docs`
- Saude: `http://localhost:3001/health`

### 2) Subir o frontend

Em outro terminal:

```powershell
cd frontend
npm install
npm run dev
```

Abra:

- Site: `http://localhost:5173`
- Comece pela aba `Consulta de Bens` (dados reais)

## Roteiro rapido (para entender na pratica)

1. No site, abra `Consulta de Bens` e pesquise um tombamento (copie clicando no botao do tombo).
2. Va em `Operacoes API` e clique em `Testar /health` (confirma que UI -> API -> DB esta OK).
3. Ainda em `Operacoes API`, crie um `perfil` (isso preenche automaticamente os campos de autorizacao/executante).
4. Em `Movimentar bem`, cole o tombamento, informe `termoReferencia`, escolha uma `unidade destino` e execute.
5. Volte em `Consulta de Bens` e consulte o mesmo tombamento para ver a mudanca (unidade/status).

## Rotas de API mais importantes (para entender o sistema)

- `GET /stats`: quantos bens existem e distribuicao por unidade/status.
- `GET /bens?limit=50&offset=0`: lista paginada.
- `GET /bens?numeroTombamento=1290001788`: busca por tombamento exato.
- `GET /bens?q=ARMARIO`: busca por texto parcial na descricao.
- `POST /perfis`: cria perfil (necessario para autorizar/executar movimentacoes).

## Regras legais (onde estao aplicadas)

- Art. 183 (AN303_Art183): bloqueio de mudanca de `unidade_dona_id` durante inventario (trigger no DB).
- Art. 185 (AN303_Art185): divergencias devem gerar ocorrencia/regularizacao sem troca automatica (constraints em `contagens`).
- Arts. 124 e 127 (AN303_Art124 / AN303_Art127): cautela vs transferencia (constraints em `movimentacoes` e logica do endpoint `/movimentar`).
- Art. 141 (AN303_Art141_*): wizard obrigatorio na UI para classificar inserviveis (frontend).

## Onde ler as regras do projeto

- Fonte de verdade: `PROJECT_RULES.md`

## Onde ver o status do que ja foi feito

- `docs/STATUS_ATUAL.md`
