# Graph Report - clinicare  (2026-10-01)

## Corpus Check
- 109 files · ~55,856 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: .example 3, (none) 3, .css 3)

## Summary
- 881 nodes · 2207 edges · 45 communities (39 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 32 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f1dd0908`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ComboForm.tsx
- @tanstack/react-router
- Button
- SchemaEditor.tsx
- dialogs.tsx
- queries.ts
- app.ts
- routeTree.gen.ts
- scripts
- api/package.json
- dependencies
- schema.ts
- Assinatura eletrônica própria — especificação completa
- Assinatura eletrônica própria — MVP
- web/package.json
- Especificação: MVP para clínicas pequenas de estética
- db/package.json
- tasks
- components.json
- FileRoutesByPath
- app.test.ts
- App.test.tsx
- compilerOptions
- _app.tsx
- useApiMutation
- $contractId.tsx
- atendimentos.$attendanceId.tsx
- devDependencies
- AttendancePhotos.tsx
- CalendarView.tsx
- compilerOptions
- formulario.$token.tsx
- api/tsconfig.json
- Clínicare
- db/src/index.ts
- test-setup.ts
- Clínica de cuidados estéticos
- resolveOffer
- scripts
- relationship.ts
- nova.tsx
- db/tsconfig.json
- This is NOT the Turborepo you know
- __root.tsx

## God Nodes (most connected - your core abstractions)
1. `Button()` - 57 edges
2. `cn()` - 53 edges
3. `@tanstack/react-router` - 43 edges
4. `react` - 38 edges
5. `QueryError()` - 37 edges
6. `lucide-react` - 34 edges
7. `@tanstack/react-query` - 30 edges
8. `FileRoutesByPath` - 28 edges
9. `useApiMutation()` - 26 edges
10. `app` - 24 edges

## Surprising Connections (you probably didn't know these)
- `Jornada do paciente` --references--> `Attendance`  [INFERRED]
  CONTEXT.md → apps/web/src/lib/schemas.ts
- `NativeSelectOptGroup()` --calls--> `cn()`  [EXTRACTED]
  apps/web/src/components/ui/native-select.tsx → apps/web/src/lib/utils.ts
- `PopoverHeader()` --calls--> `cn()`  [EXTRACTED]
  apps/web/src/components/ui/popover.tsx → apps/web/src/lib/utils.ts
- `PopoverTitle()` --calls--> `cn()`  [EXTRACTED]
  apps/web/src/components/ui/popover.tsx → apps/web/src/lib/utils.ts
- `PopoverDescription()` --calls--> `cn()`  [EXTRACTED]
  apps/web/src/components/ui/popover.tsx → apps/web/src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (45 total, 6 thin omitted)

### Community 0 - "ComboForm.tsx"
Cohesion: 0.09
Nodes (40): emptySchema, Props, ComboFormPage(), day(), ContractData, Props, Field(), FormPage() (+32 more)

### Community 1 - "@tanstack/react-router"
Cohesion: 0.09
Nodes (46): AttendanceRecordForm(), NewFollowupDialog(), FollowupCard(), offerLabel, matchesPatient(), PatientRow(), Body(), Entry (+38 more)

### Community 2 - "Button"
Cohesion: 0.10
Nodes (45): AppointmentDetails(), dateLong, Props, Row(), time, FormDialog(), FormDialogProps, StatusBadge() (+37 more)

### Community 3 - "SchemaEditor.tsx"
Cohesion: 0.09
Nodes (41): AnamnesisFormPage(), submit(), Field, FieldPatch, identifierFor(), newSalt(), saltOf(), Schema (+33 more)

### Community 4 - "dialogs.tsx"
Cohesion: 0.09
Nodes (40): ProcedurePicker(), AppointmentDialog(), AppointmentFields(), localDate(), localTime(), minutesBetween(), OfferFields(), PaymentDialog() (+32 more)

### Community 5 - "queries.ts"
Cohesion: 0.08
Nodes (35): attendancesQuery, everything, keys, MutationConfig, patientRefresh, anamnesisSchema, AnamnesisVersion, anamnesisVersionSchema (+27 more)

### Community 6 - "app.ts"
Cohesion: 0.10
Nodes (27): app, appointmentStatusLabel, buildResponse(), comboPriceError(), contractTarget(), dropUnusedStandalone(), fail(), handleError() (+19 more)

### Community 7 - "routeTree.gen.ts"
Cohesion: 0.06
Nodes (33): AppAgendaRoute, AppContratosContractIdRoute, AppContratosIndexRoute, AppContratosNovoRoute, AppFinanceiroRoute, AppFormulariosAnamneseAnamnesisIdRoute, AppFormulariosAnamneseIndexRoute, AppFormulariosAnamneseNovaRoute (+25 more)

### Community 8 - "scripts"
Cohesion: 0.07
Nodes (29): devDependencies, turbo, engines, node, name, overrides, bson, packageManager (+21 more)

### Community 9 - "api/package.json"
Cohesion: 0.07
Nodes (28): dependencies, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, @clinicare/db, hono, @hono/node-server, mongoose, devDependencies (+20 more)

### Community 10 - "dependencies"
Cohesion: 0.07
Nodes (27): dependencies, class-variance-authority, clsx, date-fns, @fullcalendar/core, @fullcalendar/interaction, @fullcalendar/react, @fullcalendar/timegrid (+19 more)

### Community 11 - "schema.ts"
Cohesion: 0.08
Nodes (24): Anamnesis, anamnesisSchema, appointmentItemSchema, appointmentSchema, Attendance, attendancePhotoSchema, attendanceSchema, comboItemSchema (+16 more)

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
Cohesion: 0.10
Nodes (19): dependencies, mongoose, devDependencies, mongodb-memory-server, @types/bun, typescript, exports, mongodb-memory-server (+11 more)

### Community 17 - "tasks"
Cohesion: 0.10
Nodes (19): dependsOn, inputs, outputs, cache, cache, persistent, persistent, cache (+11 more)

### Community 18 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 19 - "FileRoutesByPath"
Cohesion: 0.11
Nodes (18): Route, Route, Route, Route, Route, Route, Route, Route (+10 more)

### Community 20 - "app.test.ts"
Cohesion: 0.15
Nodes (7): post(), startFollowup(), Appointment, Combo, Followup, Patient, Procedure

### Community 21 - "App.test.tsx"
Cohesion: 0.16
Nodes (12): Handler, marina, renderAt(), queryClient, router, createAppRouter(), createQueryClient(), Register (+4 more)

### Community 22 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+8 more)

### Community 23 - "_app.tsx"
Cohesion: 0.27
Nodes (14): QuickActions(), Sheet(), SheetClose(), SheetContent(), SheetDescription(), SheetHeader(), SheetOverlay(), SheetTitle() (+6 more)

### Community 24 - "useApiMutation"
Cohesion: 0.26
Nodes (14): post(), useAnswerAnamnesis(), useApiMutation(), useCreateAppointment(), useCreateAttendance(), useCreateCombo(), useCreateFollowup(), useCreatePatient() (+6 more)

### Community 25 - "$contractId.tsx"
Cohesion: 0.24
Nodes (9): ContractFormPage(), contractsQuery, useCreateContract(), useUpdateContract(), EditContract(), Editor(), Route, NewContract() (+1 more)

### Community 26 - "atendimentos.$attendanceId.tsx"
Cohesion: 0.23
Nodes (11): api(), withIds(), attendanceQuery(), list(), patientHistoryQuery(), useUpdateAttendance(), Attendance, AttendanceFollowUp() (+3 more)

### Community 27 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, jsdom, @tanstack/router-plugin, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, @types/react, @types/react-dom (+2 more)

### Community 28 - "AttendancePhotos.tsx"
Cohesion: 0.24
Nodes (8): allowed, AttendancePhotos(), Phase, phases, photoPhases, useAddAttendancePhoto(), useDeleteAttendancePhoto(), AttendancePhoto

### Community 29 - "CalendarView.tsx"
Cohesion: 0.20
Nodes (7): CalendarEntry, CalendarView(), Tone, @fullcalendar/core, @fullcalendar/interaction, @fullcalendar/react, @fullcalendar/timegrid

### Community 30 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, noEmit, skipLibCheck, strict (+1 more)

### Community 31 - "formulario.$token.tsx"
Cohesion: 0.39
Nodes (6): publicFormQuery(), useSaveDraft(), useSubmitAnamnesis(), AnamnesisForm(), PublicAnamnesis(), Route

### Community 32 - "api/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, allowImportingTsExtensions, types, extends, include, ../../tsconfig.json

### Community 33 - "Clínicare"
Cohesion: 0.29
Nodes (6): Clínicare, Desenvolvimento sem Docker, Estrutura do monorepo, Rodar localmente via Docker (caminho recomendado), Stack, Verificações

### Community 36 - "Clínica de cuidados estéticos"
Cohesion: 0.33
Nodes (5): Atendimento estético, Clínica de cuidados estéticos, Documentos e coleta, Organização da clínica, Princípios do MVP

### Community 37 - "resolveOffer"
Cohesion: 0.50
Nodes (5): comboAvailable(), comboItems(), expiry(), procedureItem(), resolveOffer()

### Community 38 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 40 - "nova.tsx"
Cohesion: 0.67
Nodes (3): useCreateAnamnesis(), NewAnamnesis(), Route

### Community 42 - "db/tsconfig.json"
Cohesion: 0.50
Nodes (3): extends, include, ../../tsconfig.json

## Knowledge Gaps
- **358 isolated node(s):** `name`, `private`, `type`, `dev`, `dev:debug` (+353 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 397 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `web/package.json`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `@tanstack/react-router` connect `@tanstack/react-router` to `ComboForm.tsx`, `Button`, `dialogs.tsx`, `nova.tsx`, `__root.tsx`, `web/package.json`, `App.test.tsx`, `_app.tsx`, `$contractId.tsx`, `atendimentos.$attendanceId.tsx`, `formulario.$token.tsx`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `react` connect `ComboForm.tsx` to `@tanstack/react-router`, `Button`, `SchemaEditor.tsx`, `dialogs.tsx`, `web/package.json`, `App.test.tsx`, `_app.tsx`, `atendimentos.$attendanceId.tsx`, `AttendancePhotos.tsx`, `formulario.$token.tsx`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _358 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ComboForm.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09038461538461538 - nodes in this community are weakly interconnected._
- **Should `@tanstack/react-router` be split into smaller, more focused modules?**
  _Cohesion score 0.09423076923076923 - nodes in this community are weakly interconnected._
- **Should `Button` be split into smaller, more focused modules?**
  _Cohesion score 0.10102843315184513 - nodes in this community are weakly interconnected._