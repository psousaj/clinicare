# Graph Report - clinicare  (2026-11-24)

## Corpus Check
- 273 files · ~202,284 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 15 file(s) not represented in the graph (top: (none) 7, .css 4, .example 1)

## Summary
- 2150 nodes · 7035 edges · 113 communities (78 shown, 35 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 73 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3e36a6dd`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- db/src/index.ts
- external-validation.ts
- catalog.ts
- assinatura.$token.tsx
- contract-materialization.ts
- queries.ts
- anamnesis-links.integration.test.ts
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
- manage.ts
- PreviewPdf.tsx
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
- documentos.$followupContractId.assinar.tsx
- contract-generation.ts
- db/tsconfig.json
- Agent skills
- scheduling.ts
- format.ts
- _app.tsx
- relational-schema.ts
- contratos/novo.tsx
- Decisão e plano: PostgreSQL + Drizzle + JSONB
- @tanstack/react-router
- Especificação: migração para PostgreSQL + Drizzle + JSONB
- api/package.json
- docx-pdf.ts
- Validação de assinatura externa (GOV.BR) sem PAdES próprio
- followups.ts
- dependencies
- api
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
- getDatabase
- -documentos.test.tsx
- encryptValue
- getRelationalRelationship
- PageLoadingIndicator.test.tsx
- SchemaEditor.tsx
- contract-authoring.ts
- SigningWorkspace
- pdf-mutation.ts
- validateExternalReturn
- auth.ts
- $patientId/index.tsx
- RepresentativeSignPage
- clinical.ts
- vitest
- scripts
- storage.ts

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
- `2. Cancelamento: anamneses` --references--> `getFollowup()`  [INFERRED]
  docs/research/acompanhamento-anamneses-cancelamento.md → apps/api/src/followups.ts
- `Implementation Decisions` --references--> `Contract`  [INFERRED]
  docs/specs/0005-autoria-docx-e-materializacao-de-contratos.md → apps/web/src/lib/schemas.ts

## Import Cycles
- 2-file cycle: `packages/db/src/index.ts -> packages/db/src/migrate.ts -> packages/db/src/index.ts`
- 2-file cycle: `packages/db/src/index.ts -> packages/db/src/seed.ts -> packages/db/src/index.ts`

## Communities (113 total, 35 thin omitted)

### Community 0 - "db/src/index.ts"
Cohesion: 0.10
Nodes (37): BOOTSTRAP_ENV_KEYS, bootstrapConfigFromEnv(), CreateAdministratorInput, createBetterAuthClinicAdministrator(), CreateTenantInput, deactivateTenant(), provisionClinic(), ProvisionClinicInput (+29 more)

### Community 1 - "external-validation.ts"
Cohesion: 0.12
Nodes (18): bytesEqual(), certEndpoints(), CertView, checkCrl(), checkOcsp(), checkRevocation(), EmbeddedRevalidation, ExpectedSigner (+10 more)

### Community 2 - "catalog.ts"
Cohesion: 0.08
Nodes (46): addAnamnesisVersion(), addContractVersion(), anamnesisResponse(), catalogTenant(), checkAnamnesisIds(), comboAnamnesisIds(), comboResponse(), comboValid() (+38 more)

### Community 3 - "assinatura.$token.tsx"
Cohesion: 0.10
Nodes (19): CollectedFingerprint, anySchema, DraggableSignature(), GovBrState, PageGeometry, PhoneGate(), PreviewPdf(), PublicHistoryEvent (+11 more)

### Community 4 - "contract-materialization.ts"
Cohesion: 0.15
Nodes (20): assertRequiredContext(), ContextConfiguration, CONTRACT_CONTEXT_INCOMPLETE, defaultContextConfiguration(), DOCX_CONTENT_TYPE, extractTags(), hasValue(), inspectDocxPlaceholders() (+12 more)

### Community 5 - "queries.ts"
Cohesion: 0.04
Nodes (99): contextDescription(), contextLabel(), CONTEXTS, ContractDraftPanel(), ContractFormPage(), ContractMetadata, Props, attendancesQuery (+91 more)

### Community 6 - "anamnesis-links.integration.test.ts"
Cohesion: 0.09
Nodes (36): contract(), form(), headers(), procedure(), request(), schema, tenantIds, headers() (+28 more)

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
Cohesion: 0.08
Nodes (41): request(), deleteAppliedDocument(), headers(), placement, request(), placement, request(), ADR-0004 (+33 more)

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
Cohesion: 0.07
Nodes (27): Route, Route, Route, Route, Route, Route, Route, Route (+19 more)

### Community 21 - "app.ts"
Cohesion: 0.15
Nodes (28): app, appointmentStatusLabel, authTenant(), expiry(), fail(), handleError(), isRecord(), observedClientIp() (+20 more)

### Community 22 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+8 more)

### Community 23 - "manage.ts"
Cohesion: 0.23
Nodes (12): administratorByEmail(), changeClinicAdministratorEmail(), createClinicAdministrator(), createTenant(), listAdministrators(), listTenants(), normalizeEmail(), requireText() (+4 more)

### Community 24 - "PreviewPdf.tsx"
Cohesion: 0.33
Nodes (4): DraggableSignature(), PreviewPdf(), PreviewPlacement, pdfjs-dist

### Community 25 - "Implementation Decisions"
Cohesion: 0.09
Nodes (22): Assinatura local, Concorrência, idempotência e storage, Especificação — Assinatura eletrônica própria no MVP, Estados e conclusão, Fingerprint e evidências, Fonte, PDF e revisões, Further Notes, GOV.BR e assinaturas externas (+14 more)

### Community 26 - "dialogs.tsx"
Cohesion: 0.10
Nodes (41): ProcedurePicker(), AppointmentDialog(), AppointmentFields(), localDate(), localTime(), minutesBetween(), OfferFields(), PaymentDialog() (+33 more)

### Community 27 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, jsdom, @tanstack/router-plugin, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, @types/node, @types/react (+3 more)

### Community 29 - "signatures.ts"
Cohesion: 0.07
Nodes (74): loadTrustedRootFiles(), loadTrustedRootsFromEnv(), NormalizedEvidence, normalizeEvidence(), RawFingerprint, cancelExternalAttempt(), cancelExternalAttemptAsClinicRepresentative(), canonicalJson() (+66 more)

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
Nodes (19): listAnamnesisNotes(), noteValue(), protectedFollowupValue(), conflict(), createPayment(), deletePayment(), invalid(), listPayments() (+11 more)

### Community 35 - "-assinatura.$token.test.tsx"
Cohesion: 0.11
Nodes (11): renderAt(), queryClient, router, createAppRouter(), createQueryClient(), Register, @tanstack/react-router, renderPage() (+3 more)

### Community 36 - "Clínica de cuidados estéticos"
Cohesion: 0.20
Nodes (9): Attendance, Atendimento estético, Clínica de cuidados estéticos, Dados e ciclo de protótipo, Documentos e coleta, Jornada do paciente, Objetivo do produto, Organização da clínica (+1 more)

### Community 37 - "patients.ts"
Cohesion: 0.05
Nodes (42): createFollowup(), hashToken(), idShape(), invalid(), issueInitialTokens(), latest(), notFound(), offerForms() (+34 more)

### Community 38 - "SignaturePadField.test.tsx"
Cohesion: 0.09
Nodes (11): isMobileSignatureDevice(), lockLandscape(), scalePointGroups(), SignaturePadField, SignaturePadHandle, originalExitFullscreenDescriptor, originalFullscreenElementDescriptor, originalRequestFullscreenDescriptor (+3 more)

### Community 39 - "Button"
Cohesion: 0.13
Nodes (42): AnamnesisFormPage(), emptySchema, PatientPreview(), Props, AppointmentDetails(), dateLong, Props, Row() (+34 more)

### Community 40 - "documentos.$followupContractId.assinar.tsx"
Cohesion: 0.14
Nodes (13): PageGeometry, renderAllPages(), usePdfDocument(), ChecklistItem, SignChecklist(), SigningSteps(), StampPreview(), fetchProfessionalPdf() (+5 more)

### Community 41 - "contract-generation.ts"
Cohesion: 0.24
Nodes (14): buildContext(), contextForVersion(), contractedNames(), createInitialSignatureProcesses(), dbRows(), formatCivilDate(), generateFollowupContract(), invalid() (+6 more)

### Community 42 - "db/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, types, extends, include, ../../tsconfig.json

### Community 43 - "Agent skills"
Cohesion: 0.29
Nodes (6): Agent skills, Domain docs, graphify, Issue tracker, This is NOT the Turborepo you know, Triage labels

### Community 44 - "scheduling.ts"
Cohesion: 0.15
Nodes (38): civilDateOf(), clinicTimeZone(), activeAppointmentStatuses, addAttendancePhoto(), appointmentResponse(), assertAtomicCombos(), assertEventDay(), attendanceResponse() (+30 more)

### Community 45 - "format.ts"
Cohesion: 0.10
Nodes (27): allowed, AttendancePhotos(), Phase, phases, CalendarView(), appointmentStatus, duration(), monthLabel() (+19 more)

### Community 46 - "_app.tsx"
Cohesion: 0.19
Nodes (17): QuickActions(), Sheet(), SheetClose(), SheetContent(), SheetDescription(), SheetHeader(), SheetOverlay(), SheetTitle() (+9 more)

### Community 47 - "relational-schema.ts"
Cohesion: 0.05
Nodes (39): appliedAnamnesisNotes, catalogTimestamps, comboAnamneses, contractVersionPdfUploadIntents, eventAnamneses, NewRelationalPatient, NewRelationalProcedure, NewTenant (+31 more)

### Community 49 - "Decisão e plano: PostgreSQL + Drizzle + JSONB"
Cohesion: 0.09
Nodes (21): 10. Go/no-go para implementação, 1. Conclusão, 2. Decisões de domínio confirmadas, 3. Modelo de domínio e estados, 4. Blueprint relacional inicial, 5. Matriz de invariantes, 6. Fronteiras transacionais, 7. Reaproveitamento do Git (+13 more)

### Community 50 - "@tanstack/react-router"
Cohesion: 0.10
Nodes (38): AttendanceRecordForm(), matchesPatient(), PatientRow(), QueryError(), SchemaForm(), appliedAnamnesisQuery(), combosQuery, eventsQuery (+30 more)

### Community 51 - "Especificação: migração para PostgreSQL + Drizzle + JSONB"
Cohesion: 0.13
Nodes (14): API, frontend e operações de produto, Catálogo, planos e snapshots, Dados protegidos, Especificação: migração para PostgreSQL + Drizzle + JSONB, Further Notes, Implementation Decisions, Integridade e concorrência, Máquina de estados (+6 more)

### Community 52 - "api/package.json"
Cohesion: 0.12
Nodes (16): devDependencies, @types/bun, typescript, drizzle-orm, @types/bun, typescript, name, private (+8 more)

### Community 53 - "docx-pdf.ts"
Cohesion: 0.17
Nodes (6): DocxToPdfConverter, LIBREOFFICE_DEFAULT_TIMEOUT_MS, createSpaFallback(), createWebAssetMiddleware(), serveSpaIndex, pizzip

### Community 55 - "Validação de assinatura externa (GOV.BR) sem PAdES próprio"
Cohesion: 0.40
Nodes (4): Resultados, Revalidação em mutações posteriores (Issue #27), Validação de assinatura externa (GOV.BR) sem PAdES próprio, Verificações executadas (todas genuínas, nenhuma presumida)

### Community 56 - "followups.ts"
Cohesion: 0.12
Nodes (32): schema, schema, api(), call(), clinicDate(), fixture(), schema, ContractRef (+24 more)

### Community 58 - "dependencies"
Cohesion: 0.14
Nodes (14): dependencies, asn1js, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, better-auth, @better-auth/drizzle-adapter, @clinicare/db, docxtemplater (+6 more)

### Community 59 - "api"
Cohesion: 0.11
Nodes (25): Tabs(), TabsContent(), TabsList(), TabsTrigger(), api(), ApiError, RequestOptions, withIds() (+17 more)

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
Nodes (60): AnamnesisPicker(), InheritedAnamneses(), ComboFormPage(), day(), CpfField(), EditPatientDialog(), Field(), FormPage() (+52 more)

### Community 82 - "Correção do cancelamento de acompanhamento, anamneses e contratos"
Cohesion: 0.22
Nodes (8): Correção do cancelamento de acompanhamento, anamneses e contratos, Further Notes, Implementation Decisions, Out of Scope, Problem Statement, Solution, Testing Decisions, User Stories

### Community 84 - "request-ip.ts"
Cohesion: 0.43
Nodes (4): forwardedParameter(), headerAddress(), observedClientIp(), validIp()

### Community 85 - "getDatabase"
Cohesion: 0.23
Nodes (20): authFailure(), BRAZILIAN_STATES, changeOwnEmail(), changeOwnPassword(), getAccount(), getDefaultSignature(), getProfessionalProfile(), REGISTRATION_TYPES (+12 more)

### Community 86 - "-documentos.test.tsx"
Cohesion: 0.15
Nodes (6): Handler, marina, combo(), @testing-library/jest-dom, @testing-library/react, @testing-library/user-event

### Community 87 - "encryptValue"
Cohesion: 0.22
Nodes (12): patient(), api(), clinicDate(), enrolled(), api(), enrolled(), today(), newPatient() (+4 more)

### Community 89 - "getRelationalRelationship"
Cohesion: 0.40
Nodes (4): getRelationalRelationship(), response(), buildRelationship(), monthKey()

### Community 90 - "PageLoadingIndicator.test.tsx"
Cohesion: 0.33
Nodes (4): PageLoadingIndicator(), setup(), Route, FileRoutesById

### Community 91 - "SchemaEditor.tsx"
Cohesion: 0.06
Nodes (64): submit(), canControlVisibility(), conditionOf(), Field, FieldPatch, identifierFor(), newSalt(), Preview() (+56 more)

### Community 92 - "contract-authoring.ts"
Cohesion: 0.25
Nodes (12): docxMetadata(), invalid(), propagatePublishedVersion(), publishContractDraft(), saveContractDraft(), sha256(), uuid(), replaceUnsignedAppliedContract() (+4 more)

### Community 93 - "SigningWorkspace"
Cohesion: 0.24
Nodes (11): DRAFT_STORAGE_KEY(), readStoredDraft(), SigningWorkspace(), captureFromPad(), clear(), confirm(), goBackToStep(), goToConfirm() (+3 more)

### Community 96 - "pdf-mutation.ts"
Cohesion: 0.36
Nodes (6): createIncrementalSignaturePdf(), normalizedPlacementToPdfRect(), PdfPlacement, PdfRect, sha256(), validatePlacement()

### Community 97 - "validateExternalReturn"
Cohesion: 0.35
Nodes (13): blankReport(), cmsMessageDigest(), exactBytes(), latin1(), parseTrustedRoots(), rangeContent(), resolveSignaturePairs(), revalidateEmbeddedSignatures() (+5 more)

### Community 98 - "auth.ts"
Cohesion: 0.28
Nodes (5): AuthInstance, getTrustedOrigins(), SESSION_DURATION_SECONDS, better-auth, @better-auth/drizzle-adapter

### Community 99 - "$patientId/index.tsx"
Cohesion: 0.12
Nodes (32): ContractGenerateButton(), ContractReprocessButton(), ContractSignatureHistory(), copySignatureLink(), ContractSummary(), Entry, pendingBadge(), NewFollowupDialog() (+24 more)

### Community 100 - "RepresentativeSignPage"
Cohesion: 0.22
Nodes (17): composeStampImage(), loadImage(), trimTransparent(), draftKey(), readDraft(), RepresentativeSignPage(), flag(), handleClear() (+9 more)

### Community 102 - "clinical.ts"
Cohesion: 0.09
Nodes (45): addAnamnesisNote(), answerAppliedAnamnesis(), appliedShape(), byToken(), cancelledError(), claimCleanupJob(), cleanupLease(), CleanupResult (+37 more)

### Community 106 - "vitest"
Cohesion: 0.33
Nodes (10): collectFingerprint(), createIdempotencyKey(), GovBrSection(), acceptReturn(), cancelAttempt(), exportRevision(), importReturn(), postJson() (+2 more)

### Community 114 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 115 - "storage.ts"
Cohesion: 0.20
Nodes (9): bucket, resolveStorageConfig(), StorageEnv, copyVerifiedPdfObject(), headObject(), storage, config, uploadObjectBytesForDocument() (+1 more)

## Knowledge Gaps
- **628 isolated node(s):** `name`, `private`, `type`, `dev`, `dev:debug` (+623 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 798 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **35 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ContractVersion` connect `Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF` to `queries.ts`?**
  _High betweenness centrality (0.276) - this node is a cross-community bridge._
- **Why does `Solution` connect `Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF` to `encryptValue`?**
  _High betweenness centrality (0.276) - this node is a cross-community bridge._
- **Why does `patient()` connect `encryptValue` to `getDatabase`, `anamnesis-links.integration.test.ts`, `Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF`?**
  _High betweenness centrality (0.276) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _628 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `db/src/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10288461538461538 - nodes in this community are weakly interconnected._
- **Should `external-validation.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12105263157894737 - nodes in this community are weakly interconnected._
- **Should `catalog.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07738095238095238 - nodes in this community are weakly interconnected._