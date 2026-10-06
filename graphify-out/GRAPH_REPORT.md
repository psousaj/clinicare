# Graph Report - clinicare  (2026-10-06)

## Corpus Check
- 206 files · ~146,353 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 4, .css 3, .example 1)

## Summary
- 1691 nodes · 5155 edges · 87 communities (63 shown, 24 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 48 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bb1345a6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- db/src/index.ts
- external-validation.ts
- @tanstack/react-router
- assinatura.$token.tsx
- contract-materialization.ts
- queries.ts
- catalog.ts
- routeTree.gen.ts
- scripts
- auth.ts
- dependencies
- external-mutations.integration.test.ts
- Assinatura eletrônica própria — especificação completa
- Assinatura eletrônica própria — MVP
- web/package.json
- Especificação: MVP para clínicas pequenas de estética
- admin-commands.ts
- tasks
- components.json
- FileRoutesByPath
- -assinatura.$token.test.tsx
- compilerOptions
- app.ts
- lucide-react
- Implementation Decisions
- followups.ts
- devDependencies
- QueryError
- signatures.ts
- compilerOptions
- Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF
- api/tsconfig.json
- Clínicare
- patients.ts
- Clínica de cuidados estéticos
- payments.ts
- scripts
- Button
- atendimentos.$attendanceId.tsx
- createFollowup
- db/tsconfig.json
- Agent skills
- scheduling.ts
- getDatabase
- contract-authoring.ts
- relational-schema.ts
- dialogs.tsx
- Decisão e plano: PostgreSQL + Drizzle + JSONB
- procedimentos/index.tsx
- Especificação: migração para PostgreSQL + Drizzle + JSONB
- api/package.json
- SchemaEditor.tsx
- SigningWorkspace
- Validação de assinatura externa (GOV.BR) sem PAdES próprio
- _app.tsx
- dependencies
- scripts
- nova.tsx
- Issue tracker: GitHub
- Domain Docs
- Persistência PostgreSQL + Drizzle + JSONB
- triage-labels.md
- Preservação incremental de PDFs com assinaturas externas
- ContractFormPage
- Investigação da validação global T7
- forms.ts
- relationship.ts
- docx-types.d.ts
- Route
- DB_SCHEMA.md
- generate-secrets.ts
- request
- request

## God Nodes (most connected - your core abstractions)
1. `getDatabase()` - 143 edges
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

### Community 0 - "db/src/index.ts"
Cohesion: 0.12
Nodes (27): headers(), request(), schema, tenantIds, AppLike, assertSafeIntegrationDatabase(), cleanupIntegrationClinics(), integration (+19 more)

### Community 1 - "external-validation.ts"
Cohesion: 0.09
Nodes (43): buildSignedReturnPdf(), buildUnparsableCmsReturn(), createTestCa(), ensureOpensslAvailable(), issueDatedTestSigner(), issueTestSigner(), num10(), parseBaseTrailer() (+35 more)

### Community 2 - "@tanstack/react-router"
Cohesion: 0.13
Nodes (31): emptySchema, Props, ComboFormPage(), day(), ContractData, Props, AppointmentFields(), Field() (+23 more)

### Community 3 - "assinatura.$token.tsx"
Cohesion: 0.12
Nodes (17): CollectedFingerprint, anySchema, GovBrState, PageGeometry, PhoneGate(), Position, PublicHistoryEvent, PublicHistoryRevision (+9 more)

### Community 4 - "contract-materialization.ts"
Cohesion: 0.14
Nodes (23): assertRequiredContext(), ContextConfiguration, CONTRACT_CONTEXT_INCOMPLETE, defaultContextConfiguration(), DOCX_CONTENT_TYPE, extractTags(), hasValue(), inspectDocxPlaceholders() (+15 more)

### Community 5 - "queries.ts"
Cohesion: 0.07
Nodes (39): everything, keys, MutationConfig, patientRefresh, plansQuery, useUpdatePlan(), anamnesisSchema, AnamnesisVersion (+31 more)

### Community 6 - "catalog.ts"
Cohesion: 0.09
Nodes (37): addAnamnesisVersion(), addContractVersion(), addContractVersionTx(), anamnesisResponse(), associateAnamnesis(), catalogTenant(), comboResponse(), comboValid() (+29 more)

### Community 7 - "routeTree.gen.ts"
Cohesion: 0.06
Nodes (35): AppAgendaRoute, AppContratosContractIdRoute, AppContratosIndexRoute, AppContratosNovoRoute, AppFinanceiroRoute, AppFormulariosAnamneseAnamnesisIdRoute, AppFormulariosAnamneseIndexRoute, AppFormulariosAnamneseNovaRoute (+27 more)

### Community 8 - "scripts"
Cohesion: 0.05
Nodes (36): devDependencies, turbo, engines, node, name, packageManager, private, scripts (+28 more)

### Community 9 - "auth.ts"
Cohesion: 0.24
Nodes (6): AuthInstance, getTrustedOrigins(), SESSION_DURATION_SECONDS, authSchema, better-auth, @better-auth/drizzle-adapter

### Community 10 - "dependencies"
Cohesion: 0.06
Nodes (31): dependencies, class-variance-authority, clsx, date-fns, @fingerprintjs/fingerprintjs, @fullcalendar/core, @fullcalendar/interaction, @fullcalendar/react (+23 more)

### Community 11 - "external-mutations.integration.test.ts"
Cohesion: 0.11
Nodes (37): request(), deleteAppliedDocument(), placement, placement, ADR-0004, integrationHeaders(), placement, request() (+29 more)

### Community 12 - "Assinatura eletrônica própria — especificação completa"
Cohesion: 0.09
Nodes (22): 10. Selo da plataforma e gestão de chaves, 11. Pacote exportável e verificação independente, 12. Recuperação, revogação e tempo, 13. Limites de confiança, 14. Critérios de aceitação, 1. Objetivo e decisões de produto, 2. O que o sistema pretende demonstrar, 3.1. Fingerprint obrigatório desde o MVP (+14 more)

### Community 13 - "Assinatura eletrônica própria — MVP"
Cohesion: 0.09
Nodes (22): 10. Histórico, armazenamento e download, 11. Estrutura preparada para evolução, 12. O que fica fora deste MVP, 13. Critérios para considerar o MVP pronto, 14. Limite da evolução futura, 1. Objetivo, 2. Fluxo oficial, também mantido na produção, 3.1. Fingerprint obrigatório desde o MVP (+14 more)

### Community 14 - "web/package.json"
Cohesion: 0.07
Nodes (27): typescript, name, private, type, CalendarEntry, class-variance-authority, clsx, date-fns (+19 more)

### Community 15 - "Especificação: MVP para clínicas pequenas de estética"
Cohesion: 0.10
Nodes (18): ADR 0001: Stack da aplicação, Alternativas consideradas, Consequências, Contexto, Decisão, ADR 0002: Controle de acesso para dados clínicos no MVP, Alternativas consideradas, Consequências (+10 more)

### Community 16 - "admin-commands.ts"
Cohesion: 0.05
Nodes (48): administratorByEmail(), BOOTSTRAP_ENV_KEYS, bootstrapConfigFromEnv(), changeClinicAdministratorEmail(), createBetterAuthClinicAdministrator(), deactivateTenant(), normalizeEmail(), provisionClinic() (+40 more)

### Community 17 - "tasks"
Cohesion: 0.08
Nodes (23): dependsOn, inputs, outputs, cache, cache, persistent, env, inputs (+15 more)

### Community 18 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 19 - "FileRoutesByPath"
Cohesion: 0.10
Nodes (21): Route, Route, Route, Route, Route, Route, Route, Route (+13 more)

### Community 21 - "-assinatura.$token.test.tsx"
Cohesion: 0.11
Nodes (15): Handler, marina, renderAt(), queryClient, router, createAppRouter(), createQueryClient(), Register (+7 more)

### Community 22 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+8 more)

### Community 23 - "app.ts"
Cohesion: 0.11
Nodes (33): BRAZILIAN_STATES, getProfessionalProfile(), REGISTRATION_TYPES, updateInitialPasswordChoice(), updateProfessionalProfile(), app, appointmentStatusLabel, authTenant() (+25 more)

### Community 24 - "lucide-react"
Cohesion: 0.14
Nodes (21): StandaloneAttendanceDialog(), matchesPatient(), PatientRow(), Body(), Entry, kinds, PatientTimeline(), PendingRequirements() (+13 more)

### Community 25 - "Implementation Decisions"
Cohesion: 0.09
Nodes (22): Assinatura local, Concorrência, idempotência e storage, Especificação — Assinatura eletrônica própria no MVP, Estados e conclusão, Fingerprint e evidências, Fonte, PDF e revisões, Further Notes, GOV.BR e assinaturas externas (+14 more)

### Community 26 - "followups.ts"
Cohesion: 0.10
Nodes (30): fixture(), headers(), post(), request(), Offer, fixture(), headers, patch() (+22 more)

### Community 27 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, jsdom, @tanstack/router-plugin, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, @types/react, @types/react-dom (+2 more)

### Community 28 - "QueryError"
Cohesion: 0.13
Nodes (32): AttendanceRecordForm(), QueryError(), ContractVersionsButton(), Props, Version, VersionsButton(), VersionsTrigger(), anamnesesQuery (+24 more)

### Community 29 - "signatures.ts"
Cohesion: 0.07
Nodes (78): loadTrustedRootFiles(), loadTrustedRootsFromEnv(), createIncrementalSignaturePdf(), normalizedPlacementToPdfRect(), PdfPlacement, PdfRect, sha256(), validatePlacement() (+70 more)

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

### Community 34 - "patients.ts"
Cohesion: 0.13
Nodes (21): createPatient(), deactivatePatient(), DEFAULT_TENANT_ID, encryptedColumns(), ensureTenant(), getPatient(), isUuid(), listPatients() (+13 more)

### Community 36 - "Clínica de cuidados estéticos"
Cohesion: 0.20
Nodes (9): Attendance, Atendimento estético, Clínica de cuidados estéticos, Dados e ciclo de protótipo, Documentos e coleta, Jornada do paciente, Objetivo do produto, Organização da clínica (+1 more)

### Community 37 - "payments.ts"
Cohesion: 0.10
Nodes (37): buildContext(), contextForVersion(), createInitialSignatureProcesses(), dbRows(), formatCivilDate(), generateFollowupContract(), invalid(), protectedFollowupValue() (+29 more)

### Community 38 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 39 - "Button"
Cohesion: 0.22
Nodes (21): AppointmentDetails(), dateLong, Props, Row(), time, FormDialog(), FormDialogProps, Button() (+13 more)

### Community 40 - "atendimentos.$attendanceId.tsx"
Cohesion: 0.10
Nodes (27): allowed, AttendancePhotos(), Phase, phases, Props, SchemaForm(), api(), withIds() (+19 more)

### Community 41 - "createFollowup"
Cohesion: 0.21
Nodes (12): createFollowup(), hashToken(), invalid(), issueInitialTokens(), latest(), notFound(), offerForms(), protect() (+4 more)

### Community 42 - "db/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, types, extends, include, ../../tsconfig.json

### Community 43 - "Agent skills"
Cohesion: 0.29
Nodes (6): Agent skills, Domain docs, graphify, Issue tracker, This is NOT the Turborepo you know, Triage labels

### Community 44 - "scheduling.ts"
Cohesion: 0.15
Nodes (34): activeAppointmentStatuses, addAttendancePhoto(), appointmentResponse(), attendanceResponse(), attendanceShape(), cancelAttendance(), confirmAppointment(), conflict() (+26 more)

### Community 45 - "getDatabase"
Cohesion: 0.10
Nodes (49): addAnamnesisNote(), answerAppliedAnamnesis(), appliedShape(), byToken(), claimCleanupJob(), cleanupLease(), CleanupResult, CleanupStatus (+41 more)

### Community 46 - "contract-authoring.ts"
Cohesion: 0.35
Nodes (10): docxMetadata(), invalid(), publishContractDraft(), saveContractDraft(), sha256(), uuid(), copyVerifiedObject(), headObject() (+2 more)

### Community 47 - "relational-schema.ts"
Cohesion: 0.07
Nodes (28): catalogTimestamps, contractVersionPdfUploadIntents, NewRelationalPatient, NewRelationalProcedure, NewTenant, paymentRelations, RelationalAnamnesis, RelationalAnamnesisVersion (+20 more)

### Community 48 - "dialogs.tsx"
Cohesion: 0.12
Nodes (31): CalendarView(), AppointmentDialog(), localDate(), localTime(), minutesBetween(), NewFollowupDialog(), PlannedItem, Selection (+23 more)

### Community 49 - "Decisão e plano: PostgreSQL + Drizzle + JSONB"
Cohesion: 0.09
Nodes (21): 10. Go/no-go para implementação, 1. Conclusão, 2. Decisões de domínio confirmadas, 3. Modelo de domínio e estados, 4. Blueprint relacional inicial, 5. Matriz de invariantes, 6. Fronteiras transacionais, 7. Reaproveitamento do Git (+13 more)

### Community 50 - "procedimentos/index.tsx"
Cohesion: 0.11
Nodes (35): ContractSignatureHistory(), OfferFields(), PaymentDialog(), FollowupCard(), offerLabel, StatusBadge(), tones, NativeSelect() (+27 more)

### Community 51 - "Especificação: migração para PostgreSQL + Drizzle + JSONB"
Cohesion: 0.13
Nodes (14): API, frontend e operações de produto, Catálogo, planos e snapshots, Dados protegidos, Especificação: migração para PostgreSQL + Drizzle + JSONB, Further Notes, Implementation Decisions, Integridade e concorrência, Máquina de estados (+6 more)

### Community 52 - "api/package.json"
Cohesion: 0.12
Nodes (16): devDependencies, @types/bun, typescript, drizzle-orm, @types/bun, typescript, name, private (+8 more)

### Community 53 - "SchemaEditor.tsx"
Cohesion: 0.07
Nodes (51): AnamnesisFormPage(), submit(), ProcedurePicker(), Column(), DatePicker(), hours, minutes, PickerProps (+43 more)

### Community 54 - "SigningWorkspace"
Cohesion: 0.24
Nodes (12): collectFingerprint(), GovBrSection(), acceptReturn(), cancelAttempt(), exportRevision(), importReturn(), postJson(), SigningWorkspace() (+4 more)

### Community 55 - "Validação de assinatura externa (GOV.BR) sem PAdES próprio"
Cohesion: 0.40
Nodes (4): Resultados, Revalidação em mutações posteriores (Issue #27), Validação de assinatura externa (GOV.BR) sem PAdES próprio, Verificações executadas (todas genuínas, nenhuma presumida)

### Community 56 - "_app.tsx"
Cohesion: 0.26
Nodes (14): Sheet(), SheetClose(), SheetContent(), SheetDescription(), SheetHeader(), SheetOverlay(), SheetTitle(), SheetTrigger() (+6 more)

### Community 57 - "dependencies"
Cohesion: 0.14
Nodes (14): dependencies, asn1js, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, better-auth, @better-auth/drizzle-adapter, @clinicare/db, docxtemplater (+6 more)

### Community 58 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, dev:debug, test, test:integration, typecheck

### Community 59 - "nova.tsx"
Cohesion: 0.67
Nodes (3): useCreateAnamnesis(), NewAnamnesis(), Route

### Community 60 - "Issue tracker: GitHub"
Cohesion: 0.29
Nodes (6): Conventions, Issue tracker: GitHub, Pull requests as a triage surface, Wayfinding operations, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 61 - "Domain Docs"
Cohesion: 0.33
Nodes (5): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary

### Community 77 - "ContractFormPage"
Cohesion: 0.47
Nodes (4): ContractFormPage(), useCreateContract(), NewContract(), Route

### Community 78 - "Investigação da validação global T7"
Cohesion: 0.40
Nodes (4): Correções e validação final, Evidências de escopo, Investigação da validação global T7, Resultado inicial

### Community 79 - "forms.ts"
Cohesion: 0.14
Nodes (11): anamnesisForm, appointmentForm, comboForm, followupForm, optionalInt, optionalReais, optionalText, patientForm (+3 more)

## Knowledge Gaps
- **544 isolated node(s):** `name`, `private`, `type`, `dev`, `dev:debug` (+539 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 646 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **24 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getDatabase()` connect `getDatabase` to `db/src/index.ts`, `patients.ts`, `payments.ts`, `catalog.ts`, `auth.ts`, `createFollowup`, `external-mutations.integration.test.ts`, `scheduling.ts`, `contract-authoring.ts`, `admin-commands.ts`, `app.ts`, `followups.ts`, `signatures.ts`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `pg` connect `admin-commands.ts` to `db/src/index.ts`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `web/package.json`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _544 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `db/src/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11538461538461539 - nodes in this community are weakly interconnected._
- **Should `external-validation.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08758503401360544 - nodes in this community are weakly interconnected._
- **Should `@tanstack/react-router` be split into smaller, more focused modules?**
  _Cohesion score 0.1259259259259259 - nodes in this community are weakly interconnected._