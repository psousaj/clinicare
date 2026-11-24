# Graph Report - clinicare  (2026-11-24)

## Corpus Check
- 275 files · ~203,673 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 15 file(s) not represented in the graph (top: (none) 7, .css 4, .example 1)

## Summary
- 2156 nodes · 7052 edges · 112 communities (78 shown, 34 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 73 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bd68ac8d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- atendimentos.$attendanceId.tsx
- external-validation.ts
- app
- assinatura.$token.tsx
- contract-authoring.ts
- queries.ts
- signatures-flow.integration.test.ts
- routeTree.gen.ts
- scripts
- dependencies
- db/src/index.ts
- Assinatura eletrônica própria — especificação completa
- Assinatura eletrônica própria — MVP
- web/package.json
- Especificação: MVP para clínicas pequenas de estética
- db/package.json
- tasks
- components.json
- FileRoutesByPath
- invalid
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
- signWithToken
- db/tsconfig.json
- Agent skills
- scheduling.ts
- $patientId/index.tsx
- _app.tsx
- relational-schema.ts
- contratos/novo.tsx
- Decisão e plano: PostgreSQL + Drizzle + JSONB
- @tanstack/react-router
- Especificação: migração para PostgreSQL + Drizzle + JSONB
- api/package.json
- createFollowup
- Validação de assinatura externa (GOV.BR) sem PAdES próprio
- followups.ts
- issueSignatureToken
- api
- Issue tracker: GitHub
- Domain Docs
- Persistência PostgreSQL + Drizzle + JSONB
- triage-labels.md
- Preservação incremental de PDFs com assinaturas externas
- SignaturePadField.tsx
- Investigação da validação global T7
- react
- nova.tsx
- docx-types.d.ts
- Correção do cancelamento de acompanhamento, anamneses e contratos
- DB_SCHEMA.md
- request-ip.ts
- app.ts
- -documentos.test.tsx
- createAnamnesisRequest
- normalizeEvidence
- relationship.ts
- PageLoadingIndicator.test.tsx
- SchemaEditor.tsx
- pdf-mutation.ts
- SigningWorkspace
- getDatabase
- vitest
- composeStampImage
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
- `Solution` --references--> `patient()`  [INFERRED]
  docs/specs/0005-autoria-docx-e-materializacao-de-contratos.md → apps/api/src/anamnesis-links.integration.test.ts
- `2. Cancelamento: anamneses` --references--> `getFollowup()`  [INFERRED]
  docs/research/acompanhamento-anamneses-cancelamento.md → apps/api/src/followups.ts
- `Contratos ainda em geração` --references--> `getFollowup()`  [INFERRED]
  docs/research/acompanhamento-anamneses-cancelamento.md → apps/api/src/followups.ts
- `Implementation Decisions` --references--> `Contract`  [INFERRED]
  docs/specs/0005-autoria-docx-e-materializacao-de-contratos.md → apps/web/src/lib/schemas.ts
- `Decisão` --references--> `ContractVersion`  [INFERRED]
  docs/adr/0005-autoria-docx-e-materializacao-de-contratos.md → apps/web/src/lib/schemas.ts

## Import Cycles
- 2-file cycle: `packages/db/src/index.ts -> packages/db/src/migrate.ts -> packages/db/src/index.ts`
- 2-file cycle: `packages/db/src/index.ts -> packages/db/src/seed.ts -> packages/db/src/index.ts`

## Communities (112 total, 34 thin omitted)

### Community 0 - "atendimentos.$attendanceId.tsx"
Cohesion: 0.11
Nodes (23): allowed, AttendancePhotos(), Phase, phases, CalendarView(), EditPatientDialog(), Textarea(), photoPhases (+15 more)

### Community 1 - "external-validation.ts"
Cohesion: 0.13
Nodes (31): blankReport(), bytesEqual(), certEndpoints(), CertView, checkCrl(), checkOcsp(), checkRevocation(), cmsMessageDigest() (+23 more)

### Community 2 - "app"
Cohesion: 0.07
Nodes (55): app, expiry(), fail(), handleError(), isRecord(), observedClientIp(), addAnamnesisVersion(), addContractVersion() (+47 more)

### Community 3 - "assinatura.$token.tsx"
Cohesion: 0.12
Nodes (18): anySchema, DRAFT_STORAGE_KEY(), DraggableSignature(), GovBrState, PageGeometry, PhoneGate(), PreviewPdf(), PublicHistoryEvent (+10 more)

### Community 4 - "contract-authoring.ts"
Cohesion: 0.10
Nodes (34): docxMetadata(), invalid(), propagatePublishedVersion(), publishContractDraft(), saveContractDraft(), sha256(), uuid(), replaceUnsignedAppliedContract() (+26 more)

### Community 5 - "queries.ts"
Cohesion: 0.04
Nodes (89): contextDescription(), contextLabel(), CONTEXTS, ContractDraftPanel(), ContractFormPage(), ContractMetadata, Props, attendancesQuery (+81 more)

### Community 6 - "signatures-flow.integration.test.ts"
Cohesion: 0.11
Nodes (26): request(), schema, tenantIds, civilDate(), eventBody(), fixtures(), headers(), request() (+18 more)

### Community 7 - "routeTree.gen.ts"
Cohesion: 0.04
Nodes (45): AppAgendaRoute, AppConfiguracoesRoute, AppContratosContractIdRoute, AppContratosIndexRoute, AppContratosNovoRoute, AppDocumentosFollowupContractIdAssinarRoute, AppDocumentosRoute, AppDocumentosRouteChildren (+37 more)

### Community 8 - "scripts"
Cohesion: 0.05
Nodes (38): devDependencies, turbo, engines, node, name, packageManager, private, scripts (+30 more)

### Community 10 - "dependencies"
Cohesion: 0.06
Nodes (32): dependencies, class-variance-authority, clsx, date-fns, @fingerprintjs/fingerprintjs, @fullcalendar/core, @fullcalendar/interaction, @fullcalendar/react (+24 more)

### Community 11 - "db/src/index.ts"
Cohesion: 0.17
Nodes (21): provisionClinic(), AppLike, assertSafeIntegrationDatabase(), cleanupIntegrationClinics(), integration, integrationCookies, authAccounts, authSchema (+13 more)

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
Nodes (33): dependencies, drizzle-orm, pg, devDependencies, drizzle-kit, @types/bun, @types/pg, typescript (+25 more)

### Community 17 - "tasks"
Cohesion: 0.08
Nodes (24): dependsOn, inputs, outputs, cache, cache, env, persistent, env (+16 more)

### Community 18 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 19 - "FileRoutesByPath"
Cohesion: 0.07
Nodes (27): Route, Route, Route, Route, Route, Route, Route, Route (+19 more)

### Community 21 - "invalid"
Cohesion: 0.27
Nodes (17): currentDocument(), decodePng(), idempotencyKeyReused(), invalid(), lockedAccessContext(), lockedParticipantReadContext(), lockedTokenContext(), lockedTokenReadContext() (+9 more)

### Community 22 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+8 more)

### Community 23 - "documentos.$followupContractId.assinar.tsx"
Cohesion: 0.14
Nodes (13): PageGeometry, renderAllPages(), usePdfDocument(), ChecklistItem, SignChecklist(), SigningSteps(), StampPreview(), fetchProfessionalPdf() (+5 more)

### Community 24 - "PreviewPdf.test.tsx"
Cohesion: 0.24
Nodes (6): DraggableSignature(), PreviewPdf(), PreviewPlacement, placement, { renderPdfPage }, pdfjs-dist

### Community 25 - "Implementation Decisions"
Cohesion: 0.09
Nodes (22): Assinatura local, Concorrência, idempotência e storage, Especificação — Assinatura eletrônica própria no MVP, Estados e conclusão, Fingerprint e evidências, Fonte, PDF e revisões, Further Notes, GOV.BR e assinaturas externas (+14 more)

### Community 26 - "dialogs.tsx"
Cohesion: 0.10
Nodes (45): ProcedurePicker(), AppointmentDialog(), AppointmentFields(), localDate(), localTime(), minutesBetween(), OfferFields(), PaymentDialog() (+37 more)

### Community 27 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, jsdom, @tanstack/router-plugin, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, @types/node, @types/react (+3 more)

### Community 29 - "signatures.ts"
Cohesion: 0.09
Nodes (34): loadTrustedRootFiles(), loadTrustedRootsFromEnv(), cancelExternalAttempt(), cancelExternalAttemptAsClinicRepresentative(), ClinicSignatureActor, contentAad(), displayName(), downloadExternalExport() (+26 more)

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
Cohesion: 0.17
Nodes (22): addAnamnesisNote(), listAnamnesisNotes(), noteValue(), unprotect(), decryptMaterializationContext(), conflict(), createPayment(), deletePayment() (+14 more)

### Community 35 - "-assinatura.$token.test.tsx"
Cohesion: 0.10
Nodes (14): Handler, marina, renderAt(), combo(), queryClient, router, createAppRouter(), createQueryClient() (+6 more)

### Community 36 - "Clínica de cuidados estéticos"
Cohesion: 0.20
Nodes (9): Attendance, Atendimento estético, Clínica de cuidados estéticos, Dados e ciclo de protótipo, Documentos e coleta, Jornada do paciente, Objetivo do produto, Organização da clínica (+1 more)

### Community 37 - "patients.ts"
Cohesion: 0.10
Nodes (27): createPatient(), deactivatePatient(), DEFAULT_TENANT_ID, encrypted(), encryptedColumns(), ensureTenant(), getPatient(), isUuid() (+19 more)

### Community 38 - "SignaturePadField.test.tsx"
Cohesion: 0.11
Nodes (4): originalExitFullscreenDescriptor, originalFullscreenElementDescriptor, originalRequestFullscreenDescriptor, ResizeCallback

### Community 39 - "Button"
Cohesion: 0.13
Nodes (39): AnamnesisFormPage(), emptySchema, PatientPreview(), Props, AppointmentDetails(), dateLong, Props, Row() (+31 more)

### Community 40 - "admin-commands.ts"
Cohesion: 0.07
Nodes (31): administratorByEmail(), BOOTSTRAP_ENV_KEYS, bootstrapConfigFromEnv(), changeClinicAdministratorEmail(), CreateAdministratorInput, createBetterAuthClinicAdministrator(), createClinicAdministrator(), createTenant() (+23 more)

### Community 41 - "signWithToken"
Cohesion: 0.20
Nodes (16): canonicalJson(), confirmExternalReturn(), confirmExternalReturnAsClinicRepresentative(), evidenceAad(), hashBytes(), hashJson(), lockedParticipantContext(), previewMismatch() (+8 more)

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
Cohesion: 0.11
Nodes (35): ContractGenerateButton(), ContractReprocessButton(), ContractSignatureHistory(), copySignatureLink(), ContractSummary(), Entry, pendingBadge(), NewFollowupDialog() (+27 more)

### Community 46 - "_app.tsx"
Cohesion: 0.19
Nodes (17): QuickActions(), Sheet(), SheetClose(), SheetContent(), SheetDescription(), SheetHeader(), SheetOverlay(), SheetTitle() (+9 more)

### Community 47 - "relational-schema.ts"
Cohesion: 0.06
Nodes (34): catalogTimestamps, contractVersionPdfUploadIntents, NewRelationalPatient, NewRelationalProcedure, NewTenant, paymentRelations, RelationalAnamnesis, RelationalAnamnesisVersion (+26 more)

### Community 48 - "contratos/novo.tsx"
Cohesion: 0.67
Nodes (3): useCreateContract(), NewContract(), Route

### Community 49 - "Decisão e plano: PostgreSQL + Drizzle + JSONB"
Cohesion: 0.09
Nodes (21): 10. Go/no-go para implementação, 1. Conclusão, 2. Decisões de domínio confirmadas, 3. Modelo de domínio e estados, 4. Blueprint relacional inicial, 5. Matriz de invariantes, 6. Fronteiras transacionais, 7. Reaproveitamento do Git (+13 more)

### Community 50 - "@tanstack/react-router"
Cohesion: 0.09
Nodes (46): AttendanceRecordForm(), matchesPatient(), PatientRow(), QueryError(), SchemaForm(), duration(), monthLabel(), shortDate() (+38 more)

### Community 51 - "Especificação: migração para PostgreSQL + Drizzle + JSONB"
Cohesion: 0.13
Nodes (14): API, frontend e operações de produto, Catálogo, planos e snapshots, Dados protegidos, Especificação: migração para PostgreSQL + Drizzle + JSONB, Further Notes, Implementation Decisions, Integridade e concorrência, Máquina de estados (+6 more)

### Community 52 - "api/package.json"
Cohesion: 0.04
Nodes (43): dependencies, asn1js, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, better-auth, @better-auth/drizzle-adapter, @clinicare/db, docxtemplater (+35 more)

### Community 53 - "createFollowup"
Cohesion: 0.10
Nodes (29): cancelFollowup(), cancelFollowupItem(), conflict(), createFollowup(), getFollowup(), hashToken(), idShape(), invalid() (+21 more)

### Community 55 - "Validação de assinatura externa (GOV.BR) sem PAdES próprio"
Cohesion: 0.40
Nodes (4): Resultados, Revalidação em mutações posteriores (Issue #27), Validação de assinatura externa (GOV.BR) sem PAdES próprio, Verificações executadas (todas genuínas, nenhuma presumida)

### Community 56 - "followups.ts"
Cohesion: 0.08
Nodes (59): contract(), form(), headers(), patient(), procedure(), request(), schema, tenantIds (+51 more)

### Community 58 - "issueSignatureToken"
Cohesion: 0.29
Nodes (7): expiry(), hashToken(), issueSignatureToken(), phoneCode(), refreshSignatureToken(), signAsClinicRepresentative(), verifySignaturePhone()

### Community 59 - "api"
Cohesion: 0.12
Nodes (24): Tabs(), TabsContent(), TabsList(), TabsTrigger(), api(), ApiError, RequestOptions, withIds() (+16 more)

### Community 60 - "Issue tracker: GitHub"
Cohesion: 0.29
Nodes (6): Conventions, Issue tracker: GitHub, Pull requests as a triage surface, Wayfinding operations, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 61 - "Domain Docs"
Cohesion: 0.33
Nodes (5): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary

### Community 77 - "SignaturePadField.tsx"
Cohesion: 0.47
Nodes (5): isMobileSignatureDevice(), scalePointGroups(), SignaturePadField, SignaturePadHandle, signature_pad

### Community 78 - "Investigação da validação global T7"
Cohesion: 0.40
Nodes (4): Correções e validação final, Evidências de escopo, Investigação da validação global T7, Resultado inicial

### Community 79 - "react"
Cohesion: 0.09
Nodes (56): AnamnesisPicker(), InheritedAnamneses(), ComboFormPage(), day(), CpfField(), Field(), FormPage(), FormPageProps (+48 more)

### Community 80 - "nova.tsx"
Cohesion: 0.67
Nodes (3): useCreateAnamnesis(), NewAnamnesis(), Route

### Community 82 - "Correção do cancelamento de acompanhamento, anamneses e contratos"
Cohesion: 0.22
Nodes (8): Correção do cancelamento de acompanhamento, anamneses e contratos, Further Notes, Implementation Decisions, Out of Scope, Problem Statement, Solution, Testing Decisions, User Stories

### Community 84 - "request-ip.ts"
Cohesion: 0.43
Nodes (4): forwardedParameter(), headerAddress(), observedClientIp(), validIp()

### Community 85 - "app.ts"
Cohesion: 0.21
Nodes (21): authFailure(), BRAZILIAN_STATES, changeOwnEmail(), changeOwnPassword(), getAccount(), getDefaultSignature(), getProfessionalProfile(), REGISTRATION_TYPES (+13 more)

### Community 86 - "-documentos.test.tsx"
Cohesion: 0.10
Nodes (5): ControlledEditor(), schema, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event

### Community 87 - "createAnamnesisRequest"
Cohesion: 0.12
Nodes (23): answerAppliedAnamnesis(), appliedShape(), byToken(), cancelledError(), createAnamnesisRequest(), createAppliedAnamnesis(), expiry(), followupCancelled() (+15 more)

### Community 88 - "normalizeEvidence"
Cohesion: 0.50
Nodes (3): NormalizedEvidence, normalizeEvidence(), RawFingerprint

### Community 90 - "PageLoadingIndicator.test.tsx"
Cohesion: 0.33
Nodes (4): PageLoadingIndicator(), setup(), Route, FileRoutesById

### Community 91 - "SchemaEditor.tsx"
Cohesion: 0.07
Nodes (62): submit(), canControlVisibility(), conditionOf(), Field, FieldPatch, identifierFor(), newSalt(), Preview() (+54 more)

### Community 92 - "pdf-mutation.ts"
Cohesion: 0.36
Nodes (6): createIncrementalSignaturePdf(), normalizedPlacementToPdfRect(), PdfPlacement, PdfRect, sha256(), validatePlacement()

### Community 93 - "SigningWorkspace"
Cohesion: 0.23
Nodes (11): SignatureHistorySection(), load(), SigningWorkspace(), captureFromPad(), clear(), confirm(), goBackToStep(), goToConfirm() (+3 more)

### Community 96 - "getDatabase"
Cohesion: 0.16
Nodes (20): resetClinicAdministratorPassword(), documentShape(), getAppliedDocument(), listAppliedDocuments(), reconcileReservedCleanupJobs(), releaseReservedCleanupJob(), retryDocumentCleanupJobs(), presignContractDraft() (+12 more)

### Community 97 - "vitest"
Cohesion: 0.22
Nodes (4): planSchema, base, @noble/hashes, vitest

### Community 98 - "composeStampImage"
Cohesion: 0.83
Nodes (3): composeStampImage(), loadImage(), trimTransparent()

### Community 100 - "RepresentativeSignPage"
Cohesion: 0.24
Nodes (16): previewProfessionalSignature(), usePreviewProfessionalSignature(), draftKey(), readDraft(), RepresentativeSignPage(), flag(), handleClear(), handleConfirm() (+8 more)

### Community 102 - "clinical.ts"
Cohesion: 0.05
Nodes (65): claimCleanupJob(), cleanupLease(), CleanupResult, CleanupStatus, clearDraft, deleteAppliedDocument(), documentOwnsCleanupKeys(), heartbeatCleanupJob() (+57 more)

### Community 106 - "collectFingerprint"
Cohesion: 0.32
Nodes (11): CollectedFingerprint, collectFingerprint(), createIdempotencyKey(), GovBrSection(), acceptReturn(), cancelAttempt(), exportRevision(), importReturn() (+3 more)

### Community 114 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

## Knowledge Gaps
- **631 isolated node(s):** `name`, `private`, `type`, `dev`, `dev:debug` (+626 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 802 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **34 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ContractVersion` connect `Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF` to `queries.ts`?**
  _High betweenness centrality (0.277) - this node is a cross-community bridge._
- **Why does `Solution` connect `Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF` to `followups.ts`?**
  _High betweenness centrality (0.272) - this node is a cross-community bridge._
- **Why does `patient()` connect `followups.ts` to `getDatabase`, `Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF`?**
  _High betweenness centrality (0.272) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _631 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `atendimentos.$attendanceId.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11330049261083744 - nodes in this community are weakly interconnected._
- **Should `external-validation.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13257575757575757 - nodes in this community are weakly interconnected._
- **Should `app` be split into smaller, more focused modules?**
  _Cohesion score 0.06954997077732321 - nodes in this community are weakly interconnected._