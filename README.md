# Jev — 任務中途調整 reasoning effort 的 Codex 路由器

> More thinking when stuck. Less for routine steps.

一般做法是任務開始前選好模型和 effort；Jev 則在 **Codex 任務進行中、每一次 generation 前**
重新決定 `reasoning.effort`：

- 讀檔、列目錄、建置成功這類例行步驟 → `low`
- 指令失敗、連續失敗、重複同一個失敗指令、累積大量讀檔待綜合 → 升到 `medium` / `high`
- 失敗後恢復成功 → 逐級回落（HIGH → MEDIUM → LOW），不一口氣掉到底

Jev 是夾在 Codex 與上游之間的本地 proxy，**只改寫 `reasoning.effort` 一個欄位**，
`instructions`、`tools`、`input` 位元組不變，所以 prompt cache 前綴維持命中。

```
Jev  LOW  ✓ APPLIED
     Step 1 · next 1 generation(s) · 0 ms · first step
Jev  LOW → MEDIUM  ✓ APPLIED
     Step 2 · next 1 generation(s) · 1 ms · exec failed
Jev  MEDIUM → HIGH  ✓ APPLIED
     Step 3 · next 2 generation(s) · 1 ms · 2 failures in a row
Jev  HIGH → MEDIUM  ✓ APPLIED
     Step 5 · next 1 generation(s) · 0 ms · recovered from failures
```

## 安裝與使用

需求：Node.js ≥ 22（零依賴）、Codex CLI（以 0.164.0 驗證）。

```powershell
cd D:\jev
npm link                 # 取得 `jev-effort` 指令（或直接 node bin/jev.js ...）
jev-effort install              # 寫入 ~/.codex/jev.config.toml（Codex 的 `-p jev` profile）
```

兩種用法：

```powershell
# A. 一鍵：背景啟動 proxy，再執行 codex -p jev
jev-effort codex
jev-effort codex exec "inspect this repo and find bugs"

# B. 想像影片一樣看到即時決策：開兩個視窗
jev-effort serve                # 視窗 1：顯示每一步的 Jev 決策
codex -p jev             # 視窗 2：照常使用 Codex
```

其他：`jev-effort tail` 即時追蹤決策、`jev-effort stats` 統計各 effort 的 generation 數與 reasoning tokens。

`jev.config.toml` 使用 `requires_openai_auth = true`，沿用 Codex 現有登入：
ChatGPT 登入（JWT / `chatgpt-account-id`）轉送至 `chatgpt.com/backend-api/codex`，
API key（`sk-...`）轉送至 `api.openai.com/v1`。Jev 不讀取、不記錄任何憑證。

## 設定（環境變數）

| 變數 | 預設 | 說明 |
|---|---|---|
| `JEV_PORT` / `JEV_HOST` | `8787` / `127.0.0.1` | 監聽位址（改 port 後需重跑 `jev-effort install`） |
| `JEV_LEVELS` | `low,medium,high` | effort 階梯，可用 `minimal`…`xhigh`，例：`low,medium,high,xhigh` |
| `JEV_MODE` | `heuristic` | `heuristic`（0 ms 規則）、`llm`（小模型判官，失敗退回規則）、`off`（純轉送） |
| `JEV_JUDGE_MODEL` | 同請求模型 | `llm` 模式的判官模型 |
| `JEV_JUDGE_TIMEOUT_MS` | `2500` | 判官逾時即退回規則 |
| `JEV_UPSTREAM` | 依憑證自動 | 強制指定上游 base URL |
| `JEV_HOME` | `~/.jev` | `decisions.jsonl`、`proxy.log` 位置 |
| `JEV_QUIET` | — | `1` 則不印決策 |

## 架構

| 檔案 | 職責 |
|---|---|
| `src/trajectory.js` | 從 Responses `input` 擷取本輪（最後一則真人訊息之後）的工具呼叫與成敗 |
| `src/policy.js` | `assess()` 判斷目標 effort；`nextState()` 加上鎖定（hold）與逐級回落 |
| `src/judge.js` | 選用的 LLM 判官 |
| `src/router.js` | 依 `prompt_cache_key` 保存各 session 狀態 |
| `src/proxy.js` | HTTP proxy：解壓（zstd/gzip/br）、改寫 effort、串流回傳、擷取 usage |
| `bin/jev.js` | CLI |

## 限制

- 決策列印在 proxy 視窗，而非 Codex TUI 內（不修改 Codex 本體）。
- 僅支援 HTTP Responses 傳輸；Codex 的 websocket 傳輸不經過 Jev。
- 「省 50% 成本」為原貼文作者的數據；Jev 實際節省幅度請以 `jev-effort stats` 於自身工作量量測。

## 測試

```powershell
npm test     # node --test：policy、trajectory、proxy（含 zstd、judge 退回）
```

## 變更歷史

| 版本 | 日期 | 內容 | 影響範圍 |
|------|------|------|----------|
| v0.1.0 | 2026-10-27 | 初始建立：heuristic/LLM 路由、hysteresis、proxy、CLI、測試；並修正獨立審查所列問題（搜尋無匹配不算失敗、圖片訊息、SSE 背壓、URL 來源檢查、Windows 不經 shell 啟動 codex） | 全部 |
