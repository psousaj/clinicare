# Assinatura eletrônica própria — MVP

Data: 1º de outubro de 2026.

Revisão: fingerprint obrigatório e assinatura opcional pelo GOV.BR incluídos nos dois escopos.

## 1. Objetivo

Permitir que clientes e representantes da empresa visualizem contratos, desenhem suas assinaturas no celular ou computador, escolham onde aplicá-las e confirmem a operação. Ao final, o sistema disponibiliza um PDF com as assinaturas e conserva um histórico básico.

O produto será operado na infraestrutura própria da aplicação, inicialmente para poucos usuários. O foco desta etapa é o mecanismo funcional e uma organização dos dados que permita acrescentar evidências mais fortes depois.

O MVP não tem como entrega uma certificação ou uma avaliação completa de conformidade jurídica. Isso também não significa declarar que seus contratos não têm efeitos jurídicos. A análise desses efeitos depende do contexto e das evidências disponíveis.

## 2. Fluxo oficial, também mantido na produção

Quando desejar assinar, o participante escolhe assinatura local ou assinatura externa pelo GOV.BR. O fluxo local está abaixo; o externo segue a seção 4.1. Não há ordem obrigatória entre paciente e representante da clínica.

1. O participante acessa o contrato autorizado para ele.
2. Visualiza o documento completo.
3. Desenha a assinatura com dedo, caneta digital ou mouse.
4. Seleciona a página e o lugar onde deseja assinar.
5. Ajusta posição e tamanho e visualiza a prévia.
6. Confirma expressamente a assinatura.
7. O sistema registra a operação e disponibiliza o documento resultante.

Os mesmos caminhos local e GOV.BR serão usados na versão completa. Os reforços futuros ocorrerão na identificação, na autorização da confirmação e na preservação e verificação das evidências. A assinatura desenhada continua fazendo parte do produto.

## 3. Participantes e acesso

Usar a autenticação já existente. Cada pessoa assina com seu próprio usuário; uma conta compartilhada não distingue os participantes.

Para cada contrato, registrar os participantes esperados, nome, contato e papel, por exemplo: contratante e representante da prestadora. Registrar a empresa representada quando aplicável.

Validar no backend que o usuário pode acessar e assinar aquele contrato. Não aceitar um identificador de usuário enviado pelo navegador como prova de identidade.

Convites podem direcionar o participante ao contrato, mas o conhecimento da URL não deve permitir assinar como outra pessoa. Se utilizados, devem expirar e respeitar as permissões existentes.

Guardar uma cópia dos dados de identificação utilizados na confirmação, para que alterações futuras no perfil não modifiquem o histórico.

## 3.1. Fingerprint obrigatório desde o MVP

Coletar fingerprint do navegador/dispositivo nos dois escopos. Neste documento, fingerprint significa uma impressão técnica do ambiente de acesso; não é biometria de impressão digital e não se confunde com o hash do contrato.

Preservar três identificações distintas: hash SHA-256 dos arquivos; fingerprint do ambiente de cada operação; e, quando existir assinatura externa, fingerprint SHA-256 do certificado utilizado.

O registro de ambiente deve conter:

- Identificador do registro, usuário, contrato, revisão, tentativa e tipo do evento.
- User-Agent observado e Client Hints disponíveis, plataforma informada, idiomas, fuso horário, características de tela e suporte a toque disponíveis.
- IP observado pelo servidor e horário UTC de recebimento. Cabeçalhos de encaminhamento só são confiáveis quando adicionados por proxies configurados como confiáveis.
- Versão do coletor, lista dos atributos efetivamente coletados, representação normalizada e digest SHA-256 desses atributos no escopo da aplicação/organização.
- Indicação explícita de atributos bloqueados, ausentes, reduzidos ou inconsistentes.

Definir quais atributos entram no digest. Dados voláteis, como IP, tamanho atual da janela e horário, devem acompanhar o registro como contexto, sem fingir que produzem um identificador estável de dispositivo. Registrar a versão da normalização e preservar os dados utilizados.

Coletar na confirmação da assinatura local e, no fluxo externo, na exportação e na importação/aceitação do arquivo. A coleta e seu registro são obrigatórios; respeitar limitações do navegador e registrar indisponibilidade, sem inventar valores ou bloquear apenas porque a pessoa protege o navegador. Uma troca de aparelho pode mudar o fingerprint e não invalida automaticamente a operação.

Os dados do navegador são indícios sujeitos a alteração, redução e falsificação. Fingerprints podem coincidir entre pessoas e variar para a mesma pessoa. Não usá-los como autenticação, prova exclusiva de identidade ou substituto da validação criptográfica. A coleta feita na plataforma não comprova qual aparelho foi usado dentro do GOV.BR. [MDN — fingerprinting](https://developer.mozilla.org/en-US/docs/Glossary/Fingerprinting).

Informar a finalidade de rastreabilidade, limitar acesso e retenção e tratar o conjunto como dado pessoal quando associado ao participante. Aplicar hash não o torna automaticamente anônimo. Não exigir canvas, WebGL, varredura de fontes, rastreamento entre sites ou fornecedor pago para cumprir este requisito. [LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm).

## 4. Contrato aplicado, documento PDF e controle de revisões

O **contrato aplicado** é a entidade de negócio que vincula uma versão específica do contrato ao plano do paciente e reúne participantes, processo de assinatura, tentativas e evidências.

O **documento PDF do contrato aplicado** é o artefato técnico associado a esse vínculo. Ele guarda o PDF original, o identificador da revisão HEAD e cada revisão incremental imutável produzida pelas operações de assinatura. Endpoints técnicos podem chamá-lo de `document`, mas `documentId` identifica o PDF versionado do contrato aplicado, não o contrato modelo, a versão de conteúdo nem o acompanhamento inteiro.

Trabalhar inicialmente com PDF. Se o contrato for redigido no Word, convertê-lo antes de iniciar a coleta.

Guardar o PDF original e atribuir identificador e versão. Não sobrescrever esse arquivo quando as assinaturas forem acrescentadas.

Calcular SHA-256 do PDF original e de cada revisão confirmada. O hash permite comparar arquivos e detectar diferenças em relação ao valor preservado; isoladamente, não impede o administrador de substituir arquivo e hash.

A aplicação é um sistema de versionamento e transformação incremental de PDFs, não um sistema próprio de assinatura digital. Ela não implementa PAdES, CMS/CAdES, certificados, chaves privadas ou assinatura criptográfica do backend. Se uma revisão importada contiver assinatura digital externa, PAdES, campos de assinatura, certificados, carimbos ou objetos CMS, esses elementos são estruturas que a aplicação não criou e deve preservar. Toda mutação interna deve usar incremental update e nunca reserializar, otimizar, linearizar, recomprimir, normalizar, reconstruir xref, remover objetos ou fazer flatten global por padrão. A validação exigida para aceitar um retorno externo continua sendo a definida na seção 4.1; ela não transforma a aplicação em emissora ou implementadora de PAdES. Se a operação exigir reescrever bytes anteriores ou não puder ser validada como compatível, bloquear a operação e preservar a revisão intacta.

Invariante arquitetural: a aplicação não precisa implementar PAdES; precisa ter disciplina suficiente para não destruir um PAdES que apareceu no meio da cadeia.

A aplicação aceita assinatura externa pelo GOV.BR no MVP. Isso não significa que ela crie ou implemente PAdES: significa receber o PDF assinado, validar a nova assinatura e a continuidade da revisão conforme a seção 4.1, preservar os bytes recebidos e promover essa revisão como confirmada quando o resultado for “validada”. Um arquivo externo inválido, indeterminado ou em formato/fluxo não suportado pode ser preservado como recebimento e histórico, mas não conclui a etapa nem libera o participante.

Cada assinatura gera uma nova revisão:

- A primeira revisão assinada contém a assinatura do participante cuja operação foi aceita primeiro.
- A seguinte acrescenta outra assinatura ou preserva o arquivo externo importado, sem reescrever a revisão anterior.
- O PDF final corresponde à revisão produzida depois da confirmação de todos os participantes obrigatórios.

Não há ordem obrigatória entre paciente e representante da clínica. Ambos podem abrir a mesma revisão, preparar suas assinaturas e confirmar em qualquer ordem. A aplicação usa controle otimista por revisão: a confirmação informa a revisão-base visualizada, e somente uma operação pode promovê-la atomicamente à próxima revisão. Uma confirmação concorrente baseada na revisão anterior perde a disputa, recebe conflito de revisão e permanece registrada como tentativa, sem alterar o documento; o participante deve visualizar a revisão atual e refazer a operação.

A promoção deve usar uma condição atômica equivalente a `UPDATE ... WHERE current_revision = base_revision`, e não manter lock enquanto a pessoa desenha ou usa o GOV.BR. O PDF candidato deve ser temporário até a promoção vencer; candidato perdedor não vira revisão oficial. A coordenação entre banco e armazenamento não pode registrar sucesso sem o arquivo preservado.

Mudar o texto do contrato exige nova versão e nova coleta. Adicionar uma assinatura posterior não deve modificar o texto nem permitir mover assinaturas anteriores.

## 4.1. Assinatura opcional pelo GOV.BR, incluída desde o MVP

### Possibilidade e alcance

Admitir dois métodos por participante: assinatura desenhada na plataforma e assinatura externa pelo portal GOV.BR. A opção externa faz parte do MVP e da produção, inclusive quando escolhida depois de outra assinatura ou enquanto outro participante prepara sua operação.

Para o contrato privado comum de prestação de serviço aqui tratado, o uso de outro meio de comprovação de autoria e integridade, aceito nas condições legais, encontra fundamento no art. 10, § 2º, da MP 2.200-2. A conclusão aplicada ao produto é permitir métodos distintos no mesmo processo, preservando as evidências de cada um e observando eventual exigência específica do negócio. Isso não depende de credenciar esta plataforma como certificadora. [MP 2.200-2](https://www.planalto.gov.br/ccivil_03/mpv/antigas_2001/2200-2.htm).

A assinatura GOV.BR pode ser reconhecida pelo VALIDAR do ITI quando o arquivo e a assinatura atendem às verificações do serviço. Desenhos aplicados pela plataforma não passam a ser assinaturas GOV.BR porque outra pessoa assinou o PDF por lá. O resultado deve identificar cada assinatura e sua revisão, sem um selo genérico de aprovação jurídica do contrato ou da aplicação. [VALIDAR — dúvidas](https://validar.iti.gov.br/duvidas.html).

### Fluxo externo

1. Na sua vez, o participante escolhe “Assinar pelo GOV.BR”. A alternativa local continua sendo desenhar, posicionar, visualizar e confirmar.
2. A plataforma reserva a revisão atual para a operação externa e registra participante, hash do arquivo exportado, tentativa, fingerprint e prazo da reserva.
3. O usuário baixa essa revisão e acessa o portal oficial, usando sua própria conta. O serviço é gratuito e requer conta habilitada, atualmente prata ou ouro.
4. A pessoa assina no portal e baixa o PDF assinado. Não deve imprimir para PDF, converter, rasterizar nem editar o arquivo retornado.
5. Ela importa esse PDF na mesma tentativa da plataforma. O fingerprint da importação é registrado separadamente.
6. A plataforma valida o retorno, apresenta o signatário identificado e o resultado e recebe a confirmação de conclusão da etapa. Essa confirmação registra a importação; a assinatura criptográfica foi feita no portal.
7. Somente depois da aceitação o PDF importado passa a ser a revisão atual. Outros participantes podem então visualizar essa revisão e confirmar quando desejarem.

Se a reserva expirar ou for cancelada, invalidar a tentativa e permitir que qualquer participante autorizado inicie uma nova operação sobre a revisão atual. Um retorno antigo não pode ser unido silenciosamente a uma versão que avançou. Preservar seu recebimento como histórico e pedir nova assinatura da revisão vigente.

O usuário opera o portal oficial. Não coletar senha GOV.BR, não automatizar o login e não presumir API, iframe, callback ou envio automático do documento. A orientação oficial restringe a integração direta dos produtos de identidade GOV.BR ao setor público; isso é diferente de receber um PDF assinado externamente pelo cidadão. [Serviço de assinatura](https://www.gov.br/pt-br/servicos/assinatura-eletronica) e [regras de integração](https://www.gov.br/governodigital/pt-br/identidade/identidade-digital-para-gestores-publicos/duvidas-frequentes-do-ecossistema-da-identidade-digital-gov-br).

### Validação obrigatória da importação

Receber um PDF não conclui uma assinatura. Implementar, também no MVP:

- Armazenamento provisório privado do arquivo recebido, com limites de tamanho e processamento seguro do PDF.
- Detecção das assinaturas criptográficas embutidas, verificação CMS/PDF e cobertura dos intervalos de bytes de cada revisão.
- Verificação da cadeia até uma âncora GOV.BR confiável, validade e informações de revogação aplicáveis. Não confiar em logotipo, nome do emissor isolado ou certificado anexado sem verificar a cadeia.
- Correspondência entre o titular da nova assinatura e o participante esperado, usando identificadores verificados disponíveis no certificado/relatório; nome textual isolado não resolve homônimos. Dados insuficientes exigem verificação adicional documentada, sem aceitação automática por aproximação.
- Identificação de uma nova assinatura do participante da vez, além das já existentes; reenviar o arquivo anterior não pode concluir a operação.
- Conferência de vínculo com a revisão exportada. Seu hash deve ser usado para localizar e comparar a revisão de origem dentro da cadeia incremental, não para exigir igualdade entre o PDF exportado e o PDF agora assinado, cujo hash muda.
- Análise das modificações adicionadas, aceitando apenas as necessárias à assinatura e previamente permitidas. Prefixo preservado ou texto aparentemente igual não basta: um incremento pode alterar conteúdo visível ou ocultar objetos.
- Revalidação de todas as assinaturas digitais anteriores e conferência das evidências/revisões locais. A aplicação não precisa implementar PAdES para preservar um PAdES externo: precisa armazenar os bytes recebidos, manter o vínculo da revisão e não destruir as estruturas que não criou. Qualquer mudança indevida em texto, páginas, anexos ou assinaturas anteriores impede o avanço automático.

Preservar certificado e seu fingerprint, titular, emissor, número de série, identificador da assinatura, hashes de entrada e saída, revisões cobertas, restrições do PDF, resultado, motivo, instante da verificação, versão do validador e referências de confiança usadas. Diferenciar horário declarado da assinatura, horário de importação e tempo comprovado por carimbo, quando existente.

Os resultados devem ser “validada”, “inválida”, “indeterminada” ou “formato/fluxo não suportado”. Falha de consulta de revogação ou ausência de evidência não pode virar sucesso. O caso indeterminado permanece pendente de resolução.

A validação pode usar bibliotecas na própria infraestrutura, com as cadeias adequadas. Consultas de confiança/revogação podem exigir rede; assinatura pelo portal também exige acesso externo. Não presumir uma API pública e gratuita do VALIDAR para automação. Verificação manual no serviço oficial pode complementar a análise, preservando relatório e hash, mas não substitui automaticamente as verificações de identidade, revisão e continuidade.

### Continuidade da coleta após uma assinatura GOV.BR

Após existir assinatura criptográfica no PDF, proibir reconstrução do arquivo, impressão para PDF e inserção convencional de imagens sobre as páginas. Essas operações podem destruir ou comprometer a validação das assinaturas anteriores.

Novas assinaturas devem usar atualizações incrementais compatíveis com as permissões do documento, inclusive DocMDP e FieldMDP quando presentes. Preservar os bytes anteriores é necessário para manter a cadeia, mas não basta: as alterações novas também precisam ser admissíveis. [ITI — orientações para PDFs](https://validar.iti.gov.br/guia-desenvolvedor.html) e [análise de alterações incrementais](https://docs.pyhanko.eu/en/latest/lib-guide/validation/diff-analysis.html).

Para a assinatura desenhada depois de uma GOV.BR, usar um mecanismo de preenchimento/aparência incremental efetivamente aceito pelos validadores e pelas permissões do arquivo. Desenhar uma imagem não é, por si, acrescentar uma assinatura criptográfica PDF, e não se pode pressupor que o GOV.BR autoriza esse preenchimento em qualquer documento.

No MVP, a escolha de posição permanece livre antes e depois da primeira assinatura criptográfica, com orientação explícita para não cobrir assinaturas anteriores. Não há exigência de regiões ou campos previamente reservados. O backend deve revalidar as assinaturas anteriores e aceitar apenas uma atualização incremental admissível; quando a alteração não for compatível, deve bloquear a operação e preservar a revisão assinada intacta. Regiões/campos reservados podem ser introduzidos futuramente para aumentar a compatibilidade, mas não fazem parte do modelo inicial.

Testar explicitamente a sequência local → GOV.BR → local e GOV.BR → GOV.BR nos modelos suportados. Gerar a revisão candidata e revalidar antes de confirmá-la e novamente no resultado final. Compatibilidade com o VALIDAR precisa ser observada nos arquivos reais de teste; não decorre apenas da escolha da biblioteca.

Se o arquivo ou a próxima operação não forem compatíveis, manter a revisão assinada intacta, mostrar o motivo e oferecer continuidade pelo método externo compatível ou nova versão com recolhimento das assinaturas. Não realizar fallback silencioso que invalide a assinatura GOV.BR. No MVP, não exigir nem criar previamente regiões ou campos reservados para assinaturas posteriores: o participante continua escolhendo livremente a posição e deve evitar cobrir assinaturas já visíveis. A aplicação deve preservar os bytes anteriores e tentar a nova assinatura do próprio sistema por atualização incremental; se o PDF, suas permissões ou o validador não aceitarem a alteração sem comprometer a assinatura GOV.BR, rejeitar explicitamente a operação, sem fallback destrutivo. A produção poderá adotar regiões ou campos reservados depois, como reforço de compatibilidade.

## 5. Área de desenho

Implementar uma área de desenho compatível com mouse, toque e caneta digital.

Recursos necessários:

- Desenhar com traço legível.
- Limpar e refazer antes da confirmação.
- Impedir envio de uma área vazia.
- Manter o desenho ao passar para a escolha da posição.
- Gerar uma imagem PNG com fundo transparente.

Não é necessário capturar pressão, velocidade, biometria ou analisar a semelhança com assinaturas anteriores. O MVP registra o desenho e a operação de confirmação.

Não criar uma biblioteca para aplicar automaticamente a assinatura em contratos futuros. Cada aplicação deve depender de uma nova confirmação do participante.

## 6. Posicionamento no PDF

O usuário deve escolher a página, posicionar o desenho e ajustar seu tamanho antes de confirmar. No MVP, a posição continua livre também depois de existir assinatura criptográfica: a interface deve orientar o participante a não cobrir assinaturas anteriores, sem prometer que qualquer PDF aceitará qualquer alteração. O backend deve preservar os bytes anteriores e validar a atualização incremental; se a alteração não for compatível com as permissões ou ameaçar a validade da assinatura GOV.BR, a operação deve ser bloqueada com explicação. Regiões ou campos previamente reservados ficam para uma evolução futura.

Registrar página, posição e dimensões em coordenadas do PDF, com convenção explícita para origem e unidades. Converter corretamente as coordenadas da tela considerando zoom, tamanho, recorte e rotação da página.

Validar no backend:

- Existência da página.
- Dimensões positivas e dentro dos limites permitidos.
- Posicionamento dentro da página.
- Correspondência entre o contrato autorizado e a revisão utilizada.
- Formato e tamanho permitidos da imagem.

O PDF baixado precisa apresentar o desenho no mesmo lugar e tamanho aprovados na prévia. Redimensionar a janela ou usar outro aparelho não pode deslocar a assinatura.

## 7. Prévia e confirmação

Preparar no backend o PDF candidato com a imagem aplicada. Se já existir assinatura GOV.BR ou outra assinatura criptográfica, usar somente a atualização incremental permitida e validada descrita na seção 4.1; não regravar o PDF com um compositor comum. Mostrar esse resultado antes da confirmação, para que o participante aprove o arquivo efetivamente produzido.

Usar uma ação explícita, por exemplo:

> Confirmo que desejo assinar este contrato com a assinatura apresentada.

Até essa ação, desenho e posicionamento são rascunhos. Desenhar, abrir o contrato ou mover a imagem não conclui a assinatura.

Na confirmação, o backend deve conferir usuário, permissão, estado do contrato e revisão esperada. Associar a confirmação ao arquivo candidato e ao texto do aceite.

Preservar os bytes aprovados: não gerar depois outra versão potencialmente diferente e tratá-la como se fosse a mesma prévia.

Depois de confirmada, a assinatura não pode ser alterada na revisão preservada. Correções devem gerar um novo processo ou versão, mantendo o histórico anterior.

## 8. Registro mínimo de cada assinatura

Guardar um registro próprio da operação, separado do cadastro de usuário e do arquivo PDF.

| Campo | Finalidade |
| --- | --- |
| Identificador da assinatura | Referência estável da operação |
| Contrato e versão | Conteúdo contratual ao qual a operação pertence |
| Revisão anterior e resultante | Relação entre o documento recebido e o produzido |
| Participante | Usuário autenticado e dados históricos de nome e contato |
| Papel | Em nome de quem a pessoa assinou |
| Imagem | Referência privada do PNG e seu hash no método local; não obrigatória no método GOV.BR |
| Posicionamento | Página, coordenadas, dimensões e transformações do desenho local; dados da aparência externa quando disponíveis |
| Arquivo aprovado | Referência e hash do PDF candidato confirmado |
| Confirmação | Texto apresentado e data/hora UTC registrada pelo servidor |
| Método | Local com desenho e confirmação, ou GOV.BR externo validado |
| Fingerprint | Registro obrigatório do ambiente, IP/contexto e versão do coletor |
| Retorno externo | Tentativa de exportação, PDF recebido, titular, certificado e seu fingerprint, validação e revisões cobertas |
| Versão do processo | Versão do fluxo que produziu o registro |
| Tentativa | Identificador para impedir duplicações |

Fingerprint do navegador/dispositivo, IP observado e contexto da operação são obrigatórios conforme a seção 3.1. São evidências complementares e não substituem a identificação do participante.

Não guardar senhas, cookies de sessão ou outros segredos nesses registros.

## 9. Estados e conclusão

Controlar o estado de cada participante: pendente, aguardando retorno externo, em validação, confirmado ou recusado. Manter separadamente o resultado da validação externa e a validade da reserva de revisão.

Controlar o estado do contrato: rascunho, aguardando assinaturas, concluído ou cancelado.

O contrato só fica concluído depois da confirmação de todos os participantes esperados, sem exigir ordem entre eles. O plano é liberado quando os participantes obrigatórios definidos pelo domínio, especialmente o paciente, tiverem confirmado. Uma assinatura visível não implica que o outro participante já assinou.

Impedir confirmações depois de cancelamento. Cancelar ou recusar deve preservar os arquivos e as operações que já ocorreram, sem apagar o histórico.

Uma repetição do clique ou uma falha de rede não pode duplicar a assinatura. Usar identificador de tentativa e processamento idempotente, com coordenação entre banco e armazenamento para não registrar sucesso sem arquivo persistido.

## 10. Histórico, armazenamento e download

Registrar pelo menos criação do contrato, disponibilização, confirmação de cada participante, conclusão, recusa e cancelamento quando existentes.

O registro deve conter ator, data/hora, contrato, revisão e resultado. A interface normal não deve permitir editar eventos antigos.

Guardar PDFs e desenhos em armazenamento privado, com controle de acesso, HTTPS e backups. Manter histórico básico não significa construir uma cadeia criptográfica de auditoria no MVP.

Permitir que os participantes baixem o PDF disponível, com indicação clara de pendência ou conclusão. Preservar cada revisão confirmada além da versão final, inclusive quando participantes confirmarem em ordem diferente ou quando uma tentativa perder um conflito de revisão.

Oferecer um histórico legível com nomes, papéis e horários registrados. Não apresentar esse histórico como certificado ICP-Brasil ou reconhecimento de firma.

## 11. Estrutura preparada para evolução

Separar no modelo:

- Contrato modelo e suas versões de conteúdo.
- Contratos aplicados e seus vínculos com o plano do paciente.
- Documentos PDF dos contratos aplicados, seus arquivos e revisões imutáveis.
- Motor de mutação incremental, com contrato de que a saída começa pelos bytes completos da entrada nas alterações internas.
- Participantes e dados históricos de identificação.
- Imagens e posicionamentos.
- Operações de assinatura e método utilizado.
- Evidências associadas a cada operação.
- Eventos do histórico.
- Fingerprints das operações.
- Tentativas de exportação/importação, assinaturas externas e resultados de validação.

Registrar o método e a versão do processo em cada assinatura. Permitir anexar novos tipos de evidência sem modificar os dados originais.

Essa estrutura deve permitir acrescentar futuramente verificação de identidade para o método local, autenticação adicional, manifestos de consentimento, provas criptográficas nativas, selo da plataforma, auditoria reforçada e verificação independente exportável. Fingerprint, importação GOV.BR, validação criptográfica das assinaturas externas e preservação de sua continuidade já são requisitos do MVP.

Evitar construir uma arquitetura de plugins ou serviços distribuídos apenas para uma possibilidade futura. Entidades e responsabilidades separadas, dentro da aplicação atual, são suficientes para começar.

## 12. O que fica fora deste MVP

- Integração com plataformas comerciais de assinatura.
- Credenciamento como autoridade certificadora.
- Emissão, compra ou uso nativo de certificados ICP-Brasil. A assinatura GOV.BR externa é incluída e não exige comprar um certificado ICP-Brasil.
- Identificação por biometria ou validação documental automatizada.
- Passkeys ou chaves pessoais específicas para assinar.
- Manifestos nativos com assinatura criptográfica individual. Isso não exclui a validação da assinatura GOV.BR importada.
- Selo criptográfico da plataforma.
- Encadeamento criptográfico completo de auditoria.
- Carimbo do tempo de terceiro.
- Pacote/verificador independente para o usuário operar sem o servidor. O backend já precisa verificar as assinaturas externas importadas.
- Avaliação jurídica completa do contrato e do procedimento.

Controles básicos de acesso, proteção de dados e preservação dos arquivos permanecem parte do funcionamento normal do produto.

## 13. Critérios para considerar o MVP pronto

- Coletar e vincular fingerprint à confirmação local, exportação e importação, registrando sinais indisponíveis e a versão do coletor.
- Permitir que o participante da vez escolha GOV.BR sem usar credenciais governamentais dentro da aplicação.
- Uma imagem com logotipo GOV.BR não é aceita como assinatura criptográfica.
- Uma assinatura de outra pessoa, um contrato diferente ou uma revisão antiga não conclui a tentativa atual.
- Um retorno sem assinatura nova, inválido ou indeterminado permanece rejeitado ou pendente, conforme o caso.
- Preservar o PDF externo original e revalidar as assinaturas anteriores ao continuar a coleta.
- Demonstrar local → GOV.BR → local e GOV.BR → GOV.BR nos modelos suportados, mantendo posição livre no MVP, orientando o participante a não cobrir assinaturas anteriores e bloqueando explicitamente alterações que não possam ser aplicadas por atualização incremental sem comprometer a assinatura GOV.BR.
- O resultado distingue assinatura local de assinatura GOV.BR validada e informa a revisão coberta por cada uma.

- O participante consegue desenhar usando celular e computador.
- Pode limpar o desenho, escolher a página, posicionar e redimensionar.
- O resultado no PDF corresponde à prévia confirmada.
- Apenas o participante autorizado consegue confirmar sua operação.
- Nada é considerado assinado antes da confirmação explícita.
- O PDF original permanece preservado.
- Cada confirmação mantém sua revisão, imagem, posição e registro.
- Assinaturas posteriores não removem ou deslocam as anteriores.
- Repetir a confirmação não duplica a assinatura.
- Uma versão desatualizada não é confirmada silenciosamente: a operação retorna conflito, preserva a tentativa e exige nova visualização da revisão atual.
- O estado final depende de todos os participantes obrigatórios.
- Os participantes conseguem baixar o resultado.
- A edição posterior do perfil não muda registros antigos.
- Há backup dos arquivos e dos dados necessários para recuperá-los.

## 14. Limite da evolução futura

O desenho aplicado ao PDF, associado ao acesso e à confirmação, registra o fluxo executado. Ele não oferece sozinho as mesmas propriedades de uma assinatura criptográfica ou de uma identificação independente.

Acrescentar mecanismos mais fortes depois melhora as novas operações. Não cria retroativamente provas de identidade, horário ou autorização que não foram coletadas nos contratos antigos. Se um contrato anterior precisar de um procedimento reforçado, poderá ser necessário submetê-lo a uma nova confirmação.

O objetivo da preparação técnica é permitir essa evolução sem refazer a gestão dos contratos. O fluxo local continua desenhar, posicionar e confirmar, e a opção GOV.BR por exportação, assinatura externa e importação já faz parte do MVP.

## Referências de contexto

- [MP 2.200-2, art. 10 — outros meios de comprovação de autoria e integridade](https://www.planalto.gov.br/ccivil_03/mpv/antigas_2001/2200-2.htm).
- [ITI — distinção entre assinatura digital e sua representação gráfica](https://www.gov.br/iti/pt-br/acesso-a-informacao/perguntas-frequentes/certificacao-digital).

- [Portal de assinatura GOV.BR](https://www.gov.br/pt-br/servicos/assinatura-eletronica).
- [Regras de integração GOV.BR](https://www.gov.br/governodigital/pt-br/identidade/identidade-digital-para-gestores-publicos/duvidas-frequentes-do-ecossistema-da-identidade-digital-gov-br).
- [VALIDAR — orientações técnicas](https://validar.iti.gov.br/guia-desenvolvedor.html).
- [VALIDAR — dúvidas](https://validar.iti.gov.br/duvidas.html).
- [pyHanko — análise de alterações incrementais](https://docs.pyhanko.eu/en/latest/lib-guide/validation/diff-analysis.html).
- [MDN — fingerprinting](https://developer.mozilla.org/en-US/docs/Glossary/Fingerprinting).
- [LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm).
