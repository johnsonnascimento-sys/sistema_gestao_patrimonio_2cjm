<!--
Módulo: wiki
Arquivo: frontend/src/wiki/22_inventario_administracao.md
Função no sistema: orientar a operação no menu Inventário - Administração.
-->

# Inventário - Administração

## Objetivo da tela

A tela **Inventário - Administração** concentra quatro tarefas:

1. controlar inventário em andamento (encerrar, cancelar, reabrir);
2. abrir novo inventário em formulário único;
3. monitorar divergências interunidades em tempo real;
4. acompanhar histórico consolidado.

## Estrutura da página

### 1) Cabeçalho operacional

- mostra o estado atual da operação em badges curtos:
  - evento em andamento ou ausência de evento;
  - código do evento;
  - escopo;
  - modo de contagem;
  - unidade em foco;
  - responsável.
- o objetivo é responder imediatamente a pergunta:
  - "qual é o inventário ativo e qual é a próxima ação?"

### 2) Cockpit do evento ativo

Quando existe evento `EM_ANDAMENTO`, a primeira dobra da página passa a priorizar:

- coluna esquerda:
  - `Evento ativo`;
  - seletor do evento em andamento;
  - resumo operacional com código, escopo, modo, unidade e referência temporal;
  - ações críticas:
    - `Encerrar inventário`
    - `Cancelar inventário`
  - observação da ação crítica;
  - progresso consolidado do inventário;
- coluna direita:
  - `Bens não contados`;
  - KPIs de faltantes, endereços críticos, cobertura e total contados/esperados;
  - retomada rápida da contagem por endereço.

### 3) Monitoramento operacional

Abaixo do cockpit ficam os painéis de acompanhamento contínuo:

- `Monitoramento em tempo real`
  - KPIs compactos;
  - grade por endereço com esperados, contagem A, contagem B e desempate;
- `Divergências interunidades (tempo real)`
  - KPIs;
  - filtros em faixa própria;
  - tabela resumida com status, tipo e regularização.

### 4) Área secundária

Quando existe evento ativo, o bloco `Novo inventário` perde protagonismo e desce para a área secundária.

Nessa área ficam:

- `Novo inventário`
- `Sugestões de ciclo`
- `Histórico resumido`
- `Acuracidade de inventário`

`Histórico resumido` e `Acuracidade de inventário` permanecem disponíveis, mas agora ficam visualmente rebaixados como leitura secundária em relação ao cockpit do evento ativo.

Nesta etapa da decomposição estrutural, os componentes visuais puros do cockpit passaram a morar em um módulo dedicado (`InventoryAdminUi.jsx`), reduzindo o acoplamento do painel principal sem alterar consultas, mutações, filtros ou ações críticas.

Nesta fase do plano, a UI passou a marcar de forma mais explícita o que é `Área secundária`:

- `Novo inventário` recebe um bloco introdutório de apoio quando já existe evento ativo;
- `Histórico resumido` passou a carregar badge de `Leitura secundária`;
- `Acuracidade de inventário` também reforça que é leitura gerencial e não CTA primário do turno.

Quando **não** existe evento ativo:

- `Novo inventário` volta a ser o bloco principal da coluna esquerda;
- `Sugestões de ciclo` permanecem acopladas ao fluxo de abertura.

## Novo inventário

O formulário continua único, mas agora está agrupado por blocos:

- `Preset e tipo`
- `Modo e designação`
- `Escopo operacional`
- CTA final de abertura

Nesta fase da decomposição, o bloco de abertura e as sugestões de ciclo passaram a usar um componente dedicado (`InventoryEventSetupPanel`), mantendo o mesmo comportamento de presets, designação de operadores, seleção de unidade/endereços e CTA final.

No mesmo ciclo, `Historico resumido` e `Acuracidade de inventario` também deixaram o arquivo principal e passaram a usar painéis dedicados, reduzindo o tamanho e o acoplamento do `InventoryAdminPanel` sem alterar ações críticas, filtros, relatórios ou reabertura de eventos.

Presets rápidos:

- `Inventário geral`
- `Ciclo semanal 1ª Aud`
- `Ciclo semanal 2ª Aud`
- `Ciclo semanal Foro`
- `Ciclo semanal Almox`
- `Por endereço`

Comportamento por escopo:

- `GERAL`:
  - oculta `Tipo de ciclo`;
  - oculta `Unidade inventariada`;
  - CTA: `Abrir inventário geral`.
- `UNIDADE`:
  - mostra `Tipo de ciclo`;
  - mostra `Unidade inventariada`;
  - CTA: `Abrir micro-inventário`.
- `LOCAIS`:
  - mostra `Tipo de ciclo`;
  - mostra `Unidade inventariada`;
  - mostra seleção de endereços;
  - CTA: `Abrir micro-inventário`.

## Sugestões de ciclo

- continuam acessíveis no mesmo fluxo do `Novo inventário`;
- clique na sugestão preenche automaticamente:
  - `escopoTipo=LOCAIS`
  - `tipoCiclo=SEMANAL`
  - unidade e endereço sugeridos.

## Bens não contados

Quando existe evento `EM_ANDAMENTO` selecionado, a administração exibe um painel operacional de faltantes por endereço.

O painel mostra:

- total de bens não contados no evento;
- total de endereços com pendência;
- percentual de cobertura (`contados / esperados`);
- lista agrupada por endereço, ordenada pelos locais com mais faltantes.

Nesta fase da decomposição, o bloco `Bens não contados` passou a ter componente dedicado (`InventoryUncountedAssetsPanel`), mantendo os mesmos atalhos para `Inventário - Contagem` e `Consulta de Bens`.

Cada grupo traz:

- nome do endereço esperado;
- quantidade pendente;
- cobertura do endereço;
- tabela resumida com `Tombo`, `Material (SKU)`, `Descrição` e `Unidade`.

Comportamento:

- somente bens próprios elegíveis entram na visão;
- bens de terceiros e bens baixados ficam fora;
- endereços sem pendência não aparecem;
- a tabela abre em modo recolhido (`details`) para evitar poluição visual.
- clicar no `Tombo` abre a `Consulta de Bens` já com o modal `Detalhes` do bem;
- clicar em `Material (SKU)` abre a `Consulta de Bens` já filtrada pelo código do material.

### Ação rápida para retomar a contagem

Cada endereço com pendência possui o CTA `Abrir contagem do endereço`.

Ao clicar:

- o sistema muda para `Inventário - Contagem`;
- reaproveita o mesmo evento;
- pré-seleciona unidade, local cadastrado e nome do endereço;
- aplica o preset uma única vez, sem sobrescrever mudanças manuais posteriores do operador.

O handoff também leva contexto textual para as telas de destino:

- `Inventário - Contagem` informa quando o endereço foi aberto a partir da administração;
- `Consulta de Bens` informa quando foi aberta pelo `Tombo` ou pelo `Material (SKU)` no painel de não contados.

## Concomitância de inventários por unidade

Regra operacional exibida na UI:

- inventários `UNIDADE` e `LOCAIS` podem rodar em paralelo entre unidades;
- inventário `GERAL` é exclusivo.

Exemplos:

- Unidade 2 e Unidade 3 podem inventariar ao mesmo tempo.
- Não pode haver dois inventários ativos da mesma unidade.
- Se existir inventário `GERAL` ativo, nenhum inventário por unidade ou local deve abrir.

## Divergências interunidades (tempo real)

Painel de monitoramento cruzado:

- visão `Da minha unidade encontradas fora`;
- visão `Outras unidades encontradas na minha`;
- KPIs operacionais de `Pendentes`, `Regularizadas`, `Em andamento` e `Encerrado`;
- filtros:
  - status do inventário (`TODOS`, `EM_ANDAMENTO`, `ENCERRADO`);
  - unidade relacionada;
  - código do inventário;
  - endereço;
- ação rápida `Limpar filtros`;
- tabela com badges visuais para status do inventário, tipo de divergência e situação de regularização.

Importante:

- este painel é de leitura;
- a regularização continua no fluxo pós-inventário (Art. 185).

## Modos de contagem

### `PADRAO`

- sem isolamento de rodada;
- fluxo de inventário tradicional.

### `CEGO`

- exige 1 operador (`OPERADOR_UNICO`);
- operador não vê esperado nem diferença;
- admin monitora progresso sem quebrar a cegueira.

### `DUPLO_CEGO`

- exige 2 operadores (`OPERADOR_A` e `OPERADOR_B`);
- cada operador grava apenas sua rodada;
- divergências A/B geram pendência de desempate;
- desempate é feito por perfil autorizado.

## Confirmação forte (ações críticas)

Ao encerrar ou cancelar:

- modal mostra inventário alvo e impacto da ação;
- campo de observação opcional;
- somente após confirmação explícita a ação é enviada.

## Compliance preservado

- Art. 183 (AN303_Art183): inventário ativo bloqueia mudança de carga.
- Art. 185 (AN303_Art185): divergência não transfere carga automaticamente.
- Art. 175 (AN303_Art175): itens sem identificação exigem evidência visual.

## Painel de Acuracidade

O card "Acuracidade de Inventario" usa `GET /inventario/indicadores-acuracidade` e exibe:

- acuracidade exata por item (`conformes / totalContagens`)
- acuracidade por tolerancia de endereço (`erroRelendereço <= toleranciaPct`)
- taxa de divergencia
- taxa de pendencia de regularizacao
- MTTR de regularizacao (dias)
- cobertura de contagem (`sum(qtdInventariados) / max(sum(qtdEsperados),1)`)

Semaforo operacional:

- Acuracidade Exata: verde `>=98`, amarelo `95-97.99`, vermelho `<95`
- Acuracidade Tolerancia: verde `>=95`, amarelo `90-94.99`, vermelho `<90`
- Pendencia de Regularizacao: verde `<=5`, amarelo `5.01-10`, vermelho `>10`
- MTTR: verde `<=5 dias`, amarelo `6-10`, vermelho `>10`
- Cobertura: verde `>=99`, amarelo `95-98.99`, vermelho `<95`

## Regra operacional para cancelar evento

`CANCELADO` e status de descarte operacional (erro de abertura/configuracao/teste) e nao substitui fechamento do ciclo.

Consequencia:

- evento `CANCELADO` nao permite regularizacao pos-inventario (`POST /inventario/regularizacoes` exige `ENCERRADO`).

Guard rails da UI:

- modal de acao critica explica que cancelamento descarta o evento para regularizacao;
- para cancelar, o operador deve digitar exatamente `CANCELAR_INVENTARIO`.


## Estrutura operacional da tela

O cockpit `Inventário - Administração` permanece organizado em quatro zonas:

- evento ativo;
- bens não contados;
- monitoramento em tempo real;
- divergências interunidades;
- área secundária com novo inventário, histórico e acuracidade.

Detalhe técnico relevante:

- os painéis `Bens não contados`, `Monitoramento em tempo real` e `Divergências interunidades` passaram a compor a tela por componentes internos dedicados;
- isso preserva queries, filtros, atalhos para `Inventário - Contagem` e `Consulta de Bens`, enquanto reduz o acoplamento do arquivo principal.
- o card principal `Evento ativo / Novo inventário` também passou a compor a tela por componente dedicado, mantendo o cockpit principal focado em orquestração e não em JSX inline extenso.
