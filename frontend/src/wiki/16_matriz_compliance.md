<!--
Modulo: wiki
Arquivo: frontend/src/wiki/16_matriz_compliance.md
Funcao no sistema: matriz de compliance (ATN 303/2008) mapeando artigo -> regra -> implementa?o -> evidencia.
Fonte: planilha `ATN_STM_303_2008.xlsx` (abas "Index da Norma" e "Norma Detalhada").
-->

# Matriz de compliance (ATN 303/2008)

## Objetivo

Esta matriz responde, de forma auditÃ¡vel, Ã s perguntas:

- Quais partes do ATN 303/2008 o sistema cobre hoje?
- Onde cada regra estÃ¡ implementada (DB, API, UI, n8n)?
- Qual Ã© a evidÃªncia objetiva (logs, tabelas, triggers, views, PDFs)?
- O que ainda estÃ¡ pendente (backlog)?

## Fonte normativa utilizada

- Documento: `ATN_STM_303_2008.xlsx`
- Aba: `Index da Norma` (capÃ­tulos e faixas de artigos)
- Aba: `Norma Detalhada` (dispositivo + ID normalizado + resumo interpretativo)

ObservaÃ§Ã£o:

- O sistema foca **Material Permanente/PatrimÃ´nio**. Os capÃ­tulos de **Material de Consumo** podem ficar fora do escopo operacional da 2Âª CJM, mas aparecem aqui para transparÃªncia.

## 1) Cobertura por capÃ­tulo (visÃ£o executiva)

Legenda:

- Implementado: regra jÃ¡ tem comportamento verificÃ¡vel no sistema.
- Parcial: existe base/estrutura, mas falta persistÃªncia/fluxo/documento.
- Pendente: ainda nÃ£o implementado.
- Fora de escopo: nÃ£o Ã© objetivo deste sistema (a confirmar com a Ã¡rea).

| CapÃ­tulo (Index da Norma) | Artigos | Status atual | ObservaÃ§Ã£o tÃ©cnica |
|---|---:|---|---|
| Material de Consumo: Fundamentos e Sistemas | 1Âºâ€“5Âº | Fora de escopo | NÃ£o tratado pelo modelo operacional atual. |
| Consumo: ClassificaÃ§Ã£o e CatalogaÃ§Ã£o | 6Âºâ€“7Âº | Fora de escopo | Idem. |
| Consumo: Fluxo de RequisiÃ§Ã£o e Suprimento | 8Âºâ€“18 | Fora de escopo | Idem. |
| Consumo: Armazenagem e LogÃ­stica | 19â€“29 | Fora de escopo | Idem. |
| Consumo: GestÃ£o de Dados e Ressuprimento | 30â€“34 | Fora de escopo | Idem. |
| Consumo: Auditoria e InventÃ¡rio | 35â€“50 | Fora de escopo | Idem. |
| Consumo: DiferenÃ§as e ProgramaÃ§Ã£o de Compras | 51â€“61 | Fora de escopo | Idem. |
| Consumo: Rito de Recebimento e Registro | 62â€“70 | Fora de escopo | Idem. |
| Material Permanente: ClassificaÃ§Ã£o e Tombamento | 71â€“77 | Parcial | Tombamento (10 dÃ­gitos) validado; importaÃ§Ã£o GEAFIN cria itens. |
| Permanente: Planejamento e AquisiÃ§Ã£o | 78â€“88 | Pendente | NÃ£o hÃ¡ fluxo de aquisiÃ§Ã£o/planejamento no sistema. |
| Permanente: Recebimento e AceitaÃ§Ã£o | 89â€“96 | Pendente | Falta fluxo de recebimento provisÃ³rio/definitivo. |
| Controle Patrimonial: Tombamento e Registro | 97â€“106 | Parcial | material (SKU) + bens (item) normalizados; espelho GEAFIN para auditoria. |
| PatrimÃ´nio: DistribuiÃ§Ã£o e Responsabilidade | 107â€“121 | Parcial | Unidade dona (carga) e perfis existem; falta termo formal do consignatÃ¡rio (fluxo). |
| PatrimÃ´nio: MovimentaÃ§Ã£o e Uso | 122â€“140 | Parcial | Cautela x transferÃªncia implementadas; falta termo oficial e anexos. |
| PatrimÃ´nio: Desfazimento e InservÃ­veis | 141â€“152 | Parcial | Wizard existe; falta persistir decisÃ£o e produzir peÃ§as/relatÃ³rios. |
| PatrimÃ´nio: Baixa e ApuraÃ§Ã£o de Fatos | 153â€“168 | Pendente | Falta fluxo de baixa/apuraÃ§Ã£o (sindicÃ¢ncia etc.). |
| PatrimÃ´nio: Auditoria Anual de Ativos | 169â€“187 | Parcial | InventÃ¡rio, divergÃªncias e regularizaÃ§Ã£o pÃ³s-inventÃ¡rio existem; congelamento e intrusos implementados. |
| TransparÃªncia e Regras Finais | 188â€“189 | Pendente | Falta painel/rotina de publicidade mensal. |

## 2) Regras crÃ­ticas (mapeamento artigo -> implementaÃ§Ã£o)

### 2.0 Quadro de artigos crÃ­ticos (mapa rÃ¡pido)

Quadro (mÃ­nimo) exigido para auditoria: **Artigo â†’ Regra do sistema â†’ Onde estÃ¡ implementado (DB/API/UI/n8n) â†’ EvidÃªncia/auditoria**.

| Artigo (ID) | Resumo interpretativo (planilha) | Regra do sistema | ImplementaÃ§Ã£o (DB/API/UI/n8n) | EvidÃªncia/auditoria |
|---|---|---|---|---|
| Art. 183 (AN303_Art183) | â€œCongelamentoâ€ fÃ­sico e sistÃªmico dos ativos durante a contagem. | Com inventÃ¡rio `EM_ANDAMENTO`, Ã© vedada movimentaÃ§Ã£o que altere **carga** (unidade dona), respeitando escopo ativo (`GERAL`, `UNIDADE`, `LOCAIS`). | DB: trigger/funÃ§Ã£o `fn_bloqueio_movimenta?o_art183()` em `bens`, filtrando por escopo do evento. UI: banner â€œInventÃ¡rio ativoâ€ e seleÃ§Ã£o explÃ­cita do evento. | Erro Postgres (`P0001`) + `auditoria_log` para tentativas. |
| Art. 185 (AN303_Art185) | Dever de sanear o sistema corrigindo locais ou dados dos bens. | DivergÃªncia vira ocorrÃªncia (`ENCONTRADO_EM_LOCAL_DIVERGENTE`) e **nÃ£o** muda dono durante o inventÃ¡rio; regulariza depois. | DB: `contagens` + view `vw_forasteiros` + regra `regulariza?o_pendente`. API: `POST /inventario/sync`, `GET /inventario/forasteiros`, `POST /inventario/regulariza?es`. UI: â€œModo InventÃ¡rioâ€ + aba â€œRegularizaÃ§Ã£oâ€. n8n: relatÃ³rio (quando importado). | Linhas em `contagens`/`vw_forasteiros` + histÃ³rico de regularizaÃ§Ã£o (Art. 185) + PDF no Drive (quando automatizado). |
| Art. 124 (AN303_Art124) | Termo de Responsabilidade formaliza o dever de guarda. | TransferÃªncia muda carga e deve ter referÃªncia documental (termo) e responsÃ¡vel. | DB: `historico_transferencias` + trigger `trg_track_owner_change`. API/UI: `POST /movimentar` (TRANSFERENCIA) com `termo_referencia`. | `historico_transferencias` + `movimenta?es` + `auditoria_log`. (PDF: pendente n8n). |
| Art. 127 (AN303_Art127) | SaÃ­da fÃ­sica sÃ³ com aval prÃ©vio da DIPAT. | Cautela registra saÃ­da/retorno sem mudar carga; deve registrar autorizador/termo. | API/UI: `POST /movimentar` (`CAUTELA_SAIDA`/`CAUTELA_RETORNO`) + campos de termo/autorizaÃ§Ã£o. DB: status `EM_CAUTELA` + `movimenta?es`. | `movimenta?es` com termo + histÃ³rico de status do bem. (PDF: pendente n8n). |
| Art. 141 (AN303_Art141_*) | 4 categorias obrigatÃ³rias: Ocioso, RecuperÃ¡vel, AntieconÃ´mico, IrrecuperÃ¡vel. | ClassificaÃ§Ã£o de inservÃ­veis deve ser **guiada** e auditÃ¡vel (decisÃ£o + justificativa). | UI: Wizard Art. 141. DB: enum `tipo_inservivel`. | (Pendente) persistir resultado do wizard + relatÃ³rios. |
| Art. 99 (AN303_Art99) | ProÃ­be tombamento de bens que nÃ£o pertencem ao STM (controle Ã  parte). | Bens de terceiros nÃ£o sÃ£o incorporados ao acervo STM; cadastro segregado e rastreÃ¡vel. | DB: `bens.eh_bem_terceiro`, `identificador_externo`, `proprietario_externo` + constraints. UI/Wiki: fluxo â€œBem de terceiroâ€. | Registros com `eh_bem_terceiro=TRUE` + auditoria. |
| Art. 110, VI (AN303_Art110_VI) | Controlar itens alugados/terceiros e informar ao PatrimÃ´nio. | Controle segregado com rastreabilidade (quem, onde, quando). | DB/UI/Wiki: mesmo mecanismo de â€œbens de terceirosâ€, com relatÃ³rios dedicados. | RelatÃ³rio (pendente n8n) + trilha de auditoria. |
| Art. 175, IX (AN303_Art175_IX) | Controle de bens de terceiros que estÃ£o no prÃ©dio. | InventÃ¡rio consegue registrar bem externo sem forÃ§ar tombamento STM/GEAFIN. | UI: registrar â€œBem de terceiroâ€ no inventÃ¡rio; DB: campos externos e ocorrÃªncia segregada. | Itens de terceiros cadastrados + ocorrÃªncias por evento/endereço. |

### 2.1 Congelamento de movimentaÃ§Ã£o durante inventÃ¡rio

- Base legal: Art. 183 (AN303_Art183)
- Regra: durante inventÃ¡rio `EM_ANDAMENTO`, Ã© vedada movimentaÃ§Ã£o que altere carga.
- ImplementaÃ§Ã£o:
  - DB: trigger `fn_bloqueio_movimenta?o_art183()` bloqueia `UPDATE` em `bens.unidade_dona_id`.
  - UI: banner â€œInventÃ¡rio ativoâ€.
- EvidÃªncia/auditoria:
  - Erro de banco com `DETAIL` contendo Art. 183 (AN303_Art183).
  - `auditoria_log` registra tentativas/sucesso de operaÃ§Ãµes.

### 2.2 Intrusos (local divergente) sem troca automÃ¡tica de dono

- Base legal: Art. 185 (AN303_Art185)
- Regra: bem encontrado em local divergente deve virar ocorrÃªncia e ser regularizado depois.
- ImplementaÃ§Ã£o:
  - DB: `contagens.tipo_ocorrencia='ENCONTRADO_EM_LOCAL_DIVERGENTE'` forÃ§a `regulariza?o_pendente=TRUE`.
  - API: `POST /inventario/sync` grava contagem e marca divergÃªncia de forma determinÃ­stica.
  - View: `vw_forasteiros` (base para relatÃ³rio/automaÃ§Ã£o).
- EvidÃªncia/auditoria:
  - Registros em `contagens` + `vw_forasteiros`.
  - Workflow n8n â€œRelatÃ³rio de Forasteirosâ€ (quando importado no n8n).

### 2.3 TransferÃªncia x Cautela (mudanÃ§a de carga vs saÃ­da fÃ­sica)

- Base legal: Art. 124 (AN303_Art124) e Art. 127 (AN303_Art127)
- Regra:
  - TransferÃªncia muda carga (unidade dona).
  - Cautela nÃ£o muda carga; controla detentor temporÃ¡rio e devoluÃ§Ã£o.
- ImplementaÃ§Ã£o:
  - DB: `historico_transferencias` + trigger `trg_track_owner_change` (mudanÃ§a de `unidade_dona_id`).
  - API: `POST /movimentar` separa `TRANSFERENCIA` de `CAUTELA_SAIDA/RETORNO`.
- EvidÃªncia/auditoria:
  - `movimenta?es` (com `termo_referencia`) + `historico_transferencias`.
  - `GET /bens/{id}` expÃµe histÃ³rico e movimentaÃ§Ãµes recentes.

### 2.4 ClassificaÃ§Ã£o de inservÃ­veis (fluxo guiado)

- Base legal:
  - Art. 141, Caput (AN303_Art141_Cap)
  - Art. 141, I (AN303_Art141_I)
  - Art. 141, II (AN303_Art141_II)
  - Art. 141, III (AN303_Art141_III)
  - Art. 141, IV (AN303_Art141_IV)
- Regra: classificaÃ§Ã£o obrigatÃ³ria via fluxo guiado.
- ImplementaÃ§Ã£o:
  - UI: Wizard Art. 141 (fluxo guiado).
  - DB: enum `tipo_inservivel` existe.
- EvidÃªncia/auditoria:
  - (Pendente) persistir resultado do wizard em tabela/registro auditÃ¡vel + relatÃ³rios.

### 2.5 Bens de terceiros (controle segregado)

- Base legal: Art. 99 (AN303_Art99), Art. 110, VI (AN303_Art110_VI), Art. 175, IX (AN303_Art175_IX)
- Regra: bens externos nÃ£o devem ser incorporados automaticamente ao acervo.
- ImplementaÃ§Ã£o:
  - DB: `bens.eh_bem_terceiro`, `identificador_externo`, `proprietario_externo` e constraints de identificaÃ§Ã£o.
  - UI/Wiki: orientaÃ§Ã£o para registrar â€œbem de terceiroâ€ sem tombamento.
- EvidÃªncia/auditoria:
  - Registros em `bens` com `eh_bem_terceiro=TRUE` e campos externos preenchidos.

## 3) PrÃ³ximos passos (derivados desta matriz)

Para evoluir a compliance, o backlog imediato Ã©:

1. RegularizaÃ§Ã£o pÃ³s-inventÃ¡rio para divergÃªncias do Art. 185 (implementado: aba "RegularizaÃ§Ã£o" + endpoint `/inventario/regulariza?es`).
2. Termos oficiais (PDF) para transferÃªncia/cautela (Arts. 124/127).
3. PersistÃªncia completa do Wizard Art. 141 + relatÃ³rios de inservÃ­veis.
4. Baixa e apuraÃ§Ã£o de fatos (Arts. 153â€“168).
5. TransparÃªncia mensal (Arts. 188â€“189).

