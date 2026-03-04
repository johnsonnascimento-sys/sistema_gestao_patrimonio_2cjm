<!--
Módulo: wiki
Arquivo: frontend/src/wiki/17_regularizacao_pos_inventario.md
Função no sistema: explicar o fluxo de regularização pós-inventário e o tratamento de divergências.
-->

# Regularização pós-inventário

## 1) O que é regularização

Durante o inventário, o sistema registra fatos de localização e unidade encontrada.

Quando há divergência, a ocorrência fica pendente para tratamento posterior, em aderência ao:

- Art. 185 (AN303_Art185).

Regularização é o processo pós-inventário para encerrar pendências com trilha auditável.

## 2) Por que não regularizar durante o inventário

Com inventário `EM_ANDAMENTO`, mudança de carga fica bloqueada:

- Art. 183 (AN303_Art183).

Na prática:

- durante contagem: registrar divergência;
- após encerramento: regularizar formalmente.

## 3) Onde fazer no sistema

Caminho:

- `Operações Patrimoniais -> Inventário - Administração`
- seção: `Regularização pós-inventário (Divergências)`.

Importante:

- a fila operacional de regularização aparece após o evento `ENCERRADO`.

## 4) Ações disponíveis

### 4.1) Manter carga

Quando usar:

- bem pertence à unidade dona correta, mas foi encontrado em local divergente.

Efeito:

- encerra pendência sem transferir titularidade.

### 4.2) Transferir carga

Quando usar:

- bem deve mudar unidade dona com formalização.

Efeito:

- atualiza unidade dona, gera movimentação e histórico, encerra pendência.

Requisito:

- `termoReferencia` obrigatório.

### 4.3) Corrigir sala/local (sem transferir carga)

Quando usar:

- unidade dona e unidade encontrada são iguais, divergindo apenas sala/local.

Efeito:

- atualiza localização física e encerra pendência sem alterar carga.

## 5) Auditoria registrada

Sempre fica registrado:

- quem regularizou;
- quando regularizou;
- qual ação foi aplicada;
- movimentação associada (quando houver transferência).

## 6) Inventários concomitantes e divergências interunidades

Em inventários paralelos por unidade:

- divergências cruzadas ficam visíveis para as unidades envolvidas;
- monitoramento ocorre em tempo real;
- regularização permanece em fluxo formal pós-encerramento.

Painel de apoio:

- `Divergências interunidades (tempo real)` em `Inventário - Administração`.

Observação:

- painel é de leitura e priorização;
- execução da regularização segue neste fluxo.
