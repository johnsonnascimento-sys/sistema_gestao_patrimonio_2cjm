<!--
Modulo: wiki
Arquivo: frontend/src/wiki/08_wizard_art141.md
Funcao no sistema: orientar uso do Wizard de classificacao de inserviveis (Art. 141) com persistencia e auditoria.
Atualizado em: 2026-02-17  (gerenciado pelo wikiMeta.generated.js na UI)
-->

# Wizard Art. 141 (classificação de inservíveis)

## 1) Por que existe um wizard

Classificar um bem como inservível (ocioso/recuperável/antieconômico/irrecuperável) tem impacto operacional e documental.

Para reduzir erro humano e garantir conformidade, o sistema usa um **fluxo guiado** (wizard).

Base legal:

- Art. 141, Caput (AN303_Art141_Cap)
- Art. 141, I (AN303_Art141_I)
- Art. 141, II (AN303_Art141_II)
- Art. 141, III (AN303_Art141_III)
- Art. 141, IV (AN303_Art141_IV)

## 2) Como usar (passo a passo)

1. Abra a aba **Wizard Art. 141**.
2. Em **Seleção do bem**, informe o **tombamento (10 dígitos)** e clique em **Carregar bem**.
3. Confirme se o bem exibido é o correto (catálogo, unidade e local).
4. Clique em **Iniciar wizard para este bem**.
5. Responda o questionário.
6. Clique em **Salvar classificação**.

Resultado:

- O sistema grava uma **avaliação** no banco e atualiza `bens.tipo_inservivel` como estado atual.

## 3) O que o sistema registra (auditoria)

No mínimo:

- `bem_id`
- `tipo_inservivel`
- `justificativa`
- `criterios` (respostas do wizard)
- data/hora (`avaliado_em`)
- executor (`avaliado_por_perfil_id`, quando autenticado)

Importante:

- O Wizard **não efetiva baixa automaticamente**. A baixa é etapa administrativa posterior (documentos, autorização etc.).

## 4) Evidências (opcional, recomendado)

Se existir laudo/foto/arquivo no Drive vinculado à avaliação, registre o link para auditoria.

Como:

- UI: após salvar a avaliação, usar o bloco **"Evidência (opcional)"** e colar a URL do Drive.
- API: `POST /documentos` com `avaliacaoInservivelId`.

Pré-requisito:

- Aplicar a migration `database/013_documentos_avaliacoes_inserviveis.sql`.

