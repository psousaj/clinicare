# Graph Report - clinicare  (2026-10-07)

## Corpus Check
- 261 files · ~190,791 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 15 file(s) not represented in the graph (top: (none) 7, .css 4, .example 1)

## Summary
- 2060 nodes · 6756 edges · 110 communities (74 shown, 36 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 63 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c2a73698`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- db/src/index.ts
- external-validation.ts
- getDatabase
- assinatura.$token.tsx
- contract-authoring.ts
- queries.ts
- followups.ts
- routeTree.gen.ts
- scripts
- admin-commands.ts
- dependencies
- clinical.ts
- Assinatura eletrônica própria — especificação completa
- Assinatura eletrônica própria — MVP
- web/package.json
- Especificação: MVP para clínicas pequenas de estética
- db/package.json
- tasks
- components.json
- FileRoutesByPath
- schemas.ts
- compilerOptions
- SchemaEditor.tsx
- external-test-fixtures.ts
- Implementation Decisions
- dialogs.tsx
- devDependencies
- $patientId/index.tsx
- signatures.ts
- compilerOptions
- Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF
- api/tsconfig.json
- Clínicare
- buildProtectedAad
- -assinatura.$token.test.tsx
- Clínica de cuidados estéticos
- patients.ts
- scripts
- Button
- validateExternalReturn
- app.ts
- db/tsconfig.json
- Agent skills
- scheduling.ts
- anamnesis-links.integration.test.ts
- _app.tsx
- relational-schema.ts
- followups.integration.test.ts
- Decisão e plano: PostgreSQL + Drizzle + JSONB
- @tanstack/react-router
- Especificação: migração para PostgreSQL + Drizzle + JSONB
- api/package.json
- schemaUi.tsx
- Validação de assinatura externa (GOV.BR) sem PAdES próprio
- pdf-mutation.ts
- dependencies
- Issue tracker: GitHub
- Domain Docs
- Persistência PostgreSQL + Drizzle + JSONB
- triage-labels.md
- Preservação incremental de PDFs com assinaturas externas
- scripts
- Investigação da validação global T7
- react
- docx-types.d.ts
- DB_SCHEMA.md
- nova.tsx
- -documentos.test.tsx
- PageLoadingIndicator.test.tsx
- protect
- relationship.ts
- relacionamento.tsx
- documentos.$followupContractId.assinar.tsx
- RepresentativeSignPage
- SigningWorkspace
- format.ts
- external-validation.test.ts
- contratos/novo.tsx
- sha256.ts
- collectFingerprint
- headers
- composeStampImage
- generate-secrets.ts

## God Nodes (most connected - your core abstractions)
1. `getDatabase()` - 166 edges
2. `app` - 129 edges
3. `Button()` - 95 edges
4. `cn()` - 60 edges
5. `react` - 56 edges
6. `@tanstack/react-router` - 55 edges
7. `QueryError()` - 50 edges
8. `useApiMutation()` - 48 edges
9. `api()` - 47 edges
10. `lucide-react` - 46 edges

## Surprising Connections (you probably didn't know these)
- `Solution` --references--> `patient()`  [INFERRED]
  docs/specs/0005-autoria-docx-e-materializacao-de-contratos.md → apps/api/src/anamnesis-links.integration.test.ts
- `Implementation Decisions` --references--> `Contract`  [INFERRED]
  docs/specs/0005-autoria-docx-e-materializacao-de-contratos.md → apps/web/src/lib/schemas.ts
- `Decisão` --references--> `ContractVersion`  [INFERRED]
  docs/adr/0005-autoria-docx-e-materializacao-de-contratos.md → apps/web/src/lib/schemas.ts
- `User Stories` --references--> `ContractVersion`  [INFERRED]
  docs/specs/0005-autoria-docx-e-materializacao-de-contratos.md → apps/web/src/lib/schemas.ts
- `Implementation Decisions` --references--> `ContractVersion`  [INFERRED]
  docs/specs/0005-autoria-docx-e-materializacao-de-contratos.md → apps/web/src/lib/schemas.ts

## Import Cycles
- 2-file cycle: `packages/db/src/index.ts -> packages/db/src/migrate.ts -> packages/db/src/index.ts`
- 2-file cycle: `packages/db/src/index.ts -> packages/db/src/seed.ts -> packages/db/src/index.ts`

## Communities (110 total, 36 thin omitted)

### Community 0 - "db/src/index.ts"
Cohesion: 0.14
Nodes (20): AppLike, assertSafeIntegrationDatabase(), integration, integrationCookies, authAccounts, authSchema, AuthSession, authSessions (+12 more)

### Community 1 - "external-validation.ts"
Cohesion: 0.15
Nodes (14): certEndpoints(), CertView, checkCrl(), checkOcsp(), checkRevocation(), EmbeddedRevalidation, ExpectedSigner, ExternalValidationReport (+6 more)

### Community 2 - "getDatabase"
Cohesion: 0.08
Nodes (55): addAnamnesisVersion(), addContractVersion(), anamnesisResponse(), catalogTenant(), checkAnamnesisIds(), comboAnamnesisIds(), comboResponse(), comboValid() (+47 more)

### Community 3 - "assinatura.$token.tsx"
Cohesion: 0.12
Nodes (17): anySchema, DraggableSignature(), GovBrState, PageGeometry, PhoneGate(), PreviewPdf(), PublicHistoryEvent, PublicHistoryRevision (+9 more)

### Community 4 - "contract-authoring.ts"
Cohesion: 0.08
Nodes (42): docxMetadata(), invalid(), propagatePublishedVersion(), publishContractDraft(), saveContractDraft(), sha256(), uuid(), replaceUnsignedAppliedContract() (+34 more)

### Community 5 - "queries.ts"
Cohesion: 0.05
Nodes (73): contextDescription(), contextLabel(), CONTEXTS, ContractDraftPanel(), ContractMetadata, Props, api(), RequestOptions (+65 more)

### Community 6 - "followups.ts"
Cohesion: 0.11
Nodes (39): fixture(), headers(), post(), request(), contractedNames(), schema, schema, api() (+31 more)

### Community 7 - "routeTree.gen.ts"
Cohesion: 0.04
Nodes (45): AppAgendaRoute, AppConfiguracoesRoute, AppContratosContractIdRoute, AppContratosIndexRoute, AppContratosNovoRoute, AppDocumentosFollowupContractIdAssinarRoute, AppDocumentosRoute, AppDocumentosRouteChildren (+37 more)

### Community 8 - "scripts"
Cohesion: 0.05
Nodes (38): devDependencies, turbo, engines, node, name, packageManager, private, scripts (+30 more)

### Community 9 - "admin-commands.ts"
Cohesion: 0.05
Nodes (41): administratorByEmail(), BOOTSTRAP_ENV_KEYS, bootstrapConfigFromEnv(), changeClinicAdministratorEmail(), CreateAdministratorInput, createBetterAuthClinicAdministrator(), createClinicAdministrator(), createTenant() (+33 more)

### Community 10 - "dependencies"
Cohesion: 0.06
Nodes (32): dependencies, class-variance-authority, clsx, date-fns, @fingerprintjs/fingerprintjs, @fullcalendar/core, @fullcalendar/interaction, @fullcalendar/react (+24 more)

### Community 11 - "clinical.ts"
Cohesion: 0.09
Nodes (45): request(), CleanupResult, CleanupStatus, clearDraft, deleteAppliedDocument(), heartbeatReservedCleanupJob(), materializeAppliedDocument(), materializeAppliedDocumentResult() (+37 more)

### Community 12 - "Assinatura eletrônica própria — especificação completa"
Cohesion: 0.09
Nodes (22): 10. Selo da plataforma e gestão de chaves, 11. Pacote exportável e verificação independente, 12. Recuperação, revogação e tempo, 13. Limites de confiança, 14. Critérios de aceitação, 1. Objetivo e decisões de produto, 2. O que o sistema pretende demonstrar, 3.1. Fingerprint obrigatório desde o MVP (+14 more)

### Community 13 - "Assinatura eletrônica própria — MVP"
Cohesion: 0.09
Nodes (22): 10. Histórico, armazenamento e download, 11. Estrutura preparada para evolução, 12. O que fica fora deste MVP, 13. Critérios para considerar o MVP pronto, 14. Limite da evolução futura, 1. Objetivo, 2. Fluxo oficial, também mantido na produção, 3.1. Fingerprint obrigatório desde o MVP (+14 more)

### Community 14 - "web/package.json"
Cohesion: 0.08
Nodes (26): typescript, name, private, type, CalendarEntry, class-variance-authority, clsx, date-fns (+18 more)

### Community 15 - "Especificação: MVP para clínicas pequenas de estética"
Cohesion: 0.10
Nodes (18): ADR 0001: Stack da aplicação, Alternativas consideradas, Consequências, Contexto, Decisão, ADR 0002: Controle de acesso para dados clínicos no MVP, Alternativas consideradas, Consequências (+10 more)

### Community 16 - "db/package.json"
Cohesion: 0.07
Nodes (32): dependencies, drizzle-orm, pg, devDependencies, drizzle-kit, @types/bun, @types/pg, typescript (+24 more)

### Community 17 - "tasks"
Cohesion: 0.08
Nodes (24): dependsOn, inputs, outputs, cache, cache, env, persistent, env (+16 more)

### Community 18 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 19 - "FileRoutesByPath"
Cohesion: 0.09
Nodes (23): Route, Route, Route, Route, Route, Route, Route, Route (+15 more)

### Community 21 - "schemas.ts"
Cohesion: 0.07
Nodes (36): Kind, kinds, PlanOfferPickerProps, comboPriceCents(), fold(), linkedContractIds(), matchesName(), PAGE_SIZE (+28 more)

### Community 22 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+8 more)

### Community 23 - "SchemaEditor.tsx"
Cohesion: 0.10
Nodes (35): submit(), ContractFormPage(), OfferFields(), PaymentDialog(), StandaloneAttendanceDialog(), canControlVisibility(), conditionOf(), Field (+27 more)

### Community 24 - "external-test-fixtures.ts"
Cohesion: 0.16
Nodes (12): request(), buildSignedReturnPdf(), buildUnparsableCmsReturn(), createTestCa(), ensureOpensslAvailable(), issueDatedTestSigner(), issueTestSigner(), num10() (+4 more)

### Community 25 - "Implementation Decisions"
Cohesion: 0.09
Nodes (22): Assinatura local, Concorrência, idempotência e storage, Especificação — Assinatura eletrônica própria no MVP, Estados e conclusão, Fingerprint e evidências, Fonte, PDF e revisões, Further Notes, GOV.BR e assinaturas externas (+14 more)

### Community 26 - "dialogs.tsx"
Cohesion: 0.08
Nodes (46): ProcedurePicker(), AppointmentDialog(), AppointmentFields(), localDate(), localTime(), minutesBetween(), PlannedItem, Selection (+38 more)

### Community 27 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, jsdom, @tanstack/router-plugin, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, @types/node, @types/react (+3 more)

### Community 28 - "$patientId/index.tsx"
Cohesion: 0.11
Nodes (31): ContractGenerateButton(), ContractReprocessButton(), ContractSignatureHistory(), copySignatureLink(), ContractSummary(), Entry, pendingBadge(), NewFollowupDialog() (+23 more)

### Community 29 - "signatures.ts"
Cohesion: 0.07
Nodes (75): loadTrustedRootFiles(), loadTrustedRootsFromEnv(), NormalizedEvidence, normalizeEvidence(), RawFingerprint, cancelExternalAttempt(), cancelExternalAttemptAsClinicRepresentative(), canonicalJson() (+67 more)

### Community 30 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, noEmit, skipLibCheck, strict (+1 more)

### Community 31 - "Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF"
Cohesion: 0.13
Nodes (15): ContractVersion, 0005. Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos, Consequências, Contexto, Decisão, Emenda — 2026-10-07 (Issue #32: LibreOffice headless sob demanda, ONLYOFFICE aposentado), Emenda — 2026-10-07 (propagação da versão publicada a contratos aplicados sem assinatura), Further Notes (+7 more)

### Community 32 - "api/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, allowImportingTsExtensions, types, extends, include, ../../tsconfig.json

### Community 33 - "Clínicare"
Cohesion: 0.29
Nodes (6): Clínicare, Desenvolvimento sem Docker, Estrutura do monorepo, Rodar localmente via Docker (caminho recomendado), Stack, Verificações

### Community 34 - "buildProtectedAad"
Cohesion: 0.10
Nodes (32): addAnamnesisNote(), listAnamnesisNotes(), noteValue(), unprotect(), buildContext(), contextForVersion(), createInitialSignatureProcesses(), dbRows() (+24 more)

### Community 35 - "-assinatura.$token.test.tsx"
Cohesion: 0.12
Nodes (13): Handler, marina, renderAt(), combo(), queryClient, router, createAppRouter(), createQueryClient() (+5 more)

### Community 36 - "Clínica de cuidados estéticos"
Cohesion: 0.20
Nodes (9): Attendance, Atendimento estético, Clínica de cuidados estéticos, Dados e ciclo de protótipo, Documentos e coleta, Jornada do paciente, Objetivo do produto, Organização da clínica (+1 more)

### Community 37 - "patients.ts"
Cohesion: 0.07
Nodes (32): createFollowup(), hashToken(), idShape(), invalid(), issueInitialTokens(), latest(), notFound(), offerForms() (+24 more)

### Community 38 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 39 - "Button"
Cohesion: 0.12
Nodes (41): AnamnesisFormPage(), emptySchema, PatientPreview(), Props, AppointmentDetails(), dateLong, Props, Row() (+33 more)

### Community 40 - "validateExternalReturn"
Cohesion: 0.32
Nodes (13): blankReport(), bytesEqual(), cmsMessageDigest(), exactBytes(), fail(), parseTrustedRoots(), rangeContent(), revalidateEmbeddedSignatures() (+5 more)

### Community 41 - "app.ts"
Cohesion: 0.08
Nodes (52): BRAZILIAN_STATES, getAccount(), getDefaultSignature(), getProfessionalProfile(), REGISTRATION_TYPES, updateAccount(), updateDefaultSignature(), updateInitialPasswordChoice() (+44 more)

### Community 42 - "db/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, types, extends, include, ../../tsconfig.json

### Community 43 - "Agent skills"
Cohesion: 0.29
Nodes (6): Agent skills, Domain docs, graphify, Issue tracker, This is NOT the Turborepo you know, Triage labels

### Community 44 - "scheduling.ts"
Cohesion: 0.14
Nodes (40): civilDateOf(), clinicTimeZone(), activeAppointmentStatuses, addAttendancePhoto(), appointmentResponse(), assertAtomicCombos(), assertEventDay(), attendanceResponse() (+32 more)

### Community 45 - "anamnesis-links.integration.test.ts"
Cohesion: 0.10
Nodes (22): contract(), form(), headers(), patient(), procedure(), request(), schema, tenantIds (+14 more)

### Community 46 - "_app.tsx"
Cohesion: 0.20
Nodes (17): Sheet(), SheetClose(), SheetContent(), SheetDescription(), SheetHeader(), SheetOverlay(), SheetTitle(), SheetTrigger() (+9 more)

### Community 47 - "relational-schema.ts"
Cohesion: 0.05
Nodes (36): appliedAnamnesisNotes, catalogTimestamps, contractVersionPdfUploadIntents, NewRelationalPatient, NewRelationalProcedure, NewTenant, paymentRelations, pdfUploadIntents (+28 more)

### Community 48 - "followups.integration.test.ts"
Cohesion: 0.16
Nodes (16): schema, tenantIds, civilDate(), eventBody(), fixtures(), headers(), request(), schema (+8 more)

### Community 49 - "Decisão e plano: PostgreSQL + Drizzle + JSONB"
Cohesion: 0.09
Nodes (21): 10. Go/no-go para implementação, 1. Conclusão, 2. Decisões de domínio confirmadas, 3. Modelo de domínio e estados, 4. Blueprint relacional inicial, 5. Matriz de invariantes, 6. Fronteiras transacionais, 7. Reaproveitamento do Git (+13 more)

### Community 50 - "@tanstack/react-router"
Cohesion: 0.10
Nodes (41): AttendanceRecordForm(), matchesPatient(), PatientRow(), QueryError(), Props, SchemaForm(), appliedAnamnesisQuery(), combosQuery (+33 more)

### Community 51 - "Especificação: migração para PostgreSQL + Drizzle + JSONB"
Cohesion: 0.13
Nodes (14): API, frontend e operações de produto, Catálogo, planos e snapshots, Dados protegidos, Especificação: migração para PostgreSQL + Drizzle + JSONB, Further Notes, Implementation Decisions, Integridade e concorrência, Máquina de estados (+6 more)

### Community 52 - "api/package.json"
Cohesion: 0.12
Nodes (16): devDependencies, @types/bun, typescript, drizzle-orm, @types/bun, typescript, name, private (+8 more)

### Community 53 - "schemaUi.tsx"
Cohesion: 0.09
Nodes (38): answersForSchema(), answersForWidgets(), answersFromWidgets(), ConditionalSchema, conditionOf(), schemaForAnswers(), schemaForWidgets(), SchemaProperty (+30 more)

### Community 55 - "Validação de assinatura externa (GOV.BR) sem PAdES próprio"
Cohesion: 0.40
Nodes (4): Resultados, Revalidação em mutações posteriores (Issue #27), Validação de assinatura externa (GOV.BR) sem PAdES próprio, Verificações executadas (todas genuínas, nenhuma presumida)

### Community 56 - "pdf-mutation.ts"
Cohesion: 0.36
Nodes (6): createIncrementalSignaturePdf(), normalizedPlacementToPdfRect(), PdfPlacement, PdfRect, sha256(), validatePlacement()

### Community 58 - "dependencies"
Cohesion: 0.14
Nodes (14): dependencies, asn1js, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, better-auth, @better-auth/drizzle-adapter, @clinicare/db, docxtemplater (+6 more)

### Community 60 - "Issue tracker: GitHub"
Cohesion: 0.29
Nodes (6): Conventions, Issue tracker: GitHub, Pull requests as a triage surface, Wayfinding operations, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 61 - "Domain Docs"
Cohesion: 0.33
Nodes (5): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary

### Community 77 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, dev:debug, manage, test, test:integration, typecheck

### Community 78 - "Investigação da validação global T7"
Cohesion: 0.40
Nodes (4): Correções e validação final, Evidências de escopo, Investigação da validação global T7, Resultado inicial

### Community 79 - "react"
Cohesion: 0.10
Nodes (44): AnamnesisPicker(), InheritedAnamneses(), ComboFormPage(), day(), CpfField(), Field(), FormPage(), FormPageProps (+36 more)

### Community 85 - "nova.tsx"
Cohesion: 0.67
Nodes (3): useCreateAnamnesis(), NewAnamnesis(), Route

### Community 86 - "-documentos.test.tsx"
Cohesion: 0.14
Nodes (8): ControlledEditor(), schema, planSchema, base, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, vitest

### Community 90 - "PageLoadingIndicator.test.tsx"
Cohesion: 0.33
Nodes (4): PageLoadingIndicator(), setup(), Route, FileRoutesById

### Community 91 - "protect"
Cohesion: 0.22
Nodes (11): answerAppliedAnamnesis(), byToken(), hashToken(), jsonValue(), protect(), publicShape(), readPublicAnamnesis(), saveAnamnesisDraft() (+3 more)

### Community 98 - "relacionamento.tsx"
Cohesion: 0.33
Nodes (9): duration(), monthLabel(), shortDate(), relationshipQuery(), Card(), Chart(), Relationship(), Route (+1 more)

### Community 99 - "documentos.$followupContractId.assinar.tsx"
Cohesion: 0.14
Nodes (14): DocumentViewer(), PageGeometry, renderAllPages(), usePdfDocument(), SignaturePadHandle, ChecklistItem, SignChecklist(), SigningSteps() (+6 more)

### Community 100 - "RepresentativeSignPage"
Cohesion: 0.18
Nodes (15): confirmProfessionalSignature(), fetchProfessionalPdf(), postParticipantPdf(), previewProfessionalSignature(), useConfirmProfessionalSignature(), usePreviewProfessionalSignature(), draftKey(), readDraft() (+7 more)

### Community 101 - "SigningWorkspace"
Cohesion: 0.26
Nodes (9): DRAFT_STORAGE_KEY(), readStoredDraft(), SigningWorkspace(), captureFromPad(), clear(), confirm(), goToConfirm(), runPreview() (+1 more)

### Community 102 - "format.ts"
Cohesion: 0.11
Nodes (24): allowed, AttendancePhotos(), Phase, phases, CalendarView(), EditPatientDialog(), Textarea(), appointmentStatus (+16 more)

### Community 103 - "external-validation.test.ts"
Cohesion: 0.33
Nodes (5): latin1(), pemToDer(), resolveSignaturePairs(), hasOpenssl, unhex()

### Community 104 - "contratos/novo.tsx"
Cohesion: 0.67
Nodes (3): useCreateContract(), NewContract(), Route

### Community 106 - "collectFingerprint"
Cohesion: 0.36
Nodes (9): CollectedFingerprint, collectFingerprint(), GovBrSection(), acceptReturn(), cancelAttempt(), exportRevision(), importReturn(), postJson() (+1 more)

### Community 108 - "composeStampImage"
Cohesion: 0.83
Nodes (3): composeStampImage(), loadImage(), trimTransparent()

## Knowledge Gaps
- **609 isolated node(s):** `name`, `private`, `type`, `dev`, `dev:debug` (+604 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 752 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **36 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Solution` connect `Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF` to `anamnesis-links.integration.test.ts`?**
  _High betweenness centrality (0.264) - this node is a cross-community bridge._
- **Why does `patient()` connect `anamnesis-links.integration.test.ts` to `getDatabase`, `Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF`?**
  _High betweenness centrality (0.264) - this node is a cross-community bridge._
- **Why does `ContractVersion` connect `Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF` to `schemas.ts`?**
  _High betweenness centrality (0.264) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _609 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `db/src/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1431451612903226 - nodes in this community are weakly interconnected._
- **Should `getDatabase` be split into smaller, more focused modules?**
  _Cohesion score 0.07622504537205081 - nodes in this community are weakly interconnected._
- **Should `assinatura.$token.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.12105263157894737 - nodes in this community are weakly interconnected._