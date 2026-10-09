# SQLite in React Native & Flutter: everyday use, weak networks, optimistic updates

::: info
Tags: SQLite · React Native · Flutter · Offline · Optimistic updates  
Related: [RN template features](/guide/rn-template) · [Flutter template features](/guide/flutter-template) · [Zippy (inspect tables)](/guide/zippy)
:::

On mobile, SQLite is not “another key-value store.” It is a **queryable, migratable, transactional** local source of truth. Kippy’s RN template uses `react-native-quick-sqlite`; the Flutter template uses `sqflite`. Both ship a light `app_kv` / logging schema; apps layer entity tables and a sync queue on top.

This post covers three layers: **open & CRUD** → **weak-network cache + outbox** → **optimistic updates that can roll back**.

## 1. Everyday usage on both stacks

### Library comparison

| | React Native (template) | Flutter (template) |
| --- | --- | --- |
| Library | `react-native-quick-sqlite` | `sqflite` |
| Open | `open({ name: 'app.db' })` | `openDatabase(path, version: …)` |
| Execute | Sync `db.execute(sql, args)` | Async `db.execute` / `insert` / `query` |
| Default role | Logs + KV; app adds business tables | `LocalDatabase` singleton + KV; logs may use another DB |

RN’s sync API is fine for short transactions—avoid huge queries on the UI thread. Flutter is `Future`-based; keep schema creation complete in `onCreate` / `onUpgrade`.

### Open & schema (same shape as the templates)

**RN** (`src/services/database.ts` pattern):

```ts
import { open } from 'react-native-quick-sqlite';

export const DB_NAME = 'app.db';

export function getDb() {
  return open({ name: DB_NAME });
}

export async function initDatabase() {
  const db = getDb();
  db.execute(`
    CREATE TABLE IF NOT EXISTS app_kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  // CREATE TABLE IF NOT EXISTS … business tables
}
```

**Flutter** (`LocalDatabase` pattern):

```dart
_db = await openDatabase(
  dbPath,
  version: 1,
  onConfigure: (db) async {
    await db.execute('PRAGMA foreign_keys = ON');
  },
  onCreate: (db, version) async {
    await db.execute('''
      CREATE TABLE app_kv (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    ''');
  },
  // onUpgrade: (db, oldV, newV) async { … }
);
```

### Conventions worth freezing early

1. **Parameterized SQL** — always `?` placeholders.
2. **Serialize values** — JSON for KV / document columns; harden parse failures.
3. **Timestamps** — `INTEGER` epoch ms (or seconds); don’t mix string formats.
4. **Single entry point** — `getDb()` / `LocalDatabase.instance` so Zippy can register the same path.
5. **Versioned migrations** — Flutter `onUpgrade`; RN can keep a `schema_version` table and run scripts.

Simple KV:

```ts
// RN
db.execute(
  'INSERT OR REPLACE INTO app_kv (key, value, updated_at) VALUES (?, ?, ?)',
  [key, JSON.stringify(value), Date.now()],
);
```

```dart
// Flutter
await db.insert('app_kv', {
  'key': key,
  'value': value,
  'updated_at': DateTime.now().millisecondsSinceEpoch,
}, conflictAlgorithm: ConflictAlgorithm.replace);
```

In `__DEV__`, Zippy’s SQLite panel beats `print` for schema and row checks.

---

## 2. Weak networks: local truth + outbound queue

Weak network means the product must stay usable under **disconnect, high latency, and flaky timeouts**. A practical split:

```text
UI / Store
    │
    ▼
Repository  ──read──►  SQLite (entity cache + outbox)
    │                        ▲
    └──write / sync── HTTP ──┘
```

### Two tables are enough to start

**Entity cache** (notes example):

```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY,          -- server id; new locals may use client_id first
  client_id TEXT UNIQUE,        -- UUID at create time; keep after server ack
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  synced_at INTEGER,            -- last successful align; NULL = never synced
  deleted INTEGER NOT NULL DEFAULT 0
);
```

**Outbound queue** (intent, not the only copy of the row):

```sql
CREATE TABLE sync_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT NOT NULL,         -- 'note'
  entity_id TEXT NOT NULL,      -- client_id or server id
  op TEXT NOT NULL,             -- 'create' | 'update' | 'delete'
  payload TEXT NOT NULL,        -- JSON
  created_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  status TEXT NOT NULL DEFAULT 'pending'  -- pending | inflight | failed | done
);
CREATE INDEX idx_outbox_status ON sync_outbox(status, created_at);
```

### Read path: local first, refresh in background

1. Open list → **read SQLite only**, render immediately.
2. If online → fetch delta/full → **upsert in a transaction** → notify UI.
3. On failure → keep local data + soft “offline / not refreshed” — never wipe the list.

```ts
async function loadNotes(): Promise<Note[]> {
  const local = queryNotesFromDb();
  void refreshNotesFromNetwork().catch(() => {/* UI already has local */});
  return local;
}
```

### Write path: commit locally + enqueue

On save:

1. **One transaction**: write `notes` + `INSERT` outbox (avoid “row exists, queue missing”).
2. Update UI immediately.
3. Background `flushOutbox()`: send in `created_at` order; on success mark `done` and write server `id` / `synced_at`; on failure bump `attempts` and back off.

Timeouts can mean “server succeeded, client never saw 200.” Use `client_id` / Idempotency-Key so create is retry-safe—don’t mint a new id each attempt.

### Conflict defaults that are good enough

| Strategy | When |
| -------- | ---- |
| Last-write-wins (`updated_at`) | Single-user notes / drafts |
| Server wins for clean rows; keep dirty local + outbox | Lists, light collaboration |
| Field-level merge | Only with real conflict UI |

Rule: **pending outbox beats blindly overwriting a dirty local row**. If `synced_at < updated_at`, a refresh must not clobber with an older server snapshot.

### SQLite vs MMKV

| Use case | Prefer |
| -------- | ------ |
| Flags, tokens, theme | MMKV |
| Queryable lists, relations, transactions, queues | SQLite |
| One giant JSON blob in a key | Fine early; migrate to tables when lists grow |

---

## 3. Optimistic updates: trust local, then reconcile

Optimistic update = **UI assumes success**, then confirms or rolls back when the network returns. With SQLite, that optimism survives process death—pending state is durable.

### Useful columns

```sql
-- pending | synced | conflict | failed
sync_state TEXT NOT NULL DEFAULT 'synced',
-- snapshot before commit (dirty rows only is fine)
rollback_json TEXT
```

Or rely on outbox: `status = inflight` means “UI already shows the optimistic value.”

### Flow

```text
User action
   │
   ├─1─ TX: update entity (sync_state=pending) + insert outbox
   ├─2─ UI shows new value (optional “syncing” badge)
   ├─3─ HTTP
   │      ├─ OK: sync_state=synced, clear rollback, outbox=done
   │      └─ Fail: rollback entity or keep pending + retry
   └─4─ Notify subscribers (Store / Provider)
```

**RN sketch:**

```ts
function optimisticUpdateNote(id: string, patch: Partial<Note>) {
  const db = getDb();
  const prev = getNote(id);
  db.execute('BEGIN');
  try {
    db.execute(
      `UPDATE notes SET title = ?, body = ?, updated_at = ?, sync_state = 'pending',
        rollback_json = ? WHERE id = ?`,
      [
        patch.title ?? prev.title,
        patch.body ?? prev.body,
        Date.now(),
        JSON.stringify(prev),
        id,
      ],
    );
    db.execute(
      `INSERT INTO sync_outbox (entity, entity_id, op, payload, created_at)
       VALUES ('note', ?, 'update', ?, ?)`,
      [id, JSON.stringify(patch), Date.now()],
    );
    db.execute('COMMIT');
  } catch (e) {
    db.execute('ROLLBACK');
    throw e;
  }
  notifyNotesChanged();
  void flushOutbox();
}
```

**Flutter**: wrap the same steps in `db.transaction((txn) async { … })`.

### UI mapping

| `sync_state` / outbox | UI |
| --------------------- | -- |
| `synced` | Normal |
| `pending` / `inflight` | “Syncing” badge; further edits need a merge policy |
| `failed` | Retry / discard local |
| `conflict` | Show both sides or a resolve flow |

Don’t keep “in flight” only in React state / Provider—after a kill the user may think save succeeded when nothing was enqueued.

### Three hard rules

1. **Entity + outbox in one transaction.**
2. **Rollback needs a snapshot or reversible op**; prefer soft-delete + outbox `delete` over hard delete.
3. **HTTP 200 then local failure is rare**; if flush already succeeded, re-fetch by `client_id` and mark synced to avoid duplicate creates.

---

## 4. Shipping checklist

- [ ] Startup `initDatabase` / `openDatabase`; schema matches `version`  
- [ ] First paint reads SQLite only; network refresh doesn’t block the first frame  
- [ ] Every local write maps to an outbox op  
- [ ] Flush has backoff, idempotency keys, attempt caps, and visible failures  
- [ ] Dirty rows aren’t overwritten by full pulls  
- [ ] `__DEV__`: register the same DB in Zippy and watch outbox growth  

## Takeaways

| Scenario | SQLite’s job |
| -------- | ------------ |
| Everyday | Structured local storage: KV, logs, entities, migrations |
| Weak network | Read cache + outbox; UI not gated on HTTP success |
| Optimistic updates | Mutate locally + enqueue; reconcile or roll back; persist state |

Template `app_kv` is the skeleton; for product data add **entity tables + `sync_outbox`** before inventing CRDTs. Weak network and optimistic UI are the same “local commit, async reconcile” model—clear transaction boundaries matter more than swapping libraries.
