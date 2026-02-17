<!--
Modulo: wiki
Arquivo: frontend/src/wiki/05_movimentacoes.md
Funcao no sistema: explicar cautela vs transferencia e o que o usuario deve fazer.
-->

# Movimentacoes: cautela x transferencia

## Por que isso e importante

O ATN 303 distingue claramente:

- **Transferencia**: muda a **carga** (unidade dona).
- **Cautela**: bem sai fisicamente (conserto/home office/etc), mas a **carga nao muda**.

Essa distincao evita:

- "perder" a responsabilidade do bem.
- transferir sem documento durante inventario (o banco bloqueia).

## Transferencia (muda carga)

Quando usar:

- O bem vai passar a ser responsabilidade de outra unidade (mudanca definitiva).

Efeito no sistema:

- Atualiza `bens.unidade_dona_id`.
- Gera registro em historico de transferencias (auditoria).

Regra legal:

- Transferencia muda carga: Art. 124 (AN303_Art124)
- Requisitos formais/termo: Art. 127 (AN303_Art127)

### Bloqueio durante inventario

Se existir inventario `EM_ANDAMENTO`, o banco impede a transferencia:

// Regra legal: bloqueio de movimentacao em inventario - Art. 183 (AN303_Art183)

## Cautela (nao muda carga)

Quando usar:

- Manutencao/conserto
- Emprestimo controlado
- Trabalho externo (quando aplicavel)

Efeito no sistema:

- Mantem `unidade_dona_id` intacto.
- Registra detentor temporario e datas (saida/retorno).

## Recomendações praticas (operacao)

- Se a duvida for "o bem vai sair do predio mas continua sendo da unidade": e cautela.
- Se a duvida for "o bem vai mudar de responsavel/patrimonio da unidade": e transferencia.
- Nunca use transferencia para "ajustar inventario" durante contagem. No inventario, registre divergencia e regularize depois.

