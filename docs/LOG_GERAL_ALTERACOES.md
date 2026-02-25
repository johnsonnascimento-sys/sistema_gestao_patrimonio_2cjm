# Log Geral de Alteracoes

## Cabecalho

| Campo | Valor |
|---|---|
| Modulo | `docs` |
| Arquivo | `docs/LOG_GERAL_ALTERACOES.md` |
| Funcao no sistema | Trilha auditavel de alteracoes do projeto (autor, data/hora, detalhe e reversao) |
| Formato de data/hora | UTC (`YYYY-MM-DD HH:mm:ss UTC`) |
| Fonte de governanca | `PROJECT_RULES.md` Secao 13 |

## Regras de uso

- Toda alteracao relevante deve ter entrada neste log no mesmo ciclo de entrega.
- O campo `reversaoSugerida` deve ser executavel por outro operador.
- Para facilitar operacao, use:
  - `./scripts/log_alteracao.sh "<TIPO>" "<DETALHE>"`
  - `./scripts/reverter_alteracao.sh --commit <hash>`
  - `./scripts/reverter_alteracao.sh --log-id <id>`

## Entradas

| ID | DataHoraUTC | Usuario | Tipo | Branch | Commit | Detalhe | ReversaoSugerida |
|---|---|---|---|---|---|---|---|
| 20260225-223502-ui-redesign-fases-1-3 | 2026-02-25 22:30:35 UTC | Johnson Teixeira do Nascimento \<johnsontn@redejmu.local\> | UX | `main` | `c9bd69b` | Redesign visual fases 1-3 com refatoracao UI-only segura e validacao de build. | `git revert c9bd69b` |
| 20260225-223802-sidebar-icons-svg | 2026-02-25 22:38:02 UTC | Johnson Teixeira do Nascimento \<johnsontn@redejmu.local\> | UX | `main` | `44d0017` | Substituicao dos placeholders de icone da sidebar por SVGs estaveis. | `git revert 44d0017` |
| 20260225-215018-agents-versionado | 2026-02-25 21:50:18 UTC | Johnson Teixeira do Nascimento \<johnsontn@redejmu.local\> | DOC | `main` | `b2dd693` | Versionamento de `AGENTS.md` para uso multiambiente. | `git revert b2dd693` |
| 20260225-214805-governanca-status | 2026-02-25 21:48:05 UTC | Johnson Teixeira do Nascimento \<johnsontn@redejmu.local\> | DOC | `main` | `84f014b` | Alinhamento documental de governanca e status ao runtime atual. | `git revert 84f014b` |
| 20260225-225911 | 2026-02-25 22:59:11 UTC | Johnson Teixeira do Nascimento \<johnsontn@redejmu.local\> | UX | `main` | `22b6a85` | Painel visual no sistema para Log Geral de Alteracoes e comando de rollback na Administracao do Painel. | `git revert 22b6a85` |
| 20260225-231356 | 2026-02-25 23:13:56 UTC | johnsontn <-> | UX | `main` | `9c733a4` | Adicao de auditoria patrimonial global no painel admin e reposicionamento do usuario autenticado para topbar. | `git revert 9c733a4` |
| 20260225-232327 | 2026-02-25 23:23:27 UTC | johnsontn <-> | FIX | `main` | `8868ea4` | Correcao de FORMATO_INVALIDO no filtro numeroTombamento da Auditoria Patrimonial Global (cast para texto) e atualizacao da wiki de logs. | `git revert 8868ea4` |
| 20260225-233135 | 2026-02-25 23:31:35 UTC | johnsontn <-> | FIX | `main` | `55e10fb` | Correcao de erro persistente na auditoria global (cast seguro de executado_por) e criacao de log de erros runtime separado com painel admin. | `git revert 55e10fb` |
