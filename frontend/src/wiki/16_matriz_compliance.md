<!--
Modulo: wiki
Arquivo: frontend/src/wiki/16_matriz_compliance.md
Funcao no sistema: matriz de compliance (ATN 303/2008) mapeando artigo -> regra -> implementacao -> evidencia.
Fonte: planilha `ATN_STM_303_2008.xlsx` (abas "Index da Norma" e "Norma Detalhada").
-->

# Matriz de compliance (ATN 303/2008)

## Objetivo

Esta matriz responde, de forma auditável, às perguntas:

- Quais partes do ATN 303/2008 o sistema cobre hoje?
- Onde cada regra está implementada (DB, API, UI, n8n)?
- Qual é a evidência objetiva (logs, tabelas, triggers, views, PDFs)?
- O que ainda está pendente (backlog)?

## Fonte normativa utilizada

- Documento: `ATN_STM_303_2008.xlsx`
- Aba: `Index da Norma` (capítulos e faixas de artigos)
- Aba: `Norma Detalhada` (dispositivo + ID normalizado + resumo interpretativo)

Observação:

- O sistema foca **Material Permanente/Patrimônio**. Os capítulos de **Material de Consumo** podem ficar fora do escopo operacional da 2ª CJM, mas aparecem aqui para transparência.

## 1) Cobertura por capítulo (visão executiva)

Legenda:

- Implementado: regra já tem comportamento verificável no sistema.
- Parcial: existe base/estrutura, mas falta persistência/fluxo/documento.
- Pendente: ainda não implementado.
- Fora de escopo: não é objetivo deste sistema (a confirmar com a área).

| Capítulo (Index da Norma) | Artigos | Status atual | Observação técnica |
|---|---:|---|---|
| Material de Consumo: Fundamentos e Sistemas | 1º–5º | Fora de escopo | Não tratado pelo modelo operacional atual. |
| Consumo: Classificação e Catalogação | 6º–7º | Fora de escopo | Idem. |
| Consumo: Fluxo de Requisição e Suprimento | 8º–18 | Fora de escopo | Idem. |
| Consumo: Armazenagem e Logística | 19–29 | Fora de escopo | Idem. |
| Consumo: Gestão de Dados e Ressuprimento | 30–34 | Fora de escopo | Idem. |
| Consumo: Auditoria e Inventário | 35–50 | Fora de escopo | Idem. |
| Consumo: Diferenças e Programação de Compras | 51–61 | Fora de escopo | Idem. |
| Consumo: Rito de Recebimento e Registro | 62–70 | Fora de escopo | Idem. |
| Material Permanente: Classificação e Tombamento | 71–77 | Parcial | Tombamento (10 dígitos) validado; importação GEAFIN cria itens. |
| Permanente: Planejamento e Aquisição | 78–88 | Pendente | Não há fluxo de aquisição/planejamento no sistema. |
| Permanente: Recebimento e Aceitação | 89–96 | Pendente | Falta fluxo de recebimento provisório/definitivo. |
| Controle Patrimonial: Tombamento e Registro | 97–106 | Parcial | Catálogo (SKU) + bens (item) normalizados; espelho GEAFIN para auditoria. |
| Patrimônio: Distribuição e Responsabilidade | 107–121 | Parcial | Unidade dona (carga) e perfis existem; falta termo formal do consignatário (fluxo). |
| Patrimônio: Movimentação e Uso | 122–140 | Parcial | Cautela x transferência implementadas; falta termo oficial e anexos. |
| Patrimônio: Desfazimento e Inservíveis | 141–152 | Parcial | Wizard existe; falta persistir decisão e produzir peças/relatórios. |
| Patrimônio: Baixa e Apuração de Fatos | 153–168 | Pendente | Falta fluxo de baixa/apuração (sindicância etc.). |
| Patrimônio: Auditoria Anual de Ativos | 169–187 | Parcial | Inventário, divergências e regularização pós-inventário existem; congelamento e intrusos implementados. |
| Transparência e Regras Finais | 188–189 | Pendente | Falta painel/rotina de publicidade mensal. |

## 2) Regras críticas (mapeamento artigo -> implementação)

### 2.0 Quadro de artigos críticos (mapa rápido)

Quadro (mínimo) exigido para auditoria: **Artigo → Regra do sistema → Onde está implementado (DB/API/UI/n8n) → Evidência/auditoria**.

| Artigo (ID) | Resumo interpretativo (planilha) | Regra do sistema | Implementação (DB/API/UI/n8n) | Evidência/auditoria |
|---|---|---|---|---|
| Art. 183 (AN303_Art183) | “Congelamento” físico e sistêmico dos ativos durante a contagem. | Com inventário `EM_ANDAMENTO`, é vedada movimentação que altere **carga** (unidade dona). | DB: trigger/função `fn_bloqueio_movimentacao_art183()` em `bens`. UI: banner “Inventário ativo”. | Erro Postgres (`P0001`) + `auditoria_log` para tentativas. |
| Art. 185 (AN303_Art185) | Dever de sanear o sistema corrigindo locais ou dados dos bens. | Divergência vira ocorrência (`ENCONTRADO_EM_LOCAL_DIVERGENTE`) e **não** muda dono durante o inventário; regulariza depois. | DB: `contagens` + view `vw_forasteiros` + regra `regularizacao_pendente`. API: `POST /inventario/sync`, `GET /inventario/forasteiros`, `POST /inventario/regularizacoes`. UI: “Modo Inventário” + aba “Regularização”. n8n: relatório (quando importado). | Linhas em `contagens`/`vw_forasteiros` + histórico de regularização (Art. 185) + PDF no Drive (quando automatizado). |
| Art. 124 (AN303_Art124) | Termo de Responsabilidade formaliza o dever de guarda. | Transferência muda carga e deve ter referência documental (termo) e responsável. | DB: `historico_transferencias` + trigger `trg_track_owner_change`. API/UI: `POST /movimentar` (TRANSFERENCIA) com `termo_referencia`. | `historico_transferencias` + `movimentacoes` + `auditoria_log`. (PDF: pendente n8n). |
| Art. 127 (AN303_Art127) | Saída física só com aval prévio da DIPAT. | Cautela registra saída/retorno sem mudar carga; deve registrar autorizador/termo. | API/UI: `POST /movimentar` (`CAUTELA_SAIDA`/`CAUTELA_RETORNO`) + campos de termo/autorização. DB: status `EM_CAUTELA` + `movimentacoes`. | `movimentacoes` com termo + histórico de status do bem. (PDF: pendente n8n). |
| Art. 141 (AN303_Art141_*) | 4 categorias obrigatórias: Ocioso, Recuperável, Antieconômico, Irrecuperável. | Classificação de inservíveis deve ser **guiada** e auditável (decisão + justificativa). | UI: Wizard Art. 141. DB: enum `tipo_inservivel`. | (Pendente) persistir resultado do wizard + relatórios. |
| Art. 99 (AN303_Art99) | Proíbe tombamento de bens que não pertencem ao STM (controle à parte). | Bens de terceiros não são incorporados ao acervo STM; cadastro segregado e rastreável. | DB: `bens.eh_bem_terceiro`, `identificador_externo`, `proprietario_externo` + constraints. UI/Wiki: fluxo “Bem de terceiro”. | Registros com `eh_bem_terceiro=TRUE` + auditoria. |
| Art. 110, VI (AN303_Art110_VI) | Controlar itens alugados/terceiros e informar ao Patrimônio. | Controle segregado com rastreabilidade (quem, onde, quando). | DB/UI/Wiki: mesmo mecanismo de “bens de terceiros”, com relatórios dedicados. | Relatório (pendente n8n) + trilha de auditoria. |
| Art. 175, IX (AN303_Art175_IX) | Controle de bens de terceiros que estão no prédio. | Inventário consegue registrar bem externo sem forçar tombamento STM/GEAFIN. | UI: registrar “Bem de terceiro” no inventário; DB: campos externos e ocorrência segregada. | Itens de terceiros cadastrados + ocorrências por evento/sala. |

### 2.1 Congelamento de movimentação durante inventário

- Base legal: Art. 183 (AN303_Art183)
- Regra: durante inventário `EM_ANDAMENTO`, é vedada movimentação que altere carga.
- Implementação:
  - DB: trigger `fn_bloqueio_movimentacao_art183()` bloqueia `UPDATE` em `bens.unidade_dona_id`.
  - UI: banner “Inventário ativo”.
- Evidência/auditoria:
  - Erro de banco com `DETAIL` contendo Art. 183 (AN303_Art183).
  - `auditoria_log` registra tentativas/sucesso de operações.

### 2.2 Intrusos (local divergente) sem troca automática de dono

- Base legal: Art. 185 (AN303_Art185)
- Regra: bem encontrado em local divergente deve virar ocorrência e ser regularizado depois.
- Implementação:
  - DB: `contagens.tipo_ocorrencia='ENCONTRADO_EM_LOCAL_DIVERGENTE'` força `regularizacao_pendente=TRUE`.
  - API: `POST /inventario/sync` grava contagem e marca divergência de forma determinística.
  - View: `vw_forasteiros` (base para relatório/automação).
- Evidência/auditoria:
  - Registros em `contagens` + `vw_forasteiros`.
  - Workflow n8n “Relatório de Forasteiros” (quando importado no n8n).

### 2.3 Transferência x Cautela (mudança de carga vs saída física)

- Base legal: Art. 124 (AN303_Art124) e Art. 127 (AN303_Art127)
- Regra:
  - Transferência muda carga (unidade dona).
  - Cautela não muda carga; controla detentor temporário e devolução.
- Implementação:
  - DB: `historico_transferencias` + trigger `trg_track_owner_change` (mudança de `unidade_dona_id`).
  - API: `POST /movimentar` separa `TRANSFERENCIA` de `CAUTELA_SAIDA/RETORNO`.
- Evidência/auditoria:
  - `movimentacoes` (com `termo_referencia`) + `historico_transferencias`.
  - `GET /bens/{id}` expõe histórico e movimentações recentes.

### 2.4 Classificação de inservíveis (fluxo guiado)

- Base legal:
  - Art. 141, Caput (AN303_Art141_Cap)
  - Art. 141, I (AN303_Art141_I)
  - Art. 141, II (AN303_Art141_II)
  - Art. 141, III (AN303_Art141_III)
  - Art. 141, IV (AN303_Art141_IV)
- Regra: classificação obrigatória via fluxo guiado.
- Implementação:
  - UI: Wizard Art. 141 (fluxo guiado).
  - DB: enum `tipo_inservivel` existe.
- Evidência/auditoria:
  - (Pendente) persistir resultado do wizard em tabela/registro auditável + relatórios.

### 2.5 Bens de terceiros (controle segregado)

- Base legal: Art. 99 (AN303_Art99), Art. 110, VI (AN303_Art110_VI), Art. 175, IX (AN303_Art175_IX)
- Regra: bens externos não devem ser incorporados automaticamente ao acervo.
- Implementação:
  - DB: `bens.eh_bem_terceiro`, `identificador_externo`, `proprietario_externo` e constraints de identificação.
  - UI/Wiki: orientação para registrar “bem de terceiro” sem tombamento.
- Evidência/auditoria:
  - Registros em `bens` com `eh_bem_terceiro=TRUE` e campos externos preenchidos.

## 3) Próximos passos (derivados desta matriz)

Para evoluir a compliance, o backlog imediato é:

1. Regularização pós-inventário para divergências do Art. 185 (implementado: aba "Regularização" + endpoint `/inventario/regularizacoes`).
2. Termos oficiais (PDF) para transferência/cautela (Arts. 124/127).
3. Persistência completa do Wizard Art. 141 + relatórios de inservíveis.
4. Baixa e apuração de fatos (Arts. 153–168).
5. Transparência mensal (Arts. 188–189).
