/**
 * Modulo: frontend/hooks
 * Arquivo: useOfflineSync.js
 * Funcao no sistema: fila offline-first para contagens de inventario, persistida em IndexedDB.
 *
 * Observacao:
 * - Este hook NAO toma decisoes "inteligentes". Ele apenas enfileira e sincroniza deterministically.
 * - A classificacao de divergencia (Art. 185 - AN303_Art185) e feita no backend no endpoint /inventario/sync.
 */
import { get, set } from "idb-keyval";
import { useCallback, useEffect, useMemo, useState } from "react";
import { syncInventario } from "../services/apiClient.js";

const QUEUE_KEY = "cjm_inventory_sync_queue_v1";

function groupBySyncKey(items) {
  const groups = new Map();
  for (const item of items) {
    const key = [
      item.eventoInventarioId,
      item.unidadeEncontradaId,
      item.salaEncontrada,
      item.localEncontradoId || "",
      item.encontradoPorPerfilId || "",
    ].join("|");
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

async function loadQueue() {
  const items = (await get(QUEUE_KEY)) || [];
  return Array.isArray(items) ? items : [];
}

/**
 * Hook para enfileirar e sincronizar itens de inventario.
 * @returns {{
 *  pendingCount: number,
 *  isSyncing: boolean,
 *  lastError: string|null,
 *  enqueue: (item: any) => Promise<void>,
 *  syncNow: () => Promise<{synced: number, remaining: number}>,
 *  refresh: () => Promise<void>
 * }} Estado e funcoes.
 */
export default function useOfflineSync() {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastError, setLastError] = useState(null);
  const [items, setItems] = useState([]);

  const refresh = useCallback(async () => {
    const q = await loadQueue();
    setItems(q);
    setPendingCount(q.length);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const enqueue = useCallback(async (item) => {
    const q = await loadQueue();
    q.push(item);
    await set(QUEUE_KEY, q);
    setItems(q);
    setPendingCount(q.length);
  }, []);

  const syncNow = useCallback(async () => {
    setLastError(null);
    if (!navigator.onLine) {
      const q = await loadQueue();
      return { synced: 0, remaining: q.length };
    }

    const q = await loadQueue();
    if (!q.length) return { synced: 0, remaining: 0 };

    setIsSyncing(true);
    try {
      const groups = groupBySyncKey(q);
      const failedIds = new Set();
      let synced = 0;

      for (const items of groups.values()) {
        const head = items[0];
        const payload = {
          eventoInventarioId: head.eventoInventarioId,
          unidadeEncontradaId: head.unidadeEncontradaId,
          salaEncontrada: head.salaEncontrada,
          localEncontradoId: head.localEncontradoId || undefined,
          encontradoPorPerfilId: head.encontradoPorPerfilId || undefined,
          itens: items.map((it) => ({
            numeroTombamento: it.numeroTombamento,
            encontradoEm: it.encontradoEm,
            observacoes: it.observacoes || undefined,
          })),
        };

        try {
          await syncInventario(payload);
          synced += items.length;
        } catch (_error) {
          for (const it of items) failedIds.add(it.id);
        }
      }

      const remaining = q.filter((it) => failedIds.has(it.id));
      await set(QUEUE_KEY, remaining);
      setItems(remaining);
      setPendingCount(remaining.length);

      if (failedIds.size) {
        setLastError("Alguns itens não foram sincronizados. Tente novamente quando a conexão estiver estável.");
      }

      return { synced, remaining: remaining.length };
    } finally {
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    const onOnline = () => {
      syncNow().catch(() => undefined);
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [syncNow]);

  const api = useMemo(
    () => ({
      pendingCount,
      isSyncing,
      lastError,
      items,
      enqueue,
      syncNow,
      refresh,
    }),
    [enqueue, isSyncing, items, lastError, pendingCount, refresh, syncNow],
  );

  return api;
}
