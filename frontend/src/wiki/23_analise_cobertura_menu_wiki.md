<!--
Modulo: wiki
Arquivo: frontend/src/wiki/23_analise_cobertura_menu_wiki.md
Funcao no sistema: registrar analise faseada de cobertura entre menu real da aplicação e paginas do Wiki para manter conformidade Wiki-First.
-->

# Analise de cobertura menu x wiki (faseada)

## Escopo da analise

- Referencia funcional: `frontend/src/App.jsx` (`NAV_STRUCTURE` e renderização por `tab`).
- Referencia documental: `frontend/src/components/WikiManual.jsx` + paginas `frontend/src/wiki/*.md`.
- Objetivo: garantir alinhamento 1:1 entre navegação real e documentação operacional.

## Fase 1 - Itens do menu e aderencia documental

| Grupo | Item de menu real | Componente/tela real | Pagina wiki principal | Status |
|---|---|---|---|---|
| Raiz | Dashboard | `DashboardPanel` | `19_dashboard.md` | OK |
| Operações Patrimoniais | Consulta de Bens | `AssetsExplorer` | `03_consulta_bens.md` | OK |
| Operações Patrimoniais | Movimentações | `MovimentacoesPanel` (`section=movimentações`) | `05_movimentacoes.md` | OK |
| Operações Patrimoniais | Cadastrar Bens por endereço | `MovimentacoesPanel` (`section=cadastro-endereço`) | `05_movimentacoes.md` + `06_inventario_endereço_a_endereço.md` | OK |
| Operações Patrimoniais | Inventário - Contagem | `InventoryRoomPanel` | `06_inventario_endereço_a_endereço.md` | OK |
| Operações Patrimoniais | Inventário - Administração | `InventoryAdminPanel` | `22_inventario_administracao.md` | OK |
| Operações Patrimoniais | Wizard Art. 141 | Painel do wizard em `App.jsx` + `ClassificationWizard` | `08_wizard_art141.md` | OK |
| Operações Patrimoniais | Material (SKU) | `CatálogoAdminPanel` | `20_material_sku.md` | OK |
| Raiz | Normas | `NormsPage` | `21_gestao_normas.md` | OK |
| Operações Patrimoniais | Importação GEAFIN (CSV Latin1) | `ImportacoesPanel` | `04_importacao_geafin.md` | OK |
| Auditoria e Logs | Log Geral de Alterações | `AuditoriaLogsPanel` (`auditoria-changelog`) | `09_relatorios_auditoria.md` | OK |
| Auditoria e Logs | Auditoria Patrimonial (Global) | `AuditoriaLogsPanel` (`auditoria-patrimonio`) | `09_relatorios_auditoria.md` | OK |
| Auditoria e Logs | Log de Erros Runtime | `AuditoriaLogsPanel` (`auditoria-erros`) | `09_relatorios_auditoria.md` + `10_solucao_problemas.md` | OK |
| Administração do Painel | Locais (endereços) cadastrados | `OperationsPanel` (`admin-locais`) | `14_admin_operacao_vps.md` + `06_inventario_endereço_a_endereço.md` | OK |
| Administração do Painel | Backup e Restore | `OperationsPanel` (`admin-backup`) | `14_admin_operacao_vps.md` | OK |
| Administração do Painel | Conectividade Backend | `OperationsPanel` (`admin-health`) | `14_admin_operacao_vps.md` + `10_solucao_problemas.md` | OK |
| Administração do Painel | Perfis e Acessos | `OperationsPanel` (`admin-perfis`) | `02_perfis_acesso.md` | OK |
| Raiz | Wiki / Manual do Sistema | `WikiManual` | `00_indice.md` | OK |

## Fase 2 - Pagina por pagina (cobertura e papel)

| Pagina wiki | Papel principal | Menu relacionado |
|---|---|---|
| `00_indice.md` | indice oficial do manual | Wiki / Manual do Sistema |
| `01_visao_geral.md` | visao macro de modulos e regras | transversal |
| `02_perfis_acesso.md` | fluxo de perfis, login e papeis | Administração do Painel -> Perfis e Acessos |
| `03_consulta_bens.md` | operação da consulta e modal de detalhes | Operações Patrimoniais -> Consulta de Bens |
| `04_importacao_geafin.md` | importação GEAFIN por sessao | Operações Patrimoniais -> Importação GEAFIN |
| `05_movimentacoes.md` | transferencia, cautela e cadastro por endereço | Operações Patrimoniais -> Movimentações / Cadastrar Bens por endereço |
| `06_inventario_endereço_a_endereço.md` | contagem operacional e progresso por endereço | Operações Patrimoniais -> Inventário - Contagem |
| `07_intrusos_bens_de_terceiros.md` | conceito de intruso, terceiro e sem placa | Inventário - Contagem / Inventário - Administração |
| `08_wizard_art141.md` | classificação de inserviveis Art. 141 | Operações Patrimoniais -> Wizard Art. 141 |
| `09_relatorios_auditoria.md` | trilhas de auditoria e logs | Auditoria e Logs |
| `10_solucao_problemas.md` | FAQ operacional e de runtime | transversal |
| `11_glossario.md` | definicoes operacionais | transversal |
| `12_politica_seguranca.md` | boas praticas de sigilo e incidentes | transversal |
| `13_compliance_atn303.md` | resumo de regras legais implementadas | transversal |
| `14_admin_operacao_vps.md` | operação da VPS, deploy, backup e restore | Administração do Painel |
| `15_referencia_api.md` | contratos de API de apoio operacional | transversal tecnico |
| `16_matriz_compliance.md` | matriz artigo -> implementação -> evidencia | transversal compliance |
| `17_regularizacao_pos_inventario.md` | fluxo de regularização pos-inventario | Inventário - Administração (seção Regularização) |
| `18_checklist_migracoes.md` | sequencia e validação de migrações SQL | transversal tecnico |
| `19_dashboard.md` | tela inicial e atalho operacional | Dashboard |
| `20_material_sku.md` | catálogo de materiais e associação de bens | Operações Patrimoniais -> Material (SKU) |
| `21_gestao_normas.md` | acervo normativo e governanca | Normas |
| `22_inventario_administracao.md` | governanca de eventos/ciclos de inventario | Operações Patrimoniais -> Inventário - Administração |
| `23_analise_cobertura_menu_wiki.md` | rastreabilidade da aderencia menu x wiki | Wiki / Manual do Sistema |

## Fase 3 - Ajustes aplicados neste ciclo

- Inclusao explicita de caminho de menu nas paginas operacionais que não tinham a seção.
- Correcao de referencia antiga no FAQ (retirada da menção "Operações API").
- Correcao de caminho da regularização: agora documentada como seção interna de `Inventário - Administração`.
- Inclusao desta pagina para auditoria recorrente de cobertura.

## Resultado esperado

- Toda opcao navegavel do menu principal possui pagina wiki correspondente.
- Toda pagina wiki possui papel claro e vinculo com menu ou escopo transversal.
- Divergências futuras ficam mais simples de detectar no processo Wiki-First.

## Fase 4 - Atualização RBAC (menu + aprovações)

Atualizações aplicadas neste ciclo:

- Novo item de menu em `Administração do Painel`: **Aprovações Pendentes** (`OperationsPanel` -> `AprovaçõesPanel`).
- Navegação principal passou a ser filtrada por permissao (`GET /auth/acl`, `menuPermissions`).
- Aderencia documental adicionada para os fluxos de aprovação em:
  - `02_perfis_acesso.md`
  - `05_movimentacoes.md`
  - `10_solucao_problemas.md`
  - `15_referencia_api.md`


