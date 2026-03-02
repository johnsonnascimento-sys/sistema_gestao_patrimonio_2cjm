

## Acompanhamento de Progresso por Sala

Ao acessar a aba **Cadastrar bens por sala (regularizacao em lote)**, o sistema exibe um **Card de Progresso** acima do formulario de selecao de sala.

### O que e exibido

- **Total** â€” quantidade total de bens proprios, nao baixados.
- **Atualizados** â€” bens que ja possuem `local_id` vinculado (sala fisica cadastrada).
- **Pendentes** â€” bens sem sala atribuida (`local_id IS NULL`).
- **Barra de progresso** â€” percentual visual de bens atualizados sobre o total.

### Comportamento por contexto

| Situacao | Exibicao |
|---|---|
| Sem filtro de unidade | Totais globais (todas as unidades) |
| Unidade selecionada no dropdown | Totais filtrados pela unidade especifica |
| Apos salvar lote na sala | Estatisticas se atualizam automaticamente |

### Endpoint que alimenta o card

`GET /locais/estatisticas` â€” retorna `{ total, comLocal, semLocal }`.

---

## Ver bens por situacao

O botao **Ver bens por situacao** abre um painel expansivel logo abaixo do card de progresso.

### Abas do painel

| Aba | Filtro aplicado no banco |
|---|---|
| **Pendentes (sem sala)** | `local_id IS NULL` |
| **Concluidos (com sala)** | `local_id IS NOT NULL` |

- O filtro de **Unidade** (dropdown acima) se propaga automaticamente para a listagem.
- Navegacao: **Anterior / Proxima**, 50 itens por pagina.
- Colunas exibidas: `Tombamento | Nome | Unidade | Sala`.
- Clicar em outra aba faz uma nova requisicao com o `statusLocal` correspondente.
- Clicar no **x** fecha o painel sem fazer novas requisicoes.

### Endpoint

```
GET /bens/localizacao?statusLocal=sem_local&unidadeId=2&limit=50&offset=0
```

Resposta:
```json
{
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

**Nota:** O endpoint `/bens/localizacao` deve ser registrado ANTES de `/bens/:id` no `server.js` para evitar que o Express capture "localizacao" como parametro UUID.

---

## Reset de Localizacao Fisica (Pre-Inventario Livre)

Operacao administrativa que limpa o vinculo `local_id` de todos os bens (ou de uma unidade especifica), permitindo comecar o mapeamento fisico do zero â€” sem as exigencias formais de um inventario.

> [!CAUTION]
> Esta operacao apaga o vinculo de sala de todos os bens do escopo selecionado. E irreversivel sem refazer o cadastro por sala. Os **locais cadastrados** (tabela `locais`) NAO sao apagados.

### Como usar

1. Clicar no botao vermelho **Resetar localizacao** na aba *Cadastrar bens por sala*.
2. No modal:
   - **Selecionar o escopo**: "Todas as unidades" ou uma unidade especifica (1 a 4) â€” independente do dropdown de sala.
   - **Informar a senha de administrador** (campo texto, validado via bcrypt no banco).
   - **Digitar `RESETAR`** no campo de confirmacao de texto.
3. O botao **Confirmar reset** so fica ativo quando os tres campos estao preenchidos e validos.
4. Apos a operacao, o sistema exibe quantos bens foram desvinculados e o card de progresso e atualizado.

### Seguranca da operacao

| Verificacao | Mecanismo |
|---|---|
| Autenticacao JWT valida | `mustAdmin` middleware |
| Perfil com role de administrador | `requireAdmin` â€” checa `role` no token |
| Senha correta do proprio usuario | `ensureAdminPassword` â€” bcrypt vs `perfis.senha_hash` |
| Confirmacao de texto obrigatoria | Frontend habilita o botao apenas se `confirmText === "RESETAR"` |

### Endpoint

```
DELETE /locais/reset?unidadeId=2
Content-Type: application/json
Authorization: Bearer <jwt>

{ "adminPassword": "senha_do_admin" }
```

Resposta de sucesso:
```json
{ "afetados": 350 }
```

Respostas de erro possiveis:
| HTTP | Codigo | Motivo |
|---|---|---|
| 401 | `SENHA_ADMIN_INVALIDA` | Senha incorreta |
| 401 | `NAO_AUTENTICADO` | JWT invalido ou perfil sem senha |
| 403 | `PERFIL_INATIVO` | Perfil administrativo inativo |
| 422 | `UNIDADE_INVALIDA` | `unidadeId` fora do intervalo 1..4 |

---

## Inventario simultaneo por unidade (novo fluxo operacional)

Para inventariar unidades em paralelo com governanca:

- Permita varios eventos `EM_ANDAMENTO`, com regra de conflito por escopo.
- Escopo `GERAL` (todas as unidades) e exclusivo.
- Escopo por unidade aceita no maximo 1 evento ativo por unidade.
- Um evento de unidade conflita com:
  - outro evento ativo da mesma unidade
  - qualquer evento `GERAL` ativo

### Regra pratica

- Unidade 1 e Unidade 2 podem inventariar ao mesmo tempo.
- Unidade 1 nao pode abrir dois eventos simultaneos.
- Se houver evento `GERAL`, nenhum evento por unidade pode ser aberto/reaberto.

### Contagem no modo por unidade

- No Modo Inventario, o operador deve selecionar explicitamente o **Evento ativo**.
- A `unidade encontrada` deve ser compativel com o escopo do evento.
- Se evento for de unidade especifica, `POST /inventario/sync` rejeita unidade divergente (`UNIDADE_FORA_ESCOPO_EVENTO`).
- Evento `GERAL` aceita contagens de qualquer unidade.

---

## Inventario ciclico (rotativo)

O inventario ciclico permite contagens frequentes por recortes menores (micro-inventarios), sem parar toda a operacao da unidade.

### Tipos de ciclo

- `SEMANAL`
- `MENSAL`
- `ANUAL`
- `ADHOC` (pontual)

### Escopos de evento

- `GERAL`: cobre toda a base.
- `UNIDADE`: cobre apenas uma unidade (1..4).
- `LOCAIS`: cobre apenas uma lista de salas cadastradas (`local_id`), dentro de uma mesma unidade.

### Regras de conflito de eventos ativos

- Evento `GERAL` conflita com qualquer outro evento ativo.
- Evento `UNIDADE` conflita com `GERAL` e com eventos ativos da mesma unidade.
- Evento `LOCAIS` conflita com:
  - `GERAL`
  - eventos ativos da mesma unidade
  - eventos `LOCAIS` com sobreposicao de salas.

### Sugestoes de ciclo

A administracao passa a ter a consulta:

- `GET /inventario/sugestoes-ciclo`

Ordenacao prioritaria:

1. locais ha mais tempo sem contagem (`data_ultima_contagem` mais antiga)
2. maior volume de bens ativos na sala (desempate)

Observacao de UX:

- Quando um local ainda nao possui `data_ultima_contagem`, a UI exibe `Sem contagem`.
- Isso evita mostrar numero sentinela tecnico (ex.: `999999 dias`) para operador.

### Atualizacao de ultima contagem

- Em cada `POST /inventario/sync` valido, quando houver `localEncontradoId`, o sistema atualiza `locais.data_ultima_contagem`.
- Isso alimenta automaticamente as sugestoes do proximo ciclo.
- Para ambiente legado, aplicar tambem `database/018_backfill_locais_data_ultima_contagem.sql` para preencher ultima contagem com historico ja existente.
