# Painel administrativo separado da aplicação comercial

- **Status:** Aceito; implementação futura, fora deste recorte.
- **Data:** 2026-11-25.

A gestão administrativa da plataforma será realizada por um painel em outro app, separado de `apps/web`. Seu código, telas e rotas não devem compor o artefato de build da aplicação comercial. Ocultar menus ou rotas no frontend comercial não atende a essa separação.

O painel será acessado por meio de um túnel privado, sem disponibilização pública direta. Sua implementação, funcionalidades, autenticação e infraestrutura serão especificadas em trabalho futuro; este recorte apenas registra sua existência e a separação dos artefatos. O túnel não implica acesso administrativo concedido aos usuários da aplicação comercial.
