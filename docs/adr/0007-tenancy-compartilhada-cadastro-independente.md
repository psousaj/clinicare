# Tenancy compartilhada e cadastro independente por clínica

- **Status:** Aceito para a evolução SaaS; implementação pendente.
- **Data:** 2026-11-25.

Cada clínica é um tenant, com uma única conta administrativa; cada conta pertence a uma única clínica. Novos donos poderão cadastrar suas próprias clínicas. Equipes, memberships, papéis adicionais e participação de um usuário em várias clínicas ficam fora desta entrega. Essa cardinalidade foi confirmada pelo usuário e preserva o vínculo direto e único já existente entre conta e tenant.

Os tenants compartilham a estrutura de persistência, com isolamento por `tenant_id` e integridade dos vínculos; não haverá schema PostgreSQL por tenant. A ideia original de usar `DB_SCHEMA` para essa separação foi abandonada. Sua retirada da configuração exige, porém, preservar o namespace físico e o ledger das migrations existentes por uma transição explícita, não por autodetecção ou criação de uma instalação vazia.

Clínicas, contas, credenciais, dados protegidos e documentos existentes devem ser preservados. O cadastro autônomo substitui o bootstrap por ambiente, mas não recria nem reivindica tenants legados. Planos de assinatura do SaaS são distintos dos planos clínicos; suas regras comerciais ainda serão definidas na especificação.

Alternativas de equipes por clínica e identidade compartilhada entre clínicas foram consideradas e excluídas do escopo atual. O provisionamento exclusivamente pelo operador deixa de ser a jornada normal de novos clientes; ferramentas de recuperação operacional não concedem acesso clínico implícito.
