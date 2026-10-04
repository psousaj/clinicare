# Graph Report - clinicare  (2026-10-04)

## Corpus Check
- 158 files · ~93,519 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: (none) 4, .example 3, .css 3)

## Summary
- 1296 nodes · 3661 edges · 70 communities (51 shown, 19 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 41 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `528b9129`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- dialogs.tsx
- @tanstack/react-router
- Button
- SchemaEditor.tsx
- procedimentos/index.tsx
- queries.ts
- catalog.ts
- routeTree.gen.ts
- scripts
- admin-commands.ts
- dependencies
- followups.integration.test.ts
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
- payments.ts
- ContractFormPage.tsx
- _app.tsx
- $anamnesisId.tsx
- devDependencies
- Route
- CalendarView.tsx
- compilerOptions
- relacionamento.tsx
- api/tsconfig.json
- Clínicare
- db/src/index.ts
- test-setup.ts
- Clínica de cuidados estéticos
- patients.ts
- scripts
- scheduling.integration.test.ts
- storage.ts
- db/tsconfig.json
- Agent skills
- scheduling.ts
- getDatabase
- clinical.integration.test.ts
- relational-schema.ts
- relationship.ts
- Decisão e plano: PostgreSQL + Drizzle + JSONB
- $patientId/index.tsx
- Especificação: migração para PostgreSQL + Drizzle + JSONB
- app.ts
- followups.ts
- Issue tracker: GitHub
- Domain Docs
- Persistência PostgreSQL + Drizzle + JSONB
- triage-labels.md

## God Nodes (most connected - your core abstractions)
1. `getDatabase()` - 102 edges
2. `app` - 83 edges
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

## Communities (70 total, 19 thin omitted)

### Community 0 - "dialogs.tsx"
Cohesion: 0.08
Nodes (46): emptySchema, Props, ComboFormPage(), day(), AppointmentFields(), minutesBetween(), PlannedItem, Selection (+38 more)

### Community 1 - "@tanstack/react-router"
Cohesion: 0.12
Nodes (31): AttendanceRecordForm(), matchesPatient(), PatientRow(), QueryError(), Props, SchemaForm(), attendanceQuery(), combosQuery (+23 more)

### Community 2 - "Button"
Cohesion: 0.17
Nodes (26): AppointmentDetails(), dateLong, Props, Row(), time, FormDialog(), FormDialogProps, FormPageProps (+18 more)

### Community 3 - "SchemaEditor.tsx"
Cohesion: 0.07
Nodes (55): AnamnesisFormPage(), submit(), ProcedurePicker(), Column(), DatePicker(), hours, minutes, PickerProps (+47 more)

### Community 4 - "procedimentos/index.tsx"
Cohesion: 0.18
Nodes (19): OfferFields(), PaymentDialog(), FollowupCard(), offerLabel, StatusBadge(), tones, NativeSelect(), NativeSelectOptGroup() (+11 more)

### Community 5 - "queries.ts"
Cohesion: 0.05
Nodes (68): allowed, AttendancePhotos(), Phase, phases, api(), RequestOptions, withIds(), photoPhases (+60 more)

### Community 6 - "catalog.ts"
Cohesion: 0.12
Nodes (30): addAnamnesisVersion(), addContractVersion(), addContractVersionTx(), anamnesisResponse(), associateAnamnesis(), catalogTenant(), comboResponse(), comboValid() (+22 more)

### Community 7 - "routeTree.gen.ts"
Cohesion: 0.06
Nodes (34): AppAgendaRoute, AppContratosContractIdRoute, AppContratosIndexRoute, AppContratosNovoRoute, AppFinanceiroRoute, AppFormulariosAnamneseAnamnesisIdRoute, AppFormulariosAnamneseIndexRoute, AppFormulariosAnamneseNovaRoute (+26 more)

### Community 8 - "scripts"
Cohesion: 0.06
Nodes (35): devDependencies, turbo, engines, node, name, packageManager, private, scripts (+27 more)

### Community 9 - "admin-commands.ts"
Cohesion: 0.05
Nodes (44): dependencies, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, better-auth, @better-auth/drizzle-adapter, @clinicare/db, drizzle-orm, hono (+36 more)

### Community 10 - "dependencies"
Cohesion: 0.07
Nodes (27): dependencies, class-variance-authority, clsx, date-fns, @fullcalendar/core, @fullcalendar/interaction, @fullcalendar/react, @fullcalendar/timegrid (+19 more)

### Community 11 - "followups.integration.test.ts"
Cohesion: 0.13
Nodes (15): headers(), request(), schema, tenantIds, request(), anamnesisProcedures, appliedAnamneses, plans (+7 more)

### Community 12 - "Assinatura eletrônica própria — especificação completa"
Cohesion: 0.09
Nodes (22): 10. Selo da plataforma e gestão de chaves, 11. Pacote exportável e verificação independente, 12. Recuperação, revogação e tempo, 13. Limites de confiança, 14. Critérios de aceitação, 1. Objetivo e decisões de produto, 2. O que o sistema pretende demonstrar, 3.1. Fingerprint obrigatório desde o MVP (+14 more)

### Community 13 - "Assinatura eletrônica própria — MVP"
Cohesion: 0.09
Nodes (22): 10. Histórico, armazenamento e download, 11. Estrutura preparada para evolução, 12. O que fica fora deste MVP, 13. Critérios para considerar o MVP pronto, 14. Limite da evolução futura, 1. Objetivo, 2. Fluxo oficial, também mantido na produção, 3.1. Fingerprint obrigatório desde o MVP (+14 more)

### Community 14 - "web/package.json"
Cohesion: 0.11
Nodes (18): typescript, name, private, type, class-variance-authority, clsx, jsdom, @rjsf/utils (+10 more)

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

### Community 23 - "payments.ts"
Cohesion: 0.12
Nodes (29): addAnamnesisNote(), noteValue(), encrypted(), conflict(), createPayment(), deletePayment(), invalid(), listPayments() (+21 more)

### Community 24 - "ContractFormPage.tsx"
Cohesion: 0.18
Nodes (13): ContractData, ContractFormPage(), Props, ContractVersionsButton(), contractsQuery, useCreateContract(), useUpdateContract(), Contract (+5 more)

### Community 25 - "_app.tsx"
Cohesion: 0.24
Nodes (15): QuickActions(), Sheet(), SheetClose(), SheetContent(), SheetDescription(), SheetHeader(), SheetOverlay(), SheetTitle() (+7 more)

### Community 26 - "$anamnesisId.tsx"
Cohesion: 0.21
Nodes (12): VersionsButton(), VersionsTrigger(), anamnesesQuery, useUpdateAnamnesis(), Anamnesis, AnamnesisVersion, fieldCount(), sameSchema() (+4 more)

### Community 27 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, jsdom, @tanstack/router-plugin, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, @types/react, @types/react-dom (+2 more)

### Community 29 - "CalendarView.tsx"
Cohesion: 0.25
Nodes (5): CalendarEntry, @fullcalendar/core, @fullcalendar/interaction, @fullcalendar/react, @fullcalendar/timegrid

### Community 30 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, noEmit, skipLibCheck, strict (+1 more)

### Community 31 - "relacionamento.tsx"
Cohesion: 0.33
Nodes (9): duration(), monthLabel(), shortDate(), relationshipQuery(), Card(), Chart(), Relationship(), Route (+1 more)

### Community 32 - "api/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, allowImportingTsExtensions, types, extends, include, ../../tsconfig.json

### Community 33 - "Clínicare"
Cohesion: 0.29
Nodes (6): Clínicare, Desenvolvimento sem Docker, Estrutura do monorepo, Rodar localmente via Docker (caminho recomendado), Stack, Verificações

### Community 34 - "db/src/index.ts"
Cohesion: 0.13
Nodes (21): AppLike, assertSafeIntegrationDatabase(), cleanupIntegrationClinics(), integration, IntegrationClinic, integrationCookies, provisionIntegrationClinic(), authAccounts (+13 more)

### Community 36 - "Clínica de cuidados estéticos"
Cohesion: 0.20
Nodes (9): Attendance, Atendimento estético, Clínica de cuidados estéticos, Dados e ciclo de protótipo, Documentos e coleta, Jornada do paciente, Objetivo do produto, Organização da clínica (+1 more)

### Community 37 - "patients.ts"
Cohesion: 0.12
Nodes (22): createPatient(), deactivatePatient(), DEFAULT_TENANT_ID, encryptedColumns(), ensureTenant(), getPatient(), isUuid(), listPatients() (+14 more)

### Community 38 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 39 - "scheduling.integration.test.ts"
Cohesion: 0.10
Nodes (21): response(), fixture(), headers, patch(), post(), request(), reserve(), tenantId (+13 more)

### Community 40 - "storage.ts"
Cohesion: 0.29
Nodes (5): bucket, deleteObject(), storage, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner

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
Cohesion: 0.17
Nodes (27): answerAppliedAnamnesis(), appliedShape(), byToken(), clearDraft, createAnamnesisRequest(), createAppliedAnamnesis(), documentShape(), expiry() (+19 more)

### Community 46 - "clinical.integration.test.ts"
Cohesion: 0.17
Nodes (10): fixture(), headers(), post(), request(), integrationHeaders(), anamneses, appliedAnamnesisNotes, appliedDocuments (+2 more)

### Community 47 - "relational-schema.ts"
Cohesion: 0.08
Nodes (25): catalogTimestamps, NewRelationalPatient, NewRelationalProcedure, NewTenant, paymentRelations, RelationalAnamnesis, RelationalAnamnesisVersion, RelationalAppliedAnamnesis (+17 more)

### Community 49 - "Decisão e plano: PostgreSQL + Drizzle + JSONB"
Cohesion: 0.09
Nodes (21): 10. Go/no-go para implementação, 1. Conclusão, 2. Decisões de domínio confirmadas, 3. Modelo de domínio e estados, 4. Blueprint relacional inicial, 5. Matriz de invariantes, 6. Fronteiras transacionais, 7. Reaproveitamento do Git (+13 more)

### Community 50 - "$patientId/index.tsx"
Cohesion: 0.11
Nodes (28): CalendarView(), AppointmentDialog(), localDate(), localTime(), NewFollowupDialog(), StandaloneAttendanceDialog(), Body(), Entry (+20 more)

### Community 51 - "Especificação: migração para PostgreSQL + Drizzle + JSONB"
Cohesion: 0.13
Nodes (14): API, frontend e operações de produto, Catálogo, planos e snapshots, Dados protegidos, Especificação: migração para PostgreSQL + Drizzle + JSONB, Further Notes, Implementation Decisions, Integridade e concorrência, Máquina de estados (+6 more)

### Community 53 - "app.ts"
Cohesion: 0.14
Nodes (26): updateInitialPasswordChoice(), app, appointmentStatusLabel, authTenant(), expiry(), fail(), handleError(), isRecord() (+18 more)

### Community 55 - "followups.ts"
Cohesion: 0.12
Nodes (20): hashToken(), idShape(), invalid(), issueInitialTokens(), latest(), notFound(), Offer, offerForms() (+12 more)

### Community 60 - "Issue tracker: GitHub"
Cohesion: 0.29
Nodes (6): Conventions, Issue tracker: GitHub, Pull requests as a triage surface, Wayfinding operations, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 61 - "Domain Docs"
Cohesion: 0.33
Nodes (5): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary

## Knowledge Gaps
- **448 isolated node(s):** `name`, `private`, `type`, `dev`, `dev:debug` (+443 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 520 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `pg` connect `db/package.json` to `db/src/index.ts`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `@tanstack/react-router` connect `@tanstack/react-router` to `dialogs.tsx`, `Button`, `procedimentos/index.tsx`, `queries.ts`, `web/package.json`, `$patientId/index.tsx`, `App.test.tsx`, `ContractFormPage.tsx`, `_app.tsx`, `$anamnesisId.tsx`, `relacionamento.tsx`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `Button()` connect `Button` to `dialogs.tsx`, `@tanstack/react-router`, `SchemaEditor.tsx`, `procedimentos/index.tsx`, `queries.ts`, `$patientId/index.tsx`, `ContractFormPage.tsx`, `_app.tsx`, `$anamnesisId.tsx`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _448 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `dialogs.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08438228438228439 - nodes in this community are weakly interconnected._
- **Should `@tanstack/react-router` be split into smaller, more focused modules?**
  _Cohesion score 0.12270531400966184 - nodes in this community are weakly interconnected._
- **Should `SchemaEditor.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06656426011264721 - nodes in this community are weakly interconnected._