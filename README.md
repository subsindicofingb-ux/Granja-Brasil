# Condomínio SaaS

MVP de plataforma SaaS para administração de condomínios.

## Stack

- **Next.js 15** (App Router, TypeScript, Supabase SSR)
- **Supabase** (Auth, PostgreSQL, RLS)
- **Vercel** (deploy)

## Autenticação e autorização

### Fluxo

1. **Signup** (`/signup`) — cria usuário no Supabase Auth + profile automático
2. **Login** (`/login`) — e-mail/senha; middleware protege `/app/*`
3. **Membership** — admin/síndico vincula e-mail em Configurações → Membros
4. **Seleção de condomínio** — `/app` lista vínculos; cookie `active_condo_slug`
5. **Acesso ao painel** — layout valida membership + RLS no banco

### Bootstrap do primeiro admin

```bash
# 1. Aplicar migrations + seed
supabase db reset

# 2. Criar conta em http://localhost:3000/signup

# 3. Vincular como admin (service role)
npm run db:link-member -- admin@example.com admin

# Super admin (acesso global via RLS)
npm run db:link-member -- admin@example.com super_admin
```

### Variáveis de ambiente

Copie `.env.local.example` → `.env.local`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only — memberships bootstrap)
- `NEXT_PUBLIC_SITE_URL`

### Estrutura auth

```
lib/auth/
  session.ts      → getSession, requireSession, ensureProfile
  access.ts       → getCondoAccess, requireCondoAccess, memberships
  active-condo.ts → cookie do condomínio ativo
  actions.ts      → login, signup, logout, memberships
  roles.ts        → permissões por papel (UI)
middleware.ts     → guard /app + refresh session
```

## App

```bash
npm install
npm run dev
```

## Banco de dados

Ver migrations em `supabase/migrations/` e seed em `supabase/seed.sql`.

```bash
supabase start
supabase db reset
```

## Próximo passo

Substituir mocks das páginas por queries Supabase (dados reais).
