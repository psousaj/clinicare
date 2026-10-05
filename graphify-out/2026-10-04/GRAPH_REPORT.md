# Graph Report - clinicare  (2026-10-04)

## Corpus Check
- 165 files · ~105,990 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: (none) 4, .example 3, .css 3)

## Summary
- 1356 nodes · 3781 edges · 81 communities (60 shown, 21 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 40 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `790d50f5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Button
- catalog.integration.test.ts
- cn
- schemaUi.tsx
- queries.ts
- schemas.ts
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
- formulario.$token.tsx
- Implementation Decisions
- AppointmentDetails.tsx
- devDependencies
- @tanstack/react-router
- CalendarView.tsx
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
- procedimentos/index.tsx
- db/tsconfig.json
- Agent skills
- scheduling.ts
- getDatabase
- ComboForm.tsx
- relational-schema.ts
- scheduling.integration.test.ts
- Decisão e plano: PostgreSQL + Drizzle + JSONB
- $patientId/index.tsx
- Especificação: migração para PostgreSQL + Drizzle + JSONB
- api/package.json
- SchemaEditor.tsx
- dialogs.tsx
- Route
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
- auth-schema.ts
- nova.tsx

## God Nodes (most connected - your core abstractions)
1. `getDatabase()` - 110 edges
2. `app` - 86 edges
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

## Communities (81 total, 21 thin omitted)

### Community 0 - "Button"
Cohesion: 0.14
Nodes (25): emptySchema, Props, allowed, AttendancePhotos(), Phase, phases, AttendanceRecordForm(), ContractData (+17 more)

### Community 1 - "catalog.integration.test.ts"
Cohesion: 0.17
Nodes (8): headers(), request(), schema, tenantIds, anamnesisProcedures, anamnesisVersions, procedures, procedureVersions

### Community 2 - "cn"
Cohesion: 0.14
Nodes (25): AppointmentFields(), OfferFields(), Column(), DatePicker(), hours, minutes, PickerProps, TimePicker() (+17 more)

### Community 3 - "schemaUi.tsx"
Cohesion: 0.11
Nodes (26): Props, CPF_PATTERN, DEFAULT_OPTIONS, FieldKind, fieldKinds, formatCpf(), formatDigits(), formatPhone() (+18 more)

### Community 4 - "queries.ts"
Cohesion: 0.15
Nodes (32): api(), attendanceQuery(), everything, keys, list(), MutationConfig, patientRefresh, post() (+24 more)

### Community 5 - "schemas.ts"
Cohesion: 0.06
Nodes (33): anamnesisSchema, anamnesisVersionSchema, anySchema, Appointment, appointmentItemSchema, appointmentSchema, AttendancePhoto, attendancePhotoSchema (+25 more)

### Community 6 - "catalog.ts"
Cohesion: 0.10
Nodes (33): addAnamnesisVersion(), addContractVersion(), addContractVersionTx(), comboResponse(), comboValid(), conflict(), consumeContractVersionPdfUploadIntent(), contractResponse() (+25 more)

### Community 7 - "routeTree.gen.ts"
Cohesion: 0.06
Nodes (34): AppAgendaRoute, AppContratosContractIdRoute, AppContratosIndexRoute, AppContratosNovoRoute, AppFinanceiroRoute, AppFormulariosAnamneseAnamnesisIdRoute, AppFormulariosAnamneseIndexRoute, AppFormulariosAnamneseNovaRoute (+26 more)

### Community 8 - "scripts"
Cohesion: 0.06
Nodes (35): devDependencies, turbo, engines, node, name, packageManager, private, scripts (+27 more)

### Community 9 - "admin-commands.ts"
Cohesion: 0.25
Nodes (11): administratorByEmail(), changeClinicAdministratorEmail(), createBetterAuthClinicAdministrator(), deactivateTenant(), normalizeEmail(), provisionClinic(), ProvisionClinicInput, reactivateTenant() (+3 more)

### Community 10 - "dependencies"
Cohesion: 0.07
Nodes (27): dependencies, class-variance-authority, clsx, date-fns, @fullcalendar/core, @fullcalendar/interaction, @fullcalendar/react, @fullcalendar/timegrid (+19 more)

### Community 11 - "followups.ts"
Cohesion: 0.08
Nodes (33): hashToken(), idShape(), invalid(), issueInitialTokens(), latest(), notFound(), Offer, offerForms() (+25 more)

### Community 12 - "Assinatura eletrônica própria — especificação completa"
Cohesion: 0.09
Nodes (22): 10. Selo da plataforma e gestão de chaves, 11. Pacote exportável e verificação independente, 12. Recuperação, revogação e tempo, 13. Limites de confiança, 14. Critérios de aceitação, 1. Objetivo e decisões de produto, 2. O que o sistema pretende demonstrar, 3.1. Fingerprint obrigatório desde o MVP (+14 more)

### Community 13 - "Assinatura eletrônica própria — MVP"
Cohesion: 0.09
Nodes (22): 10. Histórico, armazenamento e download, 11. Estrutura preparada para evolução, 12. O que fica fora deste MVP, 13. Critérios para considerar o MVP pronto, 14. Limite da evolução futura, 1. Objetivo, 2. Fluxo oficial, também mantido na produção, 3.1. Fingerprint obrigatório desde o MVP (+14 more)

### Community 14 - "web/package.json"
Cohesion: 0.10
Nodes (20): typescript, name, private, type, class-variance-authority, clsx, date-fns, jsdom (+12 more)

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
Cohesion: 0.12
Nodes (33): app, appointmentStatusLabel, authTenant(), expiry(), fail(), handleError(), isRecord(), authHandler() (+25 more)

### Community 24 - "formulario.$token.tsx"
Cohesion: 0.43
Nodes (5): publicFormQuery(), useSaveDraft(), AnamnesisForm(), PublicAnamnesis(), Route

### Community 25 - "Implementation Decisions"
Cohesion: 0.09
Nodes (22): Assinatura local, Concorrência, idempotência e storage, Especificação — Assinatura eletrônica própria no MVP, Estados e conclusão, Fingerprint e evidências, Fonte, PDF e revisões, Further Notes, GOV.BR e assinaturas externas (+14 more)

### Community 26 - "AppointmentDetails.tsx"
Cohesion: 0.22
Nodes (17): AppointmentDetails(), dateLong, Props, Row(), time, FormDialog(), FormDialogProps, Dialog() (+9 more)

### Community 27 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, jsdom, @tanstack/router-plugin, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, @types/react, @types/react-dom (+2 more)

### Community 28 - "@tanstack/react-router"
Cohesion: 0.10
Nodes (37): CalendarView(), matchesPatient(), PatientRow(), QueryError(), duration(), monthLabel(), shortDate(), statusLabel() (+29 more)

### Community 29 - "CalendarView.tsx"
Cohesion: 0.25
Nodes (5): CalendarEntry, @fullcalendar/core, @fullcalendar/interaction, @fullcalendar/react, @fullcalendar/timegrid

### Community 30 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, noEmit, skipLibCheck, strict (+1 more)

### Community 31 - "payments.ts"
Cohesion: 0.12
Nodes (31): addAnamnesisNote(), noteValue(), protect(), encrypted(), conflict(), createPayment(), deletePayment(), invalid() (+23 more)

### Community 32 - "api/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, allowImportingTsExtensions, types, extends, include, ../../tsconfig.json

### Community 33 - "Clínicare"
Cohesion: 0.29
Nodes (6): Clínicare, Desenvolvimento sem Docker, Estrutura do monorepo, Rodar localmente via Docker (caminho recomendado), Stack, Verificações

### Community 34 - "db/src/index.ts"
Cohesion: 0.17
Nodes (17): AppLike, assertSafeIntegrationDatabase(), cleanupIntegrationClinics(), integration, IntegrationClinic, integrationCookies, provisionIntegrationClinic(), closeDatabase() (+9 more)

### Community 36 - "Clínica de cuidados estéticos"
Cohesion: 0.20
Nodes (9): Attendance, Atendimento estético, Clínica de cuidados estéticos, Dados e ciclo de protótipo, Documentos e coleta, Jornada do paciente, Objetivo do produto, Organização da clínica (+1 more)

### Community 37 - "patients.ts"
Cohesion: 0.12
Nodes (18): createPatient(), DEFAULT_TENANT_ID, encryptedColumns(), ensureTenant(), listPatients(), PatientInput, patientResponse(), ProtectedField (+10 more)

### Community 38 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 39 - "VersionsDialog.tsx"
Cohesion: 0.15
Nodes (24): ContractVersionsButton(), Props, Version, VersionsButton(), VersionsTrigger(), anamnesesQuery, combosQuery, contractsQuery (+16 more)

### Community 40 - "procedimentos/index.tsx"
Cohesion: 0.25
Nodes (9): RequestOptions, withIds(), useUpdateCombo(), useUpdateProcedure(), Combo, Catalog(), comboStatus(), utcDate() (+1 more)

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
Cohesion: 0.13
Nodes (36): answerAppliedAnamnesis(), appliedShape(), byToken(), claimCleanupJob(), CleanupResult, CleanupStatus, clearDraft, createAnamnesisRequest() (+28 more)

### Community 46 - "ComboForm.tsx"
Cohesion: 0.19
Nodes (17): ComboFormPage(), day(), ProcedurePicker(), PaymentDialog(), FollowupCard(), offerLabel, StatusBadge(), tones (+9 more)

### Community 47 - "relational-schema.ts"
Cohesion: 0.05
Nodes (39): fixture(), headers(), post(), request(), integrationHeaders(), storage, anamneses, appliedAnamnesisNotes (+31 more)

### Community 48 - "scheduling.integration.test.ts"
Cohesion: 0.12
Nodes (19): idShape(), response(), fixture(), headers, patch(), post(), request(), reserve() (+11 more)

### Community 49 - "Decisão e plano: PostgreSQL + Drizzle + JSONB"
Cohesion: 0.09
Nodes (21): 10. Go/no-go para implementação, 1. Conclusão, 2. Decisões de domínio confirmadas, 3. Modelo de domínio e estados, 4. Blueprint relacional inicial, 5. Matriz de invariantes, 6. Fronteiras transacionais, 7. Reaproveitamento do Git (+13 more)

### Community 50 - "$patientId/index.tsx"
Cohesion: 0.18
Nodes (16): AppointmentDialog(), localDate(), localTime(), NewFollowupDialog(), StandaloneAttendanceDialog(), Body(), Entry, kinds (+8 more)

### Community 51 - "Especificação: migração para PostgreSQL + Drizzle + JSONB"
Cohesion: 0.13
Nodes (14): API, frontend e operações de produto, Catálogo, planos e snapshots, Dados protegidos, Especificação: migração para PostgreSQL + Drizzle + JSONB, Further Notes, Implementation Decisions, Integridade e concorrência, Máquina de estados (+6 more)

### Community 52 - "api/package.json"
Cohesion: 0.14
Nodes (13): devDependencies, @types/bun, typescript, drizzle-orm, @types/bun, typescript, name, private (+5 more)

### Community 53 - "SchemaEditor.tsx"
Cohesion: 0.20
Nodes (15): AnamnesisFormPage(), submit(), Field, FieldPatch, identifierFor(), newSalt(), saltOf(), Schema (+7 more)

### Community 54 - "dialogs.tsx"
Cohesion: 0.11
Nodes (24): minutesBetween(), PlannedItem, Selection, FormPage(), emptySchema, ProcedureFormPage(), Checkbox(), anamnesisForm (+16 more)

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
Cohesion: 0.36
Nodes (7): updateInitialPasswordChoice(), getAuth(), clinicSession, getClinicSession(), requireClinicSession(), authUsers, hono

### Community 60 - "Issue tracker: GitHub"
Cohesion: 0.29
Nodes (6): Conventions, Issue tracker: GitHub, Pull requests as a triage surface, Wayfinding operations, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 61 - "Domain Docs"
Cohesion: 0.33
Nodes (5): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary

### Community 79 - "auth.ts"
Cohesion: 0.33
Nodes (4): AuthInstance, SESSION_DURATION_SECONDS, better-auth, @better-auth/drizzle-adapter

### Community 80 - "auth-schema.ts"
Cohesion: 0.29
Nodes (6): authAccounts, authSchema, AuthSession, authSessions, AuthUser, authVerifications

## Knowledge Gaps
- **470 isolated node(s):** `name`, `private`, `type`, `dev`, `dev:debug` (+465 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 547 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getDatabase()` connect `getDatabase` to `catalog.integration.test.ts`, `db/src/index.ts`, `patients.ts`, `catalog.ts`, `admin-commands.ts`, `followups.ts`, `scheduling.ts`, `auth.ts`, `relational-schema.ts`, `scheduling.integration.test.ts`, `app.ts`, `auth-routes.ts`, `payments.ts`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **Why does `@tanstack/react-router` connect `@tanstack/react-router` to `Button`, `schemaUi.tsx`, `VersionsDialog.tsx`, `procedimentos/index.tsx`, `ComboForm.tsx`, `web/package.json`, `nova.tsx`, `$patientId/index.tsx`, `App.test.tsx`, `dialogs.tsx`, `_app.tsx`, `formulario.$token.tsx`, `AppointmentDetails.tsx`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `react` connect `Button` to `cn`, `schemaUi.tsx`, `VersionsDialog.tsx`, `procedimentos/index.tsx`, `ComboForm.tsx`, `web/package.json`, `$patientId/index.tsx`, `SchemaEditor.tsx`, `dialogs.tsx`, `App.test.tsx`, `_app.tsx`, `formulario.$token.tsx`, `AppointmentDetails.tsx`, `@tanstack/react-router`, `CalendarView.tsx`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _470 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Button` be split into smaller, more focused modules?**
  _Cohesion score 0.13530655391120508 - nodes in this community are weakly interconnected._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.1431451612903226 - nodes in this community are weakly interconnected._
- **Should `schemaUi.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11182795698924732 - nodes in this community are weakly interconnected._