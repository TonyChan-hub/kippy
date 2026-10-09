# SQLite 在 React Native / Flutter：常规用法、弱网与乐观更新

::: info
标签：SQLite · React Native · Flutter · 离线 · 乐观更新  
相关文档：[RN 模板功能](/zh/guide/rn-template) · [Flutter 模板功能](/zh/guide/flutter-template) · [Zippy（Inspector 看库表）](/zh/guide/zippy)
:::

移动端里 SQLite 不是「另一个 key-value」，而是**可查询、可迁移、可事务**的本地真相源。Kippy 的 RN 模板用 `react-native-quick-sqlite`，Flutter 模板用 `sqflite`；两边都先落了一套轻量 `app_kv` / 日志表，业务再往上叠实体表与同步队列。

本文分三块：**常规打开与读写** → **弱网下怎么当缓存/队列** → **乐观更新怎么写得可回滚**。

## 1. 双端常规用法

### 选型对照

| | React Native（模板） | Flutter（模板） |
| --- | --- | --- |
| 库 | `react-native-quick-sqlite` | `sqflite` |
| 打开 | `open({ name: 'app.db' })` | `openDatabase(path, version: …)` |
| 执行 | 同步 `db.execute(sql, args)` | 异步 `db.execute` / `insert` / `query` |
| 典型职责 | 日志表 + KV；业务表由 App 扩展 | `LocalDatabase` 单例 + KV；日志可另库 |

RN 侧同步 API 适合短事务，别在 UI 线程塞大查询；Flutter 侧天然 `Future`，注意在 `onCreate` / `onUpgrade` 里把 schema 一次建齐。

### 打开与建表（与模板同构）

**RN**（`src/services/database.ts` 思路）：

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
  // CREATE TABLE IF NOT EXISTS … 业务表
}
```

**Flutter**（`LocalDatabase` 思路）：

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

### 读写约定（建议固定下来）

1. **参数化查询**：永远 `?` 占位，不要拼字符串。
2. **值序列化**：KV / JSON 列统一 `JSON.stringify` / `jsonEncode`，读失败要有兜底。
3. **时间戳**：存 `INTEGER` 毫秒（或秒），不要混用字符串格式。
4. **单入口**：`getDb()` / `LocalDatabase.instance`，方便 Zippy Inspector 注册同一路径。
5. **迁移用 version**：Flutter 用 `onUpgrade`；RN 可自维护 `schema_version` 表 + 按版本跑迁移脚本。

简单 KV：

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

开发期用 Zippy 的 SQLite 面板核对表结构与行内容，比打 `print` 稳得多。

---

## 2. 弱网：SQLite 当「本地真相 + 出站队列」

弱网不是「少请求几次」，而是产品要在**断线、高延迟、假死**下仍可浏览与提交。常见分层：

```text
UI / Store
    │
    ▼
Repository  ──读──►  SQLite（实体缓存 + 待同步队列）
    │                      ▲
    └──写 / 同步── HTTP ───┘
```

### 两张表就够起步

**实体缓存**（以笔记为例）：

```sql
CREATE TABLE notes (
  id TEXT PRIMARY KEY,          -- 服务端 id；本地新建可用 client_id
  client_id TEXT UNIQUE,        -- 创建时本地 UUID，服务端回写后仍保留
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  synced_at INTEGER,            -- 上次与服务器对齐的时间；NULL = 从未同步成功
  deleted INTEGER NOT NULL DEFAULT 0
);
```

**出站队列**（变更意图，而不是整行快照的唯一来源）：

```sql
CREATE TABLE sync_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity TEXT NOT NULL,         -- 'note'
  entity_id TEXT NOT NULL,      -- client_id 或 server id
  op TEXT NOT NULL,             -- 'create' | 'update' | 'delete'
  payload TEXT NOT NULL,        -- JSON
  created_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  status TEXT NOT NULL DEFAULT 'pending'  -- pending | inflight | failed | done
);
CREATE INDEX idx_outbox_status ON sync_outbox(status, created_at);
```

### 读路径：先本地，再后台刷新

1. 打开列表 → **只读 SQLite**，立刻渲染。
2. 若网络可用 → 拉增量 / 全量 → **事务内 upsert** → 通知 UI。
3. 失败 → 保留本地数据 + 轻提示「离线 / 未刷新」，不要清空列表。

```ts
async function loadNotes(): Promise<Note[]> {
  const local = queryNotesFromDb(); // 同步或短异步
  void refreshNotesFromNetwork().catch(() => {/* 忽略，UI 已有本地 */});
  return local;
}
```

### 写路径：本地提交 + 入队

用户点保存时：

1. **事务**：写 `notes` + `INSERT` outbox（同一事务，避免「表有了、队列丢了」）。
2. 立刻更新 UI。
3. 后台 `flushOutbox()`：按 `created_at` 顺序发请求；成功则标 `done`、回写 server `id` / `synced_at`；失败则 `attempts++`、指数退避。

弱网下 HTTP 可能「超时但服务端已成功」——用 `client_id` / Idempotency-Key 让 create 可重试，别每次生成新 id。

### 冲突与合并（够用的默认）

| 策略 | 适用 |
| ---- | ---- |
| Last-write-wins（比 `updated_at`） | 单用户笔记、草稿 |
| 服务端权威 + 本地未同步改动入队保留 | 列表类、弱协作 |
| 字段级 merge | 成本高，有明确冲突 UI 再上 |

原则：**未 `done` 的 outbox 条目优先于盲目覆盖本地行**。刷新时若发现本地有 `synced_at < updated_at`（脏数据），不要用服务端旧快照盖掉。

### 与 MMKV 怎么分

| 场景 | 放哪 |
| ---- | ---- |
| 开关、token、主题 | MMKV |
| 可查询列表、关联、事务、队列 | SQLite |
| 「整包 JSON 丢进一个 key」 | 早期可以，列表一大就迁表 |

---

## 3. 乐观更新：先信本地，再对账

乐观更新 = **UI 先按「请求会成功」改状态**，网络回来再确认或回滚。SQLite 让「乐观」不只活在内存里——杀进程后仍能恢复 pending 态。

### 推荐字段

在实体表加：

```sql
-- pending | synced | conflict | failed
sync_state TEXT NOT NULL DEFAULT 'synced',
-- 回滚用：提交前快照（可只对 dirty 行存）
rollback_json TEXT
```

或依赖 outbox：`status = inflight` 即「UI 已乐观展示」。

### 流程

```text
用户操作
   │
   ├─1─ 事务：更新实体（sync_state=pending）+ 写入 outbox
   ├─2─ UI 立即显示新值（可带「同步中」角标）
   ├─3─ HTTP
   │      ├─ 成功：sync_state=synced，清 rollback，outbox=done
   │      └─ 失败：按策略回滚实体 或 保持 pending + 重试
   └─4─ 通知订阅者（Store / Provider）
```

**RN 示意（伪代码）：**

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

function rollbackNote(id: string) {
  const row = getNote(id);
  if (!row?.rollback_json) return;
  const prev = JSON.parse(row.rollback_json);
  // 恢复 prev，sync_state = 'failed' 或 'synced'（视产品）
}
```

**Flutter** 用 `db.transaction((txn) async { … })` 包同一逻辑即可。

### UI 怎么表现

| `sync_state` / outbox | UI |
| --------------------- | -- |
| `synced` | 正常 |
| `pending` / `inflight` | 小角标「同步中」；仍可继续编辑（注意合并） |
| `failed` | 可点重试 / 丢弃本地改动 |
| `conflict` | 展示双份或引导解决 |

不要把「请求中」只存在 React state / Provider 里——进程被杀后用户以为保存成功，其实从未入队。

### 乐观更新的三条红线

1. **同一事务写实体 + outbox**，否则会脏读或丢同步。
2. **回滚要有快照或可逆 op**；`delete` 用软删 + 出站 `delete`，硬删很难回滚。
3. **服务端成功但本地事务失败**极少见；若 flush 已 200，应用 `client_id` 再查一次再标 synced，避免重复 create。

---

## 4. 落地检查清单

- [ ] 启动时 `initDatabase` / `openDatabase`，schema 与 `version` 对齐  
- [ ] 列表首屏只依赖 SQLite；网络刷新不阻塞首帧  
- [ ] 所有本地写操作可映射到 outbox op  
- [ ] flush 带退避、幂等键、`attempts` 上限与失败可见  
- [ ] 脏行不被全量拉取覆盖  
- [ ] `__DEV__` 下用 Zippy 注册同一 db，抽查 outbox 是否堆积  

## 小结

| 场景 | SQLite 角色 |
| ---- | ----------- |
| 常规 | 结构化本地存储：KV、日志、业务表、迁移 |
| 弱网 | 读缓存 + 出站队列；UI 不绑在 HTTP 成功上 |
| 乐观更新 | 先改本地并入队，成功对账 / 失败回滚；状态可持久化 |

模板里的 `app_kv` 是最小骨架；上业务时优先加**实体表 + `sync_outbox`**，再谈复杂 CRDT。弱网与乐观更新本质是同一套「本地提交、异步对账」模型——把事务边界画清楚，比换库更重要。
