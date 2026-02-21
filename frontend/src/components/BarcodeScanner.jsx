import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

/**
 * Componente para leitura de codigos de barras e QR codes usando html5-qrcode.
 *
 * @param {Object} props
 * @param {(code: string) => void} props.onScan Disparado quando um codigo e lido com sucesso.
 * @param {() => void} props.onClose Disparado quando o usuario clica em cancelar/fechar.
 * @param {boolean} [props.continuous=false] Se true, a camera nao fecha automaticamente apos ler um codigo.
 */
export default function BarcodeScanner({ onScan, onClose, continuous = false }) {
  const regionIdRef = useRef(`barcode-scanner-region-${Math.random().toString(36).slice(2, 10)}`);
  const regionId = regionIdRef.current;

  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  const requestCloseRef = useRef(() => undefined);
  const lastReadRef = useRef({ value: "", at: 0 });

  const [errorLabel, setErrorLabel] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    let unmounted = false;
    let hasStarted = false;
    let isStopping = false;

    const html5QrCode = new Html5Qrcode(regionId);

    const stopAndClear = async () => {
      if (isStopping) return;
      isStopping = true;

      try {
        if (html5QrCode.isScanning) {
          await html5QrCode.stop();
        }
      } catch (_error) {
        // Ignora erros de transicao no teardown.
      }

      try {
        html5QrCode.clear();
      } catch (_error) {
        // Ignora erro de clear quando o elemento ja foi removido.
      }
    };

    const requestClose = async () => {
      await stopAndClear();
      if (!unmounted && typeof onCloseRef.current === "function") {
        onCloseRef.current();
      }
    };

    requestCloseRef.current = () => {
      void requestClose();
    };

    const config = {
      fps: 10,
      qrbox: { width: 280, height: 110 },
      aspectRatio: 1.0,
      disableFlip: false,
    };

    const cameraConstraints = {
      facingMode: "environment",
    };

    const onScanSuccessLocal = (decodedText) => {
      const decoded = typeof decodedText === "string" ? decodedText.trim() : String(decodedText || "").trim();
      const now = Date.now();
      if (decoded && lastReadRef.current.value === decoded && now - lastReadRef.current.at < 1200) {
        return;
      }
      lastReadRef.current = { value: decoded, at: now };

      if (typeof onScanRef.current === "function") {
        onScanRef.current(decoded || decodedText);
      }

      if (!continuous && !isStopping) {
        void requestClose();
      }
    };

    const onScanFailureLocal = () => {
      // Sem log para evitar ruido em leitura continua.
    };

    const startCamera = async () => {
      try {
        await html5QrCode.start(cameraConstraints, config, onScanSuccessLocal, onScanFailureLocal);
        if (unmounted) {
          await stopAndClear();
          return;
        }
        hasStarted = true;
        setIsInitializing(false);
      } catch (error) {
        if (unmounted) return;
        setIsInitializing(false);
        const errMsg = error?.message || error?.name || String(error);
        setErrorLabel(`Erro na camera: ${errMsg}. Verifique permissoes/HTTPS.`);
        console.error("Camera start error:", error);
      }
    };

    void startCamera();

    return () => {
      unmounted = true;
      requestCloseRef.current = () => undefined;
      if (hasStarted || html5QrCode.isScanning) {
        void stopAndClear();
      }
    };
  }, [continuous, regionId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/20 bg-slate-900 p-4 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold text-slate-100 uppercase tracking-wide">
            {continuous ? "Leitura Continua" : "Leitura Simples"}
          </h3>
          <button
            onClick={() => requestCloseRef.current()}
            className="rounded-lg bg-slate-800 p-2 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {errorLabel ? (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
            {errorLabel}
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-cyan-400/50 bg-black">
            {isInitializing && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 text-sm text-cyan-300">
                Iniciando camera...
              </div>
            )}
            <div id={regionId} className="w-full" />
            <div className="pointer-events-none absolute left-0 right-0 top-1/2 -mt-[1px] h-0.5 animate-pulse bg-rose-500/50 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
          </div>
        )}

        <div className="mt-4 text-center text-xs text-slate-400">
          {continuous
            ? "Aponte a camera para os codigos de barras. A camera continuara ligada apos cada leitura."
            : "Aponte a camera para o codigo de barras. A camera sera fechada automaticamente apos a leitura."}
        </div>

        <button
          onClick={() => requestCloseRef.current()}
          className="mt-6 w-full rounded-xl border border-white/10 bg-slate-800 py-3 font-semibold text-slate-200 transition-colors hover:bg-slate-700"
        >
          {errorLabel ? "Voltar" : "Cancelar Camera"}
        </button>
      </div>
    </div>
  );
}
