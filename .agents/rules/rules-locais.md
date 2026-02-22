---
trigger: always_on
---

# Regras locais do repositorio

## 1) Fonte de verdade

- Sempre obedecer `PROJECT_RULES.md`.
- Em caso de conflito entre implementacao e documentacao, atualizar os dois no mesmo commit.

## 2) Regra Wiki-First (obrigatoria)

- Qualquer mudanca em UX, endpoint, contrato de resposta ou fluxo operacional exige update da wiki no mesmo PR/commit.
- Nao publicar segredo em wiki/rules (senha, token, chave, URL privada com credencial).

Arquivos wiki prioritarios deste projeto:

- `frontend/src/wiki/06_inventario_sala_a_sala.md`
- `frontend/src/wiki/09_relatorios_auditoria.md`
- `frontend/src/wiki/15_referencia_api.md`

## 3) Linha do tempo de auditoria de bens

Padrao de exibicao:

- Mostrar nome/rotulo no lugar de UUID bruto para referencias de `local`, `perfil`, `catalogo` e `bem`.
- Nao exibir UUID cru por padrao na grade.
- Permitir consulta do UUID por mecanismo secundario (tooltip/foco/copia), sem poluir a leitura principal.

Padrao de dados:

- Eventos `INSERT` e `DELETE` precisam gerar entrada estruturada em `changes[]` para nao aparecer timeline "vazia".
- Para `UPDATE`, manter diff por campo com `before` e `after`.
- Sempre tentar resolver o ator responsavel por nome/matricula quando houver `perfil_id` relacionado.

## 4) Inventario - Administracao

- O painel de relatorio deve funcionar para eventos `EM_ANDAMENTO` e `ENCERRADO`.
- Ao selecionar evento antigo no historico, o relatorio deve trocar para o evento selecionado.
- Na grade de divergencias da Regularizacao, `Catalogo (SKU)` deve mostrar apenas o codigo.
- Na grade de divergencias da Regularizacao, `Descricao / Resumo` deve priorizar `bens.nome_resumo` e usar descricao complementar como detalhe.
- Em listagens de bens, oferecer opcao de exibir foto do item e foto do catalogo.
- Links de foto devem passar por `getFotoUrl` para normalizar URLs legadas (localhost/container).

## 5) Publicacao

Antes de deploy:

- Validar backend (`node --check`) e frontend (`npm run build`).
- Fazer commit com escopo claro.
- Fazer push da branch principal.
- Executar deploy na VPS e validar `/health`.
