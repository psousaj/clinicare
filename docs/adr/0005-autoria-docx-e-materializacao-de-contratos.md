# 0005. Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos

- **Status:** accepted
- **Data:** 2026-10-05

## Contexto

Contratos importados de fontes externas (Word, LibreOffice, Google Docs) utilizam o formato DOCX com tabelas, cabeçalhos, rodapés e paginação complexa. Motores baseados em HTML/Rich Text perdem fidelidade ao converter DOCX arbitrário. Por outro lado, o pipeline de assinatura da aplicação (ADR 0004) exige PDFs com revisões incrementais estritamente imutáveis que preservem assinaturas externas GOV.BR/PAdES.

Havia a necessidade de suportar edição no padrão Office, placeholders paramétricos (`{patient.name}`, etc.), coleções de procedimentos e dados de profissionais habilitados sem corromper as revisões de assinatura nem acoplar o Document Server ao domínio central.

## Decisão

1. **Separação de Fronteira:** 
   - **DOCX é o formato exclusivo de autoria** no Contrato Modelo (catálogo). O editor ONLYOFFICE Docs Community Edition roda como serviço desacoplado via Docker e opera apenas sobre o `ContractDraft`.
   - **PDF é o formato exclusivo de execução e assinatura**. Uma vez gerado o `R0` do contrato aplicado, o documento pertence unicamente ao pipeline de revisões incrementais do `@libpdf/core`. O ONLYOFFICE nunca toca em contratos aplicados ou revisões assinadas.

2. **Imutabilidade e Ciclo de Vida:**
   - O `ContractDraft` é mutável.
   - A `ContractVersion` publicada é estritamente imutável (contém a fonte DOCX congelada, snapshot de contextos habilitados e placeholders permitidos/obrigatórios). Publicar não gera PDF final por paciente se houver placeholders dependentes de aplicação.
   - O plano no catálogo (`PlanVersion`) referencia apenas os contratos modelo exigidos, não uma versão fixa.

3. **Materialização no Acompanhamento:**
   - Apenas acompanhamentos de **Planos** materializam contratos no MVP.
   - No início do acompanhamento, as versões publicadas correntes são resolvidas atomicamente com locking determinístico.
   - O backend compila os dados com `Docxtemplater` e `pizzip`, gerando um `materialized.docx` imutável por contrato aplicado, que é convertido via ONLYOFFICE para `R0.pdf`.
   - O contexto materializado (incluindo CPF, data de nascimento e registro profissional) é persistido como snapshot cifrado na tabela do contrato aplicado.
   - Uma data civil única e opcional (`application.date`) é compartilhada pelo acompanhamento. Procedimentos do plano são injetados como array de strings (`plan.procedures`) representados textualmente (`☒`).
   - A entidade `Professional` vincula-se 1:1 opcionalmente à conta do usuário autenticado no tenant; seus dados são congelados no snapshot.

## Consequências

- O ONLYOFFICE é mantido puramente como utilitário de conversão e autoria, sem acesso a regras de negócio ou banco de dados.
- Retries de falha de geração são idempotentes por contrato aplicado e nunca sobrescrevem um `R0` já existente.
- Acompanhamento cancelado durante a geração descarta a promoção para assinatura e preserva artefatos como histórico.
- Contratos aplicados nunca voltam ao editor DOCX. Correções de texto exigem nova publicação no modelo e substituição explícita dos contratos do acompanhamento.
