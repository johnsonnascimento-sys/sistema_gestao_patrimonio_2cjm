/**
 * Modulo: frontend/components/inventory
 * Arquivo: InventoryAdminSections.js
 * Funcao no sistema: centralizar os metadados dos submenus de Inventario - Administracao.
 */
export const INVENTORY_ADMIN_SECTIONS = Object.freeze([
  {
    key: "administracao",
    tabId: "inventario-admin",
    label: "Inventário - Administração",
    short: "Inv. Admin",
    localLabel: "Administração",
    title: "Inventário - Administração",
    description: "Gestão do evento ativo, abertura de ciclos e ações críticas do inventário.",
  },
  {
    key: "monitoramento",
    tabId: "inventario-admin-monitoramento",
    label: "Inventário - Monitoramento",
    short: "Monitor.",
    localLabel: "Monitoramento",
    title: "Inventário - Monitoramento",
    description: "Bens não contados, contagem em tempo real e divergências interunidades.",
  },
  {
    key: "acuracidade",
    tabId: "inventario-admin-acuracidade",
    label: "Inventário - Acuracidade",
    short: "Acurac.",
    localLabel: "Acuracidade",
    title: "Inventário - Acuracidade",
    description: "Indicadores gerenciais, histórico resumido e leitura analítica do inventário.",
  },
  {
    key: "regularizacao",
    tabId: "inventario-admin-regularizacao",
    label: "Inventário - Regularização",
    short: "Regular.",
    localLabel: "Regularização",
    title: "Inventário - Regularização",
    description: "Tratamento pós-inventário das divergências com fluxo formal de regularização.",
  },
]);

export const INVENTORY_ADMIN_TAB_IDS = Object.freeze(
  INVENTORY_ADMIN_SECTIONS.map((section) => section.tabId),
);

export function getInventoryAdminSectionByTab(tabId) {
  return INVENTORY_ADMIN_SECTIONS.find((section) => section.tabId === tabId) || INVENTORY_ADMIN_SECTIONS[0];
}

export function getInventoryAdminSectionByKey(sectionKey) {
  return INVENTORY_ADMIN_SECTIONS.find((section) => section.key === sectionKey) || INVENTORY_ADMIN_SECTIONS[0];
}
