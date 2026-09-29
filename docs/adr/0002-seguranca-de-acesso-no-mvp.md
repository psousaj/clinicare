# ADR 0002: Controle de acesso para dados clínicos no MVP

- **Status:** Substituído para o MVP de testes; autenticação básica fica em tarefa futura
- **Data:** 2026-09-28

## Contexto

O MVP não inclui login do profissional administrador nem portal autenticado do paciente. Ainda assim, o sistema armazena dados pessoais e anamneses, que podem conter dados de saúde. Links de anamnese são acessos temporários para pacientes, não autenticação do painel administrativo.

## Decisão

O MVP atual é um protótipo para testes e demonstrações com dados fictícios. Não haverá login, autenticação administrativa, autorização ou barreira de acesso no painel nesta fase. O sistema não deve ser usado com dados reais de pacientes.

Links de anamnese continuam sendo acessos temporários específicos de uma solicitação e usam tokens imprevisíveis, expiração de sete dias, sem dados pessoais ou clínicos na URL. Atualizar o link invalida o anterior.

Uma tarefa futura separada (NEX-173) adicionará somente autenticação administrativa básica. Ela não deve introduzir RBAC, múltiplos papéis ou permissões nesta etapa.

## Consequências

- A aplicação pode ser testada sem fluxo de login, com a restrição explícita de usar apenas dados fictícios.
- A tarefa de autenticação futura deve manter escopo mínimo e não se expandir para autorização granular ou portal do paciente.
- A solicitação de anamnese permanece de uso único quanto ao envio: rascunho pode ser retomado enquanto o link estiver válido, mas submissão concluída encerra a solicitação.

## Alternativas consideradas

- **Adicionar autenticação já no MVP:** adiada para uma tarefa futura separada, pois não é necessária para validar o protótipo.
- **Usar dados reais sem autenticação:** rejeitada; o protótipo deve usar dados fictícios.
