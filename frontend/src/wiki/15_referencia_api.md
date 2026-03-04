<!--
MÃ³dulo: wiki
Arquivo: frontend/src/wiki/15_referencia_api.md
FunÃ§Ã£o no sistema: referÃªncia resumida dos principais contratos HTTP.
-->

# ReferÃªncia de API

## PadrÃµes gerais

- AutenticaÃ§Ã£o: JWT via middleware `mustAuth` (ou `mustAdmin` quando aplicÃ¡vel).
- Formato de resposta: JSON com `requestId`.
- Erros de validaÃ§Ã£o: normalmente `422`.
- Falta de permissÃ£o: `403`.

## Locais: estatÃ­sticas, listagem e reset

### GET `/locais/estatisticas`

Uso:

- retorna progresso de vinculaÃ§Ã£o de endereço (`total`, `comLocal`, `semLocal`).

Query opcional:

- `unidadeId` (1..4).

### GET `/bens/localizacao`

Uso:

- lista bens por situaÃ§Ã£o de localizaÃ§Ã£o fÃ­sica.

Query:

- `statusLocal`: `com_local` ou `sem_local` (obrigatÃ³rio);
- `unidadeId` (opcional);
- `limit`, `offset` (opcionais).

Importante:

- rota deve estar registrada antes de `/bens/:id`.

### DELETE `/locais/reset`

Uso:

- limpa `local_id` de todos os bens do escopo.

Acesso:

- `mustAdmin` + validaÃ§Ã£o de `adminPassword`.

Query opcional:

- `unidadeId` (1..4).

Body:

```json
{ "adminPassword": "senha_do_administrador" }
```

## InventÃ¡rio: criaÃ§Ã£o, contagem e monitoramento

### POST `/inventario/eventos`

Uso:

- cria inventÃ¡rio (inclusive micro-inventÃ¡rio cÃ­clico).

Campos principais:

- `codigoEvento`
- `tipoCiclo`: `SEMANAL|MENSAL|ANUAL|ADHOC`
- `escopoTipo`: `GERAL|UNIDADE|LOCAIS`
- `unidadeInventariadaId`
- `escopoLocalIds` (quando `LOCAIS`)
- `modoContagem`: `PADRAO|CEGO|DUPLO_CEGO`
- `operadoresDesignados`

Regras:

- `GERAL`: exclusivo.
- `UNIDADE/LOCAIS`: permite paralelo entre unidades, sem conflito dentro da mesma unidade.
- `CEGO`: exige `OPERADOR_UNICO`.
- `DUPLO_CEGO`: exige `OPERADOR_A` e `OPERADOR_B`.

### PATCH `/inventario/eventos/:id/status`

Uso:

- altera status para `EM_ANDAMENTO`, `ENCERRADO` ou `CANCELADO`.

### POST `/inventario/sync`

Uso:

- sincroniza leituras da contagem.

Campos relevantes:

- `eventoInventarioId`
- `rodada`: `A|B|DESEMPATE` (obrigatÃ³ria em modos cegos)
- `unidadeEncontradaId`
- `endereçoEncontrada`
- `localEncontradoId`
- `itens[]`

ValidaÃ§Ãµes importantes:

- escopo de unidade/local do evento;
- operador designado em modo cego;
- rodada permitida por papel.

### GET `/inventario/eventos/:id/minha-sessao-contagem`

Uso:

- retorna contexto do usuÃ¡rio no inventÃ¡rio.

Resposta tÃ­pica:

- `modoContagem`
- `papel`
- `rodadasPermitidas`
- `podeDesempate`
- `uiReduzida`
- `designado`

### GET `/inventario/eventos/:id/monitoramento-contagem`

Uso:

- visÃ£o administrativa em tempo real por endereço e rodadas.

Acesso:

- restrito a `ADMIN`.

### GET `/inventario/divergencias-interunidades`

Uso:

- lista divergÃªncias com visibilidade cruzada entre unidade dona e unidade encontrada.

Filtros:

- `statusInventario`: `EM_ANDAMENTO|ENCERRADO|TODOS`
- `eventoInventarioId`
- `unidadeDonaId`
- `unidadeEncontradaId`
- `unidadeRelacionadaId`
- `limit`, `offset`

Acesso:

- usuÃ¡rio comum: vÃª apenas divergÃªncias relacionadas Ã  prÃ³pria unidade;
- admin: pode ver todas.

## ClassificaÃ§Ãµes SIAFI e CatÃ¡logo

### GET `/classificacoes-siafi`

Uso:

- lista classificaÃ§Ãµes SIAFI para uso no catÃ¡logo.

### POST `/classificacoes-siafi`

Uso:

- cria classificaÃ§Ã£o SIAFI.

Acesso:

- `mustAdmin`.

### PATCH `/classificacoes-siafi/:id`

Uso:

- edita classificaÃ§Ã£o SIAFI.

Acesso:

- `mustAdmin`.

### POST `/catalogo-bens`

Uso:

- cria item de catÃ¡logo.

Regra:

- campo `grupo` deve referenciar classificaÃ§Ã£o SIAFI vÃ¡lida e ativa.

### PATCH `/catalogo-bens/:id`

Uso:

- edita item de catÃ¡logo.

Regras adicionais:

- confirmaÃ§Ã£o explÃ­cita de ediÃ§Ã£o;
- senha admin quando autenticaÃ§Ã£o estiver ativa.

## RBAC e AprovaÃ§Ãµes

### GET `/auth/acl`

Uso:

- retorna ACL efetiva do usuÃ¡rio (`roles`, `permissions`, `menuPermissions`).

### GET `/aprovacoes/solicitacoes`

Uso:

- lista solicitaÃ§Ãµes de aprovaÃ§Ã£o.

PermissÃ£o:

- `action.aprovacao.listar`.

### POST `/aprovacoes/solicitacoes/:id/aprovar`

Uso:

- aprova e aplica solicitaÃ§Ã£o pendente.

PermissÃ£o:

- `action.aprovacao.aprovar` + `adminPassword`.

### POST `/aprovacoes/solicitacoes/:id/reprovar`

Uso:

- reprova solicitaÃ§Ã£o pendente.

PermissÃ£o:

- `action.aprovacao.reprovar` + `adminPassword`.

## MovimentaÃ§Ãµes

### POST `/movimentar`

Uso:

- executa `TRANSFERENCIA`, `CAUTELA_SAIDA` e `CAUTELA_RETORNO`.

AutenticaÃ§Ã£o:

- `mustAuth`.

PermissÃµes ACL de execuÃ§Ã£o:

- `TRANSFERENCIA`: `action.bem.alterar_responsavel.execute`
- `CAUTELA_SAIDA`: `action.bem.alterar_status.execute` + `action.bem.alterar_responsavel.execute`
- `CAUTELA_RETORNO`: `action.bem.alterar_status.execute` (e tambÃ©m `action.bem.alterar_responsavel.execute` quando remover responsÃ¡vel)

Erros relevantes:

- `403 SEM_PERMISSAO`: usuÃ¡rio sem permissÃ£o para o tipo de movimentaÃ§Ã£o.
- `403 APROVACAO_OBRIGATORIA`: perfil tem somente permissÃ£o de solicitaÃ§Ã£o (`request`) e nÃ£o pode executar diretamente.

### GET `/roles-acesso`

Uso:

- lista catÃ¡logo de roles ACL.

### PUT `/perfis/:id/role-acesso`

Uso:

- define role ACL principal do perfil.

Body:

```json
{ "roleCodigo": "SUPERVISOR" }
```

### GET `/acl/matriz`

Uso:

- carrega matriz role x permissÃµes para ediÃ§Ã£o visual.

### PUT `/roles-acesso/:codigo/permissoes`

Uso:

- substitui permissÃµes de uma role.

Body:

```json
{
  "permissions": ["menu.bens.view", "action.bem.alterar_localizacao.request"],
  "adminPassword": "senha_admin"
}
```

### GET `/inventario/indicadores-acuracidade`

Uso:

- consolidar KPIs operacionais de acuracidade por periodo, com serie semanal e mensal.

Query obrigatoria:

- `dataInicio` (`YYYY-MM-DD`)
- `dataFim` (`YYYY-MM-DD`)

Query opcional:

- `unidadeId` (`1..4`)
- `statusEvento` (`ENCERRADO` padrao, `EM_ANDAMENTO`, `CANCELADO`)
- `toleranciaPct` (0..10, padrao `2`)

Resposta:

- `periodo`
- `configuracao`
- `resumo`
- `porEvento`
- `porendereço`
- `serieSemanal`
- `serieMensal`

KPIs de resumo:

- `acuracidadeExataPct`
- `acuracidadeToleranciaPct`
- `erroRelativoMedioendereçoPct`
- `taxaDivergenciaPct`
- `taxaPendenciaRegularizacaoPct`
- `mttrRegularizacaoDias`
- `coberturaContagemPct`

Observacoes:

- exclui bens de terceiros e bens baixados;
- referencia temporal do filtro: `COALESCE(encerrado_em, iniciado_em)`;
- semaforo operacional e retornado em `resumo.semaforo`.

## Regularização pós-inventário (fluxo formal de transferência)

### POST `/inventario/regularizacoes`

Uso:

- regularização unitária da divergência sem transferência direta.

Importante:

- `TRANSFERIR_CARGA` retorna `422 ACAO_EXIGE_FLUXO_MOVIMENTACOES`.

### POST `/inventario/regularizacoes/lote`

Uso:

- regulariza vários itens em lote.

Body:

```json
{
  "contagemIds": ["uuid"],
  "acao": "MANTER_CARGA|ATUALIZAR_LOCAL",
  "regularizadoPorPerfilId": "uuid"
}
```

### POST `/inventario/regularizacoes/encaminhar-transferencia`

Uso:

- encaminha contagens para transferência formal em `Movimentações`, sem alterar carga aqui.

Body:

```json
{
  "contagemIds": ["uuid"],
  "encaminhadoPorPerfilId": "uuid"
}
```

### GET `/inventario/regularizacoes/transferencias-pendentes`

Uso:

- lista fila formal de transferência pendente da regularização.

Query opcional:

- `status`: `ENCAMINHADA|AGUARDANDO_APROVACAO|ERRO|CONCLUIDA|CANCELADA`
- `limit`, `offset`

### POST `/inventario/regularizacoes/concluir-transferencias`

Uso:

- conclui regularização após movimentação executada.

Body:

```json
{
  "itens": [
    { "contagemId": "uuid", "movimentacaoId": "uuid" }
  ],
  "regularizadoPorPerfilId": "uuid"
}
```

