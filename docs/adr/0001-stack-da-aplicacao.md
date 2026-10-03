# ADR 0001: Stack da aplicação

- **Status:** Substituído por ADR 0003 — Persistência PostgreSQL + Drizzle + JSONB
- **Data:** 2026-09-28

## Contexto

O produto é uma aplicação nova para uma clínica pequena, com frontend web em React, formulários configuráveis, agenda semanal, dados relacionais e armazenamento de fotos e documentos. A equipe quer usar Bun e precisa de uma stack TypeScript simples que permita evoluir sem escolher agora cada biblioteca de interface.

## Decisão

- React com TypeScript e Vite para a aplicação web.
- Bun como runtime e gerenciador de pacotes do projeto.
- Hono com TypeScript para a API HTTP.
- MongoDB acessado com Mongoose como persistência principal. Modelagem por coleções/agregados referenciados; versões imutáveis de formulários e snapshots comerciais ficam embutidos no documento proprietário.
- Cloudflare R2 para arquivos binários, usando a API compatível com S3; metadados e vínculos ficam em coleções MongoDB.
- FullCalendar para o calendário semanal.
- JSON Schema como contrato de formulários dinâmicos, com builder/renderizador validados via integração.
- DOCX será importado e gerado a partir de modelos; Docxtemplater é candidato à geração.
- Testes de integração de API usam MongoDB Memory Server. Docker Compose executa a aplicação e MongoDB no desenvolvimento/produção. O artefato de produção é uma imagem multi-stage única da aplicação (web + API), com MongoDB como serviço separado.
- A mudança de PostgreSQL para MongoDB é descartável no protótipo: não converter dados existentes; documentar como recriar a base fictícia.

## Consequências

- A aplicação e os contratos de API podem compartilhar tipos TypeScript, mas validação de dados externos deve ocorrer em runtime.
- MongoDB permite documentos de formulário e snapshots autocontidos, mas referências entre agregados precisam ser validadas pela aplicação e consultas multiagregado precisam ser explícitas.
- O protótipo usa operações sequenciais simples entre coleções; não promete consistência transacional nem inclui protocolo sofisticado de recuperação.
- A troca no protótipo descarta a base PostgreSQL atual; nenhum registro fictício precisa ser migrado.
- Conteúdo binário de fotos e documentos fica no R2; metadados e referências ficam no MongoDB.
- O uso de API S3 reduz acoplamento ao fornecedor, embora diferenças de compatibilidade do R2 devam ser testadas.
- Testes de integração usam MongoDB Memory Server sem Docker; Compose fornece o caminho reproduzível para executar a aplicação completa.
- Bun é a escolha padrão de execução e instalação. Incompatibilidades pontuais de dependências devem ser avaliadas antes de substituir a stack ou contornar APIs sem suporte.
- A escolha de FullCalendar, builder JSON Schema e biblioteca de edição/geração DOCX pode ser revista após protótipos; a decisão de stack não implica compromisso irreversível com esses componentes.

## Alternativas consideradas

- **Next.js:** não escolhido inicialmente para evitar adicionar convenções e complexidade de framework full-stack quando frontend e API podem ser serviços simples e independentes.
- **MongoDB:** a persistência documental foi escolhida para armazenar formulários dinâmicos e snapshots variáveis, aceitando referências entre agregados validadas pela aplicação.
- **Armazenamento local ou no banco:** descartados para arquivos de produção; R2 oferece armazenamento de objetos sem misturar binários com os dados relacionais.
