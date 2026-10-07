# Graph Report - clinicare  (2026-10-07)

## Corpus Check
- 238 files · ~168,971 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 13 file(s) not represented in the graph (top: (none) 6, .css 3, .example 1)

## Summary
- 1904 nodes · 5566 edges · 97 communities (70 shown, 27 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 61 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f129541e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- followups.integration.test.ts
- external-validation.ts
- dialogs.tsx
- assinatura.$token.tsx
- contract-materialization.ts
- queries.ts
- relational-history.ts
- routeTree.gen.ts
- scripts
- admin-commands.ts
- dependencies
- external-signatures.integration.test.ts
- Assinatura eletrônica própria — especificação completa
- Assinatura eletrônica própria — MVP
- web/package.json
- Especificação: MVP para clínicas pequenas de estética
- db/package.json
- tasks
- components.json
- FileRoutesByPath
- packages_db_src_index_appointment
- generate-secrets.ts
- compilerOptions
- auth.ts
- Workspace
- Implementation Decisions
- followups.ts
- devDependencies
- procedimentos/index.tsx
- signatures.ts
- compilerOptions
- Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF
- api/tsconfig.json
- Clínicare
- storage.ts
- -documentos.test.tsx
- Clínica de cuidados estéticos
- patients.ts
- scripts
- react
- payments.ts
- getDatabase
- db/tsconfig.json
- Agent skills
- scheduling.ts
- app.ts
- cn
- relational-schema.ts
- db/src/index.ts
- Decisão e plano: PostgreSQL + Drizzle + JSONB
- @tanstack/react-router
- Especificação: migração para PostgreSQL + Drizzle + JSONB
- api/package.json
- SchemaEditor.tsx
- CalendarView.tsx
- Validação de assinatura externa (GOV.BR) sem PAdES próprio
- encryptValue
- migrate.ts
- dependencies
- storage-config.ts
- Issue tracker: GitHub
- Domain Docs
- Persistência PostgreSQL + Drizzle + JSONB
- triage-labels.md
- packages_db_src_index_anamnesis
- packages_db_src_index_attendance
- packages_db_src_index_combo
- packages_db_src_index_contract
- packages_db_src_index_followup
- packages_db_src_index_patient
- packages_db_src_index_patientanamnesis
- packages_db_src_index_payment
- packages_db_src_index_plan
- packages_db_src_index_procedure
- ref_mongodb_memory_server
- ref_mongoose
- Preservação incremental de PDFs com assinaturas externas
- scripts
- Investigação da validação global T7
- planos/novo.tsx
- collectFingerprint
- docx-types.d.ts
- Route
- DB_SCHEMA.md
- SigningWorkspace
- nova.tsx
- docx-pdf.ts
- ref_node_fs
- VersionsDialog.tsx
- api/src/index.ts
- pdf-mutation.ts
- agenda.tsx
- request
- procedimentos/novo.tsx
- request
- request
- request

## God Nodes (most connected - your core abstractions)
1. `getDatabase()` - 146 edges
2. `app` - 122 edges
3. `cn()` - 55 edges
4. `@tanstack/react-router` - 52 edges
5. `react` - 50 edges
6. `@tanstack/react-query` - 42 edges
7. `lucide-react` - 42 edges
8. `api()` - 42 edges
9. `useApiMutation()` - 41 edges
10. `Button()` - 39 edges

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

## Communities (97 total, 27 thin omitted)

### Community 0 - "followups.integration.test.ts"
Cohesion: 0.10
Nodes (49): headers(), request(), schema, tenantIds, fixture(), headers(), post(), request() (+41 more)

### Community 1 - "external-validation.ts"
Cohesion: 0.09
Nodes (44): buildSignedReturnPdf(), buildUnparsableCmsReturn(), createTestCa(), ensureOpensslAvailable(), issueDatedTestSigner(), issueTestSigner(), num10(), parseBaseTrailer() (+36 more)

### Community 2 - "dialogs.tsx"
Cohesion: 0.06
Nodes (43): ComboFormPage(), day(), ProcedurePicker(), AppointmentDialog(), AppointmentFields(), localDate(), localTime(), minutesBetween() (+35 more)

### Community 3 - "assinatura.$token.tsx"
Cohesion: 0.11
Nodes (15): anySchema, GovBrState, PageGeometry, Position, PublicHistoryEvent, PublicHistoryRevision, Route, Signature (+7 more)

### Community 4 - "contract-materialization.ts"
Cohesion: 0.16
Nodes (21): assertRequiredContext(), ContextConfiguration, CONTRACT_CONTEXT_INCOMPLETE, defaultContextConfiguration(), DOCX_CONTENT_TYPE, extractTags(), hasValue(), inspectDocxPlaceholders() (+13 more)

### Community 5 - "queries.ts"
Cohesion: 0.03
Nodes (108): AttendancePhotos(), contextDescription(), contextLabel(), CONTEXTS, ContractDraftPanel(), ContractFormPage(), ContractMetadata, Props (+100 more)

### Community 6 - "relational-history.ts"
Cohesion: 0.20
Nodes (12): idShape(), getRelationalRelationship(), response(), buildRelationship(), monthKey(), packages_db_src_index_appointments, packages_db_src_index_attendancephotos, packages_db_src_index_attendances (+4 more)

### Community 7 - "routeTree.gen.ts"
Cohesion: 0.05
Nodes (40): AppAgendaRoute, AppConfiguracoesRoute, AppContratosContractIdRoute, AppContratosIndexRoute, AppContratosNovoRoute, AppDocumentosRoute, AppFinanceiroRoute, AppFormulariosAnamneseAnamnesisIdRoute (+32 more)

### Community 8 - "scripts"
Cohesion: 0.05
Nodes (36): devDependencies, turbo, engines, node, name, packageManager, private, scripts (+28 more)

### Community 9 - "admin-commands.ts"
Cohesion: 0.16
Nodes (19): administratorByEmail(), BOOTSTRAP_ENV_KEYS, bootstrapConfigFromEnv(), changeClinicAdministratorEmail(), createBetterAuthClinicAdministrator(), deactivateTenant(), normalizeEmail(), provisionClinic() (+11 more)

### Community 10 - "dependencies"
Cohesion: 0.06
Nodes (32): dependencies, class-variance-authority, clsx, date-fns, @fingerprintjs/fingerprintjs, @fullcalendar/core, @fullcalendar/interaction, @fullcalendar/react (+24 more)

### Community 11 - "external-signatures.integration.test.ts"
Cohesion: 0.11
Nodes (58): request(), deleteAppliedDocument(), placement, placement, ADR-0004, integrationHeaders(), placement, request() (+50 more)

### Community 12 - "Assinatura eletrônica própria — especificação completa"
Cohesion: 0.09
Nodes (22): 10. Selo da plataforma e gestão de chaves, 11. Pacote exportável e verificação independente, 12. Recuperação, revogação e tempo, 13. Limites de confiança, 14. Critérios de aceitação, 1. Objetivo e decisões de produto, 2. O que o sistema pretende demonstrar, 3.1. Fingerprint obrigatório desde o MVP (+14 more)

### Community 13 - "Assinatura eletrônica própria — MVP"
Cohesion: 0.09
Nodes (22): 10. Histórico, armazenamento e download, 11. Estrutura preparada para evolução, 12. O que fica fora deste MVP, 13. Critérios para considerar o MVP pronto, 14. Limite da evolução futura, 1. Objetivo, 2. Fluxo oficial, também mantido na produção, 3.1. Fingerprint obrigatório desde o MVP (+14 more)

### Community 14 - "web/package.json"
Cohesion: 0.07
Nodes (28): typescript, name, private, type, class-variance-authority, clsx, date-fns, jsdom (+20 more)

### Community 15 - "Especificação: MVP para clínicas pequenas de estética"
Cohesion: 0.10
Nodes (18): ADR 0001: Stack da aplicação, Alternativas consideradas, Consequências, Contexto, Decisão, ADR 0002: Controle de acesso para dados clínicos no MVP, Alternativas consideradas, Consequências (+10 more)

### Community 16 - "db/package.json"
Cohesion: 0.07
Nodes (27): dependencies, drizzle-orm, pg, devDependencies, drizzle-kit, @types/bun, @types/pg, typescript (+19 more)

### Community 17 - "tasks"
Cohesion: 0.08
Nodes (24): dependsOn, inputs, outputs, cache, cache, env, persistent, env (+16 more)

### Community 18 - "components.json"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 19 - "FileRoutesByPath"
Cohesion: 0.07
Nodes (27): Route, Route, Route, Route, Route, Route, Route, Route (+19 more)

### Community 22 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+8 more)

### Community 23 - "auth.ts"
Cohesion: 0.24
Nodes (7): AuthInstance, getTrustedOrigins(), SESSION_DURATION_SECONDS, authSchema, packages_db_src_index_authschema, better-auth, @better-auth/drizzle-adapter

### Community 24 - "Workspace"
Cohesion: 0.23
Nodes (10): Workspace(), captureDrawing(), clear(), placement(), runConfirm(), runPreview(), fetchProfessionalPdf(), composeStampImage() (+2 more)

### Community 25 - "Implementation Decisions"
Cohesion: 0.09
Nodes (22): Assinatura local, Concorrência, idempotência e storage, Especificação — Assinatura eletrônica própria no MVP, Estados e conclusão, Fingerprint e evidências, Fonte, PDF e revisões, Further Notes, GOV.BR e assinaturas externas (+14 more)

### Community 26 - "followups.ts"
Cohesion: 0.26
Nodes (15): createFollowup(), hashToken(), idShape(), invalid(), issueInitialTokens(), latest(), notFound(), Offer (+7 more)

### Community 27 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, jsdom, @tanstack/router-plugin, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, @types/node, @types/react (+3 more)

### Community 28 - "procedimentos/index.tsx"
Cohesion: 0.16
Nodes (15): NativeSelect(), NativeSelectOptGroup(), NativeSelectOption(), Tone, professionalProfileQuery, sessionQuery, useSaveProfessionalProfile(), useUpdateCombo() (+7 more)

### Community 29 - "signatures.ts"
Cohesion: 0.07
Nodes (74): loadTrustedRootFiles(), loadTrustedRootsFromEnv(), NormalizedEvidence, normalizeEvidence(), RawFingerprint, cancelExternalAttempt(), cancelExternalAttemptAsClinicRepresentative(), canonicalJson() (+66 more)

### Community 30 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, noEmit, skipLibCheck, strict (+1 more)

### Community 31 - "Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF"
Cohesion: 0.14
Nodes (14): ContractVersion, 0005. Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos, Consequências, Contexto, Decisão, Emenda — 2026-10-07 (Issue #32: LibreOffice headless sob demanda, ONLYOFFICE aposentado), Further Notes, Implementation Decisions (+6 more)

### Community 32 - "api/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, allowImportingTsExtensions, types, extends, include, ../../tsconfig.json

### Community 33 - "Clínicare"
Cohesion: 0.29
Nodes (6): Clínicare, Desenvolvimento sem Docker, Estrutura do monorepo, Rodar localmente via Docker (caminho recomendado), Stack, Verificações

### Community 34 - "storage.ts"
Cohesion: 0.12
Nodes (30): docxMetadata(), getContractDraftEditor(), invalid(), presignContractDraft(), publishContractDraft(), saveContractDraft(), sha256(), uuid() (+22 more)

### Community 35 - "-documentos.test.tsx"
Cohesion: 0.05
Nodes (23): Handler, marina, renderAt(), PageLoadingIndicator(), setup(), schema, apps_web_src_index, combo() (+15 more)

### Community 36 - "Clínica de cuidados estéticos"
Cohesion: 0.20
Nodes (9): Attendance, Atendimento estético, Clínica de cuidados estéticos, Dados e ciclo de protótipo, Documentos e coleta, Jornada do paciente, Objetivo do produto, Organização da clínica (+1 more)

### Community 37 - "patients.ts"
Cohesion: 0.14
Nodes (20): DEFAULT_TENANT_ID, encryptedColumns(), PatientInput, ProtectedField, validateInput(), packages_db_src_index_decryptvalue, packages_db_src_index_normalizecpf, packages_db_src_index_normalizeemail (+12 more)

### Community 38 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 39 - "react"
Cohesion: 0.09
Nodes (34): emptySchema, Props, allowed, Phase, phases, CpfField(), Field(), FormDialog() (+26 more)

### Community 40 - "payments.ts"
Cohesion: 0.28
Nodes (15): noteValue(), decryptMaterializationContext(), conflict(), createPayment(), deletePayment(), invalid(), notFound(), PaymentInput (+7 more)

### Community 41 - "getDatabase"
Cohesion: 0.09
Nodes (52): addAnamnesisNote(), answerAppliedAnamnesis(), appliedShape(), byToken(), claimCleanupJob(), cleanupLease(), CleanupResult, CleanupStatus (+44 more)

### Community 42 - "db/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, types, extends, include, ../../tsconfig.json

### Community 43 - "Agent skills"
Cohesion: 0.29
Nodes (6): Agent skills, Domain docs, graphify, Issue tracker, This is NOT the Turborepo you know, Triage labels

### Community 44 - "scheduling.ts"
Cohesion: 0.16
Nodes (35): activeAppointmentStatuses, addAttendancePhoto(), appointmentResponse(), attendanceResponse(), attendanceShape(), cancelAttendance(), confirmAppointment(), conflict() (+27 more)

### Community 45 - "app.ts"
Cohesion: 0.06
Nodes (76): BRAZILIAN_STATES, getAccount(), getProfessionalProfile(), REGISTRATION_TYPES, updateInitialPasswordChoice(), updateProfessionalProfile(), app, appointmentStatusLabel (+68 more)

### Community 46 - "cn"
Cohesion: 0.07
Nodes (36): dateLong, Props, time, Geometry, Position, ProfessionalSignDialog(), ProfessionalSignItem, QuickActions() (+28 more)

### Community 47 - "relational-schema.ts"
Cohesion: 0.06
Nodes (34): appliedAnamnesisNotes, appointmentItems, attendancePhotos, catalogTimestamps, NewRelationalPatient, NewRelationalProcedure, NewTenant, paymentRelations (+26 more)

### Community 48 - "db/src/index.ts"
Cohesion: 0.13
Nodes (24): AppLike, assertSafeIntegrationDatabase(), integration, integrationCookies, authAccounts, AuthSession, authSessions, AuthUser (+16 more)

### Community 49 - "Decisão e plano: PostgreSQL + Drizzle + JSONB"
Cohesion: 0.09
Nodes (21): 10. Go/no-go para implementação, 1. Conclusão, 2. Decisões de domínio confirmadas, 3. Modelo de domínio e estados, 4. Blueprint relacional inicial, 5. Matriz de invariantes, 6. Fronteiras transacionais, 7. Reaproveitamento do Git (+13 more)

### Community 50 - "@tanstack/react-router"
Cohesion: 0.07
Nodes (49): AttendanceRecordForm(), ContractSummary(), Entry, pendingBadge(), NewFollowupDialog(), StandaloneAttendanceDialog(), FollowupCard(), offerLabel (+41 more)

### Community 51 - "Especificação: migração para PostgreSQL + Drizzle + JSONB"
Cohesion: 0.13
Nodes (14): API, frontend e operações de produto, Catálogo, planos e snapshots, Dados protegidos, Especificação: migração para PostgreSQL + Drizzle + JSONB, Further Notes, Implementation Decisions, Integridade e concorrência, Máquina de estados (+6 more)

### Community 52 - "api/package.json"
Cohesion: 0.12
Nodes (16): devDependencies, @types/bun, typescript, drizzle-orm, @types/bun, typescript, name, private (+8 more)

### Community 53 - "SchemaEditor.tsx"
Cohesion: 0.07
Nodes (61): AnamnesisFormPage(), submit(), canControlVisibility(), conditionOf(), Field, FieldPatch, identifierFor(), newSalt() (+53 more)

### Community 54 - "CalendarView.tsx"
Cohesion: 0.20
Nodes (8): apps_web_src_components_calendar, CalendarEntry, CalendarView(), @fullcalendar/core, ref_fullcalendar_core_locales_pt_br, @fullcalendar/interaction, @fullcalendar/react, @fullcalendar/timegrid

### Community 55 - "Validação de assinatura externa (GOV.BR) sem PAdES próprio"
Cohesion: 0.40
Nodes (4): Resultados, Revalidação em mutações posteriores (Issue #27), Validação de assinatura externa (GOV.BR) sem PAdES próprio, Verificações executadas (todas genuínas, nenhuma presumida)

### Community 56 - "encryptValue"
Cohesion: 0.21
Nodes (10): protectedFollowupValue(), encryptMaterializationContext(), encrypted(), configuredKey(), EncryptedValue, ENCRYPTION_KEY_VERSION, encryptValue(), KeyKind (+2 more)

### Community 57 - "migrate.ts"
Cohesion: 0.38
Nodes (8): getDatabaseSchema(), getMigrationsSchema(), getSchemaFilter(), getSearchPathOption(), quoteIdentifier(), getDatabasePool(), ensurePgTrgmExtension(), ref_drizzle_orm_node_postgres_migrator

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

### Community 79 - "planos/novo.tsx"
Cohesion: 0.19
Nodes (17): PlanOfferPicker(), comboPriceCents(), fold(), linkedContractIds(), matchesName(), minSessionsOf(), PAGE_SIZE, paginate() (+9 more)

### Community 80 - "collectFingerprint"
Cohesion: 0.36
Nodes (9): CollectedFingerprint, collectFingerprint(), GovBrSection(), acceptReturn(), cancelAttempt(), exportRevision(), importReturn(), postJson() (+1 more)

### Community 84 - "SigningWorkspace"
Cohesion: 0.32
Nodes (5): SigningWorkspace(), clear(), confirm(), placement(), preview()

### Community 86 - "docx-pdf.ts"
Cohesion: 0.24
Nodes (5): createLibreOfficeConverter(), DocxToPdfConverter, LIBREOFFICE_DEFAULT_TIMEOUT_MS, ref_node_os, pizzip

### Community 88 - "VersionsDialog.tsx"
Cohesion: 0.13
Nodes (18): ContractVersionsButton(), ContractVersionsHistory(), Props, Version, VersionsButton(), VersionsDialog(), anamnesesQuery, contractsQuery (+10 more)

### Community 89 - "api/src/index.ts"
Cohesion: 0.36
Nodes (7): resolvedPort, createSpaFallback(), createWebAssetMiddleware(), serveSpaIndex, hono, ref_node_fs_promises, ref_node_path

### Community 90 - "pdf-mutation.ts"
Cohesion: 0.36
Nodes (6): createIncrementalSignaturePdf(), normalizedPlacementToPdfRect(), PdfPlacement, PdfRect, sha256(), validatePlacement()

### Community 91 - "agenda.tsx"
Cohesion: 0.43
Nodes (7): AppointmentDetails(), statusLabel(), statusTone(), appointmentsQuery, useConfirmAppointment(), useNoShowAppointment(), Agenda()

### Community 92 - "request"
Cohesion: 0.67
Nodes (3): fixtures(), headers(), request()

## Knowledge Gaps
- **588 isolated node(s):** `name`, `private`, `type`, `dev`, `dev:debug` (+583 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 737 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **27 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GovBrSection()` connect `collectFingerprint` to `assinatura.$token.tsx`?**
  _High betweenness centrality (0.337) - this node is a cross-community bridge._
- **Why does `cancelAttempt()` connect `collectFingerprint` to `external-signatures.integration.test.ts`?**
  _High betweenness centrality (0.334) - this node is a cross-community bridge._
- **Why does `getDatabase()` connect `getDatabase` to `followups.integration.test.ts`, `storage.ts`, `patients.ts`, `relational-history.ts`, `payments.ts`, `admin-commands.ts`, `external-signatures.integration.test.ts`, `scheduling.ts`, `app.ts`, `db/src/index.ts`, `auth.ts`, `migrate.ts`, `followups.ts`, `signatures.ts`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _588 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `followups.integration.test.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09523809523809523 - nodes in this community are weakly interconnected._
- **Should `external-validation.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08758503401360544 - nodes in this community are weakly interconnected._
- **Should `dialogs.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06219426974143955 - nodes in this community are weakly interconnected._