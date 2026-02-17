<!--
Modulo: wiki
Arquivo: frontend/src/wiki/07_intrusos_bens_de_terceiros.md
Funcao no sistema: definir "intruso" e "bem de terceiro" e como registrar sem violar o congelamento.
-->

# Intrusos e bens de terceiros

## 1) Intruso (bem de outra unidade encontrado na sala)

### Definicao

Um **intruso** (no contexto do sistema) e:

- Um bem **tombado e pertencente a uma unidade A** (carga no banco),
- mas que foi **encontrado fisicamente** no ambiente inventariado de uma unidade B.

Isso e uma **divergencia de localizacao**, nao uma transferencia automatica.

### O que o sistema deve fazer

- Registrar ocorrencia `ENCONTRADO_EM_LOCAL_DIVERGENTE`.
- Marcar `regularizacao_pendente=true`.
- Nunca mudar `unidade_dona_id` durante inventario.

Regra legal:

- Art. 185 (AN303_Art185)

## 2) "Bem de terceiro" (o que significa)

### Definicao simples

**Bem de terceiro** e um objeto que esta no predio/ambiente, mas **nao pertence ao patrimonio da 2a CJM / STM**.

Exemplos comuns (na pratica):

- Equipamento de empresa contratada (manutencao, TI terceirizada).
- Equipamento emprestado por outro orgao/entidade.
- Equipamento doado/cedido ainda sem incorporacao patrimonial.

Base legal (controle segregado):

- Art. 99 (AN303_Art99)
- Art. 110, VI (AN303_Art110_VI)
- Art. 175, IX (AN303_Art175_IX)

### Por que existe um botao "Bem de Terceiro"

Durante inventario, voce pode encontrar itens **sem tombamento do GEAFIN** ou itens que claramente nao sao do acervo.

Nesse caso:

- Voce nao deve "criar tombamento" no ato.
- Voce nao deve transferir nada.

O botao permite registrar a existencia do item como **ocorrencia segregada**, para:

- documentar o achado,
- acionar regularizacao/controle correto depois,
- evitar que o inventario fique "cego" para itens presentes no ambiente.

## 3) Diferenca pratica: intruso x bem de terceiro

- Intruso: tem tombamento conhecido no sistema, mas esta no lugar errado.
- Bem de terceiro: nao e do patrimonio (ou nao tem tombamento STM), deve ficar segregado.

Se voce tiver duvida:

1. Procure o tombamento (10 digitos).
2. Se existe no sistema: trate como intruso quando unidade divergir.
3. Se nao existe e voce suspeita que e item externo: registre como bem de terceiro.

## 4) O que acontece depois (regularizacao)

Depois do inventario:

- A equipe analisa divergencias.
- Emite termo/documento quando for transferencia real.
- Atualiza cadastro de localizacao e/ou cautela quando for o caso.

O inventario registra fatos. A regularizacao formaliza.

