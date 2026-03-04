<!--
Módulo: wiki
Arquivo: frontend/src/wiki/10_solucao_problemas.md
Função no sistema: troubleshooting para usuário e admin (sem expor segredos).
-->

# Solução de problemas (FAQ)

## "Failed to fetch" ou "Erro interno no servidor"

Significado:

- o frontend não conseguiu falar com o backend via `/api`.

Checklist:

1. abrir **Administração do Painel** e testar `/health`;
2. se falhar, validar backend, proxy Nginx e rede.

## "401 Não autenticado" ou "403 Sem permissão"

- `401`: fazer login novamente.
- `403`: perfil logado sem permissão para a ação.

## "Não entendi o que é Role ACL"

Resumo:

- `Role ACL` é o nível de acesso efetivo (o que o usuário pode ver e fazer).
- `Salvar ACL` grava a role no perfil selecionado.

Exemplos:

- `LEITURA`: consulta.
- `OPERADOR_AVANCADO`: solicita ações sensíveis.
- `ADMIN_COMPLETO`: acesso total.

## "Formato do tombamento inválido"

Padrão esperado:

- exatamente 10 dígitos numéricos (ex.: `1290001788`).

## Modo inventário fica em branco

Passos rápidos:

1. `Ctrl+F5`;
2. limpar dados do site (cache/storage);
3. validar deploy completo.

## "Falha ao renderizar esta seção"

1. clicar em **Tentar novamente**;
2. se persistir, **Recarregar página**;
3. se ainda persistir, `Ctrl+F5`.

## "202 PENDENTE_APROVACAO" ao salvar alteração

Significado:

- perfil pode solicitar, mas não executar diretamente.

Fluxo:

1. informar `justificativaSolicitante`;
2. enviar solicitação;
3. admin decide em `Aprovações Pendentes`.

## "JUSTIFICATIVA_SOLICITANTE_OBRIGATORIA"

- preencher justificativa antes de reenviar.

## "SOLICITACAO_STATUS_INVALIDO"

- a solicitação já foi decidida;
- atualizar a grade e conferir status atual.

## Micro-inventário: erro ao criar evento

Sintoma:

- erro em `POST /inventario/eventos`.

Causa comum:

- trigger de validação de operadores desatualizado.

Correção:

- aplicar migration `023_fix_trigger_validar_operadores_evento.sql`.

## Não aparece divergência interunidades no painel novo

Checklist:

1. confirmar que a divergência foi registrada no inventário;
2. testar filtro de status com `TODOS`;
3. se não for admin, verificar se a divergência envolve sua unidade;
4. clicar em `Atualizar`.

Observação:

- painel interunidades é de monitoramento;
- regularização formal ocorre após encerramento.

## Encerrar ou cancelar inventário falha

Comportamento esperado:

- ação exige confirmação forte no modal.

Se falhar:

1. confirmar inventário selecionado;
2. tentar novamente;
3. registrar `requestId` no log de erros para diagnóstico.
