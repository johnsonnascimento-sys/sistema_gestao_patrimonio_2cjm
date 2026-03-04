<!--
Modulo: wiki
Arquivo: frontend/src/wiki/02_perfis_acesso.md
Funcao no sistema: orientar criação e uso de perfis (matrícula), e como isso entra na auditoria.
-->

# Perfis e acesso

## Onde acessar no menu

- `Administração do Painel -> Perfis e Acessos`

## O que e um "perfil"

Um **perfil** representa uma pessoa que opera o sistema (servidor/usuário), com:

- `matrícula` (obrigatorio)
- `nome`
- `unidade` (1..4)
- `cargo` (opcional)
- `ativo` (controle operacional)

O perfil e usado para:

- Registrar quem executou movimentações.
- Registrar quem abriu/encerrou eventos de inventario (quando habilitado).
- Carimbar historicos (auditoria).

## Controle de acesso (login) - quando esta ativo

O sistema suporta **autenticação por matrícula** (JWT), com perfis e papéis (`role`).

Quando a VPS estiver com:

- `AUTH_ENABLED=true`

Entao:

- O site **exige login** para usar as telas.
- A API passa a exigir `Authorization: Bearer <token>` nas rotas protegidas.

Quando `AUTH_ENABLED=false` (default), o sistema funciona **sem login** (modo de implantação inicial / testes), mas isso **não é o modo operacional final**.

## Papéis (role): ADMIN vs OPERADOR

- `ADMIN`
  - Pode importar GEAFIN, criar/gerir perfis e executar operações administrativas (ex.: regularização pós-inventário).
- `OPERADOR`
  - Pode consultar bens e operar inventário/movimentações conforme permissões do backend.

Obs.: as permissões efetivas são aplicadas pelo backend (a UI só reflete).

## Primeiro acesso (definir senha)

No primeiro uso com autenticação ativa, o operador precisa **definir a senha** do seu perfil.

Fluxo:

1. Um `ADMIN` cria o perfil com `matrícula`, `nome` e `unidadeId` (sem senha).
2. O operador entra na tela de login e usa **"Primeiro acesso"** para definir a senha.
   - O nome deve conferir com o cadastro (guardrail contra erro de matrícula).

Bootstrap controlado:

- Se ainda não existir nenhum `ADMIN` no sistema, o **primeiro** "primeiro acesso" promove o perfil a `ADMIN` automaticamente.

Rotas relacionadas:

- `POST /auth/primeiro-acesso`
- `POST /auth/login`
- `GET /auth/me`

## Matrícula (por que e obrigatoria)

A matrícula funciona como identificador interno estavel. Evita depender de e-mail (que pode mudar).

## Unidades (1..4)

O sistema trabalha com 4 unidades:

- 1: 1a Aud
- 2: 2a Aud
- 3: Foro
- 4: Almox

## Como criar um perfil (fluxo do sistema)

O fluxo padrão é:

1. `ADMIN` cadastra o perfil em **Administração do Painel** (seção **Perfis (usuários)**).
2. O usuário entra na tela de login e usa **Primeiro acesso** para definir a senha.

Obs.: no menu superior, a aba pode aparecer como **Administração do Painel** (nome atualizado).

Na seção de Perfis, o `ADMIN` também consegue:

- listar perfis existentes
- editar dados (nome, email, unidade, cargo, role, ativo)
- desativar/ativar (soft-disable)
- **resetar senha** (remove o hash) para permitir "Primeiro acesso" novamente

## Cadastro de não-usuario (detentor de carga, sem login)

Quando a pessoa precisa aparecer em cautela/carga, mas não deve entrar no sistema:

1. Em **Perfis**, escolha o tipo **Nao-usuario do sistema (detentor/carga)**.
2. Preencha: `matrícula`, `nome`, `unidade`, `email` e `cargo`.
3. Cargos padronizados:
   - `Juiz Federal`
   - `Juiz Federal Substituto`
   - `Analista Judiciario`
   - `Tecnico Judiciario`
   - `Militar`
   - `Outro` (com descrição manual)
4. O sistema cria o perfil sem acesso (`ativo=false`, `role=OPERADOR`), preservando rastreabilidade.

Erros de conflito esperados:

- `MATRICULA_DUPLICADA` (HTTP 409): ja existe perfil com a mesma matrícula.
- `EMAIL_DUPLICADO` (HTTP 409): ja existe perfil com o mesmo e-mail.

Resultado pratico:
- O perfil pode ser usado em campos como `detentorTemporarioPerfilId` (cautela).
- O perfil não autentica no login enquanto estiver inativo.

Rotas relacionadas:

- `GET /perfis`
- `GET /perfis/busca?q=<termo>&limit=8` (busca por matrícula/nome/UUID para campos de detentor)
- `POST /perfis`
- `PATCH /perfis/:id`
- `POST /perfis/:id/reset-senha`

Quando o perfil e criado, o backend retorna um JSON parecido com:

```json
{
  "perfil": {
    "id": "uuid",
    "matrícula": "9156",
    "nome": "Nome Completo",
    "unidadeId": 2,
    "cargo": "Tecnico",
    "ativo": true
  }
}
```

## Boas praticas de operação

- Nao crie perfis duplicados com a mesma matrícula.
- Ao desligar um operador, marque `ativo=false` (não apague) para manter trilha histórica.
- Se um perfil estiver incorreto (nome/unidade), corrija e registre em observação/controle interno.

## Perguntas comuns

### "Admin" e um perfil?

No banco, "perfil" e a identidade de quem executa. "Admin" pode ser:

- Um perfil com permissao ampliada no sistema (quando o controle de acesso for ativado).
- Um operador do CloudPanel/Docker (administração da VPS), que é outra camada e não deve se misturar com dados do sistema.

### Onde isso aparece no sistema?

- Em historicos de transferencia (quando um bem muda de carga).
- Em movimentações (cautela/transferencia).
- Em eventos/contagens de inventario (quando o modulo estiver com persistencia completa).

## RBAC v1 (roles + permissoes)

O sistema passou a expor ACL por usuario em `GET /auth/acl`, com:

- `roles`: papeis RBAC ativos do perfil
- `permissions`: permissoes de ação/menu
- `menuPermissions`: subconjunto para filtro de navegação

Catálogo de roles RBAC (V1):

1. `LEITURA`
2. `OPERADOR_BASICO`
3. `OPERADOR_AVANCADO`
4. `SUPERVISOR`
5. `ADMIN_COMPLETO`

Compatibilidade:

- `perfis.role` (`ADMIN`/`OPERADOR`) continua existindo por legado.
- Mapeamento automatico atual:
  - `ADMIN` -> `ADMIN_COMPLETO`
  - `OPERADOR` -> `OPERADOR_AVANCADO`

Observação operacional:

- A UI usa `menuPermissions` para mostrar/ocultar menus.
- A API usa `permissions` para permitir execução direta ou exigir solicitação de aprovação.

## Gestão visual de Role ACL (RBAC) no painel

A tela `Administração do Painel > Perfis e Acessos` passou a permitir ajuste visual da Role ACL por usuario, sem uso de SQL.

### O que significa "Role ACL" (explicação simples)

- Pense em `Role ACL` como o **nivel de acesso real** do usuario.
- Ela define duas coisas:
  - quais menus ele enxerga;
  - quais ações ele pode executar sem pedir aprovação.

Resumo pratico dos niveis:

1. `LEITURA`: so consulta.
2. `OPERADOR_BASICO`: operação basica.
3. `OPERADOR_AVANCADO`: operação + pode solicitar ações sensiveis.
4. `SUPERVISOR`: pode executar ações sensiveis.
5. `ADMIN_COMPLETO`: acesso total, incluindo aprovações e administração.

Importante:

- A coluna `ROLE` (ADMIN/OPERADOR) e o modelo antigo de compatibilidade.
- A coluna `ROLE ACL` e o modelo novo e mais completo.
- O botao `Salvar ACL` aplica a role nova para aquele usuario.

Como operar:

1. Acesse a tabela `Lista de perfis`.
2. Na coluna `Role ACL`, selecione uma role (`LEITURA`, `OPERADOR_BASICO`, `OPERADOR_AVANCADO`, `SUPERVISOR`, `ADMIN_COMPLETO`).
3. Clique em `Salvar ACL` na mesma linha.

Efeito esperado:

- A role RBAC principal do perfil e atualizada.
- O campo legado `perfis.role` e sincronizado automaticamente para compatibilidade:
  - `ADMIN_COMPLETO` -> `ADMIN`
  - Demais roles -> `OPERADOR`
- Menus e ações visiveis/permitidas passam a refletir a nova ACL no proximo login/refresh de token.

## Definir o que cada role pode fazer (matriz visual)

Agora existe uma seção no mesmo painel:

- `Administração do Painel -> Perfis e Acessos -> Matriz de permissoes por role`

Nessa seção voce consegue:

1. Escolher a role (`LEITURA`, `OPERADOR_BASICO`, `OPERADOR_AVANCADO`, `SUPERVISOR`, `ADMIN_COMPLETO`).
2. Marcar/desmarcar permissoes de `Menus` e `Acoes`.
3. Salvar com senha do admin logado.

Apresentação das permissoes na tela:

- A matriz exibe apenas o nome amigavel da permissao (descrição operacional).
- Os codigos tecnicos internos (ex.: `menu.admin_aprovações.view`) não sao exibidos na lista visual.

Atalhos visuais:

- `Marcar todos menus`
- `Limpar menus`
- `Marcar todas ações`
- `Limpar ações`
- `Limpar tudo`

Observação operacional:

- As alterações valem para todos os usuarios que usam aquela role.
- Se remover permissoes criticas de uma role, o menu/ação desaparece para usuarios dessa role.
