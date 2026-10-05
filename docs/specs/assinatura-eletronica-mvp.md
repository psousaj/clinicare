# Especificação — Assinatura eletrônica própria no MVP

## Problem Statement

A aplicação já possui contratos aplicados, participantes, links temporários de assinatura, autenticação administrativa e persistência relacional, mas o fluxo atual ainda registra uma confirmação genérica e não opera o PDF como um documento versionado. O produto precisa permitir que paciente e representante da clínica confirmem contratos em uma relação B2C, preservando quem realizou cada operação, qual documento foi visualizado, qual revisão foi aprovada e quais evidências técnicas estavam disponíveis.

O problema central não é apenas desenhar uma imagem no PDF. É manter uma cadeia de revisões imutáveis, com concorrência segura, armazenamento privado, histórico e possibilidade de receber uma assinatura criptográfica externa feita no GOV.BR sem destruir a estrutura do PDF. A assinatura desenhada pela plataforma é uma aparência visual; a assinatura GOV.BR é uma assinatura criptográfica criada fora da aplicação e validada no retorno.

## Solution

Implementar o fluxo de assinatura do **Contrato aplicado** usando um **Documento PDF do contrato aplicado** como artefato técnico versionado.

A fonte editável do contrato é administrada no painel autenticado, inicialmente por DOCX. Cada fonte salva gera uma versão imutável e um PDF renderizado. O PDF original da aplicação é preservado e cada alteração aceita gera uma nova revisão imutável. A aplicação usa incremental update para as mutações próprias, preserva os bytes anteriores e mantém um único HEAD por documento.

O paciente assina por link individual temporário e código de confirmação formado pelos quatro últimos dígitos do telefone obrigatório cadastrado. O representante da clínica assina no painel por sessão administrativa autenticada. Ambos podem operar em qualquer ordem. O paciente é obrigatório para liberar o plano; a assinatura do representante é esperada, auditada e pode permanecer pendente sem bloquear agendamento ou execução.

A assinatura local usa `pdfjs-dist` como viewer, `signature_pad` para desenho e `react-rnd` para posicionamento visual. O backend recebe a intenção, valida a revisão-base, converte coordenadas normalizadas para o espaço PDF, gera um candidato com `@libpdf/core` por incremental update, calcula SHA-256, persiste a revisão e promove o HEAD por controle otimista.

O GOV.BR é um fluxo alternativo de exportar → assinar fora → importar. O backend registra exportação, reserva, fingerprint, arquivo recebido e importação separadamente. O PDF externo passa por validação da nova assinatura, vínculo com a revisão exportada, continuidade incremental, identidade do signatário e revalidação das assinaturas anteriores. Quando o resultado for `validada`, o PDF recebido é promovido como nova revisão e a etapa é confirmada. Arquivos inválidos, indeterminados ou não suportados podem ser preservados como recebimento/histórico, mas não confirmam a assinatura.

O sistema não implementa PAdES, não emite certificados e não assina digitalmente pelo backend. A invariante arquitetural é: a aplicação não precisa implementar PAdES; precisa ter disciplina suficiente para não destruir um PAdES que apareceu no meio da cadeia.

## User Stories

1. Como administrador da clínica, quero importar ou editar a fonte de um contrato no painel autenticado, para preparar o documento que será aplicado aos pacientes.
2. Como administrador da clínica, quero que cada salvamento final da fonte gere uma nova versão imutável, para que contratos aplicados anteriormente não mudem retroativamente.
3. Como administrador da clínica, quero que a fonte do contrato seja renderizada para PDF antes de sua aplicação, para que paciente e clínica assinem exatamente o documento PDF apresentado.
4. Como administrador da clínica, quero saber quando a renderização do PDF falhou, para não aplicar ou enviar para assinatura uma versão incompleta.
5. Como administrador da clínica, quero aplicar uma versão específica do contrato a um plano de um paciente, para congelar o conteúdo contratual daquele acompanhamento.
6. Como administrador da clínica, quero que o contrato aplicado preserve o PDF original e seu hash, para comparar o conteúdo apresentado com as revisões posteriores.
7. Como paciente, quero abrir meu contrato por um link individual temporário, para ler o documento sem precisar criar uma conta no sistema administrativo.
8. Como paciente, quero confirmar o acesso com os quatro últimos dígitos do telefone cadastrado, para concluir rapidamente a etapa prevista no MVP.
9. Como paciente, quero visualizar o PDF completo antes de assinar, para entender qual documento estou confirmando.
10. Como paciente, quero desenhar minha assinatura usando toque, mouse ou caneta digital, para assinar no celular ou computador.
11. Como paciente, quero limpar e refazer o desenho antes da confirmação, para corrigir uma assinatura visual ruim.
12. Como paciente, quero posicionar, mover e redimensionar o desenho sobre a página, para escolher onde ele aparece no contrato.
13. Como paciente, quero visualizar a prévia do PDF candidato, para confirmar o arquivo efetivamente produzido pelo backend.
14. Como paciente, quero confirmar expressamente minha intenção de assinar, para que desenhar ou abrir o documento não seja considerado assinatura.
15. Como paciente, quero que minha operação registre meu nome, telefone, e-mail quando existente, papel, horário, revisão e método usados, para que o histórico não dependa de alterações futuras no meu cadastro.
16. Como paciente, quero que o sistema registre o fingerprint técnico do ambiente usado na confirmação, para preservar uma evidência complementar em eventual contestação.
17. Como representante da clínica, quero assinar pelo painel autenticado, para que minha identidade operacional seja derivada da sessão e não de um identificador enviado pelo navegador.
18. Como representante da clínica, quero assinar o mesmo contrato antes ou depois do paciente, para que o processo não imponha uma ordem operacional desnecessária.
19. Como representante da clínica, quero que meu `userId`, nome, e-mail, tenant, clínica e papel sejam congelados na operação, para que mudanças posteriores na conta não alterem o histórico.
20. Como representante da clínica, quero que meu fingerprint técnico seja registrado na confirmação, para que a operação interna também tenha evidência de ambiente.
21. Como participante, quero que uma assinatura confirmada não possa ser editada ou movida posteriormente, para preservar o conteúdo que foi aprovado.
22. Como participante, quero que uma correção exija uma nova versão ou processo, para que o histórico original não seja sobrescrito.
23. Como participante, quero continuar o processo mesmo quando outra pessoa assinou antes, para que a ordem entre paciente e representante não seja um bloqueio artificial.
24. Como participante, quero receber uma mensagem clara quando minha prévia ficou desatualizada, para visualizar a revisão atual e refazer a operação conscientemente.
25. Como participante, quero que uma tentativa que perdeu uma corrida seja preservada, para que o histórico mostre que houve uma operação sem transformá-la em assinatura aceita.
26. Como participante, quero que uma falha de rede ou repetição do clique não duplique minha assinatura, para que uma operação tenha efeito único.
27. Como participante, quero escolher “Assinar pelo GOV.BR” como alternativa à assinatura desenhada, para usar a assinatura externa oficial sem entregar credenciais governamentais à aplicação.
28. Como participante, quero baixar exatamente a revisão exportada para o GOV.BR, para assinar externamente o arquivo correto.
29. Como participante, quero importar o PDF retornado pelo GOV.BR na mesma tentativa, para vincular o retorno à revisão exportada.
30. Como participante, quero que a aplicação registre fingerprints separados na exportação e na importação, para distinguir os ambientes usados em cada etapa.
31. Como participante, quero que a aplicação informe o signatário identificado no PDF externo e o resultado da validação, para não tratar qualquer upload como assinatura.
32. Como participante, quero que uma assinatura GOV.BR validada seja incorporada à cadeia como revisão do documento, para continuar o processo com a evidência criptográfica externa preservada.
33. Como participante, quero que um retorno inválido, indeterminado ou não suportado permaneça pendente ou recusado, para que a aplicação não aceite uma assinatura por aproximação.
34. Como participante, quero que o sistema rejeite o reenvio do PDF anterior sem uma nova assinatura, para impedir que uma tentativa antiga seja concluída novamente.
35. Como participante, quero que o sistema detecte quando o PDF retornado deriva de uma revisão antiga, para impedir merge silencioso entre cadeias concorrentes.
36. Como participante, quero que o sistema preserve certificados, identificadores de assinatura, hashes, revisões cobertas e relatório de validação do retorno externo, para permitir investigação posterior.
37. Como participante, quero que a aplicação preserve assinaturas digitais externas que já existam no PDF, para continuar a cadeia sem destruir PAdES ou estruturas CMS que a plataforma não criou.
38. Como participante, quero que assinaturas manuscritas posteriores a uma assinatura GOV.BR usem incremental update, para não reescrever os bytes protegidos da revisão externa.
39. Como participante, quero posicionar a assinatura livremente no MVP mesmo depois de uma assinatura GOV.BR, para manter a experiência simples, sendo orientado a não cobrir assinaturas anteriores.
40. Como participante, quero receber bloqueio explícito quando a posição ou alteração não for compatível com as permissões do PDF, para que o sistema nunca faça fallback destrutivo.
41. Como administrador da clínica, quero consultar pendências de assinatura separando as que bloqueiam a liberação das administrativas, para saber que a assinatura do paciente é obrigatória e a do representante pode permanecer pendente.
42. Como administrador da clínica, quero consultar o histórico de revisões e operações, para distinguir contrato aplicado, PDF original, revisões, tentativas e assinaturas aceitas.
43. Como administrador da clínica, quero baixar o PDF disponível com indicação de pendência ou conclusão, para entregar o resultado correto às partes.
44. Como administrador da clínica, quero que PDFs e imagens permaneçam em armazenamento privado com URLs temporárias, para evitar exposição pública dos documentos.
45. Como responsável pela proteção de dados, quero que fingerprints, IPs e contexto sejam tratados como dados pessoais quando associados ao participante, para limitar acesso e retenção adequadamente.
46. Como responsável pelo produto, quero que o sistema diferencie hash do PDF, fingerprint do ambiente e fingerprint do certificado, para não misturar evidências com significados diferentes.
47. Como responsável técnico, quero um motor de mutação incremental com teste de prefixo byte-a-byte, para impedir que futuras trocas de biblioteca passem a reserializar PDFs.
48. Como responsável técnico, quero que o sistema mantenha um único HEAD por Documento PDF, para que revisões concorrentes não criem branches silenciosas.
49. Como responsável técnico, quero que o sistema preserve recebimentos externos mesmo quando a validação não os aceita, para manter histórico sem promover uma operação inválida.
50. Como responsável pelo produto, quero que o processo só seja concluído quando todos os participantes esperados confirmarem, para distinguir conclusão documental da liberação operacional do plano.
51. Como responsável pelo produto, quero que o plano seja liberado quando todos os contratos obrigatórios forem confirmados pelo paciente, para manter a regra atual do domínio.
52. Como responsável pelo produto, quero que o sistema não apresente o resultado como certificado ICP-Brasil, reconhecimento de firma ou aprovação jurídica genérica, para comunicar corretamente os limites do MVP.

## Implementation Decisions

### Modelo de domínio e limites

- **Contrato aplicado** é a entidade de negócio que vincula uma versão de contrato ao plano do paciente e reúne participantes, processo, tentativas e evidências.
- **Documento PDF do contrato aplicado** é o artefato técnico associado ao contrato aplicado. Ele possui PDF original, HEAD e revisões incrementais imutáveis.
- `documentId` em endpoints técnicos identifica o PDF versionado do contrato aplicado, não o contrato modelo, a versão de conteúdo nem o acompanhamento inteiro.
- A relação é B2C entre paciente e clínica. O MVP não modela empresa representada.
- Participantes esperados são paciente e representante da clínica. O paciente é obrigatório para liberar o plano; a assinatura do representante é esperada, mas pode permanecer pendente sem bloquear agendamento ou execução.
- Não existe ordem obrigatória entre participantes.
- O processo pode ficar concluído somente quando os participantes esperados confirmarem, independentemente da ordem.

### Fonte, PDF e revisões

- A fonte administrativa é DOCX no início e poderá ser editada online futuramente no painel autenticado.
- Salvar/importar a fonte finaliza uma nova versão imutável e produz um PDF renderizado.
- Rascunho não pode ser aplicado nem assinado.
- O PDF renderizado é o artefato apresentado, exportado, assinado e baixado.
- Cada Documento PDF possui um PDF original e revisões imutáveis armazenadas individualmente.
- Cada revisão contém identificador, versão, `parentRevisionId`, hash SHA-256, referência privada no storage e data de criação.
- O Documento PDF possui um único `currentRevisionId`/HEAD.
- Nenhuma revisão é sobrescrita.
- Uma revisão aceita acrescenta uma assinatura autorizada ou incorpora o PDF externo aceito sem modificar retroativamente o texto, anexos ou assinaturas anteriores.
- A aplicação preserva o vínculo entre contrato aplicado, versão de conteúdo, documento técnico, revisão-base e revisão resultante.

### Assinatura local

- O frontend usa `pdfjs-dist` exclusivamente para visualização e renderização; ele não salva nem modifica PDF.
- O frontend usa `signature_pad` para capturar desenho transparente com mouse, toque e stylus.
- O frontend usa `react-rnd` para overlay, arraste e redimensionamento.
- Enquanto o participante move ou redimensiona o overlay, o PDF não é alterado.
- A confirmação envia imagem PNG transparente, placement normalizado e revisão-base explicitamente.
- Strokes originais podem ser armazenados como evidência opcional, mas não são necessários para o primeiro fluxo.
- Placement usa `pageIndex`, `x`, `y`, `width` e `height`, com valores normalizados entre 0 e 1 relativos às dimensões renderizadas da página.
- O backend converte coordenadas da origem superior da tela para o espaço PDF, considerando dimensões efetivas, CropBox/MediaBox e rotação suportada.
- O backend valida página, limites, dimensões positivas, MIME type, tamanho e PNG válido.
- O PDF candidato é preparado no backend, visualizado antes da confirmação e vinculado aos bytes exatos aprovados.
- A confirmação gera uma tentativa e uma operação de assinatura local; a imagem, hash, placement, texto do aceite, fingerprint, revisão-base e revisão resultante são preservados.

### Concorrência, idempotência e storage

- Toda escrita inclui `parentRevisionId` ou equivalente explícito.
- A confirmação usa controle otimista: uma operação só promove o HEAD se a revisão atual ainda for a revisão-base.
- A operação deve usar uma condição atômica equivalente a `UPDATE ... WHERE current_revision = base_revision`.
- Não manter lock durante desenho, visualização ou uso externo do GOV.BR.
- Duas operações sobre a mesma revisão não podem avançar o HEAD simultaneamente.
- A primeira operação vencedora promove o candidato; a segunda recebe `409 Conflict` com código `STALE_DOCUMENT_REVISION` e a revisão atual.
- A tentativa perdedora, fingerprint e imagem/placement enviados não são descartados silenciosamente.
- O candidato perdedor não vira revisão oficial.
- A reaplicação automática sobre nova revisão fica fora do MVP; o frontend pode preservar temporariamente a imagem e placement para permitir uma nova ação explícita.
- O sistema deve usar tentativa/idempotency key para impedir duplicação por repetição de clique ou retry.
- A coordenação entre PostgreSQL e storage não pode registrar assinatura aceita sem arquivo preservado.
- Falha depois do upload temporário deve permitir recuperação, limpeza ou conclusão determinística; não deve deixar HEAD apontando para objeto ausente.
- PDFs, PNGs, candidatos e retornos externos ficam em storage privado, com chaves opacas, HTTPS, controle de acesso e URLs temporárias.

### Motor PDF e preservação externa

- O seam técnico é um motor com contrato equivalente a:

  ```ts
  interface PdfMutationEngine {
    applyIncrementalChange(
      originalPdf: Uint8Array,
      mutation: PdfMutation,
    ): Promise<Uint8Array>
  }
  ```

- A garantia para mutações próprias é que a saída começa com todos os bytes da entrada.
- `@libpdf/core` é o mecanismo definido para incremental update.
- Não usar `pdf-lib` como mecanismo principal desta funcionalidade.
- Proibir no caminho de assinatura qualquer operação padrão de reserialização completa, recompressão, otimização, linearização, normalização, reconstrução de xref, remoção de objetos, flatten global ou conversão de versão.
- A aplicação não implementa PAdES, CMS/CAdES, certificados, chaves privadas, TSA própria ou assinatura criptográfica do backend.
- PAdES, campos de assinatura, CMS, certificados, carimbos e objetos externos são estruturas que a plataforma não criou e deve preservar.
- Se uma alteração exigir reescrever bytes anteriores ou não puder ser demonstrada como incremental e compatível, bloquear a operação e manter a revisão anterior intacta.
- A posição permanece livre no MVP inclusive após GOV.BR, com orientação para não cobrir assinaturas anteriores. Não haverá regiões/campos previamente reservados obrigatórios no MVP.
- A produção poderá adotar regiões/campos reservados futuramente como reforço, sem mudar o princípio de preservação.

### GOV.BR e assinaturas externas

- GOV.BR é fluxo de exportação, assinatura externa e importação; não há login, senha, API, iframe, callback ou automação do portal dentro da aplicação.
- A plataforma registra revisão-base exportada, tentativa, prazo da reserva, hash do arquivo exportado e fingerprint da exportação.
- O usuário baixa o arquivo, assina no portal oficial e importa o PDF retornado na mesma tentativa.
- Fingerprint da importação é registrado separadamente do fingerprint da exportação.
- O retorno recebido é armazenado provisoriamente de forma privada antes da validação.
- A aplicação deve detectar assinaturas embutidas, verificar CMS/PDF, cobertura dos intervalos de bytes, cadeia de confiança, validade e revogação aplicável.
- A aplicação deve identificar assinatura nova do participante esperado; reenviar o PDF anterior não conclui a etapa.
- A aplicação deve verificar que o retorno deriva da revisão exportada e não de uma revisão antiga, sem exigir igualdade de hash entre PDF exportado e PDF assinado.
- A aplicação deve analisar as modificações incrementais e aceitar apenas mudanças atribuíveis à assinatura externa e permitidas pelo documento.
- Todas as assinaturas anteriores e as evidências locais devem ser revalidadas.
- A correspondência do signatário deve usar identificadores verificados disponíveis no certificado/relatório; nome textual isolado não basta.
- Resultados possíveis: `validada`, `invalida`, `indeterminada` e `formato/fluxo não suportado`.
- Falha de revogação, ausência de evidência ou resultado indeterminado não vira sucesso.
- Quando `validada`, a revisão externa é promovida ao HEAD, a etapa é confirmada e o processo pode continuar.
- Quando inválida, indeterminada ou não suportada, o recebimento pode ser preservado no histórico, mas não confirma nem libera o participante.
- A reserva expirada/cancelada invalida a tentativa; um retorno antigo não pode ser unido silenciosamente a uma revisão que avançou.
- A aplicação pode aceitar assinatura externa sem implementar PAdES próprio: recebe, valida, preserva e incorpora o PDF externo validado.

### Fingerprint e evidências

- Usar FingerprintJS Open Source self-hosted como biblioteca de coleta; não usar Fingerprint Pro nem fornecedor pago no MVP.
- O `visitorId` nunca é autenticação nem prova exclusiva de identidade.
- Persistir também atributos/componentes efetivamente disponíveis, estado de indisponibilidade/bloqueio/redução/inconsistência, versão do coletor, versão da normalização, representação normalizada e digest SHA-256.
- Coletar no navegador na confirmação local, exportação GOV.BR, importação GOV.BR e aceitação da importação; a coleta também pode ser registrada em rejeição/cancelamento quando houver operação de usuário.
- O backend registra IP observado, horário UTC de recebimento e cabeçalhos de encaminhamento somente quando provenientes de proxy confiável.
- Dados voláteis como IP, janela e horário acompanham o contexto, não entram como identificador estável de dispositivo.
- Preservar dados coletados e indisponíveis; nunca inventar valores nem bloquear apenas porque o navegador protege a pessoa.
- Vincular cada fingerprint a tenant, participante/usuário, contrato aplicado, Documento PDF, revisão, tentativa e tipo do evento.
- Tratar o conjunto como dado pessoal quando associado ao participante, com finalidade de rastreabilidade, controle de acesso e retenção limitada.
- Manter separados hash do arquivo, fingerprint técnico do ambiente e fingerprint SHA-256 do certificado externo.

### Identidade e autorização

- Administrador/representante usa sessão Better Auth persistida e tenant-scoped.
- O backend deriva o representante da sessão; não aceita `userId` como prova enviado pelo navegador.
- Paciente usa link individual temporário vinculado ao participante e código dos quatro últimos dígitos do telefone obrigatório.
- O código é uma barreira operacional previsível do MVP, não senha, MFA nem autenticação forte.
- E-mail do paciente é opcional no MVP; telefone e nome são obrigatórios.
- O token público é armazenado apenas como hash, expira e é revogado conforme o fluxo atual.
- Cada operação preserva snapshot histórico dos dados usados: paciente com identificador, nome, telefone, e-mail quando houver e papel; representante com userId autenticado, nome, e-mail, tenant, clínica e papel.
- Alteração posterior de perfil não modifica registros históricos.

### Estados e conclusão

- Participante: `pending`, `awaiting_external_return`, `validating`, `confirmed`/`signed` ou `rejected`/`revoked`, conforme o modelo final adotado.
- Tentativa externa mantém separadamente estado da reserva, resultado da validação e promoção da revisão.
- Documento/contrato aplicado: rascunho, aguardando assinaturas, concluído ou cancelado, sem permitir confirmação após cancelamento.
- Processo concluído quando todos os participantes esperados confirmarem.
- Plano liberado quando todos os contratos obrigatórios forem confirmados pelo paciente.
- Cancelamento e recusa preservam PDFs, revisões, fingerprints, tentativas e eventos.
- Histórico legível informa ator, papel, método, revisão, resultado e horários, sem alegar certificação jurídica.

## Testing Decisions

Os testes devem priorizar comportamento externo nas fronteiras da aplicação. Detalhes de implementação podem ser testados somente quando representam invariantes arquiteturais explícitas, como o prefixo byte-a-byte do incremental update.

### Testes de integração pela API

Usar a estratégia já existente no repositório: PostgreSQL de integração, provisionamento de tenant, sessão autenticada, `app.request`, fixtures controladas e limpeza por tenant. O seam principal é o serviço de aplicação do Documento PDF do contrato aplicado, exercitado por rotas Hono.

Cobrir, no mínimo:

- aplicação de uma versão de contrato com PDF renderizado disponível;
- leitura do Documento PDF e da revisão HEAD;
- isolamento entre tenants;
- acesso do paciente somente pelo token correto, com expiração/revogação;
- exigência do código de quatro últimos dígitos do telefone;
- representante identificado pela sessão autenticada;
- rejeição de identidade enviada no corpo da requisição;
- assinatura local com PNG e placement válido;
- rejeição de PNG vazio, inválido, grande demais ou placement fora dos limites;
- conversão correta de página, rotação, CropBox/MediaBox e coordenadas normalizadas;
- confirmação explícita antes de marcar assinatura;
- revisão nova com hash, parent e arquivo persistido;
- tentativa idempotente sem duplicação;
- duas confirmações concorrentes sobre a mesma revisão, com uma promoção e uma resposta `409 STALE_DOCUMENT_REVISION`;
- preservação da tentativa perdedora e de suas evidências;
- processo com paciente confirmado e profissional pendente liberando o plano;
- processo concluindo somente depois dos participantes esperados;
- cancelamento impedindo novas confirmações;
- alteração de perfil não alterando snapshots históricos;
- download autorizado do PDF atual e revisões permitidas.

### Testes do motor PDF

Usar PDFs reais pequenos e fixtures com características relevantes. O teste principal de toda mutação interna é:

```ts
expect(nextRevision.subarray(0, currentRevision.length)).toEqual(currentRevision)
```

Cobrir:

- PDF original → assinatura manuscrita → nova revisão;
- múltiplas revisões incrementais em sequência;
- preservação dos bytes de cada prefixo;
- preservação de objetos/metadados desconhecidos pelo motor;
- bloqueio quando a biblioteca não consegue operar incrementalmente;
- ausência de chamadas de save/rebuild completo no caminho de assinatura;
- PNG inserido na página e coordenada correspondente à prévia;
- documentos com rotação e boxes não padrão;
- arquivo externo assinado importado → assinatura manuscrita posterior por incremental update;
- revalidação e bloqueio quando a mutação posterior não é admissível.

### Testes de GOV.BR/assinatura externa

Fixtures externas devem representar, quando disponíveis, PDFs assinados pelo GOV.BR e outros PDFs com estruturas PAdES. Testar comportamento observável:

- exportação registra revisão-base, hash, tentativa, prazo e fingerprint;
- importação registra arquivo recebido e fingerprint separado;
- assinatura nova é detectada;
- signatário não correspondente não é aceito;
- retorno baseado em revisão antiga é rejeitado sem merge;
- assinatura inválida não promove HEAD;
- resultado indeterminado permanece pendente;
- formato não suportado é preservado como recebimento, sem confirmação;
- retorno validado promove a revisão externa e confirma a etapa;
- certificados, fingerprints, hashes, revisões cobertas e relatório são preservados;
- assinaturas anteriores continuam revalidadas;
- sequência local → GOV.BR → local funciona nos PDFs declarados suportados;
- sequência GOV.BR → GOV.BR funciona nos PDFs declarados suportados;
- a plataforma não reserializa o PDF externo.

A compatibilidade não deve ser presumida pela escolha da biblioteca: deve ser demonstrada com arquivos reais de teste e validação disponível.

### Testes do frontend

Seguir o padrão de testes web existente para testar comportamento de usuário:

- visualização de PDF por páginas;
- desenho com mouse/touch simulado;
- limpar e refazer;
- overlay inicial;
- drag e resize;
- placement normalizado invariável diante de zoom/redimensionamento;
- preview e confirmação explícita;
- estado de loading;
- tratamento de `409` com revisão atualizada;
- preservação temporária da imagem/placement sem reaplicação automática;
- instrução para não cobrir assinaturas anteriores após GOV.BR;
- bloqueio visual de operação incompatível informado pelo backend.

### Testes de fingerprint

- payload contém versão do coletor e normalização;
- atributos indisponíveis são registrados sem valores inventados;
- digest é calculado da representação definida;
- IP vem do servidor e não de valor confiado do navegador;
- confirmação local, exportação e importação geram registros separados;
- visitorId não é usado para autorizar participante;
- dados sensíveis não aparecem em resposta pública, logs ou URLs;
- fingerprints e snapshots permanecem associados à tentativa correta.

## Out of Scope

- Implementar ou emitir PAdES próprio.
- Assinatura digital criptográfica criada pelo backend.
- ICP-Brasil, certificados A1/A3, gestão de chaves privadas ou autoridade certificadora.
- CMS/CAdES próprio, TSA própria e carimbo de tempo de terceiro.
- Integração automática com APIs, iframe, callback ou login GOV.BR.
- Coleta de senha, cookie ou segredo GOV.BR.
- FingerprintJS Pro, fornecedor pago ou serviço externo de fingerprint.
- Canvas, WebGL, varredura de fontes, rastreamento entre sites ou técnicas invasivas para fingerprint.
- Conta autenticada ou portal completo para pacientes.
- Integração automática com WhatsApp; o profissional envia manualmente link e código.
- Código aleatório, MFA ou autenticação forte do paciente no MVP; o código é fixamente os quatro últimos dígitos do telefone.
- Empresa representada pelo participante; o produto é B2C.
- Ordem obrigatória entre paciente e representante.
- Merge de revisões concorrentes ou branches de PDF.
- Reaplicação automática da assinatura após conflito.
- Regiões/campos de assinatura previamente reservados como requisito do MVP.
- Edição genérica, flatten, normalização, otimização ou reconstrução completa de PDFs.
- Campos AcroForm como mecanismo obrigatório.
- Selo criptográfico próprio da plataforma.
- Encadeamento criptográfico completo de auditoria.
- Pacote/verificador independente operado sem o servidor.
- Avaliação jurídica completa, certificação de validade ou promessa de equivalência a reconhecimento de firma.
- Migração retroativa de contratos existentes; o produto ainda está em desenvolvimento e o modelo novo será adotado diretamente.

## Further Notes

- A assinatura visual desenhada é permanente como aparência no PDF, mas não é assinatura criptográfica.
- O PDF assinado externamente pelo GOV.BR é aceito quando passar pelas validações definidas; a aplicação conserva a prova externa sem alegar que a criou.
- `validada`, `invalida`, `indeterminada` e `formato/fluxo não suportado` devem permanecer semanticamente distintos.
- Preservar bytes é uma preocupação diferente de validar o conteúdo: o sistema deve guardar recebimentos inválidos para histórico sem promovê-los como assinatura aceita.
- O histórico deve distinguir PDF original, revisão incremental local, revisão externa importada, tentativa, assinatura local, assinatura GOV.BR, fingerprint técnico e fingerprint do certificado.
- A posição livre no MVP é uma escolha de UX, não garantia de compatibilidade universal. Quando o PDF ou suas permissões não permitirem a alteração, a resposta correta é bloquear e preservar a revisão assinada.
- O motor PDF deve ser nomeado e documentado como mutação/versionamento incremental, não como assinador digital.
- O ADR de preservação incremental de PDFs com assinaturas externas registra a decisão arquitetural e deve ser respeitado por futuras alterações de biblioteca.
- A implementação deve manter o glossário em `CONTEXT.md` alinhado com Contrato aplicado, Documento PDF do contrato aplicado, Documento assinado, Tentativa de assinatura, Fingerprint técnico da operação, Motor de mutação incremental de PDF e Assinatura digital externa preservada.
