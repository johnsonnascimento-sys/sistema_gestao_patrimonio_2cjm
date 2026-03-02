<!--
Modulo: wiki
Arquivo: frontend/src/wiki/20_material_sku.md
Funcao no sistema: documentar o modulo Material (SKU).
-->

# Material (SKU)

## Objetivo

O modulo Material (SKU) centraliza o cadastro padrao do item de catalogo.

Cada material pode ser associado a varios bens (tombamentos).

## Operacoes principais

- criar material
- editar Material (SKU) por codigo (edicao rapida)
- marcar material permanente
- anexar foto de referencia (SKU)
- consultar itens associados
- aplicar nome resumo para todos os bens do mesmo SKU

## Fluxo mais intuitivo (recomendado)

1. Em **Criar/editar Material (SKU)**, use **Edicao rapida por codigo**.
2. Informe o codigo do material e clique **Carregar para edicao**.
3. Ajuste descricao/grupo/foto e salve.
4. Em **Nome Resumo em lote por SKU**, selecione o Material (SKU), informe o nome resumo e aplique.

## Regras operacionais

- O codigo do material deve seguir o cadastro oficial do GEAFIN para evitar divergencia.
- Associacao de bens e feita por tombamento.
- A foto do SKU e referencia visual do catalogo, nao substitui a foto do item fisico.
- O nome resumo pode ser aplicado em lote para todos os bens vinculados ao SKU selecionado.

## Filtros e consulta

A grade permite filtrar por colunas, incluindo:

- codigo
- descricao
- grupo
- permanente
- quantidade de bens

## Boas praticas

1. Padronizar descricao do SKU antes de associar bens.
2. Evitar duplicar codigo de material.
3. Confirmar se o codigo informado e o mesmo usado no GEAFIN.
4. Ao definir um nome resumo padrao, aplicar em lote no SKU para manter consistencia de exibicao nas telas.
