<!--
Modulo: wiki
Arquivo: frontend/src/wiki/00_indice.md
Funcao no sistema: indice navegavel do manual/wiki self-hosted do patrimonio2cjm.
-->

# Índice (Manual do Sistema)

Este Wiki é o manual oficial do sistema e precisa permanecer sincronizado com o runtime. A entrega atual manteve a workspace **Material Inservível / Baixa** e reorganizou a navegação principal para publicar o grupo **Inventário** com quatro submenus operacionais.

## Como usar este manual

- Use a busca da lateral na aba **Wiki / Manual do Sistema**.
- Abra a página operacional correspondente antes de executar um fluxo sensível.
- Em caso de divergência entre interface e manual, trate como não conformidade e corrija a documentação no mesmo ciclo.

## Páginas do manual

- Visão geral do sistema
- Dashboard
- Perfis e acesso
- Consulta de bens
- Importação GEAFIN (CSV)
- Movimentações: cautela x transferência
- Inventário - Contagem
- Inventário no menu principal
- Material (SKU)
- Classificação SIAFI
- Normas
- Intrusos e bens de terceiros
- Regularização pós-inventário
- Material Inservível / Baixa
- Relatórios e auditoria
- Solução de problemas
- Checklist de migrações (Supabase)
- Glossário
- Segurança e sigilo operacional
- Compliance ATN 303/2008
- Matriz de compliance (ATN 303/2008)
- Admin: operação na VPS
- Referência rápida da API
- Análise de cobertura menu x wiki

## Menu atual do sistema

### Operações

- Consulta de Bens
- Movimentações
- Cadastrar bens por Endereço
- Inventário -> Administração
- Inventário -> Contagem
- Inventário -> Acuracidade
- Inventário -> Regularização
- Material Inservível / Baixa
- Material (SKU)
- Classificação SIAFI
- Importação GEAFIN (CSV Latin1)

### Auditoria e Logs

- Log Geral de Alterações
- Auditoria Patrimonial (Global)
- Log de Erros Runtime

### Administração do Painel

- Locais (endereços) cadastrados
- Backup e Restore
- Conectividade Backend
- Perfis e Acessos

### Aprovações

- Aprovações Pendentes

### Referência e apoio

- Wiki / Manual do Sistema
- Normas

## Destaques recentes

### Inventário administrativo

O bloco administrativo do inventário agora está separado em quatro subtelas:

- administração do ciclo;
- monitoramento operacional;
- acuracidade e histórico;
- regularização pós-inventário.

### Material Inservível / Baixa

Na página **Material Inservível / Baixa**, o sistema reúne:

- triagem e marcação de bens potencialmente inservíveis;
- fila operacional de candidatos à destinação;
- processos de baixa patrimonial;
- fluxo direto de `DESAPARECIMENTO`;
- registro auditável da baixa, incluindo causa formal, data e placeholders documentais.
