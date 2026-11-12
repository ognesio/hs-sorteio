# SUNSET HOUSE — Sistema de sorteio digital

Site público (cadastro + número da sorte) e painel `/admin` (participantes, números, sorteio e configurações) para o evento de **15/11/2026**.

**Stack:** React + TypeScript + Tailwind (Vite) · Supabase (Postgres, Auth, Edge Functions) · Netlify.

---

## Como funciona (arquitetura)

```
Navegador ──► Netlify (site estático)
   │
   ├─ get_public_config()  ─► Postgres (RPC pública, sem dados pessoais)
   ├─ POST /functions/v1/register ─► Edge Function ─► register_participant() [service_role]
   ├─ POST /functions/v1/whatsapp-send ─► Edge Function ─► WhatsApp Cloud API
   └─ /admin (Supabase Auth) ─► tabelas com RLS + RPCs admin (perform_draw, admin_stats…)
Meta ──► /functions/v1/whatsapp-webhook (status: enviado / entregue / lido / falhou)
```

| Requisito | Onde está resolvido |
|---|---|
| Número sequencial 0001, 0002… sem duplicar | `register_participant()` trava a linha de `settings` (`FOR UPDATE`): cadastros simultâneos são serializados; numeração sem buracos; `UNIQUE` em `lucky_number` |
| Telefone/e-mail duplicados | Índices únicos (`phone`, `lower(email)`) + checagem na função. Se a pessoa repetir **o mesmo telefone e e-mail**, recebe de volta o número que já tinha (útil se trocar de celular/limpar o navegador) |
| Cadastro repetido após atualizar a página | Ingresso salvo no `localStorage` e reexibido; o servidor bloqueia de qualquer forma |
| Sorteio seguro | `perform_draw()` no Postgres: só admin, `gen_random_bytes` (CSPRNG) com amostragem por rejeição, trava global (sem sorteios simultâneos), não repete vencedor, refazer exige motivo e anula o anterior, grava hash SHA-256 da lista de números elegíveis + responsável + horário |
| Frontend não manipula o sorteio | O navegador só recebe o resultado; a animação começa antes, mas o número final vem do servidor |
| Dados pessoais protegidos | RLS: apenas usuários da tabela `admins` leem participantes; `anon` não tem acesso a nenhuma tabela |
| Anti-spam | Honeypot, tempo mínimo de preenchimento, limite por IP (40 cadastros / 10 min — o Wi-Fi da festa é compartilhado), Cloudflare Turnstile opcional |
| Auditoria | Tabela `audit_log` (sorteios, anulações, desclassificações, mudanças de configuração e prêmios) |
| WhatsApp honesto | Sem credenciais, nada é enviado nem marcado como enviado. Status real vem do webhook da Meta |

Testado localmente (Postgres): cadastro, duplicidades, devolução de número existente, permissões de `anon`/não-admin, 4 sorteios sem repetição, refazer com exclusão do anulado, limite de participantes e distribuição uniforme do gerador.

---

## 1. Supabase (≈10 min)

1. Crie um projeto em supabase.com (região São Paulo, se disponível).
2. **SQL Editor** → cole e rode `supabase/migrations/20261112000000_sorteio.sql`.
3. **Authentication → Sign In / Providers → Email**: desative *Allow new users to sign up*.
4. **Authentication → Users → Add user**: crie o(s) admin(s) com e-mail e senha (marque *Auto confirm*).
5. Autorize cada admin no SQL Editor:
   ```sql
   insert into public.admins (user_id, email)
   select id, email from auth.users where email = 'seu-email@exemplo.com';
   ```
6. Edge Functions (com a CLI do Supabase instalada):
   ```bash
   npx supabase login
   npx supabase link --project-ref SEU_REF
   npx supabase functions deploy register --no-verify-jwt
   npx supabase functions deploy whatsapp-send --no-verify-jwt
   npx supabase functions deploy whatsapp-webhook --no-verify-jwt
   npx supabase secrets set IP_HASH_SALT="$(openssl rand -hex 16)" ALLOWED_ORIGINS="https://SEU-SITE.netlify.app"
   ```
   (As funções fazem a própria autenticação; `--no-verify-jwt` é necessário para o webhook e para as novas chaves publicáveis.)

## 2. Netlify (≈5 min)

1. Suba esta pasta para um repositório no GitHub.
2. Netlify → *Add new site → Import from Git* → escolha o repositório. O `netlify.toml` já define build e redirecionamento do `/admin`.
3. *Site configuration → Environment variables*:
   - `VITE_SUPABASE_URL` — Project Settings → API → Project URL
   - `VITE_SUPABASE_ANON_KEY` — chave **anon/publishable** (nunca a `service_role`)
   - `VITE_TURNSTILE_SITE_KEY` — opcional
4. Faça o deploy e atualize `ALLOWED_ORIGINS` com a URL final.

Desenvolvimento local: `cp .env.example .env.local`, preencha e rode `npm install && npm run dev`.

## 3. WhatsApp Business Platform (Cloud API)

Sem esta etapa o site funciona normalmente: o participante vê o número e pode copiar; o painel lista quem autorizou e ainda não recebeu, com **Abrir conversa** (wa.me com a mensagem pronta) e **Marcar enviado**.

Para envio automático:
1. Meta for Developers → crie um app *Business* → adicione **WhatsApp** → vincule um número dedicado (não pode estar em uso no app WhatsApp comum).
2. Crie um **template** categoria *Utility*, idioma *Portuguese (BR)*, nome `sunset_numero_sorte`, corpo:
   ```
   Olá, {{1}}! 🎧

   Seu cadastro no sorteio do SUNSET HOUSE foi confirmado!

   🍀 Seu número da sorte é: {{2}}

   Guarde esse número e fique de olho no sorteio.

   Boa sorte e curta a festa! 🌅

   SUNSET HOUSE
   Uma realização com Caos e Napiteira.
   ```
   Aguarde a aprovação. Mensagens iniciadas pela empresa só saem com template aprovado.
3. Gere um token permanente (System User com permissão `whatsapp_business_messaging`).
4. Secrets das funções:
   ```bash
   npx supabase secrets set \
     WHATSAPP_ACCESS_TOKEN="..." WHATSAPP_PHONE_NUMBER_ID="..." \
     WHATSAPP_TEMPLATE_NAME="sunset_numero_sorte" WHATSAPP_TEMPLATE_LANG="pt_BR" \
     WHATSAPP_APP_SECRET="..." WHATSAPP_VERIFY_TOKEN="$(openssl rand -hex 16)"
   ```
5. Webhook (App → WhatsApp → Configuration): URL `https://SEU_REF.supabase.co/functions/v1/whatsapp-webhook`, verify token = `WHATSAPP_VERIFY_TOKEN`, assine o campo `messages`.
6. Em **/admin → Configurações**, os dois itens da integração devem aparecer verdes.

Observações: contas novas e não verificadas têm limite diário de conversas iniciadas pela empresa e a Meta cobra por mensagem de template — confira os valores atuais no painel da Meta. A aprovação do template pode levar de minutos a um dia.

## 4. Checklist do dia

- [ ] Fazer 2–3 cadastros de teste, conferir em /admin e **excluí-los** (status *Excluído*) antes de abrir ao público.
- [ ] Revisar os campos `[entre colchetes]` em `src/pages/public/Legal.tsx` (controlador e contato LGPD).
- [ ] Gerar um QR Code com a URL do site para os pontos da festa.
- [ ] No sorteio: encerrar inscrições (opcional) → aba **Sorteio** → escolher prêmio → *Iniciar sorteio*. O botão de tela cheia ajuda a projetar.
- [ ] Ganhador ausente: *Refazer este sorteio* com o motivo — o resultado anterior fica anulado no histórico.

## Estrutura

```
src/
  pages/public/   Home (landing + formulário + ingresso), Legal
  pages/admin/    Login, Dashboard, Participantes, Números, Sorteio, Configurações
  lib/            backend (Supabase), validações, mensagens WhatsApp
  components/     identidade visual (logo, vinil, nuvens, patrocinadores) e UI
supabase/
  migrations/     schema, RLS, funções (cadastro atômico, sorteio)
  functions/      register, whatsapp-send, whatsapp-webhook
```

`npm run build:preview` gera `dist-preview/index.html`, uma pré-visualização de design com dados fictícios em memória (com faixa de aviso). Ela não é usada no site real — o build de produção não inclui esse código.
