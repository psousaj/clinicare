# ADR 0001: Stack da aplicação

- **Status:** Substituído por ADR 0003 — Persistência PostgreSQL + Drizzle + JSONB
- **Data:** 2026-09-28

## Contexto

O produto é uma aplicação nova para uma clínica pequena, com frontend web em React, formulários configuráveis, agenda semanal, dados relacionais e armazenamento de fotos e documentos. A equipe quer usar Bun e precisa de uma stack TypeScript simples que permita evoluir sem escolher agora cada biblioteca de interface.

## Decisão

- React com TypeScript e Vite para a aplicação web.
- Bun como runtime e gerenciador de pacotes do projeto.
- Hono com TypeScript para a API HTTP.
- PostgreSQL acessado com Drizzle como persistência principal. Modelagem relacional multi-tenant com JSONB para schemas e snapshots imutáveis.
- Cloudflare R2 para arquivos binários, usando a API compatível com S3; metadados e vínculos ficam no PostgreSQL.
- FullCalendar para o calendário semanal.
- JSON Schema como contrato de formulários dinâmicos, com builder/renderizador validados via integração.
- DOCX será importado e gerado a partir de modelos; Docxtemplater é candidato à geração.
- Testes de integração de API usam PostgreSQL real com migrations. Docker Compose executa a aplicação e PostgreSQL no desenvolvimento/produção. O artefato de produção é uma imagem multi-stage única da aplicação (web + API), com PostgreSQL como serviço separado.
- A base prototípica pode ser recriada do zero com migrations e seed idempotente; não há conversão de registros fictícios antigos.

## Consequências

- A aplicação e os contratos de API podem compartilhar tipos TypeScript, mas validação de dados externos deve ocorrer em runtime.
- PostgreSQL mantém documentos de formulário e snapshots autocontidos em JSONB, com referências entre agregados protegidas por FKs, constraints e transações.
- O protótipo usa transações PostgreSQL explícitas para preservar invariantes multi-agregado.
- A base pode ser recriada do zero; nenhum registro fictício antigo precisa ser migrado.
- Conteúdo binário de fotos e documentos fica no R2; metadados e referências ficam no PostgreSQL.
- O uso de API S3 reduz acoplamento ao fornecedor, embora diferenças de compatibilidade do R2 devam ser testadas.
- Testes de integração usam PostgreSQL real com migrations; Compose fornece o caminho reproduzível para executar a aplicação completa.
- Bun é a escolha padrão de execução e instalação. Incompatibilidades pontuais de dependências devem ser avaliadas antes de substituir a stack ou contornar APIs sem suporte.
- A escolha de FullCalendar, builder JSON Schema e biblioteca de edição/geração DOCX pode ser revista após protótipos; a decisão de stack não implica compromisso irreversível com esses componentes.

## Alternativas consideradas

- **Next.js:** não escolhido inicialmente para evitar adicionar convenções e complexidade de framework full-stack quando frontend e API podem ser serviços simples e independentes.
- **PostgreSQL + JSONB:** a persistência relacional armazena formulários dinâmicos e snapshots variáveis, com referências entre agregados protegidas por FKs e transações.
- **Armazenamento local ou no banco:** descartados para arquivos de produção; R2 oferece armazenamento de objetos sem misturar binários com os dados relacionais.
