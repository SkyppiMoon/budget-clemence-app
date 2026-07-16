-- Migration à exécuter une seule fois dans Supabase > SQL Editor.
-- Elle ajoute un budget et un statut d'inclusion propres à chaque mois.

create table if not exists public.category_monthly_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  budget_month date not null,
  budget numeric(12,2) not null default 0 check (budget >= 0),
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category_id, budget_month),
  check (budget_month = date_trunc('month', budget_month)::date)
);

create index if not exists category_monthly_budgets_user_month_idx
on public.category_monthly_budgets (user_id, budget_month);

create index if not exists category_monthly_budgets_category_idx
on public.category_monthly_budgets (category_id);

alter table public.category_monthly_budgets enable row level security;

drop policy if exists "Read own monthly category budgets" on public.category_monthly_budgets;
create policy "Read own monthly category budgets"
on public.category_monthly_budgets
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Insert own monthly category budgets" on public.category_monthly_budgets;
create policy "Insert own monthly category budgets"
on public.category_monthly_budgets
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Update own monthly category budgets" on public.category_monthly_budgets;
create policy "Update own monthly category budgets"
on public.category_monthly_budgets
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Delete own monthly category budgets" on public.category_monthly_budgets;
create policy "Delete own monthly category budgets"
on public.category_monthly_budgets
for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete
on table public.category_monthly_budgets
to authenticated;

revoke all
on table public.category_monthly_budgets
from anon;
