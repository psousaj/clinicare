# Assinatura eletrônica própria — especificação completa

Data: 1º de outubro de 2026.

Revisão: fingerprint obrigatório e assinatura opcional pelo GOV.BR incluídos nos dois escopos.

## 1. Objetivo e decisões de produto

Implementar um sistema próprio para assinatura de contratos de prestação de serviço entre empresas e clientes, operado na infraestrutura da aplicação, sem depender de uma plataforma comercial de assinatura e sem se tornar uma autoridade certificadora.

Quando desejar assinar, o participante escolhe assinatura local ou assinatura externa pelo GOV.BR. Ambos os métodos estão presentes no MVP e na produção. Não há ordem obrigatória entre paciente e representante da clínica. O fluxo local é:

1. Abrir e visualizar o contrato.
2. Desenhar a assinatura com dedo, caneta digital ou mouse.
3. Selecionar a página e posicionar a assinatura no documento.
4. Ajustar tamanho e posição e visualizar o resultado.
5. Confirmar expressamente a assinatura daquele contrato.
6. Receber o resultado e acessar o documento produzido.

O desenho é parte permanente da experiência e da aparência do PDF. A versão completa mantém esse fluxo e acrescenta mecanismos de identificação, autorização, integridade, preservação e verificação das evidências. Não substitui o desenho por outro fluxo de produto.

O mecanismo de comprovação deve acompanhar a confirmação. Se uma política exigir verificação adicional, como uma operação com passkey, ela acontece dentro dessa etapa. A adoção de passkeys é uma escolha técnica possível, não uma exigência legal geral nem uma condição para existir assinatura desenhada.

## 2. O que o sistema pretende demonstrar

O sistema precisa reunir evidências para responder:

- Quem realizou a operação e como essa pessoa foi identificada?
- Em nome de quem ela atuou?
- Qual conteúdo, desenho e posicionamento foram aprovados?
- Qual ação expressou a intenção de assinar?
- Que credencial autorizou essa ação?
- O documento ou as evidências foram alterados posteriormente?
- Como verificar o resultado se a aplicação deixar de funcionar?

A imagem da assinatura é uma representação gráfica. Sua presença no PDF, isoladamente, não comprova quem a inseriu. A força da evidência depende da associação entre identidade, operação, documento e registros preservados.

Para contratos privados, o art. 10, § 2º, da MP 2.200-2 admite outros meios de comprovação da autoria e integridade, nas condições previstas no dispositivo. Isso não atribui automaticamente ao sistema fé pública de cartório ou a presunção específica da certificação ICP-Brasil. Em caso de impugnação de autenticidade, o art. 429, II, do CPC atribui, em regra, o ônus de comprová-la à parte que produziu o documento.

Esta especificação descreve uma arquitetura de comprovação. Implementá-la não equivale, por si só, a obter uma certificação jurídica ou cumprir todas as exigências de qualquer espécie de contrato.

## 3. Identificação dos participantes

Separar a pessoa que assina da conta utilizada para acessar o sistema. A autenticação demonstra controle de uma credencial; a associação com uma pessoa real precisa de evidências próprias.

Registrar:

- Identificador permanente do participante.
- Nome e dados de identificação necessários ao contrato.
- Canais de contato confirmados.
- Método e resultado da verificação de identidade.
- Data, responsável e referências às evidências dessa verificação.
- Organização representada, quando houver.
- Papel no contrato e fundamento dos poderes de representação.

Para um grupo pequeno de pessoas conhecidas, a verificação inicial pode ser manual, com conferência presencial ou remota documentada. Não é obrigatório contratar um serviço de biometria para implementar esse processo.

Validação dos dígitos de CPF não comprova identidade. E-mail corporativo não comprova sozinho poder de representação. Documentos e informações adicionais devem ser coletados de maneira proporcional à necessidade.

Preservar uma fotografia histórica dos dados utilizados em cada assinatura. Mudanças futuras no cadastro não podem modificar a identidade apresentada em contratos anteriores.

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

## 4. Contrato aplicado, documento PDF e revisões

O **contrato aplicado** é a entidade de negócio que vincula uma versão específica do contrato ao plano do paciente e reúne participantes, processo de assinatura, tentativas e evidências.

O **documento PDF do contrato aplicado** é o artefato técnico associado a esse vínculo. Ele contém o PDF original, seu HEAD e as revisões incrementais imutáveis. Nos endpoints, `documentId` identifica esse PDF versionado, não o contrato modelo, sua versão de conteúdo ou o plano/acompanhamento inteiro.

Gerar ou receber um PDF definitivo antes de iniciar a coleta. Preservar os bytes originais e os anexos aplicáveis.

Cada contrato aplicado deve ter identificador, referência à versão de conteúdo, participantes esperados e regras de conclusão. Calcular SHA-256 dos arquivos preservados. Evitar conteúdo ativo e dependências externas que possam modificar a apresentação.

A aplicação é um sistema de versionamento e transformação incremental de PDFs, não um sistema próprio de assinatura digital. Ela não implementa PAdES, CMS/CAdES, certificados, chaves privadas ou assinatura criptográfica do backend. Se uma revisão importada contiver assinatura digital externa, PAdES, campos de assinatura, certificados, carimbos ou objetos CMS, esses elementos são estruturas que a aplicação não criou e deve preservar. Toda mutação interna deve usar incremental update e nunca reserializar, otimizar, linearizar, recomprimir, normalizar, reconstruir xref, remover objetos ou fazer flatten global por padrão. Se a operação exigir reescrever bytes anteriores ou não puder ser validada como compatível, bloquear a operação e preservar a revisão intacta.

Invariante arquitetural: a aplicação não precisa implementar PAdES; precisa ter disciplina suficiente para não destruir um PAdES que apareceu no meio da cadeia.

A aplicação aceita assinatura externa pelo GOV.BR no MVP. Isso não significa que ela crie ou implemente PAdES: significa receber o PDF assinado, validar a nova assinatura e a continuidade da revisão conforme a seção 4.1, preservar os bytes recebidos e promover essa revisão como confirmada quando o resultado for “validada”. Um arquivo externo inválido, indeterminado ou em formato/fluxo não suportado pode ser preservado como recebimento e histórico, mas não conclui a etapa nem libera o participante.

Para conciliar assinatura visual e integridade, adotar uma sequência explícita de revisões:

1. O PDF base contém o texto contratual definitivo.
2. Um participante desenha e posiciona sua assinatura sobre a revisão disponível.
3. O servidor prepara uma nova revisão candidata, incluindo a representação gráfica.
4. O participante visualiza essa revisão antes da confirmação.
5. A confirmação se vincula ao hash dos bytes exatos da revisão candidata e à revisão-base visualizada.
6. Depois de confirmada e promovida por controle otimista, ela se torna uma revisão preservada.
7. Outro participante repete o processo sobre a revisão atual, sem ordem obrigatória entre os participantes.

Não há ordem obrigatória entre paciente e representante da clínica. Ambos podem preparar suas assinaturas sobre a mesma revisão e confirmar em qualquer ordem. A consistência usa controle otimista por revisão: a confirmação informa a revisão-base visualizada e somente uma operação pode promovê-la atomicamente à próxima revisão. Uma operação concorrente baseada na revisão anterior perde a disputa, retorna conflito, preserva a tentativa e exige nova visualização e prévia sobre a revisão atual.

A promoção deve usar uma condição atômica equivalente a `UPDATE ... WHERE current_revision = base_revision`, sem lock longo durante desenho ou uso do GOV.BR. O candidato deve permanecer temporário até vencer a promoção; candidato perdedor não é revisão oficial. A coordenação entre banco e armazenamento deve impedir sucesso registrado sem arquivo preservado.

As revisões podem acrescentar as assinaturas autorizadas, sem mudar o texto, os anexos contratuais ou as assinaturas anteriores. Correção de conteúdo exige nova versão e novos aceites.

A prova do primeiro participante se refere à revisão que ele aprovou. A revisão final acrescentará outras assinaturas. Preservar essa relação e não afirmar que todos aprovaram os mesmos bytes finais se isso não ocorreu. O fluxo e o aceite devem explicar a inclusão posterior das demais assinaturas no conteúdo contratual preservado.

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

Se o arquivo ou a próxima operação não forem compatíveis, manter a revisão assinada intacta, mostrar o motivo e oferecer continuidade pelo método externo compatível ou nova versão com recolhimento das assinaturas. Não realizar fallback silencioso que invalide a assinatura GOV.BR. Para o MVP, não exigir nem criar previamente regiões ou campos reservados: a posição permanece livre e o participante deve evitar cobrir assinaturas anteriores. A aplicação deve preservar os bytes anteriores e usar atualização incremental para assinaturas posteriores do próprio sistema; se as permissões, o PDF ou os validadores não aceitarem a alteração sem comprometer a assinatura GOV.BR, bloquear a operação de forma explícita. A versão completa poderá adotar regiões ou campos reservados como reforço, mas isso não é requisito do MVP. Suportar GOV.BR em qualquer vez significa permitir a escolha e tratar a compatibilidade explicitamente, não garantir que todo PDF aceita toda alteração posterior.

## 5. Captura e posicionamento da assinatura

Permitir desenho por toque, caneta digital e mouse, com ações de limpar e refazer. Impedir confirmação de uma área vazia.

Preservar a imagem com transparência, preferencialmente em PNG. Capturar pressão, velocidade ou outros atributos biométricos não é necessário para esse fluxo e não deve ser introduzido sem necessidade específica.

Registrar o hash da imagem, página, coordenadas, dimensões e rotação aplicável. Definir explicitamente a origem e as unidades das coordenadas. Converter as posições da tela para o espaço da página do PDF considerando zoom, dimensões, recorte e rotação.

Conferir limites e transformações no servidor. Após uma assinatura criptográfica, manter a posição livre no MVP, orientar o participante a não cobrir assinaturas anteriores, usar somente preenchimento por atualização incremental e revalidar as assinaturas anteriores; não regravar o PDF por composição convencional. Se a posição ou operação escolhida não for compatível com as permissões e validações do arquivo, bloquear a confirmação e preservar a revisão assinada intacta. A aplicação deve mostrar uma prévia fiel dos bytes que serão confirmados. A renderização definitiva deve ocorrer de maneira controlada no backend, sem confiar em um PDF arbitrário enviado pelo navegador como resultado final.

Depois da confirmação, não permitir mover, substituir ou reutilizar automaticamente aquele desenho em outro contrato. Uma nova utilização exige nova autorização do participante.

## 6. Manifesto de consentimento

Criar um registro estruturado por operação, contendo:

| Informação | Conteúdo |
| --- | --- |
| Esquema | Versão do formato do manifesto |
| Operação | Ação explícita de assinar contrato |
| Contexto | Plataforma e organização responsáveis |
| Contrato aplicado | Identificador do vínculo, contrato modelo e versão do conteúdo |
| Documento PDF | Identificador técnico, hash do PDF base, anexos e revisão anterior |
| Resultado aprovado | Hash da revisão candidata mostrada ao participante |
| Assinatura visual | Hash da imagem e posicionamento local; aparência externa quando disponível |
| Fingerprint | Referência e digest do registro obrigatório do ambiente, com versão do coletor |
| Assinatura externa | Exportação, importação, certificado/fingerprint, titular, validação e revisões cobertas, quando o método for GOV.BR |
| Participante | Identidade histórica e papel na relação B2C entre paciente e clínica |
| Consentimento | Texto exato do aceite e versão do método apresentado |
| Autorização | Método e referência da credencial utilizada |
| Tentativa | Identificador e número aleatório criptográfico exclusivo |
| Tempo | Emissão, expiração e indicação da origem dos horários |

Usar representação determinística, como JSON canonicalizado conforme RFC 8785, e preservar os bytes efetivamente utilizados. Não reconstruir o manifesto a partir do cadastro atual.

O manifesto deve distinguir assinatura de login, aprovação administrativa, download ou outra operação. A finalidade precisa integrar os dados autorizados.

## 7. Autorização vinculada ao documento

Manter uma interface interna de autorização capaz de devolver evidências verificáveis ligadas ao manifesto. Não limitar o modelo de dados à existência de uma imagem ou a um booleano de assinatura.

Uma opção reforçada é uma credencial pessoal com chave privada fora do servidor, utilizando WebAuthn/passkey. Nesse modelo:

- O cadastro associa identidade verificada, identificador da credencial e chave pública.
- A autorização da assinatura utiliza um desafio derivado do manifesto, que inclui contexto e um número aleatório criptográfico de 256 bits.
- O backend valida assinatura, desafio, origem, RP ID, credencial, tipo da operação e sinais exigidos de presença e verificação do usuário.
- A tentativa precisa estar vigente, vinculada ao participante e ainda não consumida.
- Preservam-se os bytes originais de `clientDataJSON`, `authenticatorData` e assinatura, além de credencial, algoritmo e chave pública.

A relação entre contrato e prova deve ser criptográfica, não apenas uma associação editável no banco. Uma prova de login não deve ser reutilizada como autorização de contrato.

Passkeys podem ser sincronizadas ou vinculadas a dispositivo. Se a política exigir ausência de sincronização em nuvem, escolher e verificar uma modalidade compatível com essa exigência. A biometria local eventualmente utilizada pelo autenticador não precisa ser recebida pela aplicação.

A assinatura GOV.BR externa é um método já incluído: sua prova é a assinatura criptográfica no PDF importado e validado, sem exigir passkey local adicional. Outros métodos de autorização podem ser implementados, com seus limites documentados. Senha e código podem produzir evidências, mas dependem mais dos registros da plataforma. Não atribuir a um método a força de outro que não foi utilizado.

## 8. Confirmação e consistência da operação

No método local, o botão final deve expressar a intenção de assinar o contrato apresentado, incluindo o desenho e seu posicionamento. No método GOV.BR, a ação final da plataforma aceita a importação validada conforme a seção 4.1, sem fingir que a assinatura criptográfica ocorreu nesse clique. Preservar o texto dessa confirmação.

Na confirmação, verificar conjuntamente:

- Permissão do participante para aquele contrato.
- Correspondência entre manifesto, imagem, posição e revisão candidata.
- Permanência da revisão anterior esperada.
- Validade e disponibilidade da tentativa.
- Evidências exigidas pelo método de autorização.
- Estado do contrato e ausência de cancelamento.

Gravar a operação aceita, suas evidências e a revisão resultante e consumir a tentativa de maneira transacional ou mediante um protocolo recuperável equivalente. Falhas entre banco e armazenamento não podem deixar uma assinatura confirmada sem seu arquivo.

Usar idempotência para que uma repetição após falha de rede recupere o mesmo resultado. Impedir assinaturas duplicadas e consumo concorrente da mesma tentativa.

Concluir o processo apenas quando todos os participantes esperados tiverem confirmado, sem exigir ordem entre eles. Liberar o plano conforme a regra do domínio: a confirmação do paciente é obrigatória, enquanto a assinatura esperada do representante da clínica pode permanecer pendente. A existência da imagem de uma pessoa não significa conclusão de todas as partes.

## 9. Auditoria e preservação

Registrar identificação, cadastro de credencial, disponibilização de revisão, preparação da assinatura, confirmação, recusa, cancelamento, recuperação de acesso, entrega de cópias e intervenções administrativas.

Cada evento deve conter identificador, sequência, ator, objeto, revisão, resultado, horário e origem do horário. Fingerprint, IP e informações do navegador são registros obrigatórios conforme a seção 3.1, com função de evidência complementar, sem equivaler a identificação civil.

Implementar:

- Registros acrescentados ao histórico, sem edição normal dos anteriores.
- Encadeamento de hashes entre eventos.
- Fechamentos assinados pela plataforma.
- Separação de permissões entre aplicação, operação e auditoria.
- Preservação fora do banco operacional e cópias em poder das partes.
- Backups, testes de restauração e controles de acesso.

Não registrar senhas, cookies, códigos utilizáveis ou chaves privadas nos logs. Não expor documentos ou imagens de assinatura em URLs públicas permanentes.

Uma cadeia de hashes pode ser recalculada por quem controla todos os registros. Compará-la com fechamentos e cópias preservados fora desse controle é parte do modelo de confiança.

## 10. Selo da plataforma e gestão de chaves

Separar a autorização do participante do selo do pacote emitido pela plataforma.

A plataforma pode usar um par de chaves próprio e um formato padronizado de assinatura, como JWS com ES256, para selar o manifesto final das evidências. Esse selo identifica a emissão do pacote e permite detectar alterações, dentro da confiança atribuída à chave.

Proteger a chave privada, restringir seu uso, versionar identificadores, registrar rotação e incidentes e preservar as chaves públicas históricas.

Uma chave pública incluída no próprio pacote não comprova sua origem por si só. Distribuir e preservar referências anteriores das chaves e dos vínculos de identidade, para permitir comparações independentes.

O selo não substitui a assinatura dos participantes nem confere credenciamento ICP-Brasil ao sistema.

## 11. Pacote exportável e verificação independente

Disponibilizar às partes um pacote contendo:

- PDF base do documento técnico do contrato aplicado, anexos, revisões confirmadas e PDF final.
- Imagens de assinatura e posicionamentos associados.
- Manifestos e provas de autorização.
- Chaves públicas e referências históricas das credenciais.
- Evidências necessárias da identidade e representação, com controle de acesso proporcional.
- Eventos relevantes e fechamentos da auditoria.
- Fingerprints das operações, originais importados do GOV.BR e relatórios de validação por assinatura/revisão.
- Manifesto final com hashes dos componentes e selo da plataforma.
- Relatório legível e instruções de verificação.

O relatório resume as provas, mas não substitui os arquivos técnicos.

O verificador deve recalcular hashes, conferir vínculos entre revisões, reconstruir os desafios quando aplicável, verificar assinaturas e selo e apontar evidências ausentes. Precisa distinguir aprovação do conteúdo contratual, aprovação de cada revisão e inclusão posterior das demais assinaturas.

A verificação matemática deve poder ocorrer sem consultar o banco da aplicação. Já a interpretação das evidências de identidade depende dos procedimentos e da confiança documentados.

## 12. Recuperação, revogação e tempo

Recuperação de acesso deve registrar nova verificação, credenciais afetadas, motivo, responsável e notificações. Preservar as credenciais públicas antigas e não permitir que a recuperação reescreva autorizações anteriores.

Revogação bloqueia novas operações com uma credencial; os registros históricos permanecem disponíveis para análise.

Usar horários UTC sincronizados e identificar sua origem. Horário do servidor é uma declaração do servidor, mesmo quando integra dados assinados.

Se futuramente houver necessidade de prova de tempo independente, permitir anexar carimbos do tempo, como os definidos pela RFC 3161, sem alterar os objetos anteriormente preservados. Um carimbo obtido depois não comprova retroativamente o horário original alegado.

## 13. Limites de confiança

A aplicação depende de identificação adequada, proteção das credenciais e apresentação honesta do documento. Se o operador controla todas as evidências e suas únicas cópias, pode fabricar registros.

Chaves pessoais e cópias nas mãos dos participantes reduzem essa dependência. Não eliminam toda possibilidade de fraude.

Em particular, um autenticador WebAuthn comum não exibe o PDF. Um site malicioso pode mostrar um conteúdo e solicitar autorização vinculada a outro. Resistir também a esse cenário exige um componente independente confiável para apresentação e autorização do documento. Não prometer essa propriedade sem implementá-la.

A assinatura desenhada é a representação visual permanente nas duas versões do produto. As evidências adicionais reforçam a comprovação da operação que a aplicou, sem mudar esse princípio.

## 14. Critérios de aceitação

- Coletar e vincular fingerprint à confirmação local, exportação e importação, registrando sinais indisponíveis e a versão do coletor.
- Permitir que o participante da vez escolha GOV.BR sem usar credenciais governamentais dentro da aplicação.
- Uma imagem com logotipo GOV.BR não é aceita como assinatura criptográfica.
- Uma assinatura de outra pessoa, um contrato diferente ou uma revisão antiga não conclui a tentativa atual.
- Um retorno sem assinatura nova, inválido ou indeterminado permanece rejeitado ou pendente, conforme o caso.
- Preservar o PDF externo original e revalidar as assinaturas anteriores ao continuar a coleta.
- Demonstrar local → GOV.BR → local e GOV.BR → GOV.BR nos modelos suportados, com posicionamento livre no MVP, orientação para não cobrir assinaturas anteriores e bloqueio explícito de alterações que não possam ser aplicadas incrementalmente sem comprometer a assinatura GOV.BR.
- O resultado distingue assinatura local de assinatura GOV.BR validada e informa a revisão coberta por cada uma.

- Alterar um byte de uma revisão confirmada causa divergência verificável.
- Alterar desenho ou posição depois da aprovação rompe os vínculos de integridade.
- Reaproveitar a autorização em outro contrato, participante ou revisão falha.
- Uma autenticação de login não é aceita como autorização de contrato.
- Confirmar uma revisão desatualizada exige nova prévia.
- Repetir a mesma requisição não cria outra assinatura.
- Atualizar cadastro ou recuperar acesso não altera os registros históricos.
- Cada assinatura e revisão anterior continua disponível depois das seguintes.
- O desenho aparece na mesma posição e dimensão aprovadas em celular e computador.
- A aplicação não conclui contratos com participantes obrigatórios pendentes.
- O pacote exportado permite verificação matemática sem o servidor.
- O verificador comunica limites e não transforma dados declarados em fatos certificados.

## Referências

- [MP 2.200-2, especialmente art. 10](https://www.planalto.gov.br/ccivil_03/mpv/antigas_2001/2200-2.htm).
- [Código de Processo Civil, especialmente art. 429](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13105.htm).
- [Lei 14.063 — classificação e âmbito das assinaturas](https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2020/lei/l14063.htm).
- [ITI — certificação digital e distinção da representação gráfica](https://www.gov.br/iti/pt-br/acesso-a-informacao/perguntas-frequentes/certificacao-digital).
- [NIST — verificação de identidade](https://pages.nist.gov/800-63-4/sp800-63a.html).
- [W3C — WebAuthn](https://www.w3.org/TR/webauthn-3/).
- [FIDO Alliance — passkeys](https://fidoalliance.org/passkeys/).
- [OWASP — autorização de transações](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html).
- [OWASP — registros de auditoria](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).
- [RFC 8785 — canonicalização de JSON](https://www.rfc-editor.org/rfc/rfc8785.html).
- [RFC 7515 — JSON Web Signature](https://www.rfc-editor.org/rfc/rfc7515.html).
- [RFC 3161 — carimbo do tempo](https://www.rfc-editor.org/rfc/rfc3161.html).

- [Portal de assinatura GOV.BR](https://www.gov.br/pt-br/servicos/assinatura-eletronica).
- [Regras de integração GOV.BR](https://www.gov.br/governodigital/pt-br/identidade/identidade-digital-para-gestores-publicos/duvidas-frequentes-do-ecossistema-da-identidade-digital-gov-br).
- [VALIDAR — orientações técnicas](https://validar.iti.gov.br/guia-desenvolvedor.html).
- [VALIDAR — dúvidas](https://validar.iti.gov.br/duvidas.html).
- [pyHanko — análise de alterações incrementais](https://docs.pyhanko.eu/en/latest/lib-guide/validation/diff-analysis.html).
- [MDN — fingerprinting](https://developer.mozilla.org/en-US/docs/Glossary/Fingerprinting).
- [LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm).
