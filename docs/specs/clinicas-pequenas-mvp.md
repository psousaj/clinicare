# Especificação: MVP para clínicas pequenas de estética

## Problema

Profissionais de clínicas pequenas precisam acompanhar, num só lugar, quem são seus pacientes, o que foi contratado, quais formulários e documentos estão associados, quando os procedimentos serão realizados e o que ainda está pendente. Hoje essas informações e a execução clínica podem ficar dispersas, dificultando a consulta do histórico e o acompanhamento dos tratamentos.

## Solução

Construir uma aplicação para uma única clínica, operada no MVP pelo profissional que também é administrador. O fluxo começa com o cadastro do paciente e a contratação de procedimentos individuais ou combos. A contratação congela as condições comerciais; depois, a execução dos procedimentos ocorre por agendamentos e sessões registradas. Anamneses, contratos, fotos, pagamentos e pendências ficam ligados ao paciente e consultáveis em seu histórico.

## Histórias de usuário

1. Como profissional-administrador, quero cadastrar pacientes para manter seus dados e acompanhamentos em um só lugar.
2. Como profissional-administrador, quero cadastrar procedimentos estéticos com duração estimada, quantidade padrão de sessões, preço e campos configuráveis de sessão para adaptar o sistema aos serviços da clínica.
3. Como profissional-administrador, quero montar formulários de anamnese com JSON Schema para coletar informações clínicas adequadas aos procedimentos.
4. Como profissional-administrador, quero versionar anamneses, consultar versões anteriores e restaurar uma versão criando uma nova versão, para manter o histórico e evoluir os formulários com segurança.
5. Como profissional-administrador, quero associar uma ou mais anamneses a procedimentos e definir quais são obrigatórias, para solicitar as informações necessárias ao paciente.
6. Como paciente, quero responder uma solicitação de anamnese por link seguro sem criar uma conta.
7. Como paciente, quero conseguir retomar um rascunho de anamnese pelo link antes de enviá-lo.
8. Como profissional-administrador, quero que links de anamnese expirem após sete dias e possam ser atualizados, para controlar o acesso sem exigir revogação manual.
9. Como profissional-administrador, quero que respostas enviadas sejam imutáveis e possam receber apenas complementos registrados por mim, preservando o que o paciente respondeu originalmente.
10. Como profissional-administrador, quero considerar uma resposta de anamnese vigente por um ano e poder solicitar outra quando estiver vencida, evitando pedir novamente dados ainda atuais.
11. Como profissional-administrador, quero cadastrar combos com procedimentos e quantidades de sessões próprias por procedimento, para vender tratamentos combinados.
12. Como profissional-administrador, quero cadastrar combos promocionais com período de validade e preço promocional, para oferecer ofertas temporárias.
13. Como profissional-administrador, quero que a validade promocional limite a data de contratação, não a conclusão das sessões já contratadas.
14. Como profissional-administrador, quero contratar um procedimento individual ou combo para um paciente, congelando composição, número de sessões, preço e documentos aplicáveis naquele momento.
15. Como profissional-administrador, quero poder contratar ofertas diferentes que compartilhem procedimentos, mas não repetir para o mesmo paciente exatamente a mesma oferta, para evitar duplicidade sem impedir tratamentos distintos.
16. Como profissional-administrador, quero manter vários planos ativos para um paciente ao mesmo tempo, para acompanhar tratamentos independentes.
17. Como profissional-administrador, quero definir um contrato padrão e contratos específicos por procedimento ou combo, para apresentar os documentos pertinentes à contratação.
18. Como profissional-administrador, quero criar contratos no sistema ou importar modelos DOCX, editar seus conteúdos e versioná-los, para manter documentos comerciais atualizados.
19. Como profissional-administrador, quero restaurar uma versão anterior de contrato criando uma nova versão, sem modificar contratos já aplicados a pacientes.
20. Como profissional-administrador, quero gerar e preservar o documento aplicado à contratação a partir do modelo e dos dados do paciente, para consultar exatamente o documento associado àquele caso.
21. Como profissional-administrador, quero registrar preço contratado, pagamentos recebidos, forma de pagamento e parcelas informadas, para acompanhar valores recebidos e pendentes sem processar cartões pelo sistema.
22. Como profissional-administrador, quero registrar pagamentos à vista ou parcelados no cartão de crédito, para refletir o que foi recebido pela clínica.
23. Como profissional-administrador, quero consultar o saldo de cada contratação, calculado pelo preço contratado menos pagamentos registrados, para identificar valores pendentes.
24. Como profissional-administrador, quero usar um calendário semanal com intervalos selecionáveis por hora, para criar e ajustar agendamentos visualmente.
25. Como profissional-administrador, quero que a duração estimada do procedimento sugira o intervalo do agendamento e poder ajustar início e fim, para adaptar a agenda à realidade do atendimento.
26. Como profissional-administrador, quero agendar vários procedimentos do plano de um paciente no mesmo compromisso, para representar visitas que incluem mais de um procedimento.
27. Como profissional-administrador, quero permitir horários sobrepostos na agenda do MVP, sem bloqueio automático de conflitos.
28. Como profissional-administrador, quero marcar agendamentos como planejados, confirmados, remarcados, cancelados ou não compareceu, sem que esses estados criem sessões automaticamente.
29. Como profissional-administrador, quero registrar cada procedimento efetivamente realizado como uma sessão própria, mesmo quando vários procedimentos ocorrerem no mesmo agendamento.
30. Como profissional-administrador, quero que somente uma sessão registrada como realizada consuma uma unidade da quantidade contratada, para que cancelamentos e não comparecimentos não alterem o saldo de sessões.
31. Como profissional-administrador, quero preencher em cada sessão os campos básicos e os campos configurados para o procedimento, para registrar informações relevantes à execução.
32. Como profissional-administrador, quero que a estrutura do formulário de sessão fique congelada no plano aplicado, para preservar a interpretação dos registros mesmo que o procedimento mude depois.
33. Como profissional-administrador, quero anexar várias fotos a uma sessão, classificá-las como antes, durante ou depois e adicionar observações opcionais, para documentar a evolução do paciente.
34. Como profissional-administrador, quero poder excluir fotos no MVP, para corrigir anexos inadequados.
35. Como profissional-administrador, quero consultar a linha do tempo e as pendências por paciente, incluindo anamneses, contratos, pagamentos, agendamentos, sessões e fotos, para acompanhar cada caso.

## Decisões de implementação

- **Escopo organizacional:** uma instalação atende uma única clínica. O MVP tem um usuário administrador, que também é o profissional que configura procedimentos, registra sessões e opera a agenda. RBAC, perfis de recepção e múltiplas agendas ficam fora do escopo.
- **Contexto do domínio:** usar os termos definidos em `CONTEXT.md`. Distinguir contratação (condições comerciais congeladas) de execução do procedimento (agendamentos e sessões posteriores).
- **Stack:** React e TypeScript no frontend com Vite; Bun como runtime e gerenciador de pacotes; API TypeScript com Hono; PostgreSQL + Drizzle + JSONB. Modelagem por coleções e referências entre agregados, com snapshots/versionamento imutável embutidos no documento proprietário. Binários no Cloudflare R2 via API compatível com S3; metadados no PostgreSQL. FullCalendar para agenda semanal. JSON Schema para formulários; builder/renderizador visual validado via integração. DOCX via importação/geração, com Docxtemplater como candidato.
- **Ambientes:** testes de integração da API com PostgreSQL real com migrations; Docker Compose executa web/API em um container de aplicação multi-stage e PostgreSQL em serviço separado. A troca de PostgreSQL é descartável no protótipo: não migrar registros fictícios existentes; documentar reset/reseed.
- **Autenticação no MVP:** não haverá login, autenticação administrativa nem proteção de acesso no protótipo MVP; ele serve somente para testes e demonstrações com dados fictícios. A tarefa futura NEX-173 cobre autenticação administrativa básica, sem RBAC/permissões. Links de anamnese continuam temporários e protegidos por token forte, sem dados pessoais ou clínicos na URL.
- **Catálogo e contratação:** procedimentos definem quantidade padrão de sessões e duração estimada. Combos contêm procedimentos e podem sobrescrever, por item, quantidade de sessões e preço. Combos promocionais têm vigência para aplicação. A aplicação a um paciente cria um plano congelado; mudanças posteriores no catálogo não alteram planos existentes. Bloquear repetição da mesma oferta para o paciente, permitindo ofertas diferentes com procedimentos em comum.
- **Anamneses:** formulários são configuráveis por JSON Schema e associáveis a vários procedimentos. A aplicação congela a versão do formulário no plano do paciente; o profissional pode adicionar/remover anamneses e alterar sua obrigatoriedade no caso específico. Versionamento é imutável; restaurar versão cria nova versão com o próximo número. Respostas submetidas são imutáveis, com complementos profissionais separados. Validade da resposta: um ano. Solicitações usam links seguros com validade de sete dias; o profissional pode atualizar o link. O paciente não precisa criar login.
- **Contratos:** oferecer contrato padrão e contratos específicos para procedimentos/combos. Permitir importar DOCX e editar o documento no sistema. Versionar modelos de forma imutável; restauração cria nova versão. Ao aplicar contrato, preservar o documento gerado e sua versão junto ao plano. Assinatura digital e aceite eletrônico ficam fora do MVP.
- **Pagamentos:** registrar manualmente valores recebidos, forma (incluindo cartão de crédito à vista ou parcelado), quantidade informada de parcelas e saldo da contratação. Não processar cartão, criar cobranças externas, acompanhar parcelas na operadora ou integrar gateway no MVP. Não armazenar dados sensíveis de cartão.
- **Agenda e execução:** calendário semanal, seleção de intervalo por hora e sugestão de duração baseada no procedimento, sempre ajustável pelo profissional. Uma única agenda. Permitir sobreposição de horários. Agendamento é distinto de sessão; status de agendamento não consome sessões. Uma sessão realizada por procedimento consome uma unidade do plano aplicado.
- **Sessões e fotos:** campos específicos de sessão são definidos no cadastro do procedimento por formulário JSON Schema e congelados no plano aplicado. Sessões mantêm a estrutura do formulário usada para permitir leitura histórica. Fotos pertencem a sessões, podem ter categoria antes/durante/depois e observação opcional, e podem ser excluídas no MVP.
- **Histórico e pendências:** reunir no contexto do paciente contratações, anamneses e respostas, contratos, pagamentos, agendamentos, sessões, fotos e observações. Expor itens pendentes por paciente; notificações automáticas ao profissional estão fora do escopo.
- **Direção futura, não compromisso de MVP:** portal autenticado para o paciente consultar procedimentos, contratos e pagamentos; autenticação própria de paciente; assinatura digital; gateway de pagamentos; salas e disponibilidade de recursos; notificações; fluxos especializados de fisioterapia e dermatologia.

## Decisões de teste

- Testar externamente que alterações em procedimentos, combos, anamneses e contratos não mudam planos, documentos, respostas ou formulários já aplicados.
- Testar que restaurar versão de anamnese ou contrato cria uma nova versão numerada com conteúdo da versão escolhida e mantém versões existentes.
- Testar que link de anamnese permite retomar rascunho, expira após sete dias, pode ser atualizado e não permite uma segunda submissão da mesma solicitação após o envio.
- Testar que respostas enviadas permanecem iguais após complementos profissionais e que uma resposta com mais de um ano aparece como vencida para acompanhamento.
- Testar bloqueio da mesma oferta para o mesmo paciente e aceitação de ofertas diferentes com procedimentos compartilhados.
- Testar que a expiração de combo promocional impede novas aplicações após a vigência, mas não impede concluir sessões de plano aplicado anteriormente.
- Testar cálculo do saldo contratado após zero, um e múltiplos registros manuais de pagamento, incluindo registros parcelados e à vista.
- Testar calendário semanal com seleção/ajuste de intervalo, sugestão de duração e criação de agendamentos sobrepostos.
- Testar que cancelar ou marcar não comparecimento não cria sessão nem consome quantidade; registrar uma sessão realizada consome uma unidade e cada procedimento realizado gera sessão própria.
- Testar que o histórico e as pendências por paciente refletem alterações de anamnese, pagamento, agendamento e sessão sem exigir notificação automática.
- Testar anexar, classificar, consultar e excluir fotos vinculadas a sessões.
- Não há código de produto além do glossário neste repositório ainda; não há testes existentes para usar como padrão. Ao implementar, seguir o framework e os padrões de teste que forem estabelecidos no projeto.

## Fora de escopo

- Assinatura digital, aceite eletrônico ou prova de assinatura contratual pelo paciente.
- Portal autenticado do paciente, login de paciente e consulta direta de procedimentos, contratos ou pagamentos pelo paciente.
- Gateway de pagamento, cobrança online, processamento de cartão, conciliação e acompanhamento de parcelas na operadora.
- Roles, permissões/RBAC, usuários de recepção, múltiplas clínicas ou múltiplos profissionais/agendas.
- Verificação de disponibilidade ou conflito de salas e recursos; horários sobrepostos são permitidos.
- Notificações automáticas ao profissional.
- Fluxos clínicos especializados de fisioterapia e dermatologia.
- Sessões parcialmente realizadas.

## Notas adicionais

- A ideia de usar uma ferramenta visual como `jsonjoy-builder` para editar JSON Schema com prévia ao lado é uma direção de produto; a biblioteca/componente a adotar deve ser validada durante a implementação.
- Para DOCX, a intenção é permitir edição no sistema, importação e geração do documento aplicado. A tecnologia específica de edição e geração, incluindo eventual uso de Docxtemplater, ainda deve ser validada.
- Há uma decisão ainda aberta sobre o critério técnico de identidade de “mesma oferta” quando o catálogo muda ou quando se trata de combos promocionais baseados nos mesmos procedimentos. O bloqueio deve usar a identidade da oferta contratada, não apenas a interseção de procedimentos.
- O `CONTEXT.md` registra o vocabulário e decisões de domínio acordadas nesta conversa.
- ADRs: [0001 — Stack da aplicação](../adr/0001-stack-da-aplicacao.md) e [0002 — Proteção de acesso a dados clínicos](../adr/0002-seguranca-de-acesso-no-mvp.md).
