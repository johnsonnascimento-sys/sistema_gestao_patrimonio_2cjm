<!--
Modulo: wiki
Arquivo: frontend/src/wiki/17_regularizacao_pos_inventario.md
Funcao no sistema: explicar o fluxo de regularizacao pos-inventario (intrusos/forasteiros) e como operar a tela de Regularizacao.
-->

# Regularização pós-inventário (forasteiros)

## 1) O que é "regularização"

Durante o inventário, o sistema registra **fatos**:

- Onde o bem foi encontrado (`sala_encontrada`)
- Em qual unidade ele foi encontrado (`unidade_encontrada_id`)
- Se isso diverge da carga (unidade dona) do cadastro

Quando há divergência, o sistema grava a ocorrência:

- `tipo_ocorrencia = ENCONTRADO_EM_LOCAL_DIVERGENTE`
- `regularizacao_pendente = true`

Regra legal:

- Art. 185 (AN303_Art185)

A **regularização** é o procedimento **após o inventário** para encerrar a pendência, com trilha auditável (quem/quando/como), e quando aplicável, formalizar a transferência.

## 2) Por que não regularizar durante o inventário

Durante inventário em andamento, a movimentação de carga fica bloqueada.

Regra legal:

- Art. 183 (AN303_Art183)

Na prática:

- Você pode registrar divergências enquanto o evento está `EM_ANDAMENTO`.
- Você **não deve** mudar carga de bens nessa fase.
- A transferência/regularização acontece depois do evento ser **ENCERRADO**.

## 3) Onde fazer no sistema

Use a aba:

- **Regularização**

Ela lista os "forasteiros" pendentes (divergências) e oferece ações determinísticas.

Importante:

- A lista de "forasteiros" (fila) **só aparece após o evento ser ENCERRADO**.
- Enquanto o evento estiver `EM_ANDAMENTO`, as divergências existem em `contagens`, mas não entram na fila pós-inventário.

## 3.1) Bens Não Identificados (Evidências Visuais - Art. 175)

Na tela de Regularização, bens que **perderam a placa de tombamento** são apresentados assim:
- Em vez de um tombo, recebem um selo vermelho de **SEM PLACA** e o ID automático `NAI-XXXX...`.
- Aparece o botão **📸 Ver Foto** em azul, permitindo a visualização exata do item.
- Exibe-se a descrição com detalhes complementares informados no momento em que o item foi fisicamente achado.

Essa materialidade é exigência do **Art. 175 (AN303_Art175)**, assegurando que o gestor tome a decisão baseado na prova visual coletada na sala inventariada.

## 4) Ações disponíveis

### 4.1) Manter carga (encerra a pendência sem transferir)

Use quando:

- O bem pertence à unidade original (carga correta), mas estava fisicamente no local errado.
- O bem será devolvido ao local/carga correta, sem mudança de responsável patrimonial.

O que o sistema faz:

- Marca `regularizacao_pendente=false`
- Preenche metadados mínimos (`regularizado_em`, `regularizado_por_perfil_id`, `regularizacao_acao`)
- Mantém o fato histórico da divergência (não apaga a contagem)

Regra legal:

- Art. 185 (AN303_Art185)

### 4.2) Transferir carga (regularização com transferência)

Use quando:

- O bem **deve** mudar de unidade dona (carga), e isso será formalizado.

O que o sistema faz:

- Atualiza `bens.unidade_dona_id` para a unidade encontrada
- Gera registro em `movimentacoes` (tipo `REGULARIZACAO_INVENTARIO`)
- Gera histórico de carga em `historico_transferencias` via trigger
- Encerra a pendência na contagem (`regularizacao_pendente=false`) e vincula a movimentação

Regras legais:

- Divergência não muda carga automaticamente: Art. 185 (AN303_Art185)
- Transferência muda carga e exige formalização: Art. 124 (AN303_Art124) e Art. 127 (AN303_Art127)

Requisito operacional:

- `termoReferencia` é obrigatório para **Transferir carga** (rastreabilidade do termo/PDF).

### 4.3) Corrigir sala/local (sem transferir carga)

Use quando:

- A unidade dona e a unidade encontrada sao as mesmas.
- O bem foi lido em sala diferente da sala esperada e voce quer atualizar a localizacao correta no cadastro.

O que o sistema faz:

- Atualiza `bens.local_fisico` para a sala encontrada no inventario.
- Quando existir local ativo correspondente, vincula tambem `bens.local_id`.
- Encerra a pendencia na contagem (`regularizacao_pendente=false`) sem gerar transferencia de carga.

Regra legal:

- Art. 185 (AN303_Art185).

## 5) Passo a passo (operacional)

1. No inventário, encerre o evento (status `ENCERRADO`).
2. Abra a aba **Regularização**.
3. Informe o `perfilId` (UUID) do executor da regularização.
4. Se for transferir carga, informe também o `termoReferencia`.
5. Use filtros por **evento** e **sala** para localizar as divergências.
6. Para cada item:
   - Clique **Manter carga** (encerra pendência sem mudança de carga), ou
   - Clique **Transferir carga** (aplica transferência + trilha de auditoria).

## 6) Auditoria: o que fica registrado

- A contagem do inventário permanece no histórico (o fato não é apagado).
- A regularização registra:
  - Quem regularizou (`regularizado_por_perfil_id`)
  - Quando (`regularizado_em`)
  - Como (`regularizacao_acao`)
  - E, se houve transferência, qual movimentação foi gerada (`regularizacao_movimentacao_id`)

Se a carga for alterada:

- O histórico de transferências (`historico_transferencias`) também é alimentado automaticamente.
