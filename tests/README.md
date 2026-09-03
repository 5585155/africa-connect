# Offline regression tests

Run `npm test`. Tested with Node 25.9.0; the VM module experimental warning is
expected. Uses only dependencies already present in the project.

`load-module.mjs` transpiles the actual TypeScript source and evaluates it with
explicitly supplied runtime imports. It never loads the application environment
or supplies the Supabase admin client. Webhook requests use invented test secrets,
real signature algorithms and a fake database. Tests must not import real app
clients or add network access to the harness.

The OrdersContext tests supply minimal hook implementations to call its actual
Supabase callbacks. They are not React rendering/scheduling or RLS integration
tests. `npm run build` and `npm run typecheck:api` remain necessary because the
test harness transpiles rather than typechecks sources.

Three tests prefixed `AUDIT GAP` intentionally reproduce unresolved weaknesses.
A passing run means the current behavior is characterized, not that payments
are safe. When those weaknesses are fixed, replace these assertions with tests
requiring rejection or safe no-op behavior. See `PAYMENT_SECURITY_AUDIT.md`.
