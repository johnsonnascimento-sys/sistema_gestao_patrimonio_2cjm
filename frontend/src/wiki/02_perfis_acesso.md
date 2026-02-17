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

## Matricula (por que e obrigatoria)

A matricula funciona como identificador interno estavel. Evita depender de e-mail (que pode mudar).

## Unidades (1..4)

O sistema trabalha com 4 unidades:

- 1: 1a Aud
- 2: 2a Aud
- 3: Foro
- 4: Almox

## Como criar um perfil (fluxo do sistema)

Dependendo da tela/fluxo implementado no momento, voce pode criar um perfil por uma operacao no painel (API/operacoes) ou via rota administrativa.

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
