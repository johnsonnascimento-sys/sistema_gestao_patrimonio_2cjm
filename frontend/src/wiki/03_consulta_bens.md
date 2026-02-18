<!--
Modulo: wiki
Arquivo: frontend/src/wiki/03_consulta_bens.md
Funcao no sistema: orientar uso da tela "Consulta de Bens" e detalhamento.
-->

# Consulta de bens

## Para que serve

Esta é a tela do dia a dia para:

- Encontrar um bem pelo tombamento (10 digitos).
- Pesquisar por palavras na descrição.
- Ver unidade (carga), local físico e status.
- Abrir detalhes completos quando precisar auditar/entender o histórico.

## Como pesquisar corretamente

### 1) Tombamento (10 dígitos)

- Digite **somente números**, com **10 dígitos**.
- Exemplo valido: `1290001788`
- Exemplo inválido: `TMB-00772` (isso não é tombamento GEAFIN; é outro tipo de numeração/etiqueta)

Se você colar algo com espaços/pontos/traços, o sistema pode limpar e manter apenas os dígitos. Se ainda assim não der 10 dígitos, vai avisar.

### 2) Texto na descrição

Use termos de busca:

- "PROJETOR"
- "NOTEBOOK"
- "ARMARIO"

Recomendação: use palavras bem distintivas para reduzir resultados.

### 3) Local (texto do GEAFIN / local_fisico)

Use este campo para filtrar pelo **texto** de localização que veio do GEAFIN (coluna `local_fisico`).

Exemplos:

- "Sala 101"
- "Hall 6º Andar"
- "Almox"

Importante:

- Este campo é **separado** da descrição do bem. Não use "descrição" para procurar local.

### 4) Filtro por unidade

Use quando você quer ver apenas itens de uma unidade (carga).

## Entendendo as colunas

As colunas visiveis na lista sao um "resumo operacional". O sistema guarda mais campos no detalhe.

Campos típicos no resumo:

- Tombo (tombamento)
- Descrição (do catálogo ou descrição consolidada)
- Unidade (carga)
- Local (local fisico)
- Status (OK/EM_CAUTELA/BAIXADO/AGUARDANDO_RECEBIMENTO quando aplicavel)

## Ver mais detalhes (modal "Detalhes")

Quando você clicar em **Detalhes**, o sistema abre um painel com:

- Dados completos do bem
- Dados do catálogo (marca/modelo/descrição única)
- Histórico de movimentações (cautela/transferência)
- Histórico de transferências de carga (quando aplicável)

Use isso quando precisar:

- Confirmar que um bem mudou de unidade (auditoria).
- Entender se está em cautela e com quem.
- Checar o que aconteceu em datas anteriores.

## Editar bem (ADMIN)

No modal de detalhes, usuários `ADMIN` podem editar os campos operacionais do bem (exceto chaves), incluindo:

- Unidade (carga)
- Status
- Descrição complementar
- Responsável (perfilId)
- Contrato / data / valor de aquisição
- Local físico (texto legado do GEAFIN)
- Sala/Local (padronizado) via tabela `locais`

Importante:

- **Unidade (1..4)** é a *carga* (quem é o dono no sistema).
- **Sala/Local** é um cadastro operacional (tabela `locais`) para padronizar ambientes.

## Fotos (item e referência do SKU)

No mesmo modal, o `ADMIN` pode:

- **Tirar foto** na hora (celular) ou **Enviar arquivo** (galeria/computador).
- A imagem é **automaticamente otimizada** (redimensionada para max 1200px e convertida para WebP) e salva no servidor VPS.
- **Remover foto**: Clique no botão "Remover foto" para desvincular a imagem do bem. A alteração será efetivada ao clicar em "Salvar alterações do bem".

OBS: O sistema armazena as fotos localmente no servidor para maior performance e privacidade.

## Dicas de uso (operacao rapida)

- Se você estiver no inventário e não encontrou um item, use a Consulta para ver "onde deveria estar" e "onde está cadastrado".
- Se o bem aparecer com status `AGUARDANDO_RECEBIMENTO`, significa que veio do GEAFIN mas ainda não foi localizado/recebido fisicamente.
