<!--
Modulo: wiki
Arquivo: frontend/src/wiki/23_analise_cobertura_menu_wiki.md
Funcao no sistema: registrar a cobertura entre navegação real e páginas da wiki.
-->

# Análise de cobertura menu x wiki

## Escopo da análise

- referência funcional: `frontend/src/App.jsx`
- referência documental: `frontend/src/components/WikiManual.jsx` e `frontend/src/wiki/*.md`
- objetivo: manter aderência **Wiki-First**

## Cobertura por item de menu

| Grupo | Item de menu real | Componente/tela real | Página wiki principal | Status |
|---|---|---|---|---|
| Raiz | Dashboard | `DashboardPanel` | `19_dashboard.md` | OK |
| Operação diária | Consulta de Bens | `AssetsExplorer` | `03_consulta_bens.md` | OK |
| Operação diária | Movimentações | `MovimentacoesPanel` | `05_movimentacoes.md` | OK |
| Operação diária | Cadastrar bens por Endereço | `MovimentacoesPanel` (`section=cadastro-sala`) | `05_movimentacoes.md` | OK |
| Operação diária | Inventário - Contagem | `InventoryRoomPanel` | `06_inventario_sala_a_sala.md` | OK |
| Operação diária | Inventário - Administração | `InventoryAdminPanel` | `22_inventario_administracao.md` | OK |
| Operação diária | Material Inservível / Baixa | `MaterialInservivelBaixaPanel` | `08_wizard_art141.md` | OK |
| Operação diária | Material (SKU) | `CatalogoAdminPanel` | `20_material_sku.md` | OK |
| Operação diária | Classificação SIAFI | `ClassificacaoSiafiPanel` | `24_classificacao_siafi.md` | OK |
| Operação diária | Importação GEAFIN (CSV Latin1) | `ImportacoesPanel` | `04_importacao_geafin.md` | OK |
| Auditoria e Logs | Log Geral de Alterações | `AuditoriaLogsPanel` | `09_relatorios_auditoria.md` | OK |
| Auditoria e Logs | Auditoria Patrimonial (Global) | `AuditoriaLogsPanel` | `09_relatorios_auditoria.md` | OK |
| Auditoria e Logs | Log de Erros Runtime | `AuditoriaLogsPanel` | `09_relatorios_auditoria.md` + `10_solucao_problemas.md` | OK |
| Administração do Painel | Locais (endereços) cadastrados | `OperationsPanel` | `14_admin_operacao_vps.md` | OK |
| Administração do Painel | Backup e Restore | `OperationsPanel` | `14_admin_operacao_vps.md` | OK |
| Administração do Painel | Conectividade Backend | `OperationsPanel` | `14_admin_operacao_vps.md` | OK |
| Administração do Painel | Perfis e Acessos | `OperationsPanel` | `02_perfis_acesso.md` | OK |
| Administração do Painel | Aprovações Pendentes | `OperationsPanel` | `02_perfis_acesso.md` + `15_referencia_api.md` | OK |
| Referência e apoio | Wiki / Manual do Sistema | `WikiManual` | `00_indice.md` | OK |
| Referência e apoio | Normas | `NormsPage` | `21_gestao_normas.md` | OK |

## Observações desta entrega

- a antiga tela "Wizard Art. 141" foi substituída por **Material Inservível / Baixa**;
- o arquivo wiki principal permaneceu em `08_wizard_art141.md` por compatibilidade de histórico, mas o conteúdo e o título da página foram atualizados;
- o `tab id` técnico continua `classificacao`, preservando navegação, RBAC e links internos.

## Resultado esperado

- toda tela navegável do menu principal possui página wiki correspondente;
- toda mudança de UX, endpoint ou regra legal desta workspace agora está refletida no manual;
- desvios futuros podem ser auditados comparando `App.jsx`, `WikiManual.jsx` e esta página.
