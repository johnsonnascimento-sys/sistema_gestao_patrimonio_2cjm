<!--
Módulo: wiki
Arquivo: frontend/src/wiki/17_regularizacao_pos_inventario.md
Função no sistema: explicar o fluxo oficial de regularização pós-inventário sem transferência direta.
-->

# Regularização pós-inventário

## 1) Regra operacional oficial

A tela **Regularização pós-inventário (Divergências)** não executa transferência direta de carga.

Quando houver necessidade de transferência entre unidades:

- a ação correta é **Encaminhar transferência formal**;
- a execução ocorre no menu **Movimentações**;
- a divergência fica **pendente** até o procedimento formal ser concluído.

Base legal:

- Art. 185 (AN303_Art185);
- Art. 124 (AN303_Art124);
- Art. 127 (AN303_Art127).

## 2) Ações em lote na regularização

A tela permite seleção múltipla (checkbox) para processar vários bens de uma vez:

- **Manter carga (selecionados)**: encerra pendência sem transferir unidade.
- **endereço: manter cadastrada**: equivalente operacional de manter carga.
- **endereço: trocar para endereço encontrada**: corrige endereço/local sem transferir unidade.
- **Encaminhar transferência formal**: envia os itens para fila formal de transferência.

Importante:

- `ATUALIZAR_LOCAL` só é válido quando unidade dona = unidade encontrada.
- bens de terceiros não entram em transferência de carga.

## 3) Retenção de pendência de transferência

Após encaminhar para transferência formal, o sistema grava status de fluxo por item:

- `ENCAMINHADA`
- `AGUARDANDO_APROVACAO`
- `ERRO`
- `CONCLUIDA`
- `CANCELADA`

Enquanto o fluxo não estiver concluído (`CONCLUIDA`), a divergência permanece na regularização.

## 4) Integração com Movimentações

No menu **Movimentações**, use:

- botão **Importar pendências da Regularização**.

Isso carrega a fila de bens encaminhados (`ENCAMINHADA`) para executar transferência formal.

Resultado esperado:

- transferência executada/aprovada: regularização é concluída automaticamente;
- falha: status do fluxo volta para `ERRO`;
- reprovação administrativa: status retorna para `ENCAMINHADA`.

## 5) Situações de erro comuns

- `ACAO_EXIGE_FLUXO_MOVIMENTACOES`:
  tentativa de usar `TRANSFERIR_CARGA` direto no endpoint de regularização.
- `ATUALIZACAO_LOCAL_EXIGE_MESMA_UNIDADE`:
  tentativa de trocar endereço em divergência de unidade.
- `EVENTO_NAO_ENCERRADO`:
  regularização só ocorre para inventário `ENCERRADO`.


