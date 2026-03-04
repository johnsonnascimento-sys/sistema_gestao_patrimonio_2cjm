<!--
Modulo: wiki
Arquivo: frontend/src/wiki/07_intrusos_bens_de_terceiros.md
Funcao no sistema: definir "intruso" e "bem de terceiro" e como registrar sem violar ATN 303/2008.
Atualizado em: 2026-02-17  (gerenciado pelo wikiMeta.generated.js na UI)
-->

# Intrusos e bens de terceiros

## 1) Intruso (bem STM de outra unidade encontrado na endereço)

### DefiniÃ§Ã£o

No contexto do sistema, um **intruso** Ã©:

- um bem **tombado (GEAFIN)** e pertencente a uma **unidade A** (carga no banco),
- que foi **encontrado fisicamente** no ambiente inventariado de uma **unidade B**.

Isso Ã© uma **divergÃªncia de localizaÃ§Ã£o**, nÃ£o uma transferÃªncia automÃ¡tica.

### O que o sistema faz

- Registra ocorrÃªncia `ENCONTRADO_EM_LOCAL_DIVERGENTE`.
- Marca `regulariza?o_pendente=true`.
- **NÃ£o** muda `bens.unidade_dona_id` durante inventÃ¡rio.

Regra legal:

- Art. 185 (AN303_Art185).

## 2) â€œBem de terceiroâ€ (o que significa)

### DefiniÃ§Ã£o simples

**Bem de terceiro** Ã© um objeto que estÃ¡ no prÃ©dio/ambiente, mas **nÃ£o pertence ao patrimÃ´nio da 2Âª CJM / STM**.

Exemplos comuns:

- equipamento de empresa contratada (manutenÃ§Ã£o, TI terceirizada),
- equipamento emprestado por outro Ã³rgÃ£o/entidade,
- item ainda sem incorporaÃ§Ã£o patrimonial (em anÃ¡lise/documentaÃ§Ã£o).

Base legal (controle segregado):

- Art. 99 (AN303_Art99)
- Art. 110, VI (AN303_Art110_VI)
- Art. 175, IX (AN303_Art175_IX)

### Como registrar no sistema (durante o inventÃ¡rio)

No **Modo InventÃ¡rio**, use o bloco **"Registrar bem de terceiro (segregado)"** e informe:

- **DescriÃ§Ã£o** do item
- **ProprietÃ¡rio externo** (empresa/Ã³rgÃ£o/entidade)
- **Identificador externo** (opcional): etiqueta, nÃºmero do contrato, patrimÃ´nio do terceiro etc.

O sistema:

- cria um registro segregado em `bens` com `eh_bem_terceiro=true` (sem tombamento GEAFIN),
- cria uma contagem no evento com `tipo_ocorrencia='BEM_DE_TERCEIRO'`.

Consulta/auditoria:

- API: `GET /inventario/bens-terceiros`
- View: `vw_bens_terceiros_inventario` (derivada de `contagens`)

Importante:

- **Bem de terceiro nÃ£o entra na fila de regularizaÃ§Ã£o do Art. 185**, porque nÃ£o Ã© â€œintrusoâ€ de carga STM.
- O objetivo Ã© **visibilidade e controle segregado**, sem misturar com a carga STM.

## 3) Bem sem identificaÃ§Ã£o / plaqueta ilegÃ­vel (Art. 175)

### DefiniÃ§Ã£o

**Bem sem identificaÃ§Ã£o** Ã© um objeto encontrado fisicamente no ambiente durante o inventÃ¡rio que:

- nÃ£o possui plaqueta de tombamento visÃ­vel, ou
- tem etiqueta danificada/ilegÃ­vel impossibilitando a leitura do nÃºmero.

NÃ£o Ã© um bem STM com tombamento em outro local (isso Ã© intruso) â€” Ã© um bem que nÃ£o pode ser identificado diretamente.

Base legal (controle obrigatÃ³rio de bens no ambiente):

- Art. 175, IX (AN303_Art175_IX)

### Como registrar no sistema

No **Modo InventÃ¡rio**, role atÃ© o bloco **"Registrar bem sem identificaÃ§Ã£o (DivergÃªncia)"** (borda vermelha) e informe:

- **DescriÃ§Ã£o detalhada** do bem (tipo, cor, marca, condiÃ§Ã£o fÃ­sica)
- **LocalizaÃ§Ã£o exata** dentro da endereço (ex.: "canto esquerdo, perto da janela")
- **Fotografia** â€” **obrigatÃ³ria** (Art. 175)

O sistema:

- persiste a foto otimizada no servidor,
- cria registro em `bens` com `eh_bem_terceiro=true`, `proprietario_externo='SEM_IDENTIFICACAO'`,
- cria contagem com `tipo_ocorrencia='BEM_NAO_IDENTIFICADO'` e `regulariza?o_pendente=true`,
- item aparece na lista de divergÃªncias da endereço.

InstruÃ§Ã£o operacional:

> **NÃ£o mova o bem.** Ele deve permanecer no local encontrado atÃ© o encerramento do inventÃ¡rio para fins de regularizaÃ§Ã£o.

## 4) O que acontece depois

Depois do inventÃ¡rio:

- A equipe analisa divergÃªncias (intrusos) e regulariza **apÃ³s ENCERRAR o evento** (Art. 185).
- Bens sem identificaÃ§Ã£o ficam na fila de regularizaÃ§Ã£o â€” a equipe realizarÃ¡ diligÃªncia posterior (consulta ao GEAFIN, buscas administrativas).
- Bens de terceiros podem exigir aÃ§Ãµes administrativas (contrato/retirada/termo prÃ³prio), mas **nÃ£o** viram transferÃªncia de carga STM.

O inventÃ¡rio registra fatos. A regularizaÃ§Ã£o formaliza.


