<!--
Modulo: wiki
Arquivo: frontend/src/wiki/18_checklist_migracoes.md
Funcao no sistema: orientar a aplicação e a validação das migrações SQL do projeto.
-->

# Checklist de migrações (Supabase)

## O que significa migração neste projeto

Uma migração é um arquivo `.sql` em `database/` que altera estrutura, constraints, enums, índices ou tabelas necessárias ao runtime.

Ela:

- não substitui deploy de backend/frontend;
- não é importação de dados;
- precisa ser aplicada no banco antes de usar telas que dependem da mudança.

## Ordem relevante para Material Inservível / Baixa

### 010) `database/010_inserviveis_wizard_persistencia.sql`

Cria a persistência base do histórico de avaliações de inservível.

Validação:

- `SELECT to_regclass('public.avaliacoes_inserviveis');`

### 013) `database/013_documentos_avaliacoes_inserviveis.sql`

Permite vincular documentos a avaliações de inservível.

Validação:

- verificar a coluna `documentos.avaliacao_inservivel_id`.

### 022) `database/022_rbac_roles_permissions.sql`

Consolida RBAC e aprovações administrativas. Nesta entrega, também precisa conter:

- `action.inservivel.marcar.request`
- `action.inservivel.marcar.execute`
- `action.baixa.request`
- `action.baixa.execute`

Validação:

- `SELECT codigo FROM permissoes WHERE codigo LIKE 'action.inservivel.%' OR codigo LIKE 'action.baixa.%';`

### 023) `database/023_material_inservivel_baixa.sql`

Migração principal desta entrega.

Cria:

- enum `status_fluxo_inservivel`
- enum `destinacao_inservivel`
- enum `modalidade_baixa_patrimonial`
- enum `status_baixa_patrimonial`
- tabela `marcacoes_inserviveis`
- tabela `baixas_patrimoniais`
- tabela `baixas_patrimoniais_itens`

Também altera:

- `bens` com `motivo_baixa_patrimonial` e `baixado_em`
- `documentos` com `baixa_patrimonial_id`
- enum de tipos documentais com os placeholders da baixa

Validação mínima:

```sql
SELECT to_regclass('public.marcacoes_inserviveis');
SELECT to_regclass('public.baixas_patrimoniais');
SELECT to_regclass('public.baixas_patrimoniais_itens');
SELECT column_name
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name='bens'
  AND column_name IN ('motivo_baixa_patrimonial', 'baixado_em');
```

## Checklist pós-migração

1. Aplicar as migrações na ordem numérica.
2. Subir backend e frontend atualizados.
3. Validar os endpoints:
   - `GET /inserviveis/marcacoes`
   - `GET /baixas-patrimoniais`
   - `GET /bens/:id`
4. Executar os gates locais:
   - `npm --prefix backend run check`
   - `npm --prefix backend test`
   - `npm --prefix frontend test`
   - `npm --prefix frontend run build`
   - `python scripts/check_wiki_encoding.py`
   - `node scripts/validate_governance.js`

## Observação operacional

Sem a migration `023_material_inservivel_baixa.sql`, a nova workspace **Material Inservível / Baixa** não consegue listar fila, abrir processos ou efetivar `status = BAIXADO`.
