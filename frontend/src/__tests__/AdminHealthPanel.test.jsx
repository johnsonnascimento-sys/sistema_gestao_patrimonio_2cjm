/**
 * Modulo: frontend/tests
 * Arquivo: AdminHealthPanel.test.jsx
 * Funcao no sistema: validar exibicao, autoatualizacao e historico local dos testes do /health na UI admin.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/apiClient.js", () => ({
  API_BASE_URL: "http://localhost:3001",
  getHealth: vi.fn(),
}));

import AdminHealthPanel from "../components/AdminHealthPanel.jsx";
import { getHealth } from "../services/apiClient.js";

const STORAGE_KEY = "cjm.adminHealthPanel.healthLog.v1";

function buildHealthResponse(requestId) {
  return {
    status: "ok",
    requestId,
    authEnabled: true,
    git: { commit: "abc123def456", branch: "main" },
    deploy: { method: "git_pull", source: "scripts/vps_deploy.sh" },
    build: { timestamp: "2026-03-07T23:59:59Z", source: "scripts/vps_deploy.sh", version: "1.0.0" },
    checks: { database: "ok", deepDatabase: "ok" },
  };
}

function seedHealthLog(entries) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function buildSeedEntry(index) {
  return {
    id: `seed-${index}`,
    at: `2026-05-25T21:0${index}:00.000Z`,
    status: "ok",
    requestId: `seed-${index}`,
    database: "ok",
    deepDatabase: "ok",
    error: "",
  };
}

describe("AdminHealthPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.spyOn(window, "setInterval");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("executa o health automaticamente, preserva o teste manual e exibe o historico", async () => {
    seedHealthLog(Array.from({ length: 9 }, (_, idx) => buildSeedEntry(9 - idx)));
    getHealth
      .mockResolvedValueOnce(buildHealthResponse("req-10"))
      .mockResolvedValueOnce(buildHealthResponse("req-11"));

    const user = userEvent.setup();
    render(<AdminHealthPanel canAdmin />);

    await waitFor(() => {
      expect(getHealth).toHaveBeenCalledTimes(1);
    });

    expect(window.setInterval).toHaveBeenCalledWith(expect.any(Function), 432000000);

    await user.click(screen.getByRole("button", { name: "Testar /health" }));

    await waitFor(() => {
      expect(getHealth).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByText(/Historico dos ultimos 10 testes/i)).toBeInTheDocument();

    const historyList = screen.getByRole("list", { name: /Historico dos ultimos 10 testes/i });
    expect(within(historyList).getAllByRole("listitem")).toHaveLength(10);
    expect(within(historyList).getByText("requestId=req-11")).toBeInTheDocument();
    expect(within(historyList).getByText("requestId=req-10")).toBeInTheDocument();
    expect(within(historyList).queryByText("requestId=seed-1")).not.toBeInTheDocument();
    expect(within(historyList).getAllByText("deepDatabase=ok")).toHaveLength(10);

    const storedLog = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    expect(storedLog).toHaveLength(10);
    expect(storedLog[0].requestId).toBe("req-11");
    expect(storedLog[1].requestId).toBe("req-10");
    expect(storedLog[storedLog.length - 1].requestId).toBe("seed-2");

    expect(screen.getByText(/Commit/i)).toBeInTheDocument();
    expect(screen.getByText("abc123def456")).toBeInTheDocument();
    expect(screen.getByText(/M[eé]todo de deploy/i)).toBeInTheDocument();
    expect(screen.getByText("git_pull")).toBeInTheDocument();
    expect(screen.getByText(/Vers[aã]o backend/i)).toBeInTheDocument();
    expect(screen.getByText("1.0.0")).toBeInTheDocument();
    expect(within(historyList).getByText("requestId=req-11")).toBeInTheDocument();
    expect(screen.getByText(/Atualiza[cç][aã]o autom[aá]tica a cada 120 horas/i)).toBeInTheDocument();
    expect(screen.getAllByText("deepDatabase=ok")).toHaveLength(11);
  });
});
