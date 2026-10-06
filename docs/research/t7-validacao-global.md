# Investigação da validação global T7

Data: 2026-10-06

## Resultado inicial

- Build da API e da Web: aprovado.
- Typecheck da API, Web e DB: aprovado.
- Testes direcionados de assinatura da API: `24 pass, 0 fail`.
- Testes direcionados de assinatura da Web: `6 pass, 0 fail`.
- Testes unitários da API sem PostgreSQL: `25 pass, 1 fail, 85 skip`; a falha retornava `500` em vez de `404` quando `DATABASE_URL` não estava configurado.

## Correções e validação final

- A API passou a validar UUID inválido antes da sessão e retorna `404` sem fallback ao banco.
- A integração passou a definir `DB_SCHEMA` por padrão e a normalizar `pg_trgm` em `public`; PostgreSQL 17 isolado executou `42 pass, 0 fail`.
- Os fixtures Web passaram a fornecer sessão autenticada e data de agenda dentro da semana testada; a suíte Web executou `53 pass, 0 fail`.
- A API unitária executou `26 pass, 85 skip, 0 fail`; os skips são as integrações sem `DATABASE_URL`.

## Evidências de escopo

- `CONTEXT.md`, ADR 0004 e ADR 0006 estão alinhados com preservação incremental, validação GOV.BR e histórico de assinaturas.
- A busca por stubs em código de produção não encontrou implementações stub; os usos de mock/stub encontrados estão restritos a testes Web.
- O build e o typecheck continuam aprovados. O build ainda emite apenas o aviso de Node 20.18 abaixo do requisito do Vite e o aviso de chunks grandes.
