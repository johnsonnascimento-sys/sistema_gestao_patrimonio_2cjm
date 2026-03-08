/**
 * Modulo: frontend/tests
 * Arquivo: inventoryInputUtils.test.jsx
 * Funcao no sistema: validar normalizacao de entrada do scanner de inventario.
 */
import { describe, expect, it } from "vitest";

import { normalizeTombamentoInput } from "../components/inventory/inventoryInputUtils.js";

describe("normalizeTombamentoInput", () => {
  it("mantem tombamento valido de 10 digitos", () => {
    expect(normalizeTombamentoInput("1290001788")).toBe("1290001788");
  });

  it("normaliza etiqueta de 4 digitos sem perder o valor", () => {
    expect(normalizeTombamentoInput(" 1260 ")).toBe("1260");
  });

  it("remove aspas e caracteres invisiveis do scanner", () => {
    expect(normalizeTombamentoInput("\"1290-001788\r\n\"")).toBe("1290001788");
  });

  it("limita a entrada a 10 digitos", () => {
    expect(normalizeTombamentoInput("12900017889999")).toBe("1290001788");
  });
});
