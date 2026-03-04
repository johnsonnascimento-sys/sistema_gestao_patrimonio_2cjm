<!--
Modulo: wiki
Arquivo: frontend/src/wiki/20_material_sku.md
Funcao no sistema: documentar o modulo Material (SKU).
-->

# Material (SKU)

## Objetivo

O modulo Material (SKU) centraliza o cadastro padrao do item de cat?logo.

Cada material pode ser associado a varios bens (tombamentos).

## Opera?es principais

- criar material
- editar Material (SKU) por codigo (edicao rapida)
- marcar material permanente
- anexar foto de referencia (SKU)
- consultar itens associados
- aplicar nome resumo para todos os bens do mesmo SKU

## Fluxo mais intuitivo (recomendado)

1. Em **Criar/editar Material (SKU)**, use **Edicao rapida por codigo**.
2. Informe o codigo do material e clique **Carregar para edicao**.
3. Ajuste os campos na ordem:
   - Nome resumo (aplicar em lote no SKU)
   - Descri?o
   - Classifica?o SIAFI (obrigatorio)
4. Ao alterar o codigo do material (SKU), o sistema alerta:
   - "o código do material (SKU) deve ser o mesmo do GEAFIN para evitar diverg?ncias na importa?o. Exemplo: MESA DE SOM MIXER, MODELO: XENYX 2222 UDB, MARCA: BEHRINGER -> codigo GEAFIN 49581."
5. Para salvar edicao, confirme no modal de seguranca:
   - marcar a confirma?o operacional;
   - digitar `CONFIRMAR_EDICAO_MATERIAL`;
   - informar senha administrativa.
6. Clique em **Aplicar agora** (ou salve o Material para aplicar no mesmo fluxo).

## Regras operacionais

- O codigo do material deve seguir o cadastro oficial do GEAFIN para evitar divergencia.
- Associa?o de bens e feita por tombamento.
- A foto do SKU e referencia visual do cat?logo, n?o substitui a foto do item fisico.
- O nome resumo pode ser aplicado em lote para todos os bens vinculados ao SKU selecionado.
- A edicao do nome resumo fica na secao principal de cria?o/edicao do Material (SKU), sem painel separado.
- A edicao de Material (SKU) exige dupla confirma?o e senha administrativa.
- A Classifica?o SIAFI e obrigatoria e deve existir no cadastro dedicado de Classifica?o SIAFI.

## Filtros e consulta

A grade permite filtrar por colunas, incluindo:

- codigo
- descri?o
- classifica?o SIAFI
- permanente
- quantidade de bens

## Boas praticas

1. Padronizar descri?o do SKU antes de associar bens.
2. Evitar duplicar codigo de material.
3. Confirmar se o codigo informado e o mesmo usado no GEAFIN.
4. Ao definir um nome resumo padrao, aplicar em lote no SKU para manter consistencia de exibicao nas telas.
