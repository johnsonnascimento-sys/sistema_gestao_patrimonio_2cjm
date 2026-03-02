<!--
Modulo: wiki
Arquivo: frontend/src/wiki/22_inventario_administracao.md
Funcao no sistema: documentar o menu Inventario - Administracao.
-->

# Inventario - Administracao

## Objetivo

Essa tela e usada pelo administrador do inventario para governar eventos e ciclos.

## Operacoes principais

- abrir evento de inventario
- definir tipo de ciclo (`ADHOC`, `SEMANAL`, `MENSAL`, `ANUAL`)
- definir escopo (`GERAL`, `UNIDADE`, `LOCAIS`)
- encerrar ou reabrir evento
- acompanhar relatorio de encerramento

## Micro-inventario ciclico

A tela permite abrir micro-inventarios de forma rapida por unidade/sala.

Tambem exibe sugestoes de ciclo baseadas em tempo sem contagem e volume de bens por local.

## Regras de escopo

- Evento `GERAL` conflita com qualquer outro evento ativo.
- Evento `UNIDADE` conflita com eventos da mesma unidade e com `GERAL`.
- Evento `LOCAIS` conflita com sobreposicao de salas no mesmo escopo.

## Responsabilidade

- Operador de sala usa "Inventario - Contagem".
- Administrador usa esta tela para abrir/encerrar e supervisionar o ciclo.
