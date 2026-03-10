# Sistema de Gestão Patrimonial - 2ª CJM

## Cabecalho

- Modulo: `repositorio`
- Arquivo: `README.md`
- Funcao no sistema: ponto de entrada para entender, rodar e operar o projeto localmente.
- Objetivo: sistema deterministico, auditavel e aderente ao ATN 303/2008.

## Visão rápida

- O banco (Supabase/Postgres) é a fonte de verdade do patrimônio.
- O backend (`/backend`) aplica validações legais, RBAC e auditoria.
- O frontend (`/frontend`) oferece as telas operacionais.
- O n8n permanece como automação opcional para PDFs e integrações externas.

## O que funciona hoje

### Backend

- `GET /health`
- `GET /stats`
- `GET /bens` e `GET /bens/:id`
- `POST /movimentar`
- `GET/POST/PATCH /inventario/*`
- `GET/POST/PATCH /inserviveis/avaliacoes`
- `GET/POST/PATCH /inserviveis/marcacoes`
- `GET/POST/PATCH /baixas-patrimoniais`
- `POST /baixas-patrimoniais/:id/concluir`
- `POST /baixas-patrimoniais/:id/cancelar`
- `GET /documentos` e `POST /documentos`

### Frontend

- Consulta de Bens
- Movimentações
- Inventário - Contagem
- Inventário - Administração
- Material Inservível / Baixa
- Material (SKU)
- Classificação SIAFI
- Wiki / Manual do Sistema

### Compliance operacional

- Art. 183: congelamento de movimentação durante inventário.
- Art. 185: regularização posterior sem troca automática de carga.
- Arts. 124 e 127: distinção entre transferência e cautela.
- Arts. 141 a 152: triagem e destinação de material inservível.
- Arts. 153 a 157: baixa patrimonial com causa formal, documentos e atualização do status do bem.

## Material Inservível / Baixa

A aba técnica `classificacao` passou a se chamar **Material Inservível / Baixa**.

Ela reúne:

- stepper de classificação de inservível;
- fila de marcações atuais;
- processos de baixa patrimonial;
- fluxo direto de `DESAPARECIMENTO`;
- placeholders documentais e resumo da baixa no detalhe do bem.

Limite desta entrega:

- sem integração automática com GEAFIN, SEI, SIAFI ou n8n;
- a tela registra referências formais e anexos para instrução posterior.

## Como rodar localmente

### Backend

```powershell
cd backend
npm install

$env:PORT="3001"
$env:DB_SSL="require"
$env:FRONTEND_ORIGIN="http://localhost:5173"
$env:DATABASE_URL="postgresql://postgres:<SUA_SENHA>@db.<SEU_REF>.supabase.co:5432/postgres"

npm run start
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

## Gates locais obrigatórios

```powershell
npm --prefix backend run check
npm --prefix backend test
npm --prefix frontend test
npm --prefix frontend run build
python scripts/check_wiki_encoding.py
node scripts/validate_governance.js
```

## Documentação de referência

- Governança: `PROJECT_RULES.md`
- Status atual: `docs/STATUS_ATUAL.md`
- Log geral de alterações: `docs/LOG_GERAL_ALTERACOES.md`
- Manual operacional: `frontend/src/wiki/*.md`
