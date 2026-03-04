<!--
Modulo: wiki
Arquivo: frontend/src/wiki/24_classifica?o_siafi.md
Funcao no sistema: documentar o cadastro de Classifica?o SIAFI usado no Material (SKU).
-->

# Classifica?o SIAFI

## Objetivo

Manter a lista oficial de:

- `Classifica?o SIAFI` (ex.: `12311.02.01`)
- `Descri SIAFI` (ex.: `EQUIP DE TECNOLOG DA INFOR E COMUNICACAO/TIC`)

Essa lista alimenta o campo obrigatorio de Classifica?o SIAFI no cadastro de Material (SKU).

## Onde acessar

- `Opera?es Patrimoniais -> Classifica?o SIAFI`

## Regras operacionais

- O codigo deve ser o mesmo do GEAFIN para evitar diverg?ncias.
- A descri?o deve refletir a Descri SIAFI oficial.
- Somente classifica?es ativas podem ser selecionadas no Material (SKU).

## Fluxo recomendado

1. Cadastrar/atualizar Classifica?o SIAFI e Descri SIAFI.
2. No Material (SKU), selecionar a Classifica?o SIAFI obrigatoria.
3. Salvar Material (SKU) com dupla confirma?o e senha administrativa.
