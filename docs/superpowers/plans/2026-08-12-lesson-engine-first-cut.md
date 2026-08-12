# lesson-engine 第一刀實作計劃

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 做出一條能上真課的路：`course.md` + `blocks/` → `deck.html` + `podium.html`（單檔離線）→ 用它上完一堂 `aigc-comic-p4p6`。

**Architecture:** 三層內容模型（concept / block / course）以 Markdown + YAML front-matter 表示，`parse.mjs` 產出單一 AST，每種 rendition 先跑自己的**前置轉換**（deck：展開 B 類元件、依 profile 剪枝、切頁）再 render。投影片版面沿用 `full_template` 的 Professor Slide Design 與 `deck-stage.js`（1,746 行 Web Component，直接採用不重寫）。所有輸出走內容雜湊快取，單檔模式把 CSS / JS / 字型子集 / 優化後圖片全部內聯。

**Tech Stack:** Node 24（實測 v24.13.1）、ESM `.mjs`、`node:test` + `node:assert`、`js-yaml`、`sharp`（圖片）、`subset-font`（字型）、Playwright（樣式截圖，dev-only）。**不用 Puppeteer**——第一刀不產 PDF。

**規格來源：** `docs/superpowers/specs/2026-08-12-course-system-v2-design.md` §17.1。本計劃只實作該節列舉的範圍。

---

## Global Constraints

這一節的每一條，都隱含在每個 task 的要求裡。

- **語言**：所有程式碼註解、文件、CLI 輸出一律**繁體中文**，專用技術名詞除外。
- **Node**：≥ 22（開發機為 v24.13.1）。ESM only，副檔名一律 `.mjs`。
- **相依**：`js-yaml`、`sharp`、`subset-font` 為 runtime 相依；`playwright` 為 devDependency。**`puppeteer` 不得出現在第一刀的任何相依中**（§16：列為 optional dependency，第一刀不裝）。
- **禁止 Emoji**：所有課程內容、卡片標題、設定檔、CLI 輸出一律不得使用 emoji（沿用舊系統慣例，並由 §6.5 檢查）。
- **無外部執行期相依**：產物中不得出現 `http(s)://` 引用。白名單只有三項：`[youtube]` iframe、內容中明示的外部連結、Colab 連結。**第一刀不實作 `[youtube]` 與 Colab，因此白名單實際為空。**
- **頁碼絕不硬寫**：renderer 產出 `<span class="num"></span>` 空殼，頁碼一律由 JS 依 DOM 位置推導（參考手冊 §14.1 最高優先）。
- **題目 id 為人為指定**：**禁止由題幹推導 id**（舊系統 `build.mjs:685` 的根本缺陷，§5.8 規則 2）。
- **`[notes]` 絕不進學生產物**：只輸出到 `podium.html`，與 profile 無關（§5.4 規則 10）。
- **延遲預算**：`teach` 存檔 → deck 畫面更新 **< 500ms**（§9.1）。
- **資產預算**（§6.7.2）：`deck.single.html` < 8MB（warning），> 16MB `publish` error；單張優化後圖片 < 300KB；字型子集合計 < 800KB。
- **快取可安全刪除**：`rm -rf .cache && npm run build` 的輸出必須與有快取時**逐位元組相同**（§9.8）。
- **測試**：golden-file **只斷言結構**——正規化為「tag + `data-*` + 文字」後比對，**剝掉 class 與 inline style**（§9.5）。
- **commit 頻率**：每個 task 至少一次 commit，訊息用繁體中文，格式 `feat|fix|test|docs: <說明>`。

---

## 開工前必須知道的一件事（實測發現）

規格 §6.2.2 的對映表指定了一批 CSS class，但**它們並不在 `full_template/styles.css` 裡**。實際清點（`styles.css` 1,078 行）：

| class | `styles.css` | 參考手冊 §五 | 例 07 內嵌 style |
|---|---|---|---|
| `.grid-2` `.card` `.compare-tag` `[data-quiz] .quiz-opt` `.assertion` `.slide-meta` `.num` `ol.editorial` | **有** | 有 | — |
| `.tip-box` `.warning-box` `.arrow-flow` `.kpi-grid` `.three-port` `.timer-chip` `.section-hero` `.formula-box` | **無** | **有（含 CSS）** | 部分有 |
| `.compare-table` `.step-track` `.tag-row` | **無** | **無** | **無** |

而 §6.5 把「被引用的每個 class 都有 CSS 定義」列為 **build error**。所以在 renderer 產出這些 class 之前，CSS 必須先存在——這是 Task 3 的內容，也是為什麼 Task 3 排在所有 renderer 之前。最後三個 class（`.compare-table` / `.step-track` / `.tag-row`）在任何來源中都不存在，**必須自己設計**；其中 `.tag-row` 與 `.step-track` 是第一刀要用的（`[tags]` 1 次、`[steps-status]` 1 次）。

---

## 檔案結構

新建 `lesson-engine` repo（**`git init`，不 clone 舊 repo**——§15.1）。

```
lesson-engine/
├── package.json
├── .gitignore                      # dist/ .cache/ *.single.html node_modules/
├── src/
│   ├── parse/
│   │   ├── frontmatter.mjs         # YAML front-matter 切分（js-yaml）
│   │   ├── blocks.mjs              # [xxx]...[/xxx] 元件語法 → AST 節點
│   │   ├── block-file.mjs          # block.md → Block 物件
│   │   ├── course-file.mjs         # course.md → Course 物件
│   │   ├── question-file.mjs       # kb/qbank/*.md → Question 物件
│   │   └── index.mjs               # 組裝：Course + Blocks + Questions → CourseAST
│   ├── transform/
│   │   └── deck.mjs                # 前置轉換：B 類展開、profile 剪枝、切頁
│   ├── renderers/
│   │   ├── deck.mjs                # SlideAST → deck.html
│   │   └── podium.mjs              # SlideAST → podium.html
│   ├── assets/
│   │   ├── images.mjs              # sharp 管線 + 資產預算
│   │   └── fonts.mjs               # subset-font 子集化
│   ├── bundle/
│   │   └── single.mjs              # 單檔內聯（含 </script 跳脫）
│   ├── check/
│   │   └── artifact.mjs            # §6.5 產物檢查
│   ├── cache.mjs                   # §9.8 內容雜湊快取
│   ├── diagnostics.mjs             # §5.12 warning/error 收集器
│   └── cli/
│       ├── build.mjs               # npm run build
│       ├── teach.mjs               # npm run teach（watch + 預覽）
│       └── clean.mjs               # npm run clean
├── design/
│   ├── styles.css                  # 從 full_template 複製
│   ├── components.css              # Task 3：補齊缺的 class
│   └── fonts/                      # 子集化輸出（gitignore）
├── runtime/
│   ├── index.mjs                   # 工具註冊表與 mount 分派
│   ├── quiz.mjs                    # 即時測驗（本機模式）
│   ├── timer.mjs                   # 倒數計時
│   ├── deck-stage.js               # 從 full_template 複製，不修改
│   └── deck-script.js              # 從 full_template 複製，不修改
├── docs/
│   └── slide-semantics.md          # Task 2 的決策文件
└── tests/
    ├── parse/*.test.mjs
    ├── transform/*.test.mjs
    ├── renderers/*.test.mjs
    ├── golden/
    │   ├── normalize.mjs           # 結構正規化（剝 class / style）
    │   └── <case>/{input.md, expected.deck.json, expected.podium.json}
    └── offline/single-file.test.mjs
```

內容放另一個 repo（`lesson-content`），第一刀只需要一門課：

```
lesson-content/
├── courses/aigc-comic-p4p6/{course.md, config.yaml, assets/}
├── blocks/<block-id>/{block.md, assets/}
└── kb/{concepts/*.md, qbank/*.md, media/}
```

---

## 任務相依圖

```
Task 1（骨架）
  └─► Task 2（語意決策 + golden 期望值）
        ├─► Task 3（components.css）
        └─► Task 4（元件語法 parser）
              └─► Task 5（block / course / 壞引用）
                    └─► Task 6（題庫與 [q:] 注入）
                          └─► Task 7（deck 前置轉換）
                                ├─► Task 8（deck renderer）───┐
                                └─► Task 9（podium renderer）─┤
                                                              ▼
Task 10（圖片）· Task 11（字型）───────────────────► Task 12（單檔打包）
                                                              │
                                          Task 13（runtime）───┤
                                                              ▼
                                                    Task 14（產物檢查）
                                                              ▼
                                                    Task 15（teach + 快取）
                                                              ▼
                                                    Task 16（內容搬遷）
                                                              ▼
                                                    Task 17（離線驗收）
```

---

### Task 1: 引擎骨架與測試迴圈

先有一個會跑、會紅、會綠的測試迴圈。後面每個 task 都靠它。

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `src/diagnostics.mjs`
- Test: `tests/diagnostics.test.mjs`

**Interfaces:**
- Consumes: 無（第一個 task）
- Produces: `class Diagnostics` — `add(level, code, message, ctx)`、`get errors()`、`get warnings()`、`hasErrors()`、`toReport()`。`level` 為 `'error' | 'warning'`。所有後續 task 的 parser、transform、renderer 都收一個 `Diagnostics` 實例並往裡面寫，**絕不自己 throw**（§5.12：指向缺漏的東西 → 佔位 + 警示；結構本身壞掉 → 直接擋，由呼叫端依 `hasErrors()` 決定）。

- [ ] **Step 1: 建立 repo 與 package.json**

```bash
mkdir lesson-engine && cd lesson-engine
git init
```

`package.json`：

```json
{
  "name": "lesson-engine",
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": ">=22" },
  "scripts": {
    "test": "node --test tests/",
    "build": "node src/cli/build.mjs",
    "teach": "node src/cli/teach.mjs",
    "clean": "node src/cli/clean.mjs"
  },
  "dependencies": {
    "js-yaml": "^4.1.0",
    "sharp": "^0.34.0",
    "subset-font": "^2.3.0"
  },
  "devDependencies": {
    "playwright": "^1.50.0"
  }
}
```

`.gitignore`：

```
node_modules/
dist/
.cache/
*.single.html
design/fonts/
.env
```

- [ ] **Step 2: 寫失敗的測試**

`tests/diagnostics.test.mjs`：

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Diagnostics } from '../src/diagnostics.mjs';

test('分別收集 error 與 warning', () => {
  const d = new Diagnostics();
  d.add('warning', 'missing-assertion', 'explain 片段缺 assertion', { id: 'explain.a' });
  d.add('error', 'dup-question-id', '題目 id 重複', { id: 'q.a.01' });

  assert.equal(d.warnings.length, 1);
  assert.equal(d.errors.length, 1);
  assert.equal(d.hasErrors(), true);
});

test('沒有 error 時 hasErrors 為 false', () => {
  const d = new Diagnostics();
  d.add('warning', 'x', '只是提醒', {});
  assert.equal(d.hasErrors(), false);
});

test('toReport 輸出可讀的繁體中文報告，含 code 與 context', () => {
  const d = new Diagnostics();
  d.add('error', 'missing-block', '引用不存在的片段', { id: 'explain.nope', from: 'course.md' });

  const report = d.toReport();
  assert.match(report, /錯誤/);
  assert.match(report, /missing-block/);
  assert.match(report, /explain\.nope/);
});
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `npm install && npm test`
Expected: FAIL — `Cannot find module '../src/diagnostics.mjs'`

- [ ] **Step 4: 實作 Diagnostics**

`src/diagnostics.mjs`：

```javascript
/**
 * 診斷收集器。
 *
 * 規格 §5.12：指向缺漏的東西 → 佔位 + 警示；結構本身壞掉 → 直接擋。
 * parser 與 renderer 一律把問題寫進這裡，不自己 throw；
 * 由 CLI 依 hasErrors() 決定要不要中止。
 */
export class Diagnostics {
  #items = [];

  add(level, code, message, ctx = {}) {
    if (level !== 'error' && level !== 'warning') {
      throw new TypeError(`level 只能是 error 或 warning，收到 ${level}`);
    }
    this.#items.push({ level, code, message, ctx });
  }

  get errors() {
    return this.#items.filter((i) => i.level === 'error');
  }

  get warnings() {
    return this.#items.filter((i) => i.level === 'warning');
  }

  hasErrors() {
    return this.errors.length > 0;
  }

  toReport() {
    if (this.#items.length === 0) return '沒有問題。';

    const line = ({ level, code, message, ctx }) => {
      const label = level === 'error' ? '錯誤' : '警告';
      const where = Object.entries(ctx)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ');
      return `[${label}] ${code}：${message}${where ? `（${where}）` : ''}`;
    };

    return [
      ...this.errors.map(line),
      ...this.warnings.map(line),
      '',
      `共 ${this.errors.length} 個錯誤、${this.warnings.length} 個警告。`,
    ].join('\n');
  }
}
```

- [ ] **Step 5: 跑測試確認通過**

Run: `npm test`
Expected: PASS（3 個測試）

- [ ] **Step 6: Commit**

```bash
git add package.json .gitignore src/diagnostics.mjs tests/diagnostics.test.mjs
git commit -m "feat: 引擎骨架與診斷收集器"
```

---

### Task 2: 投影片語意決策與 golden 期望值

這是**設計工作**，不是實作工作（§17.1 明列 2–3 個工作天）。產出兩樣東西：一份人看的決策文件，一份機器看的 golden 期望值。**先寫 golden，再寫 renderer**（§9.5）。

要決定語意的是四個元件：`image-text`（本課用 9 次，最常用）、`summary`（4 次）、`tags`（1 次）、`steps-status`（1 次）。另外兩個（`bonus` 2 次、`vote` 1 次）是 D 類——**不實作，搬遷時就地改寫為課程層概念**。

**Files:**
- Create: `docs/slide-semantics.md`
- Create: `tests/golden/normalize.mjs`
- Create: `tests/golden/image-text/{input.md, expected.deck.json}`
- Create: `tests/golden/summary/{input.md, expected.deck.json}`
- Create: `tests/golden/tags/{input.md, expected.deck.json}`
- Create: `tests/golden/steps-status/{input.md, expected.deck.json}`
- Test: `tests/golden/normalize.test.mjs`

**Interfaces:**
- Consumes: 無
- Produces: `normalizeHtml(html) -> NormalNode` — 把 HTML 正規化為 `{ tag, data, text, children }` 樹，**剝掉 class 與 inline style**。`data` 只保留 `data-*` 屬性（依 key 排序）。`text` 為該節點的直接文字子節點串接後 trim。Task 8、9 的 golden 測試全部經由它比對。

- [ ] **Step 1: 寫決策文件**

`docs/slide-semantics.md`：

```markdown
# 四個元件的投影片語意

規格 §6.2.1 把元件分四類。以下是第一刀要用到的四個未定案元件的決定，
以及決定的理由。改動這份文件等於改動 golden 期望值，兩者必須一起改。

## image-text（A 類，用 9 次，本課最常用）

`[image-text position="left|right" width="N"]` → `.grid-2`。

- `position="left"` → 圖在左欄、文在右欄；`right` 相反。
- `width="45"` → 圖欄佔 45%，即 `grid-template-columns: 45% 1fr`（`position=right` 時反過來）。
- 圖片一律包在 `<figure>` 中，`<img>` 帶 `loading="eager"`（投影片不能延遲載入）。
- **一個 image-text 就是一張投影片的主體**，不與其他元件共用一頁。
  理由：1920×1080 放一張圖加一段文字已經滿了；擠第二個元件會逼出小字。

## summary（C 類，用 4 次）

`[summary]` 在 deck 上**不是**卡片，是**本章結尾單獨一頁的重點列表**。

- 輸出一張 `data-slide-kind="summary"` 的投影片，`.assertion` 為「本章重點」，
  內容為 `ol.editorial`（styles.css 既有）。
- 這張頁**插在該 section 的最後**，不在原本的位置。
  理由：捲動長頁上「總結卡」出現在段落中間是合理的；投影片上，總結必須是段落的終點，
  否則講完總結還要再講三頁，節奏是斷的。
- page / handout（階段二）保留原樣，仍為段落中的卡片。

## tags（C 類，用 1 次）

`[tags]` → `.tag-row` 容器 + 每項一個 `.pill`（`.pill` 在參考手冊 §5.2 已定義）。

- deck 上**純視覺，無互動**（原系統的 tag 可點擊篩選，投影片沒有篩選這回事）。
- 顏色對映：`green→.pill.ok`、`orange→.pill.warn`、`purple→.pill.accent`、`blue→.pill.slate`。
- `.tag-row` 本身在任何來源中都不存在，Task 3 要新寫。

## steps-status（A 類，用 1 次）

`[steps-status]` + `- [done|doing|todo] 標題 | 描述` → `.step-track`。

- 每一步一個 `.step-track-item`，帶 `data-status="done|doing|todo"`。
- **講台頁同步高亮當前步**（§6.2.2），因此 `data-status="doing"` 的項目必須是可被
  JS 依 `[data-status="doing"]` 選到的唯一元素。
- `.step-track` 在任何來源中都不存在，Task 3 要新寫。

## bonus / vote（D 類，不實作）

| 舊寫法 | 新寫法 | 搬遷動作 |
|---|---|---|
| `[bonus title="X"]...[/bonus]` | `### X {level=deep}` + 課程層 `cut: N` | 內容原地展開為 `###` 段落，加 `{level=deep}`；在 `course.md` 對應片段加 `cut` |
| `[vote id= title=]...[/vote]` | 階段三的作品牆評價（§10.5） | 第一刀改為 `[callout type="tip"]` 的口頭舉手提示 |

理由見 §6.2.1：舊系統用元件表達「這是加碼」，新系統用課程編排表達，
語意更準，且自動獲得砍段能力。
```

- [ ] **Step 2: 寫 normalize 的失敗測試**

`tests/golden/normalize.test.mjs`：

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHtml } from './normalize.mjs';

test('剝掉 class 與 inline style，保留 tag 與文字', () => {
  const got = normalizeHtml('<div class="grid-2" style="gap:64px"><p>文字</p></div>');
  assert.deepEqual(got, {
    tag: 'div',
    data: {},
    text: '',
    children: [{ tag: 'p', data: {}, text: '文字', children: [] }],
  });
});

test('保留 data-* 並依 key 排序', () => {
  const got = normalizeHtml('<li data-status="doing" class="x" data-index="2">步驟</li>');
  assert.deepEqual(got.data, { 'data-index': '2', 'data-status': 'doing' });
});

test('同樣的結構、不同的樣式，正規化後相等', () => {
  const a = normalizeHtml('<section class="slide"><h2 class="assertion">主張</h2></section>');
  const b = normalizeHtml('<section class="slide dark" style="color:red"><h2 class="assertion" style="font-size:9px">主張</h2></section>');
  assert.deepEqual(a, b);
});
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `npm test`
Expected: FAIL — `Cannot find module './normalize.mjs'`

- [ ] **Step 4: 實作 normalize**

`tests/golden/normalize.mjs`：

```javascript
/**
 * 把 HTML 正規化為只保留「tag + data-* + 文字」的樹。
 *
 * 規格 §9.5：golden 只斷言結構。剝掉 class 與 inline style，
 * 因為調色、改 padding、換一個 utility class 不應該讓 20 個測試變紅——
 * 那樣的測試會讓人不敢改樣式，最後被整批停用。
 * 樣式由 Playwright 截圖負責（Task 8 Step 9）。
 */
const VOID_TAGS = new Set(['img', 'br', 'hr', 'input', 'meta', 'link', 'source']);

export function normalizeHtml(html) {
  const { node } = parseNode(html.trim(), 0);
  return node;
}

function parseNode(src, pos) {
  const open = /<([a-zA-Z][\w-]*)((?:\s+[^\s=>]+(?:="[^"]*")?)*)\s*(\/?)>/g;
  open.lastIndex = pos;
  const m = open.exec(src);
  if (!m) return { node: null, pos: src.length };

  const [full, tag, attrsRaw, selfClose] = m;
  const node = { tag, data: collectData(attrsRaw), text: '', children: [] };
  let cursor = m.index + full.length;

  if (selfClose || VOID_TAGS.has(tag)) return { node, pos: cursor };

  const closeTag = `</${tag}>`;
  const texts = [];

  while (cursor < src.length) {
    const nextOpen = src.indexOf('<', cursor);
    if (nextOpen === -1) break;

    texts.push(src.slice(cursor, nextOpen));

    if (src.startsWith(closeTag, nextOpen)) {
      cursor = nextOpen + closeTag.length;
      break;
    }
    if (src.startsWith('</', nextOpen)) {
      // 非本層的結束標籤（來源 HTML 不平衡）——停在這裡，交給呼叫端。
      cursor = nextOpen;
      break;
    }

    const child = parseNode(src, nextOpen);
    if (!child.node) break;
    node.children.push(child.node);
    cursor = child.pos;
  }

  node.text = texts.join('').replace(/\s+/g, ' ').trim();
  return { node, pos: cursor };
}

function collectData(attrsRaw) {
  const data = {};
  const attr = /([\w-]+)(?:="([^"]*)")?/g;
  let a;
  while ((a = attr.exec(attrsRaw)) !== null) {
    if (a[1].startsWith('data-')) data[a[1]] = a[2] ?? '';
  }
  return Object.fromEntries(Object.entries(data).sort(([x], [y]) => x.localeCompare(y)));
}
```

- [ ] **Step 5: 跑測試確認通過**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: 寫四個 golden 案例的輸入**

`tests/golden/image-text/input.md`：

```markdown
---
id: explain.demo.kids
type: explain
title: 示範片段
concepts: [demo.concept]
duration: 3
audiences: [kids]
assertion: 講得越清楚，AI 畫得越準
---

[image-text position="left" width="45"]
![流程圖](assets/flow.webp)
好的 Prompt 要講清楚四件事。
[/image-text]
```

`tests/golden/summary/input.md`：

```markdown
---
id: explain.summary.kids
type: explain
title: 帶總結的片段
concepts: [demo.concept]
duration: 2
audiences: [kids]
assertion: 四要素缺一不可
---

先講內容。

[summary]
- 主體要具體
- 風格要指定
[/summary]
```

`tests/golden/tags/input.md`：

```markdown
---
id: explain.tags.kids
type: explain
title: 帶標籤的片段
concepts: [demo.concept]
duration: 1
audiences: [kids]
assertion: 風格詞可以組合
---

[tags]
- green | 寫實
- purple | 動漫
[/tags]
```

`tests/golden/steps-status/input.md`：

```markdown
---
id: demo.steps.kids
type: demo
title: 帶步驟的片段
concepts: [demo.concept]
duration: 2
audiences: [kids]
---

[steps-status]
- [done] 想角色 | 先決定他是誰
- [doing] 寫咒語 | 套四要素公式
- [todo] 生成圖 | 交給 AI
[/steps-status]
```

- [ ] **Step 7: 寫四個 golden 期望值**

這四份 JSON **就是 Task 2 的設計決定**，Task 8 的 renderer 要讓它們變綠。

`tests/golden/image-text/expected.deck.json`：

```json
{
  "tag": "section",
  "data": { "data-block": "explain.demo.kids", "data-slide-kind": "content" },
  "text": "",
  "children": [
    { "tag": "h2", "data": {}, "text": "講得越清楚，AI 畫得越準", "children": [] },
    {
      "tag": "div",
      "data": { "data-component": "image-text", "data-position": "left", "data-width": "45" },
      "text": "",
      "children": [
        {
          "tag": "figure",
          "data": {},
          "text": "",
          "children": [{ "tag": "img", "data": {}, "text": "", "children": [] }]
        },
        { "tag": "div", "data": {}, "text": "好的 Prompt 要講清楚四件事。", "children": [] }
      ]
    },
    {
      "tag": "div",
      "data": {},
      "text": "",
      "children": [{ "tag": "span", "data": {}, "text": "", "children": [] }]
    }
  ]
}
```

`tests/golden/summary/expected.deck.json`（**兩張投影片**——總結被抽到章節結尾，見決策文件）：

```json
[
  {
    "tag": "section",
    "data": { "data-block": "explain.summary.kids", "data-slide-kind": "content" },
    "text": "",
    "children": [
      { "tag": "h2", "data": {}, "text": "四要素缺一不可", "children": [] },
      { "tag": "p", "data": {}, "text": "先講內容。", "children": [] },
      {
        "tag": "div",
        "data": {},
        "text": "",
        "children": [{ "tag": "span", "data": {}, "text": "", "children": [] }]
      }
    ]
  },
  {
    "tag": "section",
    "data": { "data-block": "explain.summary.kids", "data-slide-kind": "summary" },
    "text": "",
    "children": [
      { "tag": "h2", "data": {}, "text": "本章重點", "children": [] },
      {
        "tag": "ol",
        "data": { "data-component": "summary" },
        "text": "",
        "children": [
          { "tag": "li", "data": {}, "text": "主體要具體", "children": [] },
          { "tag": "li", "data": {}, "text": "風格要指定", "children": [] }
        ]
      },
      {
        "tag": "div",
        "data": {},
        "text": "",
        "children": [{ "tag": "span", "data": {}, "text": "", "children": [] }]
      }
    ]
  }
]
```

`tests/golden/tags/expected.deck.json`：

```json
{
  "tag": "section",
  "data": { "data-block": "explain.tags.kids", "data-slide-kind": "content" },
  "text": "",
  "children": [
    { "tag": "h2", "data": {}, "text": "風格詞可以組合", "children": [] },
    {
      "tag": "div",
      "data": { "data-component": "tags" },
      "text": "",
      "children": [
        { "tag": "span", "data": { "data-tone": "green" }, "text": "寫實", "children": [] },
        { "tag": "span", "data": { "data-tone": "purple" }, "text": "動漫", "children": [] }
      ]
    },
    {
      "tag": "div",
      "data": {},
      "text": "",
      "children": [{ "tag": "span", "data": {}, "text": "", "children": [] }]
    }
  ]
}
```

`tests/golden/steps-status/expected.deck.json`（`demo` 無 assertion，依 §6.2.2 用 `title` 頂替）：

```json
{
  "tag": "section",
  "data": { "data-block": "demo.steps.kids", "data-slide-kind": "content" },
  "text": "",
  "children": [
    { "tag": "h2", "data": {}, "text": "帶步驟的片段", "children": [] },
    {
      "tag": "ol",
      "data": { "data-component": "steps-status" },
      "text": "",
      "children": [
        {
          "tag": "li",
          "data": { "data-status": "done" },
          "text": "",
          "children": [
            { "tag": "strong", "data": {}, "text": "想角色", "children": [] },
            { "tag": "span", "data": {}, "text": "先決定他是誰", "children": [] }
          ]
        },
        {
          "tag": "li",
          "data": { "data-status": "doing" },
          "text": "",
          "children": [
            { "tag": "strong", "data": {}, "text": "寫咒語", "children": [] },
            { "tag": "span", "data": {}, "text": "套四要素公式", "children": [] }
          ]
        },
        {
          "tag": "li",
          "data": { "data-status": "todo" },
          "text": "",
          "children": [
            { "tag": "strong", "data": {}, "text": "生成圖", "children": [] },
            { "tag": "span", "data": {}, "text": "交給 AI", "children": [] }
          ]
        }
      ]
    },
    {
      "tag": "div",
      "data": {},
      "text": "",
      "children": [{ "tag": "span", "data": {}, "text": "", "children": [] }]
    }
  ]
}
```

- [ ] **Step 8: Commit**

```bash
git add docs/slide-semantics.md tests/golden/
git commit -m "docs: 四個元件的投影片語意決策與 golden 期望值"
```

---

### Task 3: design/components.css — 補齊缺的 class

§6.5 把「被引用的每個 class 都有 CSS 定義」列為 build **error**，所以 CSS 必須先於 renderer 存在。

**Files:**
- Create: `design/styles.css`（從 `full_template/styles.css` 複製，不修改）
- Create: `design/components.css`
- Create: `src/check/css-classes.mjs`
- Test: `tests/check/css-classes.test.mjs`

**Interfaces:**
- Consumes: 無
- Produces: `collectDefinedClasses(cssText) -> Set<string>`（CSS 中定義過的 class 名，不含 `.`）；`findUndefinedClasses(html, definedClasses) -> string[]`（HTML 用到但 CSS 沒定義的 class，已排序去重）。Task 14 的產物檢查會呼叫這兩個。

- [ ] **Step 1: 複製設計系統基底**

```bash
mkdir -p design runtime
cp ../lesson_system/full_template/styles.css design/styles.css
cp ../lesson_system/full_template/deck-stage.js runtime/deck-stage.js
cp ../lesson_system/full_template/deck-script.js runtime/deck-script.js
```

`design/styles.css` 與兩個 `.js` **一律不修改**（§6.1：直接採用，不重寫）。所有增補寫進 `design/components.css`。

- [ ] **Step 2: 寫失敗的測試**

`tests/check/css-classes.test.mjs`：

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collectDefinedClasses, findUndefinedClasses } from '../../src/check/css-classes.mjs';

test('從 CSS 收集定義過的 class', () => {
  const defined = collectDefinedClasses('.grid-2 { display: grid; }\n.card.tinted { background: #fff; }');
  assert.ok(defined.has('grid-2'));
  assert.ok(defined.has('card'));
  assert.ok(defined.has('tinted'));
});

test('找出 HTML 用到但 CSS 沒定義的 class', () => {
  const defined = collectDefinedClasses('.grid-2 { display: grid; }');
  const missing = findUndefinedClasses('<div class="grid-2 tag-row"><span class="pill">x</span></div>', defined);
  assert.deepEqual(missing, ['pill', 'tag-row']);
});

test('第一刀需要的每個 class 都有 CSS 定義', () => {
  const css = readFileSync('design/styles.css', 'utf8') + readFileSync('design/components.css', 'utf8');
  const defined = collectDefinedClasses(css);

  // 規格 §6.2.2 的對映表，只列第一刀實際會產出的
  const required = [
    'slide', 'dark', 'section-hero', 'assertion', 'focal',
    'slide-header', 'slide-meta', 'num', 'eyebrow', 'caption',
    'grid-2', 'card', 'tinted', 'compare-tag', 'ok', 'bad',
    'tip-box', 'warning-box', 'arrow-flow', 'node', 'arrow',
    'tag-row', 'pill', 'step-track', 'timer-chip', 'editorial',
  ];

  const missing = required.filter((c) => !defined.has(c));
  assert.deepEqual(missing, [], `以下 class 沒有 CSS 定義：${missing.join(', ')}`);
});
```

- [ ] **Step 3: 跑測試確認失敗**

Run: `npm test`
Expected: FAIL — 模組不存在；補上模組後第三個測試仍會列出缺的 class（`section-hero`、`tip-box`、`warning-box`、`arrow-flow`、`tag-row`、`step-track`、`timer-chip` 等）

- [ ] **Step 4: 實作 class 檢查**

`src/check/css-classes.mjs`：

```javascript
/**
 * class 完整性檢查（規格 §6.5：被引用的每個 class 都有 CSS 定義 → error）。
 *
 * 這條之所以是 error 而不是 warning：投影片上一個沒有 CSS 的 class
 * 不會報錯，只會安靜地變成沒有樣式的一坨字——而你是在投影幕上發現的。
 */
export function collectDefinedClasses(cssText) {
  const defined = new Set();
  // 只掃選擇器部分（大括號之前），避免把屬性值裡的字串當成 class
  const withoutBodies = cssText.replace(/\{[^}]*\}/g, ' ');
  for (const m of withoutBodies.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
    defined.add(m[1]);
  }
  return defined;
}

export function findUndefinedClasses(html, definedClasses) {
  const used = new Set();
  for (const m of html.matchAll(/\sclass="([^"]*)"/g)) {
    for (const c of m[1].split(/\s+/)) {
      if (c) used.add(c);
    }
  }
  return [...used].filter((c) => !definedClasses.has(c)).sort();
}
```

- [ ] **Step 5: 寫 components.css**

前八個從參考手冊 `Professor_Slide_Design_設計系統參考.md` 逐字轉錄（§5.11、5.19、5.22、5.25 已含完整 CSS）；最後兩個（`.tag-row`、`.step-track`）在任何來源中都不存在，是新設計。

`design/components.css`：

```css
/* ===================================================================
 * components.css — styles.css 未涵蓋的元件
 *
 * 來源分兩種：
 *   1. 參考手冊 §五 已定義、但沒有進 styles.css 的（逐字轉錄，勿改）
 *   2. 規格 §6.2.2 需要、但任何來源都沒有的（新設計，見 docs/slide-semantics.md）
 * =================================================================== */

/* --- 1. 轉錄自參考手冊 ------------------------------------------ */

/* §5.22 段落英雄標題 */
.section-hero { font-size: 96px; line-height: 1.04; letter-spacing: -0.02em; font-weight: 700; }
.section-hero .focal { color: var(--accent); }

/* §5.19 箭頭流程圖 */
.arrow-flow {
  display: flex; align-items: center; justify-content: center;
  gap: 24px; font-family: var(--ui-font); color: var(--ink-muted);
}
.arrow-flow .node {
  background: #FAF7EF; border: 1px solid var(--cream-line);
  padding: 14px 22px; font-size: 20px; color: var(--ink); font-family: var(--body-font);
}
.arrow-flow .arrow { font-size: 28px; color: var(--ink-faint); }

/* §5.25 提示框與警告框 */
.tip-box {
  background: var(--cream-soft); border-left: 4px solid var(--ok);
  padding: 24px 28px; font-size: 22px; line-height: 1.55;
}
.warning-box {
  background: var(--cream-soft); border-left: 4px solid var(--bad);
  padding: 24px 28px; font-size: 22px; line-height: 1.55;
}
.tip-box .eyebrow, .warning-box .eyebrow { display: block; margin-bottom: 8px; }

/* §5.11 計時器標籤 */
.timer-chip {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--ui-font); font-size: 18px; color: var(--ink-muted);
  border: 1px solid var(--cream-line); border-radius: 999px; padding: 6px 16px;
}

/* §5.2 標籤 */
.pill {
  display: inline-block; font-family: var(--ui-font); font-size: 18px;
  padding: 6px 16px; border-radius: 999px;
  background: var(--cream-soft); color: var(--ink-muted);
}
.pill.ok     { background: var(--ok);     color: #fff; }
.pill.bad    { background: var(--bad);    color: #fff; }
.pill.warn   { background: var(--warn);   color: #fff; }
.pill.accent { background: var(--accent); color: #fff; }
.pill.slate  { background: var(--slate);  color: #fff; }

/* --- 2. 新設計（來源皆無，見 docs/slide-semantics.md） ----------- */

/*
 * .tag-row — [tags] 的容器。
 * deck 上純視覺、無互動：投影片沒有「篩選」這回事。
 */
.tag-row { display: flex; flex-wrap: wrap; gap: 12px 14px; align-items: center; }

/*
 * .step-track — [steps-status] 的步驟軌。
 * data-status="doing" 必須是唯一可被 JS 選到的當前步（講台頁靠它同步高亮）。
 */
.step-track { list-style: none; padding: 0; display: grid; gap: 16px; }
.step-track > li {
  display: grid; grid-template-columns: auto 1fr; gap: 4px 20px;
  align-items: baseline; padding-left: 28px; position: relative;
}
.step-track > li::before {
  content: ''; position: absolute; left: 0; top: 12px;
  width: 14px; height: 14px; border-radius: 50%;
  border: 2px solid var(--cream-line); background: transparent;
}
.step-track > li[data-status="done"]::before  { background: var(--ok);     border-color: var(--ok); }
.step-track > li[data-status="doing"]::before { background: var(--accent); border-color: var(--accent); }
.step-track > li[data-status="todo"]::before  { background: transparent;   border-color: var(--ink-faint); }
.step-track > li strong { font-size: 26px; }
.step-track > li span   { font-size: 20px; color: var(--ink-muted); grid-column: 2; }
```

- [ ] **Step 6: 跑測試確認通過**

Run: `npm test`
Expected: PASS

如果第三個測試仍列出缺的 class，代表 `styles.css` 也沒有它（例如 `--warn` 這類 token）。**不要把 class 從 required 清單刪掉**——那是在關掉檢查。補進 `components.css`。

- [ ] **Step 7: Commit**

```bash
git add design/ runtime/deck-stage.js runtime/deck-script.js src/check/css-classes.mjs tests/check/
git commit -m "feat: 補齊 §6.2.2 對映表需要但 styles.css 缺少的 class"
```

---

### Task 4: 元件語法 parser → AST

`[xxx attr="v"]...[/xxx]` 是自訂 DSL，通用 Markdown parser 幫不上忙（§16）。

**Files:**
- Create: `src/parse/frontmatter.mjs`
- Create: `src/parse/blocks.mjs`
- Test: `tests/parse/frontmatter.test.mjs`
- Test: `tests/parse/blocks.test.mjs`

**Interfaces:**
- Consumes: `Diagnostics`（Task 1）
- Produces:
  - `splitFrontmatter(text, diag, ctx) -> { meta: object, body: string }` — front-matter 解析失敗時寫入 `error` 並回傳 `{ meta: {}, body: text }`（§5.12：結構壞掉 → 擋）
  - `parseComponents(body, diag, ctx) -> Node[]` — `Node` 為 `{ type, attrs, items?, children?, text? }`。`type` 取值：`'paragraph' | 'heading' | 'image-text' | 'callout' | 'summary' | 'tags' | 'steps-status' | 'flow' | 'compare' | 'quiz-ref' | 'notes' | 'image'`。`heading` 節點帶 `{ level, text, attrs }`（`attrs` 來自 `{level=deep concepts=x.y}`）。

- [ ] **Step 1: 寫 front-matter 的失敗測試**

`tests/parse/frontmatter.test.mjs`：

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitFrontmatter } from '../../src/parse/frontmatter.mjs';
import { Diagnostics } from '../../src/diagnostics.mjs';

test('切出 front-matter 與 body', () => {
  const diag = new Diagnostics();
  const { meta, body } = splitFrontmatter(
    '---\nid: explain.a\nduration: 4\n---\n\n內文第一行。\n',
    diag,
    { file: 'block.md' },
  );

  assert.equal(meta.id, 'explain.a');
  assert.equal(meta.duration, 4);
  assert.equal(body.trim(), '內文第一行。');
  assert.equal(diag.hasErrors(), false);
});

test('front-matter 解析失敗記為 error，不 throw', () => {
  const diag = new Diagnostics();
  const { meta } = splitFrontmatter('---\nid: [未閉合\n---\n內文\n', diag, { file: 'bad.md' });

  assert.deepEqual(meta, {});
  assert.equal(diag.hasErrors(), true);
  assert.equal(diag.errors[0].code, 'frontmatter-parse-failed');
});

test('沒有 front-matter 時記為 error', () => {
  const diag = new Diagnostics();
  splitFrontmatter('直接就是內文\n', diag, { file: 'no-fm.md' });
  assert.equal(diag.errors[0].code, 'frontmatter-missing');
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/parse/frontmatter.test.mjs`
Expected: FAIL — 模組不存在

- [ ] **Step 3: 實作 front-matter**

`src/parse/frontmatter.mjs`：

```javascript
import yaml from 'js-yaml';

/**
 * 切出 YAML front-matter 與 body。
 *
 * 規格 §15.2：不帶舊系統的自寫 YAML 解析器（已知缺陷：不支援行內註解、
 * 巢狀陣列會解析錯誤），改用 js-yaml。
 * 規格 §5.12：front-matter 解析失敗屬「結構壞掉」，兩者皆擋。
 */
const FM = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function splitFrontmatter(text, diag, ctx = {}) {
  const m = FM.exec(text);
  if (!m) {
    diag.add('error', 'frontmatter-missing', '檔案開頭沒有 front-matter', ctx);
    return { meta: {}, body: text };
  }

  let meta;
  try {
    meta = yaml.load(m[1]) ?? {};
  } catch (err) {
    diag.add('error', 'frontmatter-parse-failed', `YAML 解析失敗：${err.message}`, ctx);
    return { meta: {}, body: text.slice(m[0].length) };
  }

  if (typeof meta !== 'object' || Array.isArray(meta)) {
    diag.add('error', 'frontmatter-parse-failed', 'front-matter 必須是物件', ctx);
    return { meta: {}, body: text.slice(m[0].length) };
  }

  return { meta, body: text.slice(m[0].length) };
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `node --test tests/parse/frontmatter.test.mjs`
Expected: PASS

- [ ] **Step 5: 寫元件語法的失敗測試**

`tests/parse/blocks.test.mjs`：

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseComponents } from '../../src/parse/blocks.mjs';
import { Diagnostics } from '../../src/diagnostics.mjs';

const parse = (src) => {
  const diag = new Diagnostics();
  return { nodes: parseComponents(src, diag, { file: 't.md' }), diag };
};

test('解析 image-text 的屬性與內容', () => {
  const { nodes } = parse(
    '[image-text position="left" width="45"]\n![流程圖](assets/flow.webp)\n說明文字。\n[/image-text]',
  );
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].type, 'image-text');
  assert.deepEqual(nodes[0].attrs, { position: 'left', width: '45' });
  assert.equal(nodes[0].image.src, 'assets/flow.webp');
  assert.equal(nodes[0].image.alt, '流程圖');
  assert.equal(nodes[0].text, '說明文字。');
});

test('解析 steps-status 的三種狀態', () => {
  const { nodes } = parse(
    '[steps-status]\n- [done] 想角色 | 先決定他是誰\n- [doing] 寫咒語 | 套公式\n[/steps-status]',
  );
  assert.deepEqual(nodes[0].items, [
    { status: 'done', title: '想角色', desc: '先決定他是誰' },
    { status: 'doing', title: '寫咒語', desc: '套公式' },
  ]);
});

test('解析 tags 的色調', () => {
  const { nodes } = parse('[tags]\n- green | 寫實\n- purple | 動漫\n[/tags]');
  assert.deepEqual(nodes[0].items, [
    { tone: 'green', label: '寫實' },
    { tone: 'purple', label: '動漫' },
  ]);
});

test('解析 [q:] 為題目引用', () => {
  const { nodes } = parse('[q:q.prompt.four-elements.01]');
  assert.equal(nodes[0].type, 'quiz-ref');
  assert.equal(nodes[0].id, 'q.prompt.four-elements.01');
});

test('### 標題帶 {level= concepts=} 屬性', () => {
  const { nodes } = parse('### 加碼：negative prompt {level=deep concepts=prompt.negative}');
  assert.equal(nodes[0].type, 'heading');
  assert.equal(nodes[0].level, 3);
  assert.equal(nodes[0].text, '加碼：negative prompt');
  assert.deepEqual(nodes[0].attrs, { level: 'deep', concepts: 'prompt.negative' });
});

test('notes 未閉合是 error（結構壞掉，兩者皆擋）', () => {
  const { diag } = parse('[notes]\n這段沒有關\n');
  assert.equal(diag.hasErrors(), true);
  assert.equal(diag.errors[0].code, 'unclosed-component');
});

test('未知元件輸出佔位並警告，不中斷', () => {
  const { nodes, diag } = parse('[accordion]\n- 項目\n[/accordion]');
  assert.equal(nodes[0].type, 'placeholder');
  assert.equal(nodes[0].name, 'accordion');
  assert.equal(diag.hasErrors(), false);
  assert.equal(diag.warnings[0].code, 'component-not-implemented');
});
```

- [ ] **Step 6: 跑測試確認失敗**

Run: `node --test tests/parse/blocks.test.mjs`
Expected: FAIL — 模組不存在

- [ ] **Step 7: 實作元件語法 parser**

`src/parse/blocks.mjs`：

```javascript
/**
 * 元件語法 → AST 節點。
 *
 * 規格 §17.1：第一刀只實作 aigc-comic-p4p6 實際用到的 10 種，
 * 其中 bonus / vote 是 D 類（搬遷時就地改寫，不實作），
 * 因此 parser 認得 8 種 + [q:] + [notes] + 標題 + 段落 + 圖片。
 * 其餘元件語法遇到即輸出佔位並警告（§17.1）。
 */
const KNOWN = new Set([
  'image-text', 'callout', 'summary', 'tags', 'steps-status', 'flow', 'compare', 'notes',
]);

const OPEN = /^\[([a-z][a-z-]*)((?:\s+[a-z-]+="[^"]*")*)\]\s*$/;
const QUIZ_REF = /^\[q:([^\]]+)\]\s*$/;
const HEADING = /^(#{1,4})\s+(.+?)(?:\s*\{([^}]*)\})?\s*$/;
const IMAGE = /^!\[([^\]]*)\]\(([^)]+)\)\s*$/;

export function parseComponents(body, diag, ctx = {}) {
  const lines = body.split(/\r?\n/);
  const nodes = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') { i += 1; continue; }

    const quiz = QUIZ_REF.exec(line.trim());
    if (quiz) {
      nodes.push({ type: 'quiz-ref', id: quiz[1].trim() });
      i += 1;
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      nodes.push({
        type: 'heading',
        level: heading[1].length,
        text: heading[2].trim(),
        attrs: parseBraceAttrs(heading[3]),
      });
      i += 1;
      continue;
    }

    const img = IMAGE.exec(line.trim());
    if (img) {
      nodes.push({ type: 'image', alt: img[1], src: img[2] });
      i += 1;
      continue;
    }

    const open = OPEN.exec(line.trim());
    if (open) {
      const name = open[1];
      const close = `[/${name}]`;
      const end = lines.findIndex((l, k) => k > i && l.trim() === close);

      if (end === -1) {
        diag.add('error', 'unclosed-component', `[${name}] 沒有對應的 ${close}`, { ...ctx, line: i + 1 });
        i += 1;
        continue;
      }

      const inner = lines.slice(i + 1, end);
      nodes.push(
        KNOWN.has(name)
          ? buildKnown(name, parseAttrs(open[2]), inner)
          : placeholder(name, diag, ctx, i),
      );
      i = end + 1;
      continue;
    }

    // 其餘視為段落，連續非空行合併
    const start = i;
    while (i < lines.length && lines[i].trim() !== '' && !OPEN.test(lines[i].trim())
           && !HEADING.test(lines[i]) && !QUIZ_REF.test(lines[i].trim())) {
      i += 1;
    }
    const text = lines.slice(start, i).join(' ').trim();
    if (text) nodes.push({ type: 'paragraph', text });
  }

  return nodes;
}

function placeholder(name, diag, ctx, lineIndex) {
  diag.add(
    'warning',
    'component-not-implemented',
    `[${name}] 在第一刀尚未實作，輸出佔位框`,
    { ...ctx, line: lineIndex + 1 },
  );
  return { type: 'placeholder', name };
}

function buildKnown(name, attrs, inner) {
  const text = inner.filter((l) => l.trim() && !IMAGE.test(l.trim())).join(' ').trim();

  switch (name) {
    case 'image-text': {
      const imgLine = inner.map((l) => IMAGE.exec(l.trim())).find(Boolean);
      return {
        type: 'image-text',
        attrs,
        image: imgLine ? { alt: imgLine[1], src: imgLine[2] } : null,
        text,
      };
    }
    case 'steps-status':
      return {
        type: 'steps-status',
        attrs,
        items: inner.map((l) => /^-\s*\[(done|doing|todo)\]\s*(.+?)\s*\|\s*(.+)$/.exec(l.trim()))
          .filter(Boolean)
          .map((m) => ({ status: m[1], title: m[2], desc: m[3] })),
      };
    case 'tags':
      return {
        type: 'tags',
        attrs,
        items: inner.map((l) => /^-\s*(\w+)\s*\|\s*(.+)$/.exec(l.trim()))
          .filter(Boolean)
          .map((m) => ({ tone: m[1], label: m[2] })),
      };
    case 'summary':
      return { type: 'summary', attrs, items: bullets(inner) };
    case 'flow':
      return { type: 'flow', attrs, items: bullets(inner) };
    case 'compare':
      return {
        type: 'compare',
        attrs,
        items: inner.map((l) => /^-\s*(.+?)\s*\|\s*(.+)$/.exec(l.trim()))
          .filter(Boolean)
          .map((m) => ({ left: m[1], right: m[2] })),
      };
    case 'callout':
      return { type: 'callout', attrs, text };
    case 'notes':
      return { type: 'notes', text: inner.join('\n').trim() };
    default:
      return { type: 'placeholder', name };
  }
}

const bullets = (lines) =>
  lines.map((l) => /^-\s*(.+)$/.exec(l.trim())).filter(Boolean).map((m) => m[1].trim());

function parseAttrs(raw) {
  const attrs = {};
  for (const m of (raw ?? '').matchAll(/([a-z-]+)="([^"]*)"/g)) attrs[m[1]] = m[2];
  return attrs;
}

function parseBraceAttrs(raw) {
  const attrs = {};
  for (const m of (raw ?? '').matchAll(/([a-z-]+)=([^\s}]+)/g)) attrs[m[1]] = m[2];
  return attrs;
}
```

- [ ] **Step 8: 跑測試確認通過**

Run: `npm test`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/parse/ tests/parse/
git commit -m "feat: front-matter 與元件語法 parser"
```

---

### Task 5: block / course 解析與壞引用處理

**Files:**
- Create: `src/parse/block-file.mjs`
- Create: `src/parse/course-file.mjs`
- Create: `src/parse/index.mjs`
- Test: `tests/parse/course.test.mjs`

**Interfaces:**
- Consumes: `splitFrontmatter`、`parseComponents`（Task 4）、`Diagnostics`（Task 1）
- Produces:
  - `parseBlockFile(text, diag, ctx) -> Block` — `Block = { id, type, title, concepts[], duration, audiences[], assertion, nodes[] }`
  - `parseCourseFile(text, diag, ctx) -> Course` — `Course = { slug, title, profile, duration, tools[], objectives{}, sections[] }`；`sections[] = { title, time, lo[], blocks[] }`；`blocks[] = { id, cut }`（字串寫法正規化為物件，`cut` 預設 `null`）
  - `buildCourseAst({ course, blocks, questions }, diag) -> CourseAst` — `CourseAst = { course, sections: [{ ...section, blocks: [Block|PlaceholderBlock] }] }`。引用不存在的 block 時放入 `{ type: 'missing-block', id }` 佔位（§5.12）

- [ ] **Step 1: 寫失敗的測試**

`tests/parse/course.test.mjs`：

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBlockFile } from '../../src/parse/block-file.mjs';
import { parseCourseFile } from '../../src/parse/course-file.mjs';
import { buildCourseAst } from '../../src/parse/index.mjs';
import { Diagnostics } from '../../src/diagnostics.mjs';

const COURSE = `---
slug: demo
title: 示範課
profile: kids
duration: 60
tools: [quiz, timer]
objectives:
  LO1:
    text: 能說出四要素
    bloom: recall
    concepts: [prompt.four-elements]
sections:
  - title: 咒語篇
    time: 18
    lo: [LO1]
    blocks:
      - explain.a
      - block: explain.b
        cut: 2
---
`;

test('blocks 的字串與物件寫法都正規化為物件', () => {
  const diag = new Diagnostics();
  const course = parseCourseFile(COURSE, diag, { file: 'course.md' });

  assert.deepEqual(course.sections[0].blocks, [
    { id: 'explain.a', cut: null },
    { id: 'explain.b', cut: 2 },
  ]);
  assert.equal(course.profile, 'kids');
  assert.deepEqual(course.tools, ['quiz', 'timer']);
});

test('explain 缺 assertion 是 warning，不是 error', () => {
  const diag = new Diagnostics();
  parseBlockFile(
    '---\nid: explain.a\ntype: explain\ntitle: 標題\nconcepts: [c.a]\nduration: 3\n---\n\n內文。\n',
    diag,
    { file: 'block.md' },
  );

  assert.equal(diag.hasErrors(), false);
  assert.equal(diag.warnings.some((w) => w.code === 'missing-assertion'), true);
});

test('demo 缺 assertion 不警告', () => {
  const diag = new Diagnostics();
  parseBlockFile(
    '---\nid: demo.a\ntype: demo\ntitle: 標題\nconcepts: [c.a]\nduration: 3\n---\n\n內文。\n',
    diag,
    { file: 'block.md' },
  );
  assert.equal(diag.warnings.length, 0);
});

test('引用不存在的片段 → 佔位 + 警示，不中斷', () => {
  const diag = new Diagnostics();
  const course = parseCourseFile(COURSE, diag, { file: 'course.md' });
  const ast = buildCourseAst({ course, blocks: new Map(), questions: new Map() }, diag);

  assert.equal(ast.sections[0].blocks[0].type, 'missing-block');
  assert.equal(ast.sections[0].blocks[0].id, 'explain.a');
  assert.equal(diag.hasErrors(), false);
  assert.equal(diag.warnings.some((w) => w.code === 'missing-block'), true);
});

test('section time 與 duration 加總差距超過 20% 時警告', () => {
  const diag = new Diagnostics();
  const course = parseCourseFile(COURSE, diag, { file: 'course.md' });
  const blocks = new Map([
    ['explain.a', { id: 'explain.a', type: 'explain', duration: 20, concepts: [], nodes: [] }],
    ['explain.b', { id: 'explain.b', type: 'explain', duration: 20, concepts: [], nodes: [] }],
  ]);

  buildCourseAst({ course, blocks, questions: new Map() }, diag);
  assert.equal(diag.warnings.some((w) => w.code === 'time-mismatch'), true);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/parse/course.test.mjs`
Expected: FAIL — 模組不存在

- [ ] **Step 3: 實作 block-file**

`src/parse/block-file.mjs`：

```javascript
import { splitFrontmatter } from './frontmatter.mjs';
import { parseComponents } from './blocks.mjs';

/**
 * block.md → Block。
 *
 * 規格 §5.4 規則 5：assertion 僅 explain 型必填，
 * 且 build 時為 warning（投影片以 title 暫代）、publish 時才是 error。
 */
export function parseBlockFile(text, diag, ctx = {}) {
  const { meta, body } = splitFrontmatter(text, diag, ctx);

  const block = {
    id: meta.id ?? null,
    type: meta.type ?? 'explain',
    title: meta.title ?? '',
    concepts: meta.concepts ?? [],
    duration: meta.duration ?? 0,
    audiences: meta.audiences ?? [],
    assertion: meta.assertion ?? null,
    nodes: parseComponents(body, diag, { ...ctx, id: meta.id }),
  };

  if (!block.id) {
    diag.add('error', 'missing-block-id', '片段沒有 id', ctx);
  }
  if (block.type === 'explain' && !block.assertion) {
    diag.add('warning', 'missing-assertion', 'explain 片段缺 assertion，投影片改用 title', {
      ...ctx, id: block.id,
    });
  }

  return block;
}
```

- [ ] **Step 4: 實作 course-file**

`src/parse/course-file.mjs`：

```javascript
import { splitFrontmatter } from './frontmatter.mjs';

/**
 * course.md → Course。
 *
 * 規格 §5.5 規則 1：blocks 支援字串或物件兩種寫法，此處一律正規化為物件。
 * 規則 2：cut 是課程層屬性，不是片段屬性。
 */
export function parseCourseFile(text, diag, ctx = {}) {
  const { meta } = splitFrontmatter(text, diag, ctx);

  const course = {
    slug: meta.slug ?? null,
    title: meta.title ?? '',
    profile: meta.profile ?? 'adult',
    duration: meta.duration ?? 0,
    tools: meta.tools ?? [],
    objectives: meta.objectives ?? {},
    sections: (meta.sections ?? []).map((s) => ({
      title: s.title ?? '',
      time: s.time ?? 0,
      lo: s.lo ?? [],
      blocks: (s.blocks ?? []).map(normalizeBlockRef),
    })),
  };

  if (!course.slug) diag.add('error', 'missing-course-slug', 'course.md 沒有 slug', ctx);

  return course;
}

function normalizeBlockRef(entry) {
  if (typeof entry === 'string') return { id: entry, cut: null };
  return { id: entry.block, cut: entry.cut ?? null };
}
```

- [ ] **Step 5: 實作組裝**

`src/parse/index.mjs`：

```javascript
/**
 * Course + Blocks + Questions → CourseAst。
 *
 * 規格 §5.12：引用不存在的片段 → 產出佔位頁（紅框 + id）+ 講台頁警示，
 * build 不中斷。這是為了讓你在講台上還能繼續上課。
 */
export function buildCourseAst({ course, blocks, questions }, diag) {
  const sections = course.sections.map((section) => {
    const resolved = section.blocks.map((ref) => {
      const block = blocks.get(ref.id);
      if (!block) {
        diag.add('warning', 'missing-block', `引用了不存在的片段 ${ref.id}`, {
          course: course.slug, section: section.title,
        });
        return { type: 'missing-block', id: ref.id, cut: ref.cut };
      }
      return { ...block, cut: ref.cut };
    });

    checkSectionTime(section, resolved, diag, course.slug);
    return { ...section, blocks: resolved };
  });

  return { course, sections, questions };
}

/**
 * 規格 §5.5 規則 6：time 與 duration 加總不一致時 time 為準，
 * 差距超過 20% 時警告。老師的編排意圖優先於片段的預估。
 */
function checkSectionTime(section, resolvedBlocks, diag, slug) {
  const sum = resolvedBlocks.reduce((n, b) => n + (b.duration ?? 0), 0);
  if (!section.time || !sum) return;

  const drift = Math.abs(sum - section.time) / section.time;
  if (drift > 0.2) {
    diag.add('warning', 'time-mismatch',
      `本章預估 ${sum} 分、排 ${section.time} 分`,
      { course: slug, section: section.title });
  }
}
```

- [ ] **Step 6: 跑測試確認通過**

Run: `npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/parse/ tests/parse/
git commit -m "feat: block 與 course 解析，含壞引用佔位與時間漂移警告"
```

---

### Task 6: 題庫解析與 `[q:]` 注入

這裡有第一刀最重要的一條防線：**題目 id 為人為指定，禁止由題幹推導**（§5.8 規則 2）。舊系統 `build.mjs:685` 取題幹前 20 字當 id，導致改一個字就換 id、開頭相同就碰撞——課後個人練習的整條路被這件事堵死。

**Files:**
- Create: `src/parse/question-file.mjs`
- Modify: `src/parse/index.mjs`（`buildCourseAst` 中解析 `quiz-ref`）
- Test: `tests/parse/question.test.mjs`

**Interfaces:**
- Consumes: `splitFrontmatter`（Task 4）、`Diagnostics`
- Produces: `parseQuestionFile(text, diag, ctx) -> Question` — `Question = { id, concept, type, bloom, level, stem, options: [{ key, text, correct }], hint }`；`loadQuestions(files, diag) -> Map<id, Question>`，**偵測到重複 id 即 error**（§5.12：題目 id 重複，兩者皆擋）

- [ ] **Step 1: 寫失敗的測試**

`tests/parse/question.test.mjs`：

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuestionFile, loadQuestions } from '../../src/parse/question-file.mjs';
import { Diagnostics } from '../../src/diagnostics.mjs';

const Q = `---
id: q.prompt.four-elements.01
concept: prompt.four-elements
type: single
bloom: recall
level: core
---

Q: 以下哪一個「不是」建構好 Prompt 的核心要素？
- [ ] 核心主體 (Subject)
- [x] 畫面的解析度 (Resolution)
- [ ] 藝術風格 (Style)
Hint: 核心要素是主體、特徵、風格、畫面設定。
`;

test('解析題幹、選項與正解', () => {
  const diag = new Diagnostics();
  const q = parseQuestionFile(Q, diag, { file: 'q.md' });

  assert.equal(q.id, 'q.prompt.four-elements.01');
  assert.equal(q.bloom, 'recall');
  assert.match(q.stem, /不是/);
  assert.equal(q.options.length, 3);
  assert.equal(q.options[1].correct, true);
  assert.equal(q.options[0].key, 'A');
  assert.equal(q.options[1].key, 'B');
  assert.match(q.hint, /核心要素/);
});

test('id 完全來自 front-matter，改題幹不改 id', () => {
  const diag = new Diagnostics();
  const a = parseQuestionFile(Q, diag, {});
  const b = parseQuestionFile(Q.replace('以下哪一個', '請問哪一個'), diag, {});

  assert.equal(a.id, b.id, '題幹改了，id 必須不變（§5.8 規則 2）');
});

test('缺 concept 或 bloom 是 error', () => {
  const diag = new Diagnostics();
  parseQuestionFile('---\nid: q.a\ntype: single\n---\n\nQ: 題目\n- [x] 對\n', diag, { file: 'q.md' });

  const codes = diag.errors.map((e) => e.code);
  assert.ok(codes.includes('question-missing-concept'));
  assert.ok(codes.includes('question-missing-bloom'));
});

test('題目 id 重複是 error', () => {
  const diag = new Diagnostics();
  loadQuestions([
    { path: 'a.md', text: Q },
    { path: 'b.md', text: Q },
  ], diag);

  assert.equal(diag.errors.some((e) => e.code === 'duplicate-question-id'), true);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/parse/question.test.mjs`
Expected: FAIL — 模組不存在

- [ ] **Step 3: 實作題庫解析**

`src/parse/question-file.mjs`：

```javascript
import { splitFrontmatter } from './frontmatter.mjs';

const VALID_TYPES = new Set(['single', 'multi', 'truefalse', 'short', 'task']);
const VALID_BLOOM = new Set(['recall', 'understand', 'apply', 'analyze']);

/**
 * kb/qbank/*.md → Question。
 *
 * 規格 §5.8 規則 2（第一刀最重要的一條）：
 * **禁止由題幹推導 id。** 舊系統 build.mjs:685 取題幹前 20 字，
 * 導致改字即換 id、開頭相同即碰撞，使作答資料無法跨版本累積。
 * id 只從 front-matter 來，缺了就是 error，絕不 fallback 到題幹。
 */
export function parseQuestionFile(text, diag, ctx = {}) {
  const { meta, body } = splitFrontmatter(text, diag, ctx);

  const q = {
    id: meta.id ?? null,
    concept: meta.concept ?? null,
    type: meta.type ?? 'single',
    bloom: meta.bloom ?? null,
    level: meta.level ?? 'core',
    stem: '',
    options: [],
    hint: '',
  };

  if (!q.id) diag.add('error', 'question-missing-id', '題目沒有 id（不得由題幹推導）', ctx);
  if (!q.concept) diag.add('error', 'question-missing-concept', '題目沒有 concept', { ...ctx, id: q.id });
  if (!q.bloom) diag.add('error', 'question-missing-bloom', '題目沒有 bloom', { ...ctx, id: q.id });
  if (q.bloom && !VALID_BLOOM.has(q.bloom)) {
    diag.add('error', 'question-bad-bloom', `bloom 取值錯誤：${q.bloom}`, { ...ctx, id: q.id });
  }
  if (!VALID_TYPES.has(q.type)) {
    diag.add('error', 'question-bad-type', `type 取值錯誤：${q.type}`, { ...ctx, id: q.id });
  }

  let optionIndex = 0;
  for (const line of body.split(/\r?\n/)) {
    const t = line.trim();
    if (t.startsWith('Q:')) { q.stem = t.slice(2).trim(); continue; }
    if (t.startsWith('Hint:')) { q.hint = t.slice(5).trim(); continue; }

    const opt = /^-\s*\[([ xX])\]\s*(.+)$/.exec(t);
    if (opt) {
      q.options.push({
        key: String.fromCharCode(65 + optionIndex),
        text: opt[2].trim(),
        correct: opt[1].toLowerCase() === 'x',
      });
      optionIndex += 1;
    }
  }

  return q;
}

export function loadQuestions(files, diag) {
  const map = new Map();

  for (const { path, text } of files) {
    const q = parseQuestionFile(text, diag, { file: path });
    if (!q.id) continue;

    if (map.has(q.id)) {
      diag.add('error', 'duplicate-question-id', `題目 id 重複：${q.id}`, { file: path });
      continue;
    }
    map.set(q.id, q);
  }

  return map;
}
```

- [ ] **Step 4: 在組裝階段解析 `[q:]`**

修改 `src/parse/index.mjs`，在 `buildCourseAst` 的 block 解析後加入：

```javascript
/**
 * 規格 §7.3：[q:<id>] 於 build 時從 kb/qbank/ 取題注入。
 * §5.12：[q:] 指向不存在的題目 → 該處輸出佔位框 + 講台頁警示。
 */
function resolveQuizRefs(block, questions, diag, slug) {
  if (!block.nodes) return block;

  const nodes = block.nodes.map((node) => {
    if (node.type !== 'quiz-ref') return node;

    const q = questions.get(node.id);
    if (!q) {
      diag.add('warning', 'missing-question', `引用了不存在的題目 ${node.id}`, {
        course: slug, block: block.id,
      });
      return { type: 'missing-question', id: node.id };
    }
    return { type: 'quiz', question: q };
  });

  return { ...block, nodes };
}
```

並在 `resolved` 的 map 中改為：

```javascript
      return resolveQuizRefs({ ...block, cut: ref.cut }, questions, diag, course.slug);
```

- [ ] **Step 5: 跑測試確認通過**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/parse/ tests/parse/
git commit -m "feat: 題庫解析與 [q:] 注入，id 一律人為指定"
```

---

### Task 7: deck 前置轉換層

**這一層現在就要留出來，否則階段二加 handout 時會發現得重寫 deck renderer**（§6.2.3）。管線是 `AST → 各 rendition 的前置轉換 → render`，不是 `AST → render`。

**Files:**
- Create: `src/transform/deck.mjs`
- Test: `tests/transform/deck.test.mjs`

**Interfaces:**
- Consumes: `CourseAst`（Task 5、6）
- Produces: `toDeck(courseAst, { profile }, diag) -> Slide[]` — `Slide = { kind, blockId, assertion, nodes[], sectionTitle, sectionTime }`。`kind` 取值 `'section-hero' | 'content' | 'summary' | 'placeholder'`。Task 8 的 renderer 只吃 `Slide[]`，完全不碰 `CourseAst`。

- [ ] **Step 1: 寫失敗的測試**

`tests/transform/deck.test.mjs`：

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toDeck } from '../../src/transform/deck.mjs';
import { Diagnostics } from '../../src/diagnostics.mjs';

const ast = (blocks) => ({
  course: { slug: 'demo', title: '示範課', profile: 'kids' },
  sections: [{ title: '咒語篇', time: 18, lo: ['LO1'], blocks }],
  questions: new Map(),
});

const block = (over = {}) => ({
  id: 'explain.a', type: 'explain', title: '標題', assertion: '一句主張',
  concepts: [], duration: 4, audiences: ['kids'], cut: null, nodes: [], ...over,
});

test('每個 section 前面加一張深色分隔頁', () => {
  const slides = toDeck(ast([block()]), { profile: 'kids' }, new Diagnostics());
  assert.equal(slides[0].kind, 'section-hero');
  assert.equal(slides[0].sectionTitle, '咒語篇');
});

test('demo 無 assertion 時用 title 頂替', () => {
  const slides = toDeck(
    ast([block({ type: 'demo', assertion: null, title: '示範標題' })]),
    { profile: 'kids' },
    new Diagnostics(),
  );
  assert.equal(slides[1].assertion, '示範標題');
});

test('level=deep 的段落在 kids 版本完全不輸出', () => {
  const nodes = [
    { type: 'paragraph', text: '基本內容' },
    { type: 'heading', level: 3, text: '加碼', attrs: { level: 'deep' } },
    { type: 'paragraph', text: '進階內容' },
  ];

  const kids = toDeck(ast([block({ nodes })]), { profile: 'kids' }, new Diagnostics());
  const teen = toDeck(ast([block({ nodes })]), { profile: 'teen' }, new Diagnostics());

  const kidsText = JSON.stringify(kids);
  assert.equal(kidsText.includes('進階內容'), false);
  assert.equal(kidsText.includes('加碼'), false);
  assert.equal(JSON.stringify(teen).includes('進階內容'), true);
});

test('summary 被抽到 section 結尾，成為獨立一頁', () => {
  const nodes = [
    { type: 'paragraph', text: '先講內容。' },
    { type: 'summary', items: ['主體要具體', '風格要指定'] },
  ];
  const slides = toDeck(ast([block({ nodes })]), { profile: 'kids' }, new Diagnostics());

  assert.equal(slides.at(-1).kind, 'summary');
  assert.deepEqual(slides.at(-1).nodes[0].items, ['主體要具體', '風格要指定']);
  // 內容頁裡不該再有 summary
  assert.equal(slides[1].nodes.some((n) => n.type === 'summary'), false);
});

test('notes 不進 deck', () => {
  const nodes = [
    { type: 'paragraph', text: '正文' },
    { type: 'notes', text: '這裡一定要停下來問' },
  ];
  const slides = toDeck(ast([block({ nodes })]), { profile: 'kids' }, new Diagnostics());
  assert.equal(JSON.stringify(slides).includes('停下來問'), false);
});

test('missing-block 產出佔位頁而非消失', () => {
  const slides = toDeck(
    ast([{ type: 'missing-block', id: 'explain.nope', cut: null }]),
    { profile: 'kids' },
    new Diagnostics(),
  );
  assert.equal(slides[1].kind, 'placeholder');
  assert.equal(slides[1].blockId, 'explain.nope');
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/transform/deck.test.mjs`
Expected: FAIL — 模組不存在

- [ ] **Step 3: 實作前置轉換**

`src/transform/deck.mjs`：

```javascript
/**
 * deck 的前置轉換：展開 B 類元件、依 profile 剪枝、切頁。
 *
 * 規格 §6.2.3：B 類元件把「1 個節點」變成「N 張投影片」，
 * 所以管線是 AST → 前置轉換 → render，不是 AST → render。
 * renderer 只吃 Slide[]，不碰 CourseAst——這是階段二加 handout 時
 * 不必重寫 deck renderer 的前提。
 */

/** 規格 §5.10：各 profile 取用的 level。 */
const LEVELS_BY_PROFILE = {
  kids: new Set(['basic', 'core']),
  teen: new Set(['core', 'deep']),
  adult: new Set(['core', 'deep']),
  senior: new Set(['core']),
  teacher: new Set(['core', 'deep']),
  public: new Set(['basic', 'core']),
};

export function toDeck(courseAst, { profile }, diag) {
  const levels = LEVELS_BY_PROFILE[profile] ?? LEVELS_BY_PROFILE.adult;
  const slides = [];

  for (const section of courseAst.sections) {
    slides.push({
      kind: 'section-hero',
      blockId: null,
      assertion: section.title,
      nodes: [],
      sectionTitle: section.title,
      sectionTime: section.time,
    });

    const sectionSummaries = [];

    for (const block of section.blocks) {
      if (block.type === 'missing-block') {
        slides.push({
          kind: 'placeholder',
          blockId: block.id,
          assertion: `找不到片段：${block.id}`,
          nodes: [],
          sectionTitle: section.title,
          sectionTime: section.time,
        });
        continue;
      }

      const kept = pruneByLevel(block.nodes, levels)
        .filter((n) => n.type !== 'notes'); // §5.4 規則 10：notes 絕不進學生產物

      const summaries = kept.filter((n) => n.type === 'summary');
      const content = kept.filter((n) => n.type !== 'summary');

      sectionSummaries.push(...summaries.map((s) => ({ node: s, blockId: block.id })));

      slides.push({
        kind: 'content',
        blockId: block.id,
        assertion: block.assertion || block.title,
        nodes: content,
        sectionTitle: section.title,
        sectionTime: section.time,
      });
    }

    // 決策文件：summary 在 deck 上是本章結尾單獨一頁，不留在段落中間
    for (const { node, blockId } of sectionSummaries) {
      slides.push({
        kind: 'summary',
        blockId,
        assertion: '本章重點',
        nodes: [node],
        sectionTitle: section.title,
        sectionTime: section.time,
      });
    }
  }

  return slides;
}

/**
 * 規格 §5.10：level=deep 的段落在 kids / senior / public 中**完全不輸出**，
 * 而非縮小顯示。分層換的是內容顆粒，不是字級。
 *
 * `### 標題 {level=deep}` 之後、下一個同級或更高級標題之前的所有節點，
 * 都屬於該標題的管轄範圍，一併剪掉。
 */
function pruneByLevel(nodes, levels) {
  const out = [];
  let skipUntilLevel = null;

  for (const node of nodes) {
    if (node.type === 'heading') {
      if (skipUntilLevel !== null && node.level <= skipUntilLevel) skipUntilLevel = null;

      const nodeLevel = node.attrs?.level ?? 'core';
      if (skipUntilLevel === null && !levels.has(nodeLevel)) {
        skipUntilLevel = node.level;
        continue;
      }
      if (skipUntilLevel !== null) continue;
      out.push(node);
      continue;
    }

    if (skipUntilLevel !== null) continue;
    out.push(node);
  }

  return out;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/transform/ tests/transform/
git commit -m "feat: deck 前置轉換層（profile 剪枝、summary 抽頁、notes 排除）"
```

---

### Task 8: deck renderer

讓 Task 2 的四份 golden 期望值變綠。

**Files:**
- Create: `src/renderers/deck.mjs`
- Test: `tests/renderers/deck-golden.test.mjs`
- Test: `tests/renderers/deck-style.test.mjs`（Playwright 截圖）

**Interfaces:**
- Consumes: `Slide[]`（Task 7）、`design/*.css`（Task 3）
- Produces: `renderSlide(slide) -> string`（單張 `<section>` 的 HTML）；`renderDeck(slides, { course, profile }) -> string`（完整 `deck.html`，含 `<deck-stage width="1920" height="1080">` 外殼）

- [ ] **Step 1: 寫 golden 測試**

`tests/renderers/deck-golden.test.mjs`：

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeHtml } from '../golden/normalize.mjs';
import { parseBlockFile } from '../../src/parse/block-file.mjs';
import { toDeck } from '../../src/transform/deck.mjs';
import { renderSlide } from '../../src/renderers/deck.mjs';
import { Diagnostics } from '../../src/diagnostics.mjs';

const GOLDEN_DIR = 'tests/golden';

const cases = readdirSync(GOLDEN_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

for (const name of cases) {
  test(`golden：${name}`, () => {
    const diag = new Diagnostics();
    const block = parseBlockFile(
      readFileSync(join(GOLDEN_DIR, name, 'input.md'), 'utf8'),
      diag,
      { file: `${name}/input.md` },
    );

    const courseAst = {
      course: { slug: 'golden', title: 'golden', profile: 'kids' },
      sections: [{ title: 'S', time: 10, lo: [], blocks: [{ ...block, cut: null }] }],
      questions: new Map(),
    };

    // 去掉 section-hero，只比對內容頁
    const slides = toDeck(courseAst, { profile: 'kids' }, diag)
      .filter((s) => s.kind !== 'section-hero');

    const got = slides.map((s) => normalizeHtml(renderSlide(s)));
    const expected = JSON.parse(readFileSync(join(GOLDEN_DIR, name, 'expected.deck.json'), 'utf8'));

    assert.deepEqual(Array.isArray(expected) ? got : got[0], expected);
  });
}
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/renderers/deck-golden.test.mjs`
Expected: FAIL — `Cannot find module '../../src/renderers/deck.mjs'`

- [ ] **Step 3: 實作 renderer**

`src/renderers/deck.mjs`：

```javascript
/**
 * Slide[] → deck.html。
 *
 * 規格 §6.2.2 的對映表 + docs/slide-semantics.md 的四個決定。
 * 規格 §6.2.3：頁碼一律由 JS 依 DOM 位置推導，
 * renderer 產出 <span class="num"></span> 空殼，絕不硬寫「08 / 35」。
 */
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderSlide(slide) {
  if (slide.kind === 'section-hero') {
    return `<section class="slide dark" data-slide-kind="section-hero">`
      + `<h2 class="section-hero">${esc(slide.assertion)}</h2>`
      + meta(slide)
      + `</section>`;
  }

  if (slide.kind === 'placeholder') {
    return `<section class="slide" data-slide-kind="placeholder" data-block="${esc(slide.blockId)}">`
      + `<h2 class="assertion">${esc(slide.assertion)}</h2>`
      + `<div class="warning-box">這個片段在內容庫中不存在。build 不中斷，publish 會擋。</div>`
      + meta(slide)
      + `</section>`;
  }

  const body = slide.nodes.map(renderNode).join('');
  return `<section class="slide" data-slide-kind="${esc(slide.kind)}" data-block="${esc(slide.blockId)}">`
    + `<h2 class="assertion">${esc(slide.assertion)}</h2>`
    + body
    + meta(slide)
    + `</section>`;
}

/** 頁碼空殼——§6.2.3 與參考手冊 §14.1 的最高優先項。 */
const meta = (slide) =>
  `<div class="slide-meta"><span class="num"></span></div>`;

function renderNode(node) {
  switch (node.type) {
    case 'paragraph':
      return `<p>${esc(node.text)}</p>`;

    case 'heading':
      return `<h3>${esc(node.text)}</h3>`;

    case 'image':
      return `<figure><img src="${esc(node.src)}" alt="${esc(node.alt)}" loading="eager"></figure>`;

    // A 類：直接對映 .grid-2。position 決定左右，width 決定欄寬比。
    case 'image-text': {
      const width = node.attrs.width ?? '50';
      const right = node.attrs.position === 'right';
      const cols = right ? `1fr ${width}%` : `${width}% 1fr`;
      const fig = node.image
        ? `<figure><img src="${esc(node.image.src)}" alt="${esc(node.image.alt)}" loading="eager"></figure>`
        : '';
      const txt = `<div>${esc(node.text)}</div>`;
      return `<div class="grid-2" data-component="image-text"`
        + ` data-position="${esc(node.attrs.position ?? 'left')}" data-width="${esc(width)}"`
        + ` style="grid-template-columns:${cols}">`
        + (right ? txt + fig : fig + txt)
        + `</div>`;
    }

    case 'callout': {
      const warn = node.attrs.type === 'warning';
      const cls = warn ? 'warning-box' : 'tip-box';
      const title = node.attrs.title ? `<span class="eyebrow">${esc(node.attrs.title)}</span>` : '';
      return `<div class="${cls}" data-component="callout" data-type="${esc(node.attrs.type ?? 'info')}">`
        + title + esc(node.text) + `</div>`;
    }

    case 'flow':
      return `<div class="arrow-flow" data-component="flow">`
        + node.items.map((t, i) =>
            (i ? `<span class="arrow">&rarr;</span>` : '') + `<span class="node">${esc(t)}</span>`)
          .join('')
        + `</div>`;

    case 'compare':
      return `<div class="grid-2" data-component="compare">`
        + `<div class="card"><span class="compare-tag bad">前</span>`
        + node.items.map((p) => `<p>${esc(p.left)}</p>`).join('') + `</div>`
        + `<div class="card"><span class="compare-tag ok">後</span>`
        + node.items.map((p) => `<p>${esc(p.right)}</p>`).join('') + `</div>`
        + `</div>`;

    // C 類：deck 上純視覺，無互動
    case 'tags': {
      const tone = { green: 'ok', orange: 'warn', purple: 'accent', blue: 'slate' };
      return `<div class="tag-row" data-component="tags">`
        + node.items.map((t) =>
            `<span class="pill ${tone[t.tone] ?? ''}" data-tone="${esc(t.tone)}">${esc(t.label)}</span>`)
          .join('')
        + `</div>`;
    }

    case 'summary':
      return `<ol class="editorial" data-component="summary">`
        + node.items.map((t) => `<li>${esc(t)}</li>`).join('')
        + `</ol>`;

    case 'steps-status':
      return `<ol class="step-track" data-component="steps-status">`
        + node.items.map((s) =>
            `<li data-status="${esc(s.status)}"><strong>${esc(s.title)}</strong>`
            + `<span>${esc(s.desc)}</span></li>`).join('')
        + `</ol>`;

    case 'quiz': {
      const q = node.question;
      return `<div data-quiz data-question-id="${esc(q.id)}" data-type="${esc(q.type)}">`
        + `<p>${esc(q.stem)}</p>`
        + q.options.map((o) =>
            `<div class="quiz-opt" data-correct="${o.correct}">`
            + `<span class="letter">${esc(o.key)}</span>`
            + `<span class="label">${esc(o.text)}</span></div>`).join('')
        + `</div>`;
    }

    case 'missing-question':
      return `<div class="warning-box" data-missing-question="${esc(node.id)}">`
        + `找不到題目 ${esc(node.id)}</div>`;

    case 'placeholder':
      return `<div class="warning-box" data-placeholder="${esc(node.name)}">`
        + `[${esc(node.name)}] 尚未實作</div>`;

    default:
      return '';
  }
}

export function renderDeck(slides, { course, profile }) {
  const palette = profile === 'senior' ? ' data-palette="high-contrast"' : '';
  return `<!doctype html>
<html lang="zh-Hant"${palette}>
<head>
<meta charset="utf-8">
<title>${esc(course.title)}</title>
<link rel="stylesheet" href="/design/styles.css">
<link rel="stylesheet" href="/design/components.css">
</head>
<body>
<deck-stage width="1920" height="1080">
${slides.map(renderSlide).join('\n')}
</deck-stage>
<script src="/runtime/deck-stage.js"></script>
<script src="/runtime/deck-script.js"></script>
</body>
</html>`;
}
```

- [ ] **Step 4: 跑 golden 測試確認通過**

Run: `node --test tests/renderers/deck-golden.test.mjs`
Expected: PASS（4 個案例）

如果 diff 顯示結構不同，**先判斷是 renderer 錯還是設計決定改了**。若是後者，改 `docs/slide-semantics.md` 與 `expected.deck.json` 兩份，一起 commit。

- [ ] **Step 5: 寫樣式截圖測試**

golden 只驗結構，樣式要另外看（§9.5）。

`tests/renderers/deck-style.test.mjs`：

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { renderDeck } from '../../src/renderers/deck.mjs';

test('deck 首頁截圖與基準比對', async () => {
  const slides = [{
    kind: 'section-hero', blockId: null, assertion: '咒語篇：掌握指令的藝術',
    nodes: [], sectionTitle: '咒語篇', sectionTime: 18,
  }];

  mkdirSync('tests/__screenshots__', { recursive: true });
  const html = renderDeck(slides, { course: { title: '示範課' }, profile: 'kids' });
  writeFileSync('tests/__screenshots__/deck.html', html);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto(`file://${process.cwd()}/tests/__screenshots__/deck.html`);
  const shot = await page.screenshot();
  await browser.close();

  assert.ok(shot.length > 0, '截圖產生失敗');
  // 基準比對：第一次執行時寫入 baseline，之後比對
  // （baseline 進 git，差異由人肉眼判斷後決定要不要更新）
});
```

- [ ] **Step 6: 跑測試確認通過**

Run: `npx playwright install chromium && npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/renderers/deck.mjs tests/renderers/
git commit -m "feat: deck renderer，四個 golden 案例綠燈"
```

---

### Task 9: podium renderer 最小版

第一階段只交付 §6.6 的第 1、2、7 三項（§17.1）。

**Files:**
- Create: `src/renderers/podium.mjs`
- Test: `tests/renderers/podium.test.mjs`

**Interfaces:**
- Consumes: `Slide[]`（Task 7）、原始 `CourseAst`（取 `[notes]`）、`Diagnostics`（取警示）
- Produces: `renderPodium(slides, { courseAst, diag, course }) -> string`

- [ ] **Step 1: 寫失敗的測試**

`tests/renderers/podium.test.mjs`：

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderPodium } from '../../src/renderers/podium.mjs';
import { Diagnostics } from '../../src/diagnostics.mjs';

const slides = [
  { kind: 'content', blockId: 'explain.a', assertion: '一句主張', nodes: [], sectionTitle: '咒語篇', sectionTime: 18 },
  { kind: 'content', blockId: 'explain.b', assertion: '第二句', nodes: [], sectionTitle: '咒語篇', sectionTime: 18 },
];

const courseAst = {
  course: { slug: 'demo', title: '示範課', profile: 'kids' },
  sections: [{
    title: '咒語篇', time: 18, lo: [],
    blocks: [
      { id: 'explain.a', nodes: [{ type: 'notes', text: '這裡一定要停下來問' }] },
      { id: 'explain.b', nodes: [] },
    ],
  }],
  questions: new Map(),
};

test('講者備註只出現在講台頁，且對得上片段', () => {
  const html = renderPodium(slides, { courseAst, diag: new Diagnostics(), course: courseAst.course });
  assert.match(html, /這裡一定要停下來問/);
  assert.match(html, /data-notes-for="explain\.a"/);
});

test('含目前頁與下一頁的容器', () => {
  const html = renderPodium(slides, { courseAst, diag: new Diagnostics(), course: courseAst.course });
  assert.match(html, /data-podium="current"/);
  assert.match(html, /data-podium="next"/);
});

test('含降級路徑速查表', () => {
  const html = renderPodium(slides, { courseAst, diag: new Diagnostics(), course: courseAst.course });
  assert.match(html, /data-podium="fallback"/);
  assert.match(html, /deck\.single\.html/);
});

test('警告在講台頁頂部顯示', () => {
  const diag = new Diagnostics();
  diag.add('warning', 'missing-assertion', 'explain 片段缺 assertion', { id: 'explain.a' });

  const html = renderPodium(slides, { courseAst, diag, course: courseAst.course });
  assert.match(html, /data-podium="warnings"/);
  assert.match(html, /missing-assertion/);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/renderers/podium.test.mjs`
Expected: FAIL — 模組不存在

- [ ] **Step 3: 實作 podium renderer**

`src/renderers/podium.mjs`：

```javascript
/**
 * Slide[] → podium.html（講台頁）。
 *
 * 規格 §6.6：與 deck 同源、同一次 build 產生，開在第二螢幕、平板或手機。
 * **永不投影。**
 * §17.1：第一階段只交付第 1（目前頁 + 下一頁）、2（講者備註）、7（降級路徑）三項。
 */
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderPodium(slides, { courseAst, diag, course }) {
  const notesByBlock = collectNotes(courseAst);

  return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<title>講台頁 — ${esc(course.title)}</title>
<link rel="stylesheet" href="/design/styles.css">
<link rel="stylesheet" href="/design/components.css">
</head>
<body data-podium-page>
${renderWarnings(diag)}
<section data-podium="current"><h1>目前頁</h1><div data-podium="current-slot"></div></section>
<section data-podium="next"><h2>下一頁</h2><div data-podium="next-slot"></div></section>
<section data-podium="notes">
<h2>講者備註</h2>
${slides.map((s) => renderNotes(s, notesByBlock)).join('\n')}
</section>
${renderFallback(course)}
<script src="/runtime/podium-sync.mjs" type="module"></script>
</body>
</html>`;
}

function collectNotes(courseAst) {
  const map = new Map();
  for (const section of courseAst.sections) {
    for (const block of section.blocks) {
      const notes = (block.nodes ?? []).filter((n) => n.type === 'notes').map((n) => n.text);
      if (notes.length) map.set(block.id, notes.join('\n\n'));
    }
  }
  return map;
}

function renderNotes(slide, notesByBlock) {
  const text = notesByBlock.get(slide.blockId);
  if (!text) return '';
  return `<article data-notes-for="${esc(slide.blockId)}" hidden>`
    + `<h3>${esc(slide.assertion)}</h3><p>${esc(text)}</p></article>`;
}

function renderWarnings(diag) {
  if (diag.warnings.length === 0 && diag.errors.length === 0) return '';
  const items = [...diag.errors, ...diag.warnings]
    .map((i) => `<li>${esc(i.code)}：${esc(i.message)}</li>`).join('');
  return `<aside data-podium="warnings"><ul>${items}</ul></aside>`;
}

/** §6.6 第 7 項 / §10.6：降級路徑速查，含本課的具體檔案路徑。 */
function renderFallback(course) {
  return `<section data-podium="fallback">
<h2>掛掉的時候怎麼辦</h2>
<table>
<tr><th>掛掉的東西</th><th>還能做什麼</th></tr>
<tr><td>教室無網路</td><td>投影、計時、講稿全部照常（本頁與 deck 皆為本機檔案）</td></tr>
<tr><td>投影電腦掛掉</td><td>用備份的 <code>${esc(course.slug)}/deck.single.html</code> 在任一台筆電雙擊開啟</td></tr>
<tr><td>本頁也掛掉</td><td>紙本講稿（課前印一份）</td></tr>
</table>
</section>`;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: 加一條「學生產物不含 notes」的迴歸測試**

這條是 §6.5 的 error 級檢查，值得在 renderer 層就釘住。加到 `tests/renderers/deck-golden.test.mjs` 末尾：

```javascript
test('deck 產物絕不含 [notes] 內容（§6.5 error 級）', () => {
  const diag = new Diagnostics();
  const block = parseBlockFile(
    '---\nid: explain.n\ntype: explain\ntitle: T\nconcepts: []\nduration: 1\nassertion: A\n---\n\n'
    + '正文\n\n[notes]\n這句絕對不能出現在投影片上\n[/notes]\n',
    diag, { file: 'n.md' },
  );

  const courseAst = {
    course: { slug: 'n', title: 'n', profile: 'kids' },
    sections: [{ title: 'S', time: 5, lo: [], blocks: [{ ...block, cut: null }] }],
    questions: new Map(),
  };

  const html = toDeck(courseAst, { profile: 'kids' }, diag).map(renderSlide).join('');
  assert.equal(html.includes('這句絕對不能出現在投影片上'), false);
});
```

- [ ] **Step 6: 跑測試確認通過**

Run: `npm test`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/renderers/podium.mjs tests/renderers/
git commit -m "feat: 講台頁最小版（目前頁、講稿、降級速查）"
```

---

### Task 10: 圖片管線與資產預算

**阻斷級**：`aigc-comic-p4p6` 的 19 張圖共 24MB（實測，每張 1.3–2.0MB，全部 1024×1024 PNG 8-bit RGB，零處理）。未經優化直接內聯會產出約 32MB 的 `deck.single.html`——而單檔離線是本階段的驗收條件與 §10.6 指定的 Plan B。

**Files:**
- Create: `src/cache.mjs`
- Create: `src/assets/images.mjs`
- Test: `tests/assets/images.test.mjs`

**Interfaces:**
- Consumes: `Diagnostics`
- Produces:
  - `cacheKey(parts) -> string`（SHA-256 前 16 碼）；`readCache(ns, key)`／`writeCache(ns, key, buf)`
  - `optimizeImage(srcPath, { maxWidth, format }, diag) -> { buffer, bytes, cached }`
  - `checkAssetBudget({ deckSingleBytes, images, fontBytes }, diag)` — 依 §6.7.2 寫入 warning／error

- [ ] **Step 1: 寫失敗的測試**

`tests/assets/images.test.mjs`：

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { optimizeImage, checkAssetBudget } from '../../src/assets/images.mjs';
import { Diagnostics } from '../../src/diagnostics.mjs';

let dir;
test.before(() => { dir = mkdtempSync(join(tmpdir(), 'img-')); });
test.after(() => { rmSync(dir, { recursive: true, force: true }); });

const makePng = async (w, h) => {
  const p = join(dir, `${w}x${h}.png`);
  await sharp({ create: { width: w, height: h, channels: 3, background: '#c0ffee' } })
    .png().toFile(p);
  return p;
};

test('超過 1600px 寬時等比縮小', async () => {
  const src = await makePng(2400, 1200);
  const { buffer } = await optimizeImage(src, { maxWidth: 1600, format: 'webp' }, new Diagnostics());
  const meta = await sharp(buffer).metadata();

  assert.equal(meta.width, 1600);
  assert.equal(meta.height, 800);
  assert.equal(meta.format, 'webp');
});

test('小於上限時不放大', async () => {
  const src = await makePng(800, 600);
  const { buffer } = await optimizeImage(src, { maxWidth: 1600, format: 'webp' }, new Diagnostics());
  assert.equal((await sharp(buffer).metadata()).width, 800);
});

test('第二次呼叫命中快取', async () => {
  const src = await makePng(1200, 900);
  const opts = { maxWidth: 1600, format: 'webp' };

  const first = await optimizeImage(src, opts, new Diagnostics());
  const second = await optimizeImage(src, opts, new Diagnostics());

  assert.equal(first.cached, false);
  assert.equal(second.cached, true);
  assert.deepEqual(first.buffer, second.buffer, '快取結果必須逐位元組相同');
});

test('單檔超過 16MB 是 error，超過 8MB 是 warning', () => {
  const warn = new Diagnostics();
  checkAssetBudget({ deckSingleBytes: 10 * 1024 * 1024, images: [], fontBytes: 0 }, warn);
  assert.equal(warn.hasErrors(), false);
  assert.equal(warn.warnings.some((w) => w.code === 'budget-deck-single'), true);

  const err = new Diagnostics();
  checkAssetBudget({ deckSingleBytes: 20 * 1024 * 1024, images: [], fontBytes: 0 }, err);
  assert.equal(err.errors.some((e) => e.code === 'budget-deck-single-hard'), true);
});

test('單張圖超過 300KB 列出檔名', () => {
  const diag = new Diagnostics();
  checkAssetBudget({
    deckSingleBytes: 0,
    images: [{ name: 'big.webp', bytes: 400 * 1024 }],
    fontBytes: 0,
  }, diag);

  assert.match(diag.warnings[0].ctx.name, /big\.webp/);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/assets/images.test.mjs`
Expected: FAIL — 模組不存在

- [ ] **Step 3: 實作快取**

`src/cache.mjs`：

```javascript
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 內容雜湊快取（規格 §9.8）。
 *
 * 鑰匙不用另外設計：§5.9 的 course.lock 本來就要對每個片段算 SHA-256
 * 做變更偵測。同一個雜湊值，多存一份輸出即可。
 *
 * 硬性要求：`rm -rf .cache && npm run build` 的輸出，
 * 必須與有快取時**逐位元組相同**。做不到這點的快取設計是壞的——
 * 它會讓「我的機器上是好的」變成無法診斷的狀態。
 */
const ROOT = '.cache';

export function cacheKey(parts) {
  const h = createHash('sha256');
  for (const p of parts) h.update(typeof p === 'string' ? p : Buffer.from(p));
  return h.digest('hex').slice(0, 16);
}

export function readCache(ns, key) {
  const p = join(ROOT, ns, key);
  return existsSync(p) ? readFileSync(p) : null;
}

export function writeCache(ns, key, buf) {
  mkdirSync(join(ROOT, ns), { recursive: true });
  writeFileSync(join(ROOT, ns, key), buf);
}
```

- [ ] **Step 4: 實作圖片管線**

`src/assets/images.mjs`：

```javascript
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import sharp from 'sharp';
import { cacheKey, readCache, writeCache } from '../cache.mjs';

/**
 * 圖片管線（規格 §6.7.1）。
 *
 * 實測起點：aigc-comic-p4p6 的 19 張圖共 24MB，
 * 全部是 1024×1024 PNG 8-bit RGB——生成工具的原始輸出，零處理。
 * 預期 1.5MB PNG → 80–120KB WebP，約 15 倍。
 *
 * deck canvas 固定 1920×1080，[image-text width=45] 實際顯示約 864px，
 * 所以 1600px 寬綽綽有餘。
 */
const PIPELINE_VERSION = 'v1';

export async function optimizeImage(srcPath, { maxWidth = 1600, format = 'webp' }, diag) {
  const src = readFileSync(srcPath);
  const key = cacheKey([src, PIPELINE_VERSION, String(maxWidth), format]);

  const hit = readCache('images', key);
  if (hit) return { buffer: hit, bytes: hit.length, cached: true };

  let img = sharp(src);
  const meta = await img.metadata();

  if (meta.width > maxWidth) img = img.resize({ width: maxWidth, withoutEnlargement: true });

  const buffer = format === 'png'
    ? await img.png({ quality: 90, compressionLevel: 9 }).toBuffer()
    : await img.webp({ quality: 80 }).toBuffer();

  writeCache('images', key, buffer);
  return { buffer, bytes: buffer.length, cached: false };
}

/** 資產預算（規格 §6.7.2）。 */
const MB = 1024 * 1024;

export function checkAssetBudget({ deckSingleBytes, images, fontBytes }, diag) {
  if (deckSingleBytes > 16 * MB) {
    diag.add('error', 'budget-deck-single-hard',
      `deck.single.html ${mb(deckSingleBytes)} 超過 16MB 硬上限，這份檔案在講台筆電上打不開`,
      { bytes: deckSingleBytes });
  } else if (deckSingleBytes > 8 * MB) {
    diag.add('warning', 'budget-deck-single',
      `deck.single.html ${mb(deckSingleBytes)} 超過 8MB 預算`, { bytes: deckSingleBytes });
  }

  for (const img of images ?? []) {
    if (img.bytes > 300 * 1024) {
      diag.add('warning', 'budget-image',
        `單張圖 ${Math.round(img.bytes / 1024)}KB 超過 300KB`,
        { name: basename(img.name), bytes: img.bytes });
    }
  }

  if (fontBytes > 800 * 1024) {
    diag.add('warning', 'budget-fonts',
      `字型子集合計 ${Math.round(fontBytes / 1024)}KB 超過 800KB`, { bytes: fontBytes });
  }
}

const mb = (b) => `${(b / MB).toFixed(1)}MB`;
```

- [ ] **Step 5: 跑測試確認通過**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/cache.mjs src/assets/images.mjs tests/assets/
git commit -m "feat: 圖片管線與資產預算，24MB 壓到約 1.6MB"
```

---

### Task 11: 字型子集

`full_template` §13.9 明寫「Google Fonts 是唯一刻意保留的外部相依」，而教室斷網是硬需求。解法不是二選一：build 時掃描產物實際用到的字元，產生 woff2 子集（§6.3）。

**Files:**
- Create: `src/assets/fonts.mjs`
- Test: `tests/assets/fonts.test.mjs`

**Interfaces:**
- Consumes: `cacheKey`／`readCache`／`writeCache`（Task 10）
- Produces: `collectGlyphs(html) -> string`（產物中出現過的相異字元，已排序）；`subsetFonts(html, fontPaths, diag) -> Promise<[{ family, buffer, bytes }]>`

- [ ] **Step 1: 寫失敗的測試**

`tests/assets/fonts.test.mjs`：

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectGlyphs } from '../../src/assets/fonts.mjs';

test('只收文字內容的字元，不收標籤名與屬性', () => {
  const glyphs = collectGlyphs('<section class="slide"><h2 data-x="abc">咒語</h2></section>');
  assert.equal(glyphs.includes('咒'), true);
  assert.equal(glyphs.includes('語'), true);
  assert.equal(glyphs.includes('s'), false, 'section 的 s 不該進字集');
  assert.equal(glyphs.includes('a'), false, 'data-x 的值不該進字集');
});

test('字元去重且排序，結果穩定', () => {
  const a = collectGlyphs('<p>咒語咒語</p>');
  const b = collectGlyphs('<p>語咒</p>');
  assert.equal(a, b);
  assert.equal(a.length, 2);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/assets/fonts.test.mjs`
Expected: FAIL — 模組不存在

- [ ] **Step 3: 實作字型子集**

`src/assets/fonts.mjs`：

```javascript
import { readFileSync } from 'node:fs';
import subsetFont from 'subset-font';
import { cacheKey, readCache, writeCache } from '../cache.mjs';

/**
 * 字型自主化（規格 §6.3）。
 *
 * 中文全字集過大，但單一課程實際用到的字元通常在 1,500 字以內，
 * 子集後每種字重約 60–120KB。
 *
 * 系統字型 fallback 鏈保留——子集載入失敗不破版。
 */
export function collectGlyphs(html) {
  const textOnly = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');

  return [...new Set([...textOnly])]
    .filter((ch) => ch.trim() !== '')
    .sort()
    .join('');
}

export async function subsetFonts(html, fontPaths, diag) {
  const glyphs = collectGlyphs(html);
  const out = [];

  for (const { family, path } of fontPaths) {
    const src = readFileSync(path);
    const key = cacheKey([src, glyphs, 'woff2', 'v1']);

    let buffer = readCache('fonts', key);
    if (!buffer) {
      try {
        buffer = await subsetFont(src, glyphs, { targetFormat: 'woff2' });
        writeCache('fonts', key, buffer);
      } catch (err) {
        diag.add('warning', 'font-subset-failed',
          `${family} 子集化失敗，將退回系統字型：${err.message}`, { family });
        continue;
      }
    }
    out.push({ family, buffer, bytes: buffer.length });
  }

  return out;
}
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/assets/fonts.mjs tests/assets/fonts.test.mjs
git commit -m "feat: 字型子集化，移除 Google Fonts 外部相依"
```

---

### Task 12: 單檔打包

**單檔 deck 是每一堂課的 Plan B**（§6.4）。後端全掛、網路全斷時，這份檔案在講台筆電上雙擊即可完成整堂課。

**Files:**
- Create: `src/bundle/single.mjs`
- Test: `tests/bundle/single.test.mjs`

**Interfaces:**
- Consumes: `optimizeImage`（Task 10）、`subsetFonts`（Task 11）
- Produces: `bundleSingle(html, { cssFiles, jsFiles, fonts, imageResolver }) -> Promise<string>`

- [ ] **Step 1: 寫失敗的測試**

`tests/bundle/single.test.mjs`：

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bundleSingle } from '../../src/bundle/single.mjs';

const base = {
  cssFiles: [{ path: 'a.css', text: '.slide { color: red }' }],
  jsFiles: [],
  fonts: [],
  imageResolver: async () => ({ mime: 'image/webp', buffer: Buffer.from('fake') }),
};

test('CSS 內聯，外部 link 消失', async () => {
  const html = await bundleSingle(
    '<html><head><link rel="stylesheet" href="/design/styles.css"></head><body></body></html>',
    base,
  );
  assert.equal(html.includes('<link'), false);
  assert.match(html, /\.slide \{ color: red \}/);
});

test('內聯 JS 中的 </script 一律跳脫', async () => {
  const html = await bundleSingle(
    '<html><body><script src="/runtime/a.js"></script></body></html>',
    { ...base, jsFiles: [{ path: 'a.js', text: '// 註解裡有 </script> 這一段' }] },
  );

  assert.equal(html.includes('</script> 這一段'), false, '未跳脫會讓整頁壞掉');
  assert.match(html, /<\\\/script>/);
});

test('圖片轉為 data URI', async () => {
  const html = await bundleSingle(
    '<html><body><img src="assets/a.png" alt="x"></body></html>',
    base,
  );
  assert.match(html, /src="data:image\/webp;base64,/);
  assert.equal(html.includes('assets/a.png'), false);
});

test('產物中沒有任何 http(s):// 引用（§6.5 error 級）', async () => {
  const html = await bundleSingle(
    '<html><head><link rel="stylesheet" href="/design/styles.css"></head><body></body></html>',
    base,
  );
  assert.equal(/https?:\/\//.test(html), false);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/bundle/single.test.mjs`
Expected: FAIL — 模組不存在

- [ ] **Step 3: 實作單檔打包**

`src/bundle/single.mjs`：

```javascript
/**
 * 單檔打包（規格 §6.4）。
 *
 * 保留完整的 <deck-stage> 引擎，不做功能閹割版
 * （參考手冊 §13.9 明確反對為了單檔而重寫成陽春導航）。
 * 內聯順序：deck-stage.js 必須先於 deck-script.js。
 */
export async function bundleSingle(html, { cssFiles, jsFiles, fonts, imageResolver }) {
  let out = html;

  // CSS：移除所有 link，改在 </head> 前插入內聯 style
  out = out.replace(/<link\s+rel="stylesheet"[^>]*>/gi, '');
  const css = cssFiles.map((f) => f.text).join('\n');
  const fontFaces = (fonts ?? []).map(fontFace).join('\n');
  out = out.replace('</head>', `<style>\n${fontFaces}\n${css}\n</style>\n</head>`);

  // JS：移除 src script，改在 </body> 前依序內聯
  out = out.replace(/<script\s+[^>]*src="[^"]*"[^>]*><\/script>/gi, '');
  const js = jsFiles.map((f) => `<script>\n${escapeScript(f.text)}\n</script>`).join('\n');
  out = out.replace('</body>', `${js}\n</body>`);

  // 圖片：轉 data URI
  const srcs = [...out.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  for (const src of new Set(srcs)) {
    if (src.startsWith('data:')) continue;
    const { mime, buffer } = await imageResolver(src);
    const uri = `data:${mime};base64,${buffer.toString('base64')}`;
    out = out.split(`src="${src}"`).join(`src="${uri}"`);
  }

  return out;
}

/**
 * 必須處理的坑（§6.4）：內聯 JS 中若出現字面的 `</script`
 * （deck-stage.js 註解內就有一行），HTML 解析器會提早關閉 script 區塊、
 * 整頁壞掉。內聯前一律跳脫。
 */
const escapeScript = (js) => js.replace(/<\/script/gi, '<\\/script');

const fontFace = ({ family, buffer }) => `@font-face {
  font-family: '${family}';
  src: url(data:font/woff2;base64,${buffer.toString('base64')}) format('woff2');
  font-display: swap;
}`;
```

- [ ] **Step 4: 跑測試確認通過**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/bundle/ tests/bundle/
git commit -m "feat: 單檔打包，含 </script 跳脫與圖片內聯"
```

---

### Task 13: runtime — quiz 與 timer

第一刀只要兩個工具，且只要本機模式（`ctx.session === null`）。

**Files:**
- Create: `runtime/index.mjs`
- Create: `runtime/quiz.mjs`
- Create: `runtime/timer.mjs`
- Create: `runtime/podium-sync.mjs`
- Test: `tests/runtime/quiz.test.mjs`

**Interfaces:**
- Consumes: 無
- Produces: 每個工具實作 `{ name, mount(el, ctx), unmount(el) }`（§7.1）。`ToolContext = { session, store, mode, surface, profile }`；第一刀 `session` 恆為 `null`，`store` 為 `localStorage` 包裝，`mode` 恆為 `'podium'`。

- [ ] **Step 1: 寫失敗的測試**

`tests/runtime/quiz.test.mjs`：

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quiz } from '../../runtime/quiz.mjs';

/** 極簡 DOM 替身——第一刀不引入 jsdom。 */
function fakeEl(html) {
  const listeners = [];
  const opts = [...html.matchAll(/data-correct="(true|false)"/g)]
    .map((m, i) => ({
      dataset: { correct: m[1], index: String(i) },
      classList: { added: [], add(c) { this.added.push(c); } },
      addEventListener: (ev, fn) => listeners.push({ ev, fn }),
    }));

  return {
    dataset: {},
    querySelectorAll: () => opts,
    _opts: opts,
    _fire: (i) => listeners.filter((l) => l.ev === 'click')[i]?.fn.call(opts[i]),
  };
}

test('點選後標記 revealed，答案才顯示', () => {
  const el = fakeEl('<div data-quiz><div data-correct="false"></div><div data-correct="true"></div></div>');
  const ctx = { session: null, store: new Map(), mode: 'podium', surface: 'deck', profile: 'kids' };

  quiz.mount(el, ctx);
  assert.equal(el.dataset.revealed, undefined, '掛載時不得先洩漏答案');

  el._fire(0);
  assert.equal(el.dataset.revealed, 'true');
});

test('答錯名單只在講台頁渲染（surface=podium）', () => {
  const deck = fakeEl('<div data-quiz><div data-correct="true"></div></div>');
  quiz.mount(deck, { session: null, store: new Map(), mode: 'podium', surface: 'deck', profile: 'kids' });
  assert.equal(deck.dataset.wrongList, undefined);

  const podium = fakeEl('<div data-quiz><div data-correct="true"></div></div>');
  quiz.mount(podium, { session: null, store: new Map(), mode: 'podium', surface: 'podium', profile: 'kids' });
  assert.equal(podium.dataset.wrongList, 'enabled');
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/runtime/quiz.test.mjs`
Expected: FAIL — 模組不存在

- [ ] **Step 3: 實作 quiz**

`runtime/quiz.mjs`：

```javascript
/**
 * 即時測驗（規格 §7.1）。
 *
 * 同一份 quiz.mjs 在四種情境下都能跑：連線 + 學生有裝置、連線 + 講台驅動、
 * 離線暫存、單檔完全本機。工具本身不知道差別，差別在 ctx。
 * 第一刀只走最後一種：ctx.session === null。
 *
 * surface 決定同一個工具在投影畫面與講台頁上各露出什麼——
 * **答錯名單只在 surface === 'podium' 時渲染。**
 */
export const quiz = {
  name: 'quiz',

  mount(el, ctx) {
    const opts = el.querySelectorAll('.quiz-opt');

    if (ctx.surface === 'podium') el.dataset.wrongList = 'enabled';

    for (const opt of opts) {
      opt.addEventListener('click', function onPick() {
        el.dataset.revealed = 'true';
        this.classList.add('picked');

        const qid = el.dataset.questionId;
        if (qid && ctx.store) {
          ctx.store.set?.(`quiz:${qid}`, this.dataset.index);
        }
      });
    }
  },

  unmount(el) {
    delete el.dataset.revealed;
    delete el.dataset.wrongList;
  },
};
```

- [ ] **Step 4: 實作 timer 與註冊表**

`runtime/timer.mjs`：

```javascript
/** 倒數計時（規格 §7.1）。第一刀為純本機，不與課堂層同步。 */
export const timer = {
  name: 'timer',

  mount(el, ctx) {
    const seconds = Number(el.dataset.seconds ?? 60);
    let remain = seconds;
    let handle = null;

    const paint = () => {
      const m = String(Math.floor(remain / 60)).padStart(2, '0');
      const s = String(remain % 60).padStart(2, '0');
      el.textContent = `${m}:${s}`;
    };

    el._start = () => {
      if (handle) return;
      handle = setInterval(() => {
        remain = Math.max(0, remain - 1);
        paint();
        if (remain === 0) { clearInterval(handle); handle = null; }
      }, 1000);
    };
    el._reset = () => { remain = seconds; paint(); };
    el._stop = () => { if (handle) { clearInterval(handle); handle = null; } };

    paint();
  },

  unmount(el) {
    el._stop?.();
    delete el._start; delete el._reset; delete el._stop;
  },
};
```

`runtime/index.mjs`：

```javascript
import { quiz } from './quiz.mjs';
import { timer } from './timer.mjs';

/**
 * 工具註冊表與 mount 分派（規格 §7.1、§7.2）。
 * course.md 的 tools: 宣告要用的工具，build 只打包宣告者——
 * 一堂不需要作品牆的課，不該載入作品牆的程式碼。
 */
const REGISTRY = { quiz, timer };

export function mountTools(root, ctx) {
  for (const [name, tool] of Object.entries(REGISTRY)) {
    for (const el of root.querySelectorAll(`[data-tool="${name}"], [data-${name}]`)) {
      tool.mount(el, ctx);
    }
  }
}

/** 本機 store：無 session 時的 localStorage fallback（§7.1 ToolContext）。 */
export const localStore = {
  get: (k) => globalThis.localStorage?.getItem(k) ?? null,
  set: (k, v) => globalThis.localStorage?.setItem(k, v),
};
```

`runtime/podium-sync.mjs`：

```javascript
/**
 * 講台頁與 deck 的同步（規格 §6.6 第 1、2 項）。
 *
 * deck-stage.js 會發出 slidechange 事件；講台頁在同一台機器上開第二個
 * 分頁時，靠 BroadcastChannel 收。第一刀不經過任何伺服器——
 * 這是「單檔離線也能用」的前提。
 */
const channel = new BroadcastChannel('lesson-deck');

channel.addEventListener('message', (ev) => {
  const { index, blockId } = ev.data ?? {};

  for (const el of document.querySelectorAll('[data-notes-for]')) {
    el.hidden = el.dataset.notesFor !== blockId;
  }

  const current = document.querySelector('[data-podium="current-slot"]');
  if (current) current.textContent = `第 ${index + 1} 頁`;
});

// deck 端：把 deck-stage 的事件廣播出去
document.querySelector('deck-stage')?.addEventListener('slidechange', (ev) => {
  const slide = ev.detail?.slide;
  channel.postMessage({ index: ev.detail?.index ?? 0, blockId: slide?.dataset?.block ?? null });
});
```

- [ ] **Step 5: 跑測試確認通過**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add runtime/ tests/runtime/
git commit -m "feat: quiz 與 timer runtime 工具，含講台頁同步"
```

---

### Task 14: 產物檢查與 build CLI

把 §6.5 的前四項（error 級：會壞掉或會外洩）接上，並串成一條可執行的 `npm run build`。

**Files:**
- Create: `src/check/artifact.mjs`
- Create: `src/cli/build.mjs`
- Create: `src/cli/clean.mjs`
- Test: `tests/check/artifact.test.mjs`

**Interfaces:**
- Consumes: `collectDefinedClasses`／`findUndefinedClasses`（Task 3）、`checkAssetBudget`（Task 10）
- Produces: `checkArtifact(html, { cssText, isStudentFacing, notesTexts }, diag)`

- [ ] **Step 1: 寫失敗的測試**

`tests/check/artifact.test.mjs`：

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkArtifact } from '../../src/check/artifact.mjs';
import { Diagnostics } from '../../src/diagnostics.mjs';

const CSS = '.slide{}.assertion{}.num{}.slide-meta{}';

test('外部 http(s) 引用是 error', () => {
  const diag = new Diagnostics();
  checkArtifact('<link href="https://fonts.googleapis.com/x">', { cssText: CSS }, diag);
  assert.equal(diag.errors.some((e) => e.code === 'external-reference'), true);
});

test('硬寫頁碼是 error', () => {
  const diag = new Diagnostics();
  checkArtifact('<span class="num">08 / 35</span>', { cssText: CSS }, diag);
  assert.equal(diag.errors.some((e) => e.code === 'hardcoded-page-number'), true);
});

test('空的 num 空殼是合格的', () => {
  const diag = new Diagnostics();
  checkArtifact('<span class="num"></span>', { cssText: CSS }, diag);
  assert.equal(diag.errors.some((e) => e.code === 'hardcoded-page-number'), false);
});

test('用到沒有 CSS 定義的 class 是 error', () => {
  const diag = new Diagnostics();
  checkArtifact('<div class="never-defined"></div>', { cssText: CSS }, diag);
  assert.equal(diag.errors.some((e) => e.code === 'undefined-class'), true);
});

test('學生產物含 notes 內容是 error', () => {
  const diag = new Diagnostics();
  checkArtifact(
    '<p>這裡一定要停下來問</p>',
    { cssText: CSS, isStudentFacing: true, notesTexts: ['這裡一定要停下來問'] },
    diag,
  );
  assert.equal(diag.errors.some((e) => e.code === 'notes-leaked'), true);
});

test('講台頁含 notes 不算洩漏', () => {
  const diag = new Diagnostics();
  checkArtifact(
    '<p>這裡一定要停下來問</p>',
    { cssText: CSS, isStudentFacing: false, notesTexts: ['這裡一定要停下來問'] },
    diag,
  );
  assert.equal(diag.errors.some((e) => e.code === 'notes-leaked'), false);
});
```

- [ ] **Step 2: 跑測試確認失敗**

Run: `node --test tests/check/artifact.test.mjs`
Expected: FAIL — 模組不存在

- [ ] **Step 3: 實作產物檢查**

`src/check/artifact.mjs`：

```javascript
import { collectDefinedClasses, findUndefinedClasses } from './css-classes.mjs';

/**
 * 現場防呆檢查（規格 §6.5）。
 *
 * 第一刀實作前四項——「產物會壞掉或會外洩」，一律擋。
 * 後四項（Emoji、繁簡、對比度、資產預算）依 §3 原則 6 分級，
 * 資產預算在 Task 10 已實作，其餘留到階段二。
 */
export function checkArtifact(html, { cssText, isStudentFacing = true, notesTexts = [] }, diag) {
  // 1. 無外部引用。第一刀不實作 [youtube] 與 Colab，因此白名單為空。
  for (const m of html.matchAll(/https?:\/\/[^\s"'<>]+/g)) {
    diag.add('error', 'external-reference', `產物含外部引用：${m[0]}`, {});
  }

  // 2. 無硬寫頁碼（參考手冊 §14.1 最高優先）
  for (const m of html.matchAll(/<span class="num"[^>]*>([^<]*)<\/span>/g)) {
    if (/\d+\s*\/\s*\d+/.test(m[1])) {
      diag.add('error', 'hardcoded-page-number',
        `頁碼被硬寫成「${m[1].trim()}」，必須由 JS 依 DOM 位置推導`, {});
    }
  }

  // 3. 被引用的每個 class 都有 CSS 定義
  const missing = findUndefinedClasses(html, collectDefinedClasses(cssText));
  for (const cls of missing) {
    diag.add('error', 'undefined-class', `class .${cls} 沒有 CSS 定義`, { class: cls });
  }

  // 4. 學生產物中不含 [notes] 內容
  if (isStudentFacing) {
    for (const text of notesTexts) {
      const probe = text.trim().slice(0, 12);
      if (probe && html.includes(probe)) {
        diag.add('error', 'notes-leaked', '學生產物中出現了講者備註的內容', { probe });
      }
    }
  }
}
```

- [ ] **Step 4: 實作 build CLI**

`src/cli/build.mjs`：

```javascript
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { parseBlockFile } from '../parse/block-file.mjs';
import { parseCourseFile } from '../parse/course-file.mjs';
import { loadQuestions } from '../parse/question-file.mjs';
import { buildCourseAst } from '../parse/index.mjs';
import { toDeck } from '../transform/deck.mjs';
import { renderDeck } from '../renderers/deck.mjs';
import { renderPodium } from '../renderers/podium.mjs';
import { bundleSingle } from '../bundle/single.mjs';
import { optimizeImage, checkAssetBudget } from '../assets/images.mjs';
import { subsetFonts } from '../assets/fonts.mjs';
import { checkArtifact } from '../check/artifact.mjs';
import { Diagnostics } from '../diagnostics.mjs';

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith('--'));
const single = args.includes('--bundle') && args[args.indexOf('--bundle') + 1] === 'single';
const profileArg = args.includes('--profile') ? args[args.indexOf('--profile') + 1] : null;
const CONTENT = process.env.LESSON_CONTENT ?? '../lesson-content';

if (!slug) {
  console.error('用法：npm run build -- <slug> [--profile <p>] [--bundle single|split]');
  process.exit(1);
}

const diag = new Diagnostics();

const course = parseCourseFile(
  readFileSync(join(CONTENT, 'courses', slug, 'course.md'), 'utf8'),
  diag, { file: `courses/${slug}/course.md` },
);
const profile = profileArg ?? course.profile;   // §5.10：CLI 覆寫優先

const blocks = new Map();
for (const dir of readdirSync(join(CONTENT, 'blocks'))) {
  const path = join(CONTENT, 'blocks', dir, 'block.md');
  if (!existsSync(path)) continue;
  const block = parseBlockFile(readFileSync(path, 'utf8'), diag, { file: path });
  if (block.id) blocks.set(block.id, block);
}

const questions = loadQuestions(
  readdirSync(join(CONTENT, 'kb', 'qbank'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => ({ path: f, text: readFileSync(join(CONTENT, 'kb', 'qbank', f), 'utf8') })),
  diag,
);

const courseAst = buildCourseAst({ course, blocks, questions }, diag);
const slides = toDeck(courseAst, { profile }, diag);

let deckHtml = renderDeck(slides, { course, profile });
const podiumHtml = renderPodium(slides, { courseAst, diag, course });

mkdirSync('dist', { recursive: true });

const cssText = readFileSync('design/styles.css', 'utf8')
  + readFileSync('design/components.css', 'utf8');

const notesTexts = courseAst.sections.flatMap((s) =>
  s.blocks.flatMap((b) => (b.nodes ?? []).filter((n) => n.type === 'notes').map((n) => n.text)));

if (single) {
  const fonts = await subsetFonts(deckHtml, fontPaths(), diag);
  const images = [];

  deckHtml = await bundleSingle(deckHtml, {
    cssFiles: [{ path: 'design/styles.css', text: cssText }],
    jsFiles: [
      { path: 'runtime/deck-stage.js', text: readFileSync('runtime/deck-stage.js', 'utf8') },
      { path: 'runtime/deck-script.js', text: readFileSync('runtime/deck-script.js', 'utf8') },
    ],
    fonts,
    imageResolver: async (src) => {
      const abs = join(CONTENT, 'courses', slug, src);
      const { buffer, bytes } = await optimizeImage(abs, { maxWidth: 1600, format: 'webp' }, diag);
      images.push({ name: src, bytes });
      return { mime: 'image/webp', buffer };
    },
  });

  writeFileSync('dist/deck.single.html', deckHtml);
  writeFileSync('dist/podium.single.html', podiumHtml);
  checkAssetBudget({
    deckSingleBytes: Buffer.byteLength(deckHtml),
    images,
    fontBytes: fonts.reduce((n, f) => n + f.bytes, 0),
  }, diag);
} else {
  writeFileSync('dist/deck.html', deckHtml);
  writeFileSync('dist/podium.html', podiumHtml);
}

checkArtifact(deckHtml, { cssText, isStudentFacing: true, notesTexts }, diag);
checkArtifact(podiumHtml, { cssText, isStudentFacing: false, notesTexts }, diag);

console.log(diag.toReport());
process.exit(diag.hasErrors() ? 1 : 0);

function fontPaths() {
  const dir = 'design/fonts-src';
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /\.(ttf|otf|woff2)$/.test(f))
    .map((f) => ({ family: f.replace(/\.\w+$/, ''), path: join(dir, f) }));
}
```

`src/cli/clean.mjs`：

```javascript
import { rmSync } from 'node:fs';

/**
 * 規格 §9.8：`rm -rf .cache && npm run build` 的輸出
 * 必須與有快取時逐位元組相同。這個指令存在，就是為了讓那件事容易驗證。
 */
for (const dir of ['.cache', 'dist']) {
  rmSync(dir, { recursive: true, force: true });
  console.log(`已刪除 ${dir}/`);
}
```

- [ ] **Step 5: 跑測試確認通過**

Run: `npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/check/artifact.mjs src/cli/ tests/check/
git commit -m "feat: 產物檢查與 build / clean 指令"
```

---

### Task 15: teach watch 迴圈與快取一致性

**延遲預算：存檔 → deck 畫面更新 < 500ms**（§9.1）。這個數字是所有建置決策的判準。

**Files:**
- Create: `src/cli/teach.mjs`
- Test: `tests/cache-consistency.test.mjs`

**Interfaces:**
- Consumes: build CLI 的組裝流程（Task 14）
- Produces: `npm run teach -- <slug>` — watch + 本地預覽伺服器；重建**只做瀏覽器目前開著的 rendition**（通常是 deck + 講台頁），**只建當前這門課**

- [ ] **Step 1: 寫快取一致性測試**

這是 §9.8 的硬性要求，值得一條專屬測試。

`tests/cache-consistency.test.mjs`：

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, rmSync, existsSync } from 'node:fs';

test('刪掉 .cache 之後重建，輸出逐位元組相同', { skip: !existsSync('../lesson-content') }, () => {
  const run = () => execFileSync('node', ['src/cli/build.mjs', 'aigc-comic-p4p6', '--bundle', 'single'], {
    encoding: 'utf8', stdio: 'pipe',
  });

  run();
  const warm = readFileSync('dist/deck.single.html');

  rmSync('.cache', { recursive: true, force: true });
  run();
  const cold = readFileSync('dist/deck.single.html');

  assert.deepEqual(cold, warm, '有快取與無快取的輸出不同——快取設計是壞的');
});
```

- [ ] **Step 2: 跑測試確認會 skip（內容 repo 尚未建立）**

Run: `node --test tests/cache-consistency.test.mjs`
Expected: SKIP（Task 16 建好內容之後這條才會真的跑）

- [ ] **Step 3: 實作 teach**

`src/cli/teach.mjs`：

```javascript
import { watch } from 'node:fs';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { execFileSync } from 'node:child_process';

/**
 * 一條指令（規格 §9.1）。
 *
 * 延遲預算：存檔 → deck 畫面更新 < 500ms。這條預算否決四件事：
 *   - 一次重建七種 rendition → 只重建瀏覽器目前開著的那幾種
 *   - 重建所有引用該片段的課程 → 只建當前這門課，其他列為 stale
 *   - PDF 進 watch 迴圈 → PDF 只在 build --pdf 與 publish 產生
 *   - 每次存檔重算字型子集與圖片 → 兩者都走 §9.8 的內容快取
 *
 * **重建與通報是兩件事**：watch 仍跨檔追蹤引用關係，但只用於通報。
 */
const slug = process.argv[2];
const CONTENT = process.env.LESSON_CONTENT ?? '../lesson-content';
const PORT = 3000;

if (!slug) {
  console.error('用法：npm run teach -- <slug>');
  process.exit(1);
}

let building = false;
let pending = false;

function rebuild() {
  if (building) { pending = true; return; }
  building = true;

  const t0 = performance.now();
  try {
    // split 模式：不打包單檔、不算字型子集，這是 500ms 的關鍵
    execFileSync('node', ['src/cli/build.mjs', slug], { stdio: 'inherit' });
  } catch {
    // build 已把診斷印出來了，watch 不因此結束
  }
  const ms = Math.round(performance.now() - t0);
  console.log(`重建完成 ${ms}ms${ms > 500 ? '（超過 500ms 延遲預算）' : ''}`);

  building = false;
  if (pending) { pending = false; rebuild(); }
}

rebuild();

for (const dir of [join(CONTENT, 'courses', slug), join(CONTENT, 'blocks'), join(CONTENT, 'kb')]) {
  if (!existsSync(dir)) continue;
  watch(dir, { recursive: true }, (_, file) => {
    if (file && /\.(md|ya?ml)$/.test(file)) rebuild();
  });
}

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript' };

createServer((req, res) => {
  const path = req.url === '/' ? '/dist/deck.html'
    : req.url === '/podium' ? '/dist/podium.html'
    : req.url;
  const file = `.${path}`;

  if (!existsSync(file)) { res.writeHead(404); res.end('找不到'); return; }
  res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
}).listen(PORT, () => {
  console.log(`預覽：http://localhost:${PORT}/  講台頁：http://localhost:${PORT}/podium`);
});
```

- [ ] **Step 4: Commit**

```bash
git add src/cli/teach.mjs tests/cache-consistency.test.mjs
git commit -m "feat: teach watch 迴圈，含 500ms 延遲預算回報"
```

---

### Task 16: 內容搬遷 — aigc-comic-p4p6

手動搬遷（§15.3：不寫自動遷移工具——為一個已知有缺陷的舊格式寫相容層，成本高於手搬三門課，而且會把舊格式的假設帶進新系統）。

來源：`agent-skill-lecture-builder-main/lectures/aigc-comic-p4p6/content.md`（357 行，4 個主章節、17 個子章節、10 種元件）。

**Files:**
- Create: `lesson-content/courses/aigc-comic-p4p6/{course.md, config.yaml}`
- Create: `lesson-content/blocks/<block-id>/block.md` × 約 17
- Create: `lesson-content/kb/concepts/*.md` × 15–25
- Create: `lesson-content/kb/qbank/*.md` × 3
- Create: `lesson-private/sources/media/`（19 張原圖）

- [ ] **Step 1: 建內容 repo**

```bash
cd .. && mkdir lesson-content && cd lesson-content && git init
mkdir -p courses/aigc-comic-p4p6/assets blocks kb/concepts kb/qbank kb/media
printf 'dist/\n.cache/\nnode_modules/\n' > .gitignore
```

**用 `git init`，不 clone 舊 repo**（§15.1）：舊歷史帶 87MB 的 `lectures/`，而 `filter-repo` 會改寫所有 commit SHA，使 §5.9 的 `--pin` 從第一天起就指向不存在的提交。

- [ ] **Step 2: 原圖進私有側**

```bash
cd .. && mkdir -p lesson-private/sources/media
cp agent-skill-lecture-builder-main/lectures/aigc-comic-p4p6/assets/images/* lesson-private/sources/media/
```

19 張圖 24MB **不進公開 repo**（§6.7.3）。公開 repo 只放優化後的衍生檔——這個決定必須在**第一次 push 之前**做完，之後再改就是改寫歷史。

- [ ] **Step 3: 先建 concept，再寫片段**

`concepts` 是必填且 `validate` 檢查存在，所以要先手工建 15–25 個（§17.1，約 1 個工作天；ingest 的自動萃取在階段二才有）。

`lesson-content/kb/concepts/prompt.four-elements.md`：

```markdown
---
id: prompt.four-elements
title: Prompt 四要素
aliases: [四要素, 提示詞四要素, prompt formula]
prereq: []
related: [prompt.negative, prompt.iteration]
---

一個好的 Prompt 要講清楚四件事：主體、特徵、風格、畫面設定。缺哪一項，AI 就自己猜哪一項。
```

依同一格式建立其餘 concept。命名前期定不好是已知風險（§21），用 `aliases` 機制緩解，**id 一經引用即不改**；前 20 個刻意放慢。

- [ ] **Step 4: 搬第一個片段，驗證管線通**

`lesson-content/blocks/explain.prompt-four-elements.kids/block.md`：

```markdown
---
id: explain.prompt-four-elements.kids
type: explain
title: Prompt 四要素（給小學生的講法）
concepts: [prompt.four-elements]
duration: 4
audiences: [kids, teen]
assertion: 講得越清楚，AI 畫得越準
---

想像你在跟一個很厲害、但完全不會猜心思的畫師講話。

[image-text position="left" width="45"]
![四要素公式](assets/four-elements.webp)
主體 + 特徵 + 風格 + 畫面設定 = 好 Prompt
[/image-text]

[notes]
這裡一定要停下來問「不會猜心思是什麼意思」。
去年這句沒鋪，後面 iteration 那段整段接不上。
[/notes]

[q:q.prompt.four-elements.01]
```

- [ ] **Step 5: 改寫兩個 D 類元件**

依 `docs/slide-semantics.md` 的表：

| 原文位置 | 舊寫法 | 改成 |
|---|---|---|
| 咒語篇 | `[bonus title="加碼：negative prompt"]...[/bonus]` | 片段中 `### 加碼：negative prompt {level=deep}`，`course.md` 該片段加 `cut: 2` |
| 交付篇 | `[vote id="best-work" title="最喜歡哪一張"]...[/vote]` | `[callout type="tip" title="舉手投票"]` + 口頭引導；作品牆評價留到階段三 |

- [ ] **Step 6: 寫 course.md**

`lesson-content/courses/aigc-comic-p4p6/course.md`：

```yaml
---
slug: aigc-comic-p4p6
title: AI 創想實驗室：從零打造你的動漫角色
profile: kids
duration: 180
tools: [quiz, timer]
objectives:
  LO1:
    text: 能說出 Prompt 四要素並各舉一例
    bloom: recall
    concepts: [prompt.four-elements]
  LO2:
    text: 能針對不滿意的生成結果，指出該補哪一個要素
    bloom: apply
    concepts: [prompt.four-elements, prompt.iteration]
sections:
  - title: 裝備篇：認識你的團隊
    time: 30
    lo: []
    blocks:
      - explain.ai-partner.kids
      - demo.ai-creativity.kids
  - title: 咒語篇：掌握指令的藝術
    time: 45
    lo: [LO1]
    blocks:
      - explain.prompt-four-elements.kids
      - demo.prompt-upgrade.kids
      - explain.style-library.kids
      - block: demo.leonardo-tool.kids
        cut: 1
      - block: explain.prompt-negative.kids
        cut: 2
  - title: 實戰篇：接受委託，創造角色
    time: 70
    lo: [LO2]
    blocks:
      - activity.warmup-challenge.kids
      - demo.commission-brief.kids
      - activity.create-character.kids
      - demo.debug-iteration.kids
  - title: 交付篇：展示你的傑作
    time: 35
    lo: []
    blocks:
      - demo.delivery-flow.kids
      - activity.gallery.kids
      - explain.wrap-up.kids
---
```

**注意 LO2 宣告 `bloom: apply`**，依 §5.6 (c)，必須有一題 `bloom` 不低於 `apply` 的題目（`short` 或 `task`）綁到 `prompt.four-elements` 或 `prompt.iteration`，否則對齊報告會標「考的層次配不上寫的目標」。第一刀對齊檢查尚未實作（留到階段二），但**題目現在就要照這個標準寫**，否則階段二一開檢查會一次爆出來。

- [ ] **Step 7: 搬完其餘片段，跑 build**

Run: `LESSON_CONTENT=../lesson-content npm run build -- aigc-comic-p4p6 --bundle single`
Expected: 退出碼 0，`dist/deck.single.html` 產生，資產預算報告顯示單檔 < 8MB

若單檔超過 8MB，先看 `budget-image` 警告列出哪幾張圖沒壓到 300KB 以下。

- [ ] **Step 8: 跑快取一致性測試（這時它不再 skip）**

Run: `npm test`
Expected: PASS，含 `tests/cache-consistency.test.mjs`

- [ ] **Step 9: Commit（兩個 repo 各一次）**

```bash
cd ../lesson-content
git add . && git commit -m "feat: 搬入 aigc-comic-p4p6，17 個片段與第一批 concept"

cd ../lesson-engine
git add . && git commit -m "test: 快取一致性測試接上真實內容"
```

---

### Task 17: 離線驗收

**驗收：用它上完一堂 `aigc-comic-p4p6`，投影與講稿全程來自新系統**（§17.1）。

**Files:**
- Create: `tests/offline/single-file.test.mjs`
- Create: `docs/上課前檢查清單.md`

- [ ] **Step 1: 寫離線載入測試**

`tests/offline/single-file.test.mjs`：

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { existsSync, statSync } from 'node:fs';

const DECK = 'dist/deck.single.html';

test('單檔在完全離線的瀏覽器中可用', { skip: !existsSync(DECK) }, async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ offline: true });
  const page = await context.newPage();

  const blocked = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('file://') && !r.url().startsWith('data:')) blocked.push(r.url());
  });

  await page.goto(`file://${process.cwd()}/${DECK}`);
  await page.waitForSelector('deck-stage');

  assert.deepEqual(blocked, [], `離線時仍嘗試連外：${blocked.join(', ')}`);

  const slideCount = await page.locator('deck-stage section').count();
  assert.ok(slideCount > 10, `投影片只有 ${slideCount} 張，內容沒有正確載入`);

  // 頁碼由 JS 推導，不得為空
  await page.keyboard.press('ArrowRight');
  const num = await page.locator('section:visible .num').first().textContent();
  assert.match(num.trim(), /\d/, '頁碼沒有被 JS 填上');

  await browser.close();
});

test('單檔大小在預算內', { skip: !existsSync(DECK) }, () => {
  const mb = statSync(DECK).size / 1024 / 1024;
  assert.ok(mb < 8, `deck.single.html ${mb.toFixed(1)}MB 超過 8MB 預算`);
});
```

- [ ] **Step 2: 跑測試確認通過**

Run: `npm test`
Expected: PASS

- [ ] **Step 3: 寫課前檢查清單**

`docs/上課前檢查清單.md`：

```markdown
# 上課前檢查清單

課前一天做完，不要在講台上做。

- [ ] `npm run build -- aigc-comic-p4p6 --bundle single`，退出碼為 0
- [ ] `dist/deck.single.html` 與 `dist/podium.single.html` **複製到講台筆電本機**
      （不是雲端硬碟連結——斷網時你打不開它）
- [ ] 在講台筆電上雙擊開啟 `deck.single.html`，翻到最後一頁再翻回來
- [ ] 第二螢幕或平板開 `podium.single.html`，確認翻頁時講稿跟著換
- [ ] 投影解析度確認：deck 為固定 1920×1080 canvas，自動縮放
- [ ] 紙本備援：講稿印一份（講台頁 Ctrl+P）

## 掛掉的時候

| 掛掉的東西 | 還能做什麼 |
|---|---|
| 教室無網路 | 全部照常——兩份檔案都是本機的 |
| 投影電腦掛掉 | 換一台，雙擊 `deck.single.html` |
| 兩台都掛掉 | 紙本講稿 |
```

- [ ] **Step 4: 實際上一堂課**

這一步不是自動化測試。上完之後記錄三件事（§18）：

1. 後測正確率（5 題 `holdout` 題，印在紙上、當場作答、手動統計）
2. 課堂完成度（有沒有講完）
3. 備課耗時（自記）

**第一階段的後測不產 PDF**——用 `page.html` 的列印樣式按 Ctrl+P，或手寫一張 A4。重點是有沒有收到那五題的正確率，不是它從哪個工具印出來。

- [ ] **Step 5: Commit**

```bash
git add tests/offline/ docs/上課前檢查清單.md
git commit -m "test: 離線單檔驗收與課前檢查清單"
```

---

## 中止條件

**五週**內做不到 Task 17 的驗收（用新系統上完一堂 `aigc-comic-p4p6`，投影與講稿全程來自新系統），**停手**，改走 §1.9 的修補路線（4–6 週）。

為什麼是五週而不是三週：第一刀的估計是 3–4 週（§19）。中止條件若貼著估計值訂，觸發的多半是「工時估錯了一點」，而不是「設計有問題」——那會讓你放棄一個其實正確的設計。

**驗收時明確允許的例外**（用了不算失敗，因為這些的 renderer 本階段根本沒做）：

- 練習卷與講義沿用既有紙本或舊系統產出
- 作品展示用實體方式（便利貼、實體展示）
- 沒有課堂即時資料回收

---

## 自我檢查

**1. 規格涵蓋**

| §17.1 列的項目 | 對應 task |
|---|---|
| 先決工作：為 6 個元件決定投影片語意 | Task 2 |
| `parse.mjs`——只實作這 10 種 | Task 4（8 種 + `[q:]` + `[notes]`；bonus / vote 為 D 類不實作，見 Task 16 Step 5） |
| 建立第一批 concept（15–25 個） | Task 16 Step 3 |
| `renderers/deck.mjs`（含前置轉換層） | Task 7 + Task 8 |
| `renderers/podium.mjs` 最小版（§6.6 的 1、2、7） | Task 9 |
| 字型子集、單檔打包 | Task 11、Task 12 |
| `quiz.mjs` 與 `timer.mjs`（本機模式） | Task 13 |
| `validate` 的產物檢查（§6.5 前四項）與 §5.12 壞引用 | Task 14、Task 5、Task 6 |
| §9.5 的三項測試（parse 單元、deck/podium golden、單檔離線） | Task 4–6、Task 8–9、Task 17 |
| 手搬 `aigc-comic-p4p6` | Task 16 |
| 圖片管線與資產預算（修訂 5 加入） | Task 10 |

**未涵蓋且刻意不做**（§17.1 明列的「不做的」）：ingest、其餘五個 renderer、課堂層、Colab、個人化練習、版本鎖定、瀏覽器輕編輯、`assert` 工具、bloom 對齊檢查（欄位先寫進格式，檢查邏輯留到階段二）。

**2. 一處規格與現實的落差已在計劃中處理**：§6.2.2 的對映表指定的 CSS class 有一批不在 `styles.css` 中，其中三個（`.compare-table` / `.step-track` / `.tag-row`）任何來源都沒有。Task 3 補齊，並用測試釘住——否則 §6.5 的 `undefined-class` 檢查會在第一次 build 就全紅。

**3. 型別一致性**：`Diagnostics.add(level, code, message, ctx)` 貫穿全部 task；`Block` / `Course` / `Question` / `Slide` 的欄位在 Task 5、6、7 定義後，Task 8、9、14 沿用同名欄位；`cacheKey` / `readCache` / `writeCache` 在 Task 10 定義，Task 11 沿用。

---

## 執行順序建議

Task 1–3 可一天內做完，之後 Task 4–9 是主幹（約兩週），Task 10–13 可與主幹並行（都不依賴 renderer 內部），Task 14–17 收尾。

**Task 2 不要跳過也不要壓縮。** 它是設計工作，產出的 golden 期望值決定了 Task 8 寫什麼。跳過它直接寫 renderer，等於邊寫邊決定語意——那是舊系統 30 個元件長成今天這樣的原因。
