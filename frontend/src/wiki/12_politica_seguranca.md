<!--
Modulo: wiki
Arquivo: frontend/src/wiki/12_politica_seguranca.md
Funcao no sistema: orientar usuarios/admin sobre sigilo, senhas e boas praticas (sem colocar segredos reais).
-->

# Seguranca e sigilo operacional

## 1) Principios

- Nao compartilhar credenciais.
- Nao deixar tokens/senhas em documentos publicos.
- Nao colar credenciais em prints, tickets, chats ou Wiki.

## 2) Onde ficam segredos

Segredos devem existir apenas:

- Em variaveis de ambiente (`.env`) na VPS (fora do repositorio).
- Em secret manager (se houver).
- Em credenciais configuradas no n8n (UI do n8n), nao no Git.

## 3) O que o usuario comum deve fazer

- Usar apenas o site.
- Nao tentar acessar banco/n8n diretamente.
- Reportar falhas com print **sem dados sensiveis**.

## 4) O que o admin deve fazer (VPS)

- Manter Docker e containers atualizados.
- Monitorar logs do backend em operacoes longas (importacao).
- Ajustar Nginx somente quando necessario.
- Garantir que backups existam (se politica interna exigir).

## 5) Logs e dados sensiveis

O sistema usa `requestId` para correlacionar chamadas. Em caso de suporte:

- Informe o `requestId`.
- Evite colar payloads com dados pessoais.

## 6) Incidentes (regra)

Se um segredo for exposto em qualquer lugar (Git, Wiki, chat, print):

- Considerar comprometido.
- Rotacionar/alterar imediatamente (politica do orgao).
- Registrar incidente interno.

Obs.: esta regra existe mesmo quando "parece improvavel". E requisito minimo de seguranca.

