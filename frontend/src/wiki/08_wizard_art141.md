<!--
Modulo: wiki
Arquivo: frontend/src/wiki/08_wizard_art141.md
Funcao no sistema: orientar uso do wizard de classificacao de inserviveis (Art. 141).
-->

# Wizard Art. 141 (classificação de inservíveis)

## Por que existe um wizard

Classificar um bem como inservivel (ocioso/recuperavel/antieconomico/irrecuperavel) tem impacto operacional e documental.

Para reduzir erro humano e garantir conformidade, o sistema usa um **fluxo guiado**.

Base legal:

- Art. 141, Caput (AN303_Art141_Cap)
- Art. 141, I (AN303_Art141_I)
- Art. 141, II (AN303_Art141_II)
- Art. 141, III (AN303_Art141_III)
- Art. 141, IV (AN303_Art141_IV)

## Como usar (passo a passo)

1. Abra a aba **Wizard Art. 141**.
2. Clique em **Iniciar wizard**.
3. Preencha a descrição do bem (ou selecione pelo cadastro quando integrado).
4. Responda as perguntas do fluxo:
   - O bem está ocioso? (não utilizado mas em condição)
   - O bem é recuperável? (custo/viabilidade de reparo)
   - O bem é antieconômico? (manter é mais caro que substituir)
   - O bem é irrecuperável? (sem condições de uso)
5. Salve o resultado.

## O que o sistema registra

No minimo:

- Classificação final
- Justificativa (texto)
- Data/hora
- Operador (quando perfil estiver integrado em persistencia)

## Boas praticas

- Evite "chutar" a classificacao. Use justificativa clara.
- Se for antieconomico/irrecuperavel, anexe laudos/documentos no fluxo administrativo (quando habilitado).
