<!--
Modulo: wiki
Arquivo: frontend/src/wiki/15_referencia_api.md
Funcao no sistema: referencia rapida de endpoints usados pela UI, com exemplos basicos.
-->

# Referência rápida da API (para admin/suporte)

Base URL no dominio:

- `https://patrimonio2cjm.johnsontn.com.br/api`

Obs.:

- A UI chama sempre via `/api/...` (proxy Nginx).

## Health

### GET `/health`

Uso: confirmar que backend esta vivo.

Resposta: `200 OK`

Campos (importantes para a UI):

- `authEnabled`: `true|false` (se a autenticacao estiver ativa na VPS).

## Autenticacao (quando `AUTH_ENABLED=true`)

Quando a autenticacao estiver ativa, a maioria das rotas exige:

- Header: `Authorization: Bearer <JWT>`

### POST `/auth/login`

Body JSON:

- `matricula`
- `senha`

Retorna:

- `token` (JWT)
- `perfil`

### POST `/auth/primeiro-acesso`

Uso: definir senha para um perfil ja cadastrado.

Body JSON:

- `matricula`
- `nome` (deve conferir com o cadastro do perfil)
- `senha` (min. 8)

Retorna:

- `token` (JWT)
- `perfil`

### GET `/auth/me`

Uso: identificar usuario logado.

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

Quando `AUTH_ENABLED=true`:

- Requer `ADMIN`.

## Importação GEAFIN

### POST `/importar-geafin`

Uso: upload CSV (multipart) para importar.

Campo do form:

- `arquivo`: arquivo CSV

### GET `/importacoes/geafin/ultimo`

Uso: barra de progresso do importador.

Quando `AUTH_ENABLED=true`:

- Requer `ADMIN`.

Campos tipicos:

- `status`: `EM_ANDAMENTO|CONCLUIDO|ERRO`
- `totalLinhas`
- `linhasInseridas`
- `percent` (0..100)
- `persistenciaOk`
- `falhaPersistencia`
- `falhaNormalizacao`

## Inventário

### GET `/inventario/eventos?status=EM_ANDAMENTO`

Uso: status do inventario na barra do topo.

### GET `/inventario/forasteiros`

Uso: listar divergências pendentes (intrusos/forasteiros) para regularização pós-inventário.

Filtros (query) mais comuns:

- `eventoInventarioId=<uuid>`
- `salaEncontrada=Sala 101`
- `numeroTombamento=1290001788`

### POST `/inventario/sync`

Uso: sincronizar scans/contagens (inclusive offline).

Comportamento:

- Se unidade dona do bem != unidade encontrada: registra divergencia (Art. 185), sem transferir carga.

### POST `/inventario/regularizacoes`

Uso: encerrar pendência de forasteiro após ENCERRAR o evento de inventário.

Regras:

- O evento precisa estar `ENCERRADO` (Art. 185 - AN303_Art185).
- Para `TRANSFERIR_CARGA`, `termoReferencia` é obrigatório (Arts. 124/127 - AN303_Art124 / AN303_Art127).

Quando `AUTH_ENABLED=true`:

- Requer `ADMIN`.

## Documentos (evidências)

### GET `/documentos`

Uso: listar evidências (metadados) associadas a movimentações/regularizações.

Filtros (query):

- `movimentacaoId=<uuid>`
- `contagemId=<uuid>`

### POST `/documentos`

Uso: registrar metadados do documento gerado no n8n/Drive (PDF), para auditoria.

Quando `AUTH_ENABLED=true`:

- Requer `ADMIN`.

Campos (JSON):

- `tipo`: `TERMO_TRANSFERENCIA|TERMO_CAUTELA|TERMO_REGULARIZACAO|RELATORIO_FORASTEIROS|OUTRO`
- `movimentacaoId` (opcional)
- `contagemId` (opcional)
- `termoReferencia` (opcional)
- `driveUrl` (obrigatório)
