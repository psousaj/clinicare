# Graph Report - clinicare  (2026-10-06)

## Corpus Check
- 212 files · ~148,271 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 4, .css 3, .example 1)

## Summary
- 1720 nodes · 5258 edges · 83 communities (62 shown, 21 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 48 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `88cadbb9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- db/src/index.ts
- external-validation.ts
- react
- assinatura.$token.tsx
- contract-materialization.ts
- queries.ts
- catalog.ts
- routeTree.gen.ts
- scripts
- admin-commands.ts
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
- App.test.tsx
- compilerOptions
- auth-routes.ts
- Implementation Decisions
- followups.ts
- devDependencies
- ComboForm.tsx
- signatures.ts
- compilerOptions
- Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF
- api/tsconfig.json
- Clínicare
- relational-history.ts
- -assinatura.$token.test.tsx
- Clínica de cuidados estéticos
- patients.ts
- scripts
- Button
- atendimentos.$attendanceId.tsx
- clinical.ts
- db/tsconfig.json
- Agent skills
- scheduling.ts
- app.ts
- generateFollowupContract
- relational-schema.ts
- generate-secrets.ts
- Decisão e plano: PostgreSQL + Drizzle + JSONB
- @tanstack/react-router
- Especificação: migração para PostgreSQL + Drizzle + JSONB
- api/package.json
- schemaUi.tsx
- request
- Validação de assinatura externa (GOV.BR) sem PAdES próprio
- _app.tsx
- external-signatures.integration.test.ts
- dependencies
- storage.ts
- Issue tracker: GitHub
- Domain Docs
- Persistência PostgreSQL + Drizzle + JSONB
- triage-labels.md
- Preservação incremental de PDFs com assinaturas externas
- scripts
- Investigação da validação global T7
- dialogs.tsx
- docx-types.d.ts
- DB_SCHEMA.md
- nova.tsx

## God Nodes (most connected - your core abstractions)
1. `getDatabase()` - 142 edges
2. `app` - 119 edges
3. `Button()` - 70 edges
4. `cn()` - 53 edges
5. `@tanstack/react-router` - 46 edges
6. `react` - 44 edges
7. `QueryError()` - 39 edges
8. `useApiMutation()` - 37 edges
9. `api()` - 36 edges
10. `lucide-react` - 35 edges

## Surprising Connections (you probably didn't know these)
- `Decisão` --references--> `ContractVersion`  [INFERRED]
  docs/adr/0005-autoria-docx-e-materializacao-de-contratos.md → apps/web/src/lib/schemas.ts
- `Solution` --references--> `ContractVersion`  [INFERRED]
  docs/specs/0005-autoria-docx-e-materializacao-de-contratos.md → apps/web/src/lib/schemas.ts
- `User Stories` --references--> `ContractVersion`  [INFERRED]
  docs/specs/0005-autoria-docx-e-materializacao-de-contratos.md → apps/web/src/lib/schemas.ts
- `Implementation Decisions` --references--> `Contract`  [INFERRED]
  docs/specs/0005-autoria-docx-e-materializacao-de-contratos.md → apps/web/src/lib/schemas.ts
- `Implementation Decisions` --references--> `ContractVersion`  [INFERRED]
  docs/specs/0005-autoria-docx-e-materializacao-de-contratos.md → apps/web/src/lib/schemas.ts

## Import Cycles
- 2-file cycle: `packages/db/src/index.ts -> packages/db/src/migrate.ts -> packages/db/src/index.ts`
- 2-file cycle: `packages/db/src/index.ts -> packages/db/src/seed.ts -> packages/db/src/index.ts`

## Communities (83 total, 21 thin omitted)

### Community 0 - "db/src/index.ts"
Cohesion: 0.15
Nodes (18): AppLike, assertSafeIntegrationDatabase(), integration, integrationCookies, authAccounts, AuthSession, authSessions, AuthUser (+10 more)

### Community 1 - "external-validation.ts"
Cohesion: 0.12
Nodes (32): blankReport(), bytesEqual(), certEndpoints(), CertView, checkCrl(), checkOcsp(), checkRevocation(), cmsMessageDigest() (+24 more)

### Community 2 - "react"
Cohesion: 0.11
Nodes (38): AnamnesisFormPage(), submit(), emptySchema, Props, CpfField(), AppointmentFields(), EditPatientDialog(), Field() (+30 more)

### Community 3 - "assinatura.$token.tsx"
Cohesion: 0.09
Nodes (31): CollectedFingerprint, collectFingerprint(), anySchema, GovBrSection(), acceptReturn(), cancelAttempt(), exportRevision(), importReturn() (+23 more)

### Community 4 - "contract-materialization.ts"
Cohesion: 0.10
Nodes (36): docxMetadata(), getContractDraftEditor(), invalid(), publishContractDraft(), saveContractDraft(), sha256(), uuid(), assertRequiredContext() (+28 more)

### Community 5 - "queries.ts"
Cohesion: 0.05
Nodes (80): contextDescription(), contextLabel(), CONTEXTS, ContractDraftPanel(), ContractFormPage(), ContractMetadata, Props, PendingRequirements() (+72 more)

### Community 6 - "catalog.ts"
Cohesion: 0.11
Nodes (29): addAnamnesisVersion(), comboResponse(), comboValid(), conflict(), consumeContractVersionPdfUploadIntent(), contractResponse(), createProcedure(), finalizeContractVersionPdf() (+21 more)

### Community 7 - "routeTree.gen.ts"
Cohesion: 0.05
Nodes (37): Route, AppAgendaRoute, AppContratosContractIdRoute, AppContratosIndexRoute, AppContratosNovoRoute, AppFinanceiroRoute, AppFormulariosAnamneseAnamnesisIdRoute, AppFormulariosAnamneseIndexRoute (+29 more)

### Community 8 - "scripts"
Cohesion: 0.05
Nodes (36): devDependencies, turbo, engines, node, name, packageManager, private, scripts (+28 more)

### Community 9 - "admin-commands.ts"
Cohesion: 0.18
Nodes (13): administratorByEmail(), BOOTSTRAP_ENV_KEYS, bootstrapConfigFromEnv(), changeClinicAdministratorEmail(), createBetterAuthClinicAdministrator(), deactivateTenant(), normalizeEmail(), provisionClinic() (+5 more)

### Community 10 - "dependencies"
Cohesion: 0.06
Nodes (32): dependencies, class-variance-authority, clsx, date-fns, @fingerprintjs/fingerprintjs, @fullcalendar/core, @fullcalendar/interaction, @fullcalendar/react (+24 more)

### Community 11 - "external-mutations.integration.test.ts"
Cohesion: 0.11
Nodes (29): request(), deleteAppliedDocument(), placement, integrationHeaders(), placement, request(), request(), placement (+21 more)

### Community 12 - "Assinatura eletrônica própria — especificação completa"
Cohesion: 0.09
Nodes (22): 10. Selo da plataforma e gestão de chaves, 11. Pacote exportável e verificação independente, 12. Recuperação, revogação e tempo, 13. Limites de confiança, 14. Critérios de aceitação, 1. Objetivo e decisões de produto, 2. O que o sistema pretende demonstrar, 3.1. Fingerprint obrigatório desde o MVP (+14 more)

### Community 13 - "Assinatura eletrônica própria — MVP"
Cohesion: 0.09
Nodes (22): 10. Histórico, armazenamento e download, 11. Estrutura preparada para evolução, 12. O que fica fora deste MVP, 13. Critérios para considerar o MVP pronto, 14. Limite da evolução futura, 1. Objetivo, 2. Fluxo oficial, também mantido na produção, 3.1. Fingerprint obrigatório desde o MVP (+14 more)

### Community 14 - "web/package.json"
Cohesion: 0.08
Nodes (23): typescript, name, private, type, CalendarEntry, class-variance-authority, clsx, date-fns (+15 more)

### Community 15 - "Especificação: MVP para clínicas pequenas de estética"
Cohesion: 0.10
Nodes (18): ADR 0001: Stack da aplicação, Alternativas consideradas, Consequências, Contexto, Decisão, ADR 0002: Controle de acesso para dados clínicos no MVP, Alternativas consideradas, Consequências (+10 more)

### Community 16 - "db/package.json"
Cohesion: 0.07
Nodes (33): dependencies, drizzle-orm, pg, devDependencies, drizzle-kit, @types/bun, @types/pg, typescript (+25 more)

### Community 17 - "tasks"
Cohesion: 0.08
Nodes (23): dependsOn, inputs, outputs, cache, cache, persistent, env, inputs (+15 more)

### Community 18 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 19 - "FileRoutesByPath"
Cohesion: 0.09
Nodes (22): Route, Route, Route, Route, Route, Route, Route, Route (+14 more)

### Community 21 - "App.test.tsx"
Cohesion: 0.19
Nodes (7): Handler, marina, @noble/hashes, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, vitest

### Community 22 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+8 more)

### Community 23 - "auth-routes.ts"
Cohesion: 0.20
Nodes (10): AuthInstance, getTrustedOrigins(), getAuth(), authHandler(), getClinicSession(), requireClinicSession(), SESSION_DURATION_SECONDS, authSchema (+2 more)

### Community 25 - "Implementation Decisions"
Cohesion: 0.09
Nodes (22): Assinatura local, Concorrência, idempotência e storage, Especificação — Assinatura eletrônica própria no MVP, Estados e conclusão, Fingerprint e evidências, Fonte, PDF e revisões, Further Notes, GOV.BR e assinaturas externas (+14 more)

### Community 26 - "followups.ts"
Cohesion: 0.09
Nodes (44): headers(), request(), schema, tenantIds, fixture(), headers(), post(), request() (+36 more)

### Community 27 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, jsdom, @tanstack/router-plugin, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, @types/react, @types/react-dom (+2 more)

### Community 28 - "ComboForm.tsx"
Cohesion: 0.15
Nodes (22): ComboFormPage(), day(), ProcedurePicker(), Column(), DatePicker(), hours, minutes, PickerProps (+14 more)

### Community 29 - "signatures.ts"
Cohesion: 0.06
Nodes (80): loadTrustedRootFiles(), loadTrustedRootsFromEnv(), createIncrementalSignaturePdf(), normalizedPlacementToPdfRect(), PdfPlacement, PdfRect, sha256(), validatePlacement() (+72 more)

### Community 30 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, noEmit, skipLibCheck, strict (+1 more)

### Community 31 - "Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF"
Cohesion: 0.14
Nodes (14): Contract, ContractVersion, 0005. Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos, Consequências, Contexto, Decisão, Further Notes, Implementation Decisions (+6 more)

### Community 32 - "api/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, allowImportingTsExtensions, types, extends, include, ../../tsconfig.json

### Community 33 - "Clínicare"
Cohesion: 0.29
Nodes (6): Clínicare, Desenvolvimento sem Docker, Estrutura do monorepo, Rodar localmente via Docker (caminho recomendado), Stack, Verificações

### Community 34 - "relational-history.ts"
Cohesion: 0.13
Nodes (25): addAnamnesisNote(), noteValue(), protectedFollowupValue(), protect(), conflict(), createPayment(), deletePayment(), invalid() (+17 more)

### Community 35 - "-assinatura.$token.test.tsx"
Cohesion: 0.15
Nodes (10): renderAt(), queryClient, router, createAppRouter(), createQueryClient(), Register, @tanstack/react-router, renderPage() (+2 more)

### Community 36 - "Clínica de cuidados estéticos"
Cohesion: 0.20
Nodes (9): Attendance, Atendimento estético, Clínica de cuidados estéticos, Dados e ciclo de protótipo, Documentos e coleta, Jornada do paciente, Objetivo do produto, Organização da clínica (+1 more)

### Community 37 - "patients.ts"
Cohesion: 0.10
Nodes (28): protectedValue(), createPatient(), DEFAULT_TENANT_ID, encrypted(), encryptedColumns(), ensureTenant(), listPatients(), PatientInput (+20 more)

### Community 38 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 39 - "Button"
Cohesion: 0.12
Nodes (40): AppointmentDetails(), dateLong, Props, Row(), time, FormDialog(), FormDialogProps, Button() (+32 more)

### Community 40 - "atendimentos.$attendanceId.tsx"
Cohesion: 0.16
Nodes (14): allowed, AttendancePhotos(), Phase, phases, Props, SchemaForm(), photoPhases, attendanceQuery() (+6 more)

### Community 41 - "clinical.ts"
Cohesion: 0.11
Nodes (36): appliedShape(), byToken(), claimCleanupJob(), cleanupLease(), CleanupResult, CleanupStatus, clearDraft, createAnamnesisRequest() (+28 more)

### Community 42 - "db/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, types, extends, include, ../../tsconfig.json

### Community 43 - "Agent skills"
Cohesion: 0.29
Nodes (6): Agent skills, Domain docs, graphify, Issue tracker, This is NOT the Turborepo you know, Triage labels

### Community 44 - "scheduling.ts"
Cohesion: 0.15
Nodes (34): activeAppointmentStatuses, addAttendancePhoto(), appointmentResponse(), attendanceResponse(), attendanceShape(), cancelAttendance(), confirmAppointment(), conflict() (+26 more)

### Community 45 - "app.ts"
Cohesion: 0.10
Nodes (48): BRAZILIAN_STATES, getProfessionalProfile(), REGISTRATION_TYPES, updateInitialPasswordChoice(), updateProfessionalProfile(), seedConfiguredAdministrator(), app, appointmentStatusLabel (+40 more)

### Community 46 - "generateFollowupContract"
Cohesion: 0.24
Nodes (10): buildContext(), contextForVersion(), createInitialSignatureProcesses(), dbRows(), formatCivilDate(), generateFollowupContract(), invalid(), retryFollowupContract() (+2 more)

### Community 47 - "relational-schema.ts"
Cohesion: 0.06
Nodes (34): appliedAnamnesisNotes, appointmentItems, attendancePhotos, catalogTimestamps, contractVersionPdfUploadIntents, NewRelationalPatient, NewRelationalProcedure, NewTenant (+26 more)

### Community 49 - "Decisão e plano: PostgreSQL + Drizzle + JSONB"
Cohesion: 0.09
Nodes (21): 10. Go/no-go para implementação, 1. Conclusão, 2. Decisões de domínio confirmadas, 3. Modelo de domínio e estados, 4. Blueprint relacional inicial, 5. Matriz de invariantes, 6. Fronteiras transacionais, 7. Reaproveitamento do Git (+13 more)

### Community 50 - "@tanstack/react-router"
Cohesion: 0.06
Nodes (72): AttendanceRecordForm(), CalendarView(), ContractSignatureHistory(), NewFollowupDialog(), FollowupCard(), offerLabel, matchesPatient(), PatientRow() (+64 more)

### Community 51 - "Especificação: migração para PostgreSQL + Drizzle + JSONB"
Cohesion: 0.13
Nodes (14): API, frontend e operações de produto, Catálogo, planos e snapshots, Dados protegidos, Especificação: migração para PostgreSQL + Drizzle + JSONB, Further Notes, Implementation Decisions, Integridade e concorrência, Máquina de estados (+6 more)

### Community 52 - "api/package.json"
Cohesion: 0.12
Nodes (16): devDependencies, @types/bun, typescript, drizzle-orm, @types/bun, typescript, name, private (+8 more)

### Community 53 - "schemaUi.tsx"
Cohesion: 0.13
Nodes (24): CPF_PATTERN, DEFAULT_OPTIONS, FieldKind, fieldKinds, formatCpf(), formatDigits(), formatPhone(), FormSchema (+16 more)

### Community 55 - "Validação de assinatura externa (GOV.BR) sem PAdES próprio"
Cohesion: 0.40
Nodes (4): Resultados, Revalidação em mutações posteriores (Issue #27), Validação de assinatura externa (GOV.BR) sem PAdES próprio, Verificações executadas (todas genuínas, nenhuma presumida)

### Community 56 - "_app.tsx"
Cohesion: 0.26
Nodes (14): Sheet(), SheetClose(), SheetContent(), SheetDescription(), SheetHeader(), SheetOverlay(), SheetTitle(), SheetTrigger() (+6 more)

### Community 57 - "external-signatures.integration.test.ts"
Cohesion: 0.17
Nodes (14): placement, request(), ADR-0004, buildSignedReturnPdf(), buildUnparsableCmsReturn(), createTestCa(), ensureOpensslAvailable(), issueDatedTestSigner() (+6 more)

### Community 58 - "dependencies"
Cohesion: 0.14
Nodes (14): dependencies, asn1js, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, better-auth, @better-auth/drizzle-adapter, @clinicare/db, docxtemplater (+6 more)

### Community 59 - "storage.ts"
Cohesion: 0.28
Nodes (6): bucket, resolveStorageConfig(), StorageEnv, storage, config, uploadObjectBytesForDocument()

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

### Community 79 - "dialogs.tsx"
Cohesion: 0.10
Nodes (30): AppointmentDialog(), localDate(), localTime(), minutesBetween(), OfferFields(), PaymentDialog(), PlannedItem, Selection (+22 more)

### Community 88 - "nova.tsx"
Cohesion: 0.67
Nodes (3): useCreateAnamnesis(), NewAnamnesis(), Route

## Knowledge Gaps
- **550 isolated node(s):** `name`, `private`, `type`, `dev`, `dev:debug` (+545 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 652 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getDatabase()` connect `app.ts` to `db/src/index.ts`, `relational-history.ts`, `contract-materialization.ts`, `patients.ts`, `catalog.ts`, `admin-commands.ts`, `clinical.ts`, `external-mutations.integration.test.ts`, `scheduling.ts`, `generateFollowupContract`, `db/package.json`, `auth-routes.ts`, `external-signatures.integration.test.ts`, `followups.ts`, `signatures.ts`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `web/package.json`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `Button()` connect `Button` to `react`, `assinatura.$token.tsx`, `queries.ts`, `atendimentos.$attendanceId.tsx`, `dialogs.tsx`, `@tanstack/react-router`, `_app.tsx`, `ComboForm.tsx`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _550 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `external-validation.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12380952380952381 - nodes in this community are weakly interconnected._
- **Should `react` be split into smaller, more focused modules?**
  _Cohesion score 0.11131276467029642 - nodes in this community are weakly interconnected._
- **Should `assinatura.$token.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0873015873015873 - nodes in this community are weakly interconnected._