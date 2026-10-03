# Persistência PostgreSQL + Drizzle + JSONB

- **Status:** Aceito
- **Data:** 2026-10-03

O Clinicare deixa a persistência documental anterior e adota PostgreSQL acessado por Drizzle porque o domínio clínico-financeiro exige FKs, constraints, transações, locks e unicidade como garantias de integridade, não apenas validações de aplicação. O PostgreSQL preserva os pontos fortes documentais por meio de `jsonb` para schemas e snapshots estruturais e de colunas protegidas para respostas e conteúdo clínico; planos terão versões imutáveis e acompanhamentos guardarão snapshots próprios.

A arquitetura final usa `tenant_id` em todas as tabelas pertencentes ao tenant e FKs compostas nos vínculos críticos. Dados pessoais e clínicos protegíveis são cifrados na aplicação por coluna com AES-256-GCM, nonce aleatório, AAD vinculado ao tenant/tabela/registro/coluna/versão e chaves fornecidas por ambiente; e-mail, telefone e CPF opcional usam HMAC separado para busca exata e unicidade entre pacientes ativos. `full_name` permanece plaintext por ser a busca principal e usa `pg_trgm` com filtro por tenant.

O banco começa vazio com migrations e seed reproduzível: os dados atuais da persistência documental anterior são apenas protótipo e não serão migrados. A troca deve manter o R2 para binários, não deixar dual-write como estado final e só remover Mongo/a persistência documental anterior depois da suíte PostgreSQL e do smoke test estarem verdes.

## Consequências

- Início de acompanhamento, consumo de sessão, reserva de agenda, assinatura e pagamentos exigem fronteiras transacionais explícitas.
- `attendances` são a fonte de verdade do consumo; pagamentos têm idempotency key; versões têm unicidade por proprietário.
- Planos aceitam apenas procedimentos neste escopo e são versionados; combos independentes usam snapshots no acompanhamento sem `combo_versions`.
- Um plano nasce `idle` e só fica operacional após todos os contratos obrigatórios serem assinados pelo paciente; a assinatura do profissional é pendência não bloqueante.
- Histórico clínico, comercial e financeiro é preservado por soft delete e não há retenção automática no MVP.
