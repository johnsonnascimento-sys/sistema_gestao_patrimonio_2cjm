<!--
Modulo: wiki
Arquivo: frontend/src/wiki/03_consulta_bens.md
Funcao no sistema: orientar uso da tela "Consulta de Bens" e detalhamento.
-->

# Consulta de bens

## Para que serve

Esta e a tela do dia a dia para:

- Encontrar um bem pelo tombamento (10 digitos).
- Pesquisar por palavras na descricao.
- Ver unidade (carga), local fisico e status.
- Abrir detalhes completos quando precisar auditar/entender o historico.

## Como pesquisar corretamente

### 1) Tombamento (10 digitos)

- Digite **somente numeros**, com **10 digitos**.
- Exemplo valido: `1290001788`
- Exemplo invalido: `TMB-00772` (isso nao e tombamento GEAFIN; e outro tipo de numeracao/etiqueta)

Se voce colar algo com espacos/pontos/traços, o sistema pode limpar e manter apenas os digitos. Se ainda assim nao der 10 digitos, vai avisar.

### 2) Texto na descricao

Use termos de busca:

- "PROJETOR"
- "NOTEBOOK"
- "ARMARIO"

Recomendacao: use palavras bem distintivas para reduzir resultados.

### 3) Filtro por unidade

Use quando voce quer ver apenas itens de uma unidade (carga).

## Entendendo as colunas

As colunas visiveis na lista sao um "resumo operacional". O sistema guarda mais campos no detalhe.

Campos tipicos no resumo:

- Tombo (tombamento)
- Descricao (do catalogo ou descricao consolidada)
- Unidade (carga)
- Local (local fisico)
- Status (OK/EM_CAUTELA/BAIXADO/AGUARDANDO_RECEBIMENTO quando aplicavel)

## Ver mais detalhes (modal "Detalhes")

Quando voce clicar em **Detalhes**, o sistema abre um painel com:

- Dados completos do bem
- Dados do catalogo (marca/modelo/descricao unica)
- Historico de movimentacoes (cautela/transferencia)
- Historico de transferencias de carga (quando aplicavel)

Use isso quando precisar:

- Confirmar que um bem mudou de unidade (auditoria).
- Entender se esta em cautela e com quem.
- Checar o que aconteceu em datas anteriores.

## Dicas de uso (operacao rapida)

- Se voce estiver no inventario e nao encontrou um item, use a Consulta para ver "onde deveria estar" e "onde esta cadastrado".
- Se o bem aparecer com status `AGUARDANDO_RECEBIMENTO`, significa que veio do GEAFIN mas ainda nao foi localizado/recebido fisicamente.

