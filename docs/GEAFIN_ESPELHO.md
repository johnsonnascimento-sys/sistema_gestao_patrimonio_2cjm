# Espelho do GEAFIN (Auditoria 1:1 do `relatorio.csv`)

## Cabecalho

| Campo | Valor |
|---|---|
| Modulo | `docs` |
| Arquivo | `docs/GEAFIN_ESPELHO.md` |
| Funcao no sistema | Descrever a camada "espelho" do GEAFIN para auditoria e rastreabilidade (colunas iguais ao CSV) |
| Data | 2026-02-17 |
| Versao | v1.0 |
| Fonte de verdade (governanca) | `PROJECT_RULES.md` |

## 1. Objetivo (por que existe o espelho)

O sistema possui 2 camadas complementares:

1. **Camada normalizada (operacional)**: `catalogo_bens` (SKU) + `bens` (item fisico).
   - Aqui a descricao e centralizada no `catalogo_bens` para evitar repeticao e facilitar manutencao.

2. **Camada espelho (auditoria 1:1)**: guarda o CSV "como veio do GEAFIN".
   - Objetivo: permitir auditoria e reprocessamento sem perder o original.
   - Regra operacional: esta camada não é fonte de verdade operacional do sistema; ela é um registro fiel e consultável.

## 2. Estruturas do banco (public.*)

Criadas pela migracao `database/003_geafin_raw.sql`.

### 2.1 `public.geafin_import_arquivos`

Um registro por arquivo importado.

Campos principais (resumo):
- `id` (UUID)
- `nome_arquivo`
- `sha256_arquivo` (hash do conteudo)
- `tamanho_bytes`
- `total_linhas`
- `created_at`

### 2.2 `public.geafin_import_linhas`

Um registro por linha do CSV.

Campos principais (resumo):
- `id` (UUID)
- `arquivo_id` (FK para `geafin_import_arquivos`)
- `linha_numero`
- `row_raw` (JSONB): **conteudo da linha, preservado**
- `sha256_linha`
- `persistencia_ok` (bool) e `persistencia_erro` (texto): resultado do processamento/normalizacao
- `created_at`

Observacao:
- A linha e guardada como JSONB para suportar divergencias de encoding/colunas sem quebrar o banco.

### 2.3 `public.vw_geafin_relatorio_csv`

View de conveniencia com **colunas iguais ao header do `relatorio.csv`**.

Objetivo:
- Dar uma "tabela" pronta para auditoria/consulta sem ter que ler JSONB.
- Facilitar exportacao e comparacao com o CSV original.

## 3. Como consultar no Supabase (exemplos)

Exemplos de SQL (somente leitura):

```sql
-- Ultimos arquivos importados (auditoria)
select id, nome_arquivo, sha256_arquivo, total_linhas, created_at
from public.geafin_import_arquivos
order by created_at desc
limit 20;
```

```sql
-- Linhas com erro de persistencia
select linha_numero, persistencia_erro, row_raw
from public.geafin_import_linhas
where persistencia_ok = false
order by linha_numero asc
limit 50;
```

```sql
-- Espelho 1:1 do relatorio.csv (view com colunas do GEAFIN)
select *
from public.vw_geafin_relatorio_csv
limit 50;
```

## 4. Relacao com a camada normalizada (SKU vs Item)

Regras operacionais:
- O espelho não "manda" no operacional; ele registra o original.
- O operacional e alimentado pelo importador:
  - primeiro garante `catalogo_bens` (SKU)
  - depois faz upsert em `bens` (item fisico) apontando para `catalogo_bem_id`

## 5. Criterio de "colunas iguais ao GEAFIN"

Quando voce diz "colunas iguais ao GEAFIN", existem 2 interpretacoes:

1. **Espelho para auditoria** (este documento):
   - Sim: `public.vw_geafin_relatorio_csv` expõe colunas iguais ao CSV.
2. **Operacional com colunas iguais ao GEAFIN**:
   - Nao e recomendado, porque conflita com a normalizacao (SKU vs item) e criaria duplicacao.
   - Em vez disso, usamos:
     - operacional normalizado (`catalogo_bens` + `bens`)
     - espelho para auditoria (este modulo)
