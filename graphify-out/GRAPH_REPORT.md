# Graph Report - clinicare  (2026-11-24)

## Corpus Check
- 275 files · ~203,545 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 15 file(s) not represented in the graph (top: (none) 7, .css 4, .example 1)

## Summary
- 2158 nodes · 7056 edges · 112 communities (75 shown, 37 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 73 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `04af1d6d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- contract-generation.ts
- external-validation.ts
- app
- assinatura.$token.tsx
- contract-materialization.ts
- queries.ts
- followups.ts
- routeTree.gen.ts
- scripts
- dependencies
- external-mutations.integration.test.ts
- Assinatura eletrônica própria — especificação completa
- Assinatura eletrônica própria — MVP
- web/package.json
- Especificação: MVP para clínicas pequenas de estética
- db/package.json
- tasks
- components.json
- FileRoutesByPath
- Investigação de anamneses e contratos em acompanhamentos
- compilerOptions
- documentos.$followupContractId.assinar.tsx
- PreviewPdf.test.tsx
- Implementation Decisions
- dialogs.tsx
- devDependencies
- signatures.ts
- compilerOptions
- Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF
- api/tsconfig.json
- Clínicare
- buildProtectedAad
- -assinatura.$token.test.tsx
- Clínica de cuidados estéticos
- patients.ts
- SignaturePadField.test.tsx
- Button
- admin-commands.ts
- ContractFormPage.tsx
- db/tsconfig.json
- Agent skills
- scheduling.ts
- $patientId/index.tsx
- _app.tsx
- relational-schema.ts
- contratos/novo.tsx
- Decisão e plano: PostgreSQL + Drizzle + JSONB
- react
- Especificação: migração para PostgreSQL + Drizzle + JSONB
- api/package.json
- createFollowup
- Validação de assinatura externa (GOV.BR) sem PAdES próprio
- event-followups.integration.test.ts
- dependencies
- cn
- Issue tracker: GitHub
- Domain Docs
- Persistência PostgreSQL + Drizzle + JSONB
- triage-labels.md
- Preservação incremental de PDFs com assinaturas externas
- scripts
- Investigação da validação global T7
- planos/novo.tsx
- nova.tsx
- docx-types.d.ts
- Correção do cancelamento de acompanhamento, anamneses e contratos
- DB_SCHEMA.md
- request-ip.ts
- docx-pdf.ts
- vitest
- getDatabase
- relationship.ts
- PageLoadingIndicator.test.tsx
- SchemaEditor.tsx
- pdf-mutation.ts
- SigningWorkspace
- contract-authoring.ts
- sha256.ts
- contract-propagation.test.ts
- RepresentativeSignPage
- clinical.ts
- collectFingerprint
- scripts
- headers

## God Nodes (most connected - your core abstractions)
1. `getDatabase()` - 173 edges
2. `app` - 133 edges
3. `Button()` - 95 edges
4. `cn()` - 60 edges
5. `react` - 58 edges
6. `@tanstack/react-router` - 55 edges
7. `useApiMutation()` - 51 edges
8. `QueryError()` - 50 edges
9. `api()` - 50 edges
10. `lucide-react` - 46 edges

## Surprising Connections (you probably didn't know these)
- `Contratos ainda em geração` --references--> `getFollowup()`  [INFERRED]
  docs/research/acompanhamento-anamneses-cancelamento.md → apps/api/src/followups.ts
- `Solution` --references--> `patient()`  [INFERRED]
  docs/specs/0005-autoria-docx-e-materializacao-de-contratos.md → apps/api/src/anamnesis-links.integration.test.ts
- `2. Cancelamento: anamneses` --references--> `byToken()`  [INFERRED]
  docs/research/acompanhamento-anamneses-cancelamento.md → apps/api/src/clinical.ts
- `Fluxo ponta a ponta` --references--> `createFollowup()`  [INFERRED]
  docs/research/acompanhamento-anamneses-cancelamento.md → apps/api/src/followups.ts
- `2. Cancelamento: anamneses` --references--> `getFollowup()`  [INFERRED]
  docs/research/acompanhamento-anamneses-cancelamento.md → apps/api/src/followups.ts

## Import Cycles
- 2-file cycle: `packages/db/src/index.ts -> packages/db/src/migrate.ts -> packages/db/src/index.ts`
- 2-file cycle: `packages/db/src/index.ts -> packages/db/src/seed.ts -> packages/db/src/index.ts`

## Communities (112 total, 37 thin omitted)

### Community 0 - "contract-generation.ts"
Cohesion: 0.09
Nodes (22): patient(), request(), contractedNames(), protectedFollowupValue(), api(), clinicDate(), enrolled(), api() (+14 more)

### Community 1 - "external-validation.ts"
Cohesion: 0.09
Nodes (43): buildSignedReturnPdf(), buildUnparsableCmsReturn(), createTestCa(), ensureOpensslAvailable(), issueDatedTestSigner(), issueTestSigner(), num10(), parseBaseTrailer() (+35 more)

### Community 2 - "app"
Cohesion: 0.08
Nodes (52): app, expiry(), fail(), handleError(), isRecord(), observedClientIp(), addAnamnesisVersion(), addContractVersion() (+44 more)

### Community 3 - "assinatura.$token.tsx"
Cohesion: 0.11
Nodes (18): anySchema, DraggableSignature(), GovBrState, PageGeometry, PhoneGate(), PreviewPdf(), PublicHistoryEvent, PublicHistoryRevision (+10 more)

### Community 4 - "contract-materialization.ts"
Cohesion: 0.16
Nodes (21): assertRequiredContext(), ContextConfiguration, CONTRACT_CONTEXT_INCOMPLETE, defaultContextConfiguration(), DOCX_CONTENT_TYPE, encryptMaterializationContext(), extractTags(), hasValue() (+13 more)

### Community 5 - "queries.ts"
Cohesion: 0.04
Nodes (90): AttendancePhotos(), api(), withIds(), accountQuery, attendanceQuery(), confirmProfessionalSignature(), contractPlaceholdersQuery, defaultSignatureQuery (+82 more)

### Community 6 - "followups.ts"
Cohesion: 0.10
Nodes (34): contract(), form(), headers(), procedure(), request(), schema, tenantIds, schema (+26 more)

### Community 7 - "routeTree.gen.ts"
Cohesion: 0.04
Nodes (45): AppAgendaRoute, AppConfiguracoesRoute, AppContratosContractIdRoute, AppContratosIndexRoute, AppContratosNovoRoute, AppDocumentosFollowupContractIdAssinarRoute, AppDocumentosRoute, AppDocumentosRouteChildren (+37 more)

### Community 8 - "scripts"
Cohesion: 0.05
Nodes (38): devDependencies, turbo, engines, node, name, packageManager, private, scripts (+30 more)

### Community 10 - "dependencies"
Cohesion: 0.06
Nodes (32): dependencies, class-variance-authority, clsx, date-fns, @fingerprintjs/fingerprintjs, @fullcalendar/core, @fullcalendar/interaction, @fullcalendar/react (+24 more)

### Community 11 - "external-mutations.integration.test.ts"
Cohesion: 0.11
Nodes (32): headers(), placement, request(), placement, request(), ADR-0004, AppLike, assertSafeIntegrationDatabase() (+24 more)

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
Nodes (27): dependencies, drizzle-orm, pg, devDependencies, drizzle-kit, @types/bun, @types/pg, typescript (+19 more)

### Community 17 - "tasks"
Cohesion: 0.08
Nodes (24): dependsOn, inputs, outputs, cache, cache, env, persistent, env (+16 more)

### Community 18 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 19 - "FileRoutesByPath"
Cohesion: 0.08
Nodes (26): Route, Route, Route, Route, Route, Route, Route, Route (+18 more)

### Community 21 - "Investigação de anamneses e contratos em acompanhamentos"
Cohesion: 0.15
Nodes (12): latest(), offerForms(), 1. Criação: associação por oferta e por procedimento, 2. Cancelamento: anamneses, 3. Cancelamento: contratos, Conclusão, Contratos ainda em geração, Contratos com processo de assinatura (+4 more)

### Community 22 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+8 more)

### Community 23 - "documentos.$followupContractId.assinar.tsx"
Cohesion: 0.12
Nodes (17): PageGeometry, renderAllPages(), usePdfDocument(), ChecklistItem, SignChecklist(), SigningSteps(), StampPreview(), fetchProfessionalPdf() (+9 more)

### Community 24 - "PreviewPdf.test.tsx"
Cohesion: 0.27
Nodes (5): DraggableSignature(), PreviewPdf(), PreviewPlacement, placement, { renderPdfPage }

### Community 25 - "Implementation Decisions"
Cohesion: 0.09
Nodes (22): Assinatura local, Concorrência, idempotência e storage, Especificação — Assinatura eletrônica própria no MVP, Estados e conclusão, Fingerprint e evidências, Fonte, PDF e revisões, Further Notes, GOV.BR e assinaturas externas (+14 more)

### Community 26 - "dialogs.tsx"
Cohesion: 0.07
Nodes (50): CalendarView(), ComboFormPage(), day(), ProcedurePicker(), AppointmentDialog(), AppointmentFields(), localDate(), localTime() (+42 more)

### Community 27 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, jsdom, @tanstack/router-plugin, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, @types/node, @types/react (+3 more)

### Community 29 - "signatures.ts"
Cohesion: 0.07
Nodes (77): loadTrustedRootFiles(), loadTrustedRootsFromEnv(), NormalizedEvidence, normalizeEvidence(), RawFingerprint, cancelExternalAttempt(), cancelExternalAttemptAsClinicRepresentative(), canonicalJson() (+69 more)

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
Cohesion: 0.22
Nodes (19): addAnamnesisNote(), noteValue(), unprotect(), decryptMaterializationContext(), conflict(), createPayment(), deletePayment(), invalid() (+11 more)

### Community 35 - "-assinatura.$token.test.tsx"
Cohesion: 0.10
Nodes (14): Handler, marina, renderAt(), combo(), queryClient, router, createAppRouter(), createQueryClient() (+6 more)

### Community 36 - "Clínica de cuidados estéticos"
Cohesion: 0.20
Nodes (9): Attendance, Atendimento estético, Clínica de cuidados estéticos, Dados e ciclo de protótipo, Documentos e coleta, Jornada do paciente, Objetivo do produto, Organização da clínica (+1 more)

### Community 37 - "patients.ts"
Cohesion: 0.10
Nodes (19): DEFAULT_TENANT_ID, encrypted(), encryptedColumns(), PatientInput, ProtectedField, validateInput(), configuredKey(), EncryptedValue (+11 more)

### Community 38 - "SignaturePadField.test.tsx"
Cohesion: 0.09
Nodes (11): isMobileSignatureDevice(), lockLandscape(), scalePointGroups(), SignaturePadField, SignaturePadHandle, originalExitFullscreenDescriptor, originalFullscreenElementDescriptor, originalRequestFullscreenDescriptor (+3 more)

### Community 39 - "Button"
Cohesion: 0.10
Nodes (45): AnamnesisFormPage(), emptySchema, PatientPreview(), Props, AppointmentDetails(), dateLong, Props, Row() (+37 more)

### Community 40 - "admin-commands.ts"
Cohesion: 0.05
Nodes (49): administratorByEmail(), BOOTSTRAP_ENV_KEYS, bootstrapConfigFromEnv(), changeClinicAdministratorEmail(), CreateAdministratorInput, createBetterAuthClinicAdministrator(), createClinicAdministrator(), createTenant() (+41 more)

### Community 41 - "ContractFormPage.tsx"
Cohesion: 0.17
Nodes (17): contextDescription(), contextLabel(), CONTEXTS, ContractDraftPanel(), ContractFormPage(), ContractMetadata, Props, Input() (+9 more)

### Community 42 - "db/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, types, extends, include, ../../tsconfig.json

### Community 43 - "Agent skills"
Cohesion: 0.29
Nodes (6): Agent skills, Domain docs, graphify, Issue tracker, This is NOT the Turborepo you know, Triage labels

### Community 44 - "scheduling.ts"
Cohesion: 0.14
Nodes (40): civilDateOf(), clinicTimeZone(), activeAppointmentStatuses, addAttendancePhoto(), appointmentResponse(), assertAtomicCombos(), assertEventDay(), attendanceResponse() (+32 more)

### Community 45 - "$patientId/index.tsx"
Cohesion: 0.12
Nodes (30): ContractGenerateButton(), ContractReprocessButton(), ContractSignatureHistory(), copySignatureLink(), ContractSummary(), Entry, pendingBadge(), NewFollowupDialog() (+22 more)

### Community 46 - "_app.tsx"
Cohesion: 0.19
Nodes (17): QuickActions(), Sheet(), SheetClose(), SheetContent(), SheetDescription(), SheetHeader(), SheetOverlay(), SheetTitle() (+9 more)

### Community 47 - "relational-schema.ts"
Cohesion: 0.06
Nodes (35): catalogTimestamps, contractVersionPdfUploadIntents, NewRelationalPatient, NewRelationalProcedure, NewTenant, paymentRelations, planVersionAnamneses, RelationalAnamnesis (+27 more)

### Community 48 - "contratos/novo.tsx"
Cohesion: 0.67
Nodes (3): useCreateContract(), NewContract(), Route

### Community 49 - "Decisão e plano: PostgreSQL + Drizzle + JSONB"
Cohesion: 0.09
Nodes (21): 10. Go/no-go para implementação, 1. Conclusão, 2. Decisões de domínio confirmadas, 3. Modelo de domínio e estados, 4. Blueprint relacional inicial, 5. Matriz de invariantes, 6. Fronteiras transacionais, 7. Reaproveitamento do Git (+13 more)

### Community 50 - "react"
Cohesion: 0.07
Nodes (58): allowed, Phase, phases, AttendanceRecordForm(), matchesPatient(), PatientRow(), QueryError(), Props (+50 more)

### Community 51 - "Especificação: migração para PostgreSQL + Drizzle + JSONB"
Cohesion: 0.13
Nodes (14): API, frontend e operações de produto, Catálogo, planos e snapshots, Dados protegidos, Especificação: migração para PostgreSQL + Drizzle + JSONB, Further Notes, Implementation Decisions, Integridade e concorrência, Máquina de estados (+6 more)

### Community 52 - "api/package.json"
Cohesion: 0.11
Nodes (18): devDependencies, @types/bun, typescript, drizzle-orm, @types/bun, typescript, name, private (+10 more)

### Community 53 - "createFollowup"
Cohesion: 0.21
Nodes (17): cancelFollowup(), cancelFollowupItem(), conflict(), createFollowup(), getFollowup(), hashToken(), idShape(), invalid() (+9 more)

### Community 55 - "Validação de assinatura externa (GOV.BR) sem PAdES próprio"
Cohesion: 0.40
Nodes (4): Resultados, Revalidação em mutações posteriores (Issue #27), Validação de assinatura externa (GOV.BR) sem PAdES próprio, Verificações executadas (todas genuínas, nenhuma presumida)

### Community 56 - "event-followups.integration.test.ts"
Cohesion: 0.14
Nodes (30): schema, schema, api(), call(), clinicDate(), fixture(), schema, cleanupIntegrationClinics() (+22 more)

### Community 58 - "dependencies"
Cohesion: 0.14
Nodes (14): dependencies, asn1js, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, better-auth, @better-auth/drizzle-adapter, @clinicare/db, docxtemplater (+6 more)

### Community 59 - "cn"
Cohesion: 0.14
Nodes (27): OfferFields(), PaymentDialog(), StandaloneAttendanceDialog(), Field(), buttonVariants, Calendar(), CalendarDayButton(), NativeSelect() (+19 more)

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

### Community 79 - "planos/novo.tsx"
Cohesion: 0.11
Nodes (44): AnamnesisPicker(), InheritedAnamneses(), CpfField(), EditPatientDialog(), FormPage(), Kind, kinds, PlanOfferPicker() (+36 more)

### Community 80 - "nova.tsx"
Cohesion: 0.67
Nodes (3): useCreateAnamnesis(), NewAnamnesis(), Route

### Community 82 - "Correção do cancelamento de acompanhamento, anamneses e contratos"
Cohesion: 0.22
Nodes (8): Correção do cancelamento de acompanhamento, anamneses e contratos, Further Notes, Implementation Decisions, Out of Scope, Problem Statement, Solution, Testing Decisions, User Stories

### Community 84 - "request-ip.ts"
Cohesion: 0.43
Nodes (4): forwardedParameter(), headerAddress(), observedClientIp(), validIp()

### Community 85 - "docx-pdf.ts"
Cohesion: 0.16
Nodes (8): createLibreOfficeConverter(), DocxToPdfConverter, LIBREOFFICE_DEFAULT_TIMEOUT_MS, createSpaFallback(), createWebAssetMiddleware(), serveSpaIndex, hono, pizzip

### Community 86 - "vitest"
Cohesion: 0.15
Nodes (6): ControlledEditor(), schema, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, vitest

### Community 87 - "getDatabase"
Cohesion: 0.08
Nodes (59): authFailure(), BRAZILIAN_STATES, changeOwnEmail(), changeOwnPassword(), getAccount(), getDefaultSignature(), getProfessionalProfile(), REGISTRATION_TYPES (+51 more)

### Community 90 - "PageLoadingIndicator.test.tsx"
Cohesion: 0.33
Nodes (4): PageLoadingIndicator(), setup(), Route, FileRoutesById

### Community 91 - "SchemaEditor.tsx"
Cohesion: 0.07
Nodes (61): submit(), canControlVisibility(), conditionOf(), Field, FieldPatch, identifierFor(), newSalt(), Preview() (+53 more)

### Community 92 - "pdf-mutation.ts"
Cohesion: 0.36
Nodes (6): createIncrementalSignaturePdf(), normalizedPlacementToPdfRect(), PdfPlacement, PdfRect, sha256(), validatePlacement()

### Community 93 - "SigningWorkspace"
Cohesion: 0.24
Nodes (11): DRAFT_STORAGE_KEY(), readStoredDraft(), SigningWorkspace(), captureFromPad(), clear(), confirm(), goBackToStep(), goToConfirm() (+3 more)

### Community 96 - "contract-authoring.ts"
Cohesion: 0.18
Nodes (21): docxMetadata(), invalid(), propagatePublishedVersion(), publishContractDraft(), saveContractDraft(), sha256(), uuid(), buildContext() (+13 more)

### Community 100 - "RepresentativeSignPage"
Cohesion: 0.24
Nodes (16): previewProfessionalSignature(), usePreviewProfessionalSignature(), draftKey(), readDraft(), RepresentativeSignPage(), flag(), handleClear(), handleConfirm() (+8 more)

### Community 102 - "clinical.ts"
Cohesion: 0.08
Nodes (33): claimCleanupJob(), cleanupLease(), CleanupResult, CleanupStatus, clearDraft, deleteAppliedDocument(), documentOwnsCleanupKeys(), heartbeatCleanupJob() (+25 more)

### Community 106 - "collectFingerprint"
Cohesion: 0.32
Nodes (11): CollectedFingerprint, collectFingerprint(), createIdempotencyKey(), GovBrSection(), acceptReturn(), cancelAttempt(), exportRevision(), importReturn() (+3 more)

### Community 114 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

## Knowledge Gaps
- **631 isolated node(s):** `name`, `private`, `type`, `dev`, `dev:debug` (+626 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 802 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **37 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ContractVersion` connect `Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF` to `queries.ts`?**
  _High betweenness centrality (0.287) - this node is a cross-community bridge._
- **Why does `Solution` connect `Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF` to `contract-generation.ts`?**
  _High betweenness centrality (0.278) - this node is a cross-community bridge._
- **Why does `patient()` connect `contract-generation.ts` to `Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF`, `followups.ts`, `getDatabase`?**
  _High betweenness centrality (0.278) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _631 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `contract-generation.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0945945945945946 - nodes in this community are weakly interconnected._
- **Should `external-validation.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08758503401360544 - nodes in this community are weakly interconnected._
- **Should `app` be split into smaller, more focused modules?**
  _Cohesion score 0.07532467532467532 - nodes in this community are weakly interconnected._