<!--
Modulo: wiki
Arquivo: frontend/src/wiki/18_checklist_migra?es.md
Funcao no sistema: explicar o que e "migra?o" neste projeto e fornecer checklist operacional de aplica?o/valida?o.
Atualizado em: 2026-02-17  (gerenciado pelo wikiMeta.generated.js na UI)
-->

# Checklist de migraÃ§Ãµes (Supabase) e o que isso significa

## 1) O que significa "migraÃ§Ã£o" aqui

Uma **migraÃ§Ã£o** Ã© um arquivo `.sql` em `database/` que faz **mudanÃ§a controlada no banco** (Supabase/Postgres), como:

- criar tabelas novas (ex.: `documentos`)
- alterar tabelas existentes (ex.: permitir novo tipo de ocorrÃªncia)
- criar/alterar views (ex.: `vw_forasteiros`)
- criar Ã­ndices/constraints para garantir coerÃªncia e auditoria

Pontos importantes:

- MigraÃ§Ã£o **nÃ£o Ã© importaÃ§Ã£o** de dados. Ela ajusta a **estrutura** e regras do banco.
- MigraÃ§Ã£o **nÃ£o substitui** backend/frontend. Ela Ã© a base para a aplicaÃ§Ã£o funcionar.
- MigraÃ§Ã£o precisa ser aplicada **uma vez** no Supabase.

Por que isso Ã© obrigatÃ³rio:

- O backend e o frontend assumem que certas tabelas/colunas/views existem.
- Se a migraÃ§Ã£o nÃ£o foi aplicada, surgem erros como â€œcoluna X nÃ£o existeâ€ ou recursos â€œsomemâ€.

## 2) Onde aplicar

No Supabase:

- abra o **SQL Editor** do projeto;
- cole o conteÃºdo do arquivo `.sql` e execute.

Ordem importa:

- aplique na ordem numÃ©rica (ex.: `007`, depois `008`, etc.).

## 3) Checklist de migraÃ§Ãµes (ordem + o que muda + como validar)

### 007) `vw_forasteiros` sÃ³ pÃ³s-inventÃ¡rio (fila real)

Arquivo:

- `database/007_forasteiros_queue_apenas_encerrado.sql`

O que muda:

- A view `vw_forasteiros` passa a listar apenas divergÃªncias pendentes de eventos com `status='ENCERRADO'`.

Por quÃª:

- RegularizaÃ§Ã£o Ã© fluxo **pÃ³s-inventÃ¡rio** (Art. 185 - AN303_Art185).

Como validar (SQL):

- `SELECT to_regclass('public.vw_forasteiros');`
- `SELECT * FROM public.vw_forasteiros LIMIT 1;` (ver `status_inventario`)

Como validar (UI):

- Aba **RegularizaÃ§Ã£o**:
  - com evento `EM_ANDAMENTO`: a fila **nÃ£o** deve aparecer.
  - apÃ³s encerrar o evento: a fila deve aparecer.

### 008) EvidÃªncias/documentos (Drive) sem armazenar PDF no banco

Arquivo:

- `database/008_documentos_anexos.sql`

O que muda:

- Cria `documentos` para registrar metadados (Drive URL/ID/hash) vinculados a `movimenta?es` e/ou `contagens`.

Por quÃª:

- TransferÃªncia/cautela exigem formalizaÃ§Ã£o e rastreabilidade (Arts. 124/127 - AN303_Art124/AN303_Art127).

Como validar (SQL):

- `SELECT to_regclass('public.documentos');`

Como validar (API):

- `GET /api/documentos` deve retornar 200.

### 009) OcorrÃªncia `BEM_DE_TERCEIRO` no inventÃ¡rio (controle segregado)

Arquivo:

- `database/009_ocorrencia_bem_terceiro.sql`

O que muda:

- Adiciona o valor `BEM_DE_TERCEIRO` ao enum `tipo_ocorrencia_inventario`.

Por quÃª:

- Bens de terceiros devem ter controle segregado (Art. 99 / 110 VI / 175 IX).

Como validar (SQL):

- `SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='tipo_ocorrencia_inventario' ORDER BY 1;`
- Deve aparecer `BEM_DE_TERCEIRO`.

Como validar (UI):

- Modo InventÃ¡rio: bloco **Registrar bem de terceiro (segregado)** deve registrar sem tombamento.

### 010) PersistÃªncia do Wizard Art. 141 (inservÃ­veis)

Arquivo:

- `database/010_inserviveis_wizard_persistencia.sql`

O que muda:

- Cria `avalia?es_inserviveis` (histÃ³rico) e permite persistir resultado do wizard.

Por quÃª:

- ClassificaÃ§Ã£o obrigatÃ³ria e auditÃ¡vel (Art. 141 - AN303_Art141_*).

Como validar (SQL):

- `SELECT to_regclass('public.avalia?es_inserviveis');`

Como validar (UI):

- Wizard: carregar bem por tombamento, executar wizard, salvar.
- Reabrir aba e ver histÃ³rico.

### 011) Fotos + locais (endereços) padronizados (camada operacional melhorada)

Arquivo:

- `database/011_fotos_e_locais.sql`

O que muda:

- `cat?logo_bens.foto_referencia_url` (foto de referÃªncia do SKU)
- `bens.foto_url` (foto do item, quando necessÃ¡rio)
- tabela `locais` e `bens.local_id` (opcional, mantendo `local_fisico`)

Por quÃª:

- Melhorar operaÃ§Ã£o sem perder compatibilidade com dados existentes.

Como validar (SQL):

- `SELECT to_regclass('public.locais');`
- `SELECT foto_referencia_url FROM cat?logo_bens LIMIT 1;`
- `SELECT foto_url, local_id FROM bens LIMIT 1;`

Como validar (API):

- `GET /api/locais` deve responder 200.

### 012) View de bens de terceiros no inventÃ¡rio (relatÃ³rio segregado)

Arquivo:

- `database/012_view_terceiros_inventario.sql`

O que muda:

- Cria/atualiza a view `vw_bens_terceiros_inventario` (derivada de `contagens`).

Por quÃª:

- Facilitar auditoria/relatÃ³rios sem misturar com bens tombados STM.

Como validar (SQL):

- `SELECT to_regclass('public.vw_bens_terceiros_inventario');`

Como validar (API):

- `GET /api/inventario/bens-terceiros` deve responder 200 (pode retornar `items: []`).

### 013) Documentos vinculados a avaliaÃ§Ãµes (Wizard Art. 141)

Arquivo:

- `database/013_documentos_avalia?es_inserviveis.sql`

O que muda:

- Adiciona `documentos.avalia?o_inservivel_id` (FK) para permitir anexar evidÃªncias do Drive a uma avaliaÃ§Ã£o.

Como validar (SQL):

- `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='documentos' AND column_name='avalia?o_inservivel_id';`

Como validar (API):

- `GET /api/documentos?avalia?oInservivelId=<uuid>` deve responder 200.

## 4) Depois de aplicar migraÃ§Ãµes: deploy

ApÃ³s aplicar as migraÃ§Ãµes no Supabase, faÃ§a deploy na VPS para alinhar backend/frontend:

```bash
cd /opt/cjm-patrimonio/releases/cjm-patrimonio
git pull --ff-only
./scripts/vps_deploy.sh all
```


