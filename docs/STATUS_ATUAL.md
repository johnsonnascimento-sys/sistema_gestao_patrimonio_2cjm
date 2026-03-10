# Status Atual do Projeto (Runtime Ativo)

## Cabecalho

| Campo | Valor |
|---|---|
| Modulo | `docs` |
| Arquivo | `docs/STATUS_ATUAL.md` |
| Funcao no sistema | registro canonico do estado implementado do sistema, gaps e alinhamento de governanca |
| Data | 2026-03-10 |
| Versao | v1.4 |
| Fonte de verdade | `PROJECT_RULES.md` |

## 1. Resumo executivo

- Sistema de Gestão Patrimonial da 2ª CJM com runtime ativo em backend e frontend.
- Compliance operacional consolidado para inventário, movimentações, bens de terceiros e, agora, **Material Inservível / Baixa**.
- Execução determinística, auditável e com documentação Wiki-First atualizada no mesmo ciclo.

## 2. Mudança principal desta entrega

A antiga aba "Wizard Art. 141" foi substituída pela workspace **Material Inservível / Baixa**, preservando:

- `tab id` técnico `classificacao`
- permissão de menu `menu.classificacao.view`

Novas capacidades entregues:

- triagem guiada de inservível com histórico;
- fila de marcações atuais;
- processos de baixa patrimonial;
- modalidades `VENDA`, `CESSÃO`, `DOAÇÃO`, `PERMUTA`, `INUTILIZAÇÃO`, `ABANDONO` e `DESAPARECIMENTO`;
- efetivação da baixa no sistema com `status = BAIXADO`.

## 3. Banco de dados

Migrações relevantes no repositório:

- `010_inserviveis_wizard_persistencia.sql`
- `013_documentos_avaliacoes_inserviveis.sql`
- `022_rbac_roles_permissions.sql`
- `023_material_inservivel_baixa.sql`

Estruturas novas ou expandidas:

- `marcacoes_inserviveis`
- `baixas_patrimoniais`
- `baixas_patrimoniais_itens`
- `bens.motivo_baixa_patrimonial`
- `bens.baixado_em`
- `documentos.baixa_patrimonial_id`

## 4. Backend

Arquivo principal:

- `backend/server.js`

Serviço de regras:

- `backend/src/services/materialInservivelBaixa.js`

Rotas novas:

- `GET /inserviveis/marcacoes`
- `POST /inserviveis/marcacoes`
- `PATCH /inserviveis/marcacoes/:id`
- `GET /baixas-patrimoniais`
- `GET /baixas-patrimoniais/:id`
- `POST /baixas-patrimoniais`
- `PATCH /baixas-patrimoniais/:id`
- `POST /baixas-patrimoniais/:id/concluir`
- `POST /baixas-patrimoniais/:id/cancelar`

Rotas ampliadas:

- `POST /inserviveis/avaliacoes`
- `GET /bens/:id`
- `GET /documentos`
- `POST /documentos`

Autorização:

- `action.inservivel.marcar.request`
- `action.inservivel.marcar.execute`
- `action.baixa.request`
- `action.baixa.execute`

## 5. Frontend

Componentes principais da nova workspace:

- `frontend/src/components/MaterialInservivelBaixaPanel.jsx`
- `frontend/src/components/InservivelAssessmentWizard.jsx`
- `frontend/src/components/InservivelQueueTable.jsx`
- `frontend/src/components/BaixaProcessDrawer.jsx`
- `frontend/src/components/BaixaProcessesList.jsx`

Integração:

- `frontend/src/App.jsx` renderiza a nova workspace na aba `classificacao`
- `frontend/src/services/apiClient.js` possui os clientes das novas rotas

## 6. Testes e validações já cobertos

Backend:

- recuperável aceito até 50% e rejeitado acima disso;
- venda bloqueada sem avaliação prévia/licitação;
- doação bloqueada com destinatário incompatível;
- inutilização e abandono com obrigatoriedades próprias;
- desaparecimento permitido sem avaliação de inservível.

Frontend:

- stepper de classificação;
- fila de marcações;
- criação de rascunho de baixa a partir da seleção;
- bloqueio de ação quando o perfil não possui permissão adequada.

## 7. Situação de compliance

Implementado:

- Arts. 141 a 152
- Arts. 153 a 157
- Art. 183
- Art. 185
- Arts. 124 e 127

Limites atuais:

- sem integração automática com GEAFIN, SEI, SIAFI ou n8n para o fluxo de baixa;
- fluxos de apuração formal dos Arts. 158 a 168 continuam pendentes.

## 8. Próximos passos recomendados

1. Integrar geração documental automática por n8n, mantendo validação determinística no backend.
2. Expandir testes de integração end-to-end para o processo completo de baixa em lote.
3. Avaliar fluxo formal dos Arts. 158 a 168 para apuração de fatos e desaparecimento com sindicância.
