# Graph Report - clinicare  (2026-10-06)

## Corpus Check
- 205 files · ~146,266 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 4, .css 3, .example 1)

## Summary
- 1688 nodes · 5152 edges · 84 communities (64 shown, 20 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 48 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bb1345a6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- db/src/index.ts
- external-validation.ts
- dialogs.tsx
- assinatura.$token.tsx
- contract-materialization.ts
- queries.ts
- getDatabase
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
- -assinatura.$token.test.tsx
- compilerOptions
- app.ts
- ContractFormPage.tsx
- Implementation Decisions
- followups.ts
- devDependencies
- @tanstack/react-router
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
- clinical.ts
- contract-authoring.ts
- relational-schema.ts
- CalendarView.tsx
- Decisão e plano: PostgreSQL + Drizzle + JSONB
- procedimentos/index.tsx
- Especificação: migração para PostgreSQL + Drizzle + JSONB
- api/package.json
- schemaUi.tsx
- main.tsx
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
- contratos/novo.tsx
- Investigação da validação global T7
- protect
- generateFollowupContract
- docx-types.d.ts
- __root.tsx
- DB_SCHEMA.md

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

## Communities (84 total, 20 thin omitted)

### Community 0 - "db/src/index.ts"
Cohesion: 0.15
Nodes (18): AppLike, assertSafeIntegrationDatabase(), integration, integrationCookies, authAccounts, AuthSession, authSessions, AuthUser (+10 more)

### Community 1 - "external-validation.ts"
Cohesion: 0.09
Nodes (43): buildSignedReturnPdf(), buildUnparsableCmsReturn(), createTestCa(), ensureOpensslAvailable(), issueDatedTestSigner(), issueTestSigner(), num10(), parseBaseTrailer() (+35 more)

### Community 2 - "dialogs.tsx"
Cohesion: 0.08
Nodes (53): AnamnesisFormPage(), submit(), emptySchema, Props, ComboFormPage(), day(), AppointmentFields(), localDate() (+45 more)

### Community 3 - "assinatura.$token.tsx"
Cohesion: 0.10
Nodes (28): CollectedFingerprint, collectFingerprint(), GovBrSection(), acceptReturn(), cancelAttempt(), exportRevision(), importReturn(), postJson() (+20 more)

### Community 4 - "contract-materialization.ts"
Cohesion: 0.14
Nodes (22): assertRequiredContext(), ContextConfiguration, CONTRACT_CONTEXT_INCOMPLETE, createOnlyOfficeConverter(), defaultContextConfiguration(), extractTags(), hasValue(), inspectDocxPlaceholders() (+14 more)

### Community 5 - "queries.ts"
Cohesion: 0.05
Nodes (78): allowed, Phase, phases, CalendarView(), AppointmentDialog(), PendingRequirements(), api(), photoPhases (+70 more)

### Community 6 - "getDatabase"
Cohesion: 0.09
Nodes (44): addAnamnesisVersion(), addContractVersion(), addContractVersionTx(), anamnesisResponse(), associateAnamnesis(), catalogTenant(), comboResponse(), comboValid() (+36 more)

### Community 7 - "routeTree.gen.ts"
Cohesion: 0.06
Nodes (35): AppAgendaRoute, AppContratosContractIdRoute, AppContratosIndexRoute, AppContratosNovoRoute, AppFinanceiroRoute, AppFormulariosAnamneseAnamnesisIdRoute, AppFormulariosAnamneseIndexRoute, AppFormulariosAnamneseNovaRoute (+27 more)

### Community 8 - "scripts"
Cohesion: 0.06
Nodes (35): devDependencies, turbo, engines, node, name, packageManager, private, scripts (+27 more)

### Community 9 - "admin-commands.ts"
Cohesion: 0.11
Nodes (21): administratorByEmail(), BOOTSTRAP_ENV_KEYS, bootstrapConfigFromEnv(), changeClinicAdministratorEmail(), createBetterAuthClinicAdministrator(), deactivateTenant(), normalizeEmail(), provisionClinic() (+13 more)

### Community 10 - "dependencies"
Cohesion: 0.06
Nodes (31): dependencies, class-variance-authority, clsx, date-fns, @fingerprintjs/fingerprintjs, @fullcalendar/core, @fullcalendar/interaction, @fullcalendar/react (+23 more)

### Community 11 - "external-mutations.integration.test.ts"
Cohesion: 0.11
Nodes (32): request(), deleteAppliedDocument(), headers(), placement, request(), placement, request(), ADR-0004 (+24 more)

### Community 12 - "Assinatura eletrônica própria — especificação completa"
Cohesion: 0.09
Nodes (22): 10. Selo da plataforma e gestão de chaves, 11. Pacote exportável e verificação independente, 12. Recuperação, revogação e tempo, 13. Limites de confiança, 14. Critérios de aceitação, 1. Objetivo e decisões de produto, 2. O que o sistema pretende demonstrar, 3.1. Fingerprint obrigatório desde o MVP (+14 more)

### Community 13 - "Assinatura eletrônica própria — MVP"
Cohesion: 0.09
Nodes (22): 10. Histórico, armazenamento e download, 11. Estrutura preparada para evolução, 12. O que fica fora deste MVP, 13. Critérios para considerar o MVP pronto, 14. Limite da evolução futura, 1. Objetivo, 2. Fluxo oficial, também mantido na produção, 3.1. Fingerprint obrigatório desde o MVP (+14 more)

### Community 14 - "web/package.json"
Cohesion: 0.09
Nodes (22): typescript, name, private, type, class-variance-authority, clsx, date-fns, jsdom (+14 more)

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
Cohesion: 0.10
Nodes (20): Route, Route, Route, Route, Route, Route, Route, Route (+12 more)

### Community 21 - "-assinatura.$token.test.tsx"
Cohesion: 0.14
Nodes (12): Handler, marina, renderAt(), createAppRouter(), createQueryClient(), Register, @tanstack/react-router, renderPage() (+4 more)

### Community 22 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+8 more)

### Community 23 - "app.ts"
Cohesion: 0.09
Nodes (40): BRAZILIAN_STATES, getProfessionalProfile(), REGISTRATION_TYPES, updateInitialPasswordChoice(), updateProfessionalProfile(), app, appointmentStatusLabel, authTenant() (+32 more)

### Community 24 - "ContractFormPage.tsx"
Cohesion: 0.18
Nodes (11): ContractData, ContractFormPage(), Props, OfferFields(), StandaloneAttendanceDialog(), NativeSelect(), NativeSelectOptGroup(), NativeSelectOption() (+3 more)

### Community 25 - "Implementation Decisions"
Cohesion: 0.09
Nodes (22): Assinatura local, Concorrência, idempotência e storage, Especificação — Assinatura eletrônica própria no MVP, Estados e conclusão, Fingerprint e evidências, Fonte, PDF e revisões, Further Notes, GOV.BR e assinaturas externas (+14 more)

### Community 26 - "followups.ts"
Cohesion: 0.13
Nodes (25): fixture(), post(), request(), Offer, cleanupIntegrationClinics(), IntegrationClinic, provisionIntegrationClinic(), fixture() (+17 more)

### Community 27 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, jsdom, @tanstack/router-plugin, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, @types/react, @types/react-dom (+2 more)

### Community 28 - "@tanstack/react-router"
Cohesion: 0.08
Nodes (50): NewFollowupDialog(), matchesPatient(), PatientRow(), Body(), Entry, kinds, PatientTimeline(), QueryError() (+42 more)

### Community 29 - "signatures.ts"
Cohesion: 0.06
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
Cohesion: 0.12
Nodes (23): createPatient(), deactivatePatient(), DEFAULT_TENANT_ID, encrypted(), encryptedColumns(), ensureTenant(), getPatient(), isUuid() (+15 more)

### Community 36 - "Clínica de cuidados estéticos"
Cohesion: 0.20
Nodes (9): Attendance, Atendimento estético, Clínica de cuidados estéticos, Dados e ciclo de protótipo, Documentos e coleta, Jornada do paciente, Objetivo do produto, Organização da clínica (+1 more)

### Community 37 - "payments.ts"
Cohesion: 0.10
Nodes (32): addAnamnesisNote(), noteValue(), unprotect(), protectedFollowupValue(), decryptMaterializationContext(), conflict(), createPayment(), deletePayment() (+24 more)

### Community 38 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 39 - "Button"
Cohesion: 0.10
Nodes (44): AppointmentDetails(), dateLong, Props, Row(), time, ProcedurePicker(), FormDialog(), FormDialogProps (+36 more)

### Community 40 - "atendimentos.$attendanceId.tsx"
Cohesion: 0.17
Nodes (16): AttendancePhotos(), AttendanceRecordForm(), Props, SchemaForm(), Textarea(), attendanceQuery(), publicFormQuery(), useCreateAttendance() (+8 more)

### Community 41 - "createFollowup"
Cohesion: 0.19
Nodes (13): createFollowup(), hashToken(), idShape(), invalid(), issueInitialTokens(), latest(), notFound(), offerForms() (+5 more)

### Community 42 - "db/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, types, extends, include, ../../tsconfig.json

### Community 43 - "Agent skills"
Cohesion: 0.29
Nodes (6): Agent skills, Domain docs, graphify, Issue tracker, This is NOT the Turborepo you know, Triage labels

### Community 44 - "scheduling.ts"
Cohesion: 0.15
Nodes (35): activeAppointmentStatuses, addAttendancePhoto(), appointmentResponse(), attendanceResponse(), attendanceShape(), cancelAttendance(), confirmAppointment(), conflict() (+27 more)

### Community 45 - "clinical.ts"
Cohesion: 0.12
Nodes (27): claimCleanupJob(), cleanupLease(), CleanupResult, CleanupStatus, clearDraft, documentOwnsCleanupKeys(), heartbeatCleanupJob(), heartbeatReservedCleanupJob() (+19 more)

### Community 46 - "contract-authoring.ts"
Cohesion: 0.33
Nodes (9): docxMetadata(), invalid(), publishContractDraft(), saveContractDraft(), sha256(), uuid(), DOCX_CONTENT_TYPE, PLACEHOLDERS (+1 more)

### Community 47 - "relational-schema.ts"
Cohesion: 0.05
Nodes (41): headers(), request(), schema, tenantIds, appointmentItems, attendancePhotos, catalogTimestamps, contracts (+33 more)

### Community 48 - "CalendarView.tsx"
Cohesion: 0.25
Nodes (5): CalendarEntry, @fullcalendar/core, @fullcalendar/interaction, @fullcalendar/react, @fullcalendar/timegrid

### Community 49 - "Decisão e plano: PostgreSQL + Drizzle + JSONB"
Cohesion: 0.09
Nodes (21): 10. Go/no-go para implementação, 1. Conclusão, 2. Decisões de domínio confirmadas, 3. Modelo de domínio e estados, 4. Blueprint relacional inicial, 5. Matriz de invariantes, 6. Fronteiras transacionais, 7. Reaproveitamento do Git (+13 more)

### Community 50 - "procedimentos/index.tsx"
Cohesion: 0.13
Nodes (28): ContractSignatureHistory(), PaymentDialog(), FollowupCard(), offerLabel, StatusBadge(), tones, appointmentStatus, currency() (+20 more)

### Community 51 - "Especificação: migração para PostgreSQL + Drizzle + JSONB"
Cohesion: 0.13
Nodes (14): API, frontend e operações de produto, Catálogo, planos e snapshots, Dados protegidos, Especificação: migração para PostgreSQL + Drizzle + JSONB, Further Notes, Implementation Decisions, Integridade e concorrência, Máquina de estados (+6 more)

### Community 52 - "api/package.json"
Cohesion: 0.12
Nodes (16): devDependencies, @types/bun, typescript, drizzle-orm, @types/bun, typescript, name, private (+8 more)

### Community 53 - "schemaUi.tsx"
Cohesion: 0.14
Nodes (23): buildField(), CPF_PATTERN, DEFAULT_OPTIONS, FieldKind, fieldKinds, formatCpf(), formatDigits(), formatPhone() (+15 more)

### Community 54 - "main.tsx"
Cohesion: 0.40
Nodes (3): queryClient, router, react-dom

### Community 55 - "Validação de assinatura externa (GOV.BR) sem PAdES próprio"
Cohesion: 0.40
Nodes (4): Resultados, Revalidação em mutações posteriores (Issue #27), Validação de assinatura externa (GOV.BR) sem PAdES próprio, Verificações executadas (todas genuínas, nenhuma presumida)

### Community 56 - "_app.tsx"
Cohesion: 0.29
Nodes (13): Sheet(), SheetClose(), SheetContent(), SheetDescription(), SheetHeader(), SheetOverlay(), SheetTitle(), SheetTrigger() (+5 more)

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

### Community 77 - "contratos/novo.tsx"
Cohesion: 0.67
Nodes (3): useCreateContract(), NewContract(), Route

### Community 78 - "Investigação da validação global T7"
Cohesion: 0.40
Nodes (4): Correções e validação final, Evidências de escopo, Investigação da validação global T7, Resultado inicial

### Community 79 - "protect"
Cohesion: 0.22
Nodes (11): answerAppliedAnamnesis(), byToken(), hashToken(), jsonValue(), protect(), publicShape(), readPublicAnamnesis(), saveAnamnesisDraft() (+3 more)

### Community 80 - "generateFollowupContract"
Cohesion: 0.27
Nodes (10): buildContext(), contextForVersion(), createInitialSignatureProcesses(), dbRows(), formatCivilDate(), generateFollowupContract(), invalid(), protectedValue() (+2 more)

## Knowledge Gaps
- **542 isolated node(s):** `name`, `private`, `type`, `dev`, `dev:debug` (+537 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 644 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `getDatabase()` connect `getDatabase` to `db/src/index.ts`, `patients.ts`, `payments.ts`, `admin-commands.ts`, `createFollowup`, `external-mutations.integration.test.ts`, `scheduling.ts`, `clinical.ts`, `contract-authoring.ts`, `relational-schema.ts`, `protect`, `generateFollowupContract`, `db/package.json`, `app.ts`, `followups.ts`, `signatures.ts`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `pg` connect `db/package.json` to `db/src/index.ts`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `web/package.json`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _542 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `external-validation.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08758503401360544 - nodes in this community are weakly interconnected._
- **Should `dialogs.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07577639751552795 - nodes in this community are weakly interconnected._
- **Should `assinatura.$token.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09659090909090909 - nodes in this community are weakly interconnected._