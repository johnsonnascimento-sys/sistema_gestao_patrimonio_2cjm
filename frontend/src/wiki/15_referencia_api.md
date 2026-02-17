<!--
Modulo: wiki
Arquivo: frontend/src/wiki/15_referencia_api.md
Funcao no sistema: referencia rapida de endpoints usados pela UI, com exemplos basicos.
-->

# Referencia rapida da API (para admin/suporte)

Base URL no dominio:

- `https://patrimonio2cjm.johnsontn.com.br/api`

Obs.:

- A UI chama sempre via `/api/...` (proxy Nginx).

## Health

### GET `/health`

Uso: confirmar que backend esta vivo.

Resposta: `200 OK`

## Estatisticas

### GET `/stats`

Uso: cards da tela "Consulta de Bens".

## Bens

### GET `/bens`

Uso: listagem e filtros.

Parametros comuns (query):

- `limit` / `offset`
- `numeroTombamento=1290001788`
- `q=NOTEBOOK`
- `unidadeDonaId=1..4`
- `status=OK|EM_CAUTELA|BAIXADO|AGUARDANDO_RECEBIMENTO`
- `localFisico=Sala 101`

### GET `/bens/{id}`

Uso: modal "Detalhes" do bem.

Retorna:

- `bem`
- `catalogo`
- `movimentacoesRecentes`
- `historicoTransferencias`

## Perfis

### POST `/perfis`

Uso: criar operador (matricula/nome/unidade).

## Importacao GEAFIN

### POST `/importar-geafin`

Uso: upload CSV (multipart) para importar.

Campo do form:

- `arquivo`: arquivo CSV

### GET `/importacoes/geafin/ultimo`

Uso: barra de progresso do importador.

Campos tipicos:

- `status`: `EM_ANDAMENTO|CONCLUIDO|ERRO`
- `totalLinhas`
- `linhasInseridas`
- `percent` (0..100)
- `persistenciaOk`
- `falhaPersistencia`
- `falhaNormalizacao`

## Inventario

### GET `/inventario/eventos?status=EM_ANDAMENTO`

Uso: status do inventario na barra do topo.

### POST `/inventario/sync`

Uso: sincronizar scans/contagens (inclusive offline).

Comportamento:

- Se unidade dona do bem != unidade encontrada: registra divergencia (Art. 185), sem transferir carga.

