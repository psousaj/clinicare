# Graph Report - clinicare  (2026-10-04)

## Corpus Check
- 166 files · ~106,265 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: (none) 4, .example 3, .css 3)

## Summary
- 1360 nodes · 3796 edges · 79 communities (59 shown, 20 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 40 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `790d50f5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- atendimentos.$attendanceId.tsx
- headers
- Button
- schemaUi.tsx
- _app/index.tsx
- queries.ts
- catalog.ts
- routeTree.gen.ts
- scripts
- admin-commands.ts
- dependencies
- followups.ts
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
- app.ts
- ContractFormPage.tsx
- Implementation Decisions
- clinical.integration.test.ts
- devDependencies
- @tanstack/react-router
- issueSignatureToken
- compilerOptions
- payments.ts
- api/tsconfig.json
- Clínicare
- db/src/index.ts
- test-setup.ts
- Clínica de cuidados estéticos
- patients.ts
- scripts
- VersionsDialog.tsx
- storage.ts
- db/tsconfig.json
- Agent skills
- scheduling.ts
- getDatabase
- format.ts
- relational-schema.ts
- scheduling.integration.test.ts
- Decisão e plano: PostgreSQL + Drizzle + JSONB
- dialogs.tsx
- Especificação: migração para PostgreSQL + Drizzle + JSONB
- api/package.json
- SchemaEditor.tsx
- ProcedureForm.tsx
- pacientes/index.tsx
- _app.tsx
- dependencies
- scripts
- auth-routes.ts
- Issue tracker: GitHub
- Domain Docs
- Persistência PostgreSQL + Drizzle + JSONB
- triage-labels.md
- Preservação incremental de PDFs com assinaturas externas
- relationship.ts
- auth.ts

## God Nodes (most connected - your core abstractions)
1. `getDatabase()` - 112 edges
2. `app` - 87 edges
3. `Button()` - 59 edges
4. `cn()` - 53 edges
5. `@tanstack/react-router` - 44 edges
6. `react` - 41 edges
7. `QueryError()` - 37 edges
8. `lucide-react` - 34 edges
9. `@tanstack/react-query` - 30 edges
10. `useApiMutation()` - 30 edges

## Surprising Connections (you probably didn't know these)
- `Jornada do paciente` --references--> `Attendance`  [INFERRED]
  CONTEXT.md → apps/web/src/lib/schemas.ts
- `deactivateTenant()` --calls--> `getDatabase()`  [EXTRACTED]
  apps/api/src/admin-commands.ts → packages/db/src/index.ts
- `reactivateTenant()` --calls--> `getDatabase()`  [EXTRACTED]
  apps/api/src/admin-commands.ts → packages/db/src/index.ts
- `updateInitialPasswordChoice()` --calls--> `getDatabase()`  [EXTRACTED]
  apps/api/src/account-routes.ts → packages/db/src/index.ts
- `provisionClinic()` --calls--> `getDatabase()`  [EXTRACTED]
  apps/api/src/admin-commands.ts → packages/db/src/index.ts

## Import Cycles
- 2-file cycle: `packages/db/src/index.ts -> packages/db/src/migrate.ts -> packages/db/src/index.ts`
- 2-file cycle: `packages/db/src/index.ts -> packages/db/src/seed.ts -> packages/db/src/index.ts`

## Communities (79 total, 20 thin omitted)

### Community 0 - "atendimentos.$attendanceId.tsx"
Cohesion: 0.14
Nodes (18): allowed, AttendancePhotos(), Phase, phases, AttendanceRecordForm(), PendingRequirements(), Props, SchemaForm() (+10 more)

### Community 2 - "Button"
Cohesion: 0.11
Nodes (40): AppointmentDetails(), dateLong, Props, Row(), time, ProcedurePicker(), FormDialog(), FormDialogProps (+32 more)

### Community 3 - "schemaUi.tsx"
Cohesion: 0.25
Nodes (14): formatCpf(), formatDigits(), formatPhone(), isValidCpf(), kindOf(), customValidate(), DateWidget(), MaskedWidget() (+6 more)

### Community 4 - "_app/index.tsx"
Cohesion: 0.23
Nodes (13): CalendarView(), statusLabel(), statusTone(), appointmentsQuery, attendancesQuery, signaturePendingQuery, useConfirmAppointment(), useNoShowAppointment() (+5 more)

### Community 5 - "queries.ts"
Cohesion: 0.06
Nodes (60): api(), RequestOptions, withIds(), everything, keys, list(), MutationConfig, patientRefresh (+52 more)

### Community 6 - "catalog.ts"
Cohesion: 0.10
Nodes (33): addAnamnesisVersion(), addContractVersion(), addContractVersionTx(), catalogTenant(), comboResponse(), comboValid(), conflict(), consumeContractVersionPdfUploadIntent() (+25 more)

### Community 7 - "routeTree.gen.ts"
Cohesion: 0.06
Nodes (36): Route, AppAgendaRoute, AppContratosContractIdRoute, AppContratosIndexRoute, AppContratosNovoRoute, AppFinanceiroRoute, AppFormulariosAnamneseAnamnesisIdRoute, AppFormulariosAnamneseIndexRoute (+28 more)

### Community 8 - "scripts"
Cohesion: 0.06
Nodes (35): devDependencies, turbo, engines, node, name, packageManager, private, scripts (+27 more)

### Community 9 - "admin-commands.ts"
Cohesion: 0.26
Nodes (12): administratorByEmail(), changeClinicAdministratorEmail(), createBetterAuthClinicAdministrator(), deactivateTenant(), normalizeEmail(), provisionClinic(), ProvisionClinicInput, reactivateTenant() (+4 more)

### Community 10 - "dependencies"
Cohesion: 0.07
Nodes (27): dependencies, class-variance-authority, clsx, date-fns, @fullcalendar/core, @fullcalendar/interaction, @fullcalendar/react, @fullcalendar/timegrid (+19 more)

### Community 11 - "followups.ts"
Cohesion: 0.08
Nodes (34): schema, tenantIds, hashToken(), idShape(), invalid(), issueInitialTokens(), latest(), notFound() (+26 more)

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
Nodes (27): dependencies, drizzle-orm, pg, devDependencies, drizzle-kit, @types/bun, @types/pg, typescript (+19 more)

### Community 17 - "tasks"
Cohesion: 0.09
Nodes (21): dependsOn, inputs, outputs, cache, cache, persistent, persistent, cache (+13 more)

### Community 18 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 19 - "FileRoutesByPath"
Cohesion: 0.11
Nodes (19): Route, Route, Route, Route, Route, Route, Route, Route (+11 more)

### Community 21 - "App.test.tsx"
Cohesion: 0.15
Nodes (13): Handler, marina, renderAt(), queryClient, router, createAppRouter(), createQueryClient(), Register (+5 more)

### Community 22 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+8 more)

### Community 23 - "app.ts"
Cohesion: 0.13
Nodes (30): updateInitialPasswordChoice(), app, appointmentStatusLabel, authTenant(), expiry(), fail(), handleError(), isRecord() (+22 more)

### Community 24 - "ContractFormPage.tsx"
Cohesion: 0.16
Nodes (13): ContractData, ContractFormPage(), Props, ContractVersionsButton(), ApiError, contractsQuery, useCreateContract(), useUpdateContract() (+5 more)

### Community 25 - "Implementation Decisions"
Cohesion: 0.09
Nodes (22): Assinatura local, Concorrência, idempotência e storage, Especificação — Assinatura eletrônica própria no MVP, Estados e conclusão, Fingerprint e evidências, Fonte, PDF e revisões, Further Notes, GOV.BR e assinaturas externas (+14 more)

### Community 26 - "clinical.integration.test.ts"
Cohesion: 0.15
Nodes (11): fixture(), headers(), post(), request(), integrationHeaders(), storage, appliedAnamnesisNotes, appliedDocumentRevisions (+3 more)

### Community 27 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, jsdom, @tanstack/router-plugin, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, @types/react, @types/react-dom (+2 more)

### Community 28 - "@tanstack/react-router"
Cohesion: 0.11
Nodes (37): NewFollowupDialog(), FollowupCard(), offerLabel, Body(), Entry, kinds, PatientTimeline(), QueryError() (+29 more)

### Community 29 - "issueSignatureToken"
Cohesion: 0.36
Nodes (8): expiry(), hashToken(), invalid(), issueSignatureToken(), lockedTokenContext(), terminalFollowup(), tokenParticipant(), tokenResult()

### Community 30 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, noEmit, skipLibCheck, strict (+1 more)

### Community 31 - "payments.ts"
Cohesion: 0.26
Nodes (12): conflict(), createPayment(), deletePayment(), invalid(), listPayments(), notFound(), PaymentInput, paymentResponse() (+4 more)

### Community 32 - "api/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, allowImportingTsExtensions, types, extends, include, ../../tsconfig.json

### Community 33 - "Clínicare"
Cohesion: 0.29
Nodes (6): Clínicare, Desenvolvimento sem Docker, Estrutura do monorepo, Rodar localmente via Docker (caminho recomendado), Stack, Verificações

### Community 34 - "db/src/index.ts"
Cohesion: 0.13
Nodes (22): AppLike, assertSafeIntegrationDatabase(), cleanupIntegrationClinics(), integration, IntegrationClinic, integrationCookies, provisionIntegrationClinic(), authAccounts (+14 more)

### Community 36 - "Clínica de cuidados estéticos"
Cohesion: 0.20
Nodes (9): Attendance, Atendimento estético, Clínica de cuidados estéticos, Dados e ciclo de protótipo, Documentos e coleta, Jornada do paciente, Objetivo do produto, Organização da clínica (+1 more)

### Community 37 - "patients.ts"
Cohesion: 0.10
Nodes (27): createPatient(), DEFAULT_TENANT_ID, encrypted(), encryptedColumns(), ensureTenant(), listPatients(), PatientInput, patientResponse() (+19 more)

### Community 38 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 39 - "VersionsDialog.tsx"
Cohesion: 0.13
Nodes (21): AnamnesisFormPage(), emptySchema, Props, Props, Version, VersionsButton(), VersionsTrigger(), anamnesesQuery (+13 more)

### Community 40 - "storage.ts"
Cohesion: 0.43
Nodes (5): bucket, copyVerifiedPdfObject(), deleteObject(), headObject(), verifyPdfObject()

### Community 42 - "db/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, types, extends, include, ../../tsconfig.json

### Community 43 - "Agent skills"
Cohesion: 0.29
Nodes (6): Agent skills, Domain docs, graphify, Issue tracker, This is NOT the Turborepo you know, Triage labels

### Community 44 - "scheduling.ts"
Cohesion: 0.16
Nodes (35): activeAppointmentStatuses, addAttendancePhoto(), appointmentResponse(), attendanceResponse(), attendanceShape(), cancelAttendance(), confirmAppointment(), conflict() (+27 more)

### Community 45 - "getDatabase"
Cohesion: 0.11
Nodes (47): addAnamnesisNote(), answerAppliedAnamnesis(), appliedShape(), byToken(), claimCleanupJob(), cleanupLease(), CleanupResult, CleanupStatus (+39 more)

### Community 46 - "format.ts"
Cohesion: 0.30
Nodes (10): appointmentStatus, duration(), monthLabel(), offerKinds, shortDate(), relationshipQuery(), Card(), Chart() (+2 more)

### Community 47 - "relational-schema.ts"
Cohesion: 0.07
Nodes (27): catalogTimestamps, contractVersionPdfUploadIntents, NewRelationalPatient, NewRelationalProcedure, NewTenant, paymentRelations, RelationalAnamnesis, RelationalAnamnesisVersion (+19 more)

### Community 48 - "scheduling.integration.test.ts"
Cohesion: 0.12
Nodes (20): idShape(), response(), fixture(), headers, patch(), post(), request(), reserve() (+12 more)

### Community 49 - "Decisão e plano: PostgreSQL + Drizzle + JSONB"
Cohesion: 0.09
Nodes (21): 10. Go/no-go para implementação, 1. Conclusão, 2. Decisões de domínio confirmadas, 3. Modelo de domínio e estados, 4. Blueprint relacional inicial, 5. Matriz de invariantes, 6. Fronteiras transacionais, 7. Reaproveitamento do Git (+13 more)

### Community 50 - "dialogs.tsx"
Cohesion: 0.18
Nodes (21): AppointmentDialog(), AppointmentFields(), localDate(), localTime(), minutesBetween(), OfferFields(), PaymentDialog(), PlannedItem (+13 more)

### Community 51 - "Especificação: migração para PostgreSQL + Drizzle + JSONB"
Cohesion: 0.13
Nodes (14): API, frontend e operações de produto, Catálogo, planos e snapshots, Dados protegidos, Especificação: migração para PostgreSQL + Drizzle + JSONB, Further Notes, Implementation Decisions, Integridade e concorrência, Máquina de estados (+6 more)

### Community 52 - "api/package.json"
Cohesion: 0.14
Nodes (13): devDependencies, @types/bun, typescript, drizzle-orm, @types/bun, typescript, name, private (+5 more)

### Community 53 - "SchemaEditor.tsx"
Cohesion: 0.12
Nodes (24): submit(), Field, FieldPatch, identifierFor(), newSalt(), saltOf(), Schema, SchemaEditor() (+16 more)

### Community 54 - "ProcedureForm.tsx"
Cohesion: 0.09
Nodes (31): ComboFormPage(), day(), FormPage(), emptySchema, ProcedureFormPage(), Checkbox(), Label(), Textarea() (+23 more)

### Community 55 - "pacientes/index.tsx"
Cohesion: 0.48
Nodes (5): matchesPatient(), PatientRow(), Patient, Patients(), Route

### Community 56 - "_app.tsx"
Cohesion: 0.29
Nodes (13): Sheet(), SheetClose(), SheetContent(), SheetDescription(), SheetHeader(), SheetOverlay(), SheetTitle(), SheetTrigger() (+5 more)

### Community 57 - "dependencies"
Cohesion: 0.22
Nodes (9): dependencies, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, better-auth, @better-auth/drizzle-adapter, @clinicare/db, drizzle-orm, hono (+1 more)

### Community 58 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, dev:debug, test, test:integration, typecheck

### Community 59 - "auth-routes.ts"
Cohesion: 0.48
Nodes (4): getClinicSession(), requireClinicSession(), authUsers, hono

### Community 60 - "Issue tracker: GitHub"
Cohesion: 0.29
Nodes (6): Conventions, Issue tracker: GitHub, Pull requests as a triage surface, Wayfinding operations, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 61 - "Domain Docs"
Cohesion: 0.33
Nodes (5): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary

### Community 79 - "auth.ts"
Cohesion: 0.29
Nodes (5): AuthInstance, SESSION_DURATION_SECONDS, authSchema, better-auth, @better-auth/drizzle-adapter

## Knowledge Gaps
- **470 isolated node(s):** `name`, `private`, `type`, `dev`, `dev:debug` (+465 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 547 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getDatabase()` connect `getDatabase` to `db/src/index.ts`, `patients.ts`, `catalog.ts`, `admin-commands.ts`, `followups.ts`, `scheduling.ts`, `auth.ts`, `scheduling.integration.test.ts`, `app.ts`, `clinical.integration.test.ts`, `auth-routes.ts`, `issueSignatureToken`, `payments.ts`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `@tanstack/react-router` connect `@tanstack/react-router` to `atendimentos.$attendanceId.tsx`, `Button`, `_app/index.tsx`, `queries.ts`, `VersionsDialog.tsx`, `web/package.json`, `format.ts`, `dialogs.tsx`, `App.test.tsx`, `ProcedureForm.tsx`, `pacientes/index.tsx`, `ContractFormPage.tsx`, `_app.tsx`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `react` connect `Button` to `atendimentos.$attendanceId.tsx`, `_app/index.tsx`, `queries.ts`, `VersionsDialog.tsx`, `web/package.json`, `dialogs.tsx`, `SchemaEditor.tsx`, `ProcedureForm.tsx`, `App.test.tsx`, `ContractFormPage.tsx`, `_app.tsx`, `@tanstack/react-router`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _470 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `atendimentos.$attendanceId.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._
- **Should `Button` be split into smaller, more focused modules?**
  _Cohesion score 0.11242937853107345 - nodes in this community are weakly interconnected._
- **Should `queries.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05698778833107191 - nodes in this community are weakly interconnected._