/**
 * Modulo: frontend/tests
 * Arquivo: AdminHealthPanel.test.jsx
 * Funcao no sistema: validar exibicao dos metadados operacionais do /health na UI admin.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/apiClient.js", () => ({
  API_BASE_URL: "http://localhost:3001",
  getHealth: vi.fn(),
}));

import AdminHealthPanel from "../components/AdminHealthPanel.jsx";
import { getHealth } from "../services/apiClient.js";

describe("AdminHealthPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exibe commit, branch e metodo de deploy retornados pelo /health", async () => {
    getHealth.mockResolvedValue({
      status: "ok",
      requestId: "req-1",
      authEnabled: true,
      git: { commit: "abc123def456", branch: "main" },
      deploy: { method: "git_pull", source: "scripts/vps_deploy.sh" },
      build: { timestamp: "2026-03-07T23:59:59Z", source: "scripts/vps_deploy.sh", version: "1.0.0" },
      checks: { database: "ok" },
    });

    render(<AdminHealthPanel canAdmin />);
    await userEvent.click(screen.getByRole("button", { name: "Testar /health" }));

    await waitFor(() => {
      expect(screen.getByText(/requestId=req-1/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Commit/i)).toBeInTheDocument();
    expect(screen.getByText("abc123def456")).toBeInTheDocument();
    expect(screen.getByText(/Método de deploy/i)).toBeInTheDocument();
    expect(screen.getByText("git_pull")).toBeInTheDocument();
    expect(screen.getByText(/Versão backend/i)).toBeInTheDocument();
    expect(screen.getByText("1.0.0")).toBeInTheDocument();
  });
});
