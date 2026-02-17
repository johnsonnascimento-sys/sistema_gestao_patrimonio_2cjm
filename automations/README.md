# Automations

## Cabecalho

- Modulo: `automations`
- Funcao: especificar fluxos n8n de suporte operacional (geracao de termos e upload).

## Arquivos

- `n8n_gerador_termos_spec.json`: contrato de fluxo para gerar HTML institucional, converter para PDF e salvar no Google Drive.
- `n8n_gerador_termos.json`: workflow importavel (modelo) para gerar termo (HTML) via webhook e salvar no Drive. Para PDF, substitua/adicione o node de conversao HTML->PDF conforme sua stack no n8n.
- `n8n_relatorio_forasteiros.json`: workflow importavel para gerar relatorio de divergencias (forasteiros) e salvar no Drive (Art. 185 - AN303_Art185).
