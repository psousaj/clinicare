# Graph Report - clinicare  (2026-10-06)

## Corpus Check
- 202 files · ~145,671 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 4, .css 3, .example 1)

## Summary
- 1680 nodes · 5127 edges · 87 communities (63 shown, 24 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 48 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4164806c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- atendimentos.$attendanceId.tsx
- external-validation.ts
- Button
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
- app.ts
- ContractFormPage.tsx
- Implementation Decisions
- followups.integration.test.ts
- devDependencies
- @tanstack/react-router
- signatures.ts
- compilerOptions
- Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF
- api/tsconfig.json
- Clínicare
- db/src/index.ts
- Clínica de cuidados estéticos
- patients.ts
- scripts
- VersionsDialog.tsx
- storage.ts
- -assinatura.$token.test.tsx
- db/tsconfig.json
- Agent skills
- scheduling.ts
- getDatabase
- procedimentos/index.tsx
- relational-schema.ts
- followups.ts
- Decisão e plano: PostgreSQL + Drizzle + JSONB
- dialogs.tsx
- Especificação: migração para PostgreSQL + Drizzle + JSONB
- api/package.json
- SchemaEditor.tsx
- pdf-mutation.ts
- Validação de assinatura externa (GOV.BR) sem PAdES próprio
- _app.tsx
- dependencies
- scripts
- account-routes.ts
- Issue tracker: GitHub
- Domain Docs
- Persistência PostgreSQL + Drizzle + JSONB
- triage-labels.md
- Preservação incremental de PDFs com assinaturas externas
- relationship.ts
- Investigação da validação global T7
- nova.tsx
- contratos/novo.tsx
- docx-types.d.ts
- Route
- DB_SCHEMA.md
- request
- request
- request

## God Nodes (most connected - your core abstractions)
1. `getDatabase()` - 142 edges
2. `app` - 120 edges
3. `Button()` - 66 edges
4. `cn()` - 53 edges
5. `@tanstack/react-router` - 46 edges
6. `react` - 43 edges
7. `QueryError()` - 39 edges
8. `lucide-react` - 35 edges
9. `@tanstack/react-query` - 34 edges
10. `invalid()` - 31 edges

## Surprising Connections (you probably didn't know these)
- `Implementation Decisions` --references--> `Contract`  [INFERRED]
  docs/specs/0005-autoria-docx-e-materializacao-de-contratos.md → apps/web/src/lib/schemas.ts
- `Decisão` --references--> `ContractVersion`  [INFERRED]
  docs/adr/0005-autoria-docx-e-materializacao-de-contratos.md → apps/web/src/lib/schemas.ts
- `Solution` --references--> `ContractVersion`  [INFERRED]
  docs/specs/0005-autoria-docx-e-materializacao-de-contratos.md → apps/web/src/lib/schemas.ts
- `User Stories` --references--> `ContractVersion`  [INFERRED]
  docs/specs/0005-autoria-docx-e-materializacao-de-contratos.md → apps/web/src/lib/schemas.ts
- `Implementation Decisions` --references--> `ContractVersion`  [INFERRED]
  docs/specs/0005-autoria-docx-e-materializacao-de-contratos.md → apps/web/src/lib/schemas.ts

## Import Cycles
- 2-file cycle: `packages/db/src/index.ts -> packages/db/src/migrate.ts -> packages/db/src/index.ts`
- 2-file cycle: `packages/db/src/index.ts -> packages/db/src/seed.ts -> packages/db/src/index.ts`

## Communities (87 total, 24 thin omitted)

### Community 0 - "atendimentos.$attendanceId.tsx"
Cohesion: 0.11
Nodes (25): allowed, AttendancePhotos(), Phase, phases, AttendanceRecordForm(), Props, SchemaForm(), Textarea() (+17 more)

### Community 1 - "external-validation.ts"
Cohesion: 0.09
Nodes (43): buildSignedReturnPdf(), buildUnparsableCmsReturn(), createTestCa(), ensureOpensslAvailable(), issueDatedTestSigner(), issueTestSigner(), num10(), parseBaseTrailer() (+35 more)

### Community 2 - "Button"
Cohesion: 0.11
Nodes (42): emptySchema, Props, ComboFormPage(), day(), ProcedurePicker(), Field(), FormPage(), FormPageProps (+34 more)

### Community 3 - "assinatura.$token.tsx"
Cohesion: 0.09
Nodes (31): CollectedFingerprint, collectFingerprint(), anySchema, GovBrSection(), acceptReturn(), cancelAttempt(), exportRevision(), importReturn() (+23 more)

### Community 4 - "contract-materialization.ts"
Cohesion: 0.12
Nodes (25): assertRequiredContext(), ContextConfiguration, CONTRACT_CONTEXT_INCOMPLETE, createOnlyOfficeConverter(), defaultContextConfiguration(), DOCX_CONTENT_TYPE, encryptMaterializationContext(), extractTags() (+17 more)

### Community 5 - "queries.ts"
Cohesion: 0.06
Nodes (56): CalendarView(), PendingRequirements(), attendancesQuery, everything, keys, MutationConfig, patientRefresh, post() (+48 more)

### Community 6 - "catalog.ts"
Cohesion: 0.10
Nodes (35): addAnamnesisVersion(), addContractVersion(), addContractVersionTx(), anamnesisResponse(), associateAnamnesis(), comboResponse(), comboValid(), conflict() (+27 more)

### Community 7 - "routeTree.gen.ts"
Cohesion: 0.06
Nodes (35): AppAgendaRoute, AppContratosContractIdRoute, AppContratosIndexRoute, AppContratosNovoRoute, AppFinanceiroRoute, AppFormulariosAnamneseAnamnesisIdRoute, AppFormulariosAnamneseIndexRoute, AppFormulariosAnamneseNovaRoute (+27 more)

### Community 8 - "scripts"
Cohesion: 0.06
Nodes (35): devDependencies, turbo, engines, node, name, packageManager, private, scripts (+27 more)

### Community 9 - "admin-commands.ts"
Cohesion: 0.25
Nodes (11): administratorByEmail(), changeClinicAdministratorEmail(), createBetterAuthClinicAdministrator(), deactivateTenant(), normalizeEmail(), provisionClinic(), ProvisionClinicInput, reactivateTenant() (+3 more)

### Community 10 - "dependencies"
Cohesion: 0.06
Nodes (31): dependencies, class-variance-authority, clsx, date-fns, @fingerprintjs/fingerprintjs, @fullcalendar/core, @fullcalendar/interaction, @fullcalendar/react (+23 more)

### Community 11 - "external-mutations.integration.test.ts"
Cohesion: 0.11
Nodes (33): request(), deleteAppliedDocument(), placement, placement, request(), ADR-0004, integrationHeaders(), placement (+25 more)

### Community 12 - "Assinatura eletrônica própria — especificação completa"
Cohesion: 0.09
Nodes (22): 10. Selo da plataforma e gestão de chaves, 11. Pacote exportável e verificação independente, 12. Recuperação, revogação e tempo, 13. Limites de confiança, 14. Critérios de aceitação, 1. Objetivo e decisões de produto, 2. O que o sistema pretende demonstrar, 3.1. Fingerprint obrigatório desde o MVP (+14 more)

### Community 13 - "Assinatura eletrônica própria — MVP"
Cohesion: 0.09
Nodes (22): 10. Histórico, armazenamento e download, 11. Estrutura preparada para evolução, 12. O que fica fora deste MVP, 13. Critérios para considerar o MVP pronto, 14. Limite da evolução futura, 1. Objetivo, 2. Fluxo oficial, também mantido na produção, 3.1. Fingerprint obrigatório desde o MVP (+14 more)

### Community 14 - "web/package.json"
Cohesion: 0.09
Nodes (23): typescript, name, private, type, CalendarEntry, class-variance-authority, clsx, date-fns (+15 more)

### Community 15 - "Especificação: MVP para clínicas pequenas de estética"
Cohesion: 0.10
Nodes (18): ADR 0001: Stack da aplicação, Alternativas consideradas, Consequências, Contexto, Decisão, ADR 0002: Controle de acesso para dados clínicos no MVP, Alternativas consideradas, Consequências (+10 more)

### Community 16 - "db/package.json"
Cohesion: 0.07
Nodes (32): dependencies, drizzle-orm, pg, devDependencies, drizzle-kit, @types/bun, @types/pg, typescript (+24 more)

### Community 17 - "tasks"
Cohesion: 0.08
Nodes (23): dependsOn, inputs, outputs, cache, cache, persistent, env, inputs (+15 more)

### Community 18 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 19 - "FileRoutesByPath"
Cohesion: 0.10
Nodes (21): Route, Route, Route, Route, Route, Route, Route, Route (+13 more)

### Community 21 - "App.test.tsx"
Cohesion: 0.17
Nodes (12): Handler, marina, renderAt(), queryClient, router, createAppRouter(), createQueryClient(), Register (+4 more)

### Community 22 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+8 more)

### Community 23 - "app.ts"
Cohesion: 0.10
Nodes (41): app, appointmentStatusLabel, authTenant(), expiry(), fail(), handleError(), isRecord(), observedClientIp() (+33 more)

### Community 24 - "ContractFormPage.tsx"
Cohesion: 0.15
Nodes (13): ContractData, ContractFormPage(), Props, ContractVersionsButton(), ApiError, RequestOptions, withIds(), contractsQuery (+5 more)

### Community 25 - "Implementation Decisions"
Cohesion: 0.09
Nodes (22): Assinatura local, Concorrência, idempotência e storage, Especificação — Assinatura eletrônica própria no MVP, Estados e conclusão, Fingerprint e evidências, Fonte, PDF e revisões, Further Notes, GOV.BR e assinaturas externas (+14 more)

### Community 26 - "followups.integration.test.ts"
Cohesion: 0.15
Nodes (19): headers(), request(), schema, tenantIds, fixture(), headers(), post(), request() (+11 more)

### Community 27 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, jsdom, @tanstack/router-plugin, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, @types/react, @types/react-dom (+2 more)

### Community 28 - "@tanstack/react-router"
Cohesion: 0.14
Nodes (28): matchesPatient(), PatientRow(), QueryError(), appointmentsQuery, combosQuery, followupsQuery, patientsQuery, plansQuery (+20 more)

### Community 29 - "signatures.ts"
Cohesion: 0.08
Nodes (67): loadTrustedRootFiles(), loadTrustedRootsFromEnv(), NormalizedEvidence, normalizeEvidence(), RawFingerprint, canonicalJson(), ClinicSignatureActor, confirmExternalReturn() (+59 more)

### Community 30 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, noEmit, skipLibCheck, strict (+1 more)

### Community 31 - "Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF"
Cohesion: 0.15
Nodes (13): ContractVersion, 0005. Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos, Consequências, Contexto, Decisão, Further Notes, Implementation Decisions, Out of Scope (+5 more)

### Community 32 - "api/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, allowImportingTsExtensions, types, extends, include, ../../tsconfig.json

### Community 33 - "Clínicare"
Cohesion: 0.29
Nodes (6): Clínicare, Desenvolvimento sem Docker, Estrutura do monorepo, Rodar localmente via Docker (caminho recomendado), Stack, Verificações

### Community 34 - "db/src/index.ts"
Cohesion: 0.15
Nodes (20): AppLike, assertSafeIntegrationDatabase(), integration, integrationCookies, authAccounts, AuthSession, authSessions, AuthUser (+12 more)

### Community 36 - "Clínica de cuidados estéticos"
Cohesion: 0.20
Nodes (9): Attendance, Atendimento estético, Clínica de cuidados estéticos, Dados e ciclo de protótipo, Documentos e coleta, Jornada do paciente, Objetivo do produto, Organização da clínica (+1 more)

### Community 37 - "patients.ts"
Cohesion: 0.05
Nodes (59): buildContext(), contextForVersion(), createInitialSignatureProcesses(), dbRows(), formatCivilDate(), generateFollowupContract(), invalid(), protectedFollowupValue() (+51 more)

### Community 38 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 39 - "VersionsDialog.tsx"
Cohesion: 0.11
Nodes (33): AppointmentDetails(), dateLong, Props, Row(), time, FormDialog(), FormDialogProps, Dialog() (+25 more)

### Community 40 - "storage.ts"
Cohesion: 0.19
Nodes (20): docxMetadata(), getContractDraftEditor(), invalid(), publishContractDraft(), saveContractDraft(), sha256(), uuid(), bucket (+12 more)

### Community 41 - "-assinatura.$token.test.tsx"
Cohesion: 0.22
Nodes (3): @testing-library/jest-dom, @testing-library/react, @testing-library/user-event

### Community 42 - "db/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, types, extends, include, ../../tsconfig.json

### Community 43 - "Agent skills"
Cohesion: 0.29
Nodes (6): Agent skills, Domain docs, graphify, Issue tracker, This is NOT the Turborepo you know, Triage labels

### Community 44 - "scheduling.ts"
Cohesion: 0.17
Nodes (32): activeAppointmentStatuses, addAttendancePhoto(), appointmentResponse(), attendanceResponse(), attendanceShape(), cancelAttendance(), conflict(), createAppointment() (+24 more)

### Community 45 - "getDatabase"
Cohesion: 0.11
Nodes (44): addAnamnesisNote(), appliedShape(), byToken(), claimCleanupJob(), cleanupLease(), CleanupResult, CleanupStatus, clearDraft (+36 more)

### Community 46 - "procedimentos/index.tsx"
Cohesion: 0.10
Nodes (30): ContractSignatureHistory(), FollowupCard(), offerLabel, Body(), Entry, kinds, PatientTimeline(), StatusBadge() (+22 more)

### Community 47 - "relational-schema.ts"
Cohesion: 0.06
Nodes (31): appliedAnamnesisNotes, catalogTimestamps, contractVersionPdfUploadIntents, NewRelationalPatient, NewRelationalProcedure, NewTenant, paymentRelations, pdfUploadIntents (+23 more)

### Community 48 - "followups.ts"
Cohesion: 0.16
Nodes (16): Offer, fixture(), headers, patch(), post(), request(), reserve(), tenantId (+8 more)

### Community 49 - "Decisão e plano: PostgreSQL + Drizzle + JSONB"
Cohesion: 0.09
Nodes (21): 10. Go/no-go para implementação, 1. Conclusão, 2. Decisões de domínio confirmadas, 3. Modelo de domínio e estados, 4. Blueprint relacional inicial, 5. Matriz de invariantes, 6. Fronteiras transacionais, 7. Reaproveitamento do Git (+13 more)

### Community 50 - "dialogs.tsx"
Cohesion: 0.09
Nodes (35): AppointmentDialog(), AppointmentFields(), localDate(), localTime(), minutesBetween(), NewFollowupDialog(), OfferFields(), PaymentDialog() (+27 more)

### Community 51 - "Especificação: migração para PostgreSQL + Drizzle + JSONB"
Cohesion: 0.13
Nodes (14): API, frontend e operações de produto, Catálogo, planos e snapshots, Dados protegidos, Especificação: migração para PostgreSQL + Drizzle + JSONB, Further Notes, Implementation Decisions, Integridade e concorrência, Máquina de estados (+6 more)

### Community 52 - "api/package.json"
Cohesion: 0.10
Nodes (19): devDependencies, @types/bun, typescript, drizzle-orm, @types/bun, typescript, name, private (+11 more)

### Community 53 - "SchemaEditor.tsx"
Cohesion: 0.09
Nodes (40): AnamnesisFormPage(), submit(), Field, FieldPatch, identifierFor(), newSalt(), saltOf(), Schema (+32 more)

### Community 54 - "pdf-mutation.ts"
Cohesion: 0.36
Nodes (6): createIncrementalSignaturePdf(), normalizedPlacementToPdfRect(), PdfPlacement, PdfRect, sha256(), validatePlacement()

### Community 55 - "Validação de assinatura externa (GOV.BR) sem PAdES próprio"
Cohesion: 0.40
Nodes (4): Resultados, Revalidação em mutações posteriores (Issue #27), Validação de assinatura externa (GOV.BR) sem PAdES próprio, Verificações executadas (todas genuínas, nenhuma presumida)

### Community 56 - "_app.tsx"
Cohesion: 0.27
Nodes (14): QuickActions(), Sheet(), SheetClose(), SheetContent(), SheetDescription(), SheetHeader(), SheetOverlay(), SheetTitle() (+6 more)

### Community 57 - "dependencies"
Cohesion: 0.14
Nodes (14): dependencies, asn1js, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, better-auth, @better-auth/drizzle-adapter, @clinicare/db, docxtemplater (+6 more)

### Community 58 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, dev:debug, test, test:integration, typecheck

### Community 59 - "account-routes.ts"
Cohesion: 0.23
Nodes (11): BRAZILIAN_STATES, getProfessionalProfile(), REGISTRATION_TYPES, updateInitialPasswordChoice(), updateProfessionalProfile(), getAuth(), authHandler(), clinicSession (+3 more)

### Community 60 - "Issue tracker: GitHub"
Cohesion: 0.29
Nodes (6): Conventions, Issue tracker: GitHub, Pull requests as a triage surface, Wayfinding operations, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 61 - "Domain Docs"
Cohesion: 0.33
Nodes (5): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary

### Community 78 - "Investigação da validação global T7"
Cohesion: 0.40
Nodes (4): Correções e validação final, Evidências de escopo, Investigação da validação global T7, Resultado inicial

### Community 79 - "nova.tsx"
Cohesion: 0.67
Nodes (3): useCreateAnamnesis(), NewAnamnesis(), Route

### Community 80 - "contratos/novo.tsx"
Cohesion: 0.67
Nodes (3): useCreateContract(), NewContract(), Route

## Knowledge Gaps
- **541 isolated node(s):** `name`, `private`, `type`, `dev`, `dev:debug` (+536 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 642 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getDatabase()` connect `getDatabase` to `db/src/index.ts`, `patients.ts`, `catalog.ts`, `storage.ts`, `admin-commands.ts`, `external-mutations.integration.test.ts`, `scheduling.ts`, `followups.ts`, `db/package.json`, `api/package.json`, `app.ts`, `followups.integration.test.ts`, `account-routes.ts`, `signatures.ts`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `pg` connect `db/package.json` to `db/src/index.ts`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `web/package.json`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _541 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `atendimentos.$attendanceId.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.10984848484848485 - nodes in this community are weakly interconnected._
- **Should `external-validation.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08758503401360544 - nodes in this community are weakly interconnected._
- **Should `Button` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._