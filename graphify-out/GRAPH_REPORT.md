# Graph Report - clinicare  (2026-11-23)

## Corpus Check
- 270 files · ~198,850 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 15 file(s) not represented in the graph (top: (none) 7, .css 4, .example 1)

## Summary
- 2135 nodes · 6907 edges · 113 communities (77 shown, 36 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 71 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `883d1add`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- db/src/index.ts
- external-validation.ts
- app.ts
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
- auth.ts
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
- paymentResponse
- -assinatura.$token.test.tsx
- Clínica de cuidados estéticos
- patients.ts
- SignaturePadField.test.tsx
- Button
- api
- createFollowup
- db/tsconfig.json
- Agent skills
- scheduling.ts
- contract-generation.ts
- _app.tsx
- relational-schema.ts
- ContractFormPage.tsx
- Decisão e plano: PostgreSQL + Drizzle + JSONB
- @tanstack/react-router
- Especificação: migração para PostgreSQL + Drizzle + JSONB
- api/package.json
- SchemaEditor.tsx
- Validação de assinatura externa (GOV.BR) sem PAdES próprio
- event-followups.integration.test.ts
- dependencies
- external-validation.test.ts
- Issue tracker: GitHub
- Domain Docs
- Persistência PostgreSQL + Drizzle + JSONB
- triage-labels.md
- Preservação incremental de PDFs com assinaturas externas
- scripts
- Investigação da validação global T7
- cn
- docx-types.d.ts
- Correção do cancelamento de acompanhamento, anamneses e contratos
- DB_SCHEMA.md
- request-ip.ts
- validateExternalReturn
- -documentos.test.tsx
- storage-config.ts
- scripts
- relationship.ts
- PageLoadingIndicator.test.tsx
- format.ts
- headers
- submitPublicAnamnesis
- pdf-mutation.ts
- SignaturePadField.tsx
- composeStampImage
- documentos.$followupContractId.assinar.tsx
- RepresentativeSignPage
- SigningWorkspace
- getDatabase
- request
- collectFingerprint

## God Nodes (most connected - your core abstractions)
1. `getDatabase()` - 168 edges
2. `app` - 130 edges
3. `Button()` - 95 edges
4. `cn()` - 60 edges
5. `react` - 58 edges
6. `@tanstack/react-router` - 55 edges
7. `QueryError()` - 50 edges
8. `useApiMutation()` - 48 edges
9. `api()` - 47 edges
10. `lucide-react` - 46 edges

## Surprising Connections (you probably didn't know these)
- `Solution` --references--> `patient()`  [INFERRED]
  docs/specs/0005-autoria-docx-e-materializacao-de-contratos.md → apps/api/src/anamnesis-links.integration.test.ts
- `2. Cancelamento: anamneses` --references--> `byToken()`  [INFERRED]
  docs/research/acompanhamento-anamneses-cancelamento.md → apps/api/src/clinical.ts
- `Contratos ainda em geração` --references--> `getFollowup()`  [INFERRED]
  docs/research/acompanhamento-anamneses-cancelamento.md → apps/api/src/followups.ts
- `Implementation Decisions` --references--> `Contract`  [INFERRED]
  docs/specs/0005-autoria-docx-e-materializacao-de-contratos.md → apps/web/src/lib/schemas.ts
- `Decisão` --references--> `ContractVersion`  [INFERRED]
  docs/adr/0005-autoria-docx-e-materializacao-de-contratos.md → apps/web/src/lib/schemas.ts

## Import Cycles
- 2-file cycle: `packages/db/src/index.ts -> packages/db/src/migrate.ts -> packages/db/src/index.ts`
- 2-file cycle: `packages/db/src/index.ts -> packages/db/src/seed.ts -> packages/db/src/index.ts`

## Communities (113 total, 36 thin omitted)

### Community 0 - "db/src/index.ts"
Cohesion: 0.12
Nodes (25): fixture(), headers(), post(), request(), AppLike, assertSafeIntegrationDatabase(), integration, integrationCookies (+17 more)

### Community 1 - "external-validation.ts"
Cohesion: 0.12
Nodes (18): bytesEqual(), certEndpoints(), CertView, checkCrl(), checkOcsp(), checkRevocation(), EmbeddedRevalidation, ExpectedSigner (+10 more)

### Community 2 - "app.ts"
Cohesion: 0.05
Nodes (69): BRAZILIAN_STATES, getAccount(), getDefaultSignature(), getProfessionalProfile(), REGISTRATION_TYPES, updateAccount(), updateDefaultSignature(), updateInitialPasswordChoice() (+61 more)

### Community 3 - "assinatura.$token.tsx"
Cohesion: 0.11
Nodes (18): CollectedFingerprint, DRAFT_STORAGE_KEY(), DraggableSignature(), GovBrState, PageGeometry, PhoneGate(), PreviewPdf(), PublicHistoryEvent (+10 more)

### Community 4 - "contract-materialization.ts"
Cohesion: 0.07
Nodes (35): docxMetadata(), getContractDraftEditor(), invalid(), publishContractDraft(), saveContractDraft(), sha256(), uuid(), assertRequiredContext() (+27 more)

### Community 5 - "queries.ts"
Cohesion: 0.04
Nodes (98): allowed, AttendancePhotos(), Phase, phases, ContractGenerateButton(), ContractSignatureHistory(), copySignatureLink(), FollowupCard() (+90 more)

### Community 6 - "followups.ts"
Cohesion: 0.11
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

### Community 11 - "clinical.ts"
Cohesion: 0.09
Nodes (39): request(), CleanupResult, CleanupStatus, clearDraft, deleteAppliedDocument(), placement, request(), placement (+31 more)

### Community 12 - "Assinatura eletrônica própria — especificação completa"
Cohesion: 0.09
Nodes (22): 10. Selo da plataforma e gestão de chaves, 11. Pacote exportável e verificação independente, 12. Recuperação, revogação e tempo, 13. Limites de confiança, 14. Critérios de aceitação, 1. Objetivo e decisões de produto, 2. O que o sistema pretende demonstrar, 3.1. Fingerprint obrigatório desde o MVP (+14 more)

### Community 13 - "Assinatura eletrônica própria — MVP"
Cohesion: 0.09
Nodes (22): 10. Histórico, armazenamento e download, 11. Estrutura preparada para evolução, 12. O que fica fora deste MVP, 13. Critérios para considerar o MVP pronto, 14. Limite da evolução futura, 1. Objetivo, 2. Fluxo oficial, também mantido na produção, 3.1. Fingerprint obrigatório desde o MVP (+14 more)

### Community 14 - "web/package.json"
Cohesion: 0.08
Nodes (25): typescript, name, private, type, CalendarEntry, class-variance-authority, clsx, date-fns (+17 more)

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
Cohesion: 0.09
Nodes (23): Route, Route, Route, Route, Route, Route, Route, Route (+15 more)

### Community 21 - "auth.ts"
Cohesion: 0.28
Nodes (5): AuthInstance, getTrustedOrigins(), SESSION_DURATION_SECONDS, better-auth, @better-auth/drizzle-adapter

### Community 22 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+8 more)

### Community 23 - "admin-commands.ts"
Cohesion: 0.10
Nodes (29): administratorByEmail(), BOOTSTRAP_ENV_KEYS, bootstrapConfigFromEnv(), changeClinicAdministratorEmail(), CreateAdministratorInput, createBetterAuthClinicAdministrator(), createClinicAdministrator(), createTenant() (+21 more)

### Community 24 - "PreviewPdf.tsx"
Cohesion: 0.33
Nodes (4): DraggableSignature(), PreviewPdf(), PreviewPlacement, pdfjs-dist

### Community 25 - "Implementation Decisions"
Cohesion: 0.09
Nodes (22): Assinatura local, Concorrência, idempotência e storage, Especificação — Assinatura eletrônica própria no MVP, Estados e conclusão, Fingerprint e evidências, Fonte, PDF e revisões, Further Notes, GOV.BR e assinaturas externas (+14 more)

### Community 26 - "dialogs.tsx"
Cohesion: 0.08
Nodes (39): AppointmentDialog(), localDate(), localTime(), minutesBetween(), NewFollowupDialog(), OfferFields(), PaymentDialog(), PlannedItem (+31 more)

### Community 27 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, jsdom, @tanstack/router-plugin, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, @types/node, @types/react (+3 more)

### Community 29 - "signatures.ts"
Cohesion: 0.08
Nodes (71): loadTrustedRootFiles(), loadTrustedRootsFromEnv(), NormalizedEvidence, normalizeEvidence(), RawFingerprint, cancelExternalAttempt(), cancelExternalAttemptAsClinicRepresentative(), canonicalJson() (+63 more)

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

### Community 34 - "paymentResponse"
Cohesion: 0.24
Nodes (10): conflict(), createPayment(), deletePayment(), invalid(), listPayments(), notFound(), paymentResponse(), protectedNotes() (+2 more)

### Community 35 - "-assinatura.$token.test.tsx"
Cohesion: 0.11
Nodes (11): renderAt(), queryClient, router, createAppRouter(), createQueryClient(), Register, @tanstack/react-router, renderPage() (+3 more)

### Community 36 - "Clínica de cuidados estéticos"
Cohesion: 0.20
Nodes (9): Attendance, Atendimento estético, Clínica de cuidados estéticos, Dados e ciclo de protótipo, Documentos e coleta, Jornada do paciente, Objetivo do produto, Organização da clínica (+1 more)

### Community 37 - "patients.ts"
Cohesion: 0.08
Nodes (34): publicShape(), unprotect(), createPatient(), deactivatePatient(), DEFAULT_TENANT_ID, encrypted(), encryptedColumns(), ensureTenant() (+26 more)

### Community 38 - "SignaturePadField.test.tsx"
Cohesion: 0.11
Nodes (4): originalExitFullscreenDescriptor, originalFullscreenElementDescriptor, originalRequestFullscreenDescriptor, ResizeCallback

### Community 39 - "Button"
Cohesion: 0.11
Nodes (45): AnamnesisFormPage(), emptySchema, PatientPreview(), Props, AppointmentDetails(), dateLong, Props, Row() (+37 more)

### Community 40 - "api"
Cohesion: 0.13
Nodes (23): Tabs(), TabsContent(), TabsList(), TabsTrigger(), api(), RequestOptions, withIds(), accountQuery (+15 more)

### Community 41 - "createFollowup"
Cohesion: 0.10
Nodes (29): cancelFollowup(), cancelFollowupItem(), conflict(), createFollowup(), getFollowup(), hashToken(), idShape(), invalid() (+21 more)

### Community 42 - "db/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, types, extends, include, ../../tsconfig.json

### Community 43 - "Agent skills"
Cohesion: 0.29
Nodes (6): Agent skills, Domain docs, graphify, Issue tracker, This is NOT the Turborepo you know, Triage labels

### Community 44 - "scheduling.ts"
Cohesion: 0.14
Nodes (40): civilDateOf(), clinicTimeZone(), activeAppointmentStatuses, addAttendancePhoto(), appointmentResponse(), assertAtomicCombos(), assertEventDay(), attendanceResponse() (+32 more)

### Community 45 - "contract-generation.ts"
Cohesion: 0.10
Nodes (27): patient(), propagatePublishedVersion(), contractedNames(), protectedFollowupValue(), replaceUnsignedAppliedContract(), encryptMaterializationContext(), Call, api() (+19 more)

### Community 46 - "_app.tsx"
Cohesion: 0.22
Nodes (16): Sheet(), SheetClose(), SheetContent(), SheetDescription(), SheetHeader(), SheetOverlay(), SheetTitle(), SheetTrigger() (+8 more)

### Community 47 - "relational-schema.ts"
Cohesion: 0.06
Nodes (34): catalogTimestamps, contractVersionPdfUploadIntents, NewRelationalPatient, NewRelationalProcedure, NewTenant, paymentRelations, RelationalAnamnesis, RelationalAnamnesisVersion (+26 more)

### Community 48 - "ContractFormPage.tsx"
Cohesion: 0.14
Nodes (19): contextDescription(), contextLabel(), CONTEXTS, ContractDraftPanel(), ContractFormPage(), ContractMetadata, Props, contractsQuery (+11 more)

### Community 49 - "Decisão e plano: PostgreSQL + Drizzle + JSONB"
Cohesion: 0.09
Nodes (21): 10. Go/no-go para implementação, 1. Conclusão, 2. Decisões de domínio confirmadas, 3. Modelo de domínio e estados, 4. Blueprint relacional inicial, 5. Matriz de invariantes, 6. Fronteiras transacionais, 7. Reaproveitamento do Git (+13 more)

### Community 50 - "@tanstack/react-router"
Cohesion: 0.07
Nodes (60): AttendanceRecordForm(), ContractReprocessButton(), ContractSummary(), Entry, pendingBadge(), matchesPatient(), PatientRow(), Body() (+52 more)

### Community 51 - "Especificação: migração para PostgreSQL + Drizzle + JSONB"
Cohesion: 0.13
Nodes (14): API, frontend e operações de produto, Catálogo, planos e snapshots, Dados protegidos, Especificação: migração para PostgreSQL + Drizzle + JSONB, Further Notes, Implementation Decisions, Integridade e concorrência, Máquina de estados (+6 more)

### Community 52 - "api/package.json"
Cohesion: 0.12
Nodes (16): devDependencies, @types/bun, typescript, drizzle-orm, @types/bun, typescript, name, private (+8 more)

### Community 53 - "SchemaEditor.tsx"
Cohesion: 0.07
Nodes (63): submit(), canControlVisibility(), conditionOf(), Field, FieldPatch, identifierFor(), newSalt(), Preview() (+55 more)

### Community 55 - "Validação de assinatura externa (GOV.BR) sem PAdES próprio"
Cohesion: 0.40
Nodes (4): Resultados, Revalidação em mutações posteriores (Issue #27), Validação de assinatura externa (GOV.BR) sem PAdES próprio, Verificações executadas (todas genuínas, nenhuma presumida)

### Community 56 - "event-followups.integration.test.ts"
Cohesion: 0.14
Nodes (28): schema, schema, api(), call(), clinicDate(), fixture(), schema, cleanupIntegrationClinics() (+20 more)

### Community 58 - "dependencies"
Cohesion: 0.14
Nodes (14): dependencies, asn1js, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, better-auth, @better-auth/drizzle-adapter, @clinicare/db, docxtemplater (+6 more)

### Community 59 - "external-validation.test.ts"
Cohesion: 0.23
Nodes (12): buildSignedReturnPdf(), buildUnparsableCmsReturn(), createTestCa(), ensureOpensslAvailable(), issueDatedTestSigner(), issueTestSigner(), num10(), parseBaseTrailer() (+4 more)

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

### Community 79 - "cn"
Cohesion: 0.09
Nodes (63): AnamnesisPicker(), InheritedAnamneses(), ComboFormPage(), day(), ProcedurePicker(), CpfField(), AppointmentFields(), EditPatientDialog() (+55 more)

### Community 82 - "Correção do cancelamento de acompanhamento, anamneses e contratos"
Cohesion: 0.22
Nodes (8): Correção do cancelamento de acompanhamento, anamneses e contratos, Further Notes, Implementation Decisions, Out of Scope, Problem Statement, Solution, Testing Decisions, User Stories

### Community 84 - "request-ip.ts"
Cohesion: 0.36
Nodes (5): observedClientIp(), forwardedParameter(), headerAddress(), observedClientIp(), validIp()

### Community 85 - "validateExternalReturn"
Cohesion: 0.35
Nodes (13): blankReport(), cmsMessageDigest(), exactBytes(), latin1(), parseTrustedRoots(), rangeContent(), resolveSignaturePairs(), revalidateEmbeddedSignatures() (+5 more)

### Community 86 - "-documentos.test.tsx"
Cohesion: 0.12
Nodes (10): Handler, marina, ControlledEditor(), schema, combo(), base, @testing-library/jest-dom, @testing-library/react (+2 more)

### Community 88 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 90 - "PageLoadingIndicator.test.tsx"
Cohesion: 0.33
Nodes (4): PageLoadingIndicator(), setup(), Route, FileRoutesById

### Community 91 - "format.ts"
Cohesion: 0.14
Nodes (20): CalendarView(), tones, appointmentStatus, duration(), monthLabel(), offerKinds, shortDate(), statusLabel() (+12 more)

### Community 93 - "submitPublicAnamnesis"
Cohesion: 0.27
Nodes (11): answerAppliedAnamnesis(), byToken(), followupCancelled(), hashToken(), jsonValue(), protect(), readPublicAnamnesis(), saveAnamnesisDraft() (+3 more)

### Community 96 - "pdf-mutation.ts"
Cohesion: 0.36
Nodes (6): createIncrementalSignaturePdf(), normalizedPlacementToPdfRect(), PdfPlacement, PdfRect, sha256(), validatePlacement()

### Community 97 - "SignaturePadField.tsx"
Cohesion: 0.39
Nodes (7): isMobileSignatureDevice(), lockLandscape(), scalePointGroups(), SignaturePadField, SignaturePadHandle, unlockLandscape(), signature_pad

### Community 98 - "composeStampImage"
Cohesion: 0.83
Nodes (3): composeStampImage(), loadImage(), trimTransparent()

### Community 99 - "documentos.$followupContractId.assinar.tsx"
Cohesion: 0.13
Nodes (14): PageGeometry, renderAllPages(), usePdfDocument(), ChecklistItem, SignChecklist(), SigningSteps(), StampPreview(), fetchProfessionalPdf() (+6 more)

### Community 100 - "RepresentativeSignPage"
Cohesion: 0.24
Nodes (16): previewProfessionalSignature(), usePreviewProfessionalSignature(), draftKey(), readDraft(), RepresentativeSignPage(), flag(), handleClear(), handleConfirm() (+8 more)

### Community 101 - "SigningWorkspace"
Cohesion: 0.23
Nodes (11): SignatureHistorySection(), load(), SigningWorkspace(), captureFromPad(), clear(), confirm(), goBackToStep(), goToConfirm() (+3 more)

### Community 102 - "getDatabase"
Cohesion: 0.08
Nodes (45): addAnamnesisVersion(), anamnesisResponse(), conflict(), createAnamnesis(), createProcedure(), listAnamneses(), listProcedures(), lockAnamnesis() (+37 more)

### Community 103 - "request"
Cohesion: 0.67
Nodes (3): fixtures(), headers(), request()

### Community 106 - "collectFingerprint"
Cohesion: 0.38
Nodes (9): collectFingerprint(), createIdempotencyKey(), GovBrSection(), acceptReturn(), cancelAttempt(), exportRevision(), importReturn(), postJson() (+1 more)

## Knowledge Gaps
- **628 isolated node(s):** `name`, `private`, `type`, `dev`, `dev:debug` (+623 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 792 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **36 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ContractVersion` connect `Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF` to `queries.ts`?**
  _High betweenness centrality (0.282) - this node is a cross-community bridge._
- **Why does `Solution` connect `Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF` to `contract-generation.ts`?**
  _High betweenness centrality (0.277) - this node is a cross-community bridge._
- **Why does `patient()` connect `contract-generation.ts` to `getDatabase`, `followups.ts`, `Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF`?**
  _High betweenness centrality (0.277) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _628 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `db/src/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12179487179487179 - nodes in this community are weakly interconnected._
- **Should `external-validation.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12105263157894737 - nodes in this community are weakly interconnected._
- **Should `app.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0539906103286385 - nodes in this community are weakly interconnected._