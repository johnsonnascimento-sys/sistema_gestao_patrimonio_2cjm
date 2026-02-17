<!--
Modulo: wiki
Arquivo: frontend/src/wiki/09_relatorios_auditoria.md
Funcao no sistema: orientar como extrair evidencias e entender trilhas (historicos, importacao GEAFIN, inventario, documentos).
-->

# Relatórios e auditoria

## Objetivo

Este sistema foi desenhado para "aguentar auditoria". Isso significa:

- Ser possível provar o que foi importado (GEAFIN).
- Ser possível provar quando e por que um bem mudou de carga.
- Ser possível listar divergências de inventário (intrusos) sem alterar carga no ato.
- Ser possível vincular documentos (Drive/PDF) às operações relevantes.

## 1) Auditoria de importação GEAFIN

Evidências:

- Registro do arquivo (nome, hash, bytes, data/hora, total de linhas, status).
- Linhas espelho (conteúdo do CSV como chegou).
- Contadores (ok/falha persistência/falha normalização).

Uso típico:

- "As 3833 linhas do CSV foram processadas?": verificar `status=CONCLUIDO` e `percent=100`.

## 2) Auditoria de mudança de carga (transferências)

Quando uma transferência acontece (mudança de `unidade_dona_id`), o banco registra histórico dedicado.

Evidências:

- Bem (tombamento)
- Unidade antiga e nova
- Data/hora
- Origem (IMPORTACAO/APP/SISTEMA)
- Usuário (quando aplicável)

Base legal:

- Art. 124 (AN303_Art124) e Art. 127 (AN303_Art127).

## 3) Forasteiros / intrusos (inventário)

Um "forasteiro" é uma divergência registrada no inventário:

- `tipo_ocorrencia = ENCONTRADO_EM_LOCAL_DIVERGENTE`
- `regularizacao_pendente = true`

Relatório típico:

- Lista de bens com unidade dona diferente da unidade encontrada no inventário.

Observação:

- O sistema deriva isso de `contagens` (inventário), não de coluna "unidade_local_atual" no bem.

Base legal:

- Art. 185 (AN303_Art185).

## 4) Documentos (termos e evidências)

O sistema não armazena PDF no banco. Ele armazena metadados em `documentos`:

- `drive_url` / `drive_file_id`
- `sha256` (opcional)
- vínculo com `movimentacoes` e/ou `contagens`

Isso permite auditoria sem carregar binários no Postgres.

## 5) Saídas oficiais (n8n)

Workflows n8n ficam em `automations/`:

- Relatório de Forasteiros: baseado em `vw_forasteiros` (Art. 185).
- Gerador de Termos: modelo para gerar termo e salvar no Drive (ver README da pasta).

## 6) Boas práticas para auditoria

- Guarde sempre o CSV original importado (fora do repositório).
- Registre quem executa operações críticas (perfil).
- Não use "transferência" para consertar inventário durante congelamento: registre divergência e regularize depois.

