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

**Tenant**:
Limite de isolamento dos dados de uma clínica cliente do SaaS. Cada clínica é um tenant próprio; todos os pacientes, profissionais, procedimentos e documentos pertencem a exatamente um tenant. O SaaS pode ter vários tenants, e o administrador da plataforma provisiona cada novo tenant junto com sua conta administrativa. O tenant inicial determinístico usado antes da autenticação existe apenas para compatibilidade do protótipo e deve deixar de ser a forma normal de identificar a clínica quando o acesso autenticado estiver ativo.

**Isolamento do tenant**:
Regra de que uma operação, busca ou vínculo só pode acessar dados pertencentes ao mesmo tenant. O isolamento vale para entidades principais e seus dados dependentes; um registro de um tenant nunca pode ser associado a um registro de outro. O administrador da clínica só pode operar o tenant vinculado à sua conta; o administrador da plataforma pode provisionar tenants e administrar suas credenciais, mas não recebe acesso operacional automático aos dados clínicos de cada tenant nem pode entrar como um administrador da clínica.
_Avoid_: instalação, conta (quando significar a clínica), implantação (quando significar o limite de dados)

**Índice de busca sensível**:
HMAC-SHA-256 calculado sobre o `tenant_id`, o nome da tabela, o nome do campo, a versão da normalização e o valor normalizado. Permite busca exata sem armazenar o valor em texto aberto. Não é o valor criptografado nem substitui a confirmação de igualdade após a descriptografia.
_Avoid_: hash simples, criptografia determinística

**Administrador**:
Pessoa responsável pela clínica que possui a única conta administrativa daquela clínica no MVP. O administrador é o dono e operador da clínica, tem acesso completo ao sistema, configura a operação, realiza procedimentos e usa a agenda única. Também pode configurar no próprio perfil autenticado os dados profissionais usados na autoria e materialização de contratos, incluindo nome profissional e registro profissional. O MVP não oferece funcionários nem múltiplas contas por clínica.
_Avoid_: usuário compartilhado, dono (quando se referir apenas à permissão sem mencionar a pessoa responsável pela clínica)

**Profissional**:
Pessoa com uma conta autenticada vinculada ao tenant e marcada como profissional da clínica. A relação entre conta e profissional é um-para-um opcional em cada lado: uma conta pode não ter ou ter uma única entidade profissional, e cada entidade profissional pertence a uma única conta. A entidade profissional representa os dados profissionais da pessoa, enquanto o nome exibido em contratos vem da conta autenticada relacionada. No MVP, o administrador da clínica pode indicar no dashboard se sua própria conta também é profissional e, nesse caso, cadastrar seu tipo, número e estado opcional de registro. Um profissional pode ser desativado logicamente: deixa de ser elegível para novas aplicações, mas permanece preservado como responsável histórico de contratos aplicados e seus snapshots. A modelagem permite que futuras contas e papéis tenham seus próprios vínculos profissionais, sem transformar todo administrador em profissional automaticamente.
_Avoid_: administrador (quando o foco for a habilitação profissional), participante da assinatura

**Registro profissional**:
Identificação profissional de uma entidade profissional, composta por um tipo de conselho ou registro, como CRM ou CREFITO, seu número e, quando aplicável, a unidade federativa do registro. Cada profissional possui exatamente um registro no modelo do produto; não há coleção de registros alternativos nem seleção entre registros. O registro é usado como `{professional.registration}` após formatação no contexto de materialização; alterações posteriores não modificam snapshots já criados. O tipo pertence a um catálogo controlado e o estado é opcional para registros que não tenham essa distinção; quando informado, representa uma UF brasileira válida e não parte do nome da pessoa.
_Avoid_: CPF, registro do paciente, papel de acesso, múltiplos registros

**Perfis de acesso**:
A distinção entre administrador, recepção e profissional, incluindo múltiplas contas, roles, permissões e RBAC, fica fora do MVP e será adicionada posteriormente.
_Avoid_: níveis de usuário (como termo oficial)

## Jornada do paciente

**Paciente**:
Pessoa que realiza ou pretende realizar procedimentos no tenant e cujos dados, documentos e histórico são acompanhados pelo profissional. Dados de contato, identificação, clínicos e demais informações de risco ficam protegidos na persistência e só são revelados depois de autorização; o nome permanece pesquisável em texto aberto para sustentar a busca principal do produto. A data de nascimento é um dado civil do paciente, sem semântica de horário, armazenada opcionalmente; sua ausência não impede o cadastro nem contratos que não precisem dela, mas impede a materialização de um contrato cujo contexto publicado exija esse dado.
_Avoid_: cliente (como termo principal do domínio)

**Dado pessoal protegido**:
Informação pessoal, clínica ou de identificação que, por risco ou finalidade, deve permanecer cifrada na persistência e só pode ser revelada depois de autorização. Inclui telefone, e-mail, identificadores civis, notas pessoais, respostas de anamnese, dados e observações de atendimentos e evidências identificáveis de assinatura. O nome do paciente é uma exceção deliberada: continua sendo dado pessoal sob a LGPD, mas permanece em texto aberto para permitir busca textual eficiente. A busca usa filtro obrigatório por `tenant_id` e índice textual apropriado no PostgreSQL; não há coluna duplicada de nome normalizado nesta fase. `patients.notes` é uma coluna inteira cifrada e não pesquisável.
_Avoid_: dado sensível em texto aberto

**Dado pessoal não sensível**:
Informação relacionada a uma pessoa identificada ou identificável que não pertence, por si só, à categoria de dado pessoal sensível da LGPD. A classificação não elimina a obrigação de proteção, minimização e controle de acesso. O nome do paciente pertence a esta categoria no escopo atual e pode permanecer em texto aberto por decisão de produto.

**Busca exata protegida**:
Busca por igualdade em um dado pessoal protegido, sem revelar o valor durante a consulta ao banco. No escopo atual, aplica-se a e-mail, telefone e CPF opcional, com normalização própria e índice HMAC separado. A aplicação confirma a igualdade após descriptografar o resultado autorizado antes de devolvê-lo. Valores não nulos de cada campo — e-mail, telefone e CPF — são únicos dentro do tenant, sem exigir que os três campos tenham o mesmo valor ou que todos sejam preenchidos. A etapa atual não oferece busca textual indexada em conteúdo cifrado.
_Avoid_: busca por texto cifrado

**Coluna protegida**:
Coluna que armazena um único valor sensível cifrado pela aplicação com AES-256-GCM. Cada valor possui seu próprio nonce aleatório e metadados mínimos de versão da chave necessários para descriptografia; a aplicação cifra e decifra a coluna inteira, sem tentar cifrar campos arbitrários dentro de um JSON. O contexto autenticado da cifra vincula o valor ao `tenant_id`, tabela, registro, coluna e versão da chave. Índices HMAC pesquisáveis, quando necessários, ficam em colunas separadas.
_Avoid_: envelope criptográfico complexo, JSON parcialmente cifrado

**Normalização de busca**:
Transformação determinística aplicada de forma igual ao guardar e consultar um dado pesquisável. E-mail usa `trim` e lowercase; telefone usa somente dígitos, sem adicionar ou remover código de país automaticamente; CPF usa somente dígitos e é opcional. CPF informado deve ter exatamente 11 dígitos, sem validação dos dígitos verificadores nesta fase. Valores vazios tornam-se `NULL`. Novas regras precisam ser versionadas para preservar a consistência histórica.
_Avoid_: normalização implícita

**Chave de proteção de dados**:
Segredo usado pela aplicação para cifrar e decifrar colunas protegidas com AES-256-GCM. A chave não pertence ao banco nem ao repositório; é fornecida por variável de ambiente segura e identificada por uma versão persistida nos dados. A chave de dados é distinta da chave usada nos índices HMAC.
_Avoid_: chave armazenada no banco, chave compartilhada com HMAC

**Chave de busca protegida**:
Segredo fornecido por variável de ambiente segura e usado exclusivamente para calcular índices HMAC de busca exata. É diferente da chave de proteção de dados, não é persistido e possui versão própria para permitir rotação e reindexação futura.
_Avoid_: chave de cifragem, SHA simples

**Log operacional protegido**:
Registro técnico que pode conter request, tenant, ator, operação, entidade, ID técnico, resultado, duração e classe de erro, mas nunca valores pessoais, clínicos, termos de busca, plaintext protegido, ciphertext, nonce, índices HMAC completos ou chaves. Auditoria de negócio preserva eventos nas tabelas próprias sem copiar conteúdo sensível para logs.

**Procedimento**:
Oferta individual de uma intervenção estética, com duração e preço por sessão e um mínimo opcional de sessões. Sem mínimo acima de uma sessão, pode ser realizado avulso; com mínimo de duas ou mais, só pode ser incluído em combo, plano ou evento. O mínimo também é a quantidade inicial sugerida para o item de combo, plano ou evento, que pode ser aumentada mas não reduzida abaixo dele. Um atendimento avulso corresponde a uma sessão, é cobrado e segue as regras de anamnese e validade; ao ser agendado ou registrado, gera internamente um registro de cobrança próprio, exibido como "Atendimento avulso" e não como acompanhamento.
_Avoid_: sessão, combo

**Acompanhamento**:
Registro iniciado pelo profissional na ficha do paciente ("Novo acompanhamento") a partir de um combo, de um plano ou de um evento (procedimento avulso tem apenas o registro interno de cobrança, sem ser um acompanhamento). Ao ser iniciado, congela a versão da oferta, as condições comerciais (itens, sessões, preço e validade), os schemas e, quando a oferta for um plano ou evento, seus contratos aplicáveis. Um acompanhamento de combo entra ativo; um acompanhamento de plano ou de evento começa ocioso e fica ativo após a assinatura dos contratos obrigatórios pelo paciente. Enquanto houver um acompanhamento não encerrado da mesma oferta para o paciente, não é permitido iniciar outro; a identidade da oferta é o plano, combo ou evento, independentemente da versão do plano. Depois que o anterior for finalizado, uma nova contratação da mesma oferta é permitida usando a versão corrente. Pode ser cancelado explicitamente e reúne atendimentos e pagamentos enquanto ativo. Um paciente pode ter vários acompanhamentos da mesma oferta ao longo do tempo.
_Avoid_: tratamento, plano aplicado, contratação, pedido, atendimento (nome antigo)

**Acompanhamento encerrado**:
Acompanhamento que não possui mais execução pendente e não bloqueia uma nova contratação da mesma oferta. Acompanhamento ocioso, pendente de assinatura ou ativo ainda não é encerrado. O encerramento ocorre automaticamente quando todas as sessões são consumidas ou por cancelamento explícito, preservando o histórico. Saldo financeiro pendente não impede o encerramento operacional; um acompanhamento encerrado não aceita novos agendamentos ou atendimentos, mas ainda pode receber pagamentos pendentes até atingir o preço contratado.

**Acompanhamento ocioso**:
Acompanhamento já iniciado para um paciente, com snapshots próprios da versão da oferta, mas ainda não liberado para agendamento ou execução porque os contratos obrigatórios do plano não foram assinados ou porque seus documentos aplicados ainda estão em geração. Sua criação materializa de uma vez as dependências necessárias, incluindo itens, contratos, anamneses aplicados e a data de aplicação do contrato quando informada. A geração dos documentos pode ocorrer depois da criação transacional do acompanhamento; enquanto houver contrato em geração ou falha de geração, não há R0 válido, links de assinatura nem liberação operacional. Mudanças posteriores no plano de catálogo não alteram esse acompanhamento. Pode receber pagamentos, mas não agendamentos ou atendimentos, enquanto estiver ocioso. Pode ser cancelado explicitamente, preservando seus snapshots e dependências históricas. Uma falha de geração permite retry explícito e idempotente no mesmo contrato aplicado, usando a mesma versão e o mesmo snapshot; um R0 existente nunca é substituído.
_Avoid_: rascunho descartável, plano atual

**Cancelamento de acompanhamento**:
Encerramento explícito de um acompanhamento, com motivo registrado. Bloqueia novas operações e cancela agendamentos futuros vinculados, liberando reservas, mas preserva atendimentos realizados, pagamentos, contratos, anamneses e demais históricos. Se ocorrer durante a geração de documentos, impede a promoção para pronto e o início da assinatura; R0 ou artefatos já criados são preservados como histórico, mas não se tornam operacionais, e arquivos temporários podem ser limpos posteriormente. Um acompanhamento cancelado não aceita retry de geração nem volta à operação silenciosamente; uma nova contratação cria outro acompanhamento.

**Catálogo**:
Conjunto de procedimentos, combos, planos, eventos, formulários de anamnese e documentos modelo que podem ser oferecidos ou aplicados pela clínica. Alterar ou retirar um item do catálogo não altera acompanhamentos nem atendimentos já existentes.
_Avoid_: histórico do paciente

**Desativação de catálogo**:
Retirada de um procedimento, combo, plano, evento, formulário ou documento modelo da disponibilidade para novas aplicações, preservando o próprio registro e tudo que já foi aplicado a pacientes. No MVP, exclusões solicitadas pelo sistema têm esse significado, e não o apagamento do histórico. A desativação não invalida nem cancela acompanhamentos ociosos já iniciados com snapshots próprios.
_Avoid_: cancelamento de acompanhamento, exclusão de histórico

**Paciente desativado**:
Paciente que deixa de aparecer nas operações correntes sem ter seu histórico clínico, comercial, financeiro ou de agenda apagado. Só pode ser desativado quando não possui acompanhamento não encerrado, contrato pendente de assinatura ou agendamento pendente. Seus dados de identificação e histórico são preservados, mas e-mail, telefone e CPF podem ser reutilizados por um novo cadastro ativo no mesmo tenant. O histórico do paciente desativado não deve aparecer como paciente operacional sem uma busca histórica explícita. A desativação não apaga dados dependentes nem os transfere para um novo cadastro; reativar o paciente antigo é uma ação explícita.
_Avoid_: paciente excluído, anonimização automática

**Retenção histórica**:
No MVP, não há exclusão ou anonimização automática de dados clínicos, financeiros, contratuais, de atendimentos ou respostas. Uma futura eliminação deve ser uma operação explícita, auditada e compatível com as obrigações legais e de continuidade do cuidado.

**Plano**:
Oferta de catálogo, distinta do combo, que agrupa procedimentos avulsos, combos e contratos. Um combo entra no plano por referência e mantém as quantidades de sessões da própria configuração; o plano não as altera. No MVP, é a única oferta, junto com o evento, que possui contratos para assinatura. Cada procedimento avulso incluído tem sua própria quantidade de sessões, que respeita o mínimo do procedimento. O mesmo procedimento pode aparecer avulso e dentro de um combo do plano, como itens separados; o mesmo procedimento avulso ou o mesmo combo não se repete. O preço do plano é informado pelo profissional e a tela sugere a soma dos itens (preço do procedimento × sessões, mais o preço de cada combo, promocional quando houver), editável a qualquer momento. O plano também pode ter duração e validade próprias. Alterações relevantes criam uma nova versão imutável; desativar o plano impede novas aplicações, mas preserva suas versões. Plano vencido apenas exibe o selo "Vencido" e não bloqueia nada.
_Avoid_: acompanhamento

**Versão do plano**:
Estado imutável da composição comercial de um plano em determinado momento, composto por procedimentos avulsos e combos. Inclui o snapshot comercial expandido de cada procedimento avulso e, para cada combo, seu nome e os itens do combo congelados naquele momento (procedimentos, quantidades, durações, preços e schemas), além do preço total, os contratos modelo aplicáveis e os schemas e dados necessários para interpretar a oferta sem consultar configurações mutáveis. A relação com contratos referencia somente os contratos modelo exigidos; não congela antecipadamente uma versão publicada. Em cada nova aplicação, a versão publicada corrente de cada contrato modelo é resolvida e então congelada no acompanhamento e nos contratos aplicados. Um plano pode referenciar um contrato modelo ainda sem versão publicada, mas sua aplicação é bloqueada até que exista uma versão publicada válida. Um acompanhamento captura a versão do plano e as versões correntes dos contratos no momento em que é iniciado, não passando a refletir alterações posteriores no plano nem novas publicações de contratos.
_Avoid_: plano atual, edição retroativa, versão de contrato congelada no catálogo

**Atendimento**:
Realização de um procedimento, registrada pelo profissional, pertencente a um acompanhamento (combo ou plano) ou avulsa (com registro de cobrança próprio de uma sessão), e opcionalmente relacionada a um agendamento. Cada procedimento realizado gera seu próprio atendimento, mesmo quando vários fazem parte do mesmo agendamento. Não existe atendimento parcialmente realizado. No código o registro se chama `Attendance` (`/api/attendances`).
_Avoid_: consulta, sessão parcial

**Sessão**:
Tempo em que o paciente está com o profissional, correspondente a um agendamento; nela podem ser realizados vários atendimentos (procedimentos) até o limite de minutos do horário.
_Avoid_: consulta, atendimento (quando significar o tempo com o paciente)

**Duração da sessão**:
Tempo em minutos informado ao registrar ou editar o atendimento (por padrão, a duração do procedimento). Alimenta o tempo total do paciente; atendimentos sem duração não entram na soma.

**Relacionamento do paciente**:
Página do paciente com indicadores e gráficos: atendimentos realizados × contratados, tempo total, valores pagos e pendentes, frequência e faltas. O valor pendente é o saldo do acompanhamento (preço contratado menos pagamentos); o valor já realizado e não pago considera a fração realizada.
_Avoid_: CRM, fidelidade

**Atendimento realizado**:
Atendimento registrado pelo profissional como efetivamente concluído, consumindo uma unidade das sessões do procedimento no acompanhamento. Possui uma data de realização própria, distinta da data de materialização de um contrato e da data em que uma assinatura é confirmada. Pode ser cancelado explicitamente com motivo, preservando seu histórico e devolvendo a sessão ao saldo operacional dentro de uma transação.
_Avoid_: sessão consumida (como status)

**Data de aplicação do contrato**:
Data civil opcional informada ao iniciar um acompanhamento de plano, quando houver uma previsão relevante para os contratos daquele plano. No template, é exposta como `{application.date}`. Quando informada, é única para o acompanhamento e compartilhada pelo conjunto de procedimentos e contratos aplicados; não é uma data individual de cada procedimento. É copiada para o snapshot de materialização de cada contrato aplicado. Depois que os contratos aplicados são criados, fica congelada: remarcações, atendimentos, alterações cadastrais e correções posteriores não regeneram nem substituem seus documentos. Uma correção exige substituição explícita por novos contratos aplicados, preservando os anteriores. Não é inferida de `appointments.startsAt` ou `attendances.performedAt`, nem pela presença de um placeholder, e permanece distinta da data de materialização e da data de assinatura.
_Avoid_: data do procedimento realizado, data por procedimento, data de geração, data de assinatura

**Data de materialização do contrato**:
Momento técnico em que o sistema resolve o contexto, gera o DOCX materializado e produz o PDF específico do contrato aplicado. É distinto da data prevista do procedimento e da data de confirmação de assinatura.
_Avoid_: data prevista do procedimento, data de assinatura

**Data de assinatura**:
Momento em que um participante confirma sua assinatura no processo de assinatura. Cada confirmação pode ter seu próprio instante registrado; ele não substitui a data prevista do procedimento nem a data de materialização do contrato.
_Avoid_: data prevista do procedimento, data de geração

**Detalhes do atendimento**:
Registro complementar de um atendimento realizado: campos do procedimento, observações e fotos classificadas como antes, durante ou depois. Pode ser editado a qualquer momento a partir da ficha do paciente.
_Avoid_: prontuário, galeria

**Consumo de sessão**:
Acontece somente quando o profissional registra o procedimento como realizado. Agendamentos, cancelamentos e não comparecimentos não consomem sessões automaticamente; o não comparecimento não gera um atendimento.
_Avoid_: baixa automática, sessão utilizada

**Reserva de sessão**:
Quantidade de sessões de um item de acompanhamento comprometida por agendamentos ativos. A reserva reduz a quantidade disponível para novos agendamentos, mas não constitui consumo; somente o atendimento realizado consome uma sessão. Cancelar ou marcar como não compareceu libera a reserva.
_Avoid_: sessão consumida, atendimento realizado

**Campos configuráveis do procedimento**:
Conjunto de dados adicionais definido no cadastro de um procedimento para ser preenchido pelo profissional em cada sessão, além dos campos básicos comuns a todas as sessões.
_Avoid_: campos da sessão (quando se tratar da configuração), formulário do combo

**Dados da sessão**:
Informações específicas preenchidas pelo profissional ao registrar uma sessão, conforme os campos básicos e os campos configuráveis do procedimento realizado. A estrutura desses campos deve ser preservada junto da sessão para que os dados históricos continuem interpretáveis.
_Avoid_: anamnese, dados do agendamento

**Versão do formulário de sessão**:
Estado imutável do formulário baseado em esquema configurado para um procedimento. Uma versão é congelada no acompanhamento; alterações posteriores criam uma nova versão para novos planos e não alteram tratamentos já iniciados.
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

**Contrato modelo**:
Item reutilizável do catálogo que representa um contrato padrão de serviço ou um contrato específico de procedimento. É nele que o profissional importa e edita a autoria em DOCX. O contrato modelo nasce com um draft e sem versão publicada; só pode ser aplicado depois que uma publicação criar sua primeira versão de contrato com PDF correspondente. Depois disso, possui um draft mutável e versões de contrato publicadas e imutáveis; aplicações futuras escolhem uma versão específica. Alterar o texto do contrato modelo nunca altera uma versão publicada nem um contrato aplicado existente.
_Avoid_: documento modelo, contrato aplicado, template (como termo principal do domínio)

**Draft de contrato**:
Estado mutável de autoria de um contrato modelo, cujo formato principal é DOCX. Pode começar vazio ou por importação de um DOCX, ser editado, substituído e salvo várias vezes sem criar uma nova versão de contrato publicada. Um draft vazio ou sem conteúdo DOCX válido não pode ser publicado. A publicação transforma o conteúdo atual do draft em uma versão de contrato imutável e reposiciona o draft como uma cópia editável dessa versão publicada, pronta para uma eventual próxima alteração. O draft nunca é a fonte mutável de uma versão já publicada. Publicar um draft com o mesmo conteúdo da versão publicada corrente não cria uma versão duplicada e mantém a versão corrente.
_Avoid_: versão de contrato, contrato publicado, rascunho de assinatura

**Configuração de materialização do contrato**:
Configuração pertencente ao contrato modelo que declara quais contextos de aplicação ele aceita, se cada contexto habilitado é obrigatório ou opcional, quais placeholders do registry global podem ser usados no DOCX e quais desses placeholders exigem valor. Os contextos são persistidos como um mapa explícito com `enabled` e `required` para cada chave; `required` só pode ser verdadeiro quando `enabled` também for verdadeiro. `requiredPlaceholders` deve ser subconjunto de `allowedPlaceholders` e cada placeholder obrigatório só pode pertencer a um contexto habilitado e obrigatório; contexto desabilitado não pode fornecer placeholders; contexto habilitado e obrigatório precisa ser resolvido na aplicação; contexto habilitado e opcional pode estar ausente e produzir valores vazios conforme a política do template. O profissional habilita os contextos e seleciona explicitamente os placeholders elegíveis; essa configuração não declara quais procedimentos ou planos usam o contrato. Conteúdo DOCX, contextos e placeholders permitidos formam o mesmo draft de autoria e só se tornam oficiais juntos na publicação; qualquer mudança em um deles gera uma nova versão, desde que haja alteração efetiva. Contextos, placeholders permitidos e obrigatoriedades são congelados no snapshot de cada versão de contrato publicada.
_Avoid_: dependência do procedimento, placeholder arbitrário, configuração do contrato aplicado

**Placeholder permitido**:
Placeholder pertencente ao registry global e explicitamente habilitado na configuração de materialização do contrato modelo. Só pode ser usado no DOCX se seu contexto estiver habilitado e a própria chave estiver permitida. O registry distingue campos escalares de coleções; `plan.procedures` é uma coleção de strings, sem propriedade `.name` ou objeto de item, e o helper do editor pode inserir o bloco `{#plan.procedures}☒ {.}{/plan.procedures}`. A publicação valida o DOCX contra esse conjunto; a presença de um placeholder não cria por si só uma nova dependência nem decide sozinha quais dados devem ser coletados.
_Avoid_: variável livre, campo descoberto automaticamente, código no contrato

**Editor de contrato**:
Recurso administrativo para o profissional criar ou alterar o draft DOCX de um contrato modelo dentro do sistema, além de poder importar um arquivo DOCX existente. Opera somente no contrato modelo e nunca em um contrato aplicado ou documento PDF de assinatura.
_Avoid_: editor de assinatura, editor do paciente, editor de PDF

**Formulário baseado em esquema**:
Formulário cuja estrutura, tipos, validações e campos são definidos por um JSON Schema, permitindo que anamneses e dados específicos de sessões sejam construídos e exibidos por ferramentas compatíveis.
_Avoid_: formulário hard-coded, formulário fixo

**Documento aplicado**:
Cópia gerada de um documento modelo para um paciente ou plano específico, preservando o conteúdo apresentado naquele momento. No MVP, contratos são carregados como arquivos DOCX e podem usar campos variáveis para geração do documento aplicado.
_Avoid_: documento dinâmico, template preenchido

**Agendamento**:
Compromisso planejado no calendário semanal (grade de 1 hora), com início e fim escolhidos pelo profissional, que define a duração da sessão. Vale para qualquer coisa: procedimentos avulsos e/ou atendimentos de acompanhamentos (combo ou plano) do paciente. Cada item indica o procedimento e quantas vezes será realizado (mais de uma sessão do mesmo procedimento é permitido); a soma dos minutos dos itens não pode ultrapassar a duração do agendamento, e a duração de cada item de acompanhamento é a congelada na contratação. Sessões já reservadas em outros agendamentos futuros não podem ser reservadas de novo. Pode ser remarcado, cancelado ou registrado como não comparecimento sem se confundir com o atendimento realizado. Com acompanhamento ativo, o profissional marca o máximo de itens que couberem no tempo. Agendamentos sem atendimento confirmado podem ser cancelados ou ocultados, liberando suas reservas; agendamentos com atendimento confirmado permanecem preservados e não podem ser apagados.

**Confirmação de atendimento agendado**:
Ação do profissional que registra se um agendamento ocorrido resultou em atendimentos realizados, não comparecimento ou cancelamento. A confirmação de realização cria um atendimento por procedimento e consome as sessões correspondentes; os demais resultados não consomem sessões. Agendamentos encerrados pelo horário podem aparecer em uma fila de confirmação na tela principal. Quando há vários procedimentos, todos os itens começam selecionados e a ação principal é confirmar todos; o profissional pode desmarcar itens individualmente antes de confirmar.
_Avoid_: consumo automático pelo agendamento, presença presumida
_Avoid_: consulta (quando significar o compromisso planejado)

**Duração do procedimento**:
Tempo em minutos de cada sessão do procedimento, obrigatório no cadastro. Define quantos procedimentos cabem em um agendamento.
_Avoid_: duração do atendimento realizado (quando se tratar apenas da estimativa)

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
Conjunto comercial pré-configurado de procedimentos que são vendidos juntos. Cada item define a quantidade de sessões incluída, sugerida inicialmente pelo mínimo do procedimento e nunca inferior a ele. Pode ser padrão (sem prazo) ou promocional. O valor integral é a soma de (preço do procedimento × sessões) de cada item; o preço do combo começa nele e só pode ser aumentado, e o preço promocional pode ser reduzido mas nunca passar do preço do combo. Também pode ter vigência e preço próprios. Um combo pode compor planos como item por referência, sem que o plano altere suas sessões; ao contratar o plano, os itens do combo expandem em itens de acompanhamento por procedimento. Alterações posteriores são protegidas em acompanhamentos por um snapshot da oferta aplicada; não há versionamento formal do catálogo de combos nesta etapa.
_Avoid_: pacote, tratamento (quando significar a oferta comercial)

**Item de combo**:
Procedimento incluído em um combo, com quantidade de sessões definida no próprio item e congelada quando o combo é aplicado a um paciente.
_Avoid_: componente, produto do combo

**Item de plano**:
Procedimento avulso ou combo incluído em um plano. O procedimento avulso tem quantidade de sessões definida no próprio item e não inferior ao mínimo do procedimento; o item que referencia combo usa as quantidades já definidas naquele combo, congeladas na versão do plano.
_Avoid_: componente, produto do plano

**Combo promocional**:
Combo comercial disponível durante um período de validade e com preço promocional diferente dos preços individuais ou do combo padrão. A validade controla até quando o combo pode ser aplicado; depois de aplicado, o paciente pode concluir as sessões mesmo após o fim da validade.
_Avoid_: campanha (quando o conjunto de procedimentos e seu preço forem o foco)

**Evento**:
Dia civil da clínica com cardápio próprio de procedimentos e/ou combos, contratos obrigatórios e vários pacientes. Cada paciente escolhe um ou mais itens do cardápio no início do acompanhamento; a escolha vai para o contrato aplicado e só vira valor devido depois da baixa do profissional no que foi efetivamente realizado. Combo escolhido entra fechado, com todos os seus procedimentos e sessões cumpridos na data do evento, sem resto para depois. Não há preço total no catálogo do evento nem versionamento formal: a inscrição congela snapshot próprio e mudanças posteriores não alteram acompanhamentos já iniciados. Desativar o evento impede novas aplicações, mas preserva os já iniciados.
_Avoid_: campanha, mutirão, plano aberto, sessão (quando significar o dia), evento de assinatura

**Escolha do evento**:
Itens do cardápio que o paciente seleciona no início do acompanhamento de evento. A escolha é registrada no contrato aplicado como referência do que foi contratado naquele dia; não é preço contratado e item escolhido e não realizado vale zero.
_Avoid_: pedido, compra

**Valor realizado do evento**:
Soma dos preços das baixas confirmadas em um acompanhamento de evento, que começa em zero e cresce a cada atendimento realizado (procedimento avulso pelo preço da sessão, combo pelo preço do pacote, uma vez). É o único teto financeiro do evento: pagamentos não podem ultrapassá-lo e acompanhamento ocioso de evento não recebe pagamento.
_Avoid_: preço contratado, estimativa da escolha

**Procedimento selecionado**:
Procedimento ou item de combo que o profissional vincula ao acompanhamento de um paciente após definir o que será realizado.
_Avoid_: pedido, compra

**Preço contratado**:
Valor total acordado para um acompanhamento no momento em que é iniciado, preservado mesmo que os preços do procedimento, combo ou plano mudem depois.
_Avoid_: valor atual, preço da sessão

**Valor recebido**:
Quantia informada pelo profissional como recebida para um acompanhamento. Pode ser registrada em pagamentos separados e compõe o saldo do acompanhamento.
_Avoid_: preço contratado, cobrança

**Forma de pagamento**:
Modalidade usada para quitar um acompanhamento, incluindo cartão de crédito à vista ou cartão de crédito parcelado no MVP.
_Avoid_: método financeiro

**Pagamento parcelado**:
Pagamento de um acompanhamento no cartão de crédito com quantidade de parcelas definida no momento da cobrança e confirmada pelo gateway.
_Avoid_: sessão parcelada, plano parcelado

**Condições de contratação**:
Conjunto comercial registrado para um paciente, incluindo preço total contratado, valor pago, forma de pagamento, quantidade de parcelas, procedimentos contratados, quantidades de sessões e documentos relacionados. As condições da contratação são independentes da execução posterior dos procedimentos.
_Avoid_: tratamento, condições da sessão

**Registro de pagamento**:
Lançamento manual feito pelo profissional para registrar um valor recebido pela clínica, vinculado a um acompanhamento e com forma de pagamento e situação informadas. No MVP, pagamentos são registrados, não processados pelo sistema, e a soma dos pagamentos de um acompanhamento não pode ultrapassar seu preço contratado. Cada intenção de registro deve ser identificável para que uma repetição da mesma requisição não crie um segundo lançamento.
_Avoid_: cobrança, gateway

**Idempotência de operação financeira**:
Garantia de que repetir uma requisição do mesmo registro de pagamento, identificada por uma chave de idempotência, devolve o resultado já criado sem duplicar o efeito financeiro. Uma nova intenção usa uma nova chave e passa novamente pelas regras de limite e consistência.
_Avoid_: retry que duplica pagamento

**Lançamento financeiro imutável**:
Registro de pagamento cujo conteúdo confirmado não é editado. O lançamento pode ser apagado pela operação permitida do sistema, seguindo a política de soft delete e preservando o registro original e o motivo da exclusão para auditoria; lançamentos apagados deixam de compor o saldo operacional. Estorno ou ajuste explícito continua sendo a alternativa quando for necessário corrigir o efeito financeiro sem remover o lançamento da operação.

**Forma de pagamento**:
Modalidade registrada para um pagamento, incluindo cartão de crédito à vista ou parcelado. O registro não implica processamento ou confirmação por integração externa.
_Avoid_: método financeiro

**Pagamento parcelado**:
Pagamento em cartão de crédito cuja quantidade de parcelas é informada pelo profissional ao registrar o valor recebido. O sistema não processa o cartão nem acompanha parcelas junto à operadora no MVP.
_Avoid_: sessão parcelada, plano parcelado

**Saldo do acompanhamento**:
Diferença entre o preço contratado e a soma dos pagamentos registrados. Permite acompanhar valores pendentes sem processar cobranças ou parcelas automaticamente.
_Avoid_: saldo do tratamento, saldo de sessões, saldo do atendimento

**Gateway de pagamento**:
Integração futura com serviço externo para processar cobranças e receber confirmações. Fica fora do MVP.
_Avoid_: registro manual de pagamento

**Contrato exigido**:
Contrato de um plano ou de um evento, incluindo o contrato padrão e os documentos específicos aplicáveis aos procedimentos incluídos. No MVP, somente planos e eventos possuem contratos, e um plano ou evento sem ao menos um contrato aplicável é inválido. O contrato padrão, o contrato específico de um procedimento incluído e o contrato específico de um combo incluído contam como aplicáveis; ao escolher um procedimento ou combo, a tela já marca o contrato dele no plano, e o profissional pode desmarcá-lo, desde que reste ao menos um contrato aplicável. A contratação pode existir enquanto a assinatura estiver pendente, mas o agendamento e a execução ficam bloqueados até que os contratos obrigatórios estejam assinados.
_Avoid_: contratação

**Anamnese pendente**:
Anamnese exigida pelos procedimentos do acompanhamento e ainda não respondida. Bloqueia o novo agendamento até o paciente responder pelo link ou o profissional preencher na clínica. É dispensada se o paciente respondeu o mesmo formulário dentro da validade da anamnese, salvo quando a oferta exige nova anamnese.
_Avoid_: solicitação de anamnese

**Validade da anamnese**:
Prazo em meses (padrão 12) definido no formulário de anamnese durante o qual uma resposta pode ser reaproveitada.

**Execução do procedimento**:
Realização prática de um procedimento por meio de sessões, combinada entre o profissional e o paciente depois de iniciado o acompanhamento. A execução não altera as condições comerciais já registradas.
_Avoid_: venda

## Documentos e coleta

**Fingerprint técnico da operação**:
Impressão técnica observável do ambiente de navegador/dispositivo no momento de uma operação relacionada a contrato ou assinatura, persistida como evidência vinculada ao participante, contrato, versão, tentativa e tipo de evento. É um indício complementar sujeito a variação, indisponibilidade e falsificação; não é biometria, autenticação nem prova exclusiva de identidade, e não significa uma identificação completa ou imutável do dispositivo.
_Avoid_: biometria, hash do contrato, identidade do dispositivo, fingerprint completo

**Formulário de anamnese**:
Modelo de formulário clínico configurável que o profissional vincula na edição de cada oferta (procedimento, combo, plano ou evento) e que o paciente pode responder por um link. Na inscrição, o acompanhamento exige a união das anamneses da oferta com as dos procedimentos que a compõem. Na interface, o catálogo desses modelos é chamado de “Formulários de anamnese”.
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
Documento comercial geral apresentado ao paciente para leitura antes da realização dos procedimentos. Sua fonte editável pode ser importada ou editada pelo profissional no painel administrativo; a versão apresentada e assinada é sempre um PDF imutável.
_Avoid_: contrato genérico

**Contrato específico de procedimento**:
Documento adicional associado a um procedimento ou combo específico, apresentado além do contrato padrão quando necessário. Sua fonte editável pode ser importada ou editada pelo profissional no painel administrativo; a versão apresentada e assinada é sempre um PDF imutável.
_Avoid_: contrato da guia

**Versão de contrato**:
Snapshot imutável de um contrato modelo em um momento específico, preservando a fonte DOCX autoritativa. A fonte pode conter placeholders pertencentes ao catálogo fechado de dados permitidos. A publicação não gera um PDF aplicável por paciente quando a versão depende de dados de aplicação; nesse caso, o PDF só nasce ao aplicar a versão a um paciente, depois da materialização do DOCX com o contexto concreto. Uma versão sem dados dependentes da aplicação pode possuir um PDF canônico auxiliar, mas ele não substitui a fonte nem é o documento assinado do paciente. Versões podem ser consultadas, e restaurar uma versão anterior cria uma nova versão com o próximo número; nenhuma versão existente é sobrescrita. Editar ou importar a fonte gera um novo draft, e publicar esse draft gera a próxima versão; mudar só nome, aplicação ou procedimento/combo não cria versão. A versão publicada corrente é a única versão elegível para novas aplicações e é resolvida atomicamente no início da aplicação; depois disso, a versão escolhida fica congelada no acompanhamento e no contrato aplicado.
_Avoid_: revisão, cópia (quando se referir à sequência oficial do contrato)

**Placeholder de contrato**:
Marcador inserido na fonte DOCX de uma versão de contrato, usando a sintaxe e os recursos controlados do Docxtemplater. O placeholder declara um dado de apresentação do catálogo fechado, como `{patient.name}` ou `{application.date}`. O contexto também fornece `plan.procedures` como um array simples de strings, contendo os nomes dos procedimentos da versão do plano, permitindo que o template use loops e condicionais suportados pelo Docxtemplater; o fato de um procedimento pertencer ao plano já significa que ele está contratado, sem objeto ou campo redundante `checked`. Para representar opções de procedimentos no MVP, o template usa símbolos Unicode textuais como `☐` e `☒`, não controles nativos de formulário do Word. Esses recursos não executam lógica de negócio nem permitem propriedades arbitrárias, expressões inseguras, acesso ao banco ou código; o backend valida o template contra o registry e a configuração publicada.
_Avoid_: variável livre, expressão insegura, código no contrato

**Contexto de materialização**:
DTO construído exclusivamente para transformar uma versão de contrato em documento aplicado. Contém somente valores permitidos e já formatados para apresentação, nunca entidades ORM nem dados internos arbitrários. O contexto inclui `plan.procedures` como uma coleção simples de nomes dos procedimentos da versão do plano aplicada, permitindo que o Docxtemplater resolva loops e condicionais definidos no DOCX. Cada item pertence ao plano e, por isso, já representa um procedimento contratado; não há campo `checked` nem seleção adicional. Quando o template precisar representar a lista, pode usar o símbolo Unicode textual `☒` junto de cada nome; radio buttons não representam o caso padrão. A data de aplicação do contrato é opcional, única para aquela aplicação e pode ser exposta por um campo controlado do contexto. O contexto é validado antes da renderização contra os contextos e placeholders publicados; a presença de um campo no DOCX não transforma sozinha um dado opcional em requisito.
_Avoid_: entidade do paciente, contexto ORM, dados crus, procedimento escolhido arbitrariamente, seleção exclusiva por radio button

**Snapshot de materialização**:
Cópia imutável do contexto de materialização efetivamente usado para gerar o DOCX e o PDF de um contrato aplicado. O snapshot é persistido como uma unidade cifrada, pois pode conter CPF, data de nascimento e registro profissional, e só é revelado em operações autorizadas. Se a primeira tentativa falhar por contexto obrigatório ausente, o sistema pode reconstruir e substituir o snapshot antes de existir um snapshot válido usado na geração; depois que a geração começa com um snapshot válido, retries técnicos reutilizam exatamente esse snapshot. Após R0, nenhuma reconstrução ou substituição é permitida. Alterações posteriores no paciente, procedimento, profissional ou clínica não modificam esse snapshot nem o documento já criado.
_Avoid_: dados atuais, contexto dinâmico, JSON sensível em texto aberto

**Materialização de contrato**:
Transformação de uma versão de contrato publicada em um documento específico para um paciente e seu contexto de aplicação, substituindo os placeholders permitidos por dados formatados para apresentação. Toda aplicação percorre esse pipeline, mesmo quando o DOCX não usa placeholders: o sistema produz um DOCX materializado e o converte em um PDF próprio para criar R0. A materialização preserva um snapshot imutável do contexto utilizado; falhas de dados obrigatórios ou placeholders inválidos impedem a criação do documento aplicado. Em um plano com vários contratos, cada contrato aplicado é gerado isoladamente: falha em um não remove nem regenera os R0 já prontos dos demais, e a assinatura só começa quando todos estiverem prontos.
_Avoid_: preenchimento dinâmico, contrato atual

**Contrato aplicado**:
Vínculo de uma versão específica de contrato a um plano de um paciente. No MVP, somente planos criam contratos aplicados; procedimentos avulsos e combos não entram nesse fluxo. O acompanhamento coleta os contextos necessários uma única vez em nível de acompanhamento — incluindo paciente, profissional responsável, clínica, data de aplicação e procedimentos do plano — e cada contrato aplicado recebe e congela apenas o subconjunto de contextos e placeholders permitido pela sua respectiva versão de contrato publicada. Todas as versões correntes dos contratos modelo são resolvidas e congeladas em uma única transação com locking determinístico antes de os contratos aplicados serem criados. O `professionalId` escolhido, o nome da conta e o registro profissional são congelados no snapshot de cada contrato. É a entidade de negócio à qual pertencem participantes, processo de assinatura, tentativas, evidências e o documento técnico correspondente. A existência do vínculo não significa que o contrato esteja assinado; a assinatura é um estado posterior e necessário para liberar o agendamento e a execução.
_Avoid_: contrato atual (quando o foco for o documento vinculado ao paciente), documento (quando significar o vínculo de negócio)

**Documento PDF do contrato aplicado**:
Artefato técnico associado a um contrato aplicado, responsável por armazenar o PDF original, sua revisão HEAD e as revisões incrementais imutáveis produzidas pelas operações de assinatura. Não é um contrato modelo, uma versão de conteúdo ou o contrato aplicado; é a representação documental versionada usada para visualizar, assinar, baixar e verificar os bytes do PDF.
_Avoid_: contrato, contrato aplicado, arquivo atual

**Plano assinado**:
Plano cujos contratos aplicados obrigatórios foram todos confirmados pelo paciente, que é o único participante obrigatório para liberar a operação no escopo atual. A assinatura do representante da clínica pode permanecer pendente sem bloquear o agendamento ou a execução. O plano assinado é o marco que libera esses fluxos; alterações posteriores no catálogo não o modificam.
_Avoid_: plano apenas criado, contrato aplicado não assinado

**Participante da assinatura**:
Pessoa autorizada a confirmar um contrato aplicado em uma relação B2C entre paciente e clínica. O participante tem nome e telefone registrados no processo de assinatura; o paciente é participante obrigatório para liberar o plano e confirma por link individual com código telefônico, enquanto o representante da clínica é participante esperado, confirma no painel pela sessão autenticada e sua assinatura pode permanecer pendente no escopo atual. O MVP não modela empresa representada pelo participante.
_Avoid_: assinante obrigatório (quando se referir ao representante da clínica), empresa representada

**Código de confirmação do convite**:
Os quatro últimos dígitos do telefone do participante, usados como confirmação rápida para liberar a assinatura pelo link enviado pelo profissional. O código é previsível e não representa autenticação forte; o MVP o registra como uma barreira operacional simples, complementar ao convite, à sessão ou ao fingerprint técnico.
_Avoid_: senha, código secreto, autenticação multifator

**Pendência de assinatura**:
Assinatura esperada de um participante que ainda não confirmou o contrato aplicado. A pendência do representante da clínica é administrativa e deve poder ser consultada separadamente, sem impedir a execução de um plano já assinado pelo paciente.
_Avoid_: contrato não aplicado

**Processo de assinatura**:
Fluxo de leitura e confirmação de um contrato aplicado específico. Cada contrato aplicado possui seu próprio processo, participantes, estado, tentativas e evidências. Um plano só é considerado assinado quando o paciente conclui todos os processos obrigatórios dos contratos aplicados; processos de contratos diferentes não compartilham estado.
_Avoid_: envelope único do plano

**Contrato ativo**:
Contrato corrente disponível para novas aplicações. Alterações ou restaurações geram uma nova versão sem modificar contratos aplicados anteriormente.
_Avoid_: contrato publicado (quando não houver um fluxo separado de publicação)

**Link do paciente**:
Acesso enviado ao paciente para responder anamneses e ler documentos sem precisar acessar o sistema administrativo. Para contratos, o link é individual, temporário e vinculado ao participante; a confirmação exige o código de confirmação do convite baseado nos quatro últimos dígitos do telefone cadastrado. O link de anamnese é seguro e pode ser usado para continuar o preenchimento, mas só pode concluir e enviar a solicitação uma vez.
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

**Administrador da clínica**:
Identidade única do responsável por uma clínica cliente no MVP. Cada administrador da clínica pertence a uma única clínica e cada clínica possui uma única conta administrativa. A conta representa o dono e operador da clínica, não um funcionário ou perfil de acesso separado. Ela é criada pelo administrador da plataforma durante o provisionamento do tenant; não há cadastro público. O nome do administrador pertence à conta, enquanto o nome da clínica pertence ao tenant; esses dados não são o mesmo conceito nem precisam ser duplicados. O administrador pode habilitar um vínculo de profissional para sua conta e configurar o registro profissional pelo dashboard; isso não significa que todo administrador seja profissional automaticamente.
_Avoid_: usuário compartilhado, conta da clínica (quando significar a identidade da pessoa)

**Administrador da plataforma**:
Dono e operador do SaaS, responsável por provisionar novos tenants e suas contas de administrador da clínica. No MVP, não possui conta autenticada nem painel próprio no produto; realiza o provisionamento e as operações excepcionais por seed, configuração segura ou operação administrativa direta no banco. Não é um administrador de clínica, não pertence a nenhum tenant e não recebe acesso operacional automático aos dados clínicos dos tenants.
_Avoid_: administrador, administrador da clínica (quando o contexto for a operação do SaaS)

**Provisionamento de tenant**:
Operação administrativa pela qual o administrador da plataforma cria uma clínica cliente, seu tenant exclusivo e a conta inicial do administrador da clínica, definindo pelo menos os dados da clínica, nome do responsável, e-mail e senha inicial. No MVP, ocorre por comando/script administrativo baseado no Better Auth, seed, configuração segura ou operação administrativa direta, não por cadastro público nem por painel autenticado da plataforma, e não fica disponível ao administrador da clínica.

**Redefinição administrativa de senha**:
Operação excepcional para substituir a senha do administrador de uma clínica quando ele perde o acesso. A senha anterior nunca é exibida, a nova senha é definida por um comando/script administrativo seguro baseado no Better Auth e não há envio automático de e-mail no MVP. A operação invalida todas as sessões administrativas da conta afetada, mas não afeta dados clínicos nem sessões de procedimentos. A operação não concede acesso aos dados clínicos do tenant.

**Operação administrativa de conta**:
Comando/script fora do painel usado pelo administrador da plataforma para provisionar tenant e conta, redefinir a senha do administrador da clínica ou alterar o e-mail da conta. Deve usar as operações oficiais do Better Auth, respeitar unicidade global do e-mail, armazenar somente o hash da senha e preservar o vínculo entre conta e tenant. Não representa uma tela ou login adicional do produto.

**Tenant ativo**:
Clínica que pode ser acessada pelo seu administrador e operar os fluxos correntes do sistema. Todo tenant é criado ativo no provisionamento.

**Tenant desativado**:
Clínica temporariamente bloqueada pelo administrador da plataforma. O administrador da clínica não consegue acessar ou iniciar operações no painel enquanto o tenant estiver desativado, mas todos os dados e históricos são preservados. A desativação invalida somente as sessões administrativas de autenticação e bloqueia os links públicos do paciente; não cancela, remove nem invalida agendamentos, atendimentos, execuções de procedimentos ou demais históricos clínicos e operacionais. O tenant pode ser reativado posteriormente; desativar não apaga a clínica nem seus dados. Ao reativar, links de paciente que ainda estiverem dentro da validade podem voltar a funcionar. No MVP, tenants e contas não são excluídos; o ciclo de vida disponível é somente desativar e reativar.

**Sessão administrativa**:
Sessão autenticada do administrador mantida no banco de dados pelo Better Auth, e não apenas em um token stateless. Cada sessão dura 24 horas; ao expirar, o administrador precisa autenticar-se novamente. O sistema permite sessões em mais de um dispositivo, e logout encerra somente a sessão atual. Troca de senha, redefinição administrativa de senha e desativação do tenant invalidam todas as sessões administrativas aplicáveis imediatamente. A sessão não concede acesso a outro tenant e seu estado deve ser verificado nas requisições protegidas.
_Avoid_: sessão de procedimento (quando se referir à autenticação)

**Autenticação**:
Processo pelo qual o administrador da clínica acessa sua conta usando e-mail e senha. O MVP oferece sessões autenticadas persistidas, logout e alteração da própria senha enquanto o administrador está autenticado. No primeiro login, o administrador da clínica recebe uma sugestão para alterar a senha inicial, mas pode recusá-la e acessar o painel normalmente; essa escolha fica registrada. Não oferece recuperação de senha, verificação de e-mail, segundo fator, cadastro público de clientes ou múltiplos perfis. Se o administrador da clínica perder a senha, solicita uma redefinição administrativa. O paciente continua acessando apenas links seguros e temporários enviados pelo administrador. Não existe autenticação ou painel do administrador da plataforma no MVP; o SaaS provisiona e corrige contas por operações administrativas fora do produto.
_Avoid_: acesso público (os links do paciente continuam protegidos)

**Senha inicial**:
Senha definida pelo administrador da plataforma ao provisionar um tenant e entregue ao administrador da clínica por canal externo ao sistema. Pode continuar válida caso o administrador recuse a sugestão de troca no primeiro login; o sistema registra a escolha, sem tratar a troca como obrigatória.

**E-mail de autenticação**:
E-mail usado para identificar a conta do administrador da clínica no Better Auth. É único globalmente entre as contas autenticadas; o mesmo e-mail não pode estar vinculado a duas contas simultaneamente. O administrador da clínica pode alterar o próprio e-mail enquanto estiver autenticado, sujeito à unicidade global. Como não há verificação de e-mail no MVP, o novo endereço passa a valer imediatamente. O administrador da plataforma também pode alterar esse e-mail por operação administrativa de conta, fora do produto.

**Histórico do paciente**:
Linha do tempo das contratações, anamneses e respostas, contratos, agendamentos, sessões, fotos, pagamentos e observações registrados para aquele paciente. O profissional pode consultar o histórico e conferir itens pendentes por paciente.
_Avoid_: prontuário (termo amplo demais para o escopo inicial)

**Pendência do paciente**:
Item que exige atenção ou conclusão no acompanhamento do paciente, como anamnese não respondida, contrato ainda não disponibilizado, pagamento pendente ou sessão contratada ainda não realizada. O profissional pode consultar pendências no contexto do paciente.
_Avoid_: notificação (não implica aviso automático ao profissional)

## Dados e ciclo de protótipo

**Dados de protótipo**:
Registros usados apenas para testes e demonstrações, sem obrigação de preservação. Os dados atuais do MongoDB pertencem a esta categoria e podem ser descartados; o PostgreSQL começará com uma base nova e seed reproduzível quando a migração for autorizada.
_Avoid_: dado de produção, dado a migrar

## Objetivo do produto

**Produto clínico-financeiro confiável**:
Sistema cujo primeiro critério de sucesso é preservar corretamente o histórico clínico, comercial, financeiro e de agenda, mesmo diante de falhas e operações simultâneas. O aprendizado de uma tecnologia de persistência não justifica aceitar inconsistências nesses registros.
_Avoid_: laboratório de aprendizado como objetivo principal

## Princípios do MVP

**Ação profissional**:
O profissional é o ponto de partida das ações do MVP: cadastra o paciente, seleciona procedimentos, associa anamneses e contratos, registra agendamentos e documenta as sessões. O sistema não presume automações clínicas ou operacionais.
_Avoid_: fluxo automático

**Notificação**:
Aviso ao profissional sobre respostas de anamneses ou assinaturas concluídas. Fica fora do escopo do MVP, embora o sistema possa armazenar as respostas e documentos recebidos.
_Avoid_: alerta (como termo do domínio)

**Assinatura digital**:
Ato pelo qual um participante esperado confirma um contrato aplicado, usando assinatura desenhada na plataforma ou assinatura externa pelo GOV.BR, conforme o fluxo autorizado. O processo de assinatura só fica concluído quando todos os participantes esperados confirmam; o paciente é obrigatório para liberar o plano, enquanto a assinatura do representante da clínica pode permanecer pendente.
_Avoid_: aceite eletrônico genérico, assinatura simples

**Documento assinado**:
Revisão preservada do documento aplicado depois de uma confirmação de assinatura aceita. Cada confirmação aceita gera uma sucessora da revisão que o participante visualizou, sem apagar as anteriores; uma confirmação baseada em versão desatualizada é uma tentativa registrada, mas não altera o documento. No MVP, a posição da assinatura permanece livre, inclusive após assinatura GOV.BR, mas o participante é orientado a não cobrir assinaturas anteriores e o backend bloqueia alterações incrementais incompatíveis que possam invalidá-las. O documento final só existe quando todos os participantes obrigatórios concluíram.
_Avoid_: contrato aplicado não assinado

**Motor de mutação incremental de PDF**:
Componente que acrescenta alterações ao final dos bytes da revisão atual para produzir a próxima revisão, sem reserializar, reconstruir, otimizar ou corrigir retroativamente o PDF anterior. Ele pode inserir aparências manuscritas, mas preserva estruturas externas que não criou, incluindo PAdES, campos de assinatura, CMS, certificados e carimbos; não implementa nem emite assinaturas digitais próprias.
_Avoid_: editor de PDF, compositor completo, assinador PAdES

**Assinatura digital externa preservada**:
Assinatura criptográfica criada fora da aplicação e incorporada a uma revisão importada, como uma assinatura feita pelo GOV.BR. A aplicação aceita essa assinatura no MVP quando valida a assinatura nova e a continuidade da revisão, conserva os bytes e a cadeia de revisões e pode acrescentar alterações somente por operações incrementais admissíveis; isso não significa que a aplicação a criou, substituiu ou oferece a mesma implementação criptográfica do assinador externo.

**Tentativa de assinatura**:
Operação iniciada por um participante para confirmar uma revisão específica de um contrato aplicado. A tentativa conserva o resultado, a evidência e o fingerprint técnico mesmo quando não gera uma revisão aceita, como em conflito de revisão, rejeição, expiração ou falha de validação externa.
_Avoid_: assinatura confirmada, revisão assinada

**JSON Schema Form**:
Abordagem futura de construção e renderização visual dos formulários baseada em JSON Schema. Ferramentas como builders visuais podem ser integradas para permitir que o profissional monte o formulário vendo uma prévia ao lado.
_Avoid_: formulário customizado por tela

**DocxTemplate**:
Documento DOCX carregado como modelo de contrato e processado futuramente com Docxtemplater para substituir campos variáveis e gerar documentos aplicados. O upload de DOCX e a integração com Docxtemplater fazem parte da direção do produto, mas o fluxo exato de geração ainda será definido.
_Avoid_: PDF modelo, contrato HTML

**Armazenamento de arquivos**:
Fotos e documentos são armazenados no Cloudflare R2 por meio da API compatível com S3; metadados e referências aos pacientes, sessões e contratos ficam no PostgreSQL. Os objetos usam chaves aleatórias e opacas, permanecem privados e são entregues somente por autorização do backend e URLs temporárias. Nesta fase, a aplicação não cifra adicionalmente os binários antes do upload; protege acesso, metadados e hashes no código e no banco.
_Avoid_: armazenamento no banco (para o conteúdo binário)

**Agregado**:
Conjunto de dados com identidade e ciclo de vida próprios, armazenado em uma coleção MongoDB; relacionamentos com outros agregados usam referências e são validados pela aplicação.
_Avoid_: coleção (quando significar o conceito de domínio)

**Snapshot aplicado**:
Cópia imutável e autocontida das condições de formulário, preço, composição ou documento no momento em que uma oferta é aplicada ao paciente. Respostas, rascunhos e notas clínicas ficam protegidos separadamente; o `schema_snapshot` preserva apenas a estrutura necessária para interpretar o conteúdo histórico.
_Avoid_: referência dinâmica à configuração atual
