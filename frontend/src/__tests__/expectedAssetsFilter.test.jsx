/**
 * Modulo: frontend/tests
 * Arquivo: expectedAssetsFilter.test.jsx
 * Funcao no sistema: validar filtros dos bens esperados do endereco.
 */
import { describe, expect, it } from "vitest";

import { filterExpectedAssetGroups } from "../components/inventory/expectedAssetsFilter.js";

describe("filterExpectedAssetGroups", () => {
  const grouped = [
    {
      codigoCatalogo: "SKU-1",
      items: [
        { numeroTombamento: "1290001788" },
        { numeroTombamento: "1290001789" },
      ],
    },
    {
      codigoCatalogo: "SKU-2",
      items: [{ numeroTombamento: "1290001790" }],
    },
  ];

  const getConferenciaMeta = (item) => ({
    encontrado: item.numeroTombamento !== "1290001789",
  });

  it("retorna todos os grupos quando filtro e ALL", () => {
    expect(filterExpectedAssetGroups(grouped, "ALL", getConferenciaMeta)).toEqual(grouped);
  });

  it("mantem somente itens encontrados quando filtro e FOUND", () => {
    expect(filterExpectedAssetGroups(grouped, "FOUND", getConferenciaMeta)).toEqual([
      {
        codigoCatalogo: "SKU-1",
        items: [{ numeroTombamento: "1290001788" }],
      },
      {
        codigoCatalogo: "SKU-2",
        items: [{ numeroTombamento: "1290001790" }],
      },
    ]);
  });

  it("mantem somente itens faltantes quando filtro e MISSING", () => {
    expect(filterExpectedAssetGroups(grouped, "MISSING", getConferenciaMeta)).toEqual([
      {
        codigoCatalogo: "SKU-1",
        items: [{ numeroTombamento: "1290001789" }],
      },
    ]);
  });
});
