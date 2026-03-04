<!--
Modulo: wiki
Arquivo: frontend/src/wiki/24_classificação_siafi.md
Funcao no sistema: documentar o cadastro de Classificação SIAFI usado no Material (SKU).
-->

# Classificação SIAFI

## Objetivo

Manter a lista oficial de:

- `Classificação SIAFI` (ex.: `12311.02.01`)
- `Descri SIAFI` (ex.: `EQUIP DE TECNOLOG DA INFOR E COMUNICACAO/TIC`)

Essa lista alimenta o campo obrigatorio de Classificação SIAFI no cadastro de Material (SKU).

## Onde acessar

- `Operações Patrimoniais -> Classificação SIAFI`

## Regras operacionais

- O codigo deve ser o mesmo do GEAFIN para evitar divergências.
- A descrição deve refletir a Descri SIAFI oficial.
- Somente classificações ativas podem ser selecionadas no Material (SKU).

## Fluxo recomendado

1. Cadastrar/atualizar Classificação SIAFI e Descri SIAFI.
2. No Material (SKU), selecionar a Classificação SIAFI obrigatoria.
3. Salvar Material (SKU) com dupla confirmação e senha administrativa.
