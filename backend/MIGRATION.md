# Migration export → LedgerTrace 2.0

A read-only export of this application's register, so the Django rewrite
(`ledgertrace-py`) can take over mid-year without losing the financial year
recorded here. Nothing in these endpoints writes to Mongo.

## Enabling it

Set a shared secret in `backend/.env` and restart:

```ini
MIGRATION_KEY=<a long random string>
```

With no key configured every endpoint answers **503** — a migration export
that silently defaulted to open would hand the full purchase ledger to anyone
who guessed the path. Requests carry the key in the `x-migration-key` header;
a wrong one is **401**.

The router is mounted *before* the JWT middleware (`server.js`), so the far
side can pull headless, the same way TruFin pulls `/api/loans/facilities`.

## Endpoints

| Endpoint | Returns |
|----------|---------|
| `GET /api/migration/summary?from=&to=` | Counts, stage breakdown, the date span in range |
| `GET /api/migration/suppliers` | The whole supplier directory |
| `GET /api/migration/invoices?from=&to=&page=&limit=` | Invoices, oldest first, paged (default 200, max 1000) |

```bash
curl -H "x-migration-key: $MIGRATION_KEY" \
     "http://localhost:5000/api/migration/summary?from=2026-04-01"
```

`from`/`to` are ISO dates, inclusive, and filter on the **invoice's own date**
(falling back to `receivedDate`, then `createdAt`). They are applied in memory,
not as a Mongo query, for two reasons that both matter:

* `invdate` is free text in two formats — `2026-05-02` when it was typed into
  the form, `02 May 2026` when the GRN sync wrote it;
* `createdAt` is missing on roughly half the collection, which predates the
  schema's timestamps. A `createdAt` query would silently drop those rows —
  the worst possible failure for a migration.

An invoice whose date cannot be read at all is **included** rather than
dropped: importing one the range did not ask for is a smaller problem than
leaving a bill out.

## What the export adds

Every invoice goes out as stored, with three computed fields:

* `source` — `itdose` or `manual`. GRN-synced rows are inserted straight into
  the collection, so they carry no `created` audit entry and keep the API's
  `01 Apr 2026` date format; rows registered by a person go through
  `buildInvoicePayload` and carry the browser's ISO date. A heuristic, not a
  stored flag — it only labels provenance on the far side, never whether a row
  imports.
* `audit` — the audit trail, trimmed to the last 50 entries.
* `auditTruncated` — how many entries that dropped.

## After the cut-over

The endpoints can stay: re-running the import is safe, because the receiving
app identifies an invoice by *(supplier, supplier's invoice no.)* — the same
pair this app enforces on entry — and skips anything already on file. Once the
year has been brought across and verified, clearing `MIGRATION_KEY` turns the
export off again.
