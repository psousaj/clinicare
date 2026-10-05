# Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF

## Problem Statement

Atualmente, o sistema gerencia contratos modelo e suas versões com campos simplificados e geração manual de PDFs, sem capacidade de importação e edição direta de arquivos DOCX externos de alta fidelidade (provenientes de Word, Google Docs ou LibreOffice). Além disso, os contratos exigidos por planos clínicos contêm dados específicos do paciente (nome, CPF, data de nascimento), dados do profissional habilitado (nome, conselho/registro profissional e UF), data da aplicação e procedimentos contratados que precisam ser preenchidos de forma determinística e segura, sem perda de formatação de tabelas, cabeçalhos ou paginação.

Sem uma separação clara entre a autoria mutável e a assinatura imutável, existia o risco de editar retroativamente documentos já assinados ou tentar transformar o motor de assinatura PDF em um editor de texto, corrompendo integridades PAdES/GOV.BR.

## Solution

Separar expressamente os domínios:
1. **Domínio de Autoria (Catálogo/Contrato Modelo):** O profissional cria ou importa arquivos `.docx` e edita diretamente em um editor integrado ao ONLYOFFICE Docs Community Edition (rodando desacoplado em contêiner). As edições operam sobre um `ContractDraft` mutável. O profissional configura quais contextos (`patient`, `professional`, `clinic`, `application`, `plan`) e placeholders são permitidos/obrigatórios. A publicação gera uma `ContractVersion` estritamente imutável contendo a fonte DOCX congelada e o snapshot dessa configuração.
2. **Domínio de Materialização (Acompanhamento de Plano):** Quando um plano é contratado, as versões publicadas correntes dos contratos modelo exigidos são resolvidas atomicamente. O backend processa o DOCX com `Docxtemplater` e `pizzip`, substituindo os placeholders validados por um contexto de apresentação seguro (inclusive loops de `plan.procedures` como `☒ Nome`), salva o snapshot cifrado do contexto e gera o `materialized.docx` imutável.
3. **Domínio de Execução e Assinatura (Contrato Aplicado):** O ONLYOFFICE converte o `materialized.docx` em PDF, gerando a revisão `R0`. A partir desse ponto, o DOCX é trancado, o ONLYOFFICE não toca mais no documento, e o pipeline de assinatura assume o controle das revisões incrementais imutáveis (`R1`, `R2`, ...) via `@libpdf/core`.

## User Stories

1. As an administrator, I want to create a new contract model in the catalog starting with a blank draft or uploading an existing `.docx` file, so that I can reuse existing clinic legal templates.
2. As an administrator, I want to edit a contract draft using ONLYOFFICE Docs with Word-like fidelity (preserving tables, headers, footers, pagination, and styles), so that the legal layout remains intact.
3. As an administrator, I want to enable contexts (patient, professional, clinic, application date, plan procedures) for a contract model, so that the document declares what information it expects.
4. As an administrator, I want to select allowed placeholders from an eligible registry and mark which ones are strictly required, so that the template enforces data completeness.
5. As an administrator, I want assisted placeholder insertion in the editor (such as `{patient.name}`, `{patient.cpf}`, `{patient.birthDate}`, `{professional.name}`, `{professional.registration}`, `{application.date}`, and `{#plan.procedures}☒ {.}{/plan.procedures}`), so that typing mistakes are avoided.
6. As an administrator, I want the system to validate the DOCX draft during publication against the allowed placeholders registry, so that unpublished or unknown variables are rejected with clear error feedback.
7. As an administrator, I want publishing a contract draft to create an immutable `ContractVersion` with a frozen DOCX source and frozen context configuration, so that existing applications are never retroactively affected by catalog edits.
8. As an administrator, I want publishing an unchanged draft to be idempotent and retain the current published version, so that redundant versions are not created.
9. As an administrator, I want to configure my professional registration (type such as CRM/CREFITO/CRBM, registration number, and optional UF) in my dashboard profile, so that contracts can automatically display professional credentials.
10. As an administrator, I want to associate contract models to catalog plans without freezing contract versions at the plan definition level, so that new plan applications automatically pick up the latest published contract version.
11. As an administrator, I want to start a patient plan followup and optionally provide a contract application date, so that all contracts generated for that plan share the same contextual date.
12. As an administrator, I want the system to resolve the latest published version of all required contract models in a single atomic transaction during followup creation, so that contracts are consistent even during concurrent edits.
13. As an administrator, I want the system to materialize the DOCX template into an immutable `materialized.docx` and convert it into `R0.pdf` per applied contract, so that each patient receives a personalized document.
14. As an administrator, I want the template context snapshot (including patient CPF, birth date, and professional registration) to be stored encrypted, so that sensitive clinical and personal data is protected at rest.
15. As an administrator, I want followup contract generation to be idempotent and isolated, so that if one contract fails generation, other successful `R0` contracts are preserved and the failed one can be retried without recreating the followup.
16. As an administrator, I want the followup to remain idle and prevent signature processes, scheduling, or attendance while any required contract is still generating or failed, so that patients never sign incomplete documents.
17. As an administrator, I want canceling a followup during generation to prevent promoting generated contracts to active signature processes, so that abandoned enrollments do not generate actionable signing links.
18. As a patient, I want to receive and review a personalized PDF contract (`R0`) with all my data and the selected procedures accurately filled in, so that I can sign it via handwriting or GOV.BR without text mutation.

## Implementation Decisions

- **Domain Boundaries:**
  - `Contract` (Contract Model) lives in catalog, holding mutable `ContractDraft` and published `ContractVersion`s.
  - ONLYOFFICE Docs Community Edition runs as an independent container service, used strictly for authoring DOCX and converting `materialized.docx` to `R0.pdf`.
  - `@libpdf/core` takes over starting at `R0.pdf` for incremental updates in the signature pipeline. ONLYOFFICE never touches signed PDF revisions.
- **Contract Draft & Publishing Lifecycle:**
  - A contract model starts as a draft; it has no published version until explicit publication.
  - Upon publishing, the DOCX is validated against `allowedPlaceholders` and `requiredPlaceholders`. A `ContractVersion` is created with a frozen DOCX source and frozen config snapshot. The draft remains as an editable working copy based on the published version.
  - Attempting to publish an identical draft returns the existing published version idempotently.
- **Parametric Templating & Docxtemplater:**
  - Templates use `docxtemplater` with `pizzip` in the Bun backend.
  - Closed global placeholder registry: `patient.name`, `patient.cpf`, `patient.birthDate`, `professional.name`, `professional.registration`, `clinic.name`, `application.date`, and collection `plan.procedures`.
  - Missing optional fields evaluate to empty string (`""`) via a custom null getter; `undefined` is strictly forbidden in rendered output.
  - Missing required fields block materialization with a domain error (`CONTRACT_CONTEXT_INCOMPLETE`).
- **Professional Entity & Profile Configuration:**
  - New 1:1 optional relationship from `authUsers` to `Professional` within each tenant.
  - Professional attributes: `registrationType` (controlled council enum: CRM, CREFITO, CRBM, CRO, COREN, CRP, etc.), `registrationNumber` (text), `registrationState` (optional Brazilian state UF), and `active` (boolean).
  - Can be logically deactivated; historical snapshots retain the professional name and formatted registration.
- **Patient Civil Birth Date:**
  - Add `birthDate` (nullable `DATE`, civil date without timezone/time) to `patients`. Protected and encrypted in persistence if required, formatted as `DD/MM/YYYY` in template context.
- **Followup & Plan Contract Resolution:**
  - `PlanVersion` references contract model IDs, not fixed contract version numbers.
  - At followup creation, the latest published version of each required contract model is locked and resolved in a single transaction.
  - `contractApplicationDate` is an optional civil date captured at followup creation and shared across all contracts in the followup.
  - Followup starts in `idle` status with contracts in `generating`. Background or asynchronous worker renders each DOCX, converts to PDF, saves `materialized.docx` and `R0.pdf`, and marks contract `ready`.
  - Once all required contracts have `R0`, signature processes and tokens are issued.
  - Retries on failed generation are idempotent and preserve existing `R0` artifacts.

## Testing Decisions

- **Seams:**
  - **API Integration Seam:** High-level HTTP endpoint tests using the existing Bun test harness (`apps/api`), executing against real PostgreSQL and local S3/storage mock. This validates end-to-end catalog draft saving, publishing validation, followup creation, placeholder compilation, and generation state transitions.
  - **Storage & Conversion Seam:** Mocking the ONLYOFFICE callback and Document Server conversion endpoint to verify DOCX-to-PDF transition, SHA-256 calculation, and `R0` revision initialization.
  - **Unit Seam for Docxtemplater:** In-memory template rendering tests verifying that `{patient.*}`, `{application.date}`, and `{#plan.procedures}☒ {.}{/plan.procedures}` expand correctly, reject unknown tags, and format `nullGetter` properly.
  - **Web Seam:** Vitest component tests in `apps/web` verifying the contract form editor, placeholder selector, professional profile settings, and followup creation dialog with optional application date.

## Out of Scope

- Self-hosted rich text editor or custom CRDT/Word engine (handled by ONLYOFFICE Docs).
- Complex docxtemplater expressions, math formulas, dynamic tables, or arbitrary custom user scripting inside templates.
- Radio buttons or exclusive procedure picking in contracts (procedures are contracted items represented as checkboxes/Unicode `☒`).
- Editing contracts in standalone procedure attendances or combos (MVP contract materialization applies only to Plans).
- Re-opening or editing an applied contract or signed PDF in DOCX format (strictly forbidden; corrections require new plan followup or updated contract publication).

## Further Notes

- Invariants 1 through 5 from the spec and ADR 0005 are binding.
- All sensitive snapshot payloads must use AES-256-GCM authenticated encryption tied to tenant and contract IDs via AAD.
