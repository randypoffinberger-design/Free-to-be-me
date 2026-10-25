# Isolated test baseline — 2026-10-24

This branch is rebuilt from production web commit
`57d3c35777b6f77bba759b577e353b8b37f79e11` and is intended only for the
private `/mtm-test/` site.

The application content matches production. The deliberate test-only changes
are limited to:

- default API: `https://svw-production-01.tail96598f.ts.net/mtm-test-api`
- legacy test API migration from `https://randys.tail96598f.ts.net/mtm-test-api`
- build label: `0.10.1-medications-supplements-test-1`
- service-worker cache: `mtm-test-v0.10.1-medications-supplements-test-1`
- test-specific asset query values for the tracker JavaScript and styles

Do not merge this branch into production. Promote a tested feature by applying
its feature commit to `main`, leaving these isolation values behind.

The test site must keep its own database, environment file, credentials, and
service units. None of those runtime files belong in this repository.
