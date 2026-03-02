<!--
Modulo: wiki
Arquivo: frontend/src/wiki/23_analise_cobertura_menu_wiki.md
Funcao no sistema: registrar analise faseada de cobertura entre menu real da aplicacao e paginas do Wiki para manter conformidade Wiki-First.
-->

# Analise de cobertura menu x wiki (faseada)

## Escopo da analise

- Referencia funcional: `frontend/src/App.jsx` (`NAV_STRUCTURE` e renderizacao por `tab`).
- Referencia documental: `frontend/src/components/WikiManual.jsx` + paginas `frontend/src/wiki/*.md`.
- Objetivo: garantir alinhamento 1:1 entre navegacao real e documentacao operacional.

## Fase 1 - Itens do menu e aderencia documental

| Grupo | Item de menu real | Componente/tela real | Pagina wiki principal | Status |
|---|---|---|---|---|
| Raiz | Dashboard | `DashboardPanel` | `19_dashboard.md` | OK |
| Operacoes Patrimoniais | Consulta de Bens | `AssetsExplorer` | `03_consulta_bens.md` | OK |
| Operacoes Patrimoniais | Movimentacoes | `MovimentacoesPanel` (`section=movimentacoes`) | `05_movimentacoes.md` | OK |
| Operacoes Patrimoniais | Cadastrar Bens por Sala | `MovimentacoesPanel` (`section=cadastro-sala`) | `05_movimentacoes.md` + `06_inventario_sala_a_sala.md` | OK |
| Operacoes Patrimoniais | Inventario - Contagem | `InventoryRoomPanel` | `06_inventario_sala_a_sala.md` | OK |
| Operacoes Patrimoniais | Inventario - Administracao | `InventoryAdminPanel` | `22_inventario_administracao.md` | OK |
| Operacoes Patrimoniais | Wizard Art. 141 | Painel do wizard em `App.jsx` + `ClassificationWizard` | `08_wizard_art141.md` | OK |
| Operacoes Patrimoniais | Material (SKU) | `CatalogoAdminPanel` | `20_material_sku.md` | OK |
| Operacoes Patrimoniais | Gestao de Normas | `NormsPage` | `21_gestao_normas.md` | OK |
| Operacoes Patrimoniais | Importacao GEAFIN (CSV Latin1) | `ImportacoesPanel` | `04_importacao_geafin.md` | OK |
| Auditoria e Logs | Log Geral de Alteracoes | `AuditoriaLogsPanel` (`auditoria-changelog`) | `09_relatorios_auditoria.md` | OK |
| Auditoria e Logs | Auditoria Patrimonial (Global) | `AuditoriaLogsPanel` (`auditoria-patrimonio`) | `09_relatorios_auditoria.md` | OK |
| Auditoria e Logs | Log de Erros Runtime | `AuditoriaLogsPanel` (`auditoria-erros`) | `09_relatorios_auditoria.md` + `10_solucao_problemas.md` | OK |
| Administracao do Painel | Locais (salas) cadastrados | `OperationsPanel` (`admin-locais`) | `14_admin_operacao_vps.md` + `06_inventario_sala_a_sala.md` | OK |
| Administracao do Painel | Backup e Restore | `OperationsPanel` (`admin-backup`) | `14_admin_operacao_vps.md` | OK |
| Administracao do Painel | Conectividade Backend | `OperationsPanel` (`admin-health`) | `14_admin_operacao_vps.md` + `10_solucao_problemas.md` | OK |
| Administracao do Painel | Perfis e Acessos | `OperationsPanel` (`admin-perfis`) | `02_perfis_acesso.md` | OK |
| Raiz | Wiki / Manual | `WikiManual` | `00_indice.md` | OK |

## Fase 2 - Pagina por pagina (cobertura e papel)

| Pagina wiki | Papel principal | Menu relacionado |
|---|---|---|
| `00_indice.md` | indice oficial do manual | Wiki / Manual |
| `01_visao_geral.md` | visao macro de modulos e regras | transversal |
| `02_perfis_acesso.md` | fluxo de perfis, login e papeis | Administracao do Painel -> Perfis e Acessos |
| `03_consulta_bens.md` | operacao da consulta e modal de detalhes | Operacoes Patrimoniais -> Consulta de Bens |
| `04_importacao_geafin.md` | importacao GEAFIN por sessao | Operacoes Patrimoniais -> Importacao GEAFIN |
| `05_movimentacoes.md` | transferencia, cautela e cadastro por sala | Operacoes Patrimoniais -> Movimentacoes / Cadastrar Bens por Sala |
| `06_inventario_sala_a_sala.md` | contagem operacional e progresso por sala | Operacoes Patrimoniais -> Inventario - Contagem |
| `07_intrusos_bens_de_terceiros.md` | conceito de intruso, terceiro e sem placa | Inventario - Contagem / Inventario - Administracao |
| `08_wizard_art141.md` | classificacao de inserviveis Art. 141 | Operacoes Patrimoniais -> Wizard Art. 141 |
| `09_relatorios_auditoria.md` | trilhas de auditoria e logs | Auditoria e Logs |
| `10_solucao_problemas.md` | FAQ operacional e de runtime | transversal |
| `11_glossario.md` | definicoes operacionais | transversal |
| `12_politica_seguranca.md` | boas praticas de sigilo e incidentes | transversal |
| `13_compliance_atn303.md` | resumo de regras legais implementadas | transversal |
| `14_admin_operacao_vps.md` | operacao da VPS, deploy, backup e restore | Administracao do Painel |
| `15_referencia_api.md` | contratos de API de apoio operacional | transversal tecnico |
| `16_matriz_compliance.md` | matriz artigo -> implementacao -> evidencia | transversal compliance |
| `17_regularizacao_pos_inventario.md` | fluxo de regularizacao pos-inventario | Inventario - Administracao (secao Regularizacao) |
| `18_checklist_migracoes.md` | sequencia e validacao de migracoes SQL | transversal tecnico |
| `19_dashboard.md` | tela inicial e atalho operacional | Dashboard |
| `20_material_sku.md` | catalogo de materiais e associacao de bens | Operacoes Patrimoniais -> Material (SKU) |
| `21_gestao_normas.md` | acervo normativo e governanca | Operacoes Patrimoniais -> Gestao de Normas |
| `22_inventario_administracao.md` | governanca de eventos/ciclos de inventario | Operacoes Patrimoniais -> Inventario - Administracao |
| `23_analise_cobertura_menu_wiki.md` | rastreabilidade da aderencia menu x wiki | Wiki / Manual |

## Fase 3 - Ajustes aplicados neste ciclo

- Inclusao explicita de caminho de menu nas paginas operacionais que nao tinham a secao.
- Correcao de referencia antiga no FAQ (retirada da mencao "Operacoes API").
- Correcao de caminho da regularizacao: agora documentada como secao interna de `Inventario - Administracao`.
- Inclusao desta pagina para auditoria recorrente de cobertura.

## Resultado esperado

- Toda opcao navegavel do menu principal possui pagina wiki correspondente.
- Toda pagina wiki possui papel claro e vinculo com menu ou escopo transversal.
- Divergencias futuras ficam mais simples de detectar no processo Wiki-First.
