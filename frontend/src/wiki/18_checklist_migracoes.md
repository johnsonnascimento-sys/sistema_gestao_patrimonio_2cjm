<!--
Modulo: wiki
Arquivo: frontend/src/wiki/18_checklist_migracoes.md
Funcao no sistema: explicar o que e "migracao" neste projeto e fornecer checklist operacional de aplicacao/validacao.
Atualizado em: 2026-02-17  (gerenciado pelo wikiMeta.generated.js na UI)
-->

# Checklist de migrações (Supabase) e o que isso significa

## 1) O que significa "migração" aqui

Uma **migração** é um arquivo `.sql` em `database/` que faz **mudança controlada no banco** (Supabase/Postgres), como:

- criar tabelas novas (ex.: `documentos`)
- alterar tabelas existentes (ex.: permitir novo tipo de ocorrência)
- criar/alterar views (ex.: `vw_forasteiros`)
- criar índices/constraints para garantir coerência e auditoria

Pontos importantes:

- Migração **não é importação** de dados. Ela ajusta a **estrutura** e regras do banco.
- Migração **não substitui** backend/frontend. Ela é a base para a aplicação funcionar.
- Migração precisa ser aplicada **uma vez** no Supabase.

Por que isso é obrigatório:

- O backend e o frontend assumem que certas tabelas/colunas/views existem.
- Se a migração não foi aplicada, surgem erros como “coluna X não existe” ou recursos “somem”.

## 2) Onde aplicar

No Supabase:

- abra o **SQL Editor** do projeto;
- cole o conteúdo do arquivo `.sql` e execute.

Ordem importa:

- aplique na ordem numérica (ex.: `007`, depois `008`, etc.).

## 3) Checklist de migrações (ordem + o que muda + como validar)

### 007) `vw_forasteiros` só pós-inventário (fila real)

Arquivo:

- `database/007_forasteiros_queue_apenas_encerrado.sql`

O que muda:

- A view `vw_forasteiros` passa a listar apenas divergências pendentes de eventos com `status='ENCERRADO'`.

Por quê:

- Regularização é fluxo **pós-inventário** (Art. 185 - AN303_Art185).

Como validar (SQL):

- `SELECT to_regclass('public.vw_forasteiros');`
- `SELECT * FROM public.vw_forasteiros LIMIT 1;` (ver `status_inventario`)

Como validar (UI):

- Aba **Regularização**:
  - com evento `EM_ANDAMENTO`: a fila **não** deve aparecer.
  - após encerrar o evento: a fila deve aparecer.

### 008) Evidências/documentos (Drive) sem armazenar PDF no banco

Arquivo:

- `database/008_documentos_anexos.sql`

O que muda:

- Cria `documentos` para registrar metadados (Drive URL/ID/hash) vinculados a `movimentacoes` e/ou `contagens`.

Por quê:

- Transferência/cautela exigem formalização e rastreabilidade (Arts. 124/127 - AN303_Art124/AN303_Art127).

Como validar (SQL):

- `SELECT to_regclass('public.documentos');`

Como validar (API):

- `GET /api/documentos` deve retornar 200.

### 009) Ocorrência `BEM_DE_TERCEIRO` no inventário (controle segregado)

Arquivo:

- `database/009_ocorrencia_bem_terceiro.sql`

O que muda:

- Adiciona o valor `BEM_DE_TERCEIRO` ao enum `tipo_ocorrencia_inventario`.

Por quê:

- Bens de terceiros devem ter controle segregado (Art. 99 / 110 VI / 175 IX).

Como validar (SQL):

- `SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='tipo_ocorrencia_inventario' ORDER BY 1;`
- Deve aparecer `BEM_DE_TERCEIRO`.

Como validar (UI):

- Modo Inventário: bloco **Registrar bem de terceiro (segregado)** deve registrar sem tombamento.

### 010) Persistência do Wizard Art. 141 (inservíveis)

Arquivo:

- `database/010_inserviveis_wizard_persistencia.sql`

O que muda:

- Cria `avaliacoes_inserviveis` (histórico) e permite persistir resultado do wizard.

Por quê:

- Classificação obrigatória e auditável (Art. 141 - AN303_Art141_*).

Como validar (SQL):

- `SELECT to_regclass('public.avaliacoes_inserviveis');`

Como validar (UI):

- Wizard: carregar bem por tombamento, executar wizard, salvar.
- Reabrir aba e ver histórico.

### 011) Fotos + locais (salas) padronizados (camada operacional melhorada)

Arquivo:

- `database/011_fotos_e_locais.sql`

O que muda:

- `catalogo_bens.foto_referencia_url` (foto de referência do SKU)
- `bens.foto_url` (foto do item, quando necessário)
- tabela `locais` e `bens.local_id` (opcional, mantendo `local_fisico`)

Por quê:

- Melhorar operação sem perder compatibilidade com dados existentes.

Como validar (SQL):

- `SELECT to_regclass('public.locais');`
- `SELECT foto_referencia_url FROM catalogo_bens LIMIT 1;`
- `SELECT foto_url, local_id FROM bens LIMIT 1;`

Como validar (API):

- `GET /api/locais` deve responder 200.

### 012) View de bens de terceiros no inventário (relatório segregado)

Arquivo:

- `database/012_view_terceiros_inventario.sql`

O que muda:

- Cria/atualiza a view `vw_bens_terceiros_inventario` (derivada de `contagens`).

Por quê:

- Facilitar auditoria/relatórios sem misturar com bens tombados STM.

Como validar (SQL):

- `SELECT to_regclass('public.vw_bens_terceiros_inventario');`

Como validar (API):

- `GET /api/inventario/bens-terceiros` deve responder 200 (pode retornar `items: []`).

### 013) Documentos vinculados a avaliações (Wizard Art. 141)

Arquivo:

- `database/013_documentos_avaliacoes_inserviveis.sql`

O que muda:

- Adiciona `documentos.avaliacao_inservivel_id` (FK) para permitir anexar evidências do Drive a uma avaliação.

Como validar (SQL):

- `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='documentos' AND column_name='avaliacao_inservivel_id';`

Como validar (API):

- `GET /api/documentos?avaliacaoInservivelId=<uuid>` deve responder 200.

## 4) Depois de aplicar migrações: deploy

Após aplicar as migrações no Supabase, faça deploy na VPS para alinhar backend/frontend:

```bash
cd /opt/cjm-patrimonio/releases/cjm-patrimonio
git pull --ff-only
./scripts/vps_deploy.sh all
```

