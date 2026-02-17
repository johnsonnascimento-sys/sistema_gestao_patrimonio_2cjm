<!--
Modulo: wiki
Arquivo: frontend/src/wiki/07_intrusos_bens_de_terceiros.md
Funcao no sistema: definir "intruso" e "bem de terceiro" e como registrar sem violar as regras do ATN 303/2008.
-->

# Intrusos e bens de terceiros

## 1) Intruso (bem STM de outra unidade encontrado na sala)

### Definição

Um **intruso** (no contexto do sistema) é:

- Um bem **tombado (GEAFIN) e pertencente a uma unidade A** (carga no banco),
- mas que foi **encontrado fisicamente** no ambiente inventariado de uma unidade B.

Isso é uma **divergência de localização**, não uma transferência automática.

### O que o sistema faz

- Registra ocorrência `ENCONTRADO_EM_LOCAL_DIVERGENTE`.
- Marca `regularizacao_pendente=true`.
- Não muda `unidade_dona_id` durante inventário.

Regra legal:

- Art. 185 (AN303_Art185).

## 2) Bem de terceiro (o que significa)

### Definição simples

**Bem de terceiro** é um objeto que está no prédio/ambiente, mas **não pertence ao patrimônio da 2ª CJM / STM**.

Exemplos comuns:

- Equipamento de empresa contratada (manutenção, TI terceirizada).
- Equipamento emprestado por outro órgão/entidade.
- Equipamento doado/cedido ainda sem incorporação patrimonial.

Base legal (controle segregado):

- Art. 99 (AN303_Art99).
- Art. 110, VI (AN303_Art110_VI).
- Art. 175, IX (AN303_Art175_IX).

### Como registrar no sistema (durante o inventário)

No **Modo Inventário**, use o bloco **"Registrar bem de terceiro (segregado)"** e informe:

- **Descrição** do item.
- **Proprietário externo** (empresa/órgão/entidade).
- **Identificador externo** (opcional): etiqueta, número do contrato, patrimônio do terceiro etc.

O sistema:

- Cria um registro segregado em `bens` com `eh_bem_terceiro=true` (sem tombamento GEAFIN).
- Cria uma contagem no evento com `tipo_ocorrencia='BEM_DE_TERCEIRO'`.

Importante:

- **Bem de terceiro não entra na fila de regularização do Art. 185** (porque não é "intruso" de carga STM).
- Ele existe para **visibilidade e controle segregado**.

## 3) Diferença prática: intruso x bem de terceiro

- Intruso: tem tombamento STM e dono (carga) conhecido, mas está no lugar errado.
- Bem de terceiro: não pertence ao patrimônio STM (sem tombamento GEAFIN), deve ficar segregado.

Se tiver dúvida:

1. Procure o tombamento (10 dígitos).
2. Se existe no sistema: trate como intruso quando unidade divergir.
3. Se não existe e você suspeita que é item externo: registre como bem de terceiro.

## 4) O que acontece depois

Depois do inventário:

- A equipe analisa divergências (intrusos) e regulariza quando o evento for ENCERRADO.
- Bens de terceiros podem exigir ações administrativas (contrato, retirada, termo próprio), mas não viram transferência de carga STM.

O inventário registra fatos. A regularização formaliza.

