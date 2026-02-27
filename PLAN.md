# Plano Fechado v2: Importação GEAFIN com Modo TOTAL Perguntando Ação dos Ausentes (Sem Delete Físico)

## Resumo
1. Implementar fluxo de importação por sessão (`prévia -> confirmação -> aplicação`) com backup automático obrigatório antes de aplicar.
2. No modo `TOTAL`, o sistema sempre pergunta o que fazer com bens ausentes no escopo, com duas opções: `Manter` ou `Baixar`.
3. Proibir delete físico no processo de importação em qualquer cenário.
4. Encerrar com documentação completa (Wiki + status + log geral) e roteiro de deploy VPS.

## Especificação funcional (decision complete)
1. Modos de importação:
1. `INCREMENTAL` como padrão.
2. `TOTAL` com confirmação reforçada.
2. Escopo:
1. `GERAL` ou `UNIDADE` (uma unidade por execução).
3. Regra obrigatória do `TOTAL`:
1. Na etapa de aplicar, abrir confirmação com campo obrigatório `acaoAusentes`.
2. Valores permitidos: `MANTER` ou `BAIXAR`.
3. `MANTER`: não altera bens ausentes do escopo.
4. `BAIXAR`: altera ausentes do escopo para `status=BAIXADO`.
5. Nunca executar `DELETE` em `bens` ou `catalogo_bens` via importação.
4. Confirmações:
1. `INCREMENTAL`: aprovar/rejeitar item a item, com atalho em lote por filtro.
2. `TOTAL`: exige `adminPassword`, `confirmText=IMPORTACAO_TOTAL` e `acaoAusentes` obrigatório.
5. Cancelamento:
1. Cancelar em prévia: encerra sessão sem impacto operacional.
2. Cancelar em aplicação: rollback total da aplicação em curso.
6. Backup automático:
1. Executar snapshot `scope=all` antes de aplicar qualquer sessão.
2. Se backup falhar, bloquear aplicação.

## Mudanças em APIs/interfaces/tipos públicos
1. Novos endpoints:
1. `POST /importacoes/geafin/sessoes` (cria sessão/prévia).
2. `GET /importacoes/geafin/:id` (status da sessão).
3. `GET /importacoes/geafin/:id/acoes` (ações planejadas).
4. `POST /importacoes/geafin/:id/acoes/:acaoId/decisao` (aprovar/rejeitar item).
5. `POST /importacoes/geafin/:id/acoes/decisao-lote` (decisão em lote por filtro).
6. `POST /importacoes/geafin/:id/aplicar` (aplica sessão).
7. `POST /importacoes/geafin/:id/cancelar` (cancela sessão/aplicação).
2. Contrato de `aplicar`:
1. Campos comuns: `sessionId`, `adminPassword`.
2. Para `TOTAL`: `confirmText` e `acaoAusentes` obrigatórios.
3. Tipo público novo:
1. `acaoAusentes`: enum `MANTER | BAIXAR`.
4. Compatibilidade:
1. `POST /importar-geafin` permanece legado temporário.
2. Frontend principal migra para o fluxo por sessão.

## Mudanças de banco (migration)
1. Nova migration para sessão de importação:
1. Expandir `geafin_import_arquivos` com modo, escopo, etapa, cancelamento, backup e resumos.
2. Ajustar status para incluir `AGUARDANDO_CONFIRMACAO`, `APLICANDO`, `CANCELADO`, `CONCLUIDO`, `ERRO`.
3. Criar `geafin_import_acoes` para registrar ações e decisões por item.
2. Regra técnica explícita:
1. Sem comandos `DELETE` no pipeline operacional de importação.

## Implementação backend
1. Refatorar fluxo em serviços internos:
1. `buildPreviewSession`.
2. `applySession`.
3. `cancelSession`.
2. `applySession`:
1. Verificar backup automático antes de qualquer escrita operacional.
2. Rodar aplicação em transação única.
3. Checar flag de cancelamento em lotes e fazer `ROLLBACK` se cancelado.
3. Lógica `TOTAL`:
1. Calcular ausentes dentro do escopo.
2. Aplicar comportamento conforme `acaoAusentes`.
3. Registrar no resumo da sessão quantos ausentes foram mantidos/baixados.
4. Auditoria:
1. Persistir decisões por item e por lote.
2. Registrar requestId e operador em cada etapa.

## Implementação frontend
1. `ImportacoesPanel` em 3 passos:
1. Criar sessão (arquivo, modo, escopo).
2. Revisar ações (grade com aprovar/rejeitar + lote).
3. Aplicar/cancelar com progresso.
2. UI obrigatória no `TOTAL`:
1. Modal de confirmação com senha admin.
2. Campo `acaoAusentes` obrigatório com radio `Manter` ou `Baixar`.
3. Texto de confirmação forte.
3. UX de segurança:
1. Sem seleção padrão para `acaoAusentes` (usuário deve escolher explicitamente).
2. Exibir aviso fixo: “Importação não realiza exclusão física de bens/catálogos”.

## Casos de teste e cenários
1. `TOTAL + MANTER`: presentes atualizam, ausentes permanecem iguais.
2. `TOTAL + BAIXAR`: ausentes no escopo mudam para `BAIXADO`.
3. `TOTAL` sem `acaoAusentes`: erro 422.
4. `TOTAL` sem senha/confirmText: erro de validação.
5. `INCREMENTAL` com pendências: bloquear aplicar.
6. Cancelamento durante aplicação: rollback total.
7. Falha de backup pré-aplicação: bloqueio sem alterar operacional.
8. Prova de não-delete:
1. Teste automatizado garantindo que importação não reduz contagem por delete.
2. Verificação de logs SQL/queries do fluxo sem `DELETE`.
9. Regressão: endpoint legado continua funcionando.

## Documentação obrigatória
1. Atualizar `frontend/src/wiki/04_importacao_geafin.md` com novos modos, confirmação de ausentes e cancelamento/rollback.
2. Atualizar `docs/STATUS_ATUAL.md` com arquitetura de sessão e regra “sem delete físico”.
3. Registrar entrada em `docs/LOG_GERAL_ALTERACOES.md` com reversão sugerida.
4. Regenerar metadados wiki (`wikiMeta.generated.js` e `changeLog.generated.js`).

## Plano de deploy (pós-implementação)
1. Validar local:
1. `frontend npm run build`
2. `backend npm run check`
2. Commit e push:
1. Commit único da feature + docs.
2. `git push origin main`
3. Deploy VPS:
1. `cd /opt/cjm-patrimonio/current && ./scripts/vps_deploy.sh all`
2. Health checks `3001` e `8080/api/health`.
4. Smoke test em produção:
1. Criar sessão `TOTAL`.
2. Confirmar tela de pergunta `Manter/Baixar`.
3. Cancelar sessão de teste e validar ausência de impacto operacional.

## Assumptions e defaults
1. Opções de ausentes no `TOTAL` serão apenas `Manter` e `Baixar`.
2. Não haverá exclusão física no fluxo de importação, por regra permanente.
3. Escopo por unidade será uma unidade por execução.
4. Backup automático pré-aplicação é obrigatório e bloqueante.
5. Deploy só ocorre após documentação no mesmo ciclo (Wiki-First + Log Geral).
