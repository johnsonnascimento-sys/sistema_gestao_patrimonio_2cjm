<!--
Modulo: wiki
Arquivo: frontend/src/wiki/02_perfis_acesso.md
Funcao no sistema: orientar criacao e uso de perfis (matricula), e como isso entra na auditoria.
-->

# Perfis e acesso

## O que e um "perfil"

Um **perfil** representa uma pessoa que opera o sistema (servidor/usuário), com:

- `matricula` (obrigatorio)
- `nome`
- `unidade` (1..4)
- `cargo` (opcional)
- `ativo` (controle operacional)

O perfil e usado para:

- Registrar quem executou movimentacoes.
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

1. Um `ADMIN` cria o perfil com `matricula`, `nome` e `unidadeId` (sem senha).
2. O operador entra na tela de login e usa **"Primeiro acesso"** para definir a senha.
   - O nome deve conferir com o cadastro (guardrail contra erro de matrícula).

Bootstrap controlado:

- Se ainda não existir nenhum `ADMIN` no sistema, o **primeiro** "primeiro acesso" promove o perfil a `ADMIN` automaticamente.

Rotas relacionadas:

- `POST /auth/primeiro-acesso`
- `POST /auth/login`
- `GET /auth/me`

## Matricula (por que e obrigatoria)

A matricula funciona como identificador interno estavel. Evita depender de e-mail (que pode mudar).

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

## Cadastro de nao-usuario (detentor de carga, sem login)

Quando a pessoa precisa aparecer em cautela/carga, mas nao deve entrar no sistema:

1. Em **Perfis**, escolha o tipo **Nao-usuario do sistema (detentor/carga)**.
2. Preencha: `matricula`, `nome`, `unidade`, `email` e `cargo`.
3. Cargos padronizados:
   - `Juiz Federal`
   - `Juiz Federal Substituto`
   - `Analista Judiciario`
   - `Tecnico Judiciario`
   - `Militar`
   - `Outro` (com descricao manual)
4. O sistema cria o perfil sem acesso (`ativo=false`, `role=OPERADOR`), preservando rastreabilidade.

Erros de conflito esperados:

- `MATRICULA_DUPLICADA` (HTTP 409): ja existe perfil com a mesma matricula.
- `EMAIL_DUPLICADO` (HTTP 409): ja existe perfil com o mesmo e-mail.

Resultado pratico:
- O perfil pode ser usado em campos como `detentorTemporarioPerfilId` (cautela).
- O perfil nao autentica no login enquanto estiver inativo.

Rotas relacionadas:

- `GET /perfis`
- `POST /perfis`
- `PATCH /perfis/:id`
- `POST /perfis/:id/reset-senha`

Quando o perfil e criado, o backend retorna um JSON parecido com:

```json
{
  "perfil": {
    "id": "uuid",
    "matricula": "9156",
    "nome": "Nome Completo",
    "unidadeId": 2,
    "cargo": "Tecnico",
    "ativo": true
  }
}
```

## Boas praticas de operacao

- Nao crie perfis duplicados com a mesma matricula.
- Ao desligar um operador, marque `ativo=false` (não apague) para manter trilha histórica.
- Se um perfil estiver incorreto (nome/unidade), corrija e registre em observacao/controle interno.

## Perguntas comuns

### "Admin" e um perfil?

No banco, "perfil" e a identidade de quem executa. "Admin" pode ser:

- Um perfil com permissao ampliada no sistema (quando o controle de acesso for ativado).
- Um operador do CloudPanel/Docker (administração da VPS), que é outra camada e não deve se misturar com dados do sistema.

### Onde isso aparece no sistema?

- Em historicos de transferencia (quando um bem muda de carga).
- Em movimentacoes (cautela/transferencia).
- Em eventos/contagens de inventario (quando o modulo estiver com persistencia completa).
