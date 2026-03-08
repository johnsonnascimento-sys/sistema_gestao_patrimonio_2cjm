# Checklist de Entrega Estrutural

## Cabecalho

- Modulo: `docs`
- Arquivo: `docs/CHECKLIST_ENTREGA_ESTRUTURAL.md`
- Funcao no sistema: padronizar gates minimos para entregas estruturais, de runtime, UX e operacao.

## Quando usar

Use este checklist em toda entrega que toque:

- backend
- frontend
- banco
- scripts operacionais
- deploy
- wiki/manual

## Pre-check

1. Confirmar branch de trabalho e entender se ha mudancas locais nao relacionadas.
2. Confirmar que a entrega possui escopo fechado e reversao planejada.
3. Confirmar se a mudanca afeta runtime, UX, deploy, governanca ou compliance.

## Gates tecnicos minimos

1. Backend:
   - `npm --prefix backend run check`
   - `npm --prefix backend test` quando houver suite disponivel
2. Frontend:
   - `npm --prefix frontend run build`
   - `npm --prefix frontend test` quando houver suite disponivel
3. Governanca:
   - `python scripts/check_wiki_encoding.py`
   - `node scripts/validate_governance.js`

## Documentacao obrigatoria no mesmo ciclo

1. Atualizar a wiki aplicavel em `frontend/src/wiki/`.
2. Atualizar `docs/LOG_GERAL_ALTERACOES.md`.
3. Registrar reversao sugerida.
4. Regenerar metadados da wiki se houver mudanca em `frontend/src/wiki/`:
   - `node frontend/scripts/generate_wiki_meta.cjs`

## Deploy oficial

Fluxo padrao:

1. `git push`
2. na VPS: `git pull --ff-only`
3. `./scripts/vps_deploy.sh all`
4. validar:
   - `curl http://127.0.0.1:3001/health`
   - `curl -I https://patrimonio2cjm.johnsontn.com.br/`

Deploy por upload direto:

- permitido apenas como contingencia operacional;
- deve registrar explicitamente `manual_upload` no log e no `/health`;
- deve ser seguido de reconciliacao para voltar o host a um estado Git reproduzivel.

## Alvos de decomposicao

- arquivo backend critico: alvo intermediario `< 1200` linhas
- componente frontend critico: alvo intermediario `< 900` linhas
- hook/helper visual: alvo `< 300` linhas

## Definicao de pronto

Uma entrega estrutural so esta pronta quando:

1. os gates tecnicos passaram;
2. wiki e log foram atualizados;
3. a reversao esta clara;
4. o deploy oficial e reproduzivel;
5. o `/health` reflete a versao e o metodo de deploy.
