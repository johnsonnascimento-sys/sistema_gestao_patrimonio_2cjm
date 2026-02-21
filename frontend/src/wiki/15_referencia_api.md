<!--
Modulo: wiki
Arquivo: frontend/src/wiki/15_referencia_api.md
Funcao no sistema: referencia rapida de endpoints usados pela UI, com exemplos basicos.
Atualizado em: 2026-02-17  (gerenciado pelo wikiMeta.generated.js na UI)
-->

# Referência rápida da API (admin/suporte)

Base URL no domínio:

- `https://patrimonio2cjm.johnsontn.com.br/api`

Observações:

- A UI chama sempre via `/api/...` (proxy Nginx).
- Quando `AUTH_ENABLED=true`, as rotas protegidas exigem `Authorization: Bearer <JWT>`.

## Health

### GET `/health`

Uso: confirmar que o backend está vivo.

Campos (importantes para a UI):

- `authEnabled`: `true|false` (se a autenticação está ativa na VPS).

## Autenticação (quando `AUTH_ENABLED=true`)

### POST `/auth/login`

Body JSON:

- `matricula`
- `senha`

Retorna:

- `token` (JWT)
- `perfil`

### POST `/auth/primeiro-acesso`

Uso: definir senha para um perfil já cadastrado (bootstrap controlado).

Body JSON:

- `matricula`
- `nome` (deve conferir com o cadastro do perfil)
- `senha` (mín. 8)

Retorna:

- `token` (JWT)
- `perfil`

### GET `/auth/me`

Uso: identificar usuário logado.

## Estatísticas

### GET `/stats`

Uso: cards da tela "Consulta de Bens".

## Bens

### GET `/bens`

Uso: listagem e filtros.

Parâmetros comuns (query):

- `limit` / `offset`
- `numeroTombamento=1290001788`
- `q=NOTEBOOK`
- `unidadeDonaId=1..4`
- `status=OK|EM_CAUTELA|BAIXADO|AGUARDANDO_RECEBIMENTO`
- `localFisico=Sala 101`

Campos �teis no retorno da listagem (`GET /bens`):

- `cod2Aud` (etiqueta azul)
- `nomeResumo`
- `fotoUrl` (foto do item)
- `fotoReferenciaUrl` (foto de refer�ncia do cat�logo)

### GET `/bens/{id}`

Uso: modal "Detalhes" do bem.

Retorna:

- `bem`
- `catalogo`
- `movimentacoesRecentes`
- `historicoTransferencias`

### PATCH `/bens/{id}`

Uso: atualizar campos operacionais do bem (ADMIN).

Campos relevantes:

- `nomeResumo` (aceita `null`)
- `descricaoComplementar`
- `localId`, `localFisico`, `status`, `unidadeDonaId`

## Perfis

### POST `/perfis`

Uso: criar operador (matrícula/nome/unidade).

Quando `AUTH_ENABLED=true`:

- Requer `ADMIN`.

### GET `/perfis`

Uso: listar perfis cadastrados (para suporte/admin).

Quando `AUTH_ENABLED=true`:

- Requer `ADMIN`.

### PATCH `/perfis/{id}`

Uso: atualizar dados do perfil (nome/email/unidade/cargo/role/ativo).

Quando `AUTH_ENABLED=true`:

- Requer `ADMIN`.

### POST `/perfis/{id}/reset-senha`

Uso: resetar senha (remove o hash) para permitir "Primeiro acesso" novamente.

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

Campos típicos:

- `status`: `EM_ANDAMENTO|CONCLUIDO|ERRO`
- `totalLinhas`
- `linhasInseridas`
- `percent` (0..100)
- `persistenciaOk`
- `falhaPersistencia`
- `falhaNormalizacao`
- `ultimaAtualizacaoEm` (timestamp da última linha registrada no espelho)

### POST `/importacoes/geafin/{id}/cancelar`

Uso: cancelar uma importação que ficou presa como `EM_ANDAMENTO` (marca como `ERRO` para destravar UI).

Quando `AUTH_ENABLED=true`:

- Requer `ADMIN`.

Body (opcional):

- `motivo`

## Movimentações

### POST `/movimentar`

Uso: executar transferência/cautela.

Regras:

- Transferência muda carga e gera histórico (Arts. 124/127).
- Durante inventário `EM_ANDAMENTO`, transferências ficam bloqueadas no banco (Art. 183).

## Inventário

### GET `/inventario/eventos?status=EM_ANDAMENTO`

Uso: status do inventário na barra do topo.

### GET `/inventario/forasteiros`

Uso: listar divergências pendentes (intrusos/forasteiros) para regularização pós-inventário (Art. 185).

Filtros (query) comuns:

- `eventoInventarioId=<uuid>`
- `salaEncontrada=Sala 101`
- `numeroTombamento=1290001788`

### GET `/inventario/bens-terceiros`

Uso: listar ocorrências de "bens de terceiros" registradas durante o inventário (controle segregado).

Fonte:

- `vw_bens_terceiros_inventario` (derivado de `contagens`).

Filtros (query) comuns:

- `eventoInventarioId=<uuid>`
- `salaEncontrada=Sala 101`

### POST `/inventario/sync`

Uso: sincronizar scans/contagens (inclusive offline).

Comportamento:

- Se unidade dona do bem != unidade encontrada: registra divergência (Art. 185), sem transferir carga.
- A classifica��o de diverg�ncia considera unidade e sala (quando `localEncontradoId` � enviado).
- Payload de sync pode incluir `localEncontradoId` (UUID do local selecionado).

### POST `/inventario/regularizacoes`

Uso: encerrar pendência de forasteiro após ENCERRAR o evento de inventário.

Regras:

- O evento precisa estar `ENCERRADO` (Art. 185 - AN303_Art185).
- Para `TRANSFERIR_CARGA`, `termoReferencia` é obrigatório (Arts. 124/127 - AN303_Art124 / AN303_Art127).

Quando `AUTH_ENABLED=true`:

- Requer `ADMIN`.

### POST `/inventario/bens-terceiros`

Uso: registrar bem de terceiro durante inventário (sem tombamento GEAFIN), como ocorrência segregada.

Body JSON (exemplo):

- `eventoInventarioId` (UUID)
- `unidadeEncontradaId` (1..4)
- `salaEncontrada` (string)
- `descricao` (string)
- `proprietarioExterno` (string)
- `identificadorExterno` (opcional)

### POST `/inventario/bens-nao-identificados`

Uso: registrar bem encontrado sem identificação (sem plaqueta/etiqueta ilegível) durante inventário, com foto obrigatória.

Quando `AUTH_ENABLED=true`:

- Requer autenticação (qualquer papel).

Body JSON:

- `eventoInventarioId` (UUID, obrigatório)
- `unidadeEncontradaId` (1..4, obrigatório)
- `salaEncontrada` (string, obrigatório)
- `descricao` (string, mín. 3 caracteres, obrigatório)
- `localizacaoExata` (string, mín. 3 caracteres, obrigatório)
- `base64Data` (string, base64 da imagem, obrigatório — max ~12 MB)

O sistema:

- Otimiza a foto (WebP, max 1200px) e persiste em `./data/fotos/bem/`.
- Cria catálogo genérico `NAO_IDENTIFICADO_GENERICO` se não existir.
- Insere bem com `eh_bem_terceiro=true` e `proprietario_externo='SEM_IDENTIFICACAO'`.
- Cria contagem com `tipo_ocorrencia='BEM_NAO_IDENTIFICADO'` e `regularizacao_pendente=true`.

Regra legal: Art. 175, IX (AN303_Art175_IX)



### POST `/inserviveis/avaliacoes`

Uso: persistir o resultado do Wizard do Art. 141 para um bem.

Quando `AUTH_ENABLED=true`:

- Requer `ADMIN`.

Campos (JSON):

- `bemId` (UUID)
- `tipoInservivel`: `OCIOSO|RECUPERAVEL|ANTIECONOMICO|IRRECUPERAVEL`
- `descricaoInformada` (opcional)
- `justificativa` (opcional)
- `criterios` (opcional; objeto)

### GET `/inserviveis/avaliacoes?bemId=<uuid>`

Uso: listar o histórico de avaliações do Art. 141 para um bem.

## Locais (salas) e fotos (camada operacional)

### GET `/locais`

Uso: listar locais padronizados.

Filtro (query):

- `unidadeId=1..4` (opcional)
- `includeInativos=true` (opcional; quando presente, lista tambem locais desativados)

### POST `/locais`

Uso: criar/atualizar local por `nome` (upsert).

Quando `AUTH_ENABLED=true`:

- Requer `ADMIN`.

### PATCH `/locais/{id}`

Uso: atualizar local por id (renomear, ajustar unidade/tipo/observacoes, ativar/desativar).

Quando `AUTH_ENABLED=true`:

- Requer `ADMIN`.

Campos (JSON) comuns:

- `nome` (opcional)
- `unidadeId` (opcional)
- `tipo` (opcional)
- `observacoes` (opcional)
- `ativo` (opcional; `true|false`)

### PATCH `/bens/{id}/operacional`

Uso: atualizar dados operacionais do bem (local/foto).

Quando `AUTH_ENABLED=true`:

- Requer `ADMIN`.

Campos (JSON):

- `localFisico` (opcional)
- `localId` (opcional; UUID)
- `fotoUrl` (opcional)

### PATCH `/bens/{id}`

Uso: atualizar campos do bem (ADMIN), exceto chaves imutáveis.

Quando `AUTH_ENABLED=true`:

- Requer `ADMIN`.

Observação:

- Mudanças de `unidadeDonaId` disparam trilha/auditoria de transferência (Art. 124 - AN303_Art124) e podem ser bloqueadas por inventário em andamento (Art. 183 - AN303_Art183).

Campos (JSON) comuns:

- `catalogoBemId` (opcional; UUID)
- `unidadeDonaId` (opcional; 1..4)
- `status` (opcional)
- `descricaoComplementar` (opcional)
- `responsavelPerfilId` (opcional; UUID)
- `contratoReferencia` (opcional)
- `dataAquisicao` (opcional; `YYYY-MM-DD`)
- `valorAquisicao` (opcional; número)
- `localFisico` (opcional; texto legado do GEAFIN)
- `localId` (opcional; UUID)
- `fotoUrl` (opcional; link do Drive)

### POST `/drive/fotos/upload`

Uso: enviar uma foto (item ou referência do SKU) ao Google Drive via n8n e persistir o link no banco.

Quando `AUTH_ENABLED=true`:

- Requer `ADMIN`.

Pré-requisitos:

- Backend com `N8N_DRIVE_PHOTOS_WEBHOOK_URL` configurado.
- Workflow n8n importado: `automations/n8n_drive_upload_fotos_webhook.json` (com credencial do Google Drive).

Body (JSON):

- `target`: `BEM|CATALOGO`
- `id`: UUID do `bens.id` (quando `BEM`) ou do `catalogo_bens.id` (quando `CATALOGO`)
- `filename` (opcional)
- `mimeType` (opcional)
- `base64Data` (obrigatório; base64 do arquivo)

### POST `/bens/vincular-local`

Uso: vincular (em lote) `bens.local_id` a partir de um filtro pelo texto do GEAFIN (`local_fisico`).

Objetivo:

- Permitir que o "Modo Inventário" use **locais cadastrados** (tabela `locais`) em vez de depender do texto do GEAFIN.

Quando `AUTH_ENABLED=true`:

- Requer `ADMIN`.

Campos (JSON):

- `localId` (obrigatório; UUID do local cadastrado)
- `termoLocalFisico` (obrigatório; texto parcial para filtrar `local_fisico`)
- `somenteSemLocalId` (opcional; default `true`)
- `unidadeDonaId` (opcional; 1..4)
- `dryRun` (opcional; default `false`)

### PATCH `/catalogo-bens/{id}/foto`

Uso: atualizar foto de referência do catálogo (SKU).

Quando `AUTH_ENABLED=true`:

- Requer `ADMIN`.

## Documentos (evidências)

### GET `/documentos`

Uso: listar evidências (metadados) associadas a movimentações/regularizações/avaliações.

Filtros (query):

- `movimentacaoId=<uuid>`
- `contagemId=<uuid>`
- `avaliacaoInservivelId=<uuid>` (exige migration `database/013_documentos_avaliacoes_inserviveis.sql`)

### POST `/documentos`

Uso: registrar metadados do documento gerado no n8n/Drive (PDF), para auditoria.

Quando `AUTH_ENABLED=true`:

- Requer `ADMIN`.

Campos (JSON):

- `tipo`: `TERMO_TRANSFERENCIA|TERMO_CAUTELA|TERMO_REGULARIZACAO|RELATORIO_FORASTEIROS|OUTRO`
- `movimentacaoId` (opcional)
- `contagemId` (opcional)
- `avaliacaoInservivelId` (opcional; exige migration 013)
- `termoReferencia` (opcional)
- `driveUrl` (obrigatório)

### PATCH `/documentos/{id}`

Uso: completar evidência do Drive em um documento já existente (ex.: placeholder criado automaticamente na movimentação).

Quando `AUTH_ENABLED=true`:

- Requer `ADMIN`.

Campos (JSON):

- `driveUrl` (obrigatório)
- `driveFileId` (opcional)
- `arquivoNome` (opcional)
- `mime` (opcional)
- `bytes` (opcional)
- `sha256` (opcional)

## PDFs (saídas oficiais via API, para n8n)

### GET `/pdf/forasteiros`

Uso: gerar PDF do relatório de forasteiros (Art. 185) para upload no Drive via n8n.

Quando `AUTH_ENABLED=true`:

- Requer `ADMIN`.

### POST `/pdf/termos`

Uso: gerar PDF de termo patrimonial (transferência/cautela/regularização) para upload no Drive via n8n.

Quando `AUTH_ENABLED=true`:

- Requer `ADMIN`.
