<!--
Modulo: wiki
Arquivo: frontend/src/wiki/24_classificacao_siafi.md
Funcao no sistema: documentar o cadastro de Classificacao SIAFI usado no Material (SKU).
-->

# Classificacao SIAFI

## Objetivo

Manter a lista oficial de:

- `Classificacao SIAFI` (ex.: `12311.02.01`)
- `Descri SIAFI` (ex.: `EQUIP DE TECNOLOG DA INFOR E COMUNICACAO/TIC`)

Essa lista alimenta o campo obrigatorio de Classificacao SIAFI no cadastro de Material (SKU).

## Onde acessar

- `Operacoes Patrimoniais -> Classificacao SIAFI`

## Regras operacionais

- O codigo deve ser o mesmo do GEAFIN para evitar divergencias.
- A descricao deve refletir a Descri SIAFI oficial.
- Somente classificacoes ativas podem ser selecionadas no Material (SKU).

## Fluxo recomendado

1. Cadastrar/atualizar Classificacao SIAFI e Descri SIAFI.
2. No Material (SKU), selecionar a Classificacao SIAFI obrigatoria.
3. Salvar Material (SKU) com dupla confirmacao e senha administrativa.
