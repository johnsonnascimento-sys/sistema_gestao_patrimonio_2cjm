<!--
Modulo: wiki
Arquivo: frontend/src/wiki/09_relatorios_auditoria.md
Funcao no sistema: orientar como extrair evidencias e entender trilhas (historicos, importa?o GEAFIN, inventario, documentos).
Atualizado em: 2026-02-17  (gerenciado pelo wikiMeta.generated.js na UI)
-->

# RelatÃ³rios e auditoria

## Objetivo

Este sistema foi desenhado para â€œaguentar auditoriaâ€. Isso significa:

- ser possÃ­vel provar o que foi importado (GEAFIN),
- ser possÃ­vel provar quando e por que um bem mudou de carga,
- ser possÃ­vel listar divergÃªncias de inventÃ¡rio (intrusos) sem alterar carga no ato,
- ser possÃ­vel vincular evidÃªncias (Drive/PDF) Ã s operaÃ§Ãµes relevantes.

## 1) Auditoria de importaÃ§Ã£o GEAFIN

EvidÃªncias:

- registro do arquivo (nome, hash, bytes, data/hora, total de linhas, status),
- linhas espelho (conteÃºdo do CSV como chegou),
- contadores (ok/falha persistÃªncia/falha normalizaÃ§Ã£o).

Uso tÃ­pico:

- â€œas 3833 linhas do CSV foram processadas?â€: verificar `status=CONCLUIDO` e `percent=100` em `GET /importa?es/geafin/ultimo`.

## 2) Auditoria de mudanÃ§a de carga (transferÃªncias)

Quando uma transferÃªncia acontece (mudanÃ§a de `bens.unidade_dona_id`), o banco registra histÃ³rico dedicado.

EvidÃªncias:

- bem (tombamento),
- unidade antiga e nova,
- data/hora,
- origem (IMPORTACAO/APP/SISTEMA),
- usuÃ¡rio (quando aplicÃ¡vel).

Base legal:

- Art. 124 (AN303_Art124) e Art. 127 (AN303_Art127).

## 3) Forasteiros / intrusos (inventÃ¡rio)

Um â€œforasteiroâ€ Ã© uma divergÃªncia registrada no inventÃ¡rio:

- `tipo_ocorrencia = ENCONTRADO_EM_LOCAL_DIVERGENTE`
- `regulariza?o_pendente = true`

RelatÃ³rio tÃ­pico:

- lista de bens com unidade dona diferente da unidade encontrada no inventÃ¡rio.

ObservaÃ§Ã£o:

- o sistema deriva isso de `contagens` (fato do inventÃ¡rio), nÃ£o de coluna â€œunidade_local_atualâ€ no bem.

Base legal:

- Art. 185 (AN303_Art185).

## Relat?rio de encerramento do invent?rio (detalhado)

Quando o evento ? encerrado, a tela de Administra?o apresenta um relat?rio consolidado com:

- contagens totais e conformidades
- diverg?ncias de unidade/endereço (incluindo `UNIDADE_E_endereço`)
- pend?ncias de regulariza?o p?s-invent?rio
- evid?ncias de ader?ncia aos Arts. 183/185/124/127

Gr?ficos no painel:

- pizza de diverg?ncias por tipo (Unidade, endereço, Unidade+endereço)
- barra de regulariza?o (pendentes x regularizadas)
- ranking de endereços com mais diverg?ncias

Exporta?o edit?vel:

- endpoint `GET /api/inventario/eventos/{id}/relatorio-encerramento.csv`
- arquivo CSV edit?vel para planilhas e edi?es da comiss?o.

Observa?o de compliance:

- o endpoint exige evento `ENCERRADO`, evitando relat?rio final em invent?rio ainda ativo.

## Linha do tempo de altera?es do bem

Na tela de detalhes do bem (Consulta de Bens), a trilha de auditoria segue estes padroes:

- IDs de local, perfil, cat?logo e bem n?o aparecem crus na grade principal.
- Para `UPDATE`, o diff mostra antes/depois por campo.
- Para `INSERT` e `DELETE`, a timeline mostra um marcador de opera?o para evitar item vazio.
- O responsavel da altera?o e resolvido por nome/matr?cula sempre que houver `perfil_id` relacionado.
- Quando existir UUID de referencia, ele fica disponivel por tooltip (hover/foco), sem poluir a leitura principal.

## 4) Bens de terceiros (controle segregado)

â€œBem de terceiroâ€ Ã© ocorrÃªncia segregada, sem tombamento GEAFIN:

- `bens.eh_bem_terceiro=true`
- `contagens.tipo_ocorrencia='BEM_DE_TERCEIRO'`

Consulta/auditoria:

- view `vw_bens_terceiros_inventario`
- API `GET /inventario/bens-terceiros`

Base legal (controle segregado):

- Art. 99 (AN303_Art99), Art. 110, VI (AN303_Art110_VI), Art. 175, IX (AN303_Art175_IX).

## 5) Documentos (termos e evidÃªncias)

O sistema **nÃ£o armazena PDF no banco**. Ele armazena metadados em `documentos`:

- `drive_url` / `drive_file_id`
- `sha256` (opcional)
- vÃ­nculo com `movimenta?es` e/ou `contagens`
- (opcional) vÃ­nculo com `avalia?es_inserviveis` (Wizard Art. 141) via `avalia?o_inservivel_id` (migration 013)

Isso permite auditoria sem carregar binÃ¡rios no Postgres.

## 6) SaÃ­das oficiais (n8n + Drive)

Workflows n8n ficam em `automations/`:

- `n8n_relatorio_forasteiros_pdf.json`: gera PDF via API (`GET /api/pdf/forasteiros`) e faz upload no Drive.
- `n8n_gerador_termos_pdf.json`: gera PDF via API (`POST /api/pdf/termos`) e faz upload no Drive.

PrÃ©-requisitos dos workflows PDF via API:

- autenticaÃ§Ã£o ativa no backend (JWT),
- variÃ¡veis de ambiente no n8n:
  - `PATRIMONIO_ADMIN_MATRICULA`
  - `PATRIMONIO_ADMIN_SENHA`

## 7) Boas prÃ¡ticas para auditoria

- Guarde sempre o CSV original importado (fora do repositÃ³rio).
- Registre quem executa operaÃ§Ãµes crÃ­ticas (perfil).
- NÃ£o use â€œtransferÃªnciaâ€ para â€œconsertar inventÃ¡rioâ€ durante o congelamento: registre divergÃªncia e regularize depois.

## 8) Logs consolidados (projeto x patrimonio)

### Log Geral de Altera?es (governanca)

Onde consultar:

- Menu **Auditoria e Logs** -> **Log Geral de Altera?es**
- Arquivo canonico: `docs/LOG_GERAL_ALTERACOES.md`

Use este log para trilha de mudancas de sistema (deploy, UX, docs, scripts, runtime), com:

- autor
- data/hora UTC
- commit
- comando de reversao (`git revert <commit>`)

### Auditoria Patrimonial (Global) (dados operacionais)

Onde consultar:

- Menu **Auditoria e Logs** -> **Auditoria Patrimonial (Global)**

Use este log para altera?es de patrimonio (bens/cat?logo/movimenta?es/contagens), sem abrir tombo individual.

Filtros recomendados:

- `numeroTombamento`
- `tabela`
- `opera?o`
- `q` (texto livre)

### Log de erros runtime (novo)

No menu **Auditoria e Logs**, consulte a secao **Log de Erros Runtime (API)** para ver falhas recentes (4xx/5xx) com:

- data/hora UTC
- codigo do erro
- rota/metodo
- requestId

Use o `requestId` para correlacionar com logs do backend na VPS.

## Atualiza?o 2026-02-26 - Novo agrupamento de Auditoria

Consulta recomendada no menu:

- Auditoria e Logs -> Log Geral de Altera?es
- Auditoria e Logs -> Auditoria Patrimonial (Global)
- Auditoria e Logs -> Log de Erros Runtime

Esse agrupamento separa auditoria operacional da Administra?o de Infra.

