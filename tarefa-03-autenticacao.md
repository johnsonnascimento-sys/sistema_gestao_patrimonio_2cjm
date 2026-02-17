# Tarefa 03 - Autenticacao e Controle de Acesso (JWT)

## Objetivo
Implementar controle de acesso real (login por `matricula` + senha) com papeis `ADMIN`/`OPERADOR`, garantindo:

- UI exige login quando a autenticacao estiver ativa na VPS.
- API recusa operacoes sensiveis sem autorizacao.
- Trilhas de "quem fez" (auditoria/historicos) usam o usuario autenticado quando aplicavel.
- Wiki atualizado no mesmo commit (regra Wiki-First).

## Tarefas
- [ ] Banco: aplicar `database/006_auth_and_access.sql` (ALTER em `perfis`) -> Verificar: colunas `role`, `senha_hash`, `senha_definida_em`, `ultimo_login_em` existem.
- [ ] Backend: endpoints `/auth/*` + middleware JWT + protecao de rotas -> Verificar: sem token retorna `401`, com token valido retorna `200`.
- [ ] Frontend: token em `localStorage`, injecao `Authorization: Bearer`, tela de login/primeiro acesso, gate no App -> Verificar: quando `authEnabled=true`, app abre no login.
- [ ] UX: remover validacao nativa (HTML `pattern`) para tombamento (10 digitos) e normalizar input -> Verificar: nao aparece tooltip "formato corresponde ao exigido".
- [ ] Wiki: atualizar `02_perfis_acesso.md`, `15_referencia_api.md`, `10_solucao_problemas.md`, `14_admin_operacao_vps.md` -> Verificar: docs cobrem ativacao do login, roles e erros 401/403.

## Feito Quando
- [ ] `GET /api/health` retorna `authEnabled` (boolean).
- [ ] Com `AUTH_ENABLED=true`, `GET /api/stats` sem token retorna `401` e com token retorna `200`.
- [ ] UI: usuario consegue fazer `primeiro acesso` e depois `login`.
- [ ] Wiki publicado descreve o fluxo e a operacao na VPS.

