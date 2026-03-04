<!--
Modulo: wiki
Arquivo: frontend/src/wiki/04_importacao_geafin.md
Funcao no sistema: manual detalhado da importação GEAFIN (CSV Latin1) e como auditar o espelho.
-->

# Importação GEAFIN (CSV)

## O que esta importação faz

Quando voce importa o CSV do GEAFIN (relatorio), o sistema faz duas coisas:

1. **Camada espelho (auditoria 1:1)**:
   - Salva todas as linhas importadas em tabelas de importação (espelho do CSV).
   - Isso permite provar que "o que entrou" e exatamente o que estava no arquivo.

2. **Camada operacional (normalizada)**:
   - Atualiza `catálogo_bens` e `bens` para uso diario (SKU vs item).
   - Evita duplicação de descrição por item, quando possivel.

## Onde importar

No site, abra:

- Grupo **Operações Patrimoniais**
- Secao **Importação GEAFIN (CSV Latin1)**

Passos:

1. Clique em **Escolher arquivo**.
2. Selecione o CSV exportado do GEAFIN.
3. Clique em **Importar**.

## Progresso (barra)

Durante a importação, a UI mostra:

- Nome do arquivo
- Status (EM_ANDAMENTO / CONCLUIDO / ERRO)
- Percentual (%)
- Contadores (ok, falhas de persistencia, falhas de normalização)
- Datas:
  - **inicio** (quando o arquivo foi registrado)
  - **ultima atualização** (ultima linha persistida no espelho)
  - **finalizada em** (quando concluiu ou falhou)
- Indicador **sem atualização** (segundos desde a ultima atualização)

### Se ficar em 0% por muito tempo

Isso normalmente significa "fase de preparação":

- upload do arquivo
- leitura/parse do CSV
- registro do arquivo no banco

Por isso, o sistema pode mostrar um indicador "indeterminado" ate as primeiras linhas serem processadas.

### Se ficar parado (ex.: % travado) por muito tempo

Se o status continuar `EM_ANDAMENTO` mas o campo **sem atualização** ficar alto (sem novas linhas entrando),
provavelmente a importação anterior foi interrompida (ex.: backend reiniciado).

Acao recomendada:

1. Clique em **Cancelar** na barra de progresso.
2. O sistema marca a importação como `ERRO` para destravar a UI (isso e esperado).
3. Em seguida, faca um novo upload.

## O que pode dar errado (e o que fazer)

### 1) 504 Gateway Timeout

Sintoma:

- O browser mostra 504 ou "Failed to fetch" durante upload/importação.

Causa comum:

- Timeout do proxy Nginx.

Solução:

- Ajustar `proxy_read_timeout`/`proxy_send_timeout` no Nginx (host e/ou container) e recarregar.

### 2) ERRO no status da importação

Quando o status vira `ERRO`, o sistema guarda um resumo (`erro_resumo`). Voce deve:

1. Abrir logs do backend (Docker).
2. Ver o `requestId` do POST `/importar-geafin`.
3. Confirmar qual coluna/linha causou falha.

## Como auditar (camada espelho)

O espelho existe para auditoria. Ele permite responder:

- Qual arquivo foi importado?
- Quantas linhas?
- Quando?
- Com quais separadores?
- Houve falhas por linha?

O sistema guarda metadados do arquivo (hash, bytes, total de linhas) e as linhas em tabela dedicada.

Importante:

- O espelho não substitui a camada operacional.
- Ele existe para rastreabilidade e comparação.

## Boas praticas

- Importe sempre um arquivo por vez (aguarde `CONCLUIDO`).
- Guarde o CSV original em arquivo interno (fora do repositorio) para auditoria externa.
- Se importar novamente o mesmo arquivo, o sistema deve reconhecer duplicidade via hash e ainda assim registrar um novo evento (dependendo do modo configurado).

## Backup obrigatorio antes de importar

Para reduzir risco em caso de erro durante a importação, execute snapshot antes de cada carga GEAFIN:

```bash
cd /opt/cjm-patrimonio/current
./scripts/pre_geafin_snapshot.sh --tag pre-geafin --keep-days 14
```

Esse snapshot inclui:

1. Dump do banco (SQL compactado).
2. Imagens locais (`/opt/cjm-patrimonio/shared/data/fotos`).
3. Upload para Google Drive (`cjm_gdrive:db-backups`).

Se ocorrer incidente grave, use o restore do dump correspondente conforme `docs/BACKUP_DRIVE.md`.

## Atualização 2026-02-26 - Local da funcionalidade

A importação GEAFIN foi posicionada como ultimo submenu operacional.

Novo caminho de menu:

- Operações Patrimoniais -> Importação GEAFIN (CSV Latin1)

A API e o comportamento operacional permanecem os mesmos.

## Atualização 2026-02-27 - Sessao v2 (previa -> revisao -> aplicação)

Novo fluxo da Importação GEAFIN:

1. Criar sessao de previa (sem gravar alterações operacionais em `bens/catálogo`).
2. Revisar ações planejadas.
3. Aplicar sessao com backup automatico obrigatorio antes da escrita.

### Modos

- `INCREMENTAL` (padrao):
  - exige decisao item a item para ações de criação/atualização (`APROVADA` ou `REJEITADA`);
  - permite atalho de decisao em lote por filtro.

- `TOTAL`:
  - exige confirmação forte (`IMPORTACAO_TOTAL`);
  - exige escolha obrigatoria para bens ausentes no escopo:
    - `MANTER`: não altera ausentes;
    - `BAIXAR`: marca ausentes como `BAIXADO`.

### Escopo

- `GERAL`: todas as unidades.
- `UNIDADE`: uma unidade por execução (`1..4`).

### Cancelamento e rollback

- Cancelar em previa: encerra sessao sem impacto operacional.
- Cancelar durante aplicação: o backend faz rollback total da aplicação em curso.

### Regra permanente de seguranca

- A importação GEAFIN não executa delete fisico de `bens` nem `catálogo_bens`.

### Endpoints principais (v2)

- `POST /importacoes/geafin/sessoes`
- `GET /importacoes/geafin/:id`
- `GET /importacoes/geafin/:id/ações`
- `POST /importacoes/geafin/:id/ações/:acaoId/decisao`
- `POST /importacoes/geafin/:id/ações/decisao-lote`
- `POST /importacoes/geafin/:id/aplicar`
- `POST /importacoes/geafin/:id/cancelar`
