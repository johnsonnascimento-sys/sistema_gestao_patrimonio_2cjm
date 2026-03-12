<!--
Modulo: wiki
Arquivo: frontend/src/wiki/19_dashboard.md
Funcao no sistema: documentar o painel inicial (Dashboard) e seus atalhos operacionais.
-->

# Dashboard

## Objetivo

O Dashboard e a tela inicial para visao rapida da operação patrimonial.

Ele concentra:

- indicadores principais de bens
- status de inventario ativo
- atalhos para modulos operacionais
- visao resumida de atividade recente

## Blocos principais

### KPIs

- total de bens
- bens em processo de baixa
- distribuicao por unidade
- estado geral de processamento da base

### Inventário ativo

- quantidade de eventos em andamento
- indicação de escopo (geral/unidade/locais)
- alerta de bloqueio de transferencia no escopo do Art. 183

### Atalhos

- abrir Inventário -> Contagem
- abrir Inventário -> Administração
- abrir Consulta de Bens
- abrir Movimentações

### Bens em processo de baixa

- card dedicado para bens com baixa patrimonial aberta;
- leitura direta do fluxo iniciado em `Material Inservível / Baixa`;
- objetivo: evitar movimentação indevida ou leitura ambígua de bem ainda não baixado, mas já em tratamento formal.

## Uso recomendado

1. Entrar no Dashboard no inicio do turno.
2. Verificar se ha inventario ativo e em qual unidade.
3. Abrir o modulo de trabalho pelo atalho correto.

## Observações

- O Dashboard nao substitui auditoria detalhada.
- Para trilha formal de alterações, usar "Auditoria e Logs".

## Navegação operacional

- A barra lateral separa `Operação diaria`, `Auditoria e Logs`, `Administração do Painel` e `Referência e apoio`.
- O topo da aplicação exibe a area atual para reduzir troca de contexto durante o turno.
- `Wiki / Manual` e `Normas` permanecem acessiveis, mas ficam rebaixados como apoio e nao como fluxo principal.
- Abaixo de `Normas`, a barra lateral exibe a versão publicada do frontend, o commit em produção e a data/hora do build para facilitar conferência rápida de ambiente sem entrar na área de Health.

## Carregamento sob demanda

- Os painéis operacionais mais pesados passam a ser carregados sob demanda, reduzindo o peso inicial da aplicação sem mudar rotas nem a navegação funcional.
