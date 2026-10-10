# Zippy 0.0.6: in-app auto-update

::: info
Tags: Zippy · Auto-update · macOS · Tauri · Releases  
Related: [Zippy inspector](/guide/zippy) · [Download Zippy](/guide/zippy#download) · [Why Zippy exists](/blog/why-zippy)
:::

Packaged Zippy gained in-app updates in **0.0.5**. By **0.0.6** the Check → Download → Restart flow is clearer, with an early path check and readable errors for the common macOS “read-only filesystem” failure. This post covers how to use it, what it depends on, and how to troubleshoot.

## Why in-app update

Zippy ships as a **GitHub Releases** `.dmg`, not npm. Without in-app update you always:

1. Open the docs page or Releases  
2. Download a new DMG  
3. Drag into Applications over the old app  

That gets old fast for a debug tool. In-app update folds discover → download → replace → restart into the app, and **never** downloads on startup—only a version check; you choose when to pull the update.

## How to use it

### Prerequisite: install under `/Applications`

In-app update **replaces** `Zippy.app` in place. You should:

1. Get the DMG from the [docs download section](/guide/zippy#download) or GitHub Releases  
2. Drag **Zippy.app** into **Applications** (`/Applications`)  
3. **Launch from Applications** (not from the DMG, Downloads, or Desktop)

Running from a DMG mount, Downloads, or Desktop will fail at download/install. 0.0.6 tries to catch this before work starts and tells you to move the app to `/Applications` (the underlying error is often `Read-only file system` / `os error 30`).

### Flow: check → download → restart & install

| Step | What happens |
| ---- | ------------ |
| **Startup check** | Packaged builds request `latest.json` quietly—**compare only, no download** |
| **Update available** | A global banner under the mode bar shows the newer version |
| **Download** | Re-checks, then downloads and stages the update (with progress) |
| **Restart & install** | Restarts the app and finishes the replace |

You can dismiss the banner; **Inspector → Device** also has a manual **Check for updates**. Dev mode (`npm run zippy` / `tauri dev`) **skips** the startup check; a manual check often fails without a public signed Release—that is expected.

```text
Launch (packaged)
    │
    ▼
Fetch GitHub latest.json ──check only──► Already latest → no banner
    │
    ▼ Newer version
Banner: Update x.y.z available
    │
    ▼ User clicks Download
Download + verify signature ──progress──► Banner: ready
    │
    ▼ User clicks Restart & install
Restart and replace /Applications/Zippy.app
```

## What it depends on

| Piece | Role |
| ----- | ---- |
| `tauri-plugin-updater` | Check, download, verify, restart-to-install |
| `latest.json` | Published at `…/releases/latest/download/latest.json` with version + artifact URLs |
| minisign signatures | CI signs with `TAURI_SIGNING_PRIVATE_KEY`; the app embeds the public key |
| GitHub Release `zippy-v{version}` | Hosts the `.dmg`, updater artifacts, and JSON |

Bump `@bear1210/zippy` and push to `main` to cut a release. With signing secrets configured, the Release includes updater artifacts and `latest.json`. If signing is skipped, the **DMG still ships**, but in-app update fails for lack of a valid JSON—users can still install from the [docs page](/guide/zippy#download).

The docs site also mirrors the `.dmg` (and `download.json`) when the Releases CDN is hard to reach. **The in-app updater still reads GitHub’s `latest.json`.**

## Common issues

### Banner / check fails

- Network cannot reach `github.com` Releases  
- That Release **did not** publish `latest.json` (signing key missing in CI, or set as a file path instead of the key string)  
- You are on `tauri dev`, not a packaged build  

If the docs DMG download works but in-app update does not, check whether the Release actually has updater assets.

### Download asks you to move into Applications

The running binary is not under `/Applications/Zippy.app`. Quit, open from Applications, then Download again.

### DMG still “damaged”?

That is Gatekeeper / quarantine, separate from updater signatures. From **0.0.3** CI seals a full ad-hoc signature; see [Zippy guide · damaged DMG](/guide/zippy#dmg-says-damaged). First launch may still need **Open Anyway**.

### Architecture

CI currently produces an **Apple Silicon (aarch64)** installer (M1–M4). Intel Macs need a local `npm run zippy:build`; the in-app channel targets that Apple Silicon artifact.

## What 0.0.6 tightens up

| Capability | Notes |
| ---------- | ----- |
| Split check / download | Startup only checks; download is user-triggered |
| Global banner | Visible in every mode, with progress and actions |
| `/Applications` guard | Path check before download turns `os error 30` into an actionable message |
| CI signing secret | Passed as a Secret **string** (not a path) so `latest.json` ships with the Release |

## Takeaways

1. Keep Zippy in **`/Applications`** for day-to-day use  
2. When the banner appears: **Download → Restart & install**  
3. On failure, check network, whether the Release has `latest.json`, and that you launched from Applications  
4. Fallback is always the docs-page DMG  

Full mode docs and probe wiring: [Zippy inspector](/guide/zippy).
