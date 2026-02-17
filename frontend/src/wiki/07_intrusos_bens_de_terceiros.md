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

Isso é uma **divergência de localização**, não uma transferência automática.

### O que o sistema deve fazer

- Registrar ocorrencia `ENCONTRADO_EM_LOCAL_DIVERGENTE`.
- Marcar `regularizacao_pendente=true`.
- Nunca mudar `unidade_dona_id` durante inventario.

Regra legal:

- Art. 185 (AN303_Art185)

## 2) "Bem de terceiro" (o que significa)

### Definicao simples

**Bem de terceiro** é um objeto que está no prédio/ambiente, mas **não pertence ao patrimônio da 2a CJM / STM**.

Exemplos comuns (na pratica):

- Equipamento de empresa contratada (manutencao, TI terceirizada).
- Equipamento emprestado por outro orgao/entidade.
- Equipamento doado/cedido ainda sem incorporacao patrimonial.

Base legal (controle segregado):

- Art. 99 (AN303_Art99)
- Art. 110, VI (AN303_Art110_VI)
- Art. 175, IX (AN303_Art175_IX)

### Por que existe um botao "Bem de Terceiro"

Durante inventário, você pode encontrar itens **sem tombamento do GEAFIN** ou itens que claramente não são do acervo.

Nesse caso:

- Você não deve "criar tombamento" no ato.
- Você não deve transferir nada.

O botao permite registrar a existencia do item como **ocorrencia segregada**, para:

- documentar o achado,
- acionar regularizacao/controle correto depois,
- evitar que o inventario fique "cego" para itens presentes no ambiente.

## 3) Diferenca pratica: intruso x bem de terceiro

- Intruso: tem tombamento conhecido no sistema, mas está no lugar errado.
- Bem de terceiro: não é do patrimônio (ou não tem tombamento STM), deve ficar segregado.

Se você tiver dúvida:

1. Procure o tombamento (10 dígitos).
2. Se existe no sistema: trate como intruso quando unidade divergir.
3. Se não existe e você suspeita que é item externo: registre como bem de terceiro.

## 4) O que acontece depois (regularizacao)

Depois do inventário:

- A equipe analisa divergências.
- Emite termo/documento quando for transferencia real.
- Atualiza cadastro de localizacao e/ou cautela quando for o caso.

O inventario registra fatos. A regularizacao formaliza.
