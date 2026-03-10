/**
 * Modulo: frontend/components/inventory
 * Arquivo: InventoryAdminUtils.js
 * Funcao no sistema: concentrar helpers puros do cockpit administrativo do inventario para reduzir acoplamento do painel raiz.
 */
export function formatUnidade(id) {
  if (id === 1) return "1 (1a Aud)";
  if (id === 2) return "2 (2a Aud)";
  if (id === 3) return "3 (Foro)";
  if (id === 4) return "4 (Almox)";
  return String(id || "");
}

export function formatPerfilOption(perfil) {
  const matricula = String(perfil?.matricula || "-");
  const nome = String(perfil?.nome || "-");
  const unidade = perfil?.unidadeId != null ? String(perfil.unidadeId) : "-";
  return `${matricula} - ${nome} (unid. ${unidade})`;
}

export function generateCodigoEvento(unidadeInventariadaId) {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const u = Number(unidadeInventariadaId);
  const suffix = u === 1 ? "1AUD" : u === 2 ? "2AUD" : u === 3 ? "FORO" : u === 4 ? "ALMOX" : "GERAL";
  return `INV_${yyyy}_${mm}_${dd}_${hh}${min}_${suffix}`;
}

export function formatDateTimeShort(value) {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return "-";
  try {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(d);
  } catch {
    return d.toISOString();
  }
}

export function formatPercent(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0%";
  return `${num.toFixed(num % 1 === 0 ? 0 : 2)}%`;
}

export function toIsoDateInput(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function shiftDays(date, deltaDays) {
  const d = new Date(date);
  d.setDate(d.getDate() + deltaDays);
  return d;
}

export function calcTrend(points, field) {
  const list = Array.isArray(points) ? points : [];
  if (list.length < 2) return null;
  const last = Number(list[list.length - 1]?.[field] || 0);
  const prev = Number(list[list.length - 2]?.[field] || 0);
  if (!Number.isFinite(last) || !Number.isFinite(prev)) return null;
  return Number((last - prev).toFixed(2));
}
