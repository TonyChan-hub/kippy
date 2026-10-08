import { open } from '@tauri-apps/plugin-dialog';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { escapeHtml, formatBytes } from '../lib/format';
import { apkApi } from '../lib/apk';
import type {
  ApkEntry,
  ApkReport,
  ApkTab,
  ComponentInfo,
  EntryPreview,
  NativeLibCheck,
  SizeAnalysis,
} from '../types/apk';

export type ApkState = {
  report: ApkReport | null;
  tab: ApkTab;
  resourceFilter: string;
  resourceGroup: 'assets' | 'raw' | 'res' | 'lib' | 'dex' | 'meta' | 'all';
  selectedEntry: string | null;
  preview: EntryPreview | null;
  dragOver: boolean;
  busy: boolean;
  error: string | null;
  notice: string | null;
};

export type ApkController = {
  state: ApkState;
  bootstrap: () => Promise<void>;
  render: () => void;
  dispose: () => void;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    if (typeof record.message === 'string') return record.message;
    try {
      return JSON.stringify(error);
    } catch {
      /* ignore */
    }
  }
  return 'Unexpected error';
}

export function createApkState(): ApkState {
  return {
    report: null,
    tab: 'overview',
    resourceFilter: '',
    resourceGroup: 'assets',
    selectedEntry: null,
    preview: null,
    dragOver: false,
    busy: false,
    error: null,
    notice: null,
  };
}

export function mountApkPanel(root: HTMLElement): ApkController {
  const state = createApkState();
  const unsubs: Array<() => void> = [];

  async function loadApk(path: string): Promise<void> {
    state.busy = true;
    state.error = null;
    state.notice = null;
    state.preview = null;
    state.selectedEntry = null;
    render();
    try {
      state.report = await apkApi.analyze(path);
      state.tab = 'overview';
      state.resourceGroup = state.report.resources.assets.length
        ? 'assets'
        : state.report.resources.raw.length
          ? 'raw'
          : 'all';
      state.notice = `Loaded ${state.report.fileName}`;
    } catch (error) {
      state.report = null;
      state.error = errorMessage(error);
    } finally {
      state.busy = false;
      render();
    }
  }

  async function pickApk(): Promise<void> {
    const selected = await open({
      multiple: false,
      title: '选择 APK / AAB',
      filters: [
        {
          name: 'Android Package / Bundle',
          extensions: ['apk', 'aab', 'xapk', 'apkm'],
        },
      ],
    });
    if (typeof selected === 'string' && selected) {
      await loadApk(selected);
    }
  }

  async function unpackApk(): Promise<void> {
    if (!state.report) return;
    const dest = await open({
      directory: true,
      multiple: false,
      title: '选择解包目录',
    });
    if (typeof dest !== 'string' || !dest) return;

    state.busy = true;
    state.error = null;
    state.notice = null;
    render();
    try {
      const result = await apkApi.unpack(state.report.path, dest);
      state.notice = `Unpacked ${result.extracted} files → ${result.dest}${
        result.skipped ? ` (${result.skipped} skipped)` : ''
      }`;
    } catch (error) {
      state.error = errorMessage(error);
    } finally {
      state.busy = false;
      render();
    }
  }

  async function previewEntry(entry: string): Promise<void> {
    if (!state.report) return;
    state.selectedEntry = entry;
    state.busy = true;
    state.error = null;
    render();
    try {
      state.preview = await apkApi.readEntry(state.report.path, entry);
    } catch (error) {
      state.preview = null;
      state.error = errorMessage(error);
    } finally {
      state.busy = false;
      render();
    }
  }

  async function bootstrap(): Promise<void> {
    try {
      const unlisten = await getCurrentWebview().onDragDropEvent((event) => {
        if (event.payload.type === 'enter' || event.payload.type === 'over') {
          if (!state.dragOver) {
            state.dragOver = true;
            syncDropZone();
          }
          return;
        }
        if (event.payload.type === 'leave') {
          state.dragOver = false;
          syncDropZone();
          return;
        }
        if (event.payload.type === 'drop') {
          state.dragOver = false;
          const path = event.payload.paths.find((p) =>
            /\.(apk|aab|xapk|apkm)$/i.test(p),
          );
          if (path) {
            void loadApk(path);
          } else {
            state.error = 'Please drop an .apk / .aab / .xapk / .apkm file';
            render();
          }
        }
      });
      unsubs.push(() => {
        void unlisten();
      });
    } catch {
      /* drag-drop unavailable in browser preview */
    }
    render();
  }

  function syncDropZone(): void {
    const zone = root.querySelector('.apk-dropzone');
    zone?.classList.toggle('is-dragover', state.dragOver);
  }

  function activeResourceGroup(): ApkState['resourceGroup'] {
    return state.tab === 'files' ? 'all' : state.resourceGroup;
  }

  function filteredEntries(group = activeResourceGroup()): ApkEntry[] {
    if (!state.report) return [];
    const res = state.report.resources;
    let list: ApkEntry[] = [];
    switch (group) {
      case 'assets':
        list = res.assets;
        break;
      case 'raw':
        list = res.raw;
        break;
      case 'res':
        list = res.otherRes;
        break;
      case 'lib':
        list = res.nativeLibs;
        break;
      case 'dex':
        list = res.dex;
        break;
      case 'meta':
        list = res.metaInf;
        break;
      default:
        list = state.report.entries;
    }
    const q = state.resourceFilter.trim().toLowerCase();
    if (!q) return list;
    return list.filter((e) => e.path.toLowerCase().includes(q));
  }

  function render(): void {
    const report = state.report;
    root.innerHTML = `
      <div class="apk-shell">
        <aside class="apk-col apk-col-side">
          <div class="tools-col-header">
            <h2>APK Playground</h2>
            <button class="btn" type="button" id="apk-open" ${state.busy ? 'disabled' : ''}>Open…</button>
          </div>
          <div class="tools-panel-body">
            <div class="apk-dropzone ${state.dragOver ? 'is-dragover' : ''}" id="apk-dropzone">
              <strong>Drop APK / AAB here</strong>
              <p>or choose a local .apk / .aab / .xapk / .apkm</p>
            </div>
            ${
              report
                ? `<div class="apk-file-card">
                    <div class="apk-file-name">${escapeHtml(report.fileName)}</div>
                    <div class="muted">${escapeHtml(report.format.toUpperCase())} · ${formatBytes(report.sizeBytes)} · ${report.entryCount} entries</div>
                    <div class="apk-file-path" title="${escapeHtml(report.path)}">${escapeHtml(report.path)}</div>
                    <div class="actions" style="margin-top:10px">
                      <button class="btn primary" type="button" id="apk-unpack" ${state.busy ? 'disabled' : ''}>Unpack…</button>
                      <button class="btn" type="button" id="apk-reload" ${state.busy ? 'disabled' : ''}>Re-analyze</button>
                    </div>
                  </div>`
                : '<div class="empty-inline" style="margin-top:12px">No APK loaded yet.</div>'
            }
            ${state.error ? `<div class="apk-banner apk-banner-error">${escapeHtml(state.error)}</div>` : ''}
            ${state.notice ? `<div class="apk-banner apk-banner-ok">${escapeHtml(state.notice)}</div>` : ''}
          </div>
        </aside>

        <section class="apk-col apk-col-main">
          ${report ? renderTabs() : renderEmptyMain()}
        </section>
      </div>
    `;

    root.querySelector('#apk-open')?.addEventListener('click', () => void pickApk());
    root.querySelector('#apk-dropzone')?.addEventListener('click', () => void pickApk());
    root.querySelector('#apk-unpack')?.addEventListener('click', () => void unpackApk());
    root.querySelector('#apk-reload')?.addEventListener('click', () => {
      if (state.report) void loadApk(state.report.path);
    });

    root.querySelectorAll<HTMLButtonElement>('[data-apk-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.tab = (btn.dataset.apkTab as ApkTab) || 'overview';
        render();
      });
    });

    root.querySelectorAll<HTMLButtonElement>('[data-res-group]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.resourceGroup = (btn.dataset.resGroup as ApkState['resourceGroup']) || 'assets';
        state.selectedEntry = null;
        state.preview = null;
        render();
      });
    });

    root.querySelector('#apk-res-filter')?.addEventListener('input', (event) => {
      state.resourceFilter = (event.target as HTMLInputElement).value;
      const listEl = root.querySelector('#apk-entry-list');
      if (listEl) listEl.innerHTML = renderEntryList(filteredEntries());
      bindEntryClicks();
    });

    bindEntryClicks();
  }

  function bindEntryClicks(): void {
    root.querySelectorAll<HTMLButtonElement>('[data-entry-path]').forEach((btn) => {
      btn.addEventListener('click', () => {
        void previewEntry(btn.dataset.entryPath ?? '');
      });
    });
  }

  function renderEmptyMain(): string {
    return `
      <div class="apk-empty-main">
        <h2>Inspect Android packages</h2>
        <p class="muted">APK and AAB: unpack, 16 KB checks, signing, Manifest, and assets / raw resources.</p>
      </div>`;
  }

  function renderTabs(): string {
    if (!state.report) return renderEmptyMain();
    const tabs: Array<{ id: ApkTab; label: string }> = [
      { id: 'overview', label: 'Overview' },
      { id: 'size', label: 'Size' },
      { id: '16kb', label: '16 KB' },
      { id: 'signing', label: 'Signing' },
      { id: 'manifest', label: 'Manifest' },
      { id: 'resources', label: 'Resources' },
      { id: 'files', label: 'Files' },
    ];
    return `
      <div class="tools-col-header apk-tabs-bar">
        <div class="apk-tabs">
          ${tabs
            .map(
              (t) =>
                `<button class="apk-tab ${state.tab === t.id ? 'is-active' : ''}" type="button" data-apk-tab="${t.id}">${t.label}</button>`,
            )
            .join('')}
        </div>
        ${state.busy ? '<span class="muted">Working…</span>' : ''}
      </div>
      <div class="tools-panel-body apk-main-body">
        ${renderTabBody()}
      </div>`;
  }

  function renderTabBody(): string {
    const report = state.report;
    if (!report) return '';
    switch (state.tab) {
      case 'overview':
        return renderOverview(report);
      case 'size':
        return renderSize(report.sizeAnalysis);
      case '16kb':
        return render16kb(report);
      case 'signing':
        return renderSigning(report);
      case 'manifest':
        return renderManifest(report);
      case 'resources':
        return renderResources(false);
      case 'files':
        return renderResources(true);
      default:
        return '';
    }
  }

  function renderOverview(report: ApkReport): string {
    const s = report.summary;
    const size = report.sizeAnalysis;
    const rows: Array<[string, unknown]> = [
      ['Format', report.format.toUpperCase()],
      ['Package', s.packageName],
      ['Label', s.label],
      ['Version', s.versionName ? `${s.versionName} (${s.versionCode ?? '—'})` : s.versionCode],
      ['Min SDK', s.minSdk],
      ['Target SDK', s.targetSdk],
      ['Compile SDK', s.compileSdk],
      ['Main activity', s.mainActivity],
      ['Debuggable', s.debuggable],
      ['Allow backup', s.allowBackup],
      ['Multidex', s.multidex ? 'yes' : 'no'],
      ['Modules', s.modules?.length ? s.modules.join(', ') : report.format === 'aab' ? '—' : 'n/a'],
      ['ABIs', s.abis.length ? s.abis.join(', ') : '—'],
      ['16 KB', report.page16kb.compatible ? 'compatible' : 'issues found'],
      ['Signing', report.signing.schemes.join(', ') || 'none'],
      ['Permissions', report.manifest.permissions.length],
      ['Assets', report.resources.assets.length],
      ['Raw', report.resources.raw.length],
      ['Native libs', report.resources.nativeLibs.length],
    ];
    return `
      <div class="apk-metric-row">
        <div class="apk-metric">
          <span class="label">混淆百分比</span>
          <strong>${escapeHtml(size.obfuscation.obfuscationPct.toFixed(1))}%</strong>
        </div>
        <div class="apk-metric">
          <span class="label">缩减百分比</span>
          <strong>${escapeHtml(size.obfuscation.shrinkPct.toFixed(1))}%</strong>
        </div>
        <div class="apk-metric">
          <span class="label">DEX 优化分</span>
          <strong>${escapeHtml(size.dex.optimizationScorePct.toFixed(0))}</strong>
          <span class="muted">${size.dex.optimized ? 'optimized' : 'weak'}</span>
        </div>
        <div class="apk-metric">
          <span class="label">ZIP 压缩缩减</span>
          <strong>${escapeHtml(size.zipShrinkPct.toFixed(1))}%</strong>
        </div>
      </div>
      <div class="apk-overview-grid">
        <section class="card">
          <h3>Summary</h3>
          <table class="data-table">
            ${rows
              .map(
                ([k, v]) =>
                  `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v ?? '—')}</td></tr>`,
              )
              .join('')}
          </table>
        </section>
        <section class="card">
          <h3>16 KB status</h3>
          <div class="apk-status-pill ${report.page16kb.compatible ? 'is-ok' : 'is-bad'}">
            ${report.page16kb.compatible ? 'Compatible' : 'Not compatible'}
          </div>
          <p class="hint">${escapeHtml(report.page16kb.summary)}</p>
          <h3 style="margin-top:16px">体积速览</h3>
          <p class="hint">Install ${formatBytes(size.totalUncompressed)} · Download ~${formatBytes(size.totalCompressed)} · File ${formatBytes(size.fileSizeBytes)}</p>
          <div class="apk-size-bars">
            ${size.categories
              .slice(0, 6)
              .map(
                (c) => `
              <div class="apk-size-bar-row">
                <span>${escapeHtml(c.label)}</span>
                <div class="apk-size-bar-track"><div class="apk-size-bar-fill" style="width:${Math.max(2, c.installPct)}%"></div></div>
                <span class="muted">${escapeHtml(c.installPct.toFixed(1))}%</span>
              </div>`,
              )
              .join('')}
          </div>
        </section>
      </div>`;
  }

  function renderSize(size: SizeAnalysis): string {
    const dex = size.dex;
    const obf = size.obfuscation;
    return `
      <div class="apk-metric-row">
        <div class="apk-metric">
          <span class="label">Install size</span>
          <strong>${formatBytes(size.totalUncompressed)}</strong>
        </div>
        <div class="apk-metric">
          <span class="label">Download ~</span>
          <strong>${formatBytes(size.totalCompressed)}</strong>
        </div>
        <div class="apk-metric">
          <span class="label">混淆 %</span>
          <strong>${escapeHtml(obf.obfuscationPct.toFixed(1))}%</strong>
          <span class="muted">${obf.obfuscatedClasses}/${obf.totalClasses} classes</span>
        </div>
        <div class="apk-metric">
          <span class="label">缩减 %</span>
          <strong>${escapeHtml(obf.shrinkPct.toFixed(1))}%</strong>
          <span class="muted">zip ${obf.zipShrinkPct.toFixed(1)}% · code ~${obf.codeShrinkHintPct.toFixed(1)}%</span>
        </div>
      </div>

      <section class="card">
        <div class="card-head">
          <h3>包体积占比</h3>
          <span class="muted">by install size</span>
        </div>
        <div class="apk-size-bars" style="margin-bottom:12px">
          ${size.categories
            .map(
              (c) => `
            <div class="apk-size-bar-row">
              <span title="${escapeHtml(c.id)}">${escapeHtml(c.label)}</span>
              <div class="apk-size-bar-track"><div class="apk-size-bar-fill" style="width:${Math.max(2, c.installPct)}%"></div></div>
              <span class="muted">${escapeHtml(c.installPct.toFixed(1))}%</span>
            </div>`,
            )
            .join('')}
        </div>
        <div class="table-wrap">
          <table class="data-table grid-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Files</th>
                <th>Install</th>
                <th>Install %</th>
                <th>Download</th>
                <th>Download %</th>
              </tr>
            </thead>
            <tbody>
              ${size.categories
                .map(
                  (c) => `<tr>
                    <td>${escapeHtml(c.label)}</td>
                    <td>${escapeHtml(c.fileCount)}</td>
                    <td>${formatBytes(c.uncompressed)}</td>
                    <td>${escapeHtml(c.installPct.toFixed(1))}%</td>
                    <td>${formatBytes(c.compressed)}</td>
                    <td>${escapeHtml(c.downloadPct.toFixed(1))}%</td>
                  </tr>`,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </section>

      <div class="apk-overview-grid" style="margin-top:14px">
        <section class="card">
          <div class="card-head">
            <h3>DEX 代码优化</h3>
            <span class="apk-status-pill ${dex.optimized ? 'is-ok' : 'is-bad'}">
              ${dex.optimized ? 'OPTIMIZED' : 'CHECK'} · ${escapeHtml(dex.optimizationScorePct.toFixed(0))}
            </span>
          </div>
          <table class="data-table">
            <tr><th>DEX files</th><td>${escapeHtml(dex.fileCount)}</td></tr>
            <tr><th>DEX size</th><td>${formatBytes(dex.totalSize)}</td></tr>
            <tr><th>Classes</th><td>${escapeHtml(dex.classes)}</td></tr>
            <tr><th>Methods</th><td>${escapeHtml(dex.methods)}</td></tr>
            <tr><th>Fields</th><td>${escapeHtml(dex.fields)}</td></tr>
            <tr><th>Strings</th><td>${escapeHtml(dex.strings)}</td></tr>
            <tr><th>Debug info</th><td>${dex.hasDebugInfo ? `yes (${dex.debugInfoItems})` : 'stripped'}</td></tr>
          </table>
          <ul class="apk-note-list">
            ${dex.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}
          </ul>
          ${
            dex.files.length
              ? `<div class="table-wrap" style="margin-top:10px"><table class="data-table grid-table">
                  <thead><tr><th>File</th><th>Ver</th><th>Size</th><th>Classes</th><th>Methods</th><th>Debug</th></tr></thead>
                  <tbody>
                    ${dex.files
                      .map(
                        (f) => `<tr>
                          <td class="truncate">${escapeHtml(f.path)}</td>
                          <td>${escapeHtml(f.version)}</td>
                          <td>${formatBytes(f.size)}</td>
                          <td>${escapeHtml(f.classes)}</td>
                          <td>${escapeHtml(f.methods)}</td>
                          <td>${f.hasDebugInfo ? 'yes' : 'no'}</td>
                        </tr>`,
                      )
                      .join('')}
                  </tbody>
                </table></div>`
              : ''
          }
        </section>

        <section class="card">
          <h3>混淆 / 缩减</h3>
          <table class="data-table">
            <tr><th>混淆百分比</th><td><strong>${escapeHtml(obf.obfuscationPct.toFixed(1))}%</strong></td></tr>
            <tr><th>混淆类</th><td>${obf.obfuscatedClasses} / ${obf.totalClasses}</td></tr>
            <tr><th>可读类</th><td>${obf.readableClasses}</td></tr>
            <tr><th>缩减百分比</th><td><strong>${escapeHtml(obf.shrinkPct.toFixed(1))}%</strong></td></tr>
            <tr><th>ZIP 缩减</th><td>${escapeHtml(obf.zipShrinkPct.toFixed(1))}%</td></tr>
            <tr><th>代码缩减估计</th><td>${escapeHtml(obf.codeShrinkHintPct.toFixed(1))}%</td></tr>
          </table>
          <ul class="apk-note-list">
            ${obf.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}
          </ul>
          ${
            obf.samplesObfuscated.length
              ? `<p class="label" style="margin-top:10px">Obfuscated samples</p>
                 <ul class="apk-chip-list">${obf.samplesObfuscated.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>`
              : ''
          }
          ${
            obf.samplesReadable.length
              ? `<p class="label" style="margin-top:10px">Readable samples</p>
                 <ul class="apk-chip-list">${obf.samplesReadable.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>`
              : ''
          }
        </section>
      </div>

      <section class="card" style="margin-top:14px">
        <h3>最大条目 Top ${size.topEntries.length}</h3>
        <div class="table-wrap">
          <table class="data-table grid-table">
            <thead><tr><th>Path</th><th>Category</th><th>Size</th><th>%</th><th>Stored</th></tr></thead>
            <tbody>
              ${size.topEntries
                .map(
                  (e) => `<tr>
                    <td class="truncate" title="${escapeHtml(e.path)}">${escapeHtml(e.path)}</td>
                    <td>${escapeHtml(e.category)}</td>
                    <td>${formatBytes(e.uncompressed)}</td>
                    <td>${escapeHtml(e.installPct.toFixed(1))}%</td>
                    <td>${formatBytes(e.compressed)}</td>
                  </tr>`,
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </section>`;
  }

  function render16kb(report: ApkReport): string {
    const libs = report.page16kb.libraries;
    return `
      <section class="card">
        <div class="card-head">
          <h3>16 KB page-size check</h3>
          <span class="apk-status-pill ${report.page16kb.compatible ? 'is-ok' : 'is-bad'}">
            ${report.page16kb.compatible ? 'PASS' : 'FAIL'}
          </span>
        </div>
        <p class="hint">${escapeHtml(report.page16kb.summary)}</p>
        <p class="hint">Checks ELF PT_LOAD <code>p_align ≥ 16384</code> and ZIP STORED data offset alignment for <code>arm64-v8a</code> / <code>x86_64</code>.</p>
        ${
          libs.length === 0
            ? '<div class="empty-inline">No native libraries.</div>'
            : `<div class="table-wrap"><table class="data-table grid-table">
                <thead>
                  <tr>
                    <th>Library</th>
                    <th>ABI</th>
                    <th>ELF</th>
                    <th>ZIP</th>
                    <th>Max align</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  ${libs.map((lib) => renderLibRow(lib)).join('')}
                </tbody>
              </table></div>`
        }
      </section>`;
  }

  function renderLibRow(lib: NativeLibCheck): string {
    const elf = formatAlignFlag(lib.elfAligned);
    const zip = lib.zipAligned == null ? (lib.compressed ? 'N/A (compressed)' : '—') : formatAlignFlag(lib.zipAligned);
    return `<tr>
      <td class="truncate" title="${escapeHtml(lib.path)}">${escapeHtml(lib.path)}</td>
      <td>${escapeHtml(lib.abi)}</td>
      <td>${elf}</td>
      <td>${zip}</td>
      <td>${lib.maxLoadAlign != null ? escapeHtml(lib.maxLoadAlign) : '—'}</td>
      <td>${lib.notes.map((n) => escapeHtml(n)).join('<br/>') || '—'}</td>
    </tr>`;
  }

  function formatAlignFlag(value?: boolean | null): string {
    if (value == null) return '—';
    return value
      ? '<span class="apk-flag is-ok">aligned</span>'
      : '<span class="apk-flag is-bad">unaligned</span>';
  }

  function renderSigning(report: ApkReport): string {
    const certs = report.signing.certificates;
    return `
      <section class="card">
        <div class="card-head">
          <h3>Signing schemes</h3>
          <span class="muted">${report.signing.schemes.join(', ') || 'none detected'}</span>
        </div>
        ${
          certs.length === 0
            ? '<div class="empty-inline">No certificates parsed.</div>'
            : certs
                .map(
                  (c) => `
              <div class="apk-cert">
                <div class="apk-cert-head">
                  <strong>${escapeHtml(c.scheme)}</strong>
                  <span class="muted">${escapeHtml(c.signatureType)}</span>
                </div>
                <table class="data-table">
                  <tr><th>Subject</th><td>${escapeHtml(c.subject)}</td></tr>
                  <tr><th>Issuer</th><td>${escapeHtml(c.issuer)}</td></tr>
                  <tr><th>Serial</th><td>${escapeHtml(c.serialNumber)}</td></tr>
                  <tr><th>Valid</th><td>${escapeHtml(c.validFrom)} → ${escapeHtml(c.validUntil)}</td></tr>
                  <tr><th>SHA-256</th><td><code>${escapeHtml(c.sha256)}</code></td></tr>
                  <tr><th>SHA-1</th><td><code>${escapeHtml(c.sha1)}</code></td></tr>
                  <tr><th>MD5</th><td><code>${escapeHtml(c.md5)}</code></td></tr>
                </table>
              </div>`,
                )
                .join('')
        }
      </section>`;
  }

  function renderManifest(report: ApkReport): string {
    return `
      <div class="apk-manifest-grid">
        <section class="card">
          <h3>Permissions (${report.manifest.permissions.length})</h3>
          ${
            report.manifest.permissions.length
              ? `<ul class="apk-chip-list">${report.manifest.permissions
                  .map((p) => `<li>${escapeHtml(p)}</li>`)
                  .join('')}</ul>`
              : '<div class="empty-inline">None</div>'
          }
          <h3 style="margin-top:16px">Features (${report.manifest.features.length})</h3>
          ${
            report.manifest.features.length
              ? `<ul class="apk-chip-list">${report.manifest.features
                  .map((p) => `<li>${escapeHtml(p)}</li>`)
                  .join('')}</ul>`
              : '<div class="empty-inline">None</div>'
          }
          ${renderComponentSection('Activities', report.manifest.activities)}
          ${renderComponentSection('Services', report.manifest.services)}
          ${renderComponentSection('Receivers', report.manifest.receivers)}
          ${renderComponentSection('Providers', report.manifest.providers)}
        </section>
        <section class="card">
          <h3>AndroidManifest.xml</h3>
          <pre class="code-block apk-manifest-xml">${escapeHtml(report.manifest.xml || '—')}</pre>
        </section>
      </div>`;
  }

  function renderComponentSection(title: string, items: ComponentInfo[]): string {
    if (!items.length) {
      return `<h3 style="margin-top:16px">${title} (0)</h3><div class="empty-inline">None</div>`;
    }
    return `
      <h3 style="margin-top:16px">${title} (${items.length})</h3>
      <div class="table-wrap"><table class="data-table grid-table">
        <thead><tr><th>Name</th><th>Exported</th><th>Enabled</th><th>Permission</th></tr></thead>
        <tbody>
          ${items
            .map(
              (c) => `<tr>
                <td class="truncate" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</td>
                <td>${escapeHtml(c.exported ?? '—')}</td>
                <td>${escapeHtml(c.enabled ?? '—')}</td>
                <td class="truncate">${escapeHtml(c.permission ?? '—')}</td>
              </tr>`,
            )
            .join('')}
        </tbody>
      </table></div>`;
  }

  function renderResources(forceAll: boolean): string {
    const activeGroup = forceAll ? 'all' : state.resourceGroup;
    const groups: Array<{ id: ApkState['resourceGroup']; label: string; count: number }> = [
      { id: 'assets', label: 'assets', count: state.report?.resources.assets.length ?? 0 },
      { id: 'raw', label: 'raw', count: state.report?.resources.raw.length ?? 0 },
      { id: 'res', label: 'res', count: state.report?.resources.otherRes.length ?? 0 },
      { id: 'lib', label: 'lib', count: state.report?.resources.nativeLibs.length ?? 0 },
      { id: 'dex', label: 'dex', count: state.report?.resources.dex.length ?? 0 },
      { id: 'meta', label: 'META-INF', count: state.report?.resources.metaInf.length ?? 0 },
      { id: 'all', label: 'all', count: state.report?.entries.length ?? 0 },
    ];
    const entries = filteredEntries(activeGroup);
    return `
      <div class="apk-resources-layout">
        <div class="apk-resources-list-pane">
          ${
            forceAll
              ? ''
              : `<div class="apk-subtabs">
            ${groups
              .map(
                (g) =>
                  `<button class="apk-subtab ${activeGroup === g.id ? 'is-active' : ''}" type="button" data-res-group="${g.id}">${g.label} (${g.count})</button>`,
              )
              .join('')}
          </div>`
          }
          <input class="search" id="apk-res-filter" type="search" placeholder="Filter paths" value="${escapeHtml(state.resourceFilter)}" />
          <div id="apk-entry-list">${renderEntryList(entries)}</div>
        </div>
        <div class="apk-resources-preview-pane card">
          <h3>Preview</h3>
          ${renderPreview()}
        </div>
      </div>`;
  }

  function renderEntryList(entries: ApkEntry[]): string {
    if (!entries.length) {
      return '<div class="empty-inline">No matching entries.</div>';
    }
    return `<div class="list">${entries
      .slice(0, 800)
      .map((e) => {
        const active = e.path === state.selectedEntry ? 'is-active' : '';
        return `<button class="list-item ${active}" type="button" data-entry-path="${escapeHtml(e.path)}">
          <span class="truncate">${escapeHtml(e.path)}</span>
          <span class="muted">${formatBytes(e.size)}${e.compressed ? '' : ' · stored'}</span>
        </button>`;
      })
      .join('')}${
      entries.length > 800
        ? `<div class="empty-inline">Showing first 800 of ${entries.length}…</div>`
        : ''
    }</div>`;
  }

  function renderPreview(): string {
    const preview = state.preview;
    if (!state.selectedEntry) {
      return '<div class="empty-inline">Select a file to preview.</div>';
    }
    if (!preview) {
      return '<div class="empty-inline">Loading…</div>';
    }
    const meta = `${formatBytes(preview.size)}${preview.truncated ? ' · truncated' : ''} · ${escapeHtml(preview.contentType)}`;
    if (preview.isText && preview.text != null) {
      return `<div class="muted" style="margin-bottom:8px">${meta}</div><pre class="code-block apk-preview-text">${escapeHtml(preview.text)}</pre>`;
    }
    if (preview.contentType.startsWith('image/') && preview.base64) {
      return `<div class="muted" style="margin-bottom:8px">${meta}</div>
        <img class="apk-preview-image" alt="" src="data:${escapeHtml(preview.contentType)};base64,${preview.base64}" />`;
    }
    return `<div class="muted" style="margin-bottom:8px">${meta}</div>
      <div class="empty-inline">Binary entry — ${formatBytes(preview.size)}. Unpack the APK to inspect on disk.</div>`;
  }

  function dispose(): void {
    for (const off of unsubs) off();
    unsubs.length = 0;
  }

  return { state, bootstrap, render, dispose };
}
