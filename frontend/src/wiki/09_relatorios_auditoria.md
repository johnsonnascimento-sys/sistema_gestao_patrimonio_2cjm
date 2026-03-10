<!--
Modulo: wiki
Arquivo: frontend/src/wiki/09_relatorios_auditoria.md
Funcao no sistema: orientar como extrair evidencias e entender trilhas (historicos, importação GEAFIN, inventario, documentos).
Atualizado em: 2026-02-17  (gerenciado pelo wikiMeta.generated.js na UI)
-->

# Relatórios e auditoria

## Objetivo

Este sistema foi desenhado para "aguentar auditoria". Isso significa:

- ser possível provar o que foi importado (GEAFIN),
- ser possível provar quando e por que um bem mudou de carga,
- ser possível listar divergências de inventário (intrusos) sem alterar carga no ato,
- ser possível vincular evidências (Drive/PDF) às operações relevantes.

## 1) Auditoria de importação GEAFIN

Evidências:

- registro do arquivo (nome, hash, bytes, data/hora, total de linhas, status),
- linhas espelho (conteúdo do CSV como chegou),
- contadores (ok/falha persistência/falha normalização).

Uso típico:

- "as 3833 linhas do CSV foram processadas?": verificar `status=CONCLUIDO` e `percent=100` em `GET /importacoes/geafin/ultimo`.

## 2) Auditoria de mudança de carga (transferências)

Quando uma transferência acontece (mudança de `bens.unidade_dona_id`), o banco registra histórico dedicado.

Evidências:

- bem (tombamento),
- unidade antiga e nova,
- data/hora,
- origem (IMPORTACAO/APP/SISTEMA),
- usuário (quando aplicável).

Base legal:

- Art. 124 (AN303_Art124) e Art. 127 (AN303_Art127).

## 3) Forasteiros / intrusos (inventário)

Um "forasteiro" é uma divergência registrada no inventário:

- `tipo_ocorrencia = ENCONTRADO_EM_LOCAL_DIVERGENTE`
- `regularizacao_pendente = true`

Relatório típico:

- lista de bens com unidade dona diferente da unidade encontrada no inventário.

Observação:

- o sistema deriva isso de `contagens` (fato do inventário), não de coluna "unidade_local_atual" no bem.

Base legal:

- Art. 185 (AN303_Art185).

## Relatório de encerramento do inventário (detalhado)

Quando o evento ? encerrado, a tela de Administração apresenta um relatório consolidado com:

- contagens totais e conformidades
- divergências de unidade/endereço (incluindo `UNIDADE_E_endereço`)
- pendências de regularização pós-inventário
- evidências de aderência aos Arts. 183/185/124/127

Gráficos no painel:

- pizza de divergências por tipo (Unidade, endereço, Unidade+endereço)
- barra de regularização (pendentes x regularizadas)
- ranking de endereços com mais divergências

Exportação editável:

- endpoint `GET /api/inventario/eventos/{id}/relatorio-encerramento.csv`
- arquivo CSV editável para planilhas e edições da comissão.

Observação de compliance:

- o endpoint exige evento `ENCERRADO`, evitando relatório final em inventário ainda ativo.

## Linha do tempo de alterações do bem

Na tela de detalhes do bem (Consulta de Bens), a trilha de auditoria segue estes padroes:

- IDs de local, perfil, catálogo e bem não aparecem crus na grade principal.
- Para `UPDATE`, o diff mostra antes/depois por campo.
- Para `INSERT` e `DELETE`, a timeline mostra um marcador de operação para evitar item vazio.
- O responsavel da alteração e resolvido por nome/matrícula sempre que houver `perfil_id` relacionado.
- Quando existir UUID de referencia, ele fica disponivel por tooltip (hover/foco), sem poluir a leitura principal.

## 4) Bens de terceiros (controle segregado)

"Bem de terceiro" é ocorrência segregada, sem tombamento GEAFIN:

- `bens.eh_bem_terceiro=true`
- `contagens.tipo_ocorrencia='BEM_DE_TERCEIRO'`

Consulta/auditoria:

- view `vw_bens_terceiros_inventario`
- API `GET /inventario/bens-terceiros`

Base legal (controle segregado):

- Art. 99 (AN303_Art99), Art. 110, VI (AN303_Art110_VI), Art. 175, IX (AN303_Art175_IX).

## 5) Documentos (termos e evidências)

O sistema **não armazena PDF no banco**. Ele armazena metadados em `documentos`:

- `drive_url` / `drive_file_id`
- `sha256` (opcional)
- vínculo com `movimentações` e/ou `contagens`
- (opcional) vínculo com `avaliacoes_inserviveis` e processos de baixa patrimonial via `avaliacao_inservivel_id` e `baixa_patrimonial_id`

Isso permite auditoria sem carregar binários no Postgres.

## 6) Saídas oficiais (n8n + Drive)

Workflows n8n ficam em `automations/`:

- `n8n_relatorio_forasteiros_pdf.json`: gera PDF via API (`GET /api/pdf/forasteiros`) e faz upload no Drive.
- `n8n_gerador_termos_pdf.json`: gera PDF via API (`POST /api/pdf/termos`) e faz upload no Drive.

Pré-requisitos dos workflows PDF via API:

- autenticação ativa no backend (JWT),
- variáveis de ambiente no n8n:
  - `PATRIMONIO_ADMIN_MATRICULA`
  - `PATRIMONIO_ADMIN_SENHA`

## 7) Boas práticas para auditoria

- Guarde sempre o CSV original importado (fora do repositório).
- Registre quem executa operações críticas (perfil).
- Não use "transferência" para "consertar inventário" durante o congelamento: registre divergência e regularize depois.

## 8) Logs consolidados (projeto x patrimonio)

### Log Geral de Alterações (governanca)

Onde consultar:

- Menu **Auditoria e Logs** -> **Log Geral de Alterações**
- Arquivo canonico: `docs/LOG_GERAL_ALTERACOES.md`

Use este log para trilha de mudancas de sistema (deploy, UX, docs, scripts, runtime), com:

- autor
- data/hora UTC
- commit
- comando de reversao (`git revert <commit>`)

### Auditoria Patrimonial (Global) (dados operacionais)

Onde consultar:

- Menu **Auditoria e Logs** -> **Auditoria Patrimonial (Global)**

Use este log para alterações de patrimonio (bens/catálogo/movimentações/contagens), sem abrir tombo individual.

Filtros recomendados:

- `numeroTombamento`
- `tabela`
- `operação`
- `q` (texto livre)

### Log de erros runtime (novo)

No menu **Auditoria e Logs**, consulte a seção **Log de Erros Runtime (API)** para ver falhas recentes (4xx/5xx) com:

- data/hora UTC
- codigo do erro
- rota/metodo
- requestId

Use o `requestId` para correlacionar com logs do backend na VPS.

## Atualização 2026-02-26 - Novo agrupamento de Auditoria

Consulta recomendada no menu:

- Auditoria e Logs -> Log Geral de Alterações
- Auditoria e Logs -> Auditoria Patrimonial (Global)
- Auditoria e Logs -> Log de Erros Runtime

Esse agrupamento separa auditoria operacional da Administração de Infra.

