# Graph Report - clinicare  (2026-10-08)

## Corpus Check
- 269 files · ~198,572 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 15 file(s) not represented in the graph (top: (none) 7, .css 4, .example 1)

## Summary
- 2133 nodes · 6534 edges · 109 communities (81 shown, 28 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 73 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e6e63883`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- db/src/index.ts
- external-validation.ts
- catalog.ts
- assinatura.$token.tsx
- contract-materialization.ts
- queries.ts
- followups.ts
- routeTree.gen.ts
- scripts
- api/src/index.ts
- dependencies
- external-signatures.integration.test.ts
- Assinatura eletrônica própria — especificação completa
- Assinatura eletrônica própria — MVP
- web/package.json
- Especificação: MVP para clínicas pequenas de estética
- db/package.json
- tasks
- components.json
- FileRoutesByPath
- packages_db_src_index_appointment
- auth.ts
- compilerOptions
- admin-commands.ts
- DocumentViewer.tsx
- Implementation Decisions
- dialogs.tsx
- devDependencies
- manage.ts
- signatures.ts
- compilerOptions
- Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF
- api/tsconfig.json
- Clínicare
- payments.ts
- App.test.tsx
- Clínica de cuidados estéticos
- patients.ts
- SignaturePadField.test.tsx
- cn
- Button
- getDatabase
- db/tsconfig.json
- Agent skills
- scheduling.ts
- AttendancePhotos.tsx
- _app.tsx
- relational-schema.ts
- -assinatura.$token.test.tsx
- Decisão e plano: PostgreSQL + Drizzle + JSONB
- @tanstack/react-router
- Especificação: migração para PostgreSQL + Drizzle + JSONB
- api/package.json
- schemaUi.tsx
- CalendarView.tsx
- Validação de assinatura externa (GOV.BR) sem PAdES próprio
- event-execution.integration.test.ts
- manage
- dependencies
- pdf-mutation.ts
- Issue tracker: GitHub
- Domain Docs
- Persistência PostgreSQL + Drizzle + JSONB
- triage-labels.md
- packages_db_src_index_anamnesis
- packages_db_src_index_attendance
- packages_db_src_index_combo
- packages_db_src_index_contract
- packages_db_src_index_followup
- packages_db_src_index_patient
- packages_db_src_index_patientanamnesis
- packages_db_src_index_payment
- packages_db_src_index_plan
- packages_db_src_index_procedure
- ref_mongodb_memory_server
- ref_mongoose
- Preservação incremental de PDFs com assinaturas externas
- scripts
- Investigação da validação global T7
- planos/novo.tsx
- docx-types.d.ts
- Correção do cancelamento de acompanhamento, anamneses e contratos
- DB_SCHEMA.md
- request-ip.ts
- nova.tsx
- SchemaEditor.test.tsx
- vitest
- scripts
- createFollowup
- PageLoadingIndicator.test.tsx
- ContractSignatureHistory.tsx
- headers
- Route
- vite.config.ts
- SignaturePadField.tsx
- fingerprint.ts
- ref_node_fs
- composeStampImage
- RepresentativeSignPage
- SigningWorkspace
- clinical.ts
- ref_node_readline
- contratos/novo.tsx
- collectFingerprint
- contract-generation.ts
- request
- request

## God Nodes (most connected - your core abstractions)
1. `getDatabase()` - 167 edges
2. `app` - 129 edges
3. `cn()` - 60 edges
4. `react` - 58 edges
5. `@tanstack/react-router` - 55 edges
6. `useApiMutation()` - 48 edges
7. `api()` - 47 edges
8. `lucide-react` - 46 edges
9. `@tanstack/react-query` - 44 edges
10. `Button()` - 41 edges

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

## Communities (109 total, 28 thin omitted)

### Community 0 - "db/src/index.ts"
Cohesion: 0.23
Nodes (14): assertSafeIntegrationDatabase(), integration, closeDatabase(), connectPostgresDatabase(), Database, disconnectDatabase(), getDatabasePool(), ensurePgTrgmExtension() (+6 more)

### Community 1 - "external-validation.ts"
Cohesion: 0.13
Nodes (31): blankReport(), bytesEqual(), certEndpoints(), CertView, checkCrl(), checkOcsp(), checkRevocation(), cmsMessageDigest() (+23 more)

### Community 2 - "catalog.ts"
Cohesion: 0.08
Nodes (46): addAnamnesisVersion(), addContractVersion(), anamnesisResponse(), catalogTenant(), checkAnamnesisIds(), comboAnamnesisIds(), comboResponse(), comboValid() (+38 more)

### Community 3 - "assinatura.$token.tsx"
Cohesion: 0.09
Nodes (18): ChecklistItem, SignChecklist(), SigningSteps(), anySchema, DraggableSignature(), GovBrState, PageGeometry, PreviewPdf() (+10 more)

### Community 4 - "contract-materialization.ts"
Cohesion: 0.13
Nodes (26): docxMetadata(), invalid(), saveContractDraft(), uuid(), assertRequiredContext(), ContextConfiguration, CONTRACT_CONTEXT_INCOMPLETE, defaultContextConfiguration() (+18 more)

### Community 5 - "queries.ts"
Cohesion: 0.03
Nodes (120): contextDescription(), contextLabel(), CONTEXTS, ContractDraftPanel(), ContractMetadata, Props, EditPatientDialog(), FollowupCard() (+112 more)

### Community 6 - "followups.ts"
Cohesion: 0.10
Nodes (58): schema, tenantIds, schema, tenantIds, schema, civilDate(), eventBody(), schema (+50 more)

### Community 7 - "routeTree.gen.ts"
Cohesion: 0.04
Nodes (45): AppAgendaRoute, AppConfiguracoesRoute, AppContratosContractIdRoute, AppContratosIndexRoute, AppContratosNovoRoute, AppDocumentosFollowupContractIdAssinarRoute, AppDocumentosRoute, AppDocumentosRouteChildren (+37 more)

### Community 8 - "scripts"
Cohesion: 0.05
Nodes (38): devDependencies, turbo, engines, node, name, packageManager, private, scripts (+30 more)

### Community 9 - "api/src/index.ts"
Cohesion: 0.15
Nodes (11): DocxToPdfConverter, LIBREOFFICE_DEFAULT_TIMEOUT_MS, resolvedPort, createSpaFallback(), createWebAssetMiddleware(), serveSpaIndex, hono, ref_node_fs_promises (+3 more)

### Community 10 - "dependencies"
Cohesion: 0.06
Nodes (32): dependencies, class-variance-authority, clsx, date-fns, @fingerprintjs/fingerprintjs, @fullcalendar/core, @fullcalendar/interaction, @fullcalendar/react (+24 more)

### Community 11 - "external-signatures.integration.test.ts"
Cohesion: 0.07
Nodes (61): request(), placement, request(), placement, request(), ADR-0004, buildSignedReturnPdf(), buildUnparsableCmsReturn() (+53 more)

### Community 12 - "Assinatura eletrônica própria — especificação completa"
Cohesion: 0.09
Nodes (22): 10. Selo da plataforma e gestão de chaves, 11. Pacote exportável e verificação independente, 12. Recuperação, revogação e tempo, 13. Limites de confiança, 14. Critérios de aceitação, 1. Objetivo e decisões de produto, 2. O que o sistema pretende demonstrar, 3.1. Fingerprint obrigatório desde o MVP (+14 more)

### Community 13 - "Assinatura eletrônica própria — MVP"
Cohesion: 0.09
Nodes (22): 10. Histórico, armazenamento e download, 11. Estrutura preparada para evolução, 12. O que fica fora deste MVP, 13. Critérios para considerar o MVP pronto, 14. Limite da evolução futura, 1. Objetivo, 2. Fluxo oficial, também mantido na produção, 3.1. Fingerprint obrigatório desde o MVP (+14 more)

### Community 14 - "web/package.json"
Cohesion: 0.08
Nodes (23): typescript, name, private, type, class-variance-authority, clsx, date-fns, jsdom (+15 more)

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
Nodes (28): Route, Route, Route, Route, Route, Route, Route, Route (+20 more)

### Community 21 - "auth.ts"
Cohesion: 0.24
Nodes (7): AuthInstance, getTrustedOrigins(), SESSION_DURATION_SECONDS, authSchema, packages_db_src_index_authschema, better-auth, @better-auth/drizzle-adapter

### Community 22 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+8 more)

### Community 23 - "admin-commands.ts"
Cohesion: 0.17
Nodes (20): administratorByEmail(), BOOTSTRAP_ENV_KEYS, bootstrapConfigFromEnv(), changeClinicAdministratorEmail(), CreateAdministratorInput, createBetterAuthClinicAdministrator(), createClinicAdministrator(), CreateTenantInput (+12 more)

### Community 24 - "DocumentViewer.tsx"
Cohesion: 0.17
Nodes (7): PageGeometry, renderAllPages(), usePdfDocument(), DraggableSignature(), PreviewPdf(), PreviewPlacement, pdfjs-dist

### Community 25 - "Implementation Decisions"
Cohesion: 0.09
Nodes (22): Assinatura local, Concorrência, idempotência e storage, Especificação — Assinatura eletrônica própria no MVP, Estados e conclusão, Fingerprint e evidências, Fonte, PDF e revisões, Further Notes, GOV.BR e assinaturas externas (+14 more)

### Community 26 - "dialogs.tsx"
Cohesion: 0.05
Nodes (50): AppointmentDetails(), dateLong, Props, time, ProcedurePicker(), AppointmentDialog(), AppointmentFields(), localDate() (+42 more)

### Community 27 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, jsdom, @tanstack/router-plugin, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, @types/node, @types/react (+3 more)

### Community 28 - "manage.ts"
Cohesion: 0.31
Nodes (9): createTenant(), listAdministrators(), listTenants(), opt(), parseManageArgs(), promptHiddenPassword(), runManage(), ref_node_child_process (+1 more)

### Community 29 - "signatures.ts"
Cohesion: 0.08
Nodes (72): loadTrustedRootFiles(), loadTrustedRootsFromEnv(), NormalizedEvidence, normalizeEvidence(), RawFingerprint, canonicalJson(), ClinicSignatureActor, confirmExternalReturn() (+64 more)

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

### Community 34 - "payments.ts"
Cohesion: 0.26
Nodes (13): conflict(), createPayment(), deletePayment(), invalid(), listPayments(), notFound(), PaymentInput, paymentResponse() (+5 more)

### Community 35 - "App.test.tsx"
Cohesion: 0.15
Nodes (15): Handler, marina, renderAt(), apps_web_src_index, combo(), contract(), queryClient, router (+7 more)

### Community 36 - "Clínica de cuidados estéticos"
Cohesion: 0.20
Nodes (9): Attendance, Atendimento estético, Clínica de cuidados estéticos, Dados e ciclo de protótipo, Documentos e coleta, Jornada do paciente, Objetivo do produto, Organização da clínica (+1 more)

### Community 37 - "patients.ts"
Cohesion: 0.10
Nodes (35): createPatient(), deactivatePatient(), DEFAULT_TENANT_ID, encrypted(), encryptedColumns(), ensureTenant(), getPatient(), isUuid() (+27 more)

### Community 38 - "SignaturePadField.test.tsx"
Cohesion: 0.11
Nodes (4): originalExitFullscreenDescriptor, originalFullscreenElementDescriptor, originalRequestFullscreenDescriptor, ResizeCallback

### Community 39 - "cn"
Cohesion: 0.07
Nodes (50): ComboFormPage(), day(), CpfField(), Field(), FormDialog(), FormPage(), FormPageProps, DatePicker() (+42 more)

### Community 40 - "Button"
Cohesion: 0.10
Nodes (27): emptySchema, Props, offerLabel, FormDialogProps, Button(), Dialog(), DialogContent(), DialogDescription() (+19 more)

### Community 41 - "getDatabase"
Cohesion: 0.08
Nodes (63): BRAZILIAN_STATES, getAccount(), getDefaultSignature(), getProfessionalProfile(), REGISTRATION_TYPES, updateAccount(), updateDefaultSignature(), updateInitialPasswordChoice() (+55 more)

### Community 42 - "db/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, types, extends, include, ../../tsconfig.json

### Community 43 - "Agent skills"
Cohesion: 0.29
Nodes (6): Agent skills, Domain docs, graphify, Issue tracker, This is NOT the Turborepo you know, Triage labels

### Community 44 - "scheduling.ts"
Cohesion: 0.15
Nodes (37): civilDateOf(), clinicTimeZone(), activeAppointmentStatuses, addAttendancePhoto(), appointmentResponse(), assertAtomicCombos(), assertEventDay(), attendanceResponse() (+29 more)

### Community 45 - "AttendancePhotos.tsx"
Cohesion: 0.25
Nodes (7): allowed, AttendancePhotos(), Phase, phases, photoPhases, useDeleteAttendancePhoto(), AttendancePhoto

### Community 46 - "_app.tsx"
Cohesion: 0.15
Nodes (16): QuickActions(), Sheet(), SheetClose(), SheetContent(), SheetDescription(), SheetHeader(), SheetOverlay(), SheetTitle() (+8 more)

### Community 47 - "relational-schema.ts"
Cohesion: 0.05
Nodes (42): authAccounts, AuthSession, authSessions, AuthUser, authUsers, authVerifications, professionals, catalogTimestamps (+34 more)

### Community 49 - "Decisão e plano: PostgreSQL + Drizzle + JSONB"
Cohesion: 0.09
Nodes (21): 10. Go/no-go para implementação, 1. Conclusão, 2. Decisões de domínio confirmadas, 3. Modelo de domínio e estados, 4. Blueprint relacional inicial, 5. Matriz de invariantes, 6. Fronteiras transacionais, 7. Reaproveitamento do Git (+13 more)

### Community 50 - "@tanstack/react-router"
Cohesion: 0.10
Nodes (31): AttendanceRecordForm(), ContractReprocessButton(), NewFollowupDialog(), matchesPatient(), PatientRow(), QueryError(), Props, SchemaForm() (+23 more)

### Community 51 - "Especificação: migração para PostgreSQL + Drizzle + JSONB"
Cohesion: 0.13
Nodes (14): API, frontend e operações de produto, Catálogo, planos e snapshots, Dados protegidos, Especificação: migração para PostgreSQL + Drizzle + JSONB, Further Notes, Implementation Decisions, Integridade e concorrência, Máquina de estados (+6 more)

### Community 52 - "api/package.json"
Cohesion: 0.12
Nodes (16): devDependencies, @types/bun, typescript, drizzle-orm, @types/bun, typescript, name, private (+8 more)

### Community 53 - "schemaUi.tsx"
Cohesion: 0.06
Nodes (57): AnamnesisFormPage(), submit(), canControlVisibility(), conditionOf(), identifierFor(), newSalt(), Preview(), saltOf() (+49 more)

### Community 54 - "CalendarView.tsx"
Cohesion: 0.20
Nodes (8): apps_web_src_components_calendar, CalendarEntry, CalendarView(), @fullcalendar/core, ref_fullcalendar_core_locales_pt_br, @fullcalendar/interaction, @fullcalendar/react, @fullcalendar/timegrid

### Community 55 - "Validação de assinatura externa (GOV.BR) sem PAdES próprio"
Cohesion: 0.40
Nodes (4): Resultados, Revalidação em mutações posteriores (Issue #27), Validação de assinatura externa (GOV.BR) sem PAdES próprio, Verificações executadas (todas genuínas, nenhuma presumida)

### Community 56 - "event-execution.integration.test.ts"
Cohesion: 0.17
Nodes (32): api(), clinicDate(), enrolled(), schema, api(), enrolled(), schema, today() (+24 more)

### Community 58 - "dependencies"
Cohesion: 0.14
Nodes (14): dependencies, asn1js, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, better-auth, @better-auth/drizzle-adapter, @clinicare/db, docxtemplater (+6 more)

### Community 59 - "pdf-mutation.ts"
Cohesion: 0.36
Nodes (6): createIncrementalSignaturePdf(), normalizedPlacementToPdfRect(), PdfPlacement, PdfRect, sha256(), validatePlacement()

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
Cohesion: 0.12
Nodes (34): AnamnesisPicker(), InheritedAnamneses(), Kind, kinds, PlanOfferPicker(), PlanOfferPickerProps, emptySchema, ProcedureFormPage() (+26 more)

### Community 82 - "Correção do cancelamento de acompanhamento, anamneses e contratos"
Cohesion: 0.22
Nodes (8): Correção do cancelamento de acompanhamento, anamneses e contratos, Further Notes, Implementation Decisions, Out of Scope, Problem Statement, Solution, Testing Decisions, User Stories

### Community 84 - "request-ip.ts"
Cohesion: 0.32
Nodes (5): observedClientIp(), observedClientIp(), RuntimeServer, validIp(), ref_node_net

### Community 85 - "nova.tsx"
Cohesion: 0.67
Nodes (3): useCreateAnamnesis(), NewAnamnesis(), Route

### Community 86 - "SchemaEditor.test.tsx"
Cohesion: 0.29
Nodes (4): schema, ref_testing_library_jest_dom_vitest, @testing-library/react, @testing-library/user-event

### Community 87 - "vitest"
Cohesion: 0.29
Nodes (4): planSchema, base, ref_noble_hashes_sha2_js, vitest

### Community 88 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 89 - "createFollowup"
Cohesion: 0.05
Nodes (44): fixture(), headers(), post(), request(), api(), call(), clinicDate(), fixture() (+36 more)

### Community 91 - "ContractSignatureHistory.tsx"
Cohesion: 0.10
Nodes (27): ContractGenerateButton(), ContractSignatureHistory(), copySignatureLink(), ContractSummary(), Entry, pendingBadge(), Body(), Entry (+19 more)

### Community 94 - "vite.config.ts"
Cohesion: 0.33
Nodes (5): @tailwindcss/vite, ref_tanstack_router_plugin_vite, vite, @vitejs/plugin-react, ref_vitest_config

### Community 95 - "SignaturePadField.tsx"
Cohesion: 0.48
Nodes (6): isMobileSignatureDevice(), lockLandscape(), scalePointGroups(), SignaturePadField, unlockLandscape(), signature_pad

### Community 99 - "composeStampImage"
Cohesion: 0.83
Nodes (3): composeStampImage(), loadImage(), trimTransparent()

### Community 100 - "RepresentativeSignPage"
Cohesion: 0.29
Nodes (14): draftKey(), readDraft(), RepresentativeSignPage(), flag(), handleClear(), handleConfirm(), handleDrawOther(), handlePlacementChange() (+6 more)

### Community 101 - "SigningWorkspace"
Cohesion: 0.23
Nodes (12): DRAFT_STORAGE_KEY(), readStoredDraft(), SigningWorkspace(), captureFromPad(), clear(), confirm(), goBackToStep(), goToConfirm() (+4 more)

### Community 102 - "clinical.ts"
Cohesion: 0.16
Nodes (23): claimCleanupJob(), cleanupLease(), CleanupResult, CleanupStatus, clearDraft, deleteAppliedDocument(), documentOwnsCleanupKeys(), documentShape() (+15 more)

### Community 104 - "contratos/novo.tsx"
Cohesion: 0.40
Nodes (4): ContractFormPage(), useCreateContract(), NewContract(), Route

### Community 106 - "collectFingerprint"
Cohesion: 0.42
Nodes (8): collectFingerprint(), createIdempotencyKey(), GovBrSection(), acceptReturn(), cancelAttempt(), exportRevision(), importReturn(), postJson()

### Community 107 - "contract-generation.ts"
Cohesion: 0.09
Nodes (41): patient(), jsonValue(), protect(), propagatePublishedVersion(), publishContractDraft(), sha256(), buildContext(), contextForVersion() (+33 more)

### Community 111 - "request"
Cohesion: 0.40
Nodes (5): contract(), form(), headers(), procedure(), request()

### Community 113 - "request"
Cohesion: 0.67
Nodes (3): fixtures(), headers(), request()

## Knowledge Gaps
- **633 isolated node(s):** `name`, `private`, `type`, `dev`, `dev:debug` (+628 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 819 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **28 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cancelAttempt()` connect `collectFingerprint` to `external-signatures.integration.test.ts`?**
  _High betweenness centrality (0.246) - this node is a cross-community bridge._
- **Why does `GovBrSection()` connect `collectFingerprint` to `assinatura.$token.tsx`?**
  _High betweenness centrality (0.244) - this node is a cross-community bridge._
- **Why does `ContractVersion` connect `Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF` to `queries.ts`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _633 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `external-validation.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13257575757575757 - nodes in this community are weakly interconnected._
- **Should `catalog.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07890070921985816 - nodes in this community are weakly interconnected._
- **Should `assinatura.$token.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._