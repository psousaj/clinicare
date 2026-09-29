# Clínica de cuidados estéticos

Este contexto descreve a operação de uma clínica que combina fisioterapia, dermatologia e estética, com o primeiro produto concentrado na gestão de procedimentos estéticos.

## Organização da clínica

**Clínica**:
Unidade de atendimento que pode oferecer uma ou mais áreas profissionais, como fisioterapia, dermatologia e estética.
_Avoid_: consultório, empresa, unidade (quando usado para nomear a organização inteira)

**Área de atendimento**:
Uma frente profissional oferecida pela clínica, como fisioterapia, dermatologia ou estética.
_Avoid_: especialidade (quando a intenção for apenas classificar a operação da clínica)

## Atendimento estético

**Procedimento estético**:
Intervenção estética cadastrada pela clínica, com finalidade, duração, preparação, orientações e profissionais habilitados definidos.
_Avoid_: serviço, tratamento (quando se tratar de uma intervenção específica)

**Foco do MVP**:
A gestão de pacientes, documentos e agenda relacionados aos procedimentos estéticos. Fisioterapia e dermatologia devem ser reconhecidas como áreas da clínica, mas seus fluxos específicos não são prioridade inicial.
_Avoid_: escopo completo, prontuário generalista

**Instalação**:
Uma implantação do sistema atende uma única clínica no MVP; todos os pacientes, profissionais, procedimentos e documentos pertencem a essa clínica.
_Avoid_: tenant, conta (quando significar a clínica)

**Administrador**:
Usuário com acesso completo ao sistema no MVP, normalmente o próprio profissional responsável pela clínica pequena. O administrador configura a operação, realiza procedimentos e usa a agenda única da clínica.
_Avoid_: usuário compartilhado, dono (quando se referir ao acesso ao sistema)

**Perfis de acesso**:
A distinção entre administrador, recepção e profissional, incluindo roles, permissões e RBAC, fica fora do MVP e será adicionada posteriormente.
_Avoid_: níveis de usuário (como termo oficial)

## Jornada do paciente

**Paciente**:
Pessoa que realiza ou pretende realizar procedimentos na clínica e cujos dados, documentos, sessões e histórico são acompanhados pelo profissional.
_Avoid_: cliente (como termo principal do domínio)

**Procedimento**:
Oferta individual de uma intervenção estética, configurada pelo profissional como atendimento único ou como tratamento composto por sessões. O procedimento possui um número base de sessões, que pode ser sobrescrito por um combo.
_Avoid_: sessão, combo

**Tratamento**:
Acompanhamento de um procedimento configurado para ocorrer em múltiplas sessões, usando a quantidade de sessões definida no procedimento ou sobrescrita pelo combo aplicado.
_Avoid_: combo (quando significar a execução clínica do procedimento)

**Sessão**:
Registro de um procedimento efetivamente realizado, pertencente a um tratamento ou procedimento único e opcionalmente relacionado a um agendamento. Cada procedimento realizado gera sua própria sessão, mesmo quando vários procedimentos fazem parte do mesmo agendamento. Não existe sessão parcialmente realizada.
_Avoid_: consulta, atendimento, sessão parcial

**Sessão realizada**:
Sessão registrada pelo profissional como efetivamente concluída, consumindo uma unidade da quantidade de sessões do plano aplicado.
_Avoid_: sessão consumida (como status), atendimento concluído

**Acompanhamento da sessão**:
Registro complementar de uma sessão realizada: campos do procedimento, observações e fotos classificadas como antes, durante ou depois. Pode ser editado a qualquer momento a partir da ficha do paciente.
_Avoid_: prontuário da sessão, galeria

**Consumo de sessão**:
Acontece somente quando o profissional registra o procedimento como realizado. Agendamentos, cancelamentos e não comparecimentos não consomem sessões automaticamente; o não comparecimento não gera uma sessão.
_Avoid_: baixa automática, sessão utilizada

**Campos configuráveis do procedimento**:
Conjunto de dados adicionais definido no cadastro de um procedimento para ser preenchido pelo profissional em cada sessão, além dos campos básicos comuns a todas as sessões.
_Avoid_: campos da sessão (quando se tratar da configuração), formulário do combo

**Dados da sessão**:
Informações específicas preenchidas pelo profissional ao registrar uma sessão, conforme os campos básicos e os campos configuráveis do procedimento realizado. A estrutura desses campos deve ser preservada junto da sessão para que os dados históricos continuem interpretáveis.
_Avoid_: anamnese, dados do agendamento

**Versão do formulário de sessão**:
Estado imutável do formulário baseado em esquema configurado para um procedimento. Uma versão é congelada no plano aplicado; alterações posteriores criam uma nova versão para novos planos e não alteram tratamentos já iniciados.
_Avoid_: schema atual, formulário da sessão (quando for necessário distinguir a versão)

**Foto da sessão**:
Imagem anexada pelo profissional a uma sessão, com possível classificação como antes, durante ou depois do procedimento e observação opcional. Fotos podem ser excluídas no MVP e não precisam permanecer no histórico após a exclusão.
_Avoid_: foto do paciente (quando a imagem estiver contextualizada por uma sessão)

**Formulário configurável**:
Estrutura de perguntas e campos definida pela clínica para coletar dados de uma anamnese ou registrar dados específicos de uma sessão. O mesmo modelo de formulário pode ser reutilizado em diferentes contextos quando fizer sentido.
_Avoid_: formulário livre, tela de cadastro

**Tipo de campo**:
Forma de resposta de um campo do formulário: texto curto, texto longo, número, apenas dígitos, data, hora, telefone, e-mail, CPF, sim/não, escolha única, múltipla escolha e escala de 0 a 10. O tipo define máscara, validação e o controle exibido ao responder (telefone/CPF mascarados; data e hora com seletor).
_Avoid_: formato, máscara (quando significar o tipo do campo)

**Documento modelo**:
Arquivo-base de um contrato que pode ser importado como DOCX ou editado pelo profissional dentro do sistema. Pode conter campos variáveis para ser aplicado a um paciente e a um plano específico; o documento aplicado deve preservar o conteúdo gerado naquele momento.
_Avoid_: contrato ativo (quando o foco for o arquivo-base), template (como termo principal do domínio)

**Editor de contrato**:
Recurso administrativo para o profissional criar ou alterar o conteúdo de um documento modelo dentro do sistema, além de poder importar um arquivo DOCX existente.
_Avoid_: editor de assinatura, editor do paciente

**Formulário baseado em esquema**:
Formulário cuja estrutura, tipos, validações e campos são definidos por um JSON Schema, permitindo que anamneses e dados específicos de sessões sejam construídos e exibidos por ferramentas compatíveis.
_Avoid_: formulário hard-coded, formulário fixo

**Documento aplicado**:
Cópia gerada de um documento modelo para um paciente ou plano específico, preservando o conteúdo apresentado naquele momento. No MVP, contratos são carregados como arquivos DOCX e podem usar campos variáveis para geração do documento aplicado.
_Avoid_: documento dinâmico, template preenchido

**Agendamento**:
Compromisso planejado no calendário semanal, com início e fim selecionados pelo profissional em intervalos de uma hora. Pode incluir vários procedimentos do plano de um paciente. Pode ser remarcado, cancelado ou registrado como não comparecimento sem se confundir com a sessão realizada.
_Avoid_: sessão, consulta (quando significar o compromisso planejado)

**Duração do procedimento**:
Tempo estimado configurado para um procedimento e usado como sugestão ao criar um agendamento. O profissional pode ajustar manualmente o horário de início e fim da sessão agendada.
_Avoid_: duração da sessão realizada (quando se tratar apenas da estimativa)

**Calendário semanal**:
Visão da agenda organizada por semana, permitindo ao profissional selecionar diretamente um intervalo de horário e criar ou ajustar agendamentos. No MVP há uma única agenda do profissional-administrador.
_Avoid_: agenda mensal (como visão principal do MVP)

**Conflito de horário**:
Dois agendamentos podem se sobrepor na agenda do MVP; o sistema não bloqueia nem impede a criação de horários sobrepostos.
_Avoid_: disponibilidade de sala (controle futuro separado)

**Disponibilidade de sala**:
Controle de salas, recursos e conflitos de espaço para agendamentos. Fica fora do MVP e pode ser considerado futuramente.
_Avoid_: agenda do profissional (são recursos distintos)

**Status do agendamento**:
Estado operacional de um agendamento, como planejado, confirmado, remarcado, cancelado ou não compareceu. O status não prova que uma sessão foi realizada.
_Avoid_: status da sessão

**Combo**:
Conjunto comercial pré-configurado de procedimentos que são vendidos juntos. Pode ser padrão (sem prazo, preço fixo) ou promocional. Para cada procedimento, pode manter o número base de sessões ou definir uma quantidade própria; também pode ter vigência e preço próprios.
_Avoid_: pacote, tratamento (quando significar a oferta comercial)

**Item de combo**:
Procedimento incluído em um combo, com uma quantidade de sessões opcional que sobrescreve a quantidade base do procedimento quando o combo é aplicado a um paciente.
_Avoid_: componente, produto do combo

**Combo promocional**:
Combo comercial disponível durante um período de validade e com preço promocional diferente dos preços individuais ou do combo padrão. A validade controla até quando o combo pode ser aplicado; depois de aplicado, o paciente pode concluir as sessões mesmo após o fim da validade.
_Avoid_: campanha (quando o conjunto de procedimentos e seu preço forem o foco)

**Procedimento selecionado**:
Procedimento ou item de combo que o profissional vincula ao acompanhamento de um paciente após definir o que será realizado.
_Avoid_: pedido, compra

**Plano aplicado**:
Registro congelado das condições de contratação escolhidas para um paciente, preservando os procedimentos, quantidades de sessões, preço e demais informações comerciais no momento da contratação. Alterações posteriores no procedimento ou combo não modificam planos já aplicados. Um paciente pode ter vários planos ativos ao mesmo tempo, desde que não contrate duas vezes a mesma oferta.
_Avoid_: combo (quando se referir ao caso concreto do paciente), pedido

**Oferta duplicada**:
O mesmo paciente não pode contratar novamente a mesma oferta, seja o mesmo combo ou o mesmo procedimento. Ofertas diferentes podem ser contratadas mesmo quando incluem procedimentos em comum.
_Avoid_: procedimento duplicado (quando a duplicidade se refere à oferta inteira)

**Preço contratado**:
Valor total acordado para um plano aplicado no momento da contratação, preservado mesmo que os preços do procedimento ou combo sejam alterados depois.
_Avoid_: valor atual, preço da sessão

**Valor recebido**:
Quantia informada pelo profissional como recebida para uma contratação. Pode ser registrada em pagamentos separados e compõe o saldo da contratação.
_Avoid_: preço contratado, cobrança

**Forma de pagamento**:
Modalidade usada para quitar uma contratação, incluindo cartão de crédito à vista ou cartão de crédito parcelado no MVP.
_Avoid_: método financeiro

**Pagamento parcelado**:
Pagamento de uma contratação no cartão de crédito com quantidade de parcelas definida no momento da cobrança e confirmada pelo gateway.
_Avoid_: sessão parcelada, plano parcelado

**Condições de contratação**:
Conjunto comercial registrado para um paciente, incluindo preço total contratado, valor pago, forma de pagamento, quantidade de parcelas, procedimentos contratados, quantidades de sessões e documentos relacionados. As condições da contratação são independentes da execução posterior dos procedimentos.
_Avoid_: tratamento, condições da sessão

**Registro de pagamento**:
Lançamento manual feito pelo profissional para registrar um valor recebido pela clínica, vinculado a uma contratação e com forma de pagamento e situação informadas. No MVP, pagamentos são registrados, não processados pelo sistema.
_Avoid_: cobrança, gateway

**Forma de pagamento**:
Modalidade registrada para um pagamento, incluindo cartão de crédito à vista ou parcelado. O registro não implica processamento ou confirmação por integração externa.
_Avoid_: método financeiro

**Pagamento parcelado**:
Pagamento em cartão de crédito cuja quantidade de parcelas é informada pelo profissional ao registrar o valor recebido. O sistema não processa o cartão nem acompanha parcelas junto à operadora no MVP.
_Avoid_: sessão parcelada, plano parcelado

**Saldo da contratação**:
Diferença entre o preço contratado e a soma dos pagamentos registrados. Permite acompanhar valores pendentes sem processar cobranças ou parcelas automaticamente.
_Avoid_: saldo do tratamento, saldo de sessões

**Gateway de pagamento**:
Integração futura com serviço externo para processar cobranças e receber confirmações. Fica fora do MVP.
_Avoid_: registro manual de pagamento

**Contratação**:
Registro do acordo comercial entre a clínica e o paciente, a partir do qual ficam definidos os procedimentos contratados e suas condições, independentemente de quando as sessões serão realizadas.
_Avoid_: atendimento, tratamento

**Execução do procedimento**:
Realização prática de um procedimento por meio de sessões, combinada entre o profissional e o paciente depois da contratação. A execução não altera as condições comerciais já registradas.
_Avoid_: contratação, venda

## Documentos e coleta

**Formulário de anamnese**:
Modelo de formulário clínico configurável que o profissional associa aos procedimentos selecionados e que o paciente pode responder por um link. Um formulário de anamnese pode ser associado a vários procedimentos. Na interface, o catálogo desses modelos é chamado de “Formulários de anamnese”.
_Avoid_: anamnese (quando significar o modelo do catálogo), questionário (quando se tratar de coleta clínica do paciente)

**Anamnese aplicada**:
Cópia de uma anamnese associada ao plano de um paciente, preservando a versão do formulário e permitindo que o profissional adicione, remova ou altere a obrigatoriedade daquela anamnese para o caso específico.
_Avoid_: anamnese (quando for necessário distinguir o modelo do formulário aplicado)

**Anamnese obrigatória**:
Anamnese aplicada que precisa ser respondida para completar a coleta solicitada pelo profissional.
_Avoid_: requisito clínico (quando se referir ao formulário)

**Validade da anamnese**:
Período de um ano durante o qual uma resposta de anamnese preenchida pode ser considerada vigente para a clínica. Após esse período, o profissional pode solicitar uma nova resposta conforme a necessidade do procedimento ou do paciente.
_Avoid_: expiração do link

**Versão da anamnese**:
Estado imutável do formulário de uma anamnese em um momento específico. Versões podem ser consultadas, e editar o formulário ou fazer rollback sempre cria uma nova versão (origem: criada, editada ou rollback da versão X); nenhuma versão existente é sobrescrita.
_Avoid_: revisão, cópia (quando se referir à sequência oficial do formulário)

**Anamnese ativa**:
Versão corrente de uma anamnese disponível para novas aplicações. Desativar a anamnese impede novas aplicações, mas preserva suas versões e respostas históricas.
_Avoid_: versão publicada (quando não houver um fluxo separado de publicação)

**Contrato padrão de serviço**:
Documento comercial geral apresentado ao paciente para leitura antes da realização dos procedimentos. O documento pode ser importado como DOCX ou editado pelo profissional no sistema; assinatura digital fica fora do MVP.
_Avoid_: contrato genérico

**Contrato específico de procedimento**:
Documento adicional associado a um procedimento ou combo específico, apresentado além do contrato padrão quando necessário. O documento pode ser importado como DOCX ou editado pelo profissional no sistema; assinatura digital fica fora do MVP.
_Avoid_: contrato da guia

**Versão de contrato**:
Estado imutável de um contrato em um momento específico. Versões podem ser consultadas, e restaurar uma versão anterior cria uma nova versão com o próximo número; nenhuma versão existente é sobrescrita.
_Avoid_: revisão, cópia (quando se referir à sequência oficial do contrato)

**Contrato aplicado**:
Vínculo de uma versão específica de contrato ao plano de um paciente, preservando exatamente o documento apresentado naquele momento.
_Avoid_: contrato atual (quando o foco for o documento vinculado ao paciente)

**Contrato ativo**:
Contrato corrente disponível para novas aplicações. Alterações ou restaurações geram uma nova versão sem modificar contratos aplicados anteriormente.
_Avoid_: contrato publicado (quando não houver um fluxo separado de publicação)

**Link do paciente**:
Acesso enviado ao paciente para responder anamneses e ler documentos sem precisar acessar o sistema administrativo. O link de anamnese é seguro e pode ser usado para continuar o preenchimento, mas só pode concluir e enviar a solicitação uma vez.
_Avoid_: portal do paciente (o MVP não define um portal completo)

**Solicitação de anamnese**:
Pedido criado pelo profissional para que um paciente responda uma ou mais anamneses aplicadas, usando as versões definidas naquele momento. A solicitação pode atualizar um pedido anterior quando o profissional precisar reenviar ou ajustar a coleta.
_Avoid_: formulário (quando o foco for a tarefa enviada ao paciente)

**Link de anamnese**:
Acesso seguro e temporário para responder uma solicitação de anamnese. Vale por sete dias, não exige revogação manual e pode ser atualizado pelo profissional, invalidando o link anterior. O link não deve expor dados pessoais ou clínicos.
_Avoid_: link permanente, token público

**Resposta de anamnese**:
Registro das respostas enviadas pelo paciente para uma anamnese aplicada. Depois do envio, é imutável e pode receber apenas observações ou correções complementares registradas pelo profissional. Uma resposta pode permanecer vigente por um ano, conforme a validade da anamnese.
_Avoid_: resposta editável, rascunho (quando já tiver sido enviada)

**Rascunho de anamnese**:
Preenchimento ainda não enviado pelo paciente, que pode ser retomado pelo link seguro correspondente.
_Avoid_: resposta (quando ainda não foi submetida)

**Portal do paciente**:
Experiência futura autenticada na qual o paciente poderá consultar seus dados, procedimentos, contratos e pagamentos. Está fora do MVP.
_Avoid_: link do paciente (o portal pressupõe login e acesso recorrente)

**Autenticação**:
Login do paciente e login do profissional administrador são ideias futuras e ficam fora do MVP. O MVP utiliza o acesso administrativo necessário para salvar e operar os dados sem definir ainda um fluxo de autenticação.
_Avoid_: acesso público (os links do paciente continuam protegidos)

**Histórico do paciente**:
Linha do tempo das contratações, anamneses e respostas, contratos, agendamentos, sessões, fotos, pagamentos e observações registrados para aquele paciente. O profissional pode consultar o histórico e conferir itens pendentes por paciente.
_Avoid_: prontuário (termo amplo demais para o escopo inicial)

**Pendência do paciente**:
Item que exige atenção ou conclusão no acompanhamento do paciente, como anamnese não respondida, contrato ainda não disponibilizado, pagamento pendente ou sessão contratada ainda não realizada. O profissional pode consultar pendências no contexto do paciente.
_Avoid_: notificação (não implica aviso automático ao profissional)

## Princípios do MVP

**Ação profissional**:
O profissional é o ponto de partida das ações do MVP: cadastra o paciente, seleciona procedimentos, associa anamneses e contratos, registra agendamentos e documenta as sessões. O sistema não presume automações clínicas ou operacionais.
_Avoid_: fluxo automático

**Notificação**:
Aviso ao profissional sobre respostas de anamneses ou assinaturas concluídas. Fica fora do escopo do MVP, embora o sistema possa armazenar as respostas e documentos recebidos.
_Avoid_: alerta (como termo do domínio)

**Assinatura digital**:
Fluxo futuro para o paciente assinar contratos eletronicamente e produzir um documento assinado associado à contratação. Está fora do MVP; no MVP o profissional pode criar ou importar documentos, gerar o documento aplicado e disponibilizá-lo para leitura, mas não há assinatura pelo sistema.
_Avoid_: aceite eletrônico, assinatura simples

**Documento assinado**:
Versão futura do documento aplicado que registra a contratação após a assinatura do paciente. A existência e o armazenamento desse documento fazem parte da direção do produto, mas sua geração e validação ficam fora do MVP.
_Avoid_: contrato aplicado (o documento aplicado ainda não está assinado)

**JSON Schema Form**:
Abordagem futura de construção e renderização visual dos formulários baseada em JSON Schema. Ferramentas como builders visuais podem ser integradas para permitir que o profissional monte o formulário vendo uma prévia ao lado.
_Avoid_: formulário customizado por tela

**DocxTemplate**:
Documento DOCX carregado como modelo de contrato e processado futuramente com Docxtemplater para substituir campos variáveis e gerar documentos aplicados. O upload de DOCX e a integração com Docxtemplater fazem parte da direção do produto, mas o fluxo exato de geração ainda será definido.
_Avoid_: PDF modelo, contrato HTML

**Armazenamento de arquivos**:
Fotos e documentos são armazenados no Cloudflare R2 por meio da API compatível com S3; metadados e referências aos pacientes, sessões e contratos ficam no MongoDB.
_Avoid_: armazenamento no banco (para o conteúdo binário)

**Agregado**:
Conjunto de dados com identidade e ciclo de vida próprios, armazenado em uma coleção MongoDB; relacionamentos com outros agregados usam referências e são validados pela aplicação.
_Avoid_: coleção (quando significar o conceito de domínio)

**Snapshot aplicado**:
Cópia imutável e autocontida das condições de formulário, preço, composição ou documento no momento em que uma oferta é aplicada ao paciente.
_Avoid_: referência dinâmica à configuração atual
