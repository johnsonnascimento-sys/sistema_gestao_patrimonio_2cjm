<!--
Modulo: wiki
Arquivo: frontend/src/wiki/05_movimentacoes.md
Funcao no sistema: explicar cautela vs transferencia e o que o usuario deve fazer.
-->

# Movimentações: cautela x transferência

## Por que isso e importante

O ATN 303 distingue claramente:

- **Transferência**: muda a **carga** (unidade dona).
- **Cautela**: bem sai fisicamente (conserto/home office/etc), mas a **carga não muda**.

Essa distincao evita:

- "perder" a responsabilidade do bem.
- transferir sem documento durante inventario (o banco bloqueia).

## Transferência (muda carga)

Quando usar:

- O bem vai passar a ser responsabilidade de outra unidade (mudanca definitiva).

Efeito no sistema:

- Atualiza `bens.unidade_dona_id`.
- Gera registro em historico de transferencias (auditoria).

Regra legal:

- Transferencia muda carga: Art. 124 (AN303_Art124)
- Requisitos formais/termo: Art. 127 (AN303_Art127)

### Bloqueio durante inventário

Se existir inventário `EM_ANDAMENTO`, o banco impede a transferência:

// Regra legal: bloqueio de movimentacao em inventario - Art. 183 (AN303_Art183)

## Cautela (não muda carga)

Quando usar:

- Manutencao/conserto
- Emprestimo controlado
- Trabalho externo (quando aplicavel)

Efeito no sistema:

- Mantem `unidade_dona_id` intacto.
- Registra detentor temporario e datas (saida/retorno).

## Recomendações práticas (operação)

- Se a dúvida for "o bem vai sair do prédio mas continua sendo da unidade": é cautela.
- Se a dúvida for "o bem vai mudar de responsável/patrimônio da unidade": é transferência.
- Nunca use transferência para "ajustar inventário" durante contagem. No inventário, registre divergência e regularize depois.
