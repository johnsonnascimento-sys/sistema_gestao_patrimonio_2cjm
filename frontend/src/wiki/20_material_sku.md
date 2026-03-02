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
3. Ajuste os campos na ordem:
   - Nome resumo (aplicar em lote no SKU)
   - Descricao
   - Classificacao SIAFI (obrigatorio)
4. Ao alterar o codigo do material (SKU), o sistema alerta:
   - "o código do material (SKU) deve ser o mesmo do GEAFIN para evitar divergencias na importacao. Exemplo: MESA DE SOM MIXER, MODELO: XENYX 2222 UDB, MARCA: BEHRINGER -> codigo GEAFIN 49581."
5. Para salvar edicao, confirme no modal de seguranca:
   - marcar a confirmacao operacional;
   - digitar `CONFIRMAR_EDICAO_MATERIAL`;
   - informar senha administrativa.
6. Clique em **Aplicar agora** (ou salve o Material para aplicar no mesmo fluxo).

## Regras operacionais

- O codigo do material deve seguir o cadastro oficial do GEAFIN para evitar divergencia.
- Associacao de bens e feita por tombamento.
- A foto do SKU e referencia visual do catalogo, nao substitui a foto do item fisico.
- O nome resumo pode ser aplicado em lote para todos os bens vinculados ao SKU selecionado.
- A edicao do nome resumo fica na secao principal de criacao/edicao do Material (SKU), sem painel separado.
- A edicao de Material (SKU) exige dupla confirmacao e senha administrativa.
- A Classificacao SIAFI e obrigatoria e deve existir no cadastro dedicado de Classificacao SIAFI.

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
