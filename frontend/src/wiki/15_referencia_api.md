
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
