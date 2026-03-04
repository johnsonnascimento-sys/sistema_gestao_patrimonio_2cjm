<!--
MÃ³dulo: wiki
Arquivo: frontend/src/wiki/17_regularizacao_pos_inventario.md
FunÃ§Ã£o no sistema: explicar o fluxo oficial de regularizaÃ§Ã£o pÃ³s-inventÃ¡rio sem transferÃªncia direta.
-->

# RegularizaÃ§Ã£o pÃ³s-inventÃ¡rio

## 1) Regra operacional oficial

A tela **RegularizaÃ§Ã£o pÃ³s-inventÃ¡rio (DivergÃªncias)** nÃ£o executa transferÃªncia direta de carga.

Quando houver necessidade de transferÃªncia entre unidades:

- a aÃ§Ã£o correta Ã© **Encaminhar transferÃªncia formal**;
- a execuÃ§Ã£o ocorre no menu **MovimentaÃ§Ãµes**;
- a divergÃªncia fica **pendente** atÃ© o procedimento formal ser concluÃ­do.

Base legal:

- Art. 185 (AN303_Art185);
- Art. 124 (AN303_Art124);
- Art. 127 (AN303_Art127).

## 2) AÃ§Ãµes em lote na regularizaÃ§Ã£o

A tela permite seleÃ§Ã£o mÃºltipla (checkbox) para processar vÃ¡rios bens de uma vez:

- **Manter carga (selecionados)**: encerra pendÃªncia sem transferir unidade.
- **endereço: manter cadastrada**: equivalente operacional de manter carga.
- **endereço: trocar para endereço encontrada**: corrige endereço/local sem transferir unidade.
- **Encaminhar transferÃªncia formal**: envia os itens para fila formal de transferÃªncia.

Importante:

- `ATUALIZAR_LOCAL` sÃ³ Ã© vÃ¡lido quando unidade dona = unidade encontrada.
- bens de terceiros nÃ£o entram em transferÃªncia de carga.

## 3) RetenÃ§Ã£o de pendÃªncia de transferÃªncia

ApÃ³s encaminhar para transferÃªncia formal, o sistema grava status de fluxo por item:

- `ENCAMINHADA`
- `AGUARDANDO_APROVACAO`
- `ERRO`
- `CONCLUIDA`
- `CANCELADA`

Enquanto o fluxo nÃ£o estiver concluÃ­do (`CONCLUIDA`), a divergÃªncia permanece na regularizaÃ§Ã£o.

## 4) IntegraÃ§Ã£o com MovimentaÃ§Ãµes

No menu **MovimentaÃ§Ãµes**, use:

- botÃ£o **Importar pendÃªncias da RegularizaÃ§Ã£o**.

Isso carrega a fila de bens encaminhados (`ENCAMINHADA`) para executar transferÃªncia formal.

Resultado esperado:

- transferÃªncia executada/aprovada: regularizaÃ§Ã£o Ã© concluÃ­da automaticamente;
- falha: status do fluxo volta para `ERRO`;
- reprovaÃ§Ã£o administrativa: status retorna para `ENCAMINHADA`.

## 5) SituaÃ§Ãµes de erro comuns

- `ACAO_EXIGE_FLUXO_MOVIMENTACOES`:
  tentativa de usar `TRANSFERIR_CARGA` direto no endpoint de regularizaÃ§Ã£o.
- `ATUALIZACAO_LOCAL_EXIGE_MESMA_UNIDADE`:
  tentativa de trocar endereço em divergÃªncia de unidade.
- `EVENTO_NAO_ENCERRADO`:
  regularizaÃ§Ã£o sÃ³ ocorre para inventÃ¡rio `ENCERRADO`.


