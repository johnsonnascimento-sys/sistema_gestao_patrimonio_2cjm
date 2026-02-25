# Log de Erros Runtime

## Cabecalho

| Campo | Valor |
|---|---|
| Modulo | `docs` |
| Arquivo | `docs/LOG_ERROS.md` |
| Funcao no sistema | Registro de erros runtime relevantes observados em producao e correcoes aplicadas |
| Formato de data/hora | UTC (`YYYY-MM-DD HH:mm:ss UTC`) |

## Regras de uso

- Registrar erros de producao com impacto funcional (ex.: 4xx recorrente, 5xx, regressao de fluxo).
- Incluir `requestId` e rota para facilitar rastreio no backend.
- Incluir `causa` e `correcao` com referencia de commit quando houver.

## Entradas

| ID | DataHoraUTC | Ambiente | RequestId | Rota | Erro | Causa | Correcao | Commit |
|---|---|---|---|---|---|---|---|---|
| 20260225-232700-formato-invalido-auditoria-global | 2026-02-25 23:27:00 UTC | Producao | `8939f66b-c7d0-4cb2-bf57-67411fda9f74` | `GET /auditoria/patrimonio?numeroTombamento=...` | `FORMATO_INVALIDO` (400) | Cast inseguro de `executado_por::uuid` no `LEFT JOIN` da auditoria global, sujeito ao plano de execucao | Join ajustado com `CASE WHEN ... THEN ::uuid ELSE NULL END` e log runtime separado (`/logs/erros-runtime`) | `PENDENTE` |

