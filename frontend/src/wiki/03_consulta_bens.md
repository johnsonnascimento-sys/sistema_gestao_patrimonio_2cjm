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

### 1) Tombamento (10 dígitos)

- Digite **somente numeros**, com **10 digitos**.
- Exemplo valido: `1290001788`
- Exemplo inválido: `TMB-00772` (isso não é tombamento GEAFIN; é outro tipo de numeração/etiqueta)

Se você colar algo com espaços/pontos/traços, o sistema pode limpar e manter apenas os dígitos. Se ainda assim não der 10 dígitos, vai avisar.

### 2) Texto na descricao

Use termos de busca:

- "PROJETOR"
- "NOTEBOOK"
- "ARMARIO"

Recomendacao: use palavras bem distintivas para reduzir resultados.

### 3) Local (texto do GEAFIN / local_fisico)

Use este campo para filtrar pelo **texto** de localizacao que veio do GEAFIN (coluna `local_fisico`).

Exemplos:

- "Sala 101"
- "Hall 6º Andar"
- "Almox"

Importante:

- Este campo e **separado** da descricao do bem. Nao use "descricao" para procurar local.

### 4) Filtro por unidade

Use quando voce quer ver apenas itens de uma unidade (carga).

## Entendendo as colunas

As colunas visiveis na lista sao um "resumo operacional". O sistema guarda mais campos no detalhe.

Campos típicos no resumo:

- Tombo (tombamento)
- Descrição (do catálogo ou descrição consolidada)
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

- Se você estiver no inventário e não encontrou um item, use a Consulta para ver "onde deveria estar" e "onde está cadastrado".
- Se o bem aparecer com status `AGUARDANDO_RECEBIMENTO`, significa que veio do GEAFIN mas ainda não foi localizado/recebido fisicamente.
