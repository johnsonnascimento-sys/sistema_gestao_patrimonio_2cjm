import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

/**
 * Componente para leitura de Códigos de Barras e QR Codes usando html5-qrcode.
 * 
 * @param {Object} props
 * @param {(code: string) => void} props.onScan - Disparado quando um código é lido com sucesso.
 * @param {() => void} props.onClose - Disparado quando o usuário clica em Cancelar/Fechar.
 * @param {boolean} [props.continuous=false] - Se true, a câmera não fecha automaticamente após ler um código (modo supermercado).
 */
export default function BarcodeScanner({ onScan, onClose, continuous = false }) {
    const regionIdRef = useRef(`barcode-scanner-region-${Math.random().toString(36).slice(2, 10)}`);
    const regionId = regionIdRef.current;
    const onScanRef = useRef(onScan);
    const onCloseRef = useRef(onClose);
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
                // Alguns navegadores podem reportar transicao de estado durante desmontagem.
            }
            try {
                html5QrCode.clear();
            } catch (_error) {
                // clear pode falhar se o elemento ja foi removido; ignoramos no teardown.
            }
        };

        const config = {
            fps: 10,
            qrbox: { width: 280, height: 110 },
            aspectRatio: 1.0,
            disableFlip: false,
        };

        const onScanSuccessLocal = (decodedText) => {
            if (typeof onScanRef.current === "function") {
                onScanRef.current(decodedText);
            }
            if (!continuous) {
                if (!isStopping) {
                    isStopping = true;
                    html5QrCode
                        .stop()
                        .catch(() => undefined)
                        .finally(() => {
                            if (typeof onCloseRef.current === "function") {
                                onCloseRef.current();
                            }
                        });
                }
            }
        };

        const onScanFailureLocal = (_errorMessage) => { };

        const idealConstraints = {
            facingMode: "environment",
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
            advanced: [{ focusMode: "continuous" }]
        };

        const basicConstraints = {
            facingMode: "environment"
        };

        const startCamera = async () => {
            let success = false;
            try {
                await html5QrCode.start(idealConstraints, config, onScanSuccessLocal, onScanFailureLocal);
                success = true;
            } catch (err) {
                if (unmounted) return;
                console.warn("Falha ao iniciar ideal. Tentando basic...", err);
                try {
                    await html5QrCode.start(basicConstraints, config, onScanSuccessLocal, onScanFailureLocal);
                    success = true;
                } catch (errBasic) {
                    if (unmounted) return;
                    setIsInitializing(false);
                    const errMsg = errBasic?.message || errBasic?.name || String(errBasic);
                    setErrorLabel(`Erro na câmera: ${errMsg}. Verifique permissões/HTTPS.`);
                    console.error("Camera start error:", errBasic);
                }
            }

            if (success) {
                if (unmounted) {
                    await stopAndClear();
                } else {
                    hasStarted = true;
                    setIsInitializing(false);
                }
            }
        };

        startCamera();

        return () => {
            unmounted = true;
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
                        {continuous ? "Leitura Contínua" : "Leitura Simples"}
                    </h3>
                    <button
                        onClick={onClose}
                        className="rounded-lg bg-slate-800 p-2 text-slate-300 hover:bg-slate-700 hover:text-white"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {errorLabel ? (
                    <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-sm text-rose-200">
                        {errorLabel}
                    </div>
                ) : (
                    <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-cyan-400/50 bg-black">
                        {isInitializing && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 text-sm text-cyan-300">
                                Iniciando câmera...
                            </div>
                        )}
                        <div id={regionId} className="w-full" />
                        <div className="absolute top-1/2 left-0 right-0 h-0.5 -mt-[1px] bg-rose-500/50 shadow-[0_0_8px_rgba(244,63,94,0.8)] animate-pulse pointer-events-none" />
                    </div>
                )}

                <div className="mt-4 text-center text-xs text-slate-400">
                    {continuous
                        ? "Aponte a câmera para os códigos de barras. A câmera continuará ligada após cada leitura."
                        : "Aponte a câmera para o código de barras. A câmera será fechada automaticamente após a leitura."}
                </div>

                <button
                    onClick={onClose}
                    className="mt-6 w-full rounded-xl border border-white/10 bg-slate-800 py-3 font-semibold text-slate-200 transition-colors hover:bg-slate-700"
                >
                    {errorLabel ? "Voltar" : "Cancelar Câmera"}
                </button>
            </div>
        </div>
    );
}
