<!--
Modulo: wiki
Arquivo: frontend/src/wiki/02_perfis_acesso.md
Funcao no sistema: orientar criação e uso de perfis, roles e permissões operacionais.
-->

# Perfis e acesso

## Onde acessar

- `Administração do Painel -> Perfis e Acessos`
- `Aprovações -> Aprovações Pendentes`

## O que é um perfil

Um **perfil** representa a pessoa que opera o sistema. O perfil é usado para:

- autenticação por matrícula;
- rastreabilidade de movimentações, inventário, avaliações e baixas;
- aplicação de ACL por papel operacional.

Campos principais:

- `matrícula`
- `nome`
- `unidadeId`
- `cargo`
- `ativo`

## Modelo atual de acesso

O backend expõe a ACL efetiva em `GET /auth/acl`, com:

- `roles`
- `permissions`
- `menuPermissions`

Compatibilidade legada:

- `perfis.role` (`ADMIN` ou `OPERADOR`) continua existindo;
- o controle real do sistema é feito pelas roles RBAC.

## Roles RBAC

1. `LEITURA`
2. `OPERADOR_BASICO`
3. `OPERADOR_AVANCADO`
4. `SUPERVISOR`
5. `ADMIN_COMPLETO`

## Menu Inventário

No menu lateral, `Inventário` passou a ser o agrupador operacional das subtelas:

- `Administração`
- `Contagem`
- `Acuracidade`
- `Regularização`

Na matriz de permissões por role:

- `menu.inventario_contagem.view` libera `Inventário -> Contagem`;
- `menu.inventario_admin.view` libera `Inventário -> Administração`, `Inventário -> Acuracidade` e `Inventário -> Regularização`.

## Material Inservível / Baixa

O menu continua controlado por:

- `menu.classificacao.view`

As ações sensíveis da nova workspace usam as permissões abaixo:

| Permissão | Finalidade |
|---|---|
| `action.inservivel.marcar.request` | solicitar marcação/classificação de inservível |
| `action.inservivel.marcar.execute` | executar marcação/classificação diretamente |
| `action.baixa.request` | solicitar abertura/conclusão de baixa |
| `action.baixa.execute` | executar baixa patrimonial diretamente |

## Comportamento por role

| Role | Material Inservível / Baixa |
|---|---|
| `LEITURA` | apenas consulta |
| `OPERADOR_BASICO` | apenas consulta |
| `OPERADOR_AVANCADO` | solicita marcação e solicita baixa |
| `SUPERVISOR` | executa marcação; solicita baixa |
| `ADMIN_COMPLETO` | executa marcação, conclui baixa e cancela rascunhos |

## Diferença entre `request` e `execute`

- `execute`: a ação é aplicada imediatamente, se a validação legal passar.
- `request`: o sistema cria uma solicitação de aprovação administrativa para posterior análise.

Essa separação é usada nos fluxos de:

- marcação de inservível;
- conclusão de baixa patrimonial;
- cancelamento de rascunho sensível.

## Login e primeiro acesso

Quando `AUTH_ENABLED=true`:

- o frontend exige login;
- a API exige `Authorization: Bearer <token>` nas rotas protegidas.

Fluxo de primeiro acesso:

1. um administrador cadastra o perfil;
2. o operador usa `Primeiro acesso` para definir senha;
3. o backend valida matrícula, nome e situação do perfil.

## Boas práticas operacionais

- não reutilize matrícula de outra pessoa;
- prefira desativar (`ativo=false`) em vez de apagar perfis;
- revise a role ACL sempre que o servidor mudar de atribuição;
- para Material Inservível / Baixa, confirme se o perfil possui permissão de `request` ou `execute` antes de iniciar um processo.
