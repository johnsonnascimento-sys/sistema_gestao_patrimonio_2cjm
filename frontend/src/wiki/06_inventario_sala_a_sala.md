<!--
Módulo: wiki
Arquivo: frontend/src/wiki/06_inventario_endereço_a_endereço.md
Função no sistema: orientar o fluxo de Inventário - Contagem (operação por endereço).
-->

# Inventário - Contagem

## Onde acessar no menu

No grupo **Operações Patrimoniais**:

- `Inventário - Contagem`: tela operacional de leitura e registro.
- `Inventário - Administração`: tela de gestão de inventários e ciclos.
- `Cadastrar Bens por endereço`: regularização em lote de localização (sem transferir carga).

## Acompanhamento de progresso por endereço

Ao acessar **Cadastrar Bens por endereço**, o sistema exibe um card de progresso com:

- **Total**: quantidade total de bens próprios não baixados.
- **Atualizados**: bens com `local_id` vinculado.
- **Pendentes**: bens sem endereço atribuída (`local_id IS NULL`).
- **Barra de progresso**: percentual de bens atualizados sobre o total.

### Comportamento por contexto

| Situação | Exibição |
|---|---|
| Sem filtro de unidade | Totais globais (todas as unidades) |
| Unidade selecionada | Totais filtrados pela unidade |
| Após salvar lote na endereço | Estatísticas atualizadas automaticamente |

Endpoint:

- `GET /locais/estatisticas`

## Ver bens por situação

O botão **Ver bens por situação** abre painel expansível com duas abas:

- **Pendentes (sem endereço)**: `local_id IS NULL`
- **Concluídos (com endereço)**: `local_id IS NOT NULL`

Há paginação de 50 itens e colunas: `Tombamento | Nome | Unidade | endereço`.

Endpoint:

- `GET /bens/localizacao?statusLocal=sem_local&unidadeId=2&limit=50&offset=0`

Importante:

- a rota `/bens/localizacao` deve estar registrada antes de `/bens/:id` no `server.js`.

## Reset de localização física (pré-inventário livre)

Operação administrativa para limpar `local_id` de todos os bens (ou de uma unidade).

Checklist:

1. Clicar em **Resetar localização**.
2. Selecionar escopo (`todas` ou `unidade`).
3. Informar senha de administrador.
4. Digitar `RESETAR` para confirmação.

Endpoint:

- `DELETE /locais/reset?unidadeId=2`

Body:

```json
{ "adminPassword": "senha_do_admin" }
```

## Inventário simultâneo por unidade

Regras operacionais:

- Escopo `GERAL` é exclusivo.
- Escopo `UNIDADE` permite no máximo 1 inventário ativo por unidade.
- Escopo `LOCAIS` segue a unidade dos locais selecionados.

Exemplos:

- Unidade 1 e Unidade 2 podem inventariar em paralelo.
- Unidade 1 não pode abrir dois inventários simultâneos.
- Com inventário `GERAL` ativo, não abre inventário de unidade/local.

## Inventário cíclico

Tipos de ciclo:

- `SEMANAL`
- `MENSAL`
- `ANUAL`
- `ADHOC`

Escopos:

- `GERAL`
- `UNIDADE`
- `LOCAIS`

Sugestões:

- `GET /inventario/sugestoes-ciclo`

Critério:

1. locais há mais tempo sem contagem;
2. maior volume de bens ativos (desempate).

## Modos de contagem cega

### Contagem cega (`CEGO`)

- exige 1 operador com papel `OPERADOR_UNICO`;
- operador não vê esperado nem diferença;
- rodada enviada no sync: `A`.

### Contagem duplo-cega (`DUPLO_CEGO`)

- exige `OPERADOR_A` e `OPERADOR_B`;
- cada operador grava somente sua rodada;
- divergência A/B gera pendência de desempate;
- fechamento por rodada `DESEMPATE` de perfil autorizado.

### UI reduzida do operador

Em `CEGO`/`DUPLO_CEGO`:

- navegação do operador designado fica restrita ao fluxo de contagem;
- não são exibidos painéis de comparação esperada para preservar cegueira;
- regularização continua no fluxo administrativo pós-inventário.

## Divergências interunidades com inventários concomitantes

Quando há inventários em paralelo:

- divergências entre unidade dona e unidade encontrada ficam visíveis para ambas as unidades;
- monitoramento é imediato;
- regularização formal ocorre após encerramento.

Visualização:

- `Inventário - Administração` -> `Divergências interunidades (tempo real)`.

Filtros recomendados:

1. status `EM_ANDAMENTO` para resposta rápida;
2. unidade relacionada para foco operacional;
3. código do inventário quando houver múltiplos eventos ativos.

## Matriz de permissão por rodada

| Modo | Papel no evento | Rodadas permitidas |
|---|---|---|
| `PADRAO` | Operador autenticado | `A` |
| `CEGO` | `OPERADOR_UNICO` | `A` |
| `DUPLO_CEGO` | `OPERADOR_A` | `A` |
| `DUPLO_CEGO` | `OPERADOR_B` | `B` |
| `DUPLO_CEGO` | ADMIN ou operador com `permiteDesempate=true` | `DESEMPATE` |

## Erros operacionais comuns (modos cegos)

| Código | Causa | Ação recomendada |
|---|---|---|
| `NAO_DESIGNADO` | Usuário não designado no evento | Admin deve designar operador |
| `RODADA_NAO_PERMITIDA` | Rodada incompatível com o papel | Ajustar rodada ou perfil |
| `DESEMPATE_SEM_PERMISSAO` | Usuário sem permissão para desempate | Executar com ADMIN ou autorizado |
| `RODADA_INVALIDA` | Valor fora de `A/B/DESEMPATE` | Corrigir payload/cliente |

