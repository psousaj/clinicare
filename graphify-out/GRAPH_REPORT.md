# Graph Report - clinicare  (2026-10-03)

## Corpus Check
- 151 files · ~89,202 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: (none) 4, .example 3, .css 3)

## Summary
- 1244 nodes · 3493 edges · 66 communities (48 shown, 18 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 38 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e76dd9e6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- cn
- @tanstack/react-router
- Button
- SchemaEditor.tsx
- dialogs.tsx
- queries.ts
- getDatabase
- routeTree.gen.ts
- scripts
- api/package.json
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
- payments.ts
- devDependencies
- __root.tsx
- CalendarView.tsx
- compilerOptions
- api/tsconfig.json
- Clínicare
- db/src/index.ts
- test-setup.ts
- Clínica de cuidados estéticos
- patients.ts
- scripts
- scheduling.integration.test.ts
- nova.tsx
- db/tsconfig.json
- Agent skills
- scheduling.ts
- clinical.ts
- clinical.integration.test.ts
- relational-schema.ts
- Decisão e plano: PostgreSQL + Drizzle + JSONB
- format.ts
- Especificação: migração para PostgreSQL + Drizzle + JSONB
- app.ts
- PatientTimeline.tsx
- signatures.integration.test.ts
- Issue tracker: GitHub
- Domain Docs
- Persistência PostgreSQL + Drizzle + JSONB
- triage-labels.md

## God Nodes (most connected - your core abstractions)
1. `getDatabase()` - 89 edges
2. `app` - 81 edges
3. `Button()` - 57 edges
4. `cn()` - 53 edges
5. `@tanstack/react-router` - 43 edges
6. `react` - 40 edges
7. `QueryError()` - 37 edges
8. `lucide-react` - 34 edges
9. `@tanstack/react-query` - 30 edges
10. `useApiMutation()` - 30 edges

## Surprising Connections (you probably didn't know these)
- `Jornada do paciente` --references--> `Attendance`  [INFERRED]
  CONTEXT.md → apps/web/src/lib/schemas.ts
- `deleteIntegrationTenants()` --calls--> `getDatabase()`  [EXTRACTED]
  apps/api/src/integration-support.ts → packages/db/src/index.ts
- `app` --calls--> `getDatabasePool()`  [EXTRACTED]
  apps/api/src/app.ts → packages/db/src/index.ts
- `fixture()` --calls--> `getDatabase()`  [EXTRACTED]
  apps/api/src/clinical.integration.test.ts → packages/db/src/index.ts
- `protect()` --calls--> `buildProtectedAad()`  [EXTRACTED]
  apps/api/src/clinical.ts → packages/db/src/crypto.ts

## Import Cycles
- 2-file cycle: `packages/db/src/index.ts -> packages/db/src/migrate.ts -> packages/db/src/index.ts`
- 2-file cycle: `packages/db/src/index.ts -> packages/db/src/seed.ts -> packages/db/src/index.ts`

## Communities (66 total, 18 thin omitted)

### Community 0 - "cn"
Cohesion: 0.05
Nodes (82): emptySchema, Props, allowed, AttendancePhotos(), Phase, phases, AttendanceRecordForm(), ComboFormPage() (+74 more)

### Community 1 - "@tanstack/react-router"
Cohesion: 0.17
Nodes (21): NewFollowupDialog(), matchesPatient(), PatientRow(), QueryError(), combosQuery, followupsQuery, patientsQuery, plansQuery (+13 more)

### Community 2 - "Button"
Cohesion: 0.10
Nodes (40): AppointmentDetails(), dateLong, Props, Row(), time, ContractFormPage(), FormDialog(), FormDialogProps (+32 more)

### Community 3 - "SchemaEditor.tsx"
Cohesion: 0.09
Nodes (40): AnamnesisFormPage(), submit(), Field, FieldPatch, identifierFor(), newSalt(), saltOf(), Schema (+32 more)

### Community 4 - "dialogs.tsx"
Cohesion: 0.12
Nodes (33): AppointmentDialog(), AppointmentFields(), localDate(), localTime(), minutesBetween(), OfferFields(), PaymentDialog(), PlannedItem (+25 more)

### Community 5 - "queries.ts"
Cohesion: 0.05
Nodes (68): api(), ApiError, RequestOptions, withIds(), everything, keys, list(), MutationConfig (+60 more)

### Community 6 - "getDatabase"
Cohesion: 0.14
Nodes (31): addAnamnesisVersion(), addContractVersion(), addContractVersionTx(), anamnesisResponse(), associateAnamnesis(), catalogTenant(), comboResponse(), comboValid() (+23 more)

### Community 7 - "routeTree.gen.ts"
Cohesion: 0.06
Nodes (33): AppAgendaRoute, AppContratosContractIdRoute, AppContratosIndexRoute, AppContratosNovoRoute, AppFinanceiroRoute, AppFormulariosAnamneseAnamnesisIdRoute, AppFormulariosAnamneseIndexRoute, AppFormulariosAnamneseNovaRoute (+25 more)

### Community 8 - "scripts"
Cohesion: 0.06
Nodes (32): devDependencies, turbo, engines, node, name, packageManager, private, scripts (+24 more)

### Community 9 - "api/package.json"
Cohesion: 0.07
Nodes (26): dependencies, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, @clinicare/db, drizzle-orm, hono, @hono/node-server, devDependencies (+18 more)

### Community 10 - "dependencies"
Cohesion: 0.07
Nodes (27): dependencies, class-variance-authority, clsx, date-fns, @fullcalendar/core, @fullcalendar/interaction, @fullcalendar/react, @fullcalendar/timegrid (+19 more)

### Community 11 - "followups.ts"
Cohesion: 0.11
Nodes (22): headers(), request(), schema, tenantIds, createFollowup(), hashToken(), idShape(), invalid() (+14 more)

### Community 12 - "Assinatura eletrônica própria — especificação completa"
Cohesion: 0.09
Nodes (22): 10. Selo da plataforma e gestão de chaves, 11. Pacote exportável e verificação independente, 12. Recuperação, revogação e tempo, 13. Limites de confiança, 14. Critérios de aceitação, 1. Objetivo e decisões de produto, 2. O que o sistema pretende demonstrar, 3.1. Fingerprint obrigatório desde o MVP (+14 more)

### Community 13 - "Assinatura eletrônica própria — MVP"
Cohesion: 0.09
Nodes (22): 10. Histórico, armazenamento e download, 11. Estrutura preparada para evolução, 12. O que fica fora deste MVP, 13. Critérios para considerar o MVP pronto, 14. Limite da evolução futura, 1. Objetivo, 2. Fluxo oficial, também mantido na produção, 3.1. Fingerprint obrigatório desde o MVP (+14 more)

### Community 14 - "web/package.json"
Cohesion: 0.11
Nodes (19): typescript, name, private, type, class-variance-authority, clsx, date-fns, jsdom (+11 more)

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
Cohesion: 0.10
Nodes (20): Route, Route, Route, Route, Route, Route, Route, Route (+12 more)

### Community 21 - "App.test.tsx"
Cohesion: 0.16
Nodes (12): Handler, marina, renderAt(), queryClient, router, createAppRouter(), createQueryClient(), Register (+4 more)

### Community 22 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+8 more)

### Community 23 - "payments.ts"
Cohesion: 0.12
Nodes (31): addAnamnesisNote(), noteValue(), protect(), encrypted(), conflict(), createPayment(), deletePayment(), invalid() (+23 more)

### Community 27 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, jsdom, @tanstack/router-plugin, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, @types/react, @types/react-dom (+2 more)

### Community 29 - "CalendarView.tsx"
Cohesion: 0.22
Nodes (6): CalendarEntry, Tone, @fullcalendar/core, @fullcalendar/interaction, @fullcalendar/react, @fullcalendar/timegrid

### Community 30 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, noEmit, skipLibCheck, strict (+1 more)

### Community 32 - "api/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, allowImportingTsExtensions, types, extends, include, ../../tsconfig.json

### Community 33 - "Clínicare"
Cohesion: 0.29
Nodes (6): Clínicare, Desenvolvimento sem Docker, Estrutura do monorepo, Rodar localmente via Docker (caminho recomendado), Stack, Verificações

### Community 34 - "db/src/index.ts"
Cohesion: 0.22
Nodes (12): assertSafeIntegrationDatabase(), deleteIntegrationTenants(), integration, closeDatabase(), connectPostgresDatabase(), Database, disconnectDatabase(), getDatabasePool() (+4 more)

### Community 36 - "Clínica de cuidados estéticos"
Cohesion: 0.20
Nodes (9): Attendance, Atendimento estético, Clínica de cuidados estéticos, Dados e ciclo de protótipo, Documentos e coleta, Jornada do paciente, Objetivo do produto, Organização da clínica (+1 more)

### Community 37 - "patients.ts"
Cohesion: 0.13
Nodes (17): createPatient(), DEFAULT_TENANT_ID, encryptedColumns(), ensureTenant(), listPatients(), PatientInput, patientResponse(), ProtectedField (+9 more)

### Community 38 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 39 - "scheduling.integration.test.ts"
Cohesion: 0.11
Nodes (19): response(), buildRelationship(), monthKey(), fixture(), headers, patch(), post(), request() (+11 more)

### Community 40 - "nova.tsx"
Cohesion: 0.67
Nodes (3): useCreateAnamnesis(), NewAnamnesis(), Route

### Community 42 - "db/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, types, extends, include, ../../tsconfig.json

### Community 43 - "Agent skills"
Cohesion: 0.29
Nodes (6): Agent skills, Domain docs, graphify, Issue tracker, This is NOT the Turborepo you know, Triage labels

### Community 44 - "scheduling.ts"
Cohesion: 0.20
Nodes (30): activeAppointmentStatuses, addAttendancePhoto(), appointmentResponse(), attendanceResponse(), attendanceShape(), cancelAttendance(), conflict(), createAppointment() (+22 more)

### Community 45 - "clinical.ts"
Cohesion: 0.12
Nodes (30): appliedShape(), byToken(), clearDraft, createAnamnesisRequest(), createAppliedAnamnesis(), documentShape(), expiry(), getAppliedDocument() (+22 more)

### Community 46 - "clinical.integration.test.ts"
Cohesion: 0.11
Nodes (15): fixture(), headers(), otherTenantId, post(), request(), tenantId, anamneses, anamnesisVersions (+7 more)

### Community 47 - "relational-schema.ts"
Cohesion: 0.07
Nodes (26): catalogTimestamps, NewRelationalPatient, NewRelationalProcedure, NewTenant, paymentRelations, RelationalAnamnesis, RelationalAnamnesisVersion, RelationalAppliedAnamnesis (+18 more)

### Community 49 - "Decisão e plano: PostgreSQL + Drizzle + JSONB"
Cohesion: 0.09
Nodes (21): 10. Go/no-go para implementação, 1. Conclusão, 2. Decisões de domínio confirmadas, 3. Modelo de domínio e estados, 4. Blueprint relacional inicial, 5. Matriz de invariantes, 6. Fronteiras transacionais, 7. Reaproveitamento do Git (+13 more)

### Community 50 - "format.ts"
Cohesion: 0.16
Nodes (21): CalendarView(), appointmentStatus, duration(), monthLabel(), offerKinds, photoPhases, shortDate(), statusLabel() (+13 more)

### Community 51 - "Especificação: migração para PostgreSQL + Drizzle + JSONB"
Cohesion: 0.13
Nodes (14): API, frontend e operações de produto, Catálogo, planos e snapshots, Dados protegidos, Especificação: migração para PostgreSQL + Drizzle + JSONB, Further Notes, Implementation Decisions, Integridade e concorrência, Máquina de estados (+6 more)

### Community 53 - "app.ts"
Cohesion: 0.17
Nodes (24): app, appointmentStatusLabel, expiry(), fail(), handleError(), isRecord(), answerAppliedAnamnesis(), deleteAppliedDocument() (+16 more)

### Community 54 - "PatientTimeline.tsx"
Cohesion: 0.24
Nodes (9): Body(), Entry, kinds, PatientTimeline(), PendingRequirements(), dateTime(), patientHistoryQuery(), PatientHistory (+1 more)

### Community 55 - "signatures.integration.test.ts"
Cohesion: 0.15
Nodes (15): expiry(), hashToken(), request(), invalid(), issueSignatureToken(), lockedTokenContext(), terminalFollowup(), tokenParticipant() (+7 more)

### Community 60 - "Issue tracker: GitHub"
Cohesion: 0.29
Nodes (6): Conventions, Issue tracker: GitHub, Pull requests as a triage surface, Wayfinding operations, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 61 - "Domain Docs"
Cohesion: 0.33
Nodes (5): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary

## Knowledge Gaps
- **436 isolated node(s):** `name`, `private`, `type`, `dev`, `dev:debug` (+431 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 504 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@tanstack/react-router` connect `@tanstack/react-router` to `cn`, `Button`, `dialogs.tsx`, `queries.ts`, `nova.tsx`, `web/package.json`, `format.ts`, `App.test.tsx`, `PatientTimeline.tsx`, `__root.tsx`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `web/package.json`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `react` connect `cn` to `@tanstack/react-router`, `Button`, `SchemaEditor.tsx`, `dialogs.tsx`, `queries.ts`, `web/package.json`, `format.ts`, `App.test.tsx`, `CalendarView.tsx`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _436 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.05464989908399317 - nodes in this community are weakly interconnected._
- **Should `Button` be split into smaller, more focused modules?**
  _Cohesion score 0.10377358490566038 - nodes in this community are weakly interconnected._
- **Should `SchemaEditor.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09494949494949495 - nodes in this community are weakly interconnected._