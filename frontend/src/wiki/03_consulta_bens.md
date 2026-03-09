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

## Atalhos vindos do Inventário - Administração

O painel `Bens não contados` em `Inventário - Administração` usa esta tela como atalho operacional.

Comportamento:

- clique no `Tombo`:
  - abre `Consulta de bens`;
  - aplica o filtro do tombamento;
  - abre automaticamente o modal `Detalhes` do bem.
- clique em `Material (SKU)`:
  - abre `Consulta de bens`;
  - aplica o filtro do código do material;
  - mantém a lista pronta para conferência do grupo de bens daquele SKU.

## Como pesquisar corretamente

## Consulta rápida x filtros avançados

A entrada da tela foi reorganizada para reduzir o tempo até a primeira ação útil.

Agora a tela separa visualmente:

- `Consulta rápida`:
  - tombamento de 10 dígitos;
  - etiqueta de 4 dígitos;
  - leitura por câmera;
  - material (SKU) como atalho operacional;
- `Filtros avançados`:
  - texto livre;
  - unidade;
  - endereço;
  - responsável;
  - status.

Uso recomendado:

- para localizar um bem específico, priorize `Consulta rápida`;
- para auditoria, conferência ampla ou investigação, abra `Filtros avançados`.

## Orientacao embutida na tela

Para reduzir dependencia do manual durante a operacao, a propria tela agora destaca:

- quais identificadores resolvem a maior parte das consultas do dia a dia;
- quando vale a pena insistir na `Consulta rapida`;
- quando realmente abrir `Filtros avancados`;
- como retomar o fluxo anterior quando a tela for aberta por atalho do inventario.

Objetivo operacional:

- menos tempo ate a primeira consulta util;
- menor necessidade de consultar a wiki para decidir como pesquisar.

## Estrutura operacional da tela

A tela está organizada em blocos mais previsíveis:

1. cabeçalho e contexto de origem;
2. resumo de estoque total e por unidade;
3. painel `Consulta rápida`;
4. painel `Filtros avançados`, quando necessário;
5. tabela de resultados com fotos, paginação e atalhos.

Essa separação existe para reduzir o acoplamento entre navegação, filtros e resultados, sem mudar o comportamento funcional da consulta.

## Decomposição técnica da tela

Nesta etapa do plano de UX operacional, o modal `Detalhes do bem` saiu do arquivo principal da consulta e passou a morar em um componente dedicado.

Objetivo:

- reduzir o acoplamento entre listagem e edição detalhada;
- preservar o mesmo contrato de abertura do modal;
- deixar a evolução de auditoria, fotos e histórico do bem menos arriscada.

## Contexto vindo de outras telas

Quando a `Consulta de Bens` for aberta a partir de atalhos operacionais, a própria tela mostra um banner de contexto no topo.

Exemplos:

- origem em `Inventário - Administração`;
- abertura pelo `Tombo` no painel `Bens não contados`;
- abertura por `Material (SKU)` no mesmo painel.

Esse banner existe para reduzir perda de contexto ao navegar entre telas.

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

- "endereço 101"
- "Hall 6º Andar"
- "Almox"

Importante:

- Este campo é **separado** da descrição do bem. Não use "descrição" para procurar local.

### 4) Filtro por unidade

Use quando você quer ver apenas itens de uma unidade (carga).


### 5) Filtro por responsavel

- Digite matrícula ou nome do responsavel patrimonial.
- Selecione o perfil sugerido para filtrar com precisao.
- O resultado lista apenas bens associados ao responsavel selecionado.

## Entendendo as colunas

As colunas visiveis na lista sao um "resumo operacional". O sistema guarda mais campos no detalhe.

Campos típicos no resumo:

- Tombo (tombamento)
- Descrição (do catálogo ou descrição consolidada)
- Unidade (carga)
- Local (local fisico)
- Responsavel (matrícula/nome)
- Tombo antigo (Azul) (`cod2Aud`)
- Catálogo (SKU)
- Status (OK/EM_CAUTELA/BAIXADO/AGUARDANDO_RECEBIMENTO quando aplicavel)

Na grade de resultados, você pode habilitar:

- Foto do item
- Foto do catálogo

Essas opções ficam acima da tabela e valem para toda a listagem (não apenas no modal).

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
Quando o status do bem for `EM_CAUTELA`, o modal mostra o bloco **Cautela atual** com:

- `detentorTemporarioPerfilId`
- matrícula e nome do detentor
- data prevista de devolucao (ou "Sem data prevista")

## Linha do tempo de alterações e reversao (modal)

No modal de detalhes, ha uma seção **Linha do tempo de alterações** com:

- Quem alterou (`executorNome`/matrícula quando disponivel)
- Data e hora da alteração
- O que mudou (campo, valor antes, valor depois)
- Origem da alteração (tabela/operação auditada)

Modo de reversao item-a-item (ADMIN):

- Cada registro elegivel exibe o botao **Reverter esta alteração**
- A reversao cria nova trilha de auditoria (não apaga historico)
- Recomenda-se reverter apenas alterações indevidas, validando antes no proprio diff

## Editar bem (ADMIN)

No modal de detalhes, usuarios `ADMIN` podem editar os campos operacionais do bem (exceto chaves), incluindo:

- Material (SKU) via busca por codigo
- endereço/Local (padronizado) via tabela locais
- Responsavel patrimonial por busca de matrícula ou nome (com dupla confirmação na associação)
- Contrato / data / valor de aquisicao
- Observações (texto livre relacionado ao bem)
- Fotos (item e referencia do SKU)

Importante no modal:

- Unidade (carga) e status aparecem bloqueados e exigem o fluxo proprio em Movimentações.
- Nome Resumo e Descrição sao exibidos em modo leitura e devem ser alterados no menu Material (SKU).
- A descrição exibida no modal vem da ficha do Material (SKU).
- Responsavel patrimonial indica posse operacional no dia a dia, sem cautela ativa.
- Usuarios selecionados como responsavel devem estar cadastrados em Administração do Painel -> Perfis e Acessos.
- Cautela e outro fluxo: fica registrada em Movimentações com detentor temporario e status EM_CAUTELA.
- Em CAUTELA_SAIDA, o responsavel patrimonial e preenchido automaticamente com o detentor da cautela.
- Em CAUTELA_RETORNO, o sistema pergunta se deve manter o mesmo responsavel patrimonial.

## Fotos (item e referencia do SKU)

No mesmo modal, o `ADMIN` pode:

- **Tirar foto** na hora (celular) ou **Enviar arquivo** (galeria/computador).
- A imagem é **automaticamente otimizada** (redimensionada para max 1200px e convertida para WebP) e salva no servidor VPS.
- **Remover foto**: Clique no botão "Remover foto" para desvincular a imagem do bem. A alteração será efetivada ao clicar em "Salvar alterações do bem".

OBS: O sistema armazena as fotos localmente no servidor para maior performance e privacidade.

## Dicas de uso (operação rapida)

- Se você estiver no inventário e não encontrou um item, use a Consulta para ver "onde deveria estar" e "onde está cadastrado".
- Se o bem aparecer com status `AGUARDANDO_RECEBIMENTO`, significa que veio do GEAFIN mas ainda não foi localizado/recebido fisicamente.
## Leitor de codigo de barras (scanner fisico)

No campo **Tombamento (10) ou Etiqueta (4)**:

- O sistema aceita leitura continua por scanner de bancada/pistola (modo teclado).
- O sufixo de leitura com Enter, Tab **ou** Ctrl+J dispara a consulta automaticamente.
- Apos cada leitura, o foco volta para o mesmo campo para o proximo bip.

- Observação: alguns leitores wireless enviam Ctrl+J; o sistema bloqueia o atalho de Downloads do navegador durante a leitura.






