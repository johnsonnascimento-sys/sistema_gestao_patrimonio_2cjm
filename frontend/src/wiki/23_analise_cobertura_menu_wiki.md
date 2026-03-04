<!--
Modulo: wiki
Arquivo: frontend/src/wiki/23_analise_cobertura_menu_wiki.md
Funcao no sistema: registrar analise faseada de cobertura entre menu real da aplica?o e paginas do Wiki para manter conformidade Wiki-First.
-->

# Analise de cobertura menu x wiki (faseada)

## Escopo da analise

- Referencia funcional: `frontend/src/App.jsx` (`NAV_STRUCTURE` e renderiza?o por `tab`).
- Referencia documental: `frontend/src/components/WikiManual.jsx` + paginas `frontend/src/wiki/*.md`.
- Objetivo: garantir alinhamento 1:1 entre navega?o real e documenta?o operacional.

## Fase 1 - Itens do menu e aderencia documental

| Grupo | Item de menu real | Componente/tela real | Pagina wiki principal | Status |
|---|---|---|---|---|
| Raiz | Dashboard | `DashboardPanel` | `19_dashboard.md` | OK |
| Opera?es Patrimoniais | Consulta de Bens | `AssetsExplorer` | `03_consulta_bens.md` | OK |
| Opera?es Patrimoniais | Movimenta?es | `Movimenta?esPanel` (`section=movimenta?es`) | `05_movimenta?es.md` | OK |
| Opera?es Patrimoniais | Cadastrar Bens por Sala | `Movimenta?esPanel` (`section=cadastro-sala`) | `05_movimenta?es.md` + `06_inventario_sala_a_sala.md` | OK |
| Opera?es Patrimoniais | Invent?rio - Contagem | `InventoryRoomPanel` | `06_inventario_sala_a_sala.md` | OK |
| Opera?es Patrimoniais | Invent?rio - Administra?o | `InventoryAdminPanel` | `22_inventario_administra?o.md` | OK |
| Opera?es Patrimoniais | Wizard Art. 141 | Painel do wizard em `App.jsx` + `ClassificationWizard` | `08_wizard_art141.md` | OK |
| Opera?es Patrimoniais | Material (SKU) | `Cat?logoAdminPanel` | `20_material_sku.md` | OK |
| Opera?es Patrimoniais | Gest?o de Normas | `NormsPage` | `21_gestao_normas.md` | OK |
| Opera?es Patrimoniais | Importa?o GEAFIN (CSV Latin1) | `Importa?esPanel` | `04_importa?o_geafin.md` | OK |
| Auditoria e Logs | Log Geral de Altera?es | `AuditoriaLogsPanel` (`auditoria-changelog`) | `09_relatorios_auditoria.md` | OK |
| Auditoria e Logs | Auditoria Patrimonial (Global) | `AuditoriaLogsPanel` (`auditoria-patrimonio`) | `09_relatorios_auditoria.md` | OK |
| Auditoria e Logs | Log de Erros Runtime | `AuditoriaLogsPanel` (`auditoria-erros`) | `09_relatorios_auditoria.md` + `10_solucao_problemas.md` | OK |
| Administra?o do Painel | Locais (salas) cadastrados | `OperationsPanel` (`admin-locais`) | `14_admin_opera?o_vps.md` + `06_inventario_sala_a_sala.md` | OK |
| Administra?o do Painel | Backup e Restore | `OperationsPanel` (`admin-backup`) | `14_admin_opera?o_vps.md` | OK |
| Administra?o do Painel | Conectividade Backend | `OperationsPanel` (`admin-health`) | `14_admin_opera?o_vps.md` + `10_solucao_problemas.md` | OK |
| Administra?o do Painel | Perfis e Acessos | `OperationsPanel` (`admin-perfis`) | `02_perfis_acesso.md` | OK |
| Raiz | Wiki / Manual | `WikiManual` | `00_indice.md` | OK |

## Fase 2 - Pagina por pagina (cobertura e papel)

| Pagina wiki | Papel principal | Menu relacionado |
|---|---|---|
| `00_indice.md` | indice oficial do manual | Wiki / Manual |
| `01_visao_geral.md` | visao macro de modulos e regras | transversal |
| `02_perfis_acesso.md` | fluxo de perfis, login e papeis | Administra?o do Painel -> Perfis e Acessos |
| `03_consulta_bens.md` | opera?o da consulta e modal de detalhes | Opera?es Patrimoniais -> Consulta de Bens |
| `04_importa?o_geafin.md` | importa?o GEAFIN por sessao | Opera?es Patrimoniais -> Importa?o GEAFIN |
| `05_movimenta?es.md` | transferencia, cautela e cadastro por sala | Opera?es Patrimoniais -> Movimenta?es / Cadastrar Bens por Sala |
| `06_inventario_sala_a_sala.md` | contagem operacional e progresso por sala | Opera?es Patrimoniais -> Invent?rio - Contagem |
| `07_intrusos_bens_de_terceiros.md` | conceito de intruso, terceiro e sem placa | Invent?rio - Contagem / Invent?rio - Administra?o |
| `08_wizard_art141.md` | classifica?o de inserviveis Art. 141 | Opera?es Patrimoniais -> Wizard Art. 141 |
| `09_relatorios_auditoria.md` | trilhas de auditoria e logs | Auditoria e Logs |
| `10_solucao_problemas.md` | FAQ operacional e de runtime | transversal |
| `11_glossario.md` | definicoes operacionais | transversal |
| `12_politica_seguranca.md` | boas praticas de sigilo e incidentes | transversal |
| `13_compliance_atn303.md` | resumo de regras legais implementadas | transversal |
| `14_admin_opera?o_vps.md` | opera?o da VPS, deploy, backup e restore | Administra?o do Painel |
| `15_referencia_api.md` | contratos de API de apoio operacional | transversal tecnico |
| `16_matriz_compliance.md` | matriz artigo -> implementa?o -> evidencia | transversal compliance |
| `17_regulariza?o_pos_inventario.md` | fluxo de regulariza?o pos-inventario | Invent?rio - Administra?o (secao Regulariza?o) |
| `18_checklist_migra?es.md` | sequencia e valida?o de migra?es SQL | transversal tecnico |
| `19_dashboard.md` | tela inicial e atalho operacional | Dashboard |
| `20_material_sku.md` | cat?logo de materiais e associa?o de bens | Opera?es Patrimoniais -> Material (SKU) |
| `21_gestao_normas.md` | acervo normativo e governanca | Opera?es Patrimoniais -> Gest?o de Normas |
| `22_inventario_administra?o.md` | governanca de eventos/ciclos de inventario | Opera?es Patrimoniais -> Invent?rio - Administra?o |
| `23_analise_cobertura_menu_wiki.md` | rastreabilidade da aderencia menu x wiki | Wiki / Manual |

## Fase 3 - Ajustes aplicados neste ciclo

- Inclusao explicita de caminho de menu nas paginas operacionais que n?o tinham a secao.
- Correcao de referencia antiga no FAQ (retirada da mencao "Opera?es API").
- Correcao de caminho da regulariza?o: agora documentada como secao interna de `Invent?rio - Administra?o`.
- Inclusao desta pagina para auditoria recorrente de cobertura.

## Resultado esperado

- Toda opcao navegavel do menu principal possui pagina wiki correspondente.
- Toda pagina wiki possui papel claro e vinculo com menu ou escopo transversal.
- Diverg?ncias futuras ficam mais simples de detectar no processo Wiki-First.

## Fase 4 - Atualiza?o RBAC (menu + aprova?es)

Atualiza?es aplicadas neste ciclo:

- Novo item de menu em `Administra?o do Painel`: **Aprova?es Pendentes** (`OperationsPanel` -> `Aprova?esPanel`).
- Navega?o principal passou a ser filtrada por permissao (`GET /auth/acl`, `menuPermissions`).
- Aderencia documental adicionada para os fluxos de aprova?o em:
  - `02_perfis_acesso.md`
  - `05_movimenta?es.md`
  - `10_solucao_problemas.md`
  - `15_referencia_api.md`
