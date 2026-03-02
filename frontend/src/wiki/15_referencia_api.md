
## Locais - Estatisticas, Listagem e Reset

### GET `/locais/estatisticas`

Uso: retorna estatisticas de progresso de cadastro de sala (bens com e sem local vinculado).

Autenticacao: `mustAuth` (JWT valido).

Query (opcional):

- `unidadeId` â€” inteiro 1..4; se omitido, retorna totais globais

Resposta JSON:

```json
{
  "requestId": "...",
  "total": 1500,
  "comLocal": 1050,
  "semLocal": 450
}
```

Filtros aplicados internamente: `eh_bem_terceiro = FALSE` e `status != 'BAIXADO'`.

---

### GET `/bens/localizacao`

Uso: lista bens filtrando por status de localizacao fisica (com ou sem sala atribuida).

**IMPORTANTE:** Esta rota deve estar registrada ANTES de `/bens/:id` no `server.js` para evitar que o Express interprete "localizacao" como parametro UUID.

Autenticacao: `mustAuth`.

Query:

| Parametro | Tipo | Obrigatorio | Descricao |
|---|---|---|---|
| `statusLocal` | string | Sim | `com_local` ou `sem_local` |
| `unidadeId` | int 1..4 | Nao | Filtra por unidade |
| `limit` | int 1..200 | Nao | Padrao: 50 |
| `offset` | int >= 0 | Nao | Padrao: 0 |

Resposta JSON:

```json
{
  "requestId": "...",
  "total": 450,
  "limit": 50,
  "offset": 0,
  "items": [
    {
      "numeroTombamento": "0001234567",
      "nomeResumo": "Mesa de escritorio",
      "unidade": 2,
      "localId": null,
      "localNome": null
    }
  ]
}
```

Erros:

| HTTP | Codigo | Motivo |
|---|---|---|
| 422 | `STATUS_LOCAL_INVALIDO` | `statusLocal` fora dos valores aceitos |
| 422 | `UNIDADE_INVALIDA` | `unidadeId` fora do intervalo 1..4 |

---

### DELETE `/locais/reset`

Uso: limpa o vinculo `local_id` de todos os bens (ou de uma unidade especifica). Operacao de pre-inventario livre. **Restrito a ADMIN com senha.**

Autenticacao: `mustAdmin` (JWT com role admin) + senha do proprio admin validada via bcrypt.

Query (opcional):

- `unidadeId` â€” inteiro 1..4; se omitido, afeta todas as unidades

Body JSON (obrigatorio):

```json
{ "adminPassword": "senha_do_administrador" }
```

Resposta de sucesso:

```json
{ "requestId": "...", "afetados": 350 }
```

Erros:

| HTTP | Codigo | Motivo |
|---|---|---|
| 401 | `SENHA_ADMIN_INVALIDA` | Senha incorreta |
| 401 | `NAO_AUTENTICADO` | JWT invalido ou perfil sem senha configurada |
| 403 | `PERFIL_INATIVO` | Perfil administrativo inativo |
| 422 | `UNIDADE_INVALIDA` | `unidadeId` fora do intervalo 1..4 |
| 422 | `SENHA_ADMIN_OBRIGATORIA` | `adminPassword` nao foi enviado |

Filtros aplicados internamente: `eh_bem_terceiro = FALSE` e `status != 'BAIXADO'` â€” bens baixados e de terceiros nao sao afetados.

---

## Inventario ciclico - novos contratos

### POST `/inventario/eventos`

Uso: cria evento de inventario (inclusive micro-inventario ciclico).

Body (campos novos):

```json
{
  "codigoEvento": "INV_2026_03_02_1015_ALMOX",
  "unidadeInventariadaId": 4,
  "tipoCiclo": "SEMANAL",
  "escopoTipo": "LOCAIS",
  "escopoLocalIds": ["uuid-local-1", "uuid-local-2"],
  "observacoes": "Ciclo semanal do almoxarifado",
  "abertoPorPerfilId": "uuid-perfil"
}
```

Regras:

- `escopoTipo=GERAL` -> `unidadeInventariadaId` deve ser `null`.
- `escopoTipo=UNIDADE` -> exige `unidadeInventariadaId`.
- `escopoTipo=LOCAIS` -> exige `escopoLocalIds` (UUIDs validos) e mesma unidade para todos os locais.

Possiveis erros:

| HTTP | Codigo | Motivo |
|---|---|---|
| 409 | `EVENTO_ATIVO_EXISTENTE` | Conflito de escopo com evento ativo |
| 422 | `ESCOPO_TIPO_INVALIDO` | `escopoTipo` fora dos valores aceitos |
| 422 | `ESCOPO_LOCAIS_OBRIGATORIO` | `escopoLocalIds` ausente para `LOCAIS` |
| 422 | `ESCOPO_LOCAIS_UNIDADE_MISTA` | Lista de locais com unidades diferentes |
| 422 | `MIGRACAO_INVENTARIO_CICLICO_OBRIGATORIA` | Banco sem schema ciclico |

### GET `/inventario/sugestoes-ciclo`

Uso: listar salas recomendadas para proximo ciclo.

Query:

| Parametro | Tipo | Obrigatorio | Descricao |
|---|---|---|---|
| `unidadeId` | int 1..4 | Nao | Filtra por unidade |
| `somenteAtivos` | bool | Nao | Default `true` |
| `limit` | int 1..100 | Nao | Default 20 |
| `offset` | int >= 0 | Nao | Default 0 |

Resposta:

```json
{
  "requestId": "...",
  "paging": { "limit": 20, "offset": 0, "total": 120 },
  "items": [
    {
      "localId": "uuid",
      "nome": "MEZANINO",
      "unidadeId": 4,
      "dataUltimaContagem": null,
      "diasSemContagem": null,
      "qtdBensAtivos": 486,
      "qtdDivergenciasPendentes": 12,
      "scorePrioridade": 30486
    }
  ]
}
```

Notas:

- `diasSemContagem` pode ser `null` quando o local ainda nao teve contagem registrada.
- Na UI de Administracao, esse caso aparece como `Sem contagem`.
- Para preencher historico inicial em bases antigas, aplicar `database/018_backfill_locais_data_ultima_contagem.sql`.

### POST `/inventario/sync` (reforco de escopo)

Novas validacoes de escopo no evento:

- `UNIDADE`: `unidadeEncontradaId` deve ser compativel.
- `LOCAIS`: `localEncontradoId` deve pertencer ao conjunto do evento.

Possiveis erros:

| HTTP | Codigo | Motivo |
|---|---|---|
| 409 | `UNIDADE_FORA_ESCOPO_EVENTO` | unidade encontrada fora do escopo |
| 409 | `LOCAL_FORA_ESCOPO_EVENTO` | local encontrado fora do escopo |
