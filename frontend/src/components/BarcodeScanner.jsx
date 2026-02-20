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
    const scannerRef = useRef(null);
    const regionId = "barcode-scanner-region";
    const [errorLabel, setErrorLabel] = useState(null);
    const [isInitializing, setIsInitializing] = useState(true);

    useEffect(() => {
        const html5QrCode = new Html5Qrcode(regionId);
        scannerRef.current = html5QrCode;

        const config = {
            fps: 10,
            qrbox: { width: 250, height: 100 },
            aspectRatio: 1.0,
            disableFlip: false,
        };

        const qsCan = html5QrCode.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
                // Sucesso de leitura
                onScan(decodedText);
                if (!continuous) {
                    // Se não for contínuo, paramos a câmera imediatamente e avisamos o pai
                    html5QrCode.stop().then(() => {
                        onClose();
                    }).catch(() => {
                        onClose();
                    });
                }
            },
            (_errorMessage) => {
                // Erro de parse ignorável na taxa de FPS
            }
        );

        qsCan
            .then(() => {
                setIsInitializing(false);
            })
            .catch((err) => {
                setIsInitializing(false);
                setErrorLabel("Não foi possível acessar a câmera. Verifique as permissões de vídeo no navegador.");
                console.error("Camera start error:", err);
            });

        return () => {
            // Limpeza ao desmontar
            if (scannerRef.current && scannerRef.current.isScanning) {
                scannerRef.current.stop().catch(() => { });
            }
        };
    }, [onScan, onClose, continuous]);

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
