/**
 * Modulo: frontend/components/inventory
 * Arquivo: expectedAssetsFilter.js
 * Funcao no sistema: aplicar filtro operacional nos bens esperados do endereco.
 */

export function filterExpectedAssetGroups(grouped, expectedAssetsFilter, getConferenciaMeta) {
  if (!Array.isArray(grouped)) return [];
  if (expectedAssetsFilter === "ALL") return grouped;
  if (typeof getConferenciaMeta !== "function") return grouped;

  return grouped
    .map((group) => {
      const items = Array.isArray(group?.items) ? group.items : [];
      const filteredItems = items.filter((item) => {
        const meta = getConferenciaMeta(item) || {};
        if (expectedAssetsFilter === "FOUND") return Boolean(meta.encontrado);
        if (expectedAssetsFilter === "MISSING") return !meta.encontrado;
        return true;
      });
      return filteredItems.length ? { ...group, items: filteredItems } : null;
    })
    .filter(Boolean);
}
