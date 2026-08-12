# 課程系統 v2 設計規格

- 日期：2026-08-12
- 修訂 1：加入單元跨課程重用、教師知識庫、共用工具軟連結、Colab／QR、從零重建、full_template 投影片設計系統
- 修訂 2：依 20 年教學經驗審查後全面修訂——重用原子下修為「片段」、垂直切片砍半並加中止條件、對齊檢查改為報告制、加入有效性量測與工時估計
- 修訂 3：依十種受眾角度的審查（33 條）修訂——補上講台頁、認知層次檢查、版本還原機制、測試策略、修補路線對照；並修正第一刀的範圍與驗收矛盾
- 修訂 4：依實際清點舊系統內容後的審查修訂——以真實使用次數重寫元件對映、加入元件分類、`tidy` 與檢索、補齊第一刀的隱藏工作
- 修訂 5：依工程效率審查修訂——加入圖片管線與資產預算、開發迴圈延遲預算、建置快取；並以減法簡化三處（mastery 改 view、砍掉 WebSocket、Puppeteer 改選用）
- 狀態：已確認，待轉為實作計劃
- 範圍：教學系統的終局設計，以及第一階段的實作切片

> **本文件的效力**：只有 **§17.1（第一刀）是承諾**，四到六週內兌現或依 §1.9 轉向。
> §1–§16 是終局設計意圖，§20 的決策 15 以後多數服務於階段三、四的功能，**在第一堂真課上完之前都未經現實檢驗**。
> 第一堂課結束後，允許（且應該）依實際使用推翻其中任何一條。

---

## 1. 背景

現況系統（`agent-skill-lecture-builder-main`）已具備相當完整的講義生成能力：22 門課程、30+ 種 Markdown 元件、8 種課堂工具、6 個 AI Skills。以 20 年教學經驗的視角審視後，確認它是一套優秀的**講者用單頁講義生成器**，但尚未成為**教學系統**。

以下問題來自對現有程式碼的實際審查，每一條都可定位到檔案：

### 1.1 備課鏈路：系統只吃「主題」，不吃老師既有資產

- `content-drafting/SKILL.md` 的輸入僅 `topic` / `audience` / `duration` 三個參數，全鏈路沒有任何管道讀取既有 PPTX / DOCX / PDF / 舊教案。結果是 AI 從零生成，而非重組老師的既有積累。
- 22 個 `lectures/` 之間沒有共用題庫、案例庫、定義庫。同一個定義要改 N 個 `content.md`。
- 修改一句話需執行 4 條指令（`build.mjs` → `generate-og.mjs` → `build-index.mjs` → commit 三個產出物），課前 5 分鐘無法完成。

### 1.2 課程是複製的，不是組合的

同一個「Prompt 四要素」概念，在小學課、考試輔助課、家長講座中各自被重寫一次，三份互不相干。教了 20 年累積的教學資產，在這個結構下無法複利。

**但複利的單位不是「課」，也不是「一節 20 分鐘的單元」。** 真正會被重複使用的是：講了八年每次都有效的那個比喻、學生一看就懂的那張對照圖、能問出誰在裝懂的那道題。這些東西的長度是 1–5 分鐘。內容模型的原子必須切在這個尺度上，否則重用機制只是多一層目錄（見 §5）。

### 1.3 雙真相來源

| 產物 | 來源 | 可修改途徑 |
|---|---|---|
| `lectures/<c>/index.html` | `content.md` → `build.mjs` | 改 md 後 rebuild |
| `lectures/<c>/slides_學生版.html` | 手工維護 | 僅能透過 `editor/` |

兩者無任何連結（`index.html` 中不存在 `slides_` 字串）。`editor/editor.js:487` 的儲存路徑是 `showSaveFilePicker`，退化時 `downloadBlob` 產生一份新 HTML。因此：editor 中的修改在下次 rebuild 後消失；`content.md` 的修改不會反映到 deck。教學現場必然發生「不確定哪一份是最新版」。

### 1.4 規範與實作脫節

`CLAUDE.md:211` 規定「無外部執行期相依、禁止加入任何 CDN」，但 `lectures/aigc-comic-p4p6/index.html` 實際引用：

- `:16-18` Google Fonts
- `:27` cdnjs 的 `qrcode.min.js`
- `:9` favicon 指向 googleusercontent 個人頭像 URL

教室網絡封鎖或斷線時：字體 fallback 導致版面位移、QR 分享功能失效、頭像破圖。個人 Google 頭像硬編入每一頁另有隱私與長期失效風險。

### 1.5 系統中沒有「學生」

- Quiz 結果僅寫入 `localStorage`（`assets/course.js:2863-2864`），老師取不到任何「誰不會、哪題全班錯」的資料。
- **題目 id 不穩定**：`build.mjs:685` 以 `'q-' + question.toLowerCase().replace(...).slice(0, 20)` 產生 id。題幹改一個字 id 即變動，兩題開頭 20 字相同即碰撞。作答資料無法跨版本累積——這是「課後個人練習」的前置阻斷點。
- 投票後端為 Google Apps Script 公開端點，前端每 5 秒輪詢（`assets/course.js:2503`），配額與延遲在 30 人班會吃緊，且任何人可灌票。
- 完全沒有課前預習形態：無前測、無截止、無交件狀態。

### 1.6 5–80 歲：可調的是外觀，不是內容

- A1–A5 字級、8 色主題、深淺色皆已具備，但 5 歲與 80 歲的差異在於**閱讀層級、資訊密度、互動方式**，而非字級。
- 互動全綁鍵盤快捷鍵（20 條），是為「講者用筆電」設計；平板、手機、觸控白板無等效大按鈕路徑。
- 八件課堂工具全部是講台工具（計時器、抽籤、投票、Quiz、聚光燈、放大鏡、塗鴉筆、QR），缺學生之間的互動。`lectures/aigc-comic-p4p6/content.md:309-326` 設計了「設計師畫廊、便利貼寫人設、投票選最佳」，但系統只支援投票，展示與互評退回實體便利貼——系統無法承接自己課程設計的產出。
- `content.md` 無時間標記，計時器與課程結構脫鉤，無法支援「落後 8 分鐘該砍哪一段」。

### 1.7 教學法層面

- Quiz 僅單選／是非，答錯給一句 Hint。無錯題本、無分層提示、無開放題。
- `content-review` 只檢查「說明→範例→實作」節奏，不檢查**學習目標↔評量↔活動的對齊**（constructive alignment）。節奏正確但教的與考的無關，是這套 AI 教研流程最大的教學法漏洞。
- **更深一層**：即使補上對齊檢查，若只驗「概念有出現」而不驗**認知層次**，仍然攔不住「LO 寫『能指出該補哪個要素』（應用），配的卻是回憶型單選」。§5.6 因此納入 bloom 欄位。

### 1.8 為何重建而非修補

現況系統是從他人的 template fork 而來，其結構假設與個人使用方式不符。以下四項是結構性的，修補的成本高於重寫：

| 項目 | 現況 | 為何無法修補 |
|---|---|---|
| 內容原子 | 課程即檔案 | 改成片段組合等於改寫 parse／build／目錄全鏈路 |
| `build.mjs` | 單檔 1,871 行，含自寫 YAML 解析與 id 推導 | 多產物 + 多層內容模型無法掛在這個結構上 |
| 產物入 git | `CLAUDE.md` 要求 commit 三個產出物 | 與「git 只放課程內容」直接對立 |
| 投影片版面 | 原作者的 index.html 設計 | 目標版面是 `full_template` 的設計系統，兩者無交集 |

決定：**新建 repo，舊 repo 凍結為唯讀參考**。細節見 §15。

### 1.9 修補路線的成本對照（決策的另一半）

「修補成本高於重寫」若只是斷言，就不足以支撐一個三到六個月的決定。實際估算如下：

| 修補項目 | 估計 | 修得掉嗎 |
|---|---|---|
| 題目 id 改為人為指定（改 `build.mjs:685` + 手動補 id） | 3–5 天 | 可以 |
| 抽出共用題庫 `kb/qbank/`，`content.md` 改為引用 | 3–5 天 | 可以 |
| deck 單一真相來源（為 `slides_學生版.html` 版面寫 renderer，廢掉 `editor/` 的下載式儲存） | 2–3 週 | 部分——等於重做一半的 build |
| 移除外部相依（字型子集、本地 QR、拿掉頭像） | 2–3 天 | 可以 |
| **小計** | **4–6 週** | |

修補路線換得到：id 穩定、共用題庫、單一 deck 來源、離線可用。**這已經解掉 §1.3 與 §1.5 前半的大部分痛。**

修補路線換不到：片段重用模型（§1.2）、六種產物、學生身分與課後練習（§1.5 後半）、profile 分層（§1.6）。這四項要動 parse／build／目錄全鏈路，等同重寫。

**決策不變（從零重建），但退路改寫：** §17.1 的中止條件觸發時，退路**不是「回舊系統原樣、重新評估」**，而是**直接走這條 4–6 週的修補路線**。這讓中止不再是損失，而是切換到一個已經估過價的替代方案。

---

## 2. 目標與非目標

### 目標

1. **重用**：教學片段（一個講法、一次示範、一個練習）為可獨立引用的原子；改一次，所有引用它的課程同步更新。
2. **知識資產化**：教師個人的知識點、案例、題目、教法筆記成為可連結、可累積、可查詢的個人知識庫。
3. **備課**：系統能吃進既有的 PPTX / DOCX / PDF / 舊 HTML deck，重組為結構化片段；修改後一條指令重建全部產物。
4. **單一真相來源**：投影片、講義、練習卷、預習頁、學生入口全部為 build 產物；已發放給學生的紙本以版本鎖定，不容許無聲分岔。
5. **課前預習 / 課後個人練習**：具備學生身分與作答資料，能據此提案個人化練習（老師確認後發出）。
6. **5–80 歲、多受眾**：同一個知識點可掛多個講法片段，課程按受眾挑選；profile 控制內容深度與呈現。
   **階段性說明**：`kids` / `adult` 於階段一可用；`senior` 與 TTS 於階段二交付（見 §17.2）；注音於階段五。在階段二完成前，系統實際服務的年齡下限約為 8 歲、上限無特別支援。這個範圍不寫進對外說法，直到它成立。
7. **課堂互動**：從「老師對全班」擴充到「學生之間」；且在無學生裝置的教室仍可運作。
8. **軟連結**：投影片引用題目、圖片、片段，而非內聯複本；是否內聯由 build 決定，不由作者決定。
9. **可驗證**：能回答「用新系統教，學生是不是學得更好」，而不只是「備課變快了」。

### 非目標

- 不做學習管理系統（LMS）的完整功能：不做排課、不做出席、不做成績單、不做家長帳號體系。
- 不做多老師／多機構的權限系統。本系統為單一老師（可多班）使用。
- 不做即時視訊或線上直播課。
- 不做知識圖譜的視覺化瀏覽器（concept 之間的關係僅供機器使用）。
- 不寫舊格式的自動遷移工具；舊課程手動搬（見 §15.3）。
- 不做「片段套裝」這一層（見 §20 決策 7 的取捨說明）。
- **不做紙本作答的自動辨識**（拍照 OCR 判卷）。紙本回收路徑見 §12.3。

---

## 3. 設計原則

1. **一個來源，多種產物** — 教材只寫一次。
2. **重用先於複製** — 內容的原子是片段不是課程；發現在兩門課寫同一件事，就是該抽片段了。
3. **軟連結為來源，內聯為產物** — 作者永遠寫引用；要不要打包成單檔是 build 選項。
4. **教室優先** — 斷網、觸控、投影、學生沒有裝置，都是硬需求，不是降級情境。
5. **互動必須留下診斷訊號** — 任何學生的點擊，若不能回答「他哪個知識點沒懂」，就不值得做。
6. **檢查給建議，不擋路** — 教學品質的檢查一律先出報告；只有在對外發布時才升級為阻斷。擋住 build 的檢查會被繞過，而繞過的方式（隨手掰一題湊數）比不檢查更傷。
7. **人在迴路裡** — 系統提案，老師決定。尤其是出給學生的練習與呈現給全班的內容。
8. **投影畫面上不出現只有老師該看的東西** — 對齊警告、答錯名單、講稿、版本差異，全部在講台頁（§6.6）。
9. **不鎖死** — 教材永遠是純文字檔，可隨時脫離本系統。

---

## 4. 整體架構

```
kb/concepts/          知識點（全域骨幹）
      ▲
      │ 引用
blocks/<id>/block.md  教學片段（重用原子：explain / demo / activity）
kb/qbank/<id>.md      題庫
      ▲
      │ 編排
courses/<slug>/course.md  ── 章節 + 片段序列 + cut 優先序
      │
build │  ──► course.lock（版本鎖定：內容 hash + git commit SHA）
      ▼
  deck / podium / page / handout / worksheet / preview / student-portal
      │
      ├──► GitHub Pages（靜態教材、Colab notebook）
      └──► Zeabur 課堂層 ──► 學生資料 ──► 個人化練習提案 ──► 老師確認 ──► 發出
```

| 層 | 位置 | 職責 |
|---|---|---|
| 知識層 | `kb/`（檔案） | 知識點、題庫；教師個人筆記另存私有 |
| 教材層 | `blocks/` + `courses/`（檔案） | 片段為重用原子，課程為編排檔 |
| 建置層 | 本機 Node CLI + AI Skills | ingest、assert、render、bundle、publish、test |
| 課堂／學習層 | Zeabur 或自架 Docker（Node + Postgres） | 課堂即時互動、學生資料、個人化練習 |

### 4.1 層間介面（僅兩個）

1. **Build 產物**：靜態檔案，課堂層以 URL 引用。
2. **`ContentProvider` 介面**：課堂層讀取教材元資料只能透過此介面。

```ts
interface ContentProvider {
  getCourse(slug: string): Promise<CourseMeta>;        // 標題、objectives、章節、片段序列、time、cut
  getQuestions(slug: string): Promise<Question[]>;     // 穩定 id、concept、bloom、題型、選項、答案
  getConcepts(ids: string[]): Promise<Concept[]>;      // 個人化練習用，含 prereq
  listCourses(): Promise<CourseSummary[]>;
}
```

第一階段實作 `FileContentProvider`（讀 build 產出的 `course.json`）。若日後決定將教材遷入資料庫，只需新增 `DbContentProvider`，課堂層不動。**這道邊界是整份設計中唯一為「未來遷移」付出的成本，刻意保留。**

---

## 5. 內容模型

### 5.1 三層原子

| 原子 | 粒度 | 職責 | 跨課程 |
|---|---|---|---|
| **知識點** concept | 一個可獨立評量的概念 | 全域識別碼；連結片段、題目、學生弱點 | 是 |
| **片段** block | 1–20 分鐘 | 教學內容本體，重用原子 | 是 |
| **課程** course | 一堂或一系列課 | 編排：章節、片段序列、時間、砍的優先序 | — |

**知識點是全域骨幹。** 學習目標（LO）是課程層的陳述句，綁定到一或多個 concept；題目掛 concept 而非掛 LO。因此「這個學生 `prompt.negative` 一直不會」跨課程成立，而「LO2 沒達標」只在單一課程內有意義。

**片段是重用原子，不是「單元」。** 一個 20 分鐘的教學段落，在小學版與教師培訓版之間幾乎沒有共同的 20 分鐘；但那個比喻、那張圖、那道題是共同的。把原子訂在 20 分鐘，實務上的結果是老師發現套不上就 fork，兩份分岔，重用機制形同虛設。

片段分三型：

| type | 長度 | 內容 | `assertion` |
|---|---|---|---|
| `explain` | 1–5 分鐘 | 一個概念的**一種**講法。同一 concept 可有多個 explain（給小學的、給教師的、給長者的） | **必填** |
| `demo` | 3–10 分鐘 | 一次操作示範、一個案例、一次拆解 | 選填 |
| `activity` | 5–20 分鐘 | 一個練習、一個討論、一次動手做 | 選填 |

「同一主題不同受眾」以**選不同片段**表達，不是在同一份檔案裡開條件塊。

### 5.2 檔案佈局

公開內容 repo（`lesson-content`）：

```
blocks/<block-id>/
├── block.md               # 片段內容
└── assets/                # 片段專屬圖片
courses/<slug>/
├── course.md              # 編排檔（唯一真相來源）
├── course.lock            # 版本鎖定（發布時產生，見 §5.9）
├── config.yaml            # 課程設定（維持兩層 deep merge）
├── assets/                # 課程專屬圖片
└── notebooks/*.ipynb      # Colab notebook（公開才能一鍵開啟）
kb/
├── concepts/<id>.md       # 知識點：識別、關係、給學生看的簡短定義
├── qbank/<id>.md          # 題目，單題一檔
└── media/                 # 跨片段共用圖庫
```

（golden-file 測試案例屬於引擎的規格，存於 `lesson-engine` 的 `tests/golden/`，不放內容 repo。見 §9.5。）

**`assets/` 與 `kb/media/` 存的是優化後的衍生檔**（WebP / 壓縮 PNG，見 §6.7），不是生成工具的原始輸出。原圖存在 `lesson-private/sources/media/`。

私有（本機目錄或私有 repo，`lesson-private`）：

```
kb/notes/<concept-id>.md   # 教師個人教法筆記、踩雷紀錄、素材出處
sources/                   # ingest 的原始 PPTX / DOCX / PDF
sources/media/             # 未壓縮原圖（見 §6.7.3）
rosters/                   # 學生名單（選用）
```

**私有部分為選用掛載。** 以環境變數 `LESSON_PRIVATE=../lesson-private` 指向；未設定時 build 仍完整成功，僅教師註解與私有講稿不輸出。公開 repo 必須自給自足——這是「內容公開、知識庫私有」能同時成立的前提。

### 5.3 知識點規格

```markdown
---
id: prompt.negative
title: Negative Prompt（反向提示詞）
aliases: [反向提示詞, 負面提示, negative prompt]
prereq: [prompt.four-elements]
related: [image.style-control]
---

告訴 AI「不要出現什麼」的指令。與正向描述互補，用於排除常見的生成瑕疵。
```

規則：

1. `id` 採點分命名空間（`領域.概念`），全域唯一，**一經被引用即不得更改**。更名走 `aliases`。
2. body 為給學生看的簡短定義（1–3 句），build 時輸出到講義的術語表。
3. 教師個人的教法、常見誤解、失敗經驗寫在私有的 `kb/notes/<id>.md`，以 `[[concept-id]]` 互連。
4. `prereq` 供個人化練習使用：學生某 concept 未達標時，先檢查其前置是否也未達標，優先補前置。

### 5.4 片段規格

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

[formula]
主體 + 特徵 + 風格 + 畫面設定 = 好 Prompt
[/formula]

[notes]
這裡一定要停下來問「不會猜心思是什麼意思」。去年這句沒鋪，
後面 iteration 那段整段接不上。
[/notes]

### 加碼：negative prompt {level=deep concepts=prompt.negative}

畫面裡不想要什麼，也要講。

[q:q.prompt.four-elements.01]
```

規則：

1. `id` 慣例為 `<type>.<主題>.<變體>`，全域唯一。
2. `concepts` 為片段層宣告；`###` 可用 `{concepts=}` 追加更細的綁定。
3. `duration` 為預估分鐘數，供課程編排時加總與節奏條使用。
4. `audiences` 宣告本片段是為哪些 profile 寫的。不參與內容過濾，只用於：（a）`validate` 在課程 profile 不在此清單時發出 **warning**；（b）搜尋可重用片段時篩選。
5. `assertion` 為投影片的主張式標題（一句完整的話），由 `npm run assert` 提案後人工確認（見 §8.3）。
   - **僅 `explain` 型必填**。`demo` 與 `activity` 選填——硬要為「現在來做練習」擠出一句主張，只會稀釋真正有主張的那幾頁。
   - 依 §3 原則 6 分級：`explain` 缺 assertion 時，`build` 為 warning（投影片以片段 `title` 暫代並在講台頁標示待處理），`publish` 為 error。
6. `{level=basic|core|deep}` 決定內容顆粒，預設 `core`。
7. `[only aud=... level=...]…[/only]` 為區塊層條件輸出，**僅供微調**（一個詞、一句補充）。多值以逗號分隔。未宣告條件的區塊一律輸出；宣告了條件但與當前 profile 不匹配的區塊**完全不輸出**。
   - **`validate` 在單一檔案出現超過 3 個 `[only]` 時警告：「這裡該拆成不同片段了」。** 條件塊會腐化成 ifdef 地獄——半年後沒有人能不 build 就說出小學生到底看到什麼。受眾差異的正解是拆片段，不是加分支。
8. 片段內以 `[q:<question-id>]` 引用題目，不內嵌題目全文。
9. 片段不得引用其他片段。組合是課程的職責，片段之間沒有相依關係——這是重用可預測的前提。
10. **`[notes]…[/notes]` 為講者備註**，只輸出到講台頁（§6.6），**與 profile 無關**，任何學生產物都不含它。公開 repo 中的 `[notes]` 視為可公開的教學提示；不宜公開的寫進私有 `kb/notes/`。

### 5.5 課程編排檔

```yaml
---
slug: aigc-comic-p4p6
title: AI 創想實驗室：從零打造你的動漫角色
profile: kids
duration: 180
tools: [quiz, timer, wall]
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
  - title: 咒語篇：掌握指令的藝術
    time: 18
    lo: [LO1]
    blocks:
      - explain.prompt-four-elements.kids
      - demo.prompt-iteration.character
      - block: activity.prompt-rewrite.worksheet
        cut: 1
      - block: explain.prompt-negative.kids
        cut: 2
---
```

規則：

1. `blocks` 支援兩種寫法：字串（片段 id）或物件（`block` + 課程層屬性）。
2. **`cut` 是課程層屬性，不是片段屬性。** 同一個片段在 A 課是核心、在 B 課是加碼，砍的優先序只有在編排時才決定得了。詳見 §5.7。
3. `course.md` 的 front-matter 以下可寫課程專屬的開場與結尾內容（不值得抽成片段者）。
4. `objectives` 的每個 LO 必須至少綁一個 concept 並宣告 `bloom`；`validate` 檢查該 concept 存在。
5. `tools` 宣告本課要載入的講台工具，build 只打包宣告者（見 §7）。
6. **`sections[].time` 與其下片段 `duration` 加總不一致時，`time` 為準**（老師的編排意圖優先於片段的預估）。差距超過 20% 時 `validate` 警告，並在講台頁節奏條標示「本章預估 25 分、排 18 分」。
7. **constructive alignment 檢查**（見 §5.6）。

### 5.6 對齊檢查：報告制，不擋 build

課程的每個 LO 所綁的 concept，應同時滿足：

- **(a)** 至少出現在一個被引用片段的 `concepts` 中 —— 缺少即「有考沒教」
- **(b)** 至少出現在一題被引用題目的 `concept` 中 —— 缺少即「有教沒考」
- **(c)** 該 LO 所綁 concept 對應到的被引用題目中，**至少一題的 `bloom` 不低於 LO 宣告的 `bloom`** —— 缺少即「考的層次配不上寫的目標」

第 (c) 項是 §1.7 真正的洞。`LO2: 能針對不滿意的生成結果指出該補哪個要素`（`apply`）若只配了回憶型單選，(a)(b) 都會通過，而評量根本無效。

**認知層次詞彙（只有四級，刻意不細分）**：

| bloom | 意思 | 什麼樣的題能證成 |
|---|---|---|
| `recall` | 記得住 | 單選、是非 |
| `understand` | 講得出、辨得出 | 單選（含情境干擾項）、配對 |
| `apply` | 用得出來 | 給一個壞掉的產出，要學生指出／改寫（`short`、`task`） |
| `analyze` | 拆得開、比得出 | 開放題、作品評析（`task`） |

**(a)(b)(c) 一律不中止 build。** 分級處理：

| 指令 | 行為 |
|---|---|
| `npm run build` / `teach` | 產出 `dist/alignment.md` 報告；講台頁頂部顯示橫幅：「本課有 2 個 LO 尚未配題、1 個 LO 的評量層次偏低」 |
| `npm run publish` | 升級為 error，中止發布 |

**(c) 的合格方式有兩種**：補一題夠層次的，**或把 LO 的 `bloom` 誠實下修**。後者不是作弊——把「能指出該補哪個要素」改成「能說出四要素」，正是這條檢查要逼出來的那句實話。

理由：晚上 11 點、明天早上的課，有一段還沒配題是常態。硬性中止會導致老師**隨手掰一題湊過檢查**——那題會掛著 concept 進入學生的作答資料，再被 §12 拿去判定「這孩子這個知識點不會」。**擋路的檢查會污染它想保護的資料。**

### 5.7 砍的優先序（`cut`）與內容深度（`level`）是兩條軸

落後 8 分鐘時要砍的，經常不是最深的內容——`level=deep` 往往是這堂課唯一值得記住的部分。該砍的通常是那個學生已經懂了的暖身、那個重複的第二個例子。

| 屬性 | 位置 | 決定 |
|---|---|---|
| `level` | 片段內（`##` / `###`） | **深度**：哪個 profile 看得到這段內容 |
| `cut` | 課程編排（`blocks` 項目） | **可省略性**：來不及時先砍誰。`1` 最先砍，未標示者不砍 |

節奏條（§10.5）依 `cut` 排序建議，**不依 `level`**。這件事在講台上臨場判斷是判斷不好的，備課時就該決定。

### 5.8 題庫與穩定 id

```markdown
---
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
```

規則：

1. `id` 為必填、全域唯一、人為指定。`validate` 偵測重複即中止（這一項是資料完整性，不是教學品質，擋得住也該擋）。
2. **禁止由題幹推導 id。** 舊系統 `build.mjs:685` 取題幹前 20 字的做法導致改字即換 id、開頭相同即碰撞，使作答資料無法跨版本累積。這是「課後個人練習」的前置阻斷點。
3. `concept` 為必填，且必須存在於 `kb/concepts/`。
4. `bloom` 為必填，取值見 §5.6。
5. `type` 取值與計分方式：

   | type | 說明 | 計分 | 進 `concept_mastery` |
   |---|---|---|---|
   | `single` / `truefalse` | 單選、是非 | 自動 | 是 |
   | `multi` | 複選（全對才算對） | 自動 | 是 |
   | `short` | 簡答（一句話／一個詞） | 老師端一鍵對／錯 | 老師評分後才計入 |
   | `task` | 開放題、作品評析 | 老師端三級（未達／達標／優） | 老師評分後才計入 |

   `short` 與 `task` 是 `apply` / `analyze` 層次唯一的載體。沒有它們，§5.6 (c) 永遠過不了，`concept_mastery` 也永遠只量得到記憶維度。

6. `level` 的用途限定為**課堂內選題的 profile 過濾**（與片段 `level` 同語意：`kids` 取 basic/core）。**個人化練習的選題不看 `level`**，只看 `concept` + `bloom` + 是否已作答過。
7. 題目一律存於 `kb/qbank/`，片段只引用不內嵌。
8. `holdout: true` 的題目**不進課堂、不進個人化練習**，只供 §18 的後測使用。

### 5.9 版本鎖定：已印出的紙不會無聲分岔

§1.3 罵的雙真相來源，在片段共用的架構下會從另一個門回來：

> 週一印了 30 份 handout 發下去 → 週三為了另一門課改了共用片段 → 週五上課，投影片與學生手上的講義內容不一致，而 watch 還很盡責地幫你把兩門課都重建了。

機制：

1. `npm run publish`（或任何產生紙本的 build）產出 `course.lock`，內含三樣東西：
   - 每個被引用片段與題目的**內容 hash**（SHA-256 前 6 碼）——用於**偵測**改動
   - `lesson-content` 當下的 **git commit SHA**——用於**還原**內容
   - 一個 6 位版本碼（整份 lock 的 hash 前 6 碼）——印在紙上給人看的

   **內容 hash 是指紋，不是內容。** 光有 hash 無法重建當時那份片段，因此 commit SHA 是 `--pin` 能運作的必要條件。

2. `publish` 前若工作區有未 commit 的變更，**拒絕發布**並提示先 commit——否則 lock 記下的 SHA 對應不到實際發出去的內容。這是整套版本機制唯一的硬性阻斷。
3. handout / worksheet 頁尾印出版本碼。
4. 之後每次 build 比對 `course.lock` 的內容 hash：不一致時在**講台頁**（不是投影畫面）顯示警告：

   > 學生手上是 `3f2a91`，你現在投的是 `9c11e4`。差異：第 3 頁（Prompt 四要素）、第 7 頁（練習題 2）。

5. 老師可選擇「重新發布並重印」或「本堂沿用舊版」。後者以 `npm run build -- <slug> --pin 3f2a91` 執行：CLI 依 lock 中的 commit SHA 建立一個暫時的 `git worktree`，在該快照上重新 build，完成後移除。**還原的是內容，不是 hash 的反推。**

**不自動阻止修改**，只保證你永遠知道自己站在哪一版。

### 5.10 Profile：一條軸，多個預設

年齡與角色不分兩條軸——實務上一門課只服務一組（角色, 年齡）組合。`profile` 決定內容深度、`[only]` 條件塊的取捨與呈現參數。**片段的選擇由課程編排決定，不由 profile 自動推導。**

| profile | 取用 level | 匹配 aud | 呈現 | Colab |
|---|---|---|---|---|
| `kids`（5–12） | basic, core | kids | 基礎字級加大、句子拆短、圖優先版面、TTS 朗讀、可選注音、**作品牆關閉票數顯示** | **不可用**（見 §11.3） |
| `teen`（13–18） | core, deep | teen | 預設 | 可用 |
| `adult`（19–60，預設） | core, deep | adult | 預設 | 可用 |
| `senior`（60+） | core | senior | 高對比色票（見 §6.3）、字級加大、關閉所有動畫、大按鈕、TTS 朗讀 | 可用，需課堂協助 |
| `teacher`（教師培訓） | core, deep | teacher | 預設，且輸出 `level=deep` 的教研討論段落 | 可用 |
| `public`（公眾講座） | basic, core | public | 大字級、少術語、不含 hands-on 段落 | 可用 |

**`teacher` profile 指的是「聽課的人是老師」，與講者備註無關。** 講者備註（`[notes]`）在**所有** profile 下都輸出到講台頁——你教小學生時同樣需要自己的講稿。這兩件事在修訂 2 中被混為一談，現已分開。

```bash
npm run build -- aigc-comic-p4p6                  # 用 course.md 宣告的 profile
npm run build -- prompt-basics --profile teacher  # CLI 覆寫，CLI 優先
```

**關鍵**：`level=deep` 的段落在 `kids` / `senior` / `public` 版本中**完全不輸出**，而非縮小顯示。分層換的是內容顆粒，不是字級。

### 5.11 產物

單次 build 產出七種 rendition：

| 產物 | 檔案 | 說明 | 給誰看 |
|---|---|---|---|
| 投影片 | `dist/deck.html` | 1920×1080，套用 `full_template` 設計系統（§6） | 全班 |
| **講台頁** | `dist/podium.html` | 講稿、節奏、警告、工具控制（§6.6） | **只有老師** |
| 課程頁 | `dist/page.html` | 捲動式長頁，供課後複習 | 學生 |
| 學生講義 | `dist/handout.pdf` | A4，含筆記留白欄、術語表、版本碼 | 學生 |
| 練習卷 | `dist/worksheet.pdf` | A4，題目 + 答題欄、版本碼；答案頁獨立檔 | 學生 |
| 預習頁 | `dist/preview.html` | 精簡版 + 前測題 | 學生 |
| 學生入口 | `dist/portal.html` | 掃 QR 進入：今日教材、Colab、課後練習、個人碼 | 學生 |

另產出 `dist/course.json`（供 `ContentProvider`）與 `dist/alignment.md`（對齊報告）。

**所有 renderer 共用同一份 AST**（`parse.mjs`：Markdown → AST）。渲染器分別為 `renderers/{deck,podium,page,handout,worksheet,preview,portal}.mjs`。

### 5.12 缺漏與壞引用的處理

依 §3 原則 6，教材不完整不該讓 build 崩潰——但也不能無聲吞掉。統一規則：

| 情況 | `build` / `teach` | `publish` |
|---|---|---|
| `course.md` 引用不存在的 block id | 產出佔位頁（紅框 + id）+ 講台頁警示 | error |
| `[q:]` 指向不存在的題目 | 該處輸出佔位框 + 講台頁警示 | error |
| `[media:]` 指向不存在的圖 | 灰底佔位框 | error |
| concept id 不存在（片段或題目宣告） | warning，該綁定忽略 | error |
| 題目 id 重複 | **error（兩者皆擋）** | error |
| `[notes]` 未閉合、front-matter 解析失敗 | **error（兩者皆擋）** | error |

原則：**指向缺漏的東西 → 佔位 + 警示；結構本身壞掉 → 直接擋。** 前者你在講台上還能繼續上，後者你不知道自己在看什麼。

---

## 6. 投影片設計系統

投影片版面採用 `lesson_system/full_template/` 的 Professor Slide Design 設計系統（`Professor_Slide_Design_設計系統參考.md`，1,893 行完整規範）。

### 6.1 採用範圍

| 項目 | 來源 | 處理 |
|---|---|---|
| 設計 token（60-30-10 色彩、字型階層、間距） | `styles.css` `:root` | 直接採用 |
| 元件庫（50+ class） | 參考手冊 §五 | 直接採用 |
| 投影片引擎 | `deck-stage.js`（1,746 行 Web Component） | 直接採用，不重寫 |
| 導航／互動 | `deck-script.js` | 拆解為 §7 的 runtime 模組 |
| 單檔打包 | `build-single-file.py` | 以 Node 重寫，規則照搬 |
| 實戰準則 | 參考手冊 §十四 | 轉為 CI 檢查（見 §6.5） |

`deck-stage.js` 已具備自動縮放（固定 1920×1080 canvas + `transform: scale()`）、縮圖側欄（拖曳重排／略過／刪除）、觸控導航（左右半邊點擊）、列印分頁（`data-deck-skip` 自動排除）、`slidechange` / `deckchange` 事件。這些是現場實測過的功能，重寫沒有收益。

### 6.2 內容到投影片的對映

修訂 3 的對映表是照 `full_template` 的 CSS 類庫寫的，不是照實際內容寫的：它對映了 `[formula]` / `[task]` / `[timer]` / `[qr]`（在 22 門課的 `content.md` 中出現 **0 次**），卻沒有對映 `[image-text]`（`aigc-comic-p4p6` 中用了 **9 次，是該課最常用的元件**）。

以下依**實際清點**重寫。舊系統註冊 30 個元件名，22 門課實際用到 **21 個**，全庫使用次數：

```
flow 211 · quiz 162 · callout 113 · tags 107 · compare 73 · item 68 · summary 36
reveal 34 · tab 28 · steps-status 18 · image-text 16 · accordion 16
compare-table 15 · bonus 15 · tabs 11 · vote 9 · timeline 9 · dl 8 · stats 4 · youtube 2
```

#### 6.2.1 元件的四種命運

**舊詞彙是為捲動長頁（`index.html`）設計的，新系統的主產物是投影片。語法相容不等於語意相容**——`accordion` 投在牆上沒有等價物。四種處理：

| 命運 | 元件 | 說明 |
|---|---|---|
| **A 直接對映** | flow, compare, compare-table, callout, image-text, stats, timeline, quiz, youtube | 有現成版面，deck 與 page 皆可 |
| **B 需拆頁** | reveal, accordion, tabs / tab, item | 展開／收合在投影片上不成立。deck 中**一項一頁**（renderer 前置轉換，見 §6.2.3）；page / handout 保留互動原樣 |
| **C 頁面專屬** | tags, summary, dl | deck 中降級為單純列表或收進講台頁；page / handout / preview 保留原樣 |
| **D 其實是課程層** | **bonus**, **vote** | 不該是元件。`[bonus]` → `level=deep` + `cut`（§5.7）；`[vote]` → §10.5 的作品牆評價。搬遷時就地改寫，不實作 |

D 類是搬遷的淨收益：舊系統用元件表達「這是加碼」，新系統用課程編排表達，語意更準且自動獲得砍段能力。

#### 6.2.2 對映表

| 內容元件 | 投影片輸出 | 命運 |
|---|---|---|
| `sections[].title` | 深色分隔頁：`.slide.dark` + `.section-hero` | — |
| 片段的 `assertion` | `.assertion`（每頁一句主張）；`demo`／`activity` 無 assertion 時用 `title` | — |
| `[image-text position= width=]` | `.grid-2`（圖 / 文兩欄，`position` 決定左右，`width` 決定欄寬比） | A |
| `[flow]` | `.arrow-flow` | A |
| `[callout type=tip\|warn]` | `.tip-box` / `.warning-box` | A |
| `[compare]` | `.grid-2` + `.card` + `.compare-tag ok/bad` | A |
| `[compare-table]` | `.compare-table` | A |
| `[stats]` | `.kpi-grid` | A |
| `[timeline]` | `.three-port`（3 項）或 `ol.editorial`（多項） | A |
| `[q:<id>]`（舊 `[quiz]`） | `[data-quiz]` + `.quiz-opt`，題目由題庫解析注入 | A |
| `[youtube]` | iframe（§6.5 外部引用白名單） | A |
| `[reveal]` / `[accordion]` / `[tabs]`+`[tab]`+`[item]` | **每項一張投影片**，標題沿用該項標題 | B |
| `[tags]` | deck：`.tag-row`（純視覺，無互動）；page：原樣 | C |
| `[summary]` | deck：本章結尾單獨一頁的重點列表；handout：術語表前的回顧欄 | C |
| `[dl]` | deck：兩欄定義列表；page：原樣 | C |
| `[steps-status]` | `.step-track`（步驟進度，講台頁同步高亮當前步） | A |
| `sections[].time` | `.timer-chip` 於 `.slide-header` | — |
| **`[notes]`** | **不進 deck**。輸出到講台頁（§6.6），所有 profile 皆同 | — |

`full_template` 的 `.formula-box` / `.task-frame` / `.round-timer` / `.qr-slot` 是**版面類別，不是內容元件**——由 `[callout]`、`[activity]` 片段類型與 `tools:` 宣告驅動，作者不直接書寫。

#### 6.2.3 deck renderer 需要前置轉換，不只是 visitor

B 類元件把「1 個節點」變成「N 張投影片」，因此渲染管線是：

```
AST ──► 各 rendition 的前置轉換 ──► render
        （deck：展開 B 類、依 profile 剪枝、切頁）
```

**不是 AST → render。** 這一層現在就要留出來，否則階段二加 handout 時會發現得重寫 deck renderer。

**頁碼一律由 JS 依 DOM 位置推導**（參考手冊 §14.1 列為最高優先）。renderer 產出 `<span class="num"></span>` 空殼，絕不硬寫「08 / 35」。

### 6.3 字型自主化與色票

`full_template` §13.9 規則 4 明寫「Google Fonts 是唯一刻意保留的外部相依」，`examples/07_互動刷題課程PPT_學生版.html` 也確實引用 `fonts.googleapis.com`。這與「教室斷網是硬需求」衝突。

解法不是二選一：**build 時掃描產物實際用到的字元，產生 woff2 子集。**

- `--bundle split`：子集字型輸出至 `/design/fonts/`，全站共用快取
- `--bundle single`：子集字型以 base64 內嵌
- 字型家族維持不變：Noto Sans HK/TC、Atkinson Hyperlegible、Lexend、JetBrains Mono
- 系統字型 fallback 鏈保留，子集載入失敗不破版

中文全字集過大，但單一課程實際用到的字元通常在 1,500 字以內，子集後每種字重約 60–120KB。

**兩組色票，不是一組加大字級。** `senior` 需要的是對比度，不是字級——投影機打在有窗的教室、加上白內障或黃斑部病變，AA（4.5:1）不夠。

| token 組 | 適用 | 對比要求 |
|---|---|---|
| `:root`（預設 60-30-10） | kids / teen / adult / teacher / public | WCAG AA |
| `:root[data-palette="high-contrast"]` | `senior` | **WCAG AAA（7:1）**，且移除所有半透明疊層與淡色分隔線 |

高對比組不是把預設色調暗，是重新指定：底色降到近白、文字提到近黑、`accent` 只用於必須區辨的元素且加形狀輔助（不單靠顏色傳達意義）。`senior` build 時 §6.5 的對比檢查**升為 error**。

### 6.4 兩種打包模式

| 模式 | 用途 | 產出 |
|---|---|---|
| `--bundle split`（預設） | 網站發布 | `deck.html` + 共用 `/runtime/*.js`、`/design/styles.css`、`/design/fonts/` |
| `--bundle single` | 現場、USB、離線、交給他人 | 一份自足 `.html`：CSS、JS、字型子集、**優化後**的圖片全內聯（見 §6.7） |

single 模式**保留完整 `<deck-stage>` 引擎**，不做功能閹割版（參考手冊 §13.9 明確反對為了單檔而重寫成陽春導航）。內聯順序 `deck-stage.js` 必須先於 `deck-script.js`。

**必須處理的坑**：內聯 JS 中若出現字面的 `</script`（`deck-stage.js` 註解內就有一行），HTML 解析器會提早關閉 script 區塊、整頁壞掉。內聯前一律跳脫為 `<\/script`。

**單檔 deck 是每一堂課的 Plan B。** 後端全掛、網路全斷時，這份檔案在講台筆電上雙擊即可完成整堂課（見 §10.6）。講台頁一併產出 `podium.single.html`。

### 6.5 現場防呆檢查（CI）

參考手冊 §十四 的實戰準則轉為機器檢查：

| 檢查 | build | publish |
|---|---|---|
| 產物無外部 `http(s)://` 引用（白名單：`[youtube]` iframe、內容中明示的外部連結、Colab） | error | error |
| 無硬寫頁碼（`\d+\s*/\s*\d+` 出現於 `.num` 內） | error | error |
| 被引用的每個 class 都有 CSS 定義 | error | error |
| **學生產物中不含 `[notes]` 內容** | **error** | **error** |
| 無 Emoji（除非 config 明確開啟） | warning | error |
| 繁簡一致 | warning | error |
| 前景／背景對比度達 WCAG AA（`senior` 為 AAA） | warning（`senior`：error） | error |
| **資產預算**（§6.7.2） | warning | error（僅單檔上限 16MB 一項） |

前四項屬「產物會壞掉或會外洩」，一律擋；後四項屬「品質瑕疵」，依 §3 原則 6 分級——**唯一的例外是 16MB 的單檔上限**，超過它就不是瑕疵而是「這份檔案在講台筆電上打不開」，等同第一類。

### 6.6 講台頁（第七種產物）

修訂 2 有三處依賴「講台頁」卻沒有把它列進產物清單。這裡補上規格。

`dist/podium.html` 與 deck 同源、同一次 build 產生，開在第二螢幕、平板或手機。**永不投影**——§3 原則 8 的實體載體就是這一頁。

內容（由上而下）：

1. **目前頁 + 下一頁縮圖**（`deck-stage` 的 `slidechange` 事件同步）
2. **講者備註**：來自片段的 `[notes]` 區塊；若掛載了 `LESSON_PRIVATE`，同時併入 `kb/notes/<concept-id>.md` 中對應本頁 concept 的段落
3. **節奏條**：應在第幾章 / 實際第幾章 / 落後幾分；並依 `cut` 優先序列出建議省略的片段（§10.5）
4. **對齊橫幅**：§5.6 的報告摘要（「2 個 LO 未配題、1 個評量層次偏低」）
5. **版本分岔警告**：§5.9 第 4 點
6. **課堂工具控制面板**：§7 宣告的工具，含「開始／收卷／看結果」與**答錯名單**（只在這裡出現）
7. **降級路徑速查**：§10.6 的表，含本課的檔案路徑

三種連線狀態：

| 狀態 | 講台頁行為 |
|---|---|
| 有課堂層（Zeabur／自架） | 全功能；工具面板與學生端即時同步 |
| 無課堂層（單檔模式） | 1–5、7 全部可用；工具面板降級為本機計時與 `podium` 手動計數 |
| 只有講台頁沒有 deck | 不支援。講台頁是 deck 的伴生產物，不獨立存在 |

第一階段交付的最小版本為 1、2、7 三項（見 §17.1）。

### 6.7 圖片管線與資產預算

實際清點 `aigc-comic-p4p6`：

```
19 張圖 / 24 MB / 每張 1.3–2.0 MB
全部 1024×1024 PNG, 8-bit RGB — 生成工具的原始輸出，零處理
22 門課合計約 79 MB
```

若照 §6.4 把圖片 base64 內聯，這門課的單檔 deck 約 **32 MB**。而那份檔案正是 §6.4 與 §10.6 指定的「後端全掛時在講台筆電雙擊上完整堂課」的 Plan B——32 MB 的 HTML 解析要數秒、吃數百 MB 記憶體、部分瀏覽器直接卡死。**沒有圖片管線，整份設計裡最重要的那條退路不成立。**

#### 6.7.1 管線

build 時對所有 `blocks/*/assets/`、`courses/*/assets/`、`kb/media/` 的圖片：

| 步驟 | 規則 |
|---|---|
| 縮放 | 上限 **1600px 寬**。deck canvas 固定 1920×1080，`[image-text width=45]` 實際顯示約 864px；page / handout 更小。超過即等比縮 |
| 轉檔 | → **WebP q80**（照片類）／PNG q90（線稿、螢幕截圖、需透明者）。保留原副檔名的 `<source>` fallback 僅在 `split` 模式提供 |
| 快取 | key = `hash(原檔內容 + 管線參數)`，存 `.cache/images/`。原圖不變就不重跑 |
| 產物 | 寫入 `dist/assets/`，不回寫來源 |

實測預期：1.5 MB PNG → **80–120 KB WebP**，約 **15×**。本課 24 MB → 約 1.6 MB，單檔 deck 回到約 **2.5 MB**（含字型子集），可用。

#### 6.7.2 資產預算（build 時檢查，超標即警告）

| 產物 | 預算 | 超標行為 |
|---|---|---|
| `deck.single.html` | **< 8 MB** | warning；> 16 MB 時 `publish` error |
| 單張圖（優化後） | < 300 KB | warning，列出檔名 |
| 字型子集合計 | < 800 KB | warning |
| `page.html`（split，不含圖） | < 500 KB | warning |

預算不是為了好看。單檔 deck 是斷網時唯一的退路，它必須在一台三年前的講台筆電上兩秒內開起來。

#### 6.7.3 原圖不進 git

§14.1 規定 `kb/media/` 與 `blocks/*/assets/` 進**公開 repo**。把 79 MB 未優化 PNG 推上去，**git 永遠不會忘記，撤不乾淨**。

規則：

- **原圖存於 `lesson-private/sources/media/`**（不入公開 repo）
- **公開 repo 只放優化後的衍生檔**（WebP，通常每張 < 200 KB）
- 需要重新處理時從私有原圖再跑一次管線
- 若某張圖沒有私有原圖（例如直接收到的成品），衍生檔即為唯一來源，正常 commit

這個決定必須在**第一次 push 之前**做完——之後再改就是改寫歷史。

---

## 7. 共用講台工具 runtime

### 7.1 軟連結，不硬編碼

現況每門課的互動邏輯散在 `assets/course.js`（3,694 行）與各 deck 的自寫 script 中，改一件事要改 N 處。新系統將講台工具抽為獨立 runtime 模組：

```
runtime/
├── index.mjs           # 工具註冊表與 mount 分派
├── quiz.mjs            # 即時測驗（含講台驅動模式）
├── timer.mjs           # 倒數計時
├── wall.mjs            # 作品牆
├── groups.mjs          # 分組任務板
├── ask.mjs             # 匿名提問箱
├── pace.mjs            # 節奏條
└── stage.mjs           # 聚光燈／放大鏡／塗鴉筆／QR
```

每個工具暴露統一介面：

```ts
interface ClassroomTool {
  name: string;
  mount(el: HTMLElement, ctx: ToolContext): void;
  unmount(el: HTMLElement): void;
}

interface ToolContext {
  session: SessionClient | null;   // 有課堂層時為即時連線 client（§10.4）
  store: KeyValueStore;            // 無 session 時的 localStorage fallback
  mode: 'device' | 'podium';       // 學生有無裝置
  surface: 'deck' | 'podium';      // 投影畫面 or 講台頁
  profile: Profile;
}
```

**同一份 `quiz.mjs` 在四種情境下都能跑**：連線 + 學生有裝置、連線 + 講台驅動、離線暫存、單檔完全本機。工具本身不知道差別，差別在 `ctx`。`surface` 決定同一個工具在投影畫面與講台頁上各露出什麼——答錯名單只在 `surface === 'podium'` 時渲染。

### 7.2 宣告式載入

課程在 `course.md` 的 `tools:` 宣告要用的工具，build 只打包宣告者。一堂不需要作品牆的課，不該載入作品牆的程式碼。

### 7.3 內容軟連結

| 寫法 | 解析時機 | 意義 |
|---|---|---|
| `[q:q.prompt.four-elements.01]` | build | 從 `kb/qbank/` 取題，注入 deck |
| `[media:diagram-prompt-flow]` | build | 從 `kb/media/` 取圖，split 輸出連結、single 內嵌 |
| `[concept:prompt.negative]` | build | 展開為術語提示，並在講義術語表建立索引 |
| `blocks:` 清單（course.md） | build | 引用片段 |

作者永遠寫引用。內聯與否是 build 的決定——這是「軟連結而非硬編碼」在本系統的具體定義。

---

## 8. Ingest、Assertion 與知識庫建立

### 8.1 Ingest

```bash
npm run ingest -- sources/我的舊教案.pptx
```

| 階段 | 行為 |
|---|---|
| 1. 抽取 | PPTX / DOCX / PDF / 舊 HTML deck / 純文字 → 文字 + 圖片 + 原有結構層級 |
| 2. 切片 | AI 將內容切成 `explain` / `demo` / `activity` 片段草稿，標出建議的 `concepts` 與 `duration` |
| 3. 知識點萃取 | 辨識文中的概念、定義、題目 → 產出候選 concept / qbank 檔，標明「新建」或「已存在，建議引用」 |
| 4. 確認 | 輸出逐段 diff，老師逐段接受或拒絕，不整份覆蓋 |

**階段 2 的核心規則：只重組，不重寫。** 老師的原句原樣保留，僅切段與加標記。理由：教了 20 年的老師，其語言風格是資產而非雜訊；現有 `content-drafting` 生成的內容（如 `aigc-comic-p4p6/content.md` 的「LV.99 傳說級咒語」）套用到全部課程時，會讓所有課長成同一個人。

**階段 3 是知識庫成長的主要途徑。** 已存在的 concept 只提示引用，不重複建立——這是防止知識庫碎片化的關鍵。

**素材授權**：階段 3 記錄每張圖片的來源。來源不明或授權不清者標記為 `private`，不進公開 repo，build 時以佔位框替代。公開 repo 一旦推上去就撤不乾淨，這個檢查必須在推之前。

### 8.2 Ingest 產不出 assertion——這是刻意的

既有 PPT 九成是條列式，標題是「Prompt 的組成」這類名詞短語。而 §6.2 要求 `explain` 頁一句主張式 `assertion`。**光靠重組永遠生不出 assertion**，這兩條規則不可能同時滿足。

解法是分工，不是妥協：

- **ingest 只產內容片段**，原句保留（§8.1 階段 2 規則不動）
- **assertion 是獨立工序**，見 §8.3

### 8.3 `npm run assert`

```bash
npm run assert -- explain.prompt-four-elements.kids
npm run assert -- --course aigc-comic-p4p6      # 走完該課所有缺 assertion 的 explain 片段
```

逐片段：AI 依內容提案一句主張（不超過 24 字，含一個焦點詞），老師確認、改寫或跳過。確認後寫回片段 front-matter 的 `assertion`。只處理 `explain` 型（§5.4 規則 5）。

**這一步不自動化掉。** 把「這一頁我到底要學生記住哪句話」交給 AI 決定，等於把備課裡最有價值的十分鐘丟掉。AI 提案是為了讓老師有東西可改，不是為了讓老師不用想。

### 8.4 `npm run tidy`：必填欄位不該擋在寫作前面

清點目前的必填欄位：片段 front-matter **7 個**（id / type / title / concepts / duration / audiences / assertion）、每道題 **5–6 個**（id / concept / type / bloom / level / holdout）、課程檔約 **12 個**。

**加一道題，要先做三件分類學工作**：手工造一個全域唯一 id、指定一個必須已存在的 concept 檔、判一個 bloom 層級——三件都做完，才輪到寫題幹。晚上 11 點的老師不會做這三件事，他會複製上一題然後改字，而那正是 §5.8 規則 2 要根除的行為。

§3 原則 6 管住了「檢查不擋路」，但沒有管「必填欄位不擋路」。補上同一個模式（AI 提案、老師確認）：

```bash
npm run tidy -- --course aigc-comic-p4p6    # 或 --all
```

| 缺什麼 | tidy 的行為 |
|---|---|
| 題目缺 `id` | 依 concept + 序號提案 `q.<concept>.<nn>`，檢查全域唯一後寫入 |
| 題目或片段缺 `concept` | 依內容提案 1–2 個候選（優先既有 concept），**不存在時同時提案新建 concept 檔草稿** |
| 缺 `bloom` | 依題型與題幹動詞提案 |
| 缺 `duration` | 依字數與元件數估算 |
| 缺 `assertion`（`explain`） | 轉呼叫 §8.3 |

**逐項確認，預設接受**（按 Enter 即採用提案，輸入即覆寫，`s` 跳過）。草稿階段什麼都不填；`publish` 前跑一次 tidy 補齊。

`tidy` 只補**分類欄位**，不碰教學內容——與 §8.1 階段 2「只重組不重寫」同一條界線。

---

## 9. 建置層：老師介面

### 9.1 一條指令

```bash
npm run teach -- aigc-comic-p4p6
```

= watch `course.md` / 被引用的 `blocks/` / `kb/` / `config.yaml` → 重建 → 本地預覽伺服器 → 開瀏覽器（deck 與講台頁各一分頁）。存檔即見。

**延遲預算：存檔 → deck 畫面更新 < 500ms。**

這個數字是所有建置決策的判準，沒有它就沒有取捨依據。它直接否決以下四件事：

| 不做 | 原因 |
|---|---|
| 一次重建七種 rendition | `teach` **只重建瀏覽器目前開著的那幾種**（通常是 deck + 講台頁兩種） |
| 重建所有引用該片段的課程 | 只重建**當前這門課**；其他受影響的課程在終端列為 stale，不重建。切換課程時才建 |
| PDF 進 watch 迴圈 | Puppeteer 冷啟 1–3 秒。PDF **只在 `build --pdf` 與 `publish` 產生** |
| 每次存檔重算字型子集與圖片 | 兩者都走 §9.8 的內容快取；字元集與原圖不變就不重跑 |

修訂 4 的寫法（「所有引用它的課程都要重建」）在一個片段被 5 門課引用時是 5 × 7 = 35 次 render，其中 10 次是 PDF。「存檔即見」會死在這裡。

**watch 仍跨檔追蹤引用關係**，但只用於**通報**：終端列出受影響的課程清單；若其中任一課程有 `course.lock` 且已鎖版，顯示 §5.9 的分岔警告。重建與通報是兩件事。

OG 圖生成與索引更新併入 `publish` 流程，不在 watch 迴圈裡。

### 9.2 指令一覽

```bash
npm run teach -- <slug>                              # watch + 預覽
npm run build -- <slug> [--profile <p>] [--bundle single|split] [--pin <ver>]
npm run find -- "negative prompt" [--type explain] [--aud kids]   # 找片段／題目（見 §9.7）
npm run tidy -- --course <slug> | --all              # 補齊 id / concept / bloom（見 §8.4）
npm run assert -- <block-id> | --course <slug>       # assertion 提案與確認
npm run ingest -- <file>
npm run validate                                     # 全庫檢查
npm run publish -- <slug>                            # 產物 → 發布；產生 course.lock
npm run export -- <slug>                             # 交接包（見 §9.6）
npm test                                             # 見 §9.5
npm run clean                                        # 刪 .cache/ 與 dist/（見 §9.8）
```

`build` 額外接受 `--no-cache`（略過 §9.8 的快取，用於診斷「是不是快取騙我」）。

### 9.3 AI Skills 調整

現有 6 個 Skills 的 prompt 保留，但**輸出目標一律改為 `block.md` / `course.md` / `kb/`，禁止直接產生或修改 HTML**：

| Skill | 調整 |
|---|---|
| `content-drafting` | 輸出片段而非整課；每題強制輸出全域 `id`、`concept` 與 `bloom` |
| `content-review` | 產出 §5.6 的對齊報告（人類可讀版），含認知層次錯配 |
| `course-page-generator` | 改為呼叫新的 render pipeline |
| `topic-to-page` | 改為「主題 → 片段組合建議」，先查知識庫有無可重用片段 |
| `image-generator-dmxapi-gptimage2` | **原始輸出寫入 `lesson-private/sources/media/`**（生成工具吐的是 1024×1024 未壓縮 PNG，正是 §6.7 那 24 MB 的來源），由 build 的圖片管線產出 `kb/media/` 的衍生檔。附授權標記 |
| `widget-builder` | 擴充為涵蓋 §7 的 runtime 工具規範 |

新增 `content-ingest`（§8.1）與 `assertion-proposer`（§8.3）兩個 Skill。

### 9.4 瀏覽器內輕編輯

課前 5 分鐘改字：本地預覽頁上直接編輯 → dev server 的 `PATCH /api/content` **寫回來源 `.md`** → 觸發重建。

編輯目標是片段或課程的 Markdown，不是 HTML。**不提供下載式儲存**——舊系統 `editor/editor.js:487` 的 `downloadBlob` 是雙真相來源問題的直接成因。

編輯片段時，UI 必須顯示：

- 本片段被 N 門課程引用（列出課名）
- 其中 M 門已鎖版並已發放紙本（紅色警示）

### 9.5 測試策略

修訂 2 全份沒有一個字談測試。但這套系統的失敗現場是**「30 個小孩面前投出去的那一頁是壞的」**，而 `parse.mjs`（自寫 30+ 元件的 tokenizer）與七個 renderer 正是最容易無聲壞掉的地方。

| 層 | 方法 | 何時 |
|---|---|---|
| `parse.mjs` | 單元測試：每個元件語法一個 fixture → 預期 AST；含 §5.12 的每一種壞引用 | 第一刀 |
| renderers | **golden-file 快照，只斷言結構**：把輸出正規化為「tag + `data-*` + 文字」後比對，**剝掉 class 與 inline style**。`tests/golden/<case>/{input.md, expected.<rendition>.json}`。**每新增一個 renderer，先寫 golden 再寫 renderer** | 第一刀（deck + podium），之後每階段 |
| 樣式 | 少數幾張 Playwright 截圖（每種 rendition 一張代表頁） | 第一刀 |
| 單檔打包 | Playwright headless，**離線 context** 載入 `--bundle single` 產物，斷言 `deck-stage` 的 slide 數 > 0、無 console error、字型已套用 | 第一刀 |
| runtime 工具 | 四種 `ctx` 組合（連線×裝置的排列）各跑一次 mount / 互動 / unmount | 工具加入時 |
| 課堂層 API | 整合測試（真 Postgres，docker-compose）+ 一支「30 個 client 同時作答並中途斷線重連」的腳本 | 階段三 |
| 個人化練習 | 以合成資料驗判定規則：證據不足、前測降權、prereq 優先、bloom band 分流 | 階段四 |

**準則：任何會導致「投出去的那一頁是壞的」或「學生資料算錯」的東西，一律要有測試。** 其餘不強求覆蓋率。

**golden 為什麼只驗結構**：七種 rendition × N 案例，若快照含 class 與樣式，任何一次配色調整或 class 改名都會讓全部 golden 失效。人會養成 `npm test -- -u` 盲更新的習慣，測試就等於死了。剝掉樣式之後，「改配色」不動 golden，「B 類元件拆頁邏輯錯了」照樣抓得到。

`tests/golden/` 入 git（它是規格的可執行版本），`dist/` 不入 git。

### 9.6 交接包（`npm run export`）

片段模型有一個沒被記錄的代價：**一門課從「一個資料夾」變成「一串指向個人知識庫的指標」**，交給代課老師或協作者時，等於要交出整個 `kb/` 與 `blocks/`。

`npm run export -- <slug>` 產出一個自足資料夾：

```
export/<slug>/
├── deck.single.html        # 含字型、圖片、題目
├── podium.single.html      # 講稿與節奏（可選是否含私有註解，預設不含）
├── handout.pdf
├── worksheet.pdf + answers.pdf
├── course-flat.md          # 所有引用的片段內容就地展開為一份可讀 Markdown
└── VERSION.txt             # course.lock 的版本碼與匯出日期
```

`course-flat.md` 是給人讀與再編輯的，**不保證能被本系統讀回**——它是出口，不是往返格式。這個取捨明確記錄於 §21。

### 9.7 片段檢索：重用的前提是找得到

修訂 3 有八條指令，**沒有一條能找片段**。但一年後有 200 個片段時，「我講 negative prompt 給小學生的那個版本在哪」是這套系統每天都要做的動作。§9.3 要求 `topic-to-page`「先查知識庫有無可重用片段」——查什麼？§2 目標 1（重用）整個依賴這件事。

```bash
npm run find -- "negative prompt"                    # 全文 + 標題 + concept 別名
npm run find -- --concept prompt.negative --type explain --aud kids
npm run find -- --unused                             # 從未被任何課程引用的片段
npm run find -- --concept prompt.negative --show-usage   # 誰引用了它
```

輸出每列：`id · type · duration · 被 N 門課引用 · 標題`。

實作：`validate` 順帶產生 `dist/index.json`（片段與題目的扁平索引：id、title、type、concepts、audiences、duration、引用它的課程清單）。搜尋是對這份索引做的，**不掃全庫**。`teach` 的預覽站台額外提供一頁可瀏覽的版本（依 concept 分組，可依受眾篩選）。

`--unused` 是知識庫的健康檢查：長期沒被引用的片段，要嘛該刪，要嘛代表 §18 的重用率指標正在說實話。

### 9.8 建置快取：鑰匙已經在手上了

§9.1 的 500ms 延遲預算，靠「少做事」達成一半，靠「不重做」達成另一半。

**快取鍵**：

```
key = sha256(片段內容 + renderer 版本 + profile + bundle 模式)
```

四個成分都是必要的：改內容要重算（第一項），改 renderer 邏輯要重算（第二項，否則改完 renderer 看到的是舊輸出，這是最惡劣的一種 bug），`kids` 與 `senior` 產出不同（第三項），single 與 split 的內聯策略不同（第四項）。

**這幾乎是免費的**：§5.9 的 `course.lock` 已經要求對每個片段算 SHA-256 做變更偵測。同一個雜湊值，多存一份輸出即可。快取寫入 `.cache/renders/<key>`，命中即直接吐檔。

三層快取，各自獨立失效：

| 層 | 內容 | 失效條件 |
|---|---|---|
| `.cache/images/` | 優化後的 WebP / PNG（見 §6.7.1） | 原圖內容或管線參數變 |
| `.cache/fonts/` | 子集化後的 woff2（見 §6.3） | 字符集或來源字型變 |
| `.cache/renders/` | 單一片段的單一 rendition 輸出 | 上述四成分任一變 |

字型與圖片是三者中最貴的（子集化與重壓縮各需數百毫秒到數秒），而它們幾乎從不改變——這是快取效益最高的地方，也是 §9.1 表格中「每次存檔重算字型子集」被列為禁止項的原因。

**`.cache/` 不進 git**（見 §14.2），且必須可安全刪除：`rm -rf .cache && npm run build` 的輸出，必須與有快取時逐位元組相同。任何做不到這點的快取設計都是壞的——它會讓「我的機器上是好的」變成無法診斷的狀態。CI 每次都從空快取跑，正是為了持續驗證這件事。

---

## 10. 課堂層（Zeabur 或自架）

### 10.1 兩種課堂模式

**講台驅動模式（`podium`）是預設，掃碼加入（`device`）是進階。**

理由：受眾是 5–80 歲。五歲沒有手機；多數學校禁帶手機；長者掃碼失敗率高到會吃掉五分鐘。`aigc-comic-p4p6` 是親子課、家長有手機，所以 demo 一定會過——**然後在第一堂純學生的課上翻車。**

| 模式 | 學生怎麼答 | 老師怎麼收 | 資料粒度 |
|---|---|---|---|
| `podium` | 舉手、舉色卡、口頭 | 在平板／筆電上點各選項人數 | 全班統計（`tallies` 表） |
| `device` | 掃 QR 加入後在自己裝置上答 | 自動回收 | 個人（`responses` 表） |
| `mixed` | 兩者並行（有裝置的自己答，沒有的舉手） | 兩邊合併顯示 | 混合 |

**代價要說清楚**：`podium` 模式看得到全班弱點（可即時調整教法、可做預習診斷），但看不到個人，因此**無法驅動課後個人化練習**。需要個人化練習的課，必須至少有一次 `device` 模式的作答。這是沒有裝置時的必然結果，不是缺陷。

### 10.2 加入流程（`device` 模式）

1. 老師按「開始上課」→ 建立 session，產生 6 位課堂碼 + QR
2. 學生掃碼或輸入課堂碼 → 從老師預匯的名單點選姓名，或輸入暱稱
3. 需跨堂追蹤者，發放可列印的**個人碼卡**（含 QR，貼於作業簿），下次掃碼即認回同一人
4. **個人碼遺失的補救**：老師端有一份「本班個人碼 ↔ 顯示名稱」對照表（存在老師的實例中，不進 git、不進學生端）。學生報上暱稱／座號即可重發同一張卡。**這是「不收 PII」的一個刻意例外**——完全無法重綁的個人碼，等於學生一丟卡片，累積半年的錯題本就永久失聯。老師可在課程設定中關閉此對照表，代價是遺失即不可回復。
5. **課堂碼的安全邊界**：session 開始後老師可一鍵「鎖定加入」；同一 `person_code` 在多裝置同時連線時老師端顯示提示；老師可移除任一參與者。6 位碼會外流，這三件事是防線。

不註冊、不填 email、不需密碼。

### 10.3 資料模型（Postgres）

```
courses          slug, title, meta_json, lock_version, updated_at
sessions         id, course_slug, class_code, profile, mode, locked_at, started_at, ended_at, status
participants     id, session_id, person_code, display_name, media_consent, joined_at
persons          person_code (PK), display_name, created_at
responses        id, session_id, participant_id, question_id, concept_id, bloom, phase,
                 chosen, is_correct, score, scored_by, answered_at
tallies          id, session_id, question_id, concept_id, option_key, count, recorded_at
artifacts        id, session_id, participant_id, url, mime, bytes, caption,
                 status, approved_at, created_at, expires_at
artifact_tags    artifact_id, participant_id, tag, created_at
questions_asked  id, session_id, body, upvotes, status, approved_at, created_at
practice_sets    id, person_code, items_json, rationale_json, approved_by_teacher,
                 created_at, sent_at

-- 視圖，不是表
concept_mastery  person_code, concept_id, bloom_band, attempts, occasions, correct,
                 status, last_seen_at
```

要點：

- `responses.phase` 為 `pre | during | post | practice`。**前測（`pre`）不計入弱點證據**，只作為 §18 的對照與課前調整依據（見 §12.2）。
- `responses.bloom` 冗餘存一份（題目日後可能改），使 `concept_mastery` 能按層次分流。
- `responses.score` / `scored_by` 承接 `short` / `task` 的人工評分。
- `concept_mastery` 以 **(person_code, concept_id, bloom_band)** 為鍵。`bloom_band` 取 `recall_understand` 或 `apply_analyze` 兩檔。這讓「他記得住但用不出來」成為系統可表達的狀態，而不是被平均掉。
- **`concept_mastery` 是 view，不是表。** 它的每一欄都是 `responses` 的聚合，而 `responses` 是唯一的事實來源。做成表就要維護寫入路徑、處理補送與重評分造成的漏更新、並在改判定規則時回填歷史——三類 bug，全部只為了省一次聚合查詢。而這裡的資料量是：一位老師、一年、幾千到幾萬列 `responses`，加上 `(person_code, concept_id)` 索引，即時聚合是毫秒級。**先做 view；只有在實測慢到影響課堂時，才改為 materialized view**（Postgres 原生支援，改動只在一行 DDL 與一個排程刷新，介面不變）。這是「先做對，需要時再做快」，不是效能上的疏忽。
- `tallies` 承接 `podium` 模式的全班統計，不混進 `responses`。
- `participants.media_consent`（預設 `false`）：未取得同意者可正常參與與作答，**但不能上傳作品**（見 §13）。
- `artifacts.status` 為 `pending | approved | rejected`；`mime` / `bytes` 供 §10.5 的上傳限制檢查。
- `questions_asked.status` 為 `pending | approved | hidden`，`approved_at` 記錄老師放行時間（見 §10.5）。
- `courses` 表僅快取教材元資料，**教材本體不入庫**（真相來源仍是 repo 中的 `.md`）。

### 10.4 API 與即時

- REST：`/api/sessions`、`/api/join`、`/api/responses`、`/api/tallies`、`/api/artifacts`、`/api/questions`、`/api/practice`
- 即時：**只做 SSE（下行）+ POST（上行）。不做 WebSocket。** 取代舊系統的 5 秒輪詢（`assets/course.js:2503`）。
- **兩段降級**：

  | 狀況 | 行為 |
  |---|---|
  | HTTP 通 | SSE 推送下行（題目切換、統計更新、老師指令），POST 送上行（作答、提問、上傳） |
  | 完全斷網 | 本機暫存，恢復後自動補送（以 `question_id` + `participant_id` 去重） |

  學生端與講台頁必須顯示明確的連線狀態徽章（即時 / 離線暫存中）。

**為什麼砍掉 WebSocket。** 修訂 4 以前的設計是「WS 為主、SSE 為備」，其中特別處理了一個失敗模式：學校 proxy 擋掉 WS 握手，學生看到「連上了但沒反應」，比斷網更難診斷。但這個失敗模式**是 WS 帶進來的**——不用 WS，它就不存在。

代價評估：本系統的上行流量是「一人一題按一次」，30 人的課堂尖峰約每秒數十個 POST；下行是老師的操作廣播，同樣稀疏。SSE 是純 HTTP，穿透所有 proxy 與企業防火牆，瀏覽器原生自動重連。而 WS 換來的是雙向長連線、二進位訊框、更低的單訊息開銷——**這三樣這裡一樣都不需要**。

砍掉它同時消滅：兩套連線程式碼、兩套重連邏輯、握手逾時偵測與切換、三段狀態徽章、以及 Zeabur / 自架反向代理的 WS 升級設定。**如果日後實測 SSE 延遲不足以支撐某個新功能，再加 WS——那時會有真實數字說明為什麼需要它。** 現在沒有。

### 10.5 課堂工具

全部觸控優先：所有功能必須有 44px 以上的可點擊按鈕，鍵盤快捷鍵僅作為加速器。

| 工具 | 說明 |
|---|---|
| 即時測驗 | 支援 `podium` / `device` 兩種收法。**答錯名單只在講台頁可見**，投影畫面只顯示統計 |
| 作品牆 | 見下方三道閘 |
| 匿名提問箱 | 見下方 |
| 分組任務板 | 隨機分組 + 每組任務卡 + 進度回報 |
| 節奏條 | 依 `sections[].time` 顯示「應在第 3 章，實際第 2 章，落後 6 分鐘」，並依 `cut` 優先序列出建議省略的片段 |
| 舞台工具 | 計時器、聚光燈、放大鏡、塗鴉筆、QR |

**作品牆的三道閘**（未成年為主要使用者，這是全系統風險最高的功能之一）：

1. **審核閘**：上傳先進老師的待審佇列（`status=pending`），老師點過才上牆。沒有任何內容能繞過老師直接投到全班面前。
2. **內容閘**：上傳頁固定顯示「只拍作品，不要拍到人、不要拍到名字」；後端一律剝除 EXIF（含 GPS）。**上傳限制**：僅接受 `image/jpeg` / `image/png` / `image/webp`；單檔 ≤ 10MB；每人每堂 ≤ 5 張；同一 participant 每分鐘 ≤ 2 次。`media_consent = false` 者上傳鍵不出現。
3. **評價閘**：同儕評價一律寫入 `artifact_tags`（一人一作品可貼多個標籤），**投票只是標籤的一種特例**（`tag=vote`，UI 聚合計數）。`kids` profile **關閉 `vote` 標籤與所有計數顯示**，只留人人有份的標籤池——「最有創意」「顏色最好」「最好笑」「最特別」「最細心」。公開票數會在教室裡當場製造輸家；原本 `content.md:309-326` 的「投票選最佳」就有這個毛病。

**匿名提問箱與作品牆同級，不是低一級。** 修訂 2 給了作品牆三道閘、給提問箱零道閘——但**投影在牆上的匿名文字框比作品牆更容易出事**，它不需要準備，只需要一隻手機和三秒。規則：

1. 送出後進入 `pending`，**老師在講台頁點過才顯示**（`status=approved`）；投影畫面只渲染 approved 的項目
2. 同一 participant 每分鐘 ≤ 2 則
3. 老師可一鍵 `hidden` 已顯示的項目
4. upvote 僅對 approved 項目開放

### 10.6 課堂降級路徑

老師必須在課前就知道「掛掉的時候怎麼辦」，而不是在講台上現想。

| 掛掉的東西 | 還能做什麼 | 準備動作 |
|---|---|---|
| 學生沒裝置 | 全部功能，測驗轉 `podium` | 無 |
| 學校 proxy 阻擋 | 不適用——SSE 是純 HTTP（決策 29），過得了網頁就過得了即時通道 | 無 |
| 教室無網路 | 投影、計時、舞台工具、講台頁講稿、學生端本機作答（恢復後補送） | 無 |
| 課堂層全掛 | 用單檔 deck + `podium.single.html` 上完整堂課；測驗轉舉手、作品用實體展示 | **課前把 `--bundle single` 的兩份檔存到講台筆電本機** |
| 講台筆電也掛 | handout PDF（已印） | 課前印一份 |

`npm run publish` 完成後印出這張表（含本課的具體檔案路徑），列入課前檢查清單。

---

## 11. 學生入口、QR 與 Colab

### 11.1 兩種 QR，兩種用途

| QR | 目標 | 有效期 | 印在哪 |
|---|---|---|---|
| 課堂碼 QR | `/s/<class-code>`（課堂層） | 本堂課 | 投影片、白板 |
| 教材 QR | `/c/<slug>`（GitHub Pages 靜態） | 永久 | 講義、練習卷、個人碼卡 |

QR 一律**本地產生**，移除舊系統對 cdnjs `qrcode.min.js` 的相依：靜態 QR 於 build 時產 SVG 直接嵌入產物；課堂中即時產生的 QR 由 `runtime/stage.mjs` 內含的本地函式庫處理，隨產物打包。

### 11.2 學生入口內容

`portal.html`（靜態）與 `/s/<class-code>`（即時）共用版面：

1. 今日教材（deck 學生版連結、可下載的 handout PDF）
2. Colab notebook 清單（含「開啟 → 另存副本」的圖示步驟）——**僅在 profile 允許時顯示**（§11.3）
3. 課後練習入口（輸入個人碼進入）
4. 個人碼顯示與列印

版面必須在手機直式螢幕上一屏看完主要入口，不需捲動找連結。

### 11.3 Colab 整合與它的年齡邊界

```markdown
[colab notebook="character-design-01" checkpoint="完成第 3 格後舉手"]
```

- notebook 存於 `courses/<slug>/notebooks/`，隨公開 repo 發布
- build 產生連結：`https://colab.research.google.com/github/<owner>/<repo>/blob/main/courses/<slug>/notebooks/<name>.ipynb`
- **公開 repo 是此功能的前提**：私有 repo 需學生登入並授權
- build 在 notebook 首格自動注入：課程名、學生入口回連、檢查點清單
- `checkpoint` 同時輸出到講台頁（老師知道學生該做到哪）與 portal（學生自檢）

**帳號前提（修訂 2 漏掉的一半）**：修訂 2 只處理了「私有 repo 需登入」，但**「另存副本」與執行 cell 本身就需要 Google 帳號**，而 Google 帳號在多數司法管轄區要 13 歲以上（或需學校 Workspace for Education 帳號）。公開 repo 解決的是授權，不是帳號。

| profile | Colab | 替代路徑 |
|---|---|---|
| `kids`（5–12） | **不可用** | 課堂上老師單機示範 + 課後純網頁練習（§12）。若場地為親子課，可標註「由家長帳號開啟」，但**不預設** |
| `teen`（13+）／`adult`／`teacher`／`public` | 可用 | — |
| `senior` | 可用但需課堂協助 | 提供已執行完畢的靜態輸出頁作為 fallback |

`validate` 在 `profile: kids` 的課程使用 `[colab]` 時發出 **warning**，並在講台頁列為課前確認項（「本課有 Colab 環節，確認家長帳號可用」）。

---

## 12. 預習與課後個人練習

### 12.1 課前預習

1. 老師發布 `preview.html` 連結（獨立於 session，以 course + 期限識別）
2. 內容：`level=core` 的精簡教材 + 3–5 題前測
3. 前測作答以 `phase='pre'` 寫入 `responses`
4. 老師端在開課前看到「全班在哪個 concept 最弱」，據此當天調整教法

### 12.2 課後個人練習：證據門檻、認知層次與人審

**判定未達標的門檻不能只看正確率。** 課堂上一個 concept 通常只出 2–3 題，單選猜對率 25–33%——「3 題對 1 題」和「3 題對 2 題」之間區分的是雜訊。拿這個自動出練習，前兩次老師就會發現題目配得莫名其妙，然後再也不用。

流程：

| 步驟 | 規則 |
|---|---|
| 1. 證據門檻 | 同一 (concept, bloom_band) 需累積 **≥ 4 次計分作答**、跨 **≥ 2 個場合**（不同 session，或課堂 + 課後練習），才進入判定 |
| 2. **前測排除** | `phase='pre'` 的作答**不計入證據**。前測是教之前答的，答錯是正常的；把它與課後作答等權計入，會把「原本不會、教完會了」的學生判為 weak。前測只用於 §12.1 的課前調整與 §18 的對照 |
| 3. 判定 | 正確率低於門檻（預設 60%，可調）→ `weak`；證據不足 → `unknown`，**不是不出題，而是列為待確認** |
| 4. 分層判定 | `recall_understand` 與 `apply_analyze` 兩檔各自判定。「記得住但用不出來」是常見且重要的狀態，不可被平均掉 |
| 5. 查前置 | 某 concept 判定 `weak` 時，檢查其 `prereq` 是否也 `weak`；是則優先出前置題。直接補下游而不補前置是無效練習 |
| 6. 出題 | 從 `kb/qbank/` 抽同 concept、**同 bloom_band**、未作答過、且非 `holdout` 的題目；題庫不足時才呼叫 AI 生成，生成的題目自動入庫供日後複用 |
| 7. **人審** | 系統產出練習組合 + `rationale_json`（他錯了哪幾題、哪個 concept、哪個層次、證據強度、是否含紙本缺口），**老師按送出才發給學生** |
| 8. 輸出 | 個人練習網頁（個人碼進入）+ 可列印 PDF |
| 9. 累積 | 錯題本，**跨課程可查**——concept 作為全域骨幹的直接回報 |
| 10. `kids` 加值 | 家長版摘要：今天學了什麼（LO 白話版）、哪一個知識點需要陪練、建議陪練時間、紙本練習的位置。隨個人碼卡的 QR 或列印稿發出，**不建立家長帳號**（§2 非目標） |

第 7 步的人審在第一階段是**必要**而非選用。系統的判斷要先被老師看見幾十次、確認它是合理的，自動發送才有意義。信任是掙來的，不是預設的。

**已知邊界（寫進來，免得第一次看到怪練習時歸咎於門檻參數）**：`concept_mastery` 只量得到**進得了系統的作答**。若一門課的 `apply` 題全部以紙本進行且未回收（§12.3），該 concept 的 `apply_analyze` 檔會長期停在 `unknown`。`rationale_json` 必須明寫這一點，讓老師知道系統「不知道什麼」。

### 12.3 紙本練習的回收

`kids` 與 `senior` 的實際路徑幾乎必然是 PDF——而紙上的作答永遠不會自己回到 `responses`。**最需要個人化練習的 profile，恰好是資料迴路最容易斷掉的那一個。**

| 階段 | 處理 |
|---|---|
| 一至三 | **明確不回收**。練習卷是單向產物；`concept_mastery` 只反映線上作答。系統在 `rationale_json` 與家長摘要中標明「本次判定未含紙本練習」 |
| 四 | 老師端「快速批改」：叫出某人的練習卷題號清單，每題點一下對／錯（`scored_by='teacher'`，`phase='practice'`）。30 題約 40 秒。**不做拍照 OCR**（§2 非目標） |

不做自動辨識的理由：辨識錯誤會寫進學生的長期能力記錄，而這份記錄正是後續所有出題的依據。錯誤成本遠高於省下的 40 秒。

---

## 13. 資料與隱私

未成年學生為主要使用者之一，隱私設計必須內建而非事後補：

- **預設不收集真實姓名與 email**。識別僅靠課堂碼 + 暱稱 + 個人碼。名單匯入為選用。
- `podium` 模式**完全不產生個人資料**，只有全班計數。無需個人化練習的課，這是最安全的選擇。
- **未成年影像需同意旗標**。`participants.media_consent` 預設 `false`：未取得同意者可正常參與、作答、看作品牆，**但上傳鍵不出現**。老師端可（a）逐人勾選，（b）在學校已統一收過同意書時整班設為 `true`（需輸入一行來源說明，存於 session 備註）。隱私最小化不能取代同意——這是兩件事。
- 作品圖片：上傳即剝除 EXIF；老師審核後才可見；`expires_at` 預設 30 天，到期自動刪除。上傳限制見 §10.5。
- 老師可一鍵匯出（JSON + CSV）或刪除整堂課全部資料。
- **自動備份**：每日 pg_dump 至老師指定的儲存位置（本機同步資料夾或物件儲存），保留 14 份。手動匯出是給人用的，備份是給災難用的，兩者不能互相取代。
- 資料僅存於老師自有的實例，不經任何第三方分析服務。
- 個人碼為隨機字串，不含任何可推導的個人資訊。個人碼與顯示名稱的對照表僅存於課堂層實例（§10.2 第 4 點），可關閉。
- **學生資料絕不進任何 git repo**，包括私有 repo。匯出檔與備份預設寫入 gitignore 的目錄。
- **持有者風險要說清楚**：資料存放在老師個人的雲端帳號中，老師離職或帳號失效即失聯，且不受學校的資料治理涵蓋。若學校要求資料落在校內，走 §16 的自架 Docker 路徑。

---

## 14. 倉庫與發布邊界

### 14.1 三個來源位置，一個發布目標

| 位置 | 內容 | 可見性 |
|---|---|---|
| `lesson-engine` | build pipeline、renderers、runtime、design system、Skills、CLI、`tests/` | 與內容無關，公開私有皆可 |
| `lesson-content` | `blocks/`、`courses/`、`kb/concepts/`、`kb/qbank/`、`kb/media/`、`notebooks/`。**圖片一律為優化後的衍生檔**（§6.7.3） | **公開**（Colab 需要） |
| `lesson-private` | `kb/notes/`、`sources/`（含 `sources/media/` 的未壓縮原圖）、`rosters/`、資料匯出與備份 | **私有**（本機目錄或私有 repo） |
| 發布目標 | `dist/` 產物 | GitHub Pages（`gh-pages` 分支）或課堂層實例；不進來源 repo |

`course.lock` **入 git**——它是「學生手上那份是哪一版」的紀錄，且 §5.9 的 `--pin` 依賴其中的 commit SHA，必須跟著內容走。

**內容公開是 Colab 的代價，不是免費的。** 受託開發或商業內訓的課程若不宜公開，處置為：課程放在 `lesson-private` 中的 `courses/`，build 照常運作（片段與題庫仍在公開 repo，非公開的部分寫在課程層），但**該課不可使用 `[colab]`**（`validate` 報 error）。這是唯一受影響的功能。

### 14.2 絕不進 git 的內容

```
dist/            build 產物
.cache/          建置快取（圖片、字型、片段輸出，見 §9.8）
*.single.html    單檔打包產物
export/          交接包
node_modules/
sources/         原始 PPTX / DOCX / PDF 與未壓縮原圖
rosters/         學生名單
exports/         資料匯出
backups/         資料庫備份
.env
og-image.jpg     可重新生成
```

舊系統 `CLAUDE.md` 要求 commit 三個產出物，`lectures/*/index.html`（22 × 265–355KB 實測）全部入庫。新系統明確禁止。

**圖片是同一條規則的另一面。** 舊 repo 的 `lectures/` 目錄共 87MB，其中約 79MB 是未經處理的 1024×1024 PNG（單張 1.3–2.0MB）。git 對二進位檔沒有增量儲存——每改一張圖，整份新版本進歷史。公開 repo 只放優化後的衍生檔（§6.7.3），原圖留在 `lesson-private/sources/media/`。

### 14.3 推送前檢查

同一組檢查在**兩個地方**執行，職責不同：

| 位置 | 角色 | 可繞過 |
|---|---|---|
| `pre-push` hook | 提早提醒，省一次來回 | 可（`--no-verify`），且換台電腦就沒有 |
| **CI（push 與 PR 觸發）** | **唯一的閘** | 否 |

檢查項目：

1. 無 build 產物入庫
2. 公開 repo 中無標記為 `private` 的素材
3. 公開 repo 中不存在 `kb/notes/`、`sources/`、`rosters/` 路徑；且在**未掛載私有目錄**的情況下能完整 build（這同時證明沒有私有內容被複製進來）
4. 無學生資料
5. §6.5 的產物檢查
6. **`npm test` 全綠**（§9.5）

hook 是禮貌，CI 是規則。修訂 2 把兩者混為一談。

---

## 15. 從零重建：與舊系統的關係

### 15.1 舊 repo 的處置

`agent-skill-lecture-builder-main` 凍結為**唯讀參考**，不再開發、不再部署。**但保持可用**，直到新系統實際帶完一堂課為止（見 §17 中止條件）。

若 §17.1 的中止條件觸發，退路是 §1.9 的修補路線——屆時舊 repo 解除凍結，成為修補的基底。

**新的三個 repo 一律 `git init` 從空的開始，不 clone、不 fork 舊 repo。** 舊歷史帶著 87MB 的 `lectures/`（22 個 committed `index.html` 加未優化的 PNG），而 git 歷史一旦帶進來就洗不掉——`filter-repo` 會改寫所有 commit SHA，使 §5.9 的 `--pin` 機制從第一天起就指向不存在的提交。需要的檔案用複製的方式帶進新 repo（§15.2 的清單），歷史留在舊 repo 裡供查閱。這個決定必須在**建立新 repo 的那一刻**做完。

### 15.2 帶過來的與不帶的

| 帶過來 | 形式 |
|---|---|
| Markdown 元件語彙（註冊 30 個，**實際用到 21 個**） | 重新實作於 `parse.mjs`。**語法相容，但語意分四類**（§6.2.1）：A 類直接對映、B 類在 deck 中拆頁、C 類 deck 降級、D 類（`bonus` / `vote`）搬遷時就地改寫為課程層概念，不實作。「作者不需重學」只在 page / handout 上完全成立；deck 上 B、C 類的呈現會變，搬遷時要逐一確認。**第一刀只實作實際用到的那幾個**（§17.1） |
| 課堂工具的行為邏輯 | 從 `assets/course.js` 抽取，重寫為 §7 的 runtime 模組 |
| 6 個 AI Skills 的 prompt | 沿用，輸出目標改為 `.md`（見 §9.3） |
| `config.yaml` 兩層 deep merge 機制 | 沿用 |
| 正在教的課程內容 | 手動搬遷（見 §15.3） |

| 不帶 | 原因 |
|---|---|
| `build.mjs`（1,871 行） | 單檔結構無法承載多層內容模型與七種產物 |
| 自寫 YAML 解析器 | 已知缺陷，改用 `js-yaml` |
| 題目 id 推導邏輯（`:685`） | 根本性缺陷，見 §5.8 規則 2 |
| `editor/` 的下載式儲存 | 雙真相來源的成因 |
| Google Apps Script 投票後端 | 配額、延遲、可灌票 |
| 原作者的 `index.html` 版面 | 目標版面是 `full_template` |
| committed build artifacts | 與 §14 對立 |

### 15.3 課程遷移

**只搬正在教的課程**：`aigc-comic-p4p6`、`aigc-exam-hour1`、`aigc-exam-hour2`。手動進行，順帶抽出第一批可重用片段。

其餘 19 門留在舊 repo。需要重開時再搬，屆時知識庫已有基礎。**不寫自動遷移工具**——為一個已知有缺陷的舊格式寫相容層，成本高於手搬三門課，而且會把舊格式的假設帶進新系統。

---

## 16. 技術選型

| 部分 | 選擇 | 理由 |
|---|---|---|
| 後端 | Node + Hono + Postgres + Drizzle | Zeabur 一鍵部署，輕量，型別安全 |
| 即時 | **SSE（下行）+ POST（上行）。不做 WebSocket** | 取代輪詢；純 HTTP，天然穿透學校 proxy（§10.4） |
| 投影片引擎 | `deck-stage.js`（沿用 full_template） | 1,746 行、現場實測過，重寫無收益 |
| 前端 | vanilla JS + Web Components | 與 `deck-stage.js` 一致，無框架 |
| Markdown 解析 | 自寫 tokenizer（沿用元件語法）+ 標準 AST | 元件語法為自訂 DSL，通用 parser 幫助有限 |
| YAML | `js-yaml` | 支撐巢狀 `objectives` 與 `sections` |
| 字型子集 | `subset-font`（Node） | §6.3 |
| **圖片** | **`sharp`** | §6.7 的重壓縮與尺寸上限；原生模組，但這是唯一能把 24MB 壓成 1.6MB 的東西 |
| QR | `qrcode`（Node，產 SVG） | 移除 cdnjs 相依 |
| PDF | Puppeteer，**列為 optional dependency** | 只服務七種產物中的兩種（handout / worksheet）。裝不起來時 `build` 照常運作，僅該兩項跳過並警告；CI 的測試 job 不需要它。舊 repo 把 200MB 的 Chromium 綁成必裝相依，只為了產 OG 圖 |
| 內容 hash | SHA-256 前 6 碼 | `course.lock` 的變更偵測 |
| 版本還原 | `git worktree` + lock 中的 commit SHA | `--pin`；hash 無法反推內容（§5.9） |
| 測試 | node:test + Playwright（headless、離線 context） | §9.5 |
| 部署 | 課堂層：Zeabur **或** `docker-compose`（app + postgres）自架；靜態教材與 notebook：GitHub Pages | 學校要求資料落地時走自架；兩者共用同一份映像 |

---

## 17. 分階段實作與中止條件

### 17.1 第一刀：讓它能上一堂課

**範圍就是這一條路：`course.md` + `blocks/` → `deck.html` + `podium.html`（single-file）→ 拿去上一堂真課。**

需要做的：

- **先決工作：為 6 個元件決定投影片語意。** `aigc-comic-p4p6` 實際用到 10 種元件（已清點：image-text 9、callout 5、summary 4、quiz 3、compare 2、bonus 2、vote / tags / steps-status 各 1、flow 1），其中 §6.2 原本只對映了 4 種。`image-text`（本課最常用）、`summary`、`tags`、`steps-status` 要定版面，`bonus` / `vote` 要就地改寫成課程層概念。**這是設計工作不是實作工作，約 2–3 個工作天，已計入 §19 的估計**
- `parse.mjs`——**只實作這 10 種**，其餘元件語法遇到即輸出佔位並警告。21 個全做是第二階段的事
- **建立第一批 concept**：因為 `concepts` 必填且 `validate` 檢查存在，在寫第一個片段之前要先手工建 15–25 個 `kb/concepts/*.md`（ingest 的自動萃取在階段二才有）。約 1 個工作天
- `renderers/deck.mjs`（含 §6.2.3 的前置轉換層——B 類元件拆頁）
- `renderers/podium.mjs`——**最小版**：目前頁 + 下一頁縮圖、`[notes]` 講稿、降級速查表（§6.6 的 1、2、7）
- 字型子集、單檔打包
- **圖片管線（§6.7.1）與資產預算檢查（§6.7.2）**。這是阻斷級的：`aigc-comic-p4p6` 的 19 張圖共 24MB，未經優化直接內聯會產出約 32MB 的 `deck.single.html`——而單檔離線正是本階段的驗收條件與 §10.6 指定的 Plan B。管線本身約半天（`sharp` + 快取鍵已由 §5.9 的雜湊提供）
- `quiz.mjs` 與 `timer.mjs` 兩個 runtime 工具（本機模式）
- `validate` 的產物檢查（§6.5 前四項）與 §5.12 的壞引用處理
- **§9.5 的三項測試**：parse 單元測試、deck/podium golden-file、單檔離線載入測試
- 手搬 `aigc-comic-p4p6` 的內容成片段

**不做的**：ingest、其餘五個 renderer、課堂層、Colab、個人化練習、版本鎖定、瀏覽器輕編輯、`assert` 工具（第一刀的 assertion 手寫）、bloom 檢查（欄位先寫進格式，檢查邏輯留到階段二）。

**驗收**：用它上完一堂 `aigc-comic-p4p6`，投影與講稿全程來自新系統。

明確允許的例外（用了不算失敗，因為這些的 renderer 本階段根本沒做）：

- 練習卷與講義沿用既有紙本或舊系統產出
- 作品展示用實體方式（便利貼、實體展示）
- 沒有課堂即時資料回收

**中止條件**：**五週**內做不到上述驗收，停手，改走 §1.9 的修補路線（4–6 週）。

為什麼是五週而不是三週：第一刀的估計是 3–4 週（§19）。中止條件若貼著估計值訂，觸發的多半是「工時估錯了一點」，而不是「設計有問題」——那會讓你放棄一個其實正確的設計。中止條件要卡在**明顯做不到**的位置。

理由：投影片能上課之前，其餘功能全部是零。原本的五步切片同時要求 ingest 管線、七個 renderer、Postgres、WebSocket、作品牆、PDF、Colab——那不是切片，是大半個系統，而 §21 又把「重建期間沒有可用系統」列為最大風險。兩者不能並存。

### 17.2 後續階段

每階段獨立產出實作計劃，且**每階段結束都必須實際上一堂課**才進下一階段。

| 階段 | 範圍 | 驗收 |
|---|---|---|
| 二 | 其餘元件 + ingest + `assert` + handout/worksheet renderer + 版本鎖定（`--pin`）+ 瀏覽器輕編輯 + bloom 對齊檢查 + **`senior` profile 與 TTS** | 從一份舊 PPT 出發，2 小時內備完一堂新課並印出講義；用 `senior` profile 上一場公眾講座 |
| 三 | 課堂層（`podium` + `device`）+ 即時測驗 + 作品牆三道閘 + 提問箱審核 + 節奏條 + 講台頁完整版 | 30 人班實際使用，含一次故意斷網（拔掉 AP，驗證本機暫存與補送） |
| 四 | 預習 + 個人化練習（含證據門檻、bloom 分層、人審）+ 紙本快速批改 + Colab + portal | 一輪完整的「預習→上課→課後練習」跑完 |
| 五 | 其餘 profile（`public` / `teen` 微調）、分組任務板、注音、交接包 `export` | 各自獨立驗收 |

`senior` 與 TTS 從階段五提前到階段二：兩者都是呈現層的事（第二組色票 + Web Speech API），成本低，而它們是「5–80 歲」這個宣稱的另一端。把它壓到最後，等於這個目標在四個月內都是空的。

---

## 18. 有效性量測

整套系統若只優化備課速度與資料回收，做完之後能回答「我備課快了多少」，卻答不出「學生是不是學得更好」。**能快速產出的東西，往往只是更快地產出無效教學。**

第一階段就埋最小對照：

| 項目 | 做法 |
|---|---|
| 對照 | 同一門課、相近的兩班（或同一班的前後兩次），一次舊 PPT、一次新系統 |
| 量測 | 課後同一份 5 題後測，題目取自 `kb/qbank/` 中標記 `holdout: true` 者，涵蓋該課的核心 concept |
| **第一階段怎麼收** | 第一階段沒有課堂層、沒有 `responses` 表。後測**印在紙上、當場作答、手動統計**（5 題 × 30 人約 10 分鐘）。產出方式是 `dist/posttest.html` 加一段 A4 列印樣式，老師按 Ctrl+P——**不產 PDF**。第一刀不做 PDF renderer，為了一張五題的考卷把 Puppeteer 拉進第一階段的相依，是本末倒置（修訂 4 的版本要求 `dist/posttest.pdf`，那條與 §16 把 Puppeteer 列為 optional 相矛盾，此處修正）。手寫一張 A4 同樣算數：**重點是有沒有收到那五題的正確率，不是它從哪個工具印出來** |
| **避免污染** | `holdout` 題**不進課堂、不進個人化練習**（§5.8 規則 8）。否則後測題可能剛好是學生課後練過的那幾題 |
| 記錄 | 後測正確率、課堂完成度（有沒有講完）、備課耗時（自記） |
| 判讀 | 不做統計檢定。看的是有沒有**明顯變差**——若新系統的後測明顯較低，代表某個設計決定錯了，要找出來 |
| **順序效應** | 新系統那次通常在後，老師更熟內容。若條件允許，兩班對調一次順序；不能對調時，把這個偏誤寫在紀錄旁邊，不要假裝沒有 |

另外記一個數字：**片段被引用次數的分布**。

整套設計的回報與「同一片段被幾門課引用」成正比，但這個分母從未被量過。`npm run validate` 每次輸出一行：`共 N 個片段，被引用 ≥2 次者 M 個（M/N = x%）`。若跑了半年 `x` 仍接近 0，代表重用模型對你的實際教學型態不成立——那比任何功能缺陷都值得知道。

不需要嚴謹，需要的是**一個會讓你願意推翻自己的數字**。沒有這個回饋迴路，後續每一次擴充都只能靠感覺決定。

---

## 19. 工時估計

以晚上與週末的節奏（每週約 8–12 小時可投入）：

| 階段 | 樂觀 | 含緩衝的實際預期 | 主要不確定性 |
|---|---|---|---|
| 一：deck + 講台頁最小版 + 測試 | **3–4 週** | 4–6 週 | 字型子集與單檔打包的坑；`deck-stage.js` 整合；**6 個元件的投影片語意設計（2–3 天）、第一批 concept 建立（1 天）、圖片管線與資產預算（半天）已計入** |
| 二：其餘 11 個元件 + ingest + 講義 + 版本鎖定 + senior | 4–5 週 | 7–9 週 | PPTX 抽取品質差異極大；`--pin` 的 worktree 流程。**已清點：實際只需 21 個元件而非 30+，此階段比原估計小** |
| 三：課堂層 | 4–6 週 | 8–12 週 | 部署、上傳與審核、30 人現場的實際問題。**單一 SSE 路徑（不再有 WS/SSE 雙路徑）使此階段略小** |
| 四：預習 + 個人化練習 | 3–4 週 | 5–7 週 | 出題邏輯需實際資料反覆調整；bloom 分層要真的有 `short`/`task` 題才驗得起來 |
| 五：其餘 profile 與工具 | 視需要 | 視需要 | — |
| **一到四合計** | **約 3.5–4.5 個月** | **約 6–8 個月** | |

**用哪個數字做決定**：以晚上的節奏、單人、跨這麼多技術面（parser、renderer、PDF、字型、後端、即時、資料模型），樂觀值幾乎不會實現。**應該用 6–8 個月來決定要不要開始。**

若 6–8 個月不可接受，正確的做法不是壓縮估計，而是**只做第一刀（4–6 週）+ §1.9 的修補路線（4–6 週）**——約兩到三個月，換到「新系統的投影片 + 舊系統修好的題庫與 id」，並保留日後再往下走的選項。

**這個數字必須寫出來，因為它會決定要不要開始。** 40% 的重建比 0% 更糟——那時舊系統已經半荒廢，新系統還不能上課。§17.1 的五週中止條件與 §1.9 的退路，就是為了避免走到那個位置。

---

## 20. 已定決策

1. **教材真相來源為檔案**（repo 中的 `.md`），非資料庫。`ContentProvider` 介面為日後遷移預留。
2. **學生端採輕量真後端**，部署於 Zeabur **或自架 Docker**（學校要求資料落地時），非純靜態、非 Google Apps Script。
3. **ingest 預設只重組、不重寫**；assertion 為獨立的人工確認工序，不自動化，且只對 `explain` 型必填。
4. **前端不引入框架**，vanilla JS + Web Components。
5. **學生免註冊**；`podium` 為預設模式，掃碼加入為進階。
6. **內容原子是片段（1–20 分鐘），知識點是全域骨幹**；受眾差異以選不同片段表達，不以條件塊表達。
7. **不做「片段套裝」中間層。** 取捨：常一起出現的三個片段，在 5 門課裡要各列 3 次；加第 4 個片段時要改 5 處。接受這個成本，換取只有一種重用原子的模型。若日後這個痛超過門檻，再加。
8. **`cut` 屬於課程編排，`level` 屬於片段**；節奏條依 `cut` 建議。
9. **教學品質檢查一律報告制**，`publish` 才升級為阻斷；結構性錯誤（重複 id、解析失敗）兩者皆擋。
10. **個人化練習需證據門檻（≥4 次計分作答、≥2 場合）且需老師人審**才發出；**前測作答不計入證據**。
11. **內容 repo 公開**（Colab 前提）；`kb/notes/`、`sources/`、學生資料私有；build 不依賴私有部分即可完整成功。不宜公開的課程放私有側，代價是該課不可用 Colab。
12. **從零重建**，舊 repo 凍結但保持可用；只手搬正在教的三門課，不寫遷移工具。**中止後的退路是 §1.9 的修補路線（4–6 週），不是回舊系統原樣。**
13. **投影片採用 `full_template` 設計系統**，沿用 `deck-stage.js`，字型自主化以滿足離線需求；`senior` 另有一組 AAA 對比色票。
14. **每階段結束必須實際上一堂課**；第一刀中止條件為五週，且驗收明列允許的例外。
15. **講台頁為第七種產物**（`podium.html`），與 deck 同源同 build。**講者備註（`[notes]`）與 profile 無關**，所有 profile 都輸出到講台頁，永不進投影畫面。
16. **對齊檢查納入認知層次**：LO 與題目皆須宣告 `bloom`；題型擴充至含 `short` / `task`（人工評分），否則 `apply` / `analyze` 層次無法被評量。`concept_mastery` 按 `bloom_band` 分流。
17. **`course.lock` 同時記錄內容 hash 與 git commit SHA**；`--pin` 以 `git worktree` 還原。`publish` 前工作區必須乾淨。
18. **golden-file 測試自第一刀起**；任何會讓「投出去那一頁壞掉」或「學生資料算錯」的東西都要有測試。CI 是唯一的閘，pre-push hook 只是提醒。
19. **`kids` profile 不走 Colab**（Google 帳號年齡限制），改走課堂示範 + 純網頁練習。
20. **`senior` profile 與 TTS 提前至階段二**，不排到最後。
21. **未成年影像需 `media_consent` 旗標**；**匿名提問箱與作品牆同級審核**（老師點過才顯示）。
22. **紙本練習於階段一至三明確不回收**，階段四提供老師端快速批改；不做拍照 OCR。
23. **元件依語意分四類**（§6.2.1）：A 直接對映、B 在 deck 中拆頁、C 在 deck 中降級、D（`bonus` / `vote`）改寫為課程層概念不實作。deck renderer 因此需要**前置轉換層**（§6.2.3），不是單純的 AST visitor。
24. **必填欄位不擋寫作**：`npm run tidy`（§8.4）以「AI 提案、老師確認」補齊 id / concept / bloom / duration，草稿階段全部可空，`publish` 前補齊。
25. **提供片段檢索**（§9.7）：`validate` 產出 `dist/index.json`，`npm run find` 依此搜尋。重用的前提是找得到。
26. **圖片一律經管線處理，且有資產預算**（§6.7）：`sharp` 重壓縮至 1600px / WebP，公開 repo 只放衍生檔、原圖留 `lesson-private/sources/media/`，`deck.single.html` 超過 16MB 即 `publish` 阻斷。第一刀就要做——24MB 的圖會讓單檔離線這個 Plan B 直接失效。
27. **開發迴圈有延遲預算：存檔到 deck 更新 < 500ms**（§9.1）。這條預算否決了「每次存檔重建七種產物」「重建所有引用該片段的課程」「watch 迴圈裡產 PDF」。快取鍵沿用 §5.9 已要計算的 SHA-256（§9.8）。
28. **`concept_mastery` 是 view，不是表**（§10.3）。`responses` 是唯一事實來源；實測慢到影響課堂時才改 materialized view。先做對，需要時再做快。
29. **即時只做 SSE + POST，不做 WebSocket**（§10.4）。本系統的流量型態用不到 WS 的任何一項優勢，而砍掉它同時消滅「WS 被學校 proxy 擋」這整個失敗模式與兩套連線程式碼。日後有實測數字證明 SSE 不夠時再加。

---

## 21. 風險與取捨

| 風險／取捨 | 應對或記錄 |
|---|---|
| **重建期間沒有可用系統** | §17.1 把第一刀砍到五週可達並訂死中止條件；舊 repo 保持可用；中止後直接走 §1.9 的修補路線。這是最大風險 |
| **工時實際落在 6–8 個月而非 3–4 個月** | §19 同時列出兩個數字並指定用後者決策；若不可接受，明列「第一刀 + 修補路線」這個兩到三個月的替代方案 |
| **重用犧牲可攜性**（取捨，非缺陷） | 一門課從「一個資料夾」變成「一串指向個人知識庫的指標」，交接成本上升。以 §9.6 的 `npm run export` 提供單向出口；`course-flat.md` 不保證能讀回。接受這個代價換取重用 |
| **`concept_mastery` 只量得到進得了系統的作答**（取捨） | 紙本作答在階段四之前不回收；`apply` 題若全走紙本，該檔會停在 `unknown`。`rationale_json` 必須明示系統「不知道什麼」（§12.2） |
| **重用的複利分母未知** | §18 每次 `validate` 輸出「被引用 ≥2 次的片段比例」。半年後仍接近 0，代表模型不適合你的教學型態 |
| 片段切太碎，編排變成拼圖 | `explain` 下限 1 分鐘但**上限也管**：`activity` 超過 20 分鐘要拆。課程層 `sections` 提供結構，不會變成一長串扁平清單 |
| 沒有片段套裝層，重複列舉 | 決策 7 已記錄取捨與加回的觸發條件 |
| concept 命名前期定不好 | `aliases` 機制 + id 一經引用即不改。前 20 個 concept 建立時刻意放慢 |
| 版本鎖定增加操作負擔 | 只在 `publish` 產生，平時 `teach` 不涉及；警告出現在講台頁而非阻斷。版本機制中唯一的硬性阻斷是「publish 前工作區要乾淨」 |
| 公開 repo 的素材授權 | §8.1 記錄來源，來源不明者標 `private`；§14.3 CI 把關 |
| **七個 renderer 增加維護面** | 共用同一份 AST；第一刀只做 deck + 講台頁最小版；**每新增一個 renderer 先寫 golden 測試**。若某個 renderer（最可能是 handout）與 deck 的資訊架構分歧過大，**允許它擁有自己的中間表示**，而不是把 AST 撐成兩者的聯集 |
| **資料在老師個人的雲端帳號**（取捨） | §13 明記持有者風險與離職失聯；學校要求落地時走自架 Docker（§16）。不假裝這是機構級方案 |
| 未成年資料合規 | §13 的預設不收 PII + `media_consent` 同意旗標 + `podium` 模式零個人資料 + 30 天自動刪除 + 作品牆與提問箱各三／四道閘 |
| ~~WS 被學校 proxy 擋~~ **（已消除）** | 決策 29 砍掉 WebSocket，此失敗模式隨之消失。剩下的是斷網——§10.4 的本機暫存與補送，階段三驗收含一次故意斷網 |
| **圖片體積拖垮單檔離線**（原本會發生） | 決策 26 的管線與資產預算。這條在修訂 5 之前是未被發現的阻斷級問題：19 張圖 24MB → 約 32MB 的單檔 HTML |
| 個人碼遺失 | §10.2 第 4 點的老師端對照表（刻意的 PII 例外，可關閉） |
| 系統做完但教學沒變好 | §18 的最小對照 + holdout 題 + 順序效應的誠實記錄 |

---

## 22. 下一步

1. 本 spec 經確認後，以 `writing-plans` 產出**第一階段（§17.1）**的實作計劃——範圍僅到「deck + 講台頁最小版能上一堂課」。元件清點已於修訂 4 完成（實際 10 種），因此計劃第一步是**為 `image-text` / `summary` / `tags` / `steps-status` 決定投影片語意，並把 `bonus` / `vote` 改寫為課程層概念**（§6.2.1 的 D 類）——這是設計工作，做完才知道 `parse.mjs` 與 `renderers/deck.mjs` 要寫什麼
2. 建立三個新 repo 時**用 `git init`，不 clone 舊 repo**（§15.1），且在第一次 push 之前先把圖片管線接上（§6.7.3）。這兩件事之後補做的成本是改寫歷史
3. 第一階段完成並實際帶完一堂課後，依 §18 的量測結果與實際使用感受，決定是否進入第二階段、以及是否要修改本 spec 的後續設計
4. 若五週中止條件觸發，改走 §1.9 的修補路線，並保留本 spec 作為日後重啟的依據
