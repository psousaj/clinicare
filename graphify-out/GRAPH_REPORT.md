# Graph Report - clinicare  (2026-10-06)

## Corpus Check
- 214 files · ~149,074 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 11 file(s) not represented in the graph (top: (none) 4, .css 3, .example 1)

## Summary
- 1726 nodes · 5273 edges · 87 communities (62 shown, 25 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 48 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `62e095c6`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- db/src/index.ts
- external-validation.ts
- react
- assinatura.$token.tsx
- contract-materialization.ts
- queries.ts
- scheduling.integration.test.ts
- routeTree.gen.ts
- scripts
- admin-commands.ts
- dependencies
- signatures.ts
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
- auth.ts
- Implementation Decisions
- followups.ts
- devDependencies
- ComboForm.tsx
- invalid
- compilerOptions
- Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF
- api/tsconfig.json
- Clínicare
- payments.ts
- -assinatura.$token.test.tsx
- Clínica de cuidados estéticos
- patients.ts
- scripts
- Button
- account-routes.ts
- getDatabase
- db/tsconfig.json
- Agent skills
- scheduling.ts
- app.ts
- clinical.integration.test.ts
- relational-schema.ts
- pdf-mutation.ts
- Decisão e plano: PostgreSQL + Drizzle + JSONB
- @tanstack/react-router
- Especificação: migração para PostgreSQL + Drizzle + JSONB
- api/package.json
- SchemaEditor.tsx
- auth-routes.ts
- Validação de assinatura externa (GOV.BR) sem PAdES próprio
- _app.tsx
- relationship.ts
- dependencies
- storage-config.ts
- Issue tracker: GitHub
- Domain Docs
- Persistência PostgreSQL + Drizzle + JSONB
- triage-labels.md
- Preservação incremental de PDFs com assinaturas externas
- scripts
- Investigação da validação global T7
- dialogs.tsx
- signature-evidence.ts
- docx-types.d.ts
- __root.tsx
- DB_SCHEMA.md
- combos/novo.tsx
- procedimentos/novo.tsx
- AnamnesisFormPage.tsx

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

## Communities (87 total, 25 thin omitted)

### Community 0 - "db/src/index.ts"
Cohesion: 0.14
Nodes (21): AppLike, assertSafeIntegrationDatabase(), cleanupIntegrationClinics(), integration, IntegrationClinic, integrationCookies, provisionIntegrationClinic(), authAccounts (+13 more)

### Community 1 - "external-validation.ts"
Cohesion: 0.08
Nodes (44): buildSignedReturnPdf(), buildUnparsableCmsReturn(), createTestCa(), ensureOpensslAvailable(), issueDatedTestSigner(), issueTestSigner(), num10(), parseBaseTrailer() (+36 more)

### Community 2 - "react"
Cohesion: 0.10
Nodes (39): AttendancePhotos(), AttendanceRecordForm(), CpfField(), EditPatientDialog(), Field(), FormPage(), emptySchema, ProcedureFormPage() (+31 more)

### Community 3 - "assinatura.$token.tsx"
Cohesion: 0.10
Nodes (28): CollectedFingerprint, collectFingerprint(), anySchema, GovBrSection(), acceptReturn(), cancelAttempt(), exportRevision(), importReturn() (+20 more)

### Community 4 - "contract-materialization.ts"
Cohesion: 0.09
Nodes (35): docxMetadata(), invalid(), publishContractDraft(), saveContractDraft(), sha256(), uuid(), assertRequiredContext(), ContextConfiguration (+27 more)

### Community 5 - "queries.ts"
Cohesion: 0.04
Nodes (86): allowed, Phase, phases, contextDescription(), contextLabel(), CONTEXTS, ContractDraftPanel(), ContractFormPage() (+78 more)

### Community 6 - "scheduling.integration.test.ts"
Cohesion: 0.15
Nodes (16): fixture(), headers, patch(), post(), request(), reserve(), tenantId, appointmentItems (+8 more)

### Community 7 - "routeTree.gen.ts"
Cohesion: 0.06
Nodes (35): AppAgendaRoute, AppContratosContractIdRoute, AppContratosIndexRoute, AppContratosNovoRoute, AppFinanceiroRoute, AppFormulariosAnamneseAnamnesisIdRoute, AppFormulariosAnamneseIndexRoute, AppFormulariosAnamneseNovaRoute (+27 more)

### Community 8 - "scripts"
Cohesion: 0.05
Nodes (36): devDependencies, turbo, engines, node, name, packageManager, private, scripts (+28 more)

### Community 9 - "admin-commands.ts"
Cohesion: 0.18
Nodes (13): administratorByEmail(), BOOTSTRAP_ENV_KEYS, bootstrapConfigFromEnv(), changeClinicAdministratorEmail(), createBetterAuthClinicAdministrator(), deactivateTenant(), normalizeEmail(), provisionClinic() (+5 more)

### Community 10 - "dependencies"
Cohesion: 0.06
Nodes (32): dependencies, class-variance-authority, clsx, date-fns, @fingerprintjs/fingerprintjs, @fullcalendar/core, @fullcalendar/interaction, @fullcalendar/react (+24 more)

### Community 11 - "signatures.ts"
Cohesion: 0.08
Nodes (45): request(), deleteAppliedDocument(), placement, request(), placement, request(), ADR-0004, placement (+37 more)

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
Nodes (33): dependencies, drizzle-orm, pg, devDependencies, drizzle-kit, @types/bun, @types/pg, typescript (+25 more)

### Community 17 - "tasks"
Cohesion: 0.08
Nodes (23): dependsOn, inputs, outputs, cache, cache, persistent, env, inputs (+15 more)

### Community 18 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 19 - "FileRoutesByPath"
Cohesion: 0.07
Nodes (27): Route, Route, Route, Route, Route, Route, Route, Route (+19 more)

### Community 21 - "App.test.tsx"
Cohesion: 0.19
Nodes (7): Handler, marina, @noble/hashes, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, vitest

### Community 22 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+8 more)

### Community 23 - "auth.ts"
Cohesion: 0.24
Nodes (6): AuthInstance, getTrustedOrigins(), SESSION_DURATION_SECONDS, authSchema, better-auth, @better-auth/drizzle-adapter

### Community 25 - "Implementation Decisions"
Cohesion: 0.09
Nodes (22): Assinatura local, Concorrência, idempotência e storage, Especificação — Assinatura eletrônica própria no MVP, Estados e conclusão, Fingerprint e evidências, Fonte, PDF e revisões, Further Notes, GOV.BR e assinaturas externas (+14 more)

### Community 26 - "followups.ts"
Cohesion: 0.09
Nodes (37): consumeContractVersionPdfUploadIntent(), headers(), request(), schema, tenantIds, validPdfMetadata(), validSha256(), validUuid() (+29 more)

### Community 27 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, jsdom, @tanstack/router-plugin, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, @types/react, @types/react-dom (+2 more)

### Community 28 - "ComboForm.tsx"
Cohesion: 0.22
Nodes (16): ComboFormPage(), day(), ProcedurePicker(), Column(), DatePicker(), hours, minutes, PickerProps (+8 more)

### Community 29 - "invalid"
Cohesion: 0.10
Nodes (49): normalizeEvidence(), canonicalJson(), confirmExternalReturn(), currentDocument(), decodePng(), displayName(), downloadExternalExport(), evidenceAad() (+41 more)

### Community 30 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, noEmit, skipLibCheck, strict (+1 more)

### Community 31 - "Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF"
Cohesion: 0.13
Nodes (15): Contract, ContractVersion, 0005. Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos, Consequências, Contexto, Decisão, Emenda — 2026-10-07 (Issue #32: LibreOffice headless sob demanda, ONLYOFFICE aposentado), Further Notes (+7 more)

### Community 32 - "api/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, allowImportingTsExtensions, types, extends, include, ../../tsconfig.json

### Community 33 - "Clínicare"
Cohesion: 0.29
Nodes (6): Clínicare, Desenvolvimento sem Docker, Estrutura do monorepo, Rodar localmente via Docker (caminho recomendado), Stack, Verificações

### Community 34 - "payments.ts"
Cohesion: 0.10
Nodes (37): addAnamnesisNote(), noteValue(), buildContext(), contextForVersion(), createInitialSignatureProcesses(), dbRows(), formatCivilDate(), generateFollowupContract() (+29 more)

### Community 35 - "-assinatura.$token.test.tsx"
Cohesion: 0.15
Nodes (10): renderAt(), queryClient, router, createAppRouter(), createQueryClient(), Register, @tanstack/react-router, renderPage() (+2 more)

### Community 36 - "Clínica de cuidados estéticos"
Cohesion: 0.20
Nodes (9): Attendance, Atendimento estético, Clínica de cuidados estéticos, Dados e ciclo de protótipo, Documentos e coleta, Jornada do paciente, Objetivo do produto, Organização da clínica (+1 more)

### Community 37 - "patients.ts"
Cohesion: 0.13
Nodes (21): createPatient(), deactivatePatient(), DEFAULT_TENANT_ID, encryptedColumns(), ensureTenant(), getPatient(), isUuid(), listPatients() (+13 more)

### Community 38 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 39 - "Button"
Cohesion: 0.14
Nodes (34): AppointmentDetails(), dateLong, Props, Row(), time, FormDialog(), FormDialogProps, FormPageProps (+26 more)

### Community 40 - "account-routes.ts"
Cohesion: 0.21
Nodes (10): BRAZILIAN_STATES, getProfessionalProfile(), REGISTRATION_TYPES, updateInitialPasswordChoice(), updateProfessionalProfile(), seedConfiguredAdministrator(), clinicSession, connectPostgresDatabase() (+2 more)

### Community 41 - "getDatabase"
Cohesion: 0.11
Nodes (44): answerAppliedAnamnesis(), appliedShape(), byToken(), claimCleanupJob(), cleanupLease(), CleanupResult, CleanupStatus, clearDraft (+36 more)

### Community 42 - "db/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, types, extends, include, ../../tsconfig.json

### Community 43 - "Agent skills"
Cohesion: 0.29
Nodes (6): Agent skills, Domain docs, graphify, Issue tracker, This is NOT the Turborepo you know, Triage labels

### Community 44 - "scheduling.ts"
Cohesion: 0.15
Nodes (35): activeAppointmentStatuses, addAttendancePhoto(), appointmentResponse(), attendanceResponse(), attendanceShape(), cancelAttendance(), confirmAppointment(), conflict() (+27 more)

### Community 45 - "app.ts"
Cohesion: 0.06
Nodes (62): app, appointmentStatusLabel, authTenant(), expiry(), fail(), handleError(), isRecord(), observedClientIp() (+54 more)

### Community 46 - "clinical.integration.test.ts"
Cohesion: 0.21
Nodes (9): fixture(), headers(), post(), request(), integrationHeaders(), appliedAnamnesisNotes, appliedDocumentRevisions, documentCleanupJobs (+1 more)

### Community 47 - "relational-schema.ts"
Cohesion: 0.07
Nodes (28): catalogTimestamps, contractVersionPdfUploadIntents, NewRelationalPatient, NewRelationalProcedure, NewTenant, paymentRelations, RelationalAnamnesis, RelationalAnamnesisVersion (+20 more)

### Community 48 - "pdf-mutation.ts"
Cohesion: 0.36
Nodes (6): createIncrementalSignaturePdf(), normalizedPlacementToPdfRect(), PdfPlacement, PdfRect, sha256(), validatePlacement()

### Community 49 - "Decisão e plano: PostgreSQL + Drizzle + JSONB"
Cohesion: 0.09
Nodes (21): 10. Go/no-go para implementação, 1. Conclusão, 2. Decisões de domínio confirmadas, 3. Modelo de domínio e estados, 4. Blueprint relacional inicial, 5. Matriz de invariantes, 6. Fronteiras transacionais, 7. Reaproveitamento do Git (+13 more)

### Community 50 - "@tanstack/react-router"
Cohesion: 0.09
Nodes (47): CalendarView(), NewFollowupDialog(), matchesPatient(), PatientRow(), Body(), Entry, kinds, PatientTimeline() (+39 more)

### Community 51 - "Especificação: migração para PostgreSQL + Drizzle + JSONB"
Cohesion: 0.13
Nodes (14): API, frontend e operações de produto, Catálogo, planos e snapshots, Dados protegidos, Especificação: migração para PostgreSQL + Drizzle + JSONB, Further Notes, Implementation Decisions, Integridade e concorrência, Máquina de estados (+6 more)

### Community 52 - "api/package.json"
Cohesion: 0.12
Nodes (16): devDependencies, @types/bun, typescript, drizzle-orm, @types/bun, typescript, name, private (+8 more)

### Community 53 - "SchemaEditor.tsx"
Cohesion: 0.10
Nodes (39): submit(), Field, FieldPatch, identifierFor(), newSalt(), saltOf(), Schema, SchemaEditor() (+31 more)

### Community 54 - "auth-routes.ts"
Cohesion: 0.70
Nodes (4): getAuth(), authHandler(), getClinicSession(), requireClinicSession()

### Community 55 - "Validação de assinatura externa (GOV.BR) sem PAdES próprio"
Cohesion: 0.40
Nodes (4): Resultados, Revalidação em mutações posteriores (Issue #27), Validação de assinatura externa (GOV.BR) sem PAdES próprio, Verificações executadas (todas genuínas, nenhuma presumida)

### Community 56 - "_app.tsx"
Cohesion: 0.29
Nodes (13): Sheet(), SheetClose(), SheetContent(), SheetDescription(), SheetHeader(), SheetOverlay(), SheetTitle(), SheetTrigger() (+5 more)

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

### Community 79 - "dialogs.tsx"
Cohesion: 0.09
Nodes (46): ContractSignatureHistory(), AppointmentDialog(), AppointmentFields(), localDate(), localTime(), minutesBetween(), OfferFields(), PaymentDialog() (+38 more)

### Community 88 - "AnamnesisFormPage.tsx"
Cohesion: 0.18
Nodes (13): AnamnesisFormPage(), emptySchema, Props, ApiError, anamnesesQuery, useCreateAnamnesis(), useUpdateAnamnesis(), Anamnesis (+5 more)

## Knowledge Gaps
- **551 isolated node(s):** `name`, `private`, `type`, `dev`, `dev:debug` (+546 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 653 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `App.test.tsx` to `-assinatura.$token.test.tsx`, `SchemaEditor.tsx`, `web/package.json`?**
  _High betweenness centrality (0.142) - this node is a cross-community bridge._
- **Why does `getDatabase()` connect `getDatabase` to `db/src/index.ts`, `payments.ts`, `contract-materialization.ts`, `patients.ts`, `scheduling.integration.test.ts`, `account-routes.ts`, `admin-commands.ts`, `signatures.ts`, `scheduling.ts`, `app.ts`, `clinical.integration.test.ts`, `db/package.json`, `auth-routes.ts`, `auth.ts`, `followups.ts`, `invalid`?**
  _High betweenness centrality (0.094) - this node is a cross-community bridge._
- **Why does `@tanstack/react-router` connect `@tanstack/react-router` to `react`, `-assinatura.$token.test.tsx`, `assinatura.$token.tsx`, `queries.ts`, `Button`, `web/package.json`, `dialogs.tsx`, `__root.tsx`, `combos/novo.tsx`, `App.test.tsx`, `procedimentos/novo.tsx`, `AnamnesisFormPage.tsx`, `_app.tsx`, `ComboForm.tsx`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _551 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `db/src/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13949579831932774 - nodes in this community are weakly interconnected._
- **Should `external-validation.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08489795918367347 - nodes in this community are weakly interconnected._
- **Should `react` be split into smaller, more focused modules?**
  _Cohesion score 0.09526592635885447 - nodes in this community are weakly interconnected._