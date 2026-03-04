<!--
MÃ³dulo: wiki
Arquivo: frontend/src/wiki/06_inventario_endereço_a_endereço.md
FunÃ§Ã£o no sistema: orientar o fluxo de InventÃ¡rio - Contagem (operaÃ§Ã£o por endereço).
-->

# InventÃ¡rio - Contagem

## Onde acessar no menu

No grupo **OperaÃ§Ãµes Patrimoniais**:

- `InventÃ¡rio - Contagem`: tela operacional de leitura e registro.
- `InventÃ¡rio - AdministraÃ§Ã£o`: tela de gestÃ£o de inventÃ¡rios e ciclos.
- `Cadastrar Bens por endereço`: regularizaÃ§Ã£o em lote de localizaÃ§Ã£o (sem transferir carga).

## Acompanhamento de progresso por endereço

Ao acessar **Cadastrar Bens por endereço**, o sistema exibe um card de progresso com:

- **Total**: quantidade total de bens prÃ³prios nÃ£o baixados.
- **Atualizados**: bens com `local_id` vinculado.
- **Pendentes**: bens sem endereço atribuÃ­da (`local_id IS NULL`).
- **Barra de progresso**: percentual de bens atualizados sobre o total.

### Comportamento por contexto

| SituaÃ§Ã£o | ExibiÃ§Ã£o |
|---|---|
| Sem filtro de unidade | Totais globais (todas as unidades) |
| Unidade selecionada | Totais filtrados pela unidade |
| ApÃ³s salvar lote na endereço | EstatÃ­sticas atualizadas automaticamente |

Endpoint:

- `GET /locais/estatisticas`

## Ver bens por situaÃ§Ã£o

O botÃ£o **Ver bens por situaÃ§Ã£o** abre painel expansÃ­vel com duas abas:

- **Pendentes (sem endereço)**: `local_id IS NULL`
- **ConcluÃ­dos (com endereço)**: `local_id IS NOT NULL`

HÃ¡ paginaÃ§Ã£o de 50 itens e colunas: `Tombamento | Nome | Unidade | endereço`.

Endpoint:

- `GET /bens/localizacao?statusLocal=sem_local&unidadeId=2&limit=50&offset=0`

Importante:

- a rota `/bens/localizacao` deve estar registrada antes de `/bens/:id` no `server.js`.

## Reset de localizaÃ§Ã£o fÃ­sica (prÃ©-inventÃ¡rio livre)

OperaÃ§Ã£o administrativa para limpar `local_id` de todos os bens (ou de uma unidade).

Checklist:

1. Clicar em **Resetar localizaÃ§Ã£o**.
2. Selecionar escopo (`todas` ou `unidade`).
3. Informar senha de administrador.
4. Digitar `RESETAR` para confirmaÃ§Ã£o.

Endpoint:

- `DELETE /locais/reset?unidadeId=2`

Body:

```json
{ "adminPassword": "senha_do_admin" }
```

## InventÃ¡rio simultÃ¢neo por unidade

Regras operacionais:

- Escopo `GERAL` Ã© exclusivo.
- Escopo `UNIDADE` permite no mÃ¡ximo 1 inventÃ¡rio ativo por unidade.
- Escopo `LOCAIS` segue a unidade dos locais selecionados.

Exemplos:

- Unidade 1 e Unidade 2 podem inventariar em paralelo.
- Unidade 1 nÃ£o pode abrir dois inventÃ¡rios simultÃ¢neos.
- Com inventÃ¡rio `GERAL` ativo, nÃ£o abre inventÃ¡rio de unidade/local.

## InventÃ¡rio cÃ­clico

Tipos de ciclo:

- `SEMANAL`
- `MENSAL`
- `ANUAL`
- `ADHOC`

Escopos:

- `GERAL`
- `UNIDADE`
- `LOCAIS`

SugestÃµes:

- `GET /inventario/sugestoes-ciclo`

CritÃ©rio:

1. locais hÃ¡ mais tempo sem contagem;
2. maior volume de bens ativos (desempate).

## Modos de contagem cega

### Contagem cega (`CEGO`)

- exige 1 operador com papel `OPERADOR_UNICO`;
- operador nÃ£o vÃª esperado nem diferenÃ§a;
- rodada enviada no sync: `A`.

### Contagem duplo-cega (`DUPLO_CEGO`)

- exige `OPERADOR_A` e `OPERADOR_B`;
- cada operador grava somente sua rodada;
- divergÃªncia A/B gera pendÃªncia de desempate;
- fechamento por rodada `DESEMPATE` de perfil autorizado.

### UI reduzida do operador

Em `CEGO`/`DUPLO_CEGO`:

- navegaÃ§Ã£o do operador designado fica restrita ao fluxo de contagem;
- nÃ£o sÃ£o exibidos painÃ©is de comparaÃ§Ã£o esperada para preservar cegueira;
- regularizaÃ§Ã£o continua no fluxo administrativo pÃ³s-inventÃ¡rio.

## DivergÃªncias interunidades com inventÃ¡rios concomitantes

Quando hÃ¡ inventÃ¡rios em paralelo:

- divergÃªncias entre unidade dona e unidade encontrada ficam visÃ­veis para ambas as unidades;
- monitoramento Ã© imediato;
- regularizaÃ§Ã£o formal ocorre apÃ³s encerramento.

VisualizaÃ§Ã£o:

- `InventÃ¡rio - AdministraÃ§Ã£o` -> `DivergÃªncias interunidades (tempo real)`.

Filtros recomendados:

1. status `EM_ANDAMENTO` para resposta rÃ¡pida;
2. unidade relacionada para foco operacional;
3. cÃ³digo do inventÃ¡rio quando houver mÃºltiplos eventos ativos.

## Matriz de permissÃ£o por rodada

| Modo | Papel no evento | Rodadas permitidas |
|---|---|---|
| `PADRAO` | Operador autenticado | `A` |
| `CEGO` | `OPERADOR_UNICO` | `A` |
| `DUPLO_CEGO` | `OPERADOR_A` | `A` |
| `DUPLO_CEGO` | `OPERADOR_B` | `B` |
| `DUPLO_CEGO` | ADMIN ou operador com `permiteDesempate=true` | `DESEMPATE` |

## Erros operacionais comuns (modos cegos)

| CÃ³digo | Causa | AÃ§Ã£o recomendada |
|---|---|---|
| `NAO_DESIGNADO` | UsuÃ¡rio nÃ£o designado no evento | Admin deve designar operador |
| `RODADA_NAO_PERMITIDA` | Rodada incompatÃ­vel com o papel | Ajustar rodada ou perfil |
| `DESEMPATE_SEM_PERMISSAO` | UsuÃ¡rio sem permissÃ£o para desempate | Executar com ADMIN ou autorizado |
| `RODADA_INVALIDA` | Valor fora de `A/B/DESEMPATE` | Corrigir payload/cliente |

