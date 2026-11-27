# Tenancy compartilhada e cadastro independente por clínica

- **Status:** Aceito para a evolução SaaS; implementação pendente.
- **Data:** 2026-11-25.

Cada clínica é um tenant; a identidade da pessoa é independente de qualquer clínica. Por correção explícita do usuário, a relação usuário–tenant será muitos-para-muitos desde esta migração, por tabela de vínculos que identifica usuário, tenant e papel naquele tenant. Uma conta pode existir sem vínculos. Não manter `user.tenant_id` como fonte final de autorização nem adicionar unicidade global de usuário ou tenant na tabela de vínculos; cada par usuário–tenant é único.

Nesta entrega, o cadastro cria uma clínica com um vínculo de administrador. Convites, equipes, novos papéis operacionais e seleção entre várias clínicas são futuros, não funcionalidades a implementar agora. A limitação da jornada atual não deve ser convertida em uma restrição estrutural que impeça os vínculos futuros. Contas com vários vínculos não devem ter um tenant escolhido arbitrariamente enquanto não existir seleção explícita suportada.

Os tenants compartilham a estrutura de persistência, com isolamento por `tenant_id` e integridade dos vínculos; não haverá schema PostgreSQL por tenant. A ideia original de usar `DB_SCHEMA` para essa separação foi abandonada. Sua retirada da configuração exige, porém, preservar o namespace físico e o ledger das migrations existentes por uma transição explícita, não por autodetecção ou criação de uma instalação vazia.

Clínicas, contas, credenciais, dados protegidos e documentos existentes devem ser preservados. O cadastro autônomo substitui o bootstrap por ambiente, mas não recria nem reivindica tenants legados. Planos de assinatura do SaaS são distintos dos planos clínicos; suas regras comerciais ainda serão definidas na especificação.

Migração aditiva: criar vínculos administrativos a partir dos pares legados `user.id`/`user.tenant_id`, validar correspondência e integridade antes de mudar autenticação, autorização e vínculos profissionais. Remover a coluna antiga somente depois do corte e da janela de rollback compatível. Preservar IDs, credenciais, tenant IDs dos dados clínicos e profissionais históricos.

O provisionamento exclusivamente pelo operador deixa de ser a jornada normal de novos clientes; ferramentas de recuperação operacional não concedem acesso clínico implícito.
