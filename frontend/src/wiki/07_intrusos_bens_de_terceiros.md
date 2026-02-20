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

## 3) Bem sem identificação / plaqueta ilegível (Art. 175)

### Definição

**Bem sem identificação** é um objeto encontrado fisicamente no ambiente durante o inventário que:

- não possui plaqueta de tombamento visível, ou
- tem etiqueta danificada/ilegível impossibilitando a leitura do número.

Não é um bem STM com tombamento em outro local (isso é intruso) — é um bem que não pode ser identificado diretamente.

Base legal (controle obrigatório de bens no ambiente):

- Art. 175, IX (AN303_Art175_IX)

### Como registrar no sistema

No **Modo Inventário**, role até o bloco **"Registrar bem sem identificação (Divergência)"** (borda vermelha) e informe:

- **Descrição detalhada** do bem (tipo, cor, marca, condição física)
- **Localização exata** dentro da sala (ex.: "canto esquerdo, perto da janela")
- **Fotografia** — **obrigatória** (Art. 175)

O sistema:

- persiste a foto otimizada no servidor,
- cria registro em `bens` com `eh_bem_terceiro=true`, `proprietario_externo='SEM_IDENTIFICACAO'`,
- cria contagem com `tipo_ocorrencia='BEM_NAO_IDENTIFICADO'` e `regularizacao_pendente=true`,
- item aparece na lista de divergências da sala.

Instrução operacional:

> **Não mova o bem.** Ele deve permanecer no local encontrado até o encerramento do inventário para fins de regularização.

## 4) O que acontece depois

Depois do inventário:

- A equipe analisa divergências (intrusos) e regulariza **após ENCERRAR o evento** (Art. 185).
- Bens sem identificação ficam na fila de regularização — a equipe realizará diligência posterior (consulta ao GEAFIN, buscas administrativas).
- Bens de terceiros podem exigir ações administrativas (contrato/retirada/termo próprio), mas **não** viram transferência de carga STM.

O inventário registra fatos. A regularização formaliza.

