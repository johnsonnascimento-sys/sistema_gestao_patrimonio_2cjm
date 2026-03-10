/**
 * Modulo: frontend/tests
 * Arquivo: InventoryAdminSectionTabs.test.jsx
 * Funcao no sistema: validar a navegacao local entre os submenus de Inventario - Administracao.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import InventoryAdminSectionTabs from "../components/inventory/InventoryAdminSectionTabs.jsx";

describe("InventoryAdminSectionTabs", () => {
  it("renderiza os quatro submenus e aciona callback ao trocar de secao", async () => {
    const onSelectSection = vi.fn();

    render(
      <InventoryAdminSectionTabs
        currentSectionKey="administracao"
        onSelectSection={onSelectSection}
      />,
    );

    expect(screen.getByRole("button", { name: "Administração" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Monitoramento" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Acuracidade" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Regularização" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Monitoramento" }));

    expect(onSelectSection).toHaveBeenCalledWith(
      expect.objectContaining({
        key: "monitoramento",
        tabId: "inventario-admin-monitoramento",
      }),
    );
  });
});
