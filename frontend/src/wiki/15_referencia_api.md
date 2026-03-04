<!--
Módulo: wiki
Arquivo: frontend/src/wiki/15_referencia_api.md
Função no sistema: referência resumida dos principais contratos HTTP.
-->

# Referência de API

## Padrões gerais

- Autenticação: JWT via middleware `mustAuth` (ou `mustAdmin` quando aplicável).
- Formato de resposta: JSON com `requestId`.
- Erros de validação: normalmente `422`.
- Falta de permissão: `403`.

## Locais: estatísticas, listagem e reset

### GET `/locais/estatisticas`

Uso:

- retorna progresso de vinculação de sala (`total`, `comLocal`, `semLocal`).

Query opcional:

- `unidadeId` (1..4).

### GET `/bens/localizacao`

Uso:

- lista bens por situação de localização física.

Query:

- `statusLocal`: `com_local` ou `sem_local` (obrigatório);
- `unidadeId` (opcional);
- `limit`, `offset` (opcionais).

Importante:

- rota deve estar registrada antes de `/bens/:id`.

### DELETE `/locais/reset`

Uso:

- limpa `local_id` de todos os bens do escopo.

Acesso:

- `mustAdmin` + validação de `adminPassword`.

Query opcional:

- `unidadeId` (1..4).

Body:

```json
{ "adminPassword": "senha_do_administrador" }
```

## Inventário: criação, contagem e monitoramento

### POST `/inventario/eventos`

Uso:

- cria inventário (inclusive micro-inventário cíclico).

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
- `rodada`: `A|B|DESEMPATE` (obrigatória em modos cegos)
- `unidadeEncontradaId`
- `salaEncontrada`
- `localEncontradoId`
- `itens[]`

Validações importantes:

- escopo de unidade/local do evento;
- operador designado em modo cego;
- rodada permitida por papel.

### GET `/inventario/eventos/:id/minha-sessao-contagem`

Uso:

- retorna contexto do usuário no inventário.

Resposta típica:

- `modoContagem`
- `papel`
- `rodadasPermitidas`
- `podeDesempate`
- `uiReduzida`
- `designado`

### GET `/inventario/eventos/:id/monitoramento-contagem`

Uso:

- visão administrativa em tempo real por sala e rodadas.

Acesso:

- restrito a `ADMIN`.

### GET `/inventario/divergencias-interunidades`

Uso:

- lista divergências com visibilidade cruzada entre unidade dona e unidade encontrada.

Filtros:

- `statusInventario`: `EM_ANDAMENTO|ENCERRADO|TODOS`
- `eventoInventarioId`
- `unidadeDonaId`
- `unidadeEncontradaId`
- `unidadeRelacionadaId`
- `limit`, `offset`

Acesso:

- usuário comum: vê apenas divergências relacionadas à própria unidade;
- admin: pode ver todas.

## Classificações SIAFI e Catálogo

### GET `/classificacoes-siafi`

Uso:

- lista classificações SIAFI para uso no catálogo.

### POST `/classificacoes-siafi`

Uso:

- cria classificação SIAFI.

Acesso:

- `mustAdmin`.

### PATCH `/classificacoes-siafi/:id`

Uso:

- edita classificação SIAFI.

Acesso:

- `mustAdmin`.

### POST `/catalogo-bens`

Uso:

- cria item de catálogo.

Regra:

- campo `grupo` deve referenciar classificação SIAFI válida e ativa.

### PATCH `/catalogo-bens/:id`

Uso:

- edita item de catálogo.

Regras adicionais:

- confirmação explícita de edição;
- senha admin quando autenticação estiver ativa.

## RBAC e Aprovações

### GET `/auth/acl`

Uso:

- retorna ACL efetiva do usuário (`roles`, `permissions`, `menuPermissions`).

### GET `/aprovacoes/solicitacoes`

Uso:

- lista solicitações de aprovação.

Permissão:

- `action.aprovacao.listar`.

### POST `/aprovacoes/solicitacoes/:id/aprovar`

Uso:

- aprova e aplica solicitação pendente.

Permissão:

- `action.aprovacao.aprovar` + `adminPassword`.

### POST `/aprovacoes/solicitacoes/:id/reprovar`

Uso:

- reprova solicitação pendente.

Permissão:

- `action.aprovacao.reprovar` + `adminPassword`.

## Movimentações

### POST `/movimentar`

Uso:

- executa `TRANSFERENCIA`, `CAUTELA_SAIDA` e `CAUTELA_RETORNO`.

Autenticação:

- `mustAuth`.

Permissões ACL de execução:

- `TRANSFERENCIA`: `action.bem.alterar_responsavel.execute`
- `CAUTELA_SAIDA`: `action.bem.alterar_status.execute` + `action.bem.alterar_responsavel.execute`
- `CAUTELA_RETORNO`: `action.bem.alterar_status.execute` (e também `action.bem.alterar_responsavel.execute` quando remover responsável)

Erros relevantes:

- `403 SEM_PERMISSAO`: usuário sem permissão para o tipo de movimentação.
- `403 APROVACAO_OBRIGATORIA`: perfil tem somente permissão de solicitação (`request`) e não pode executar diretamente.

### GET `/roles-acesso`

Uso:

- lista catálogo de roles ACL.

### PUT `/perfis/:id/role-acesso`

Uso:

- define role ACL principal do perfil.

Body:

```json
{ "roleCodigo": "SUPERVISOR" }
```

### GET `/acl/matriz`

Uso:

- carrega matriz role x permissões para edição visual.

### PUT `/roles-acesso/:codigo/permissoes`

Uso:

- substitui permissões de uma role.

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
- `porSala`
- `serieSemanal`
- `serieMensal`

KPIs de resumo:

- `acuracidadeExataPct`
- `acuracidadeToleranciaPct`
- `erroRelativoMedioSalaPct`
- `taxaDivergenciaPct`
- `taxaPendenciaRegularizacaoPct`
- `mttrRegularizacaoDias`
- `coberturaContagemPct`

Observacoes:

- exclui bens de terceiros e bens baixados;
- referencia temporal do filtro: `COALESCE(encerrado_em, iniciado_em)`;
- semaforo operacional e retornado em `resumo.semaforo`.
