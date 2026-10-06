# Validação de assinatura externa (GOV.BR) sem PAdES próprio

- **Status:** accepted
- **Data:** 2026-10-06

A aplicação recebe o PDF assinado fora (portal GOV.BR), valida com criptografia
real e incorpora o arquivo validado como nova revisão, preservando os bytes
externos exatamente como recebidos (ADR 0004). Nenhum status é aceito por
declaração do navegador.

## Verificações executadas (todas genuínas, nenhuma presumida)

- Continuidade incremental: o retorno precisa começar com todos os bytes da
  revisão exportada; sem isso, nunca há merge entre cadeias.
- Cobertura de ByteRange provada aritmeticamente (`<` em `b`, `>` em `c-1`,
  segundo intervalo até o fim do arquivo).
- `messageDigest` dos atributos assinados igual ao SHA-256 do conteúdo.
- Assinatura CMS verificada criptograficamente (pkijs + WebCrypto).
- Cadeia verificada elo a elo até raízes configuradas (`GOVBR_TRUSTED_ROOTS`
  inline ou `GOVBR_TRUSTED_ROOTS_FILE`); elos não-RSA resultam em cadeia
  não confiável, nunca em sucesso.
- Revogação aplicável: CRL baixada e interpretada; OCSP (RFC 6960) com
  respondedor autorizado (EKU OCSPSigning ou o próprio emissor), assinatura
  da resposta verificada e frescor conferido. Endpoint presente mas
  inalcançável implica `indeterminate`, nunca sucesso.
- Correspondência do signatário por identificadores verificados (dígitos do
  CPF contra o CPF cadastrado do paciente; e-mail do certificado contra o
  e-mail da sessão do representante). Nome textual isolado nunca basta; sem
  identificador esperado, o resultado é `indeterminate` com tudo preservado.

## Resultados

`validated` (único que promove revisão), `invalid`, `indeterminate` e
`unsupported` permanecem semanticamente distintos. Recebimentos não
validados são preservados como histórico e nunca liberam o participante.
A confirmação exige HEAD igual à revisão-base (`STALE_DOCUMENT_REVISION`
com revisão atual, sem merge silencioso) e revalida a integridade da base
no storage antes de promover.
