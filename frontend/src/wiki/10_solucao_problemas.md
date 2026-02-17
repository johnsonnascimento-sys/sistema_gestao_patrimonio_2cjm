<!--
Modulo: wiki
Arquivo: frontend/src/wiki/10_solucao_problemas.md
Funcao no sistema: troubleshooting focado no usuario e no admin (sem expor segredos).
-->

# Solucao de problemas (FAQ)

## "Failed to fetch" / "Erro interno no servidor"

O que significa:

- O frontend nao conseguiu falar com o backend via `/api`.

Checklist rapido:

1. Abra **Operacoes API** e clique em **Testar /health**.
2. Se falhar, o problema e conectividade/proxy/backend.

Possiveis causas:

- Backend fora do ar.
- Proxy Nginx sem `location /api/`.
- Timeout do proxy em operacao longa.

## "504 Gateway Time-out" ao importar GEAFIN

O que significa:

- O proxy Nginx encerrou a conexao antes do backend terminar.

Solucao:

- Aumentar timeouts de proxy (host Nginx e/ou Nginx do container).
- Garantir `proxy_request_buffering off` para upload.

## "Formato do tombamento invalido"

O tombamento GEAFIN esperado e:

- exatamente 10 digitos numericos (ex.: `1290001788`).

Se voce digitou algo como `TMB-00772`, isso nao e o mesmo padrao. Procure o tombamento no documento/etiqueta correta.

## Barra de progresso some ao dar refresh

O progresso depende do ultimo registro de importacao no banco.

Se sumir:

- Verifique se existe uma importacao em andamento ou concluida no endpoint de progresso (admin).
- Se a pagina estiver usando cache, force recarregar (Ctrl+F5).

## "Un" ao lado do botao Importar

Isso e um fragmento visual do layout atual (botao/rotulo) e nao representa uma unidade.

Se aparecer sem funcao:

- Pode ser removido/renomeado em melhoria de UX.

## Inventario: "Bem de Terceiro" (nao entendi)

Veja a pagina:

- Intrusos e bens de terceiros

Resumo:

- Bem de terceiro e item externo ao patrimonio, registrado segregado para controle.

