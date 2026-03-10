import { describe, expect, it, vi } from "vitest";
import {
  calcTrend,
  formatPercent,
  formatUnidade,
  generateCodigoEvento,
  toIsoDateInput,
} from "../components/inventory/InventoryAdminUtils.js";

describe("InventoryAdminUtils", () => {
  it("formata unidade institucional", () => {
    expect(formatUnidade(3)).toBe("3 (Foro)");
    expect(formatUnidade("")).toBe("");
  });

  it("formata percentuais com precisao operacional", () => {
    expect(formatPercent(97)).toBe("97%");
    expect(formatPercent(97.325)).toBe("97.33%");
    expect(formatPercent(null)).toBe("0%");
  });

  it("gera codigo de evento com sufixo da unidade", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-09T10:45:00Z"));
    expect(generateCodigoEvento(3)).toMatch(/^INV_2026_03_09_(0745|1045)_FORO$/);
    vi.useRealTimers();
  });

  it("normaliza datas para input date", () => {
    expect(toIsoDateInput("2026-03-09T22:15:00Z")).toBe("2026-03-09");
  });

  it("calcula tendencia entre dois pontos", () => {
    expect(calcTrend([{ taxa: 10 }, { taxa: 12.35 }], "taxa")).toBe(2.35);
    expect(calcTrend([{ taxa: 10 }], "taxa")).toBeNull();
  });
});
