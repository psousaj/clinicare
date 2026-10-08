# Graph Report - clinicare  (2026-10-08)

## Corpus Check
- 269 files · ~198,554 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 15 file(s) not represented in the graph (top: (none) 7, .css 4, .example 1)

## Summary
- 2134 nodes · 6538 edges · 111 communities (80 shown, 31 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 75 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a440f354`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- clinical.integration.test.ts
- external-validation.ts
- catalog.ts
- assinatura.$token.tsx
- contract-materialization.ts
- queries.ts
- followups.ts
- routeTree.gen.ts
- scripts
- api/src/index.ts
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
- auth-routes.ts
- compilerOptions
- admin-commands.ts
- PreviewPdf.tsx
- Implementation Decisions
- dialogs.tsx
- devDependencies
- manage.ts
- signatures.ts
- compilerOptions
- Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF
- api/tsconfig.json
- Clínicare
- buildProtectedAad
- App.test.tsx
- Clínica de cuidados estéticos
- patients.ts
- SignaturePadField.test.tsx
- cn
- api
- app.ts
- db/tsconfig.json
- Agent skills
- scheduling.ts
- encryptValue
- lucide-react
- relational-schema.ts
- -assinatura.$token.test.tsx
- Decisão e plano: PostgreSQL + Drizzle + JSONB
- @tanstack/react-router
- Especificação: migração para PostgreSQL + Drizzle + JSONB
- api/package.json
- SchemaEditor.tsx
- CalendarView.tsx
- Validação de assinatura externa (GOV.BR) sem PAdES próprio
- event-execution.integration.test.ts
- manage
- dependencies
- external-validation.test.ts
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
- docx-types.d.ts
- Correção do cancelamento de acompanhamento, anamneses e contratos
- DB_SCHEMA.md
- request-ip.ts
- nova.tsx
- vitest
- storage.ts
- scripts
- relationship.ts
- PageLoadingIndicator.test.tsx
- $patientId/index.tsx
- headers
- Route
- vite.config.ts
- migrate.ts
- docx-pdf.ts
- ref_node_fs
- documentos.$followupContractId.assinar.tsx
- RepresentativeSignPage
- SigningWorkspace
- getDatabase
- ref_node_readline
- eventos/index.tsx
- devDependencies
- collectFingerprint
- generateFollowupContract
- generate-secrets.ts
- request
- request

## God Nodes (most connected - your core abstractions)
1. `getDatabase()` - 167 edges
2. `app` - 129 edges
3. `cn()` - 60 edges
4. `react` - 58 edges
5. `@tanstack/react-router` - 55 edges
6. `useApiMutation()` - 48 edges
7. `api()` - 47 edges
8. `lucide-react` - 46 edges
9. `@tanstack/react-query` - 44 edges
10. `Button()` - 41 edges

## Surprising Connections (you probably didn't know these)
- `Contratos ainda em geração` --references--> `getFollowup()`  [INFERRED]
  docs/research/acompanhamento-anamneses-cancelamento.md → apps/api/src/followups.ts
- `Solution` --references--> `patient()`  [INFERRED]
  docs/specs/0005-autoria-docx-e-materializacao-de-contratos.md → apps/api/src/anamnesis-links.integration.test.ts
- `2. Cancelamento: anamneses` --references--> `getFollowup()`  [INFERRED]
  docs/research/acompanhamento-anamneses-cancelamento.md → apps/api/src/followups.ts
- `Implementation Decisions` --references--> `Contract`  [INFERRED]
  docs/specs/0005-autoria-docx-e-materializacao-de-contratos.md → apps/web/src/lib/schemas.ts
- `Decisão` --references--> `ContractVersion`  [INFERRED]
  docs/adr/0005-autoria-docx-e-materializacao-de-contratos.md → apps/web/src/lib/schemas.ts

## Import Cycles
- 2-file cycle: `packages/db/src/index.ts -> packages/db/src/seed.ts -> packages/db/src/index.ts`
- 2-file cycle: `packages/db/src/index.ts -> packages/db/src/migrate.ts -> packages/db/src/index.ts`

## Communities (111 total, 31 thin omitted)

### Community 0 - "clinical.integration.test.ts"
Cohesion: 0.16
Nodes (25): fixture(), headers(), post(), request(), AppLike, assertSafeIntegrationDatabase(), cleanupIntegrationClinics(), integration (+17 more)

### Community 1 - "external-validation.ts"
Cohesion: 0.13
Nodes (31): blankReport(), bytesEqual(), certEndpoints(), CertView, checkCrl(), checkOcsp(), checkRevocation(), cmsMessageDigest() (+23 more)

### Community 2 - "catalog.ts"
Cohesion: 0.08
Nodes (47): addAnamnesisVersion(), addContractVersion(), anamnesisResponse(), catalogTenant(), checkAnamnesisIds(), comboAnamnesisIds(), comboResponse(), comboValid() (+39 more)

### Community 3 - "assinatura.$token.tsx"
Cohesion: 0.09
Nodes (16): CollectedFingerprint, DraggableSignature(), GovBrState, PageGeometry, PreviewPdf(), PublicHistoryEvent, PublicHistoryRevision, RelativePlacement (+8 more)

### Community 4 - "contract-materialization.ts"
Cohesion: 0.17
Nodes (21): assertRequiredContext(), ContextConfiguration, CONTRACT_CONTEXT_INCOMPLETE, defaultContextConfiguration(), DOCX_CONTENT_TYPE, extractTags(), hasValue(), inspectDocxPlaceholders() (+13 more)

### Community 5 - "queries.ts"
Cohesion: 0.04
Nodes (92): contextDescription(), contextLabel(), CONTEXTS, ContractDraftPanel(), ContractFormPage(), ContractMetadata, Props, FollowupCard() (+84 more)

### Community 6 - "followups.ts"
Cohesion: 0.09
Nodes (54): contract(), form(), headers(), procedure(), request(), schema, tenantIds, schema (+46 more)

### Community 7 - "routeTree.gen.ts"
Cohesion: 0.04
Nodes (45): AppAgendaRoute, AppConfiguracoesRoute, AppContratosContractIdRoute, AppContratosIndexRoute, AppContratosNovoRoute, AppDocumentosFollowupContractIdAssinarRoute, AppDocumentosRoute, AppDocumentosRouteChildren (+37 more)

### Community 8 - "scripts"
Cohesion: 0.05
Nodes (38): devDependencies, turbo, engines, node, name, packageManager, private, scripts (+30 more)

### Community 9 - "api/src/index.ts"
Cohesion: 0.36
Nodes (7): resolvedPort, createSpaFallback(), createWebAssetMiddleware(), serveSpaIndex, hono, ref_node_fs_promises, ref_node_path

### Community 10 - "dependencies"
Cohesion: 0.06
Nodes (32): dependencies, class-variance-authority, clsx, date-fns, @fingerprintjs/fingerprintjs, @fullcalendar/core, @fullcalendar/interaction, @fullcalendar/react (+24 more)

### Community 11 - "external-signatures.integration.test.ts"
Cohesion: 0.11
Nodes (61): request(), deleteAppliedDocument(), placement, request(), placement, ADR-0004, integrationHeaders(), contexts (+53 more)

### Community 12 - "Assinatura eletrônica própria — especificação completa"
Cohesion: 0.09
Nodes (22): 10. Selo da plataforma e gestão de chaves, 11. Pacote exportável e verificação independente, 12. Recuperação, revogação e tempo, 13. Limites de confiança, 14. Critérios de aceitação, 1. Objetivo e decisões de produto, 2. O que o sistema pretende demonstrar, 3.1. Fingerprint obrigatório desde o MVP (+14 more)

### Community 13 - "Assinatura eletrônica própria — MVP"
Cohesion: 0.09
Nodes (22): 10. Histórico, armazenamento e download, 11. Estrutura preparada para evolução, 12. O que fica fora deste MVP, 13. Critérios para considerar o MVP pronto, 14. Limite da evolução futura, 1. Objetivo, 2. Fluxo oficial, também mantido na produção, 3.1. Fingerprint obrigatório desde o MVP (+14 more)

### Community 14 - "web/package.json"
Cohesion: 0.10
Nodes (19): typescript, name, private, type, class-variance-authority, clsx, jsdom, @noble/hashes (+11 more)

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
Nodes (30): Route, Route, Route, Route, Route, Route, Route, Route (+22 more)

### Community 21 - "auth-routes.ts"
Cohesion: 0.20
Nodes (11): AuthInstance, getTrustedOrigins(), getAuth(), authHandler(), getClinicSession(), requireClinicSession(), SESSION_DURATION_SECONDS, authSchema (+3 more)

### Community 22 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleResolution, noEmit (+8 more)

### Community 23 - "admin-commands.ts"
Cohesion: 0.16
Nodes (17): administratorByEmail(), BOOTSTRAP_ENV_KEYS, bootstrapConfigFromEnv(), changeClinicAdministratorEmail(), CreateAdministratorInput, createBetterAuthClinicAdministrator(), CreateTenantInput, deactivateTenant() (+9 more)

### Community 24 - "PreviewPdf.tsx"
Cohesion: 0.29
Nodes (4): DraggableSignature(), PreviewPdf(), PreviewPlacement, pdfjs-dist

### Community 25 - "Implementation Decisions"
Cohesion: 0.09
Nodes (22): Assinatura local, Concorrência, idempotência e storage, Especificação — Assinatura eletrônica própria no MVP, Estados e conclusão, Fingerprint e evidências, Fonte, PDF e revisões, Further Notes, GOV.BR e assinaturas externas (+14 more)

### Community 26 - "dialogs.tsx"
Cohesion: 0.08
Nodes (34): AppointmentDetails(), dateLong, Props, time, ProcedurePicker(), AppointmentDialog(), AppointmentFields(), localDate() (+26 more)

### Community 27 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, jsdom, @tanstack/router-plugin, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event, @types/node, @types/react (+3 more)

### Community 28 - "manage.ts"
Cohesion: 0.28
Nodes (11): createClinicAdministrator(), createTenant(), listAdministrators(), listTenants(), requireText(), opt(), parseManageArgs(), promptHiddenPassword() (+3 more)

### Community 29 - "signatures.ts"
Cohesion: 0.06
Nodes (79): loadTrustedRootFiles(), loadTrustedRootsFromEnv(), createIncrementalSignaturePdf(), normalizedPlacementToPdfRect(), PdfPlacement, PdfRect, sha256(), validatePlacement() (+71 more)

### Community 30 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, noEmit, skipLibCheck, strict (+1 more)

### Community 31 - "Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF"
Cohesion: 0.13
Nodes (15): ContractVersion, 0005. Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos, Consequências, Contexto, Decisão, Emenda — 2026-10-07 (Issue #32: LibreOffice headless sob demanda, ONLYOFFICE aposentado), Emenda — 2026-10-07 (propagação da versão publicada a contratos aplicados sem assinatura), Further Notes (+7 more)

### Community 32 - "api/tsconfig.json"
Cohesion: 0.29
Nodes (6): compilerOptions, allowImportingTsExtensions, types, extends, include, ../../tsconfig.json

### Community 33 - "Clínicare"
Cohesion: 0.29
Nodes (6): Clínicare, Desenvolvimento sem Docker, Estrutura do monorepo, Rodar localmente via Docker (caminho recomendado), Stack, Verificações

### Community 34 - "buildProtectedAad"
Cohesion: 0.21
Nodes (19): unprotect(), decryptMaterializationContext(), conflict(), createPayment(), deletePayment(), invalid(), listPayments(), notFound() (+11 more)

### Community 35 - "App.test.tsx"
Cohesion: 0.15
Nodes (15): Handler, marina, renderAt(), apps_web_src_index, combo(), contract(), queryClient, router (+7 more)

### Community 36 - "Clínica de cuidados estéticos"
Cohesion: 0.22
Nodes (8): Atendimento estético, Clínica de cuidados estéticos, Dados e ciclo de protótipo, Documentos e coleta, Jornada do paciente, Objetivo do produto, Organização da clínica, Princípios do MVP

### Community 37 - "patients.ts"
Cohesion: 0.05
Nodes (48): createFollowup(), hashToken(), idShape(), invalid(), issueInitialTokens(), latest(), notFound(), offerForms() (+40 more)

### Community 38 - "SignaturePadField.test.tsx"
Cohesion: 0.09
Nodes (11): isMobileSignatureDevice(), lockLandscape(), scalePointGroups(), SignaturePadField, SignaturePadHandle, originalExitFullscreenDescriptor, originalFullscreenElementDescriptor, originalRequestFullscreenDescriptor (+3 more)

### Community 39 - "cn"
Cohesion: 0.06
Nodes (51): emptySchema, Props, allowed, AttendancePhotos(), Phase, phases, CpfField(), EditPatientDialog() (+43 more)

### Community 40 - "api"
Cohesion: 0.09
Nodes (31): NativeSelect(), NativeSelectOptGroup(), NativeSelectOption(), Tabs(), TabsContent(), TabsList(), TabsTrigger(), api() (+23 more)

### Community 41 - "app.ts"
Cohesion: 0.10
Nodes (44): BRAZILIAN_STATES, getAccount(), getDefaultSignature(), getProfessionalProfile(), REGISTRATION_TYPES, updateAccount(), updateDefaultSignature(), updateInitialPasswordChoice() (+36 more)

### Community 42 - "db/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, types, extends, include, ../../tsconfig.json

### Community 43 - "Agent skills"
Cohesion: 0.29
Nodes (6): Agent skills, Domain docs, graphify, Issue tracker, This is NOT the Turborepo you know, Triage labels

### Community 44 - "scheduling.ts"
Cohesion: 0.15
Nodes (37): civilDateOf(), clinicTimeZone(), activeAppointmentStatuses, addAttendancePhoto(), appointmentResponse(), assertAtomicCombos(), assertEventDay(), attendanceResponse() (+29 more)

### Community 45 - "encryptValue"
Cohesion: 0.14
Nodes (15): patient(), propagatePublishedVersion(), protectedFollowupValue(), replaceUnsignedAppliedContract(), Call, api(), clinicDate(), enrolled() (+7 more)

### Community 46 - "lucide-react"
Cohesion: 0.16
Nodes (16): Sheet(), SheetClose(), SheetContent(), SheetDescription(), SheetHeader(), SheetOverlay(), SheetTitle(), SheetTrigger() (+8 more)

### Community 47 - "relational-schema.ts"
Cohesion: 0.05
Nodes (43): authAccounts, AuthSession, authSessions, AuthUser, authVerifications, professionals, appliedAnamnesisNotes, catalogTimestamps (+35 more)

### Community 49 - "Decisão e plano: PostgreSQL + Drizzle + JSONB"
Cohesion: 0.09
Nodes (21): 10. Go/no-go para implementação, 1. Conclusão, 2. Decisões de domínio confirmadas, 3. Modelo de domínio e estados, 4. Blueprint relacional inicial, 5. Matriz de invariantes, 6. Fronteiras transacionais, 7. Reaproveitamento do Git (+13 more)

### Community 50 - "@tanstack/react-router"
Cohesion: 0.06
Nodes (44): AttendanceRecordForm(), matchesPatient(), PatientRow(), QueryError(), ContractVersionsButton(), ContractVersionsHistory(), Props, Version (+36 more)

### Community 51 - "Especificação: migração para PostgreSQL + Drizzle + JSONB"
Cohesion: 0.13
Nodes (14): API, frontend e operações de produto, Catálogo, planos e snapshots, Dados protegidos, Especificação: migração para PostgreSQL + Drizzle + JSONB, Further Notes, Implementation Decisions, Integridade e concorrência, Máquina de estados (+6 more)

### Community 52 - "api/package.json"
Cohesion: 0.13
Nodes (14): drizzle-orm, @types/bun, typescript, name, private, type, asn1js, @aws-sdk/client-s3 (+6 more)

### Community 53 - "SchemaEditor.tsx"
Cohesion: 0.06
Nodes (64): AnamnesisFormPage(), submit(), canControlVisibility(), conditionOf(), Field, FieldPatch, identifierFor(), newSalt() (+56 more)

### Community 54 - "CalendarView.tsx"
Cohesion: 0.20
Nodes (8): apps_web_src_components_calendar, CalendarEntry, CalendarView(), @fullcalendar/core, ref_fullcalendar_core_locales_pt_br, @fullcalendar/interaction, @fullcalendar/react, @fullcalendar/timegrid

### Community 55 - "Validação de assinatura externa (GOV.BR) sem PAdES próprio"
Cohesion: 0.40
Nodes (4): Resultados, Revalidação em mutações posteriores (Issue #27), Validação de assinatura externa (GOV.BR) sem PAdES próprio, Verificações executadas (todas genuínas, nenhuma presumida)

### Community 56 - "event-execution.integration.test.ts"
Cohesion: 0.19
Nodes (26): contractedNames(), schema, schema, fixture(), headers, patch(), post(), request() (+18 more)

### Community 58 - "dependencies"
Cohesion: 0.14
Nodes (14): dependencies, asn1js, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, better-auth, @better-auth/drizzle-adapter, @clinicare/db, docxtemplater (+6 more)

### Community 59 - "external-validation.test.ts"
Cohesion: 0.23
Nodes (13): buildSignedReturnPdf(), buildUnparsableCmsReturn(), createTestCa(), ensureOpensslAvailable(), issueDatedTestSigner(), issueTestSigner(), num10(), parseBaseTrailer() (+5 more)

### Community 60 - "Issue tracker: GitHub"
Cohesion: 0.29
Nodes (6): Conventions, Issue tracker: GitHub, Pull requests as a triage surface, Wayfinding operations, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

### Community 61 - "Domain Docs"
Cohesion: 0.33
Nodes (5): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary

### Community 77 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, dev:debug, manage, test, test:integration, typecheck

### Community 78 - "Investigação da validação global T7"
Cohesion: 0.40
Nodes (4): Correções e validação final, Evidências de escopo, Investigação da validação global T7, Resultado inicial

### Community 79 - "planos/novo.tsx"
Cohesion: 0.08
Nodes (49): AnamnesisPicker(), InheritedAnamneses(), ComboFormPage(), day(), Field(), FormPage(), FormPageProps, Kind (+41 more)

### Community 82 - "Correção do cancelamento de acompanhamento, anamneses e contratos"
Cohesion: 0.22
Nodes (8): Correção do cancelamento de acompanhamento, anamneses e contratos, Further Notes, Implementation Decisions, Out of Scope, Problem Statement, Solution, Testing Decisions, User Stories

### Community 84 - "request-ip.ts"
Cohesion: 0.43
Nodes (5): forwardedParameter(), headerAddress(), observedClientIp(), validIp(), ref_node_net

### Community 85 - "nova.tsx"
Cohesion: 0.67
Nodes (3): useCreateAnamnesis(), NewAnamnesis(), Route

### Community 86 - "vitest"
Cohesion: 0.21
Nodes (6): schema, ref_noble_hashes_sha2_js, ref_testing_library_jest_dom_vitest, @testing-library/react, @testing-library/user-event, vitest

### Community 87 - "storage.ts"
Cohesion: 0.21
Nodes (9): bucket, resolveStorageConfig(), StorageEnv, headObject(), storage, config, uploadObjectBytesForDocument(), uploadUrlForDocument() (+1 more)

### Community 88 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, test, typecheck

### Community 91 - "$patientId/index.tsx"
Cohesion: 0.10
Nodes (31): ContractGenerateButton(), ContractReprocessButton(), ContractSignatureHistory(), copySignatureLink(), ContractSummary(), Entry, pendingBadge(), Body() (+23 more)

### Community 94 - "vite.config.ts"
Cohesion: 0.33
Nodes (5): @tailwindcss/vite, ref_tanstack_router_plugin_vite, vite, @vitejs/plugin-react, ref_vitest_config

### Community 95 - "migrate.ts"
Cohesion: 0.38
Nodes (8): getDatabaseSchema(), getMigrationsSchema(), getSchemaFilter(), getSearchPathOption(), quoteIdentifier(), getDatabasePool(), ensurePgTrgmExtension(), ref_drizzle_orm_node_postgres_migrator

### Community 97 - "docx-pdf.ts"
Cohesion: 0.24
Nodes (4): createLibreOfficeConverter(), DocxToPdfConverter, LIBREOFFICE_DEFAULT_TIMEOUT_MS, ref_node_os

### Community 99 - "documentos.$followupContractId.assinar.tsx"
Cohesion: 0.12
Nodes (17): apps_web_src_components_signing_documentviewer_getdocument, PageGeometry, renderAllPages(), usePdfDocument(), ChecklistItem, SignChecklist(), SigningSteps(), StampPreview() (+9 more)

### Community 100 - "RepresentativeSignPage"
Cohesion: 0.24
Nodes (16): previewProfessionalSignature(), usePreviewProfessionalSignature(), draftKey(), readDraft(), RepresentativeSignPage(), flag(), handleClear(), handleConfirm() (+8 more)

### Community 101 - "SigningWorkspace"
Cohesion: 0.24
Nodes (11): DRAFT_STORAGE_KEY(), readStoredDraft(), SigningWorkspace(), captureFromPad(), clear(), confirm(), goBackToStep(), goToConfirm() (+3 more)

### Community 102 - "getDatabase"
Cohesion: 0.10
Nodes (51): addAnamnesisNote(), answerAppliedAnamnesis(), appliedShape(), byToken(), cancelledError(), claimCleanupJob(), cleanupLease(), CleanupResult (+43 more)

### Community 104 - "eventos/index.tsx"
Cohesion: 0.43
Nodes (6): useSaveEvent(), apps_web_src_routes_app_eventos_events, civil(), Events(), initials(), months

### Community 105 - "devDependencies"
Cohesion: 0.67
Nodes (3): devDependencies, @types/bun, typescript

### Community 106 - "collectFingerprint"
Cohesion: 0.38
Nodes (9): collectFingerprint(), createIdempotencyKey(), GovBrSection(), acceptReturn(), cancelAttempt(), exportRevision(), importReturn(), postJson() (+1 more)

### Community 107 - "generateFollowupContract"
Cohesion: 0.13
Nodes (19): docxMetadata(), invalid(), publishContractDraft(), saveContractDraft(), sha256(), uuid(), buildContext(), contextForVersion() (+11 more)

## Knowledge Gaps
- **632 isolated node(s):** `name`, `private`, `type`, `dev`, `dev:debug` (+627 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 818 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **31 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cancelAttempt()` connect `collectFingerprint` to `external-signatures.integration.test.ts`?**
  _High betweenness centrality (0.247) - this node is a cross-community bridge._
- **Why does `GovBrSection()` connect `collectFingerprint` to `assinatura.$token.tsx`?**
  _High betweenness centrality (0.246) - this node is a cross-community bridge._
- **Why does `ContractVersion` connect `Spec — Autoria DOCX com ONLYOFFICE e Materialização Paramétrica de Contratos para Assinatura PDF` to `queries.ts`?**
  _High betweenness centrality (0.106) - this node is a cross-community bridge._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _632 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `external-validation.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13257575757575757 - nodes in this community are weakly interconnected._
- **Should `catalog.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07738095238095238 - nodes in this community are weakly interconnected._
- **Should `assinatura.$token.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._