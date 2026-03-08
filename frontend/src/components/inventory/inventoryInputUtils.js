/**
 * Modulo: frontend/components/inventory
 * Arquivo: inventoryInputUtils.js
 * Funcao no sistema: reunir normalizacoes reutilizaveis do fluxo de leitura do inventario.
 */

export function normalizeTombamentoInput(raw) {
  if (raw == null) return "";
  const cleaned = String(raw).trim().replace(/^\"+|\"+$/g, "").replace(/\D+/g, "");
  return cleaned.slice(0, 10);
}
