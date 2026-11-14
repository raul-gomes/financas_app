# Como Confirmar o E-mail de um Usuário (Supabase)

> **Criado em:** 2026-09-09
> **Motivo:** cadastro em `<seu-email>` sem confirmação de e-mail — o login/senha não funcionava.

## Contexto

O cadastro é feito pelo Supabase Auth (`supabase.auth.signUp`). Por padrão, o Supabase exige confirmação de e-mail antes de permitir login. O link de confirmação chega por e-mail e, se ele não for recebido ou não for encontrado (spam/lixeira), o usuário fica preso.

## Opção 1 — Confirmar pelo link do e-mail

1. Procure em **spam/lixeira** o e-mail "Confirme seu email".
2. Clique no link de confirmação.
3. Volte ao app e faça login com `http://localhost:8087/login`.

## Opção 2 — Confirmar manualmente pelo Dashboard do Supabase

Recomendado quando o e-mail não chega ou o usuário não consegue confirmar.

1. Acesse https://supabase.com/dashboard → selecione o projeto.
2. Menu lateral → **SQL Editor** → **New query**.
3. Execute o comando abaixo trocando o e-mail pelo do usuário:

```sql
update auth.users
set email_confirmed_at = now()
where email = '<seu-email>';
```

4. Após rodar, o login com senha funciona normalmente.

## Opção 3 — Desativar a confirmação de e-mail

Para evitar esse passo em futuros cadastros (aceitar cadastro sem confirmação):

1. Dashboard → **Authentication** → **Providers**.
2. Em **Email**, desative a opção **Confirm email**.
3. Salve.

## Dicas / Notas

- O login só passa no `AuthGuard` quando `email_confirmed_at` estiver preenchido.
- Após confirmar manualmente via SQL, não é preciso reenviar nenhum e-mail.
- Para reenviar o e-mail de confirmação: Dashboard → **Authentication** → **Users** → usuário → **Resend email** (ou em código: `supabase.auth.resend({ type: 'signup', email })`).
- Se o usuário ainda não conseguir logar, verifique se a senha foi cadastrada no `signUp`.