# Backend 2a CJM

## Cabecalho

- Modulo: `backend`
- Funcao: API Express para importacao GEAFIN e movimentacao patrimonial com regras ATN 303.

## Endpoints principais

- `GET /health`
- `GET /stats`
- `GET /bens`
- `GET /perfis`
- `POST /perfis`
- `POST /importar-geafin`
- `POST /movimentar`
- `GET /docs` (Swagger UI)
- `GET /inventario/contagens` (leituras de contagens por evento/sala)
- `GET /inventario/forasteiros` (divergencias pendentes para regularizacao pos-inventario)
- `POST /inventario/regularizacoes` (encerra pendencia; opcionalmente transfere carga com termo)

## Camada raw do GEAFIN (auditoria)

O endpoint `POST /importar-geafin` grava:
- Camada raw (copia fiel do CSV): `geafin_import_arquivos` + `geafin_import_linhas` (`row_raw` JSONB).
- Camada normalizada (modelo do sistema): `catalogo_bens` + `bens`.

View utilitaria:
- `public.vw_geafin_relatorio_csv`: expõe as colunas com os nomes exatamente como no header do CSV GEAFIN.

## Regra de Tombamento GEAFIN

- Padrao aceito para `numeroTombamento`: **10 digitos numericos**.
- Exemplo valido: `1290001788`.

## Status de Bem (resumo)

- `OK`: em uso normal.
- `EM_CAUTELA`: saiu fisicamente, mas a carga permanece (Arts. 124 e 127 - AN303_Art124 / AN303_Art127).
- `BAIXADO`: baixado.
- `AGUARDANDO_RECEBIMENTO`: item novo identificado na importacao GEAFIN, aguardando localizacao/recebimento (estado operacional).

## Observacao: Docker + Supabase (IPv6)

- Alguns hosts `db.<ref>.supabase.co` podem resolver apenas para IPv6 (DNS `AAAA`).
- Em ambientes onde o Docker nao tem IPv6 habilitado, a conexao pode falhar com `ENETUNREACH`.
- Nesse caso, rode o backend fora do Docker para desenvolvimento local, habilite IPv6 no Docker/host, ou use a conexao via pooler do Supabase (quando disponivel).

## Configuracao

Defina as variaveis:

- `PORT=3001`
- `DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<database>`
- `DB_SSL=require`
- `FRONTEND_ORIGIN=https://<url-do-frontend>` (ou `*` apenas em homologacao)

## Execucao local

- `npm install`
- `npm run start`
