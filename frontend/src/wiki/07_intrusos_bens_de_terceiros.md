<!--
Modulo: wiki
Arquivo: frontend/src/wiki/07_intrusos_bens_de_terceiros.md
Funcao no sistema: definir "intruso" e "bem de terceiro" e como registrar sem violar ATN 303/2008.
Atualizado em: 2026-02-17  (gerenciado pelo wikiMeta.generated.js na UI)
-->

# Intrusos e bens de terceiros

## 1) Intruso (bem STM de outra unidade encontrado na sala)

### Definição

No contexto do sistema, um **intruso** é:

- um bem **tombado (GEAFIN)** e pertencente a uma **unidade A** (carga no banco),
- que foi **encontrado fisicamente** no ambiente inventariado de uma **unidade B**.

Isso é uma **divergência de localização**, não uma transferência automática.

### O que o sistema faz

- Registra ocorrência `ENCONTRADO_EM_LOCAL_DIVERGENTE`.
- Marca `regularizacao_pendente=true`.
- **Não** muda `bens.unidade_dona_id` durante inventário.

Regra legal:

- Art. 185 (AN303_Art185).

## 2) “Bem de terceiro” (o que significa)

### Definição simples

**Bem de terceiro** é um objeto que está no prédio/ambiente, mas **não pertence ao patrimônio da 2ª CJM / STM**.

Exemplos comuns:

- equipamento de empresa contratada (manutenção, TI terceirizada),
- equipamento emprestado por outro órgão/entidade,
- item ainda sem incorporação patrimonial (em análise/documentação).

Base legal (controle segregado):

- Art. 99 (AN303_Art99)
- Art. 110, VI (AN303_Art110_VI)
- Art. 175, IX (AN303_Art175_IX)

### Como registrar no sistema (durante o inventário)

No **Modo Inventário**, use o bloco **"Registrar bem de terceiro (segregado)"** e informe:

- **Descrição** do item
- **Proprietário externo** (empresa/órgão/entidade)
- **Identificador externo** (opcional): etiqueta, número do contrato, patrimônio do terceiro etc.

O sistema:

- cria um registro segregado em `bens` com `eh_bem_terceiro=true` (sem tombamento GEAFIN),
- cria uma contagem no evento com `tipo_ocorrencia='BEM_DE_TERCEIRO'`.

Consulta/auditoria:

- API: `GET /inventario/bens-terceiros`
- View: `vw_bens_terceiros_inventario` (derivada de `contagens`)

Importante:

- **Bem de terceiro não entra na fila de regularização do Art. 185**, porque não é “intruso” de carga STM.
- O objetivo é **visibilidade e controle segregado**, sem misturar com a carga STM.

## 3) Diferença prática: intruso x bem de terceiro

- Intruso: tem tombamento STM e dono (carga) conhecido, mas está no lugar errado.
- Bem de terceiro: não pertence ao patrimônio STM (sem tombamento GEAFIN), deve ficar segregado.

Se tiver dúvida:

1. Procure o tombamento (10 dígitos).
2. Se existe no sistema: trate como intruso quando a unidade divergir.
3. Se não existe e você suspeita que é item externo: registre como bem de terceiro.

## 4) O que acontece depois

Depois do inventário:

- A equipe analisa divergências (intrusos) e regulariza **após ENCERRAR o evento** (Art. 185).
- Bens de terceiros podem exigir ações administrativas (contrato/retirada/termo próprio), mas **não** viram transferência de carga STM.

O inventário registra fatos. A regularização formaliza.

