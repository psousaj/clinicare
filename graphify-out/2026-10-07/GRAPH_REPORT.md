# Graph Report - clinicare  (2026-10-07)

## Corpus Check
- 249 files · ~178,825 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 14 file(s) not represented in the graph (top: (none) 7, .css 3, .example 1)

## Summary
- 1974 nodes · 6103 edges · 102 communities (73 shown, 29 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 64 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0e80c720`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- clinical.integration.test.ts
- external-validation.ts
- combos/novo.tsx
- assinatura.$token.tsx
- contract-materialization.ts
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
- packages_db_src_index_appointment
- react
- compilerOptions
- catalog.ts
- Workspace
- Implementation Decisions
- api
- devDependencies
- procedimentos/index.tsx
- signatures.ts
- compilerOptions
- Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF
- api/tsconfig.json
- Clínicare
- storage.ts
- -assinatura.$token.test.tsx
- Clínica de cuidados estéticos
- patients.ts
- scripts
- dialogs.tsx
- payments.ts
- getDatabase
- db/tsconfig.json
- Agent skills
- scheduling.ts
- app.ts
- _app.tsx
- relational-schema.ts
- createFollowup
- Decisão e plano: PostgreSQL + Drizzle + JSONB
- @tanstack/react-router
- Especificação: migração para PostgreSQL + Drizzle + JSONB
- api/package.json
- SchemaEditor.tsx
- CalendarView.tsx
- Validação de assinatura externa (GOV.BR) sem PAdES próprio
- format.ts
- protect
- dependencies
- storage-config.ts
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
- collectFingerprint
- docx-types.d.ts
- Route
- DB_SCHEMA.md
- SigningWorkspace
- nova.tsx
- SchemaEditor.test.tsx
- ref_node_fs
- VersionsDialog.tsx
- pdf-mutation.ts
- PageLoadingIndicator.test.tsx
- vitest
- App.test.tsx
- relationship.ts
- generateFollowupContract
- saveContract
- contratos/novo.tsx
- headers
- request
- procedimentos/novo.tsx

## God Nodes (most connected - your core abstractions)
1. `getDatabase()` - 157 edges
2. `app` - 127 edges
3. `cn()` - 55 edges
4. `@tanstack/react-router` - 54 edges
5. `react` - 53 edges
6. `lucide-react` - 45 edges
7. `@tanstack/react-query` - 44 edges
8. `api()` - 44 edges
9. `useApiMutation()` - 44 edges
10. `Button()` - 41 edges

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

## Communities (102 total, 29 thin omitted)

### Community 0 - "clinical.integration.test.ts"
Cohesion: 0.10
Nodes (51): schema, tenantIds, fixture(), post(), request(), civilDate(), eventBody(), schema (+43 more)

### Community 1 - "external-validation.ts"
Cohesion: 0.09
Nodes (44): buildSignedReturnPdf(), buildUnparsableCmsReturn(), createTestCa(), ensureOpensslAvailable(), issueDatedTestSigner(), issueTestSigner(), num10(), parseBaseTrailer() (+36 more)

### Community 3 - "assinatura.$token.tsx"
Cohesion: 0.11
Nodes (15): anySchema, GovBrState, PageGeometry, Position, PublicHistoryEvent, PublicHistoryRevision, Route, Signature (+7 more)

### Community 4 - "contract-materialization.ts"
Cohesion: 0.16
Nodes (21): assertRequiredContext(), ContextConfiguration, CONTRACT_CONTEXT_INCOMPLETE, defaultContextConfiguration(), DOCX_CONTENT_TYPE, extractTags(), hasValue(), inspectDocxPlaceholders() (+13 more)

### Community 5 - "queries.ts"
Cohesion: 0.05
Nodes (54): confirmProfessionalSignature(), everything, keys, MutationConfig, patientRefresh, postParticipantPdf(), previewProfessionalSignature(), useConfirmProfessionalSignature() (+46 more)

### Community 6 - "followups.ts"
Cohesion: 0.11
Nodes (59): patient(), protectedFollowupValue(), api(), clinicDate(), enrolled(), schema, api(), enrolled() (+51 more)

### Community 7 - "routeTree.gen.ts"
Cohesion: 0.05
Nodes (42): AppAgendaRoute, AppConfiguracoesRoute, AppContratosContractIdRoute, AppContratosIndexRoute, AppContratosNovoRoute, AppDocumentosRoute, AppEventosIndexRoute, AppEventosNovoRoute (+34 more)

### Community 8 - "scripts"
Cohesion: 0.05
Nodes (37): devDependencies, turbo, engines, node, name, packageManager, private, scripts (+29 more)

### Community 9 - "admin-commands.ts"
Cohesion: 0.06
Nodes (42): administratorByEmail(), BOOTSTRAP_ENV_KEYS, bootstrapConfigFromEnv(), changeClinicAdministratorEmail(), createBetterAuthClinicAdministrator(), deactivateTenant(), normalizeEmail(), provisionClinic() (+34 more)

### Community 10 - "dependencies"
Cohesion: 0.06
Nodes (32): dependencies, class-variance-authority, clsx, date-fns, @fingerprintjs/fingerprintjs, @fullcalendar/core, @fullcalendar/interaction, @fullcalendar/react (+24 more)

### Community 11 - "clinical.ts"
Cohesion: 0.09
Nodes (54): request(), CleanupResult, CleanupStatus, clearDraft, deleteAppliedDocument(), headers(), contractedNames(), placement (+46 more)

### Community 12 - "Assinatura eletrônica própria — especificação completa"
Cohesion: 0.09
Nodes (22): 10. Selo da plataforma e gestão de chaves, 11. Pacote exportável e verificação independente, 12. Recuperação, revogação e tempo, 13. Limites de confiança, 14. Critérios de aceitação, 1. Objetivo e decisões de produto, 2. O que o sistema pretende demonstrar, 3.1. Fingerprint obrigatório desde o MVP (+14 more)

### Community 13 - "Assinatura eletrônica própria — MVP"
Cohesion: 0.09
Nodes (22): 10. Histórico, armazenamento e download, 11. Estrutura preparada para evolução, 12. O que fica fora deste MVP, 13. Critérios para considerar o MVP pronto, 14. Limite da evolução futura, 1. Objetivo, 2. Fluxo oficial, também mantido na produção, 3.1. Fingerprint obrigatório desde o MVP (+14 more)

### Community 14 - "web/package.json"
Cohesion: 0.07
Nodes (28): typescript, name, private, type, class-variance-authority, clsx, date-fns, jsdom (+20 more)

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
Nodes (25): Route, Route, Route, Route, Route, Route, Route, Route (+17 more)

### Community 21 - "react"
Cohesion: 0.11
Nodes (20): emptySchema, Props, ContractSignatureHistory(), Body(), Entry, GroupedEntry, kinds, PatientTimeline() (+12 more)

### Community 22 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+8 more)

### Community 23 - "catalog.ts"
Cohesion: 0.14
Nodes (20): contract(), form(), headers(), procedure(), request(), schema, tenantIds, validPdfMetadata() (+12 more)

### Community 24 - "Workspace"
Cohesion: 0.23
Nodes (10): Workspace(), captureDrawing(), clear(), placement(), runConfirm(), runPreview(), fetchProfessionalPdf(), composeStampImage() (+2 more)

### Community 25 - "Implementation Decisions"
Cohesion: 0.09
Nodes (22): Assinatura local, Concorrência, idempotência e storage, Especificação — Assinatura eletrônica própria no MVP, Estados e conclusão, Fingerprint e evidências, Fonte, PDF e revisões, Further Notes, GOV.BR e assinaturas externas (+14 more)

### Community 26 - "api"
Cohesion: 0.05
Nodes (63): AppointmentDetails(), contextDescription(), contextLabel(), CONTEXTS, ContractDraftPanel(), ContractMetadata, Props, AppointmentDialog() (+55 more)

### Community 27 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, jsdom, @tanstack/router-plugin, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, @types/node, @types/react (+3 more)

### Community 28 - "procedimentos/index.tsx"
Cohesion: 0.17
Nodes (15): ComboFormPage(), day(), ProcedurePicker(), PaymentDialog(), StandaloneAttendanceDialog(), currency(), useCreateCombo(), useDeletePlan() (+7 more)

### Community 29 - "signatures.ts"
Cohesion: 0.09
Nodes (65): loadTrustedRootFiles(), loadTrustedRootsFromEnv(), NormalizedEvidence, normalizeEvidence(), RawFingerprint, canonicalJson(), ClinicSignatureActor, confirmExternalReturn() (+57 more)

### Community 30 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, noEmit, skipLibCheck, strict (+1 more)

### Community 31 - "Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF"
Cohesion: 0.14
Nodes (14): ContractVersion, 0005. Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos, Consequências, Contexto, Decisão, Emenda — 2026-10-07 (Issue #32: LibreOffice headless sob demanda, ONLYOFFICE aposentado), Further Notes, Implementation Decisions (+6 more)

### Community 32 - "api/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, allowImportingTsExtensions, types, extends, include, ../../tsconfig.json

### Community 33 - "Clínicare"
Cohesion: 0.29
Nodes (6): Clínicare, Desenvolvimento sem Docker, Estrutura do monorepo, Rodar localmente via Docker (caminho recomendado), Stack, Verificações

### Community 34 - "storage.ts"
Cohesion: 0.18
Nodes (21): docxMetadata(), getContractDraftEditor(), invalid(), listContractPlaceholders(), presignContractDraft(), publishContractDraft(), saveContractDraft(), sha256() (+13 more)

### Community 35 - "-assinatura.$token.test.tsx"
Cohesion: 0.15
Nodes (11): renderAt(), apps_web_src_index, queryClient, router, createAppRouter(), createQueryClient(), Register, @tanstack/react-router (+3 more)

### Community 36 - "Clínica de cuidados estéticos"
Cohesion: 0.20
Nodes (9): Attendance, Atendimento estético, Clínica de cuidados estéticos, Dados e ciclo de protótipo, Documentos e coleta, Jornada do paciente, Objetivo do produto, Organização da clínica (+1 more)

### Community 37 - "patients.ts"
Cohesion: 0.10
Nodes (32): createPatient(), deactivatePatient(), DEFAULT_TENANT_ID, encrypted(), encryptedColumns(), ensureTenant(), getPatient(), isUuid() (+24 more)

### Community 38 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 39 - "dialogs.tsx"
Cohesion: 0.07
Nodes (52): CpfField(), AppointmentFields(), minutesBetween(), OfferFields(), PlannedItem, Selection, Field(), FormDialog() (+44 more)

### Community 40 - "payments.ts"
Cohesion: 0.14
Nodes (26): addAnamnesisNote(), appliedShape(), createAppliedAnamnesis(), invalid(), noteValue(), unprotect(), decryptMaterializationContext(), conflict() (+18 more)

### Community 41 - "getDatabase"
Cohesion: 0.13
Nodes (28): BRAZILIAN_STATES, getAccount(), getProfessionalProfile(), REGISTRATION_TYPES, updateInitialPasswordChoice(), updateProfessionalProfile(), clinicSession, getClinicSession() (+20 more)

### Community 42 - "db/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, types, extends, include, ../../tsconfig.json

### Community 43 - "Agent skills"
Cohesion: 0.29
Nodes (6): Agent skills, Domain docs, graphify, Issue tracker, This is NOT the Turborepo you know, Triage labels

### Community 44 - "scheduling.ts"
Cohesion: 0.14
Nodes (39): civilDateOf(), clinicTimeZone(), activeAppointmentStatuses, addAttendancePhoto(), appointmentResponse(), assertAtomicCombos(), assertEventDay(), attendanceResponse() (+31 more)

### Community 45 - "app.ts"
Cohesion: 0.05
Nodes (70): app, appointmentStatusLabel, authTenant(), expiry(), fail(), handleError(), isRecord(), observedClientIp() (+62 more)

### Community 46 - "_app.tsx"
Cohesion: 0.15
Nodes (16): QuickActions(), Sheet(), SheetClose(), SheetContent(), SheetDescription(), SheetHeader(), SheetOverlay(), SheetTitle() (+8 more)

### Community 47 - "relational-schema.ts"
Cohesion: 0.04
Nodes (44): authAccounts, AuthSession, authSessions, AuthUser, authUsers, authVerifications, professionals, catalogTimestamps (+36 more)

### Community 48 - "createFollowup"
Cohesion: 0.21
Nodes (15): createFollowup(), hashToken(), idShape(), invalid(), issueInitialTokens(), latest(), notFound(), offerForms() (+7 more)

### Community 49 - "Decisão e plano: PostgreSQL + Drizzle + JSONB"
Cohesion: 0.09
Nodes (21): 10. Go/no-go para implementação, 1. Conclusão, 2. Decisões de domínio confirmadas, 3. Modelo de domínio e estados, 4. Blueprint relacional inicial, 5. Matriz de invariantes, 6. Fronteiras transacionais, 7. Reaproveitamento do Git (+13 more)

### Community 50 - "@tanstack/react-router"
Cohesion: 0.08
Nodes (42): AttendanceRecordForm(), ContractSummary(), Entry, pendingBadge(), NewFollowupDialog(), matchesPatient(), PatientRow(), Geometry (+34 more)

### Community 51 - "Especificação: migração para PostgreSQL + Drizzle + JSONB"
Cohesion: 0.13
Nodes (14): API, frontend e operações de produto, Catálogo, planos e snapshots, Dados protegidos, Especificação: migração para PostgreSQL + Drizzle + JSONB, Further Notes, Implementation Decisions, Integridade e concorrência, Máquina de estados (+6 more)

### Community 52 - "api/package.json"
Cohesion: 0.12
Nodes (16): devDependencies, @types/bun, typescript, drizzle-orm, @types/bun, typescript, name, private (+8 more)

### Community 53 - "SchemaEditor.tsx"
Cohesion: 0.07
Nodes (61): AnamnesisFormPage(), submit(), canControlVisibility(), conditionOf(), Field, FieldPatch, identifierFor(), newSalt() (+53 more)

### Community 54 - "CalendarView.tsx"
Cohesion: 0.20
Nodes (8): apps_web_src_components_calendar, CalendarEntry, CalendarView(), @fullcalendar/core, ref_fullcalendar_core_locales_pt_br, @fullcalendar/interaction, @fullcalendar/react, @fullcalendar/timegrid

### Community 55 - "Validação de assinatura externa (GOV.BR) sem PAdES próprio"
Cohesion: 0.40
Nodes (4): Resultados, Revalidação em mutações posteriores (Issue #27), Validação de assinatura externa (GOV.BR) sem PAdES próprio, Verificações executadas (todas genuínas, nenhuma presumida)

### Community 56 - "format.ts"
Cohesion: 0.14
Nodes (14): allowed, AttendancePhotos(), Phase, phases, appointmentStatus, duration(), monthLabel(), offerKinds (+6 more)

### Community 57 - "protect"
Cohesion: 0.24
Nodes (10): byToken(), hashToken(), jsonValue(), protect(), publicShape(), readPublicAnamnesis(), saveAnamnesisDraft(), submitApplied() (+2 more)

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
Cohesion: 0.29
Nodes (7): scripts, build, dev, dev:debug, test, test:integration, typecheck

### Community 78 - "Investigação da validação global T7"
Cohesion: 0.40
Nodes (4): Correções e validação final, Evidências de escopo, Investigação da validação global T7, Resultado inicial

### Community 79 - "planos/novo.tsx"
Cohesion: 0.15
Nodes (29): AnamnesisPicker(), InheritedAnamneses(), Kind, kinds, PlanOfferPicker(), PlanOfferPickerProps, Checkbox(), comboPriceCents() (+21 more)

### Community 80 - "collectFingerprint"
Cohesion: 0.36
Nodes (9): CollectedFingerprint, collectFingerprint(), GovBrSection(), acceptReturn(), cancelAttempt(), exportRevision(), importReturn(), postJson() (+1 more)

### Community 84 - "SigningWorkspace"
Cohesion: 0.32
Nodes (5): SigningWorkspace(), clear(), confirm(), placement(), preview()

### Community 86 - "SchemaEditor.test.tsx"
Cohesion: 0.29
Nodes (4): schema, ref_testing_library_jest_dom_vitest, @testing-library/react, @testing-library/user-event

### Community 88 - "VersionsDialog.tsx"
Cohesion: 0.08
Nodes (32): dateLong, Props, time, FormDialogProps, Dialog(), DialogContent(), DialogDescription(), DialogFooter() (+24 more)

### Community 90 - "pdf-mutation.ts"
Cohesion: 0.36
Nodes (6): createIncrementalSignaturePdf(), normalizedPlacementToPdfRect(), PdfPlacement, PdfRect, sha256(), validatePlacement()

### Community 92 - "vitest"
Cohesion: 0.29
Nodes (4): planSchema, base, ref_noble_hashes_sha2_js, vitest

### Community 94 - "App.test.tsx"
Cohesion: 0.33
Nodes (4): Handler, marina, combo(), contract()

### Community 96 - "generateFollowupContract"
Cohesion: 0.27
Nodes (10): buildContext(), contextForVersion(), createInitialSignatureProcesses(), dbRows(), formatCivilDate(), generateFollowupContract(), invalid(), protectedValue() (+2 more)

### Community 97 - "saveContract"
Cohesion: 0.29
Nodes (8): consumeContractVersionPdfUploadIntent(), contractResponse(), finalizeContractVersionPdf(), legacyContractGone(), lockContract(), saveContract(), validContractKind(), validUuid()

### Community 98 - "contratos/novo.tsx"
Cohesion: 0.40
Nodes (3): ContractFormPage(), NewContract(), Route

### Community 100 - "request"
Cohesion: 0.67
Nodes (3): fixtures(), headers(), request()

## Knowledge Gaps
- **600 isolated node(s):** `name`, `private`, `type`, `dev`, `dev:debug` (+595 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 750 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **29 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cancelAttempt()` connect `collectFingerprint` to `clinical.ts`?**
  _High betweenness centrality (0.218) - this node is a cross-community bridge._
- **Why does `GovBrSection()` connect `collectFingerprint` to `assinatura.$token.tsx`?**
  _High betweenness centrality (0.213) - this node is a cross-community bridge._
- **Why does `getDatabase()` connect `getDatabase` to `clinical.integration.test.ts`, `saveContract`, `storage.ts`, `generateFollowupContract`, `patients.ts`, `followups.ts`, `payments.ts`, `admin-commands.ts`, `clinical.ts`, `scheduling.ts`, `app.ts`, `createFollowup`, `catalog.ts`, `protect`, `signatures.ts`?**
  _High betweenness centrality (0.123) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _600 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `clinical.integration.test.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1001984126984127 - nodes in this community are weakly interconnected._
- **Should `external-validation.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08758503401360544 - nodes in this community are weakly interconnected._
- **Should `assinatura.$token.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._