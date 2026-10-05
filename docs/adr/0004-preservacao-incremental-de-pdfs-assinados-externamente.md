# Preservação incremental de PDFs com assinaturas externas

- **Status:** accepted
- **Data:** 2026-10-04

A aplicação aceita assinaturas externas pelo GOV.BR, mas não é um assinador PAdES. Ela é um sistema de versionamento e transformação incremental de PDFs: toda mutação interna deve preservar os bytes da revisão de entrada e acrescentar somente um incremental update; a aplicação não deve reserializar, otimizar, normalizar, reconstruir ou fazer flatten global de PDFs que possam conter PAdES, GOV.BR, CMS, certificados ou carimbos externos. PDFs assinados fora da aplicação são armazenados como revisões completas; o retorno externo é validado e promove a etapa quando a assinatura e a continuidade forem aceitas. Formatos inválidos, indeterminados ou não suportados podem ser preservados como recebimentos, mas não concluem a assinatura. Operações internas posteriores só são aceitas quando compatíveis com a preservação e validação das assinaturas existentes; caso contrário, a operação é bloqueada e a revisão permanece intacta. Essa decisão permite aceitar GOV.BR sem destruir uma assinatura que a plataforma não criou e torna o prefixo byte-a-byte uma invariante testável do motor de mutação.

## Consequências

- O motor PDF precisa expor uma operação explícita de mutação incremental, com teste de que a saída começa pelos bytes completos da entrada.
- Bibliotecas ou helpers que façam `save` completo não podem ser usados nesse caminho.
- A compatibilidade prática com arquivos GOV.BR/PAdES precisa ser testada em PDFs reais; aparência visualmente equivalente não é suficiente.
- A aplicação pode rejeitar uma operação posterior incompatível, em vez de produzir silenciosamente um PDF que invalide uma assinatura externa.
