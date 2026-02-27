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
| 20260227-234000-menu-catalogo-normas-operacoes | 2026-02-27 23:40:00 UTC | johnsontn <-> | UX/DOC | `main` | `PENDENTE_COMMIT` | Reorganizacao de menu: `Catalogo (Material)` e `Gestao de Normas` movidos para `Operacoes Patrimoniais`; item renomeado de `Catalogo (SKU) cadastrado`; atualizacao de wiki e status para refletir a nova IA. | `git revert <commit_gerado_para_esta_entrega>` |
| 20260227-210500-local-lista-padronizado | 2026-02-27 21:05:00 UTC | johnsontn <-> | FIX/UX | `main` | `PENDENTE_COMMIT` | Correcao na grade de Consulta de Bens: coluna `LOCAL` passa a priorizar o local padronizado (`localId -> localNome`) retornado pelo backend, com fallback para `localFisico` legado; evita mostrar `-` quando o bem ja esta vinculado a local cadastrado (ex.: Externo 2a Aud). | `git revert <commit_gerado_para_esta_entrega>` |
| 20260227-205000-admin-catalogo-crud-associacao | 2026-02-27 20:50:00 UTC | johnsontn <-> | FEAT/API | `main` | `PENDENTE_COMMIT` | Novo modulo `Catalogo (SKU) cadastrado` na Administracao do Painel, com CRUD de catalogo, upload de foto de referencia e associacao de bens por tombamento; adicionados endpoints `/catalogo-bens` (GET/POST/PATCH) e `/catalogo-bens/:id/associar-bens`. | `git revert <commit_gerado_para_esta_entrega>` |
| 20260227-202450-modal-bem-simplificacao-movs | 2026-02-27 20:24:50 UTC | johnsontn <-> | UX | `main` | `PENDENTE_COMMIT` | Modal de detalhes do bem simplificado: removido bloco de historico de transferencias, mantido destaque de cautela atual e historico unico de movimentacoes com detalhes expansiveis por clique; ajuste de local externo para uso de locais cadastrados (UUID) em vez de opcao sintetica. | `git revert <commit_gerado_para_esta_entrega>` |
| 20260227-195548-cautela-local-obrigatorio | 2026-02-27 19:55:48 UTC | johnsontn <-> | UX/RULE | `main` | `PENDENTE_COMMIT` | Movimentacoes (CAUTELA_SAIDA) agora exige local da cautela: `cautelaSalaDestino` ou `cautelaExterno`; backend valida com erro `LOCAL_CAUTELA_OBRIGATORIO` e registra metadado `[CAUTELA_DESTINO=...]` na justificativa da movimentacao. | `git revert <commit_gerado_para_esta_entrega>` |
| 20260226-230516-fix-modal-cautela-detentor | 2026-02-26 23:05:16 UTC | johnsontn <-> | FIX/UX | `main` | `PENDENTE_COMMIT` | Correcao no modal de detalhes do bem para exibir detentor atual da cautela (perfilId/matricula/nome/data prevista) quando status for `EM_CAUTELA`; backend passou a retornar dados do detentor em `movimentacoes` de `/bens/:id`. | `git revert <commit_gerado_para_esta_entrega>` |
| 20260226-225458-mov-detentor-autocomplete | 2026-02-26 22:54:58 UTC | johnsontn <-> | UX/FIX | `main` | `PENDENTE_COMMIT` | Movimentacoes atualizada com busca de detentor por matricula/nome/perfilId UUID (autocomplete), endpoint `GET /perfis/busca` e cautela com data prevista opcional (UI+backend+migration 015). | `git revert <commit_gerado_para_esta_entrega>` |
| 20260226-223958-fix-perfis-nao-usuario-500 | 2026-02-26 22:39:58 UTC | johnsontn <-> | FIX | `main` | `PENDENTE_COMMIT` | Correcao de erro 500 no cadastro de nao-usuario (`POST /perfis`, erro 42P08 parametro de senha nula), com ajuste da query e tratamento de conflito (`MATRICULA_DUPLICADA`/`EMAIL_DUPLICADO`) retornando 409. | `git revert <commit_gerado_para_esta_entrega>` |
| 20260226-223122-geafin-operacoes-final | 2026-02-26 22:31:22 UTC | johnsontn <-> | UX | `main` | `PENDENTE_COMMIT` | Ajuste final de IA: Importacao GEAFIN reposicionada como ultimo submenu de Operacoes Patrimoniais; limpeza de referencias antigas no Dashboard/Admin e sincronizacao da wiki/status. | `git revert <commit_gerado_para_esta_entrega>` |
| 20260226-222358-nav-admin-operacoes | 2026-02-26 22:23:58 UTC | johnsontn <-> | UX | `main` | `PENDENTE_COMMIT` | Reorganizacao de menu: Importacao GEAFIN e Locais movidos para Administracao do Painel; Cadastro por Sala virou submenu proprio de Operacoes Patrimoniais; atualizacao completa da wiki. | `git revert <commit_gerado_para_esta_entrega>` |
| 20260226-221451-cargo-militar | 2026-02-26 22:14:51 UTC | johnsontn <-> | UX | `main` | `PENDENTE_COMMIT` | Padronizacao de cargos em Perfis atualizada para incluir `Militar` (formulario e wiki operacional). | `git revert <commit_gerado_para_esta_entrega>` |
| 20260226-221009-topbar-status-inventario | 2026-02-26 22:10:09 UTC | johnsontn <-> | UX | `main` | `PENDENTE_COMMIT` | Padronizacao do cabecalho: status de inventario movido para o topo (status + evento), com remocao de duplicidade de titulos entre topbar e conteudo (ex.: Auditoria/Erros). | `git revert <commit_gerado_para_esta_entrega>` |
| 20260226-220311-perfis-nao-usuarios | 2026-02-26 22:03:11 UTC | johnsontn <-> | UX | `main` | `PENDENTE_COMMIT` | Painel de Perfis atualizado para cadastro de nao-usuarios por matricula/nome/unidade/email/cargo padronizado, com criacao automatica sem acesso (ativo=NAO) para uso em cautela/carga. | `git revert <commit_gerado_para_esta_entrega>` |
| 20260225-223502-ui-redesign-fases-1-3 | 2026-02-25 22:30:35 UTC | Johnson Teixeira do Nascimento \<johnsontn@redejmu.local\> | UX | `main` | `c9bd69b` | Redesign visual fases 1-3 com refatoracao UI-only segura e validacao de build. | `git revert c9bd69b` |
| 20260225-223802-sidebar-icons-svg | 2026-02-25 22:38:02 UTC | Johnson Teixeira do Nascimento \<johnsontn@redejmu.local\> | UX | `main` | `44d0017` | Substituicao dos placeholders de icone da sidebar por SVGs estaveis. | `git revert 44d0017` |
| 20260225-215018-agents-versionado | 2026-02-25 21:50:18 UTC | Johnson Teixeira do Nascimento \<johnsontn@redejmu.local\> | DOC | `main` | `b2dd693` | Versionamento de `AGENTS.md` para uso multiambiente. | `git revert b2dd693` |
| 20260225-214805-governanca-status | 2026-02-25 21:48:05 UTC | Johnson Teixeira do Nascimento \<johnsontn@redejmu.local\> | DOC | `main` | `84f014b` | Alinhamento documental de governanca e status ao runtime atual. | `git revert 84f014b` |
| 20260225-225911 | 2026-02-25 22:59:11 UTC | Johnson Teixeira do Nascimento \<johnsontn@redejmu.local\> | UX | `main` | `22b6a85` | Painel visual no sistema para Log Geral de Alteracoes e comando de rollback na Administracao do Painel. | `git revert 22b6a85` |
| 20260225-231356 | 2026-02-25 23:13:56 UTC | johnsontn <-> | UX | `main` | `9c733a4` | Adicao de auditoria patrimonial global no painel admin e reposicionamento do usuario autenticado para topbar. | `git revert 9c733a4` |
| 20260225-232327 | 2026-02-25 23:23:27 UTC | johnsontn <-> | FIX | `main` | `8868ea4` | Correcao de FORMATO_INVALIDO no filtro numeroTombamento da Auditoria Patrimonial Global (cast para texto) e atualizacao da wiki de logs. | `git revert 8868ea4` |
| 20260225-233135 | 2026-02-25 23:31:35 UTC | johnsontn <-> | FIX | `main` | `55e10fb` | Correcao de erro persistente na auditoria global (cast seguro de executado_por) e criacao de log de erros runtime separado com painel admin. | `git revert 55e10fb` |
| 20260226-200112 | 2026-02-26 20:01:12 UTC | johnsontn <-> | INFRA | `main` | `48a5250` | Implementado backup/restore no Google Drive (banco + imagens), snapshot pre-GEAFIN, painel visual na Administracao do Painel e documentacao completa. | `git revert 48a5250` |
| 20260226-201511 | 2026-02-26 20:15:11 UTC | johnsontn <-> | INFRA | `main` | `48a5250` | Painel Admin com backup/restore por botoes e senha, status/listagem de backups no Drive e endpoints protegidos no backend. | `git revert 48a5250` |
| 20260226-205539 | 2026-02-26 20:55:39 UTC | johnsontn <-> | UX | `main` | `ad360e9` | Adicionada regularizacao em lote por sala na aba Movimentacoes com scanner/camera, fila de itens e confirmacao de divergencia de unidade. | `git revert ad360e9` |
| 20260226-213500-ui-nav-dashboard-reorg | 2026-02-26 21:35:00 UTC | johnsontn <-> | UX | main | PENDENTE_COMMIT | Reorganizacao da navegacao frontend com Dashboard inicial, menu por grupos/submenus, Importacoes e Auditoria em modulos proprios, e Administracao do Painel focada em Infra + Seguranca. | git revert <commit_gerado_para_esta_entrega> |
| 20260226-214500-dashboard-mapa-predio-8-andares | 2026-02-26 21:45:00 UTC | johnsontn <-> | UX | main | PENDENTE_COMMIT | Atualizacao do mapa ilustrativo no Dashboard para representar o predio da 2a CJM (8 andares), com composicao arquitetonica vetorial e endereco institucional. | git revert <commit_gerado_para_esta_entrega> |
