<!--
Modulo: wiki
Arquivo: frontend/src/wiki/03_consulta_bens.md
Funcao no sistema: orientar uso da tela "Consulta de Bens" e detalhamento.
-->

# Consulta de bens

## Para que serve

Esta Ã© a tela do dia a dia para:

- Encontrar um bem pelo tombamento (10 digitos).
- Pesquisar por palavras na descriÃ§Ã£o.
- Ver unidade (carga), local fÃ­sico e status.
- Abrir detalhes completos quando precisar auditar/entender o histÃ³rico.

## Como pesquisar corretamente

### 1) Tombamento (10 dÃ­gitos)

- Digite **somente nÃºmeros**, com **10 dÃ­gitos**.
- Exemplo valido: `1290001788`
- Exemplo invÃ¡lido: `TMB-00772` (isso nÃ£o Ã© tombamento GEAFIN; Ã© outro tipo de numeraÃ§Ã£o/etiqueta)

Se vocÃª colar algo com espaÃ§os/pontos/traÃ§os, o sistema pode limpar e manter apenas os dÃ­gitos. Se ainda assim nÃ£o der 10 dÃ­gitos, vai avisar.

### 2) Texto na descriÃ§Ã£o

Use termos de busca:

- "PROJETOR"
- "NOTEBOOK"
- "ARMARIO"

RecomendaÃ§Ã£o: use palavras bem distintivas para reduzir resultados.

### 3) Local (texto do GEAFIN / local_fisico)

Use este campo para filtrar pelo **texto** de localizaÃ§Ã£o que veio do GEAFIN (coluna `local_fisico`).

Exemplos:

- "endereço 101"
- "Hall 6Âº Andar"
- "Almox"

Importante:

- Este campo Ã© **separado** da descriÃ§Ã£o do bem. NÃ£o use "descriÃ§Ã£o" para procurar local.

### 4) Filtro por unidade

Use quando vocÃª quer ver apenas itens de uma unidade (carga).


### 5) Filtro por responsavel

- Digite matr?cula ou nome do responsavel patrimonial.
- Selecione o perfil sugerido para filtrar com precisao.
- O resultado lista apenas bens associados ao responsavel selecionado.

## Entendendo as colunas

As colunas visiveis na lista sao um "resumo operacional". O sistema guarda mais campos no detalhe.

Campos tÃ­picos no resumo:

- Tombo (tombamento)
- DescriÃ§Ã£o (do catÃ¡logo ou descriÃ§Ã£o consolidada)
- Unidade (carga)
- Local (local fisico)
- Responsavel (matr?cula/nome)
- Tombo antigo (Azul) (`cod2Aud`)
- Catï¿½logo (SKU)
- Status (OK/EM_CAUTELA/BAIXADO/AGUARDANDO_RECEBIMENTO quando aplicavel)

Na grade de resultados, vocï¿½ pode habilitar:

- Foto do item
- Foto do catï¿½logo

Essas opï¿½ï¿½es ficam acima da tabela e valem para toda a listagem (nï¿½o apenas no modal).

## Ver mais detalhes (modal "Detalhes")

Quando vocÃª clicar em **Detalhes**, o sistema abre um painel com:

- Dados completos do bem
- Dados do catÃ¡logo (marca/modelo/descriÃ§Ã£o Ãºnica)
- HistÃ³rico de movimentaÃ§Ãµes (cautela/transferÃªncia)
- HistÃ³rico de transferÃªncias de carga (quando aplicÃ¡vel)

Use isso quando precisar:

- Confirmar que um bem mudou de unidade (auditoria).
- Entender se estÃ¡ em cautela e com quem.
- Checar o que aconteceu em datas anteriores.
Quando o status do bem for `EM_CAUTELA`, o modal mostra o bloco **Cautela atual** com:

- `detentorTemporarioPerfilId`
- matr?cula e nome do detentor
- data prevista de devolucao (ou "Sem data prevista")

## Linha do tempo de altera?es e reversao (modal)

No modal de detalhes, ha uma secao **Linha do tempo de altera?es** com:

- Quem alterou (`executorNome`/matr?cula quando disponivel)
- Data e hora da altera?o
- O que mudou (campo, valor antes, valor depois)
- Origem da altera?o (tabela/opera?o auditada)

Modo de reversao item-a-item (ADMIN):

- Cada registro elegivel exibe o botao **Reverter esta altera?o**
- A reversao cria nova trilha de auditoria (n?o apaga historico)
- Recomenda-se reverter apenas altera?es indevidas, validando antes no proprio diff

## Editar bem (ADMIN)

No modal de detalhes, usuarios `ADMIN` podem editar os campos operacionais do bem (exceto chaves), incluindo:

- Material (SKU) via busca por codigo
- endereço/Local (padronizado) via tabela locais
- Responsavel patrimonial por busca de matr?cula ou nome (com dupla confirma?o na associa?o)
- Contrato / data / valor de aquisicao
- Observa?es (texto livre relacionado ao bem)
- Fotos (item e referencia do SKU)

Importante no modal:

- Unidade (carga) e status aparecem bloqueados e exigem o fluxo proprio em Movimenta?es.
- Nome Resumo e Descri?o sao exibidos em modo leitura e devem ser alterados no menu Material (SKU).
- A descri?o exibida no modal vem da ficha do Material (SKU).
- Responsavel patrimonial indica posse operacional no dia a dia, sem cautela ativa.
- Usuarios selecionados como responsavel devem estar cadastrados em Administra?o do Painel -> Perfis e Acessos.
- Cautela e outro fluxo: fica registrada em Movimenta?es com detentor temporario e status EM_CAUTELA.
- Em CAUTELA_SAIDA, o responsavel patrimonial e preenchido automaticamente com o detentor da cautela.
- Em CAUTELA_RETORNO, o sistema pergunta se deve manter o mesmo responsavel patrimonial.

## Fotos (item e referencia do SKU)

No mesmo modal, o `ADMIN` pode:

- **Tirar foto** na hora (celular) ou **Enviar arquivo** (galeria/computador).
- A imagem Ã© **automaticamente otimizada** (redimensionada para max 1200px e convertida para WebP) e salva no servidor VPS.
- **Remover foto**: Clique no botÃ£o "Remover foto" para desvincular a imagem do bem. A alteraÃ§Ã£o serÃ¡ efetivada ao clicar em "Salvar alteraÃ§Ãµes do bem".

OBS: O sistema armazena as fotos localmente no servidor para maior performance e privacidade.

## Dicas de uso (opera?o rapida)

- Se vocÃª estiver no inventÃ¡rio e nÃ£o encontrou um item, use a Consulta para ver "onde deveria estar" e "onde estÃ¡ cadastrado".
- Se o bem aparecer com status `AGUARDANDO_RECEBIMENTO`, significa que veio do GEAFIN mas ainda nÃ£o foi localizado/recebido fisicamente.
## Leitor de codigo de barras (scanner fisico)

No campo **Tombamento (10) ou Etiqueta (4)**:

- O sistema aceita leitura continua por scanner de bancada/pistola (modo teclado).
- O sufixo de leitura com Enter, Tab **ou** Ctrl+J dispara a consulta automaticamente.
- Apos cada leitura, o foco volta para o mesmo campo para o proximo bip.

- Observa?o: alguns leitores wireless enviam Ctrl+J; o sistema bloqueia o atalho de Downloads do navegador durante a leitura.







