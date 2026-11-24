# Graph Report - clinicare  (2026-11-23)

## Corpus Check
- 272 files · ~200,517 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 15 file(s) not represented in the graph (top: (none) 7, .css 4, .example 1)

## Summary
- 2139 nodes · 6978 edges · 116 communities (78 shown, 38 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 71 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `803cfaac`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- db/src/index.ts
- external-validation.ts
- catalog.ts
- assinatura.$token.tsx
- contract-authoring.ts
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
- app.ts
- compilerOptions
- admin-commands.ts
- PreviewPdf.tsx
- Implementation Decisions
- cn
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
- documentos.$followupContractId.assinar.tsx
- createFollowup
- db/tsconfig.json
- Agent skills
- scheduling.ts
- format.ts
- _app.tsx
- relational-schema.ts
- ContractFormPage.tsx
- Decisão e plano: PostgreSQL + Drizzle + JSONB
- react
- Especificação: migração para PostgreSQL + Drizzle + JSONB
- api/package.json
- docx-pdf.ts
- Validação de assinatura externa (GOV.BR) sem PAdES próprio
- event-followups.integration.test.ts
- dependencies
- api
- Issue tracker: GitHub
- Domain Docs
- Persistência PostgreSQL + Drizzle + JSONB
- triage-labels.md
- Preservação incremental de PDFs com assinaturas externas
- scripts
- Investigação da validação global T7
- planos/novo.tsx
- dialogs.tsx
- docx-types.d.ts
- Correção do cancelamento de acompanhamento, anamneses e contratos
- DB_SCHEMA.md
- request-ip.ts
- api/src/index.ts
- -documentos.test.tsx
- encryptValue
- relationship.ts
- PageLoadingIndicator.test.tsx
- SchemaEditor.tsx
- headers
- SigningWorkspace
- pdf-mutation.ts
- devDependencies
- request
- StatusBadge
- RepresentativeSignPage
- getDatabase
- SignaturePadField.tsx
- collectFingerprint
- scripts
- clinical.ts
- generate-secrets.ts
- request

## God Nodes (most connected - your core abstractions)
1. `getDatabase()` - 170 edges
2. `app` - 132 edges
3. `Button()` - 95 edges
4. `cn()` - 60 edges
5. `react` - 58 edges
6. `@tanstack/react-router` - 55 edges
7. `QueryError()` - 50 edges
8. `useApiMutation()` - 48 edges
9. `api()` - 47 edges
10. `lucide-react` - 46 edges

## Surprising Connections (you probably didn't know these)
- `Contratos ainda em geração` --references--> `getFollowup()`  [INFERRED]
  docs/research/acompanhamento-anamneses-cancelamento.md → apps/api/src/followups.ts
- `Solution` --references--> `patient()`  [INFERRED]
  docs/specs/0005-autoria-docx-e-materializacao-de-contratos.md → apps/api/src/anamnesis-links.integration.test.ts
- `2. Cancelamento: anamneses` --references--> `byToken()`  [INFERRED]
  docs/research/acompanhamento-anamneses-cancelamento.md → apps/api/src/clinical.ts
- `Implementation Decisions` --references--> `Contract`  [INFERRED]
  docs/specs/0005-autoria-docx-e-materializacao-de-contratos.md → apps/web/src/lib/schemas.ts
- `Decisão` --references--> `ContractVersion`  [INFERRED]
  docs/adr/0005-autoria-docx-e-materializacao-de-contratos.md → apps/web/src/lib/schemas.ts

## Import Cycles
- 2-file cycle: `packages/db/src/index.ts -> packages/db/src/migrate.ts -> packages/db/src/index.ts`
- 2-file cycle: `packages/db/src/index.ts -> packages/db/src/seed.ts -> packages/db/src/index.ts`

## Communities (116 total, 38 thin omitted)

### Community 0 - "db/src/index.ts"
Cohesion: 0.14
Nodes (22): AuthInstance, SESSION_DURATION_SECONDS, AppLike, assertSafeIntegrationDatabase(), integration, integrationCookies, authAccounts, authSchema (+14 more)

### Community 1 - "external-validation.ts"
Cohesion: 0.09
Nodes (43): buildSignedReturnPdf(), buildUnparsableCmsReturn(), createTestCa(), ensureOpensslAvailable(), issueDatedTestSigner(), issueTestSigner(), num10(), parseBaseTrailer() (+35 more)

### Community 2 - "catalog.ts"
Cohesion: 0.08
Nodes (45): addAnamnesisVersion(), addContractVersion(), anamnesisResponse(), catalogTenant(), checkAnamnesisIds(), comboAnamnesisIds(), comboResponse(), comboValid() (+37 more)

### Community 3 - "assinatura.$token.tsx"
Cohesion: 0.11
Nodes (17): CollectedFingerprint, anySchema, DraggableSignature(), GovBrState, PageGeometry, PhoneGate(), PreviewPdf(), PublicHistoryEvent (+9 more)

### Community 4 - "contract-authoring.ts"
Cohesion: 0.08
Nodes (46): docxMetadata(), getContractDraftEditor(), invalid(), propagatePublishedVersion(), publishContractDraft(), saveContractDraft(), sha256(), uuid() (+38 more)

### Community 5 - "queries.ts"
Cohesion: 0.05
Nodes (62): attendancesQuery, confirmProfessionalSignature(), everything, MutationConfig, patientRefresh, postParticipantPdf(), previewProfessionalSignature(), publicFormQuery() (+54 more)

### Community 6 - "followups.ts"
Cohesion: 0.10
Nodes (28): contract(), form(), headers(), procedure(), request(), schema, tenantIds, schema (+20 more)

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
Nodes (35): request(), deleteAppliedDocument(), placement, request(), placement, ADR-0004, integrationHeaders(), contexts (+27 more)

### Community 12 - "Assinatura eletrônica própria — especificação completa"
Cohesion: 0.09
Nodes (22): 10. Selo da plataforma e gestão de chaves, 11. Pacote exportável e verificação independente, 12. Recuperação, revogação e tempo, 13. Limites de confiança, 14. Critérios de aceitação, 1. Objetivo e decisões de produto, 2. O que o sistema pretende demonstrar, 3.1. Fingerprint obrigatório desde o MVP (+14 more)

### Community 13 - "Assinatura eletrônica própria — MVP"
Cohesion: 0.09
Nodes (22): 10. Histórico, armazenamento e download, 11. Estrutura preparada para evolução, 12. O que fica fora deste MVP, 13. Critérios para considerar o MVP pronto, 14. Limite da evolução futura, 1. Objetivo, 2. Fluxo oficial, também mantido na produção, 3.1. Fingerprint obrigatório desde o MVP (+14 more)

### Community 14 - "web/package.json"
Cohesion: 0.07
Nodes (28): typescript, name, private, type, CalendarEntry, CalendarView(), class-variance-authority, clsx (+20 more)

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
Nodes (24): Route, Route, Route, Route, Route, Route, Route, Route (+16 more)

### Community 21 - "app.ts"
Cohesion: 0.10
Nodes (41): BRAZILIAN_STATES, getAccount(), getDefaultSignature(), getProfessionalProfile(), REGISTRATION_TYPES, updateAccount(), updateDefaultSignature(), updateInitialPasswordChoice() (+33 more)

### Community 22 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+8 more)

### Community 23 - "admin-commands.ts"
Cohesion: 0.08
Nodes (35): administratorByEmail(), BOOTSTRAP_ENV_KEYS, bootstrapConfigFromEnv(), changeClinicAdministratorEmail(), CreateAdministratorInput, createBetterAuthClinicAdministrator(), createClinicAdministrator(), createTenant() (+27 more)

### Community 24 - "PreviewPdf.tsx"
Cohesion: 0.33
Nodes (4): DraggableSignature(), PreviewPdf(), PreviewPlacement, pdfjs-dist

### Community 25 - "Implementation Decisions"
Cohesion: 0.09
Nodes (22): Assinatura local, Concorrência, idempotência e storage, Especificação — Assinatura eletrônica própria no MVP, Estados e conclusão, Fingerprint e evidências, Fonte, PDF e revisões, Further Notes, GOV.BR e assinaturas externas (+14 more)

### Community 26 - "cn"
Cohesion: 0.12
Nodes (36): ComboFormPage(), day(), ProcedurePicker(), AppointmentFields(), minutesBetween(), OfferFields(), PaymentDialog(), StandaloneAttendanceDialog() (+28 more)

### Community 27 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, jsdom, @tanstack/router-plugin, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, @types/node, @types/react (+3 more)

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
Cohesion: 0.20
Nodes (20): addAnamnesisNote(), listAnamnesisNotes(), noteValue(), unprotect(), decryptMaterializationContext(), conflict(), createPayment(), deletePayment() (+12 more)

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
Cohesion: 0.11
Nodes (4): originalExitFullscreenDescriptor, originalFullscreenElementDescriptor, originalRequestFullscreenDescriptor, ResizeCallback

### Community 39 - "Button"
Cohesion: 0.09
Nodes (48): AnamnesisFormPage(), emptySchema, PatientPreview(), Props, AppointmentDetails(), dateLong, Props, Row() (+40 more)

### Community 40 - "documentos.$followupContractId.assinar.tsx"
Cohesion: 0.13
Nodes (15): PageGeometry, renderAllPages(), usePdfDocument(), ChecklistItem, SignChecklist(), SigningSteps(), StampPreview(), fetchProfessionalPdf() (+7 more)

### Community 41 - "createFollowup"
Cohesion: 0.12
Nodes (23): createFollowup(), hashToken(), idShape(), invalid(), issueInitialTokens(), latest(), notFound(), offerForms() (+15 more)

### Community 42 - "db/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, types, extends, include, ../../tsconfig.json

### Community 43 - "Agent skills"
Cohesion: 0.29
Nodes (6): Agent skills, Domain docs, graphify, Issue tracker, This is NOT the Turborepo you know, Triage labels

### Community 44 - "scheduling.ts"
Cohesion: 0.14
Nodes (39): civilDateOf(), clinicTimeZone(), activeAppointmentStatuses, addAttendancePhoto(), appointmentResponse(), assertAtomicCombos(), assertEventDay(), attendanceResponse() (+31 more)

### Community 45 - "format.ts"
Cohesion: 0.13
Nodes (19): allowed, AttendancePhotos(), Phase, phases, appointmentStatus, duration(), monthLabel(), offerKinds (+11 more)

### Community 46 - "_app.tsx"
Cohesion: 0.20
Nodes (16): Sheet(), SheetClose(), SheetContent(), SheetDescription(), SheetHeader(), SheetOverlay(), SheetTitle(), SheetTrigger() (+8 more)

### Community 47 - "relational-schema.ts"
Cohesion: 0.06
Nodes (34): catalogTimestamps, contractVersionPdfUploadIntents, NewRelationalPatient, NewRelationalProcedure, NewTenant, paymentRelations, RelationalAnamnesis, RelationalAnamnesisVersion (+26 more)

### Community 48 - "ContractFormPage.tsx"
Cohesion: 0.15
Nodes (17): contextDescription(), contextLabel(), CONTEXTS, ContractDraftPanel(), ContractFormPage(), ContractMetadata, Props, ContractVersionsButton() (+9 more)

### Community 49 - "Decisão e plano: PostgreSQL + Drizzle + JSONB"
Cohesion: 0.09
Nodes (21): 10. Go/no-go para implementação, 1. Conclusão, 2. Decisões de domínio confirmadas, 3. Modelo de domínio e estados, 4. Blueprint relacional inicial, 5. Matriz de invariantes, 6. Fronteiras transacionais, 7. Reaproveitamento do Git (+13 more)

### Community 50 - "react"
Cohesion: 0.10
Nodes (44): AttendanceRecordForm(), matchesPatient(), PatientRow(), QueryError(), Props, SchemaForm(), appliedAnamnesisQuery(), appointmentsQuery (+36 more)

### Community 51 - "Especificação: migração para PostgreSQL + Drizzle + JSONB"
Cohesion: 0.13
Nodes (14): API, frontend e operações de produto, Catálogo, planos e snapshots, Dados protegidos, Especificação: migração para PostgreSQL + Drizzle + JSONB, Further Notes, Implementation Decisions, Integridade e concorrência, Máquina de estados (+6 more)

### Community 52 - "api/package.json"
Cohesion: 0.12
Nodes (15): drizzle-orm, @types/bun, typescript, name, private, type, asn1js, @aws-sdk/client-s3 (+7 more)

### Community 53 - "docx-pdf.ts"
Cohesion: 0.22
Nodes (4): createLibreOfficeConverter(), DocxToPdfConverter, LIBREOFFICE_DEFAULT_TIMEOUT_MS, pizzip

### Community 55 - "Validação de assinatura externa (GOV.BR) sem PAdES próprio"
Cohesion: 0.40
Nodes (4): Resultados, Revalidação em mutações posteriores (Issue #27), Validação de assinatura externa (GOV.BR) sem PAdES próprio, Verificações executadas (todas genuínas, nenhuma presumida)

### Community 56 - "event-followups.integration.test.ts"
Cohesion: 0.14
Nodes (30): contractedNames(), schema, schema, api(), call(), clinicDate(), fixture(), schema (+22 more)

### Community 58 - "dependencies"
Cohesion: 0.14
Nodes (14): dependencies, asn1js, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, better-auth, @better-auth/drizzle-adapter, @clinicare/db, docxtemplater (+6 more)

### Community 59 - "api"
Cohesion: 0.12
Nodes (25): Tabs(), TabsContent(), TabsList(), TabsTrigger(), api(), withIds(), accountQuery, defaultSignatureQuery (+17 more)

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
Cohesion: 0.10
Nodes (46): AnamnesisPicker(), InheritedAnamneses(), CpfField(), EditPatientDialog(), Field(), FormPage(), FormPageProps, Kind (+38 more)

### Community 80 - "dialogs.tsx"
Cohesion: 0.07
Nodes (44): AppointmentDialog(), localDate(), localTime(), NewFollowupDialog(), PlannedItem, Selection, QuickActions(), anamnesisForm (+36 more)

### Community 82 - "Correção do cancelamento de acompanhamento, anamneses e contratos"
Cohesion: 0.22
Nodes (8): Correção do cancelamento de acompanhamento, anamneses e contratos, Further Notes, Implementation Decisions, Out of Scope, Problem Statement, Solution, Testing Decisions, User Stories

### Community 84 - "request-ip.ts"
Cohesion: 0.43
Nodes (4): forwardedParameter(), headerAddress(), observedClientIp(), validIp()

### Community 85 - "api/src/index.ts"
Cohesion: 0.36
Nodes (5): resolvedPort, createSpaFallback(), createWebAssetMiddleware(), serveSpaIndex, hono

### Community 86 - "-documentos.test.tsx"
Cohesion: 0.12
Nodes (7): ControlledEditor(), schema, @noble/hashes, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, vitest

### Community 87 - "encryptValue"
Cohesion: 0.21
Nodes (12): patient(), protectedFollowupValue(), api(), clinicDate(), enrolled(), api(), enrolled(), today() (+4 more)

### Community 90 - "PageLoadingIndicator.test.tsx"
Cohesion: 0.33
Nodes (4): PageLoadingIndicator(), setup(), Route, FileRoutesById

### Community 91 - "SchemaEditor.tsx"
Cohesion: 0.07
Nodes (61): submit(), canControlVisibility(), conditionOf(), Field, FieldPatch, identifierFor(), newSalt(), Preview() (+53 more)

### Community 93 - "SigningWorkspace"
Cohesion: 0.24
Nodes (11): DRAFT_STORAGE_KEY(), readStoredDraft(), SigningWorkspace(), captureFromPad(), clear(), confirm(), goBackToStep(), goToConfirm() (+3 more)

### Community 96 - "pdf-mutation.ts"
Cohesion: 0.36
Nodes (6): createIncrementalSignaturePdf(), normalizedPlacementToPdfRect(), PdfPlacement, PdfRect, sha256(), validatePlacement()

### Community 97 - "devDependencies"
Cohesion: 0.67
Nodes (3): devDependencies, @types/bun, typescript

### Community 99 - "StatusBadge"
Cohesion: 0.12
Nodes (28): ContractGenerateButton(), ContractReprocessButton(), ContractSignatureHistory(), copySignatureLink(), ContractSummary(), Entry, pendingBadge(), Body() (+20 more)

### Community 100 - "RepresentativeSignPage"
Cohesion: 0.24
Nodes (15): composeStampImage(), loadImage(), trimTransparent(), RepresentativeSignPage(), flag(), handleClear(), handleConfirm(), handleDrawOther() (+7 more)

### Community 102 - "getDatabase"
Cohesion: 0.09
Nodes (41): answerAppliedAnamnesis(), appliedShape(), byToken(), cancelledError(), claimCleanupJob(), cleanupLease(), createAnamnesisRequest(), createAppliedAnamnesis() (+33 more)

### Community 103 - "SignaturePadField.tsx"
Cohesion: 0.39
Nodes (7): isMobileSignatureDevice(), lockLandscape(), scalePointGroups(), SignaturePadField, SignaturePadHandle, unlockLandscape(), signature_pad

### Community 106 - "collectFingerprint"
Cohesion: 0.50
Nodes (9): collectFingerprint(), createIdempotencyKey(), GovBrSection(), acceptReturn(), cancelAttempt(), exportRevision(), importReturn(), postJson() (+1 more)

### Community 114 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 115 - "clinical.ts"
Cohesion: 0.10
Nodes (18): CleanupResult, CleanupStatus, clearDraft, fixture(), headers(), post(), request(), bucket (+10 more)

## Knowledge Gaps
- **628 isolated node(s):** `name`, `private`, `type`, `dev`, `dev:debug` (+623 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 794 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **38 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ContractVersion` connect `Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF` to `queries.ts`?**
  _High betweenness centrality (0.287) - this node is a cross-community bridge._
- **Why does `Solution` connect `Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF` to `encryptValue`?**
  _High betweenness centrality (0.283) - this node is a cross-community bridge._
- **Why does `patient()` connect `encryptValue` to `getDatabase`, `followups.ts`, `Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF`?**
  _High betweenness centrality (0.282) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _628 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `db/src/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13588850174216027 - nodes in this community are weakly interconnected._
- **Should `external-validation.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08758503401360544 - nodes in this community are weakly interconnected._
- **Should `catalog.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07890070921985816 - nodes in this community are weakly interconnected._