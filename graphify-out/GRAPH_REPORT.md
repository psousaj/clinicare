# Graph Report - clinicare  (2026-11-23)

## Corpus Check
- 271 files · ~199,384 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 15 file(s) not represented in the graph (top: (none) 7, .css 4, .example 1)

## Summary
- 2138 nodes · 6934 edges · 118 communities (82 shown, 36 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 71 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `73874f9e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- db/src/index.ts
- external-validation.ts
- app
- assinatura.$token.tsx
- contract-materialization.ts
- queries.ts
- followups.ts
- routeTree.gen.ts
- scripts
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
- app.ts
- compilerOptions
- admin-commands.ts
- PreviewPdf.tsx
- Implementation Decisions
- dialogs.tsx
- devDependencies
- signatures.ts
- compilerOptions
- Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF
- api/tsconfig.json
- Clínicare
- payments.ts
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
- contract-authoring.ts
- _app.tsx
- relational-schema.ts
- api
- Decisão e plano: PostgreSQL + Drizzle + JSONB
- @tanstack/react-router
- Especificação: migração para PostgreSQL + Drizzle + JSONB
- api/package.json
- schemaUi.tsx
- Validação de assinatura externa (GOV.BR) sem PAdES próprio
- event-followups.integration.test.ts
- dependencies
- configuracoes.tsx
- Issue tracker: GitHub
- Domain Docs
- Persistência PostgreSQL + Drizzle + JSONB
- triage-labels.md
- Preservação incremental de PDFs com assinaturas externas
- scripts
- Investigação da validação global T7
- react
- nova.tsx
- docx-types.d.ts
- Correção do cancelamento de acompanhamento, anamneses e contratos
- DB_SCHEMA.md
- request-ip.ts
- contratos/novo.tsx
- -documentos.test.tsx
- encryptValue
- external-validation.test.ts
- getRelationalRelationship
- PageLoadingIndicator.test.tsx
- SchemaEditor.tsx
- headers
- SigningWorkspace
- pdf-mutation.ts
- decryptValue
- atendimentos.$attendanceId.tsx
- StatusBadge
- RepresentativeSignPage
- saveContract
- getDatabase
- SignaturePadField.tsx
- collectFingerprint
- vitest
- scripts
- storage-config.ts
- generate-secrets.ts
- request

## God Nodes (most connected - your core abstractions)
1. `getDatabase()` - 169 edges
2. `app` - 131 edges
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
- `2. Cancelamento: anamneses` --references--> `byToken()`  [INFERRED]
  docs/research/acompanhamento-anamneses-cancelamento.md → apps/api/src/clinical.ts
- `2. Cancelamento: anamneses` --references--> `getFollowup()`  [INFERRED]
  docs/research/acompanhamento-anamneses-cancelamento.md → apps/api/src/followups.ts
- `Implementation Decisions` --references--> `Contract`  [INFERRED]
  docs/specs/0005-autoria-docx-e-materializacao-de-contratos.md → apps/web/src/lib/schemas.ts
- `Decisão` --references--> `ContractVersion`  [INFERRED]
  docs/adr/0005-autoria-docx-e-materializacao-de-contratos.md → apps/web/src/lib/schemas.ts

## Import Cycles
- 2-file cycle: `packages/db/src/index.ts -> packages/db/src/migrate.ts -> packages/db/src/index.ts`
- 2-file cycle: `packages/db/src/index.ts -> packages/db/src/seed.ts -> packages/db/src/index.ts`

## Communities (118 total, 36 thin omitted)

### Community 0 - "db/src/index.ts"
Cohesion: 0.12
Nodes (28): provisionClinic(), fixture(), headers(), post(), request(), AppLike, assertSafeIntegrationDatabase(), cleanupIntegrationClinics() (+20 more)

### Community 1 - "external-validation.ts"
Cohesion: 0.13
Nodes (31): blankReport(), bytesEqual(), certEndpoints(), CertView, checkCrl(), checkOcsp(), checkRevocation(), cmsMessageDigest() (+23 more)

### Community 2 - "app"
Cohesion: 0.06
Nodes (48): app, expiry(), fail(), handleError(), isRecord(), addAnamnesisVersion(), anamnesisResponse(), checkAnamnesisIds() (+40 more)

### Community 3 - "assinatura.$token.tsx"
Cohesion: 0.11
Nodes (18): CollectedFingerprint, DRAFT_STORAGE_KEY(), DraggableSignature(), GovBrState, PageGeometry, PhoneGate(), PreviewPdf(), PublicHistoryEvent (+10 more)

### Community 4 - "contract-materialization.ts"
Cohesion: 0.16
Nodes (21): assertRequiredContext(), ContextConfiguration, CONTRACT_CONTEXT_INCOMPLETE, defaultContextConfiguration(), DOCX_CONTENT_TYPE, extractTags(), hasValue(), inspectDocxPlaceholders() (+13 more)

### Community 5 - "queries.ts"
Cohesion: 0.04
Nodes (66): allowed, AttendancePhotos(), Phase, phases, photoPhases, attendancesQuery, everything, MutationConfig (+58 more)

### Community 6 - "followups.ts"
Cohesion: 0.11
Nodes (33): contract(), form(), headers(), procedure(), request(), schema, tenantIds, schema (+25 more)

### Community 7 - "routeTree.gen.ts"
Cohesion: 0.04
Nodes (45): AppAgendaRoute, AppConfiguracoesRoute, AppContratosContractIdRoute, AppContratosIndexRoute, AppContratosNovoRoute, AppDocumentosFollowupContractIdAssinarRoute, AppDocumentosRoute, AppDocumentosRouteChildren (+37 more)

### Community 8 - "scripts"
Cohesion: 0.05
Nodes (38): devDependencies, turbo, engines, node, name, packageManager, private, scripts (+30 more)

### Community 10 - "dependencies"
Cohesion: 0.06
Nodes (32): dependencies, class-variance-authority, clsx, date-fns, @fingerprintjs/fingerprintjs, @fullcalendar/core, @fullcalendar/interaction, @fullcalendar/react (+24 more)

### Community 11 - "clinical.ts"
Cohesion: 0.08
Nodes (46): request(), CleanupResult, CleanupStatus, clearDraft, deleteAppliedDocument(), placement, request(), placement (+38 more)

### Community 12 - "Assinatura eletrônica própria — especificação completa"
Cohesion: 0.09
Nodes (22): 10. Selo da plataforma e gestão de chaves, 11. Pacote exportável e verificação independente, 12. Recuperação, revogação e tempo, 13. Limites de confiança, 14. Critérios de aceitação, 1. Objetivo e decisões de produto, 2. O que o sistema pretende demonstrar, 3.1. Fingerprint obrigatório desde o MVP (+14 more)

### Community 13 - "Assinatura eletrônica própria — MVP"
Cohesion: 0.09
Nodes (22): 10. Histórico, armazenamento e download, 11. Estrutura preparada para evolução, 12. O que fica fora deste MVP, 13. Critérios para considerar o MVP pronto, 14. Limite da evolução futura, 1. Objetivo, 2. Fluxo oficial, também mantido na produção, 3.1. Fingerprint obrigatório desde o MVP (+14 more)

### Community 14 - "web/package.json"
Cohesion: 0.07
Nodes (27): typescript, name, private, type, CalendarEntry, Tone, class-variance-authority, clsx (+19 more)

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
Cohesion: 0.14
Nodes (14): Route, Route, Route, Route, Route, Route, Route, Route (+6 more)

### Community 21 - "app.ts"
Cohesion: 0.13
Nodes (24): BRAZILIAN_STATES, getAccount(), getDefaultSignature(), getProfessionalProfile(), REGISTRATION_TYPES, updateAccount(), updateDefaultSignature(), updateInitialPasswordChoice() (+16 more)

### Community 22 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+8 more)

### Community 23 - "admin-commands.ts"
Cohesion: 0.07
Nodes (30): administratorByEmail(), BOOTSTRAP_ENV_KEYS, bootstrapConfigFromEnv(), changeClinicAdministratorEmail(), CreateAdministratorInput, createBetterAuthClinicAdministrator(), createClinicAdministrator(), createTenant() (+22 more)

### Community 24 - "PreviewPdf.tsx"
Cohesion: 0.33
Nodes (4): DraggableSignature(), PreviewPdf(), PreviewPlacement, pdfjs-dist

### Community 25 - "Implementation Decisions"
Cohesion: 0.09
Nodes (22): Assinatura local, Concorrência, idempotência e storage, Especificação — Assinatura eletrônica própria no MVP, Estados e conclusão, Fingerprint e evidências, Fonte, PDF e revisões, Further Notes, GOV.BR e assinaturas externas (+14 more)

### Community 26 - "dialogs.tsx"
Cohesion: 0.09
Nodes (44): CalendarView(), ProcedurePicker(), AppointmentDialog(), AppointmentFields(), localDate(), localTime(), minutesBetween(), NewFollowupDialog() (+36 more)

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
Cohesion: 0.12
Nodes (16): patient(), ContractVersion, 0005. Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos, Consequências, Contexto, Decisão, Emenda — 2026-10-07 (Issue #32: LibreOffice headless sob demanda, ONLYOFFICE aposentado), Emenda — 2026-10-07 (propagação da versão publicada a contratos aplicados sem assinatura) (+8 more)

### Community 32 - "api/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, allowImportingTsExtensions, types, extends, include, ../../tsconfig.json

### Community 33 - "Clínicare"
Cohesion: 0.29
Nodes (6): Clínicare, Desenvolvimento sem Docker, Estrutura do monorepo, Rodar localmente via Docker (caminho recomendado), Stack, Verificações

### Community 34 - "payments.ts"
Cohesion: 0.26
Nodes (13): conflict(), createPayment(), deletePayment(), invalid(), listPayments(), notFound(), PaymentInput, paymentResponse() (+5 more)

### Community 35 - "-assinatura.$token.test.tsx"
Cohesion: 0.10
Nodes (14): Handler, marina, renderAt(), combo(), queryClient, router, createAppRouter(), createQueryClient() (+6 more)

### Community 36 - "Clínica de cuidados estéticos"
Cohesion: 0.20
Nodes (9): Attendance, Atendimento estético, Clínica de cuidados estéticos, Dados e ciclo de protótipo, Documentos e coleta, Jornada do paciente, Objetivo do produto, Organização da clínica (+1 more)

### Community 37 - "patients.ts"
Cohesion: 0.13
Nodes (20): createPatient(), deactivatePatient(), DEFAULT_TENANT_ID, encryptedColumns(), ensureTenant(), getPatient(), isUuid(), listPatients() (+12 more)

### Community 38 - "SignaturePadField.test.tsx"
Cohesion: 0.11
Nodes (4): originalExitFullscreenDescriptor, originalFullscreenElementDescriptor, originalRequestFullscreenDescriptor, ResizeCallback

### Community 39 - "Button"
Cohesion: 0.10
Nodes (50): AnamnesisFormPage(), emptySchema, PatientPreview(), Props, AppointmentDetails(), dateLong, Props, Row() (+42 more)

### Community 40 - "documentos.$followupContractId.assinar.tsx"
Cohesion: 0.12
Nodes (16): PageGeometry, renderAllPages(), usePdfDocument(), ChecklistItem, SignChecklist(), SigningSteps(), StampPreview(), fetchProfessionalPdf() (+8 more)

### Community 41 - "createFollowup"
Cohesion: 0.11
Nodes (24): createFollowup(), hashToken(), idShape(), invalid(), issueInitialTokens(), latest(), notFound(), offerForms() (+16 more)

### Community 42 - "db/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, types, extends, include, ../../tsconfig.json

### Community 43 - "Agent skills"
Cohesion: 0.29
Nodes (6): Agent skills, Domain docs, graphify, Issue tracker, This is NOT the Turborepo you know, Triage labels

### Community 44 - "scheduling.ts"
Cohesion: 0.14
Nodes (39): civilDateOf(), clinicTimeZone(), activeAppointmentStatuses, addAttendancePhoto(), appointmentResponse(), assertAtomicCombos(), assertEventDay(), attendanceResponse() (+31 more)

### Community 45 - "contract-authoring.ts"
Cohesion: 0.19
Nodes (20): docxMetadata(), getContractDraftEditor(), invalid(), listContractPlaceholders(), publishContractDraft(), saveContractDraft(), sha256(), uuid() (+12 more)

### Community 46 - "_app.tsx"
Cohesion: 0.18
Nodes (18): Sheet(), SheetClose(), SheetContent(), SheetDescription(), SheetHeader(), SheetOverlay(), SheetTitle(), SheetTrigger() (+10 more)

### Community 47 - "relational-schema.ts"
Cohesion: 0.06
Nodes (34): catalogTimestamps, contractVersionPdfUploadIntents, NewRelationalPatient, NewRelationalProcedure, NewTenant, paymentRelations, RelationalAnamnesis, RelationalAnamnesisVersion (+26 more)

### Community 48 - "api"
Cohesion: 0.09
Nodes (34): contextDescription(), contextLabel(), CONTEXTS, ContractDraftPanel(), ContractFormPage(), ContractMetadata, Props, StandaloneAttendanceDialog() (+26 more)

### Community 49 - "Decisão e plano: PostgreSQL + Drizzle + JSONB"
Cohesion: 0.09
Nodes (21): 10. Go/no-go para implementação, 1. Conclusão, 2. Decisões de domínio confirmadas, 3. Modelo de domínio e estados, 4. Blueprint relacional inicial, 5. Matriz de invariantes, 6. Fronteiras transacionais, 7. Reaproveitamento do Git (+13 more)

### Community 50 - "@tanstack/react-router"
Cohesion: 0.07
Nodes (58): AttendanceRecordForm(), PaymentDialog(), matchesPatient(), PatientRow(), QueryError(), Props, SchemaForm(), appointmentStatus (+50 more)

### Community 51 - "Especificação: migração para PostgreSQL + Drizzle + JSONB"
Cohesion: 0.13
Nodes (14): API, frontend e operações de produto, Catálogo, planos e snapshots, Dados protegidos, Especificação: migração para PostgreSQL + Drizzle + JSONB, Further Notes, Implementation Decisions, Integridade e concorrência, Máquina de estados (+6 more)

### Community 52 - "api/package.json"
Cohesion: 0.12
Nodes (16): devDependencies, @types/bun, typescript, drizzle-orm, @types/bun, typescript, name, private (+8 more)

### Community 53 - "schemaUi.tsx"
Cohesion: 0.14
Nodes (26): answersForSchema(), answersForWidgets(), answersFromWidgets(), ConditionalSchema, conditionOf(), schemaForAnswers(), schemaForWidgets(), SchemaProperty (+18 more)

### Community 55 - "Validação de assinatura externa (GOV.BR) sem PAdES próprio"
Cohesion: 0.40
Nodes (4): Resultados, Revalidação em mutações posteriores (Issue #27), Validação de assinatura externa (GOV.BR) sem PAdES próprio, Verificações executadas (todas genuínas, nenhuma presumida)

### Community 56 - "event-followups.integration.test.ts"
Cohesion: 0.12
Nodes (34): contractedNames(), api(), clinicDate(), enrolled(), schema, api(), enrolled(), schema (+26 more)

### Community 58 - "dependencies"
Cohesion: 0.14
Nodes (14): dependencies, asn1js, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, better-auth, @better-auth/drizzle-adapter, @clinicare/db, docxtemplater (+6 more)

### Community 59 - "configuracoes.tsx"
Cohesion: 0.18
Nodes (16): SignaturePadHandle, Tabs(), TabsContent(), TabsList(), TabsTrigger(), defaultSignatureQuery, sessionQuery, useSaveDefaultSignature() (+8 more)

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
Cohesion: 0.08
Nodes (59): AnamnesisPicker(), InheritedAnamneses(), ComboFormPage(), day(), CpfField(), Field(), FormPage(), FormPageProps (+51 more)

### Community 80 - "nova.tsx"
Cohesion: 0.67
Nodes (3): useCreateAnamnesis(), NewAnamnesis(), Route

### Community 82 - "Correção do cancelamento de acompanhamento, anamneses e contratos"
Cohesion: 0.22
Nodes (8): Correção do cancelamento de acompanhamento, anamneses e contratos, Further Notes, Implementation Decisions, Out of Scope, Problem Statement, Solution, Testing Decisions, User Stories

### Community 84 - "request-ip.ts"
Cohesion: 0.36
Nodes (5): observedClientIp(), forwardedParameter(), headerAddress(), observedClientIp(), validIp()

### Community 85 - "contratos/novo.tsx"
Cohesion: 0.67
Nodes (3): useCreateContract(), NewContract(), Route

### Community 86 - "-documentos.test.tsx"
Cohesion: 0.10
Nodes (5): ControlledEditor(), schema, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event

### Community 87 - "encryptValue"
Cohesion: 0.19
Nodes (13): addAnamnesisNote(), jsonValue(), listAnamnesisNotes(), noteValue(), protect(), propagatePublishedVersion(), protectedFollowupValue(), replaceUnsignedAppliedContract() (+5 more)

### Community 88 - "external-validation.test.ts"
Cohesion: 0.23
Nodes (12): buildSignedReturnPdf(), buildUnparsableCmsReturn(), createTestCa(), ensureOpensslAvailable(), issueDatedTestSigner(), issueTestSigner(), num10(), parseBaseTrailer() (+4 more)

### Community 89 - "getRelationalRelationship"
Cohesion: 0.40
Nodes (4): getRelationalRelationship(), response(), buildRelationship(), monthKey()

### Community 90 - "PageLoadingIndicator.test.tsx"
Cohesion: 0.33
Nodes (4): PageLoadingIndicator(), setup(), Route, FileRoutesById

### Community 91 - "SchemaEditor.tsx"
Cohesion: 0.11
Nodes (34): submit(), canControlVisibility(), conditionOf(), Field, FieldPatch, identifierFor(), newSalt(), Preview() (+26 more)

### Community 93 - "SigningWorkspace"
Cohesion: 0.23
Nodes (11): SignatureHistorySection(), load(), SigningWorkspace(), captureFromPad(), clear(), confirm(), goBackToStep(), goToConfirm() (+3 more)

### Community 96 - "pdf-mutation.ts"
Cohesion: 0.36
Nodes (6): createIncrementalSignaturePdf(), normalizedPlacementToPdfRect(), PdfPlacement, PdfRect, sha256(), validatePlacement()

### Community 97 - "decryptValue"
Cohesion: 0.24
Nodes (9): decryptMaterializationContext(), encrypted(), configuredKey(), decryptValue(), EncryptedValue, ENCRYPTION_KEY_VERSION, KeyKind, SEARCH_HMAC_KEY_VERSION (+1 more)

### Community 98 - "atendimentos.$attendanceId.tsx"
Cohesion: 0.33
Nodes (8): EditPatientDialog(), Textarea(), attendanceQuery(), useUpdateAttendance(), useUpdatePatient(), Patient, AttendanceFollowUp(), Record()

### Community 99 - "StatusBadge"
Cohesion: 0.11
Nodes (31): ContractGenerateButton(), ContractReprocessButton(), ContractSignatureHistory(), copySignatureLink(), ContractSummary(), Entry, pendingBadge(), Body() (+23 more)

### Community 100 - "RepresentativeSignPage"
Cohesion: 0.19
Nodes (19): confirmProfessionalSignature(), postParticipantPdf(), previewProfessionalSignature(), useConfirmProfessionalSignature(), usePreviewProfessionalSignature(), draftKey(), readDraft(), RepresentativeSignPage() (+11 more)

### Community 101 - "saveContract"
Cohesion: 0.22
Nodes (10): addContractVersion(), consumeContractVersionPdfUploadIntent(), contractResponse(), finalizeContractVersionPdf(), legacyContractGone(), listContracts(), lockContract(), saveContract() (+2 more)

### Community 102 - "getDatabase"
Cohesion: 0.09
Nodes (43): catalogTenant(), answerAppliedAnamnesis(), appliedShape(), byToken(), cancelledError(), claimCleanupJob(), cleanupLease(), createAnamnesisRequest() (+35 more)

### Community 103 - "SignaturePadField.tsx"
Cohesion: 0.48
Nodes (6): isMobileSignatureDevice(), lockLandscape(), scalePointGroups(), SignaturePadField, unlockLandscape(), signature_pad

### Community 106 - "collectFingerprint"
Cohesion: 0.38
Nodes (9): collectFingerprint(), createIdempotencyKey(), GovBrSection(), acceptReturn(), cancelAttempt(), exportRevision(), importReturn(), postJson() (+1 more)

### Community 113 - "vitest"
Cohesion: 0.33
Nodes (4): base, sha256Hex(), @noble/hashes, vitest

### Community 114 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

## Knowledge Gaps
- **628 isolated node(s):** `name`, `private`, `type`, `dev`, `dev:debug` (+623 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 794 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **36 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ContractVersion` connect `Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF` to `queries.ts`?**
  _High betweenness centrality (0.283) - this node is a cross-community bridge._
- **Why does `patient()` connect `Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF` to `event-followups.integration.test.ts`, `getDatabase`, `followups.ts`, `encryptValue`?**
  _High betweenness centrality (0.278) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _628 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `db/src/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12056737588652482 - nodes in this community are weakly interconnected._
- **Should `external-validation.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13257575757575757 - nodes in this community are weakly interconnected._
- **Should `app` be split into smaller, more focused modules?**
  _Cohesion score 0.05612244897959184 - nodes in this community are weakly interconnected._
- **Should `assinatura.$token.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11255411255411256 - nodes in this community are weakly interconnected._