<!--
Modulo: wiki
Arquivo: frontend/src/wiki/02_perfis_acesso.md
Funcao no sistema: orientar cria?o e uso de perfis (matr?cula), e como isso entra na auditoria.
-->

# Perfis e acesso

## Onde acessar no menu

- `Administra?o do Painel -> Perfis e Acessos`

## O que e um "perfil"

Um **perfil** representa uma pessoa que opera o sistema (servidor/usuário), com:

- `matr?cula` (obrigatorio)
- `nome`
- `unidade` (1..4)
- `cargo` (opcional)
- `ativo` (controle operacional)

O perfil e usado para:

- Registrar quem executou movimenta?es.
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

1. Um `ADMIN` cria o perfil com `matr?cula`, `nome` e `unidadeId` (sem senha).
2. O operador entra na tela de login e usa **"Primeiro acesso"** para definir a senha.
   - O nome deve conferir com o cadastro (guardrail contra erro de matrícula).

Bootstrap controlado:

- Se ainda não existir nenhum `ADMIN` no sistema, o **primeiro** "primeiro acesso" promove o perfil a `ADMIN` automaticamente.

Rotas relacionadas:

- `POST /auth/primeiro-acesso`
- `POST /auth/login`
- `GET /auth/me`

## Matr?cula (por que e obrigatoria)

A matr?cula funciona como identificador interno estavel. Evita depender de e-mail (que pode mudar).

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

## Cadastro de n?o-usuario (detentor de carga, sem login)

Quando a pessoa precisa aparecer em cautela/carga, mas n?o deve entrar no sistema:

1. Em **Perfis**, escolha o tipo **Nao-usuario do sistema (detentor/carga)**.
2. Preencha: `matr?cula`, `nome`, `unidade`, `email` e `cargo`.
3. Cargos padronizados:
   - `Juiz Federal`
   - `Juiz Federal Substituto`
   - `Analista Judiciario`
   - `Tecnico Judiciario`
   - `Militar`
   - `Outro` (com descri?o manual)
4. O sistema cria o perfil sem acesso (`ativo=false`, `role=OPERADOR`), preservando rastreabilidade.

Erros de conflito esperados:

- `MATRICULA_DUPLICADA` (HTTP 409): ja existe perfil com a mesma matr?cula.
- `EMAIL_DUPLICADO` (HTTP 409): ja existe perfil com o mesmo e-mail.

Resultado pratico:
- O perfil pode ser usado em campos como `detentorTemporarioPerfilId` (cautela).
- O perfil n?o autentica no login enquanto estiver inativo.

Rotas relacionadas:

- `GET /perfis`
- `GET /perfis/busca?q=<termo>&limit=8` (busca por matr?cula/nome/UUID para campos de detentor)
- `POST /perfis`
- `PATCH /perfis/:id`
- `POST /perfis/:id/reset-senha`

Quando o perfil e criado, o backend retorna um JSON parecido com:

```json
{
  "perfil": {
    "id": "uuid",
    "matr?cula": "9156",
    "nome": "Nome Completo",
    "unidadeId": 2,
    "cargo": "Tecnico",
    "ativo": true
  }
}
```

## Boas praticas de opera?o

- Nao crie perfis duplicados com a mesma matr?cula.
- Ao desligar um operador, marque `ativo=false` (não apague) para manter trilha histórica.
- Se um perfil estiver incorreto (nome/unidade), corrija e registre em observa?o/controle interno.

## Perguntas comuns

### "Admin" e um perfil?

No banco, "perfil" e a identidade de quem executa. "Admin" pode ser:

- Um perfil com permissao ampliada no sistema (quando o controle de acesso for ativado).
- Um operador do CloudPanel/Docker (administração da VPS), que é outra camada e não deve se misturar com dados do sistema.

### Onde isso aparece no sistema?

- Em historicos de transferencia (quando um bem muda de carga).
- Em movimenta?es (cautela/transferencia).
- Em eventos/contagens de inventario (quando o modulo estiver com persistencia completa).

## RBAC v1 (roles + permissoes)

O sistema passou a expor ACL por usuario em `GET /auth/acl`, com:

- `roles`: papeis RBAC ativos do perfil
- `permissions`: permissoes de a?o/menu
- `menuPermissions`: subconjunto para filtro de navega?o

Cat?logo de roles RBAC (V1):

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

Observa?o operacional:

- A UI usa `menuPermissions` para mostrar/ocultar menus.
- A API usa `permissions` para permitir execu?o direta ou exigir solicita?o de aprova?o.

## Gest?o visual de Role ACL (RBAC) no painel

A tela `Administra?o do Painel > Perfis e Acessos` passou a permitir ajuste visual da Role ACL por usuario, sem uso de SQL.

### O que significa "Role ACL" (explica?o simples)

- Pense em `Role ACL` como o **nivel de acesso real** do usuario.
- Ela define duas coisas:
  - quais menus ele enxerga;
  - quais a?es ele pode executar sem pedir aprova?o.

Resumo pratico dos niveis:

1. `LEITURA`: so consulta.
2. `OPERADOR_BASICO`: opera?o basica.
3. `OPERADOR_AVANCADO`: opera?o + pode solicitar a?es sensiveis.
4. `SUPERVISOR`: pode executar a?es sensiveis.
5. `ADMIN_COMPLETO`: acesso total, incluindo aprova?es e administra?o.

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
- Menus e a?es visiveis/permitidas passam a refletir a nova ACL no proximo login/refresh de token.

## Definir o que cada role pode fazer (matriz visual)

Agora existe uma secao no mesmo painel:

- `Administra?o do Painel -> Perfis e Acessos -> Matriz de permissoes por role`

Nessa secao voce consegue:

1. Escolher a role (`LEITURA`, `OPERADOR_BASICO`, `OPERADOR_AVANCADO`, `SUPERVISOR`, `ADMIN_COMPLETO`).
2. Marcar/desmarcar permissoes de `Menus` e `Acoes`.
3. Salvar com senha do admin logado.

Apresenta?o das permissoes na tela:

- A matriz exibe apenas o nome amigavel da permissao (descri?o operacional).
- Os codigos tecnicos internos (ex.: `menu.admin_aprova?es.view`) n?o sao exibidos na lista visual.

Atalhos visuais:

- `Marcar todos menus`
- `Limpar menus`
- `Marcar todas a?es`
- `Limpar a?es`
- `Limpar tudo`

Observa?o operacional:

- As altera?es valem para todos os usuarios que usam aquela role.
- Se remover permissoes criticas de uma role, o menu/a?o desaparece para usuarios dessa role.
