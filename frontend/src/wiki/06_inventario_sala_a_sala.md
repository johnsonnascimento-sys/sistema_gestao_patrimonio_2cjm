<!--
Modulo: wiki
Arquivo: frontend/src/wiki/06_inventario_sala_a_sala.md
Funcao no sistema: manual do inventario com UX agrupada por catalogo (SKU) e fluxo deterministico.
-->

# Inventário sala a sala (modo agrupado por catálogo)

## Objetivo do modo inventário

O modo inventario existe para conferencia fisica "sala a sala" com rastreabilidade e respeito ao ATN 303:

- Registrar o que foi encontrado em cada ambiente.
- Identificar divergências sem "consertar no grito".
- Produzir base para regularização posterior (termos/documentos).

## Regra-chave (congelamento)

Durante inventário `EM_ANDAMENTO`, **transferências** ficam bloqueadas pelo banco.

- Regra legal: Art. 183 (AN303_Art183)

Na pratica:

- Você ainda pode registrar contagens e divergências.
- Você não pode mudar a carga do bem (unidade dona) enquanto o inventário está em andamento.

## Filosofia visual: agrupamento por catálogo (SKU)

### Problema que o agrupamento resolve

Uma sala pode ter 50 cadeiras. Se o sistema listar 50 linhas, o operador perde tempo e se confunde.

### Solução

Mostrar um resumo por catalogo:

- "Cadeira executiva marrom (Total: 20)"
- Status: "18 encontrados | 2 faltantes"
- Botao para expandir e ver tombamentos individuais (checklist)

Isso garante:

- velocidade (olho humano reconhece grupos rapidamente)
- menos rolagem
- menos erro humano

## Fluxo operacional (passo a passo)

### 1) Selecionar sala/ambiente

No inventario, selecione:

- Sala/ambiente (texto livre ou lista, conforme a tela atual)
- Unidade inventariada/encontrada (1..4)

Observacao:

- A unidade "encontrada" e a unidade do ambiente sendo inventariado naquele momento.

### 2) Baixar lista da sala (quando suportado)

O sistema pode baixar a lista de bens daquele ambiente para facilitar:

- agrupar por catálogo
- exibir total esperado

### 3) Scanner (input de tombamento)

Use o campo de scanner para bipar ou digitar o tombamento (10 dígitos).

Comportamentos:

- Se o bem existe e pertence a mesma unidade do ambiente: marca como encontrado (contagem conforme).
- Se o bem existe mas pertence a outra unidade: alerta de intruso e registra divergência (sem transferir).
- Se o bem não existe (tombamento não cadastrado): registra ocorrência para investigação (dependendo do modo).

## Intruso no inventário (Art. 185)

Se um bem de outra unidade está na sala:

- Não transfira carga durante inventário.
- Registre a divergência e deixe pendente para regularização.

Regra legal:

- Art. 185 (AN303_Art185)

## Offline-first (quando habilitado)

Em ambiente com internet instável:

- O sistema pode guardar bipes em cache local (IndexedDB).
- Quando a internet voltar, ele sincroniza as contagens.

Importante:

- O operador deve sempre ver a fila pendente (quantidade).
- A sincronização deve ser determinística (sem "reconciliação inteligente").

## O que o operador deve verificar no fim da sala

Antes de sair da sala:

- Se o total encontrado bate com o esperado (por catálogo).
- Se existem divergências registradas (intrusos).
- Se existem itens pendentes de sync (modo offline).

## Encerramento do inventário

Encerrar inventário é um ato formal (quando a tela/fluxo estiver completo):

- Ele libera novamente transferências (fim do congelamento).
- Ele consolida pendências para regularização.

Nunca encerre se ainda houver contagens pendentes de sincronização.
