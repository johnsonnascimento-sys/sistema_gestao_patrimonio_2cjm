<!--
Modulo: wiki
Arquivo: frontend/src/wiki/10_solucao_problemas.md
Funcao no sistema: troubleshooting focado no usuario e no admin (sem expor segredos).
-->

# Solução de problemas (FAQ)

## "Failed to fetch" / "Erro interno no servidor"

O que significa:

- O frontend não conseguiu falar com o backend via `/api`.

Checklist rapido:

1. Abra **Administração do Painel** (antiga "Operações API") e clique em **Testar /health**.
2. Se falhar, o problema e conectividade/proxy/backend.

Possiveis causas:

- Backend fora do ar.
- Proxy Nginx sem `location /api/`.
- Timeout do proxy em operacao longa.

## "401 Nao autenticado" / "403 Sem permissao"

Quando acontece:

- A VPS esta com autenticacao ativa (`AUTH_ENABLED=true`).

O que fazer:

- `401`: faca login (ou refaca o login se o token expirou).
- `403`: voce esta logado, mas a operacao exige `ADMIN` (ex.: importacao GEAFIN, criar perfis, regularizacao pos-inventario).

Dica:

- Se o navegador ficou com um token antigo, use o botao **Sair** e entre novamente.

## "504 Gateway Time-out" ao importar GEAFIN

O que significa:

- O proxy Nginx encerrou a conexao antes do backend terminar.

Solução:

- Aumentar timeouts de proxy (host Nginx e/ou Nginx do container).
- Garantir `proxy_request_buffering off` para upload.

## "Formato do tombamento inválido"

O tombamento GEAFIN esperado é:

- exatamente 10 dígitos numéricos (ex.: `1290001788`).

Se você digitou algo como `TMB-00772`, isso não é o mesmo padrão. Procure o tombamento no documento/etiqueta correta.

Observação (scanner/colar):
- O campo de scanner/registro remove automaticamente caracteres não numéricos (espaços, hífens, quebras de linha).
- Se ainda assim não registrar, confira se o número final tem exatamente 10 dígitos (nem 9, nem 11).

## Barra de progresso some ao dar refresh

O progresso depende do ultimo registro de importacao no banco.

Se sumir:

- Verifique se existe uma importacao em andamento ou concluida no endpoint de progresso (admin).
- Se a pagina estiver usando cache, force recarregar (Ctrl+F5).

## Modo Inventário fica em branco

Sintoma:

- Ao clicar em "Modo Inventário", a área principal fica vazia.

O que significa:

- Normalmente é erro de JavaScript no navegador ou um deploy incompleto.

O que fazer (rápido):

1. Force refresh (Ctrl+F5).
2. Se continuar, limpe os dados do site (DevTools -> Application -> Clear storage) e recarregue.
3. Confirme que o deploy foi feito com `./scripts/vps_deploy.sh all`.

## "Falha ao renderizar esta seção. Recarregue a página para atualizar os scripts."

Quando acontece:

- A aba carregou com script antigo em cache ou houve erro de execução pontual em uma seção.

O que fazer:

1. Clique em **Tentar novamente** na própria mensagem.
2. Se persistir, clique em **Recarregar página**.
3. Se ainda persistir, faça Ctrl+F5 e depois limpe cache/storage do site.

## "Un" ao lado do botão Importar

Isso é um fragmento visual do layout atual (botão/rótulo) e não representa uma unidade.

Se aparecer sem funcao:

- Pode ser removido/renomeado em melhoria de UX.

## Inventário: "Bem de Terceiro" (não entendi)

Veja a pagina:

- Intrusos e bens de terceiros

Resumo:

- Bem de terceiro e item externo ao patrimonio, registrado segregado para controle.

## Logs: onde cada alteracao aparece

Se uma alteracao nao aparece onde voce esperava, valide o tipo de log:

- **Log Geral de Alteracoes**: mudancas de sistema/projeto (commits, deploys, docs, UX).
- **Auditoria Patrimonial (Global)**: mudancas de dados do patrimonio (contrato, local, status, unidade, etc.).
- **Linha do tempo do bem (detalhe)**: visao completa daquele bem especifico.

Dica pratica:

1. Se o objetivo e achar "quem alterou um tombo", comece pela **Auditoria Patrimonial (Global)** com filtro de tombamento.
2. Se o objetivo e auditoria de entrega/deploy, use o **Log Geral de Alteracoes**.

## Erro recorrente (FORMATO_INVALIDO)

Se aparecer **"Formato invalido em campo enviado"**:

1. Abra **Auditoria e Logs** -> **Log de Erros Runtime (API)**.
2. Copie o `requestId` da linha do erro.
3. Correlacione com `docker logs -f cjm_backend` na VPS para diagnostico.

## Erro ao cadastrar nao-usuario (500 / ERRO_INTERNO)

Se o cadastro de nao-usuario falhar com `500`:

1. Abra **Auditoria e Logs** -> **Log de Erros Runtime (API)** e copie o `requestId`.
2. Verifique se o backend ja esta na versao com correcao de `POST /perfis` (fix do erro `42P08`).
3. Se ainda estiver em versao anterior, execute deploy:

```bash
cd /opt/cjm-patrimonio/current
./scripts/vps_deploy.sh all
```

Comportamento esperado apos a correcao:

- cadastro sem senha (nao-usuario) cria normalmente;
- conflitos de matricula/email retornam `409` com mensagens explicitas (`MATRICULA_DUPLICADA` ou `EMAIL_DUPLICADO`).

## Erro durante Importacao GEAFIN: estrategia de recuperacao

Se a importacao falhar e voce precisar voltar o banco para um ponto conhecido:

1. Identifique o backup pre-geafin no Drive (`cjm_gdrive:db-backups/database`).
2. Execute restore com confirmacao explicita:

```bash
cd /opt/cjm-patrimonio/current
./scripts/restore_db_backup.sh --remote-file db_YYYYMMDDTHHMMSSZ_pre-geafin.sql.gz --yes-i-know
```

3. Revalide `/api/health` e os fluxos criticos apos o restore.

Observacao: o restore cria backup `pre-restore` automaticamente antes de aplicar o dump.
