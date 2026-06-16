-- Permite que usuários autenticados garantam o próprio profile (fallback do trigger)
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());
