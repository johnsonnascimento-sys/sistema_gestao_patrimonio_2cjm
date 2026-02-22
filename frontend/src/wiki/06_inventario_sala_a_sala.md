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

- Local cadastrado (lista)
- Unidade inventariada/encontrada (1..4)

Observacao:

- A unidade "encontrada" e a unidade do ambiente sendo inventariado naquele momento.
- Com autenticação ativa, o executor e o usuario logado (nao precisa digitar perfilId).

### 2) Baixar lista da sala (quando suportado)

O sistema pode baixar a lista de bens daquele ambiente para facilitar:

- agrupar por catálogo
- exibir total esperado

Importante (quando vier 0 itens):

- O botão "Baixar catálogo da sala" usa o **local cadastrado** (tabela `locais`) e filtra os bens por `bens.local_id`.
- Se vier **0 itens**, normalmente significa que os bens ainda nao foram vinculados a esse local.
- Para vincular em lote: vá em "Administração do Painel" -> seção "Locais" -> "Vincular bens ao local (em lote)".

Cadastro e manutencao (Admin):

- Na aba **Administracao do Painel**, o Admin pode **criar**, **editar** (inclusive renomear) e **desativar/ativar** locais.
- A desativacao e "soft delete" (nao apaga dados), para nao perder contexto operacional.

Requisito de banco:

- aplicar `database/011_fotos_e_locais.sql` (tabela `locais`)
- aplicar `database/014_locais_crud_soft_delete.sql` (coluna `locais.ativo`)

Offline:

- Se estiver sem internet, o sistema tenta usar o **cache offline** (IndexedDB) da sala.
- Se nao houver cache, voce precisa conectar e baixar o catalogo pelo menos uma vez.

### 3) Scanner e Layout Mobile (input de tombamento)

O modo inventário foi otimizado para dispositivos móveis, agrupando seções secundárias em "Sanfonas" (Accordions) para economizar espaço em tela.

Use o campo de "Bipar tombamento" para inserir o código (10 dígitos). Você pode:
- **Digitar manualmente** e pressionar Enter.
- **Usar Leitor Físico** (pistola USB/Bluetooth), que já envia o Enter no final.
- **Usar a Câmera do Celular (Barcode Scanner nativo)**: botões ao lado do campo ativam a câmera traseira.
  - **Leitura Simples (Single):** O ícone de câmera menor ativa o leitor. Ao ler o código, ele preenche o campo, fecha automaticamente a câmera e submete o registro.
  - **Leitura Contínua (Supermercado):** O ícone constante liga a câmera no modo contínuo. Ela permanece ativa, permitindo passar o celular em várias placas sequencialmente (ideal para agilidade). Obs: Usa foco contínuo automático (`focusMode: "continuous"`) para priorizar a melhor resolução visual do aparelho.

Comportamentos após a leitura:

- Se o bem existe e pertence a mesma unidade do ambiente: marca como encontrado (contagem conforme).
- Se o bem existe mas pertence a outra unidade: alerta de intruso e registra divergência (sem transferir).
- Se o bem não existe (tombamento não cadastrado): registra ocorrência para investigação (dependendo do modo).
- Se o mesmo bem for lido repetidamente na mesma sala, o sistema avisa que j� foi lido e n�o duplica silenciosamente.
- Diverg�ncia considera unidade e sala: se a unidade for igual mas a sala esperada for diferente, o registro � divergente.

Feedback visual na leitura:

- `Conforme` quando unidade e sala conferem.
- `Divergente de sala` quando a sala encontrada difere da sala de carga.
- `Divergente de unidade` quando a unidade encontrada difere da unidade de carga.

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

## Divergencias por sala (lista)

A tela mostra um painel de **Divergencias na sala** com:

Na lista de bens da sala, h� toggles para exibir:

- foto do item
- foto do cat�logo

- Itens divergentes ja persistidos no servidor (fonte `SERVIDOR`).
- Itens divergentes ainda pendentes offline (fonte `PENDENTE`).

Isso ajuda a equipe a:

- enxergar intrusos antes de sair da sala
- preparar a regularizacao pos-inventario (Art. 185)

## O que o operador deve verificar no fim da sala

Antes de sair da sala:

- Se o total encontrado bate com o esperado (por catálogo).
- Se existem divergências registradas (intrusos).
- Se existem itens pendentes de sync (modo offline).

## Bens não identificados e Evidências Visuais (Art. 175)

Se o operador encontrar um bem sem plaqueta de tombamento na sala:
- O sistema permite o registro do item identificando-o como "SEM PLACA".
- **Obrigatoriamente**, o operador deve inserir uma foto clara do bem e uma descrição detalhada.
- Esse registro aparecerá na tela de divergências da sala e, posteriormente, na tela de Regularização, incluindo a foto, descrição e a sala exata onde foi encontrado. 
- Isso garante materialidade e transparência para a comissão decidir o destino do bem perdido. Regra legal: Art. 175.

## Encerramento do inventário

Encerrar inventário é um ato formal (quando a tela/fluxo estiver completo):

- Ele libera novamente transferências (fim do congelamento).
- Ele consolida pendências para regularização.

Guardrail:

- A UI alerta se houver itens pendentes offline e oferece sincronizar antes de encerrar.
- Evite encerrar se ainda houver contagens pendentes de sincronização.

## Alerta de Divergência — Modal Impositivo (Art. 185)

Ao bipar um tombamento pertencente a outra unidade, o sistema:

1. Emite bipe sonoro de alerta.
2. Exibe um **modal bloqueante** com a instrução legal e o número do bem.
3. O operador deve clicar em **"Ciente. Vou manter este bem aqui."** para confirmar que entendeu e não vai mover o bem.

> Não é possível ignorar o modal — ele cobre a tela até ser confirmado.

Regra legal: Art. 185 (AN303_Art185)

## Registrar bem sem identificação (BEM_NAO_IDENTIFICADO)

Durante o inventário, podem aparecer bens sem plaqueta, com etiqueta danificada ou com número ilegível.

### O que fazer

1. No painel **"Sala e scanner"**, role até o bloco **"Registrar bem sem identificação (Divergência)"** (borda vermelho-escura).
2. Preencha:
   - **Descrição detalhada** do bem (marca, cor, estado físico etc.)
   - **Localização exata** dentro da sala (ex.: "perto da janela, mesa 3")
   - **Fotografia** — campo obrigatório (abre câmera no celular ou seletor de arquivo no desktop)
3. Clique em **"Registrar Bem"**.

### O que o sistema faz

- Otimiza e persiste a foto no servidor (WebP, max 1200px).
- Cria um registro em `bens` com `eh_bem_terceiro=true` e `proprietario_externo='SEM_IDENTIFICACAO'`.
- Cria uma contagem com `tipo_ocorrencia='BEM_NAO_IDENTIFICADO'` e `regularizacao_pendente=true`.
- O item aparece automaticamente na lista de divergências da sala.

Regra legal: Art. 175, IX (AN303_Art175_IX)

### Instrução operacional

Assim como nos intrusos, **não mova o bem** até o encerramento do inventário. A regularização ocorre após o encerramento, via fila de forasteiros/disparidades.

## Administracao: relatorio por evento selecionado

Na tela "Inventario - Administracao":

- o painel de relatorio fica visivel tambem para evento `EM_ANDAMENTO` (nao apenas encerrado);
- ao clicar em "Relatorio" no historico, o sistema troca o painel para o inventario escolhido;
- na grade de divergencias, os campos principais incluem `Nome Resumo` (`bens.nome_resumo`) e `Descricao` (`bens.descricao_complementar`).
