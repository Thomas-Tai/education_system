# 開場：體驗入口與學習目標
> 在正式刷題之前，先建立對 AIGC 技術的直觀認知，並明確本節課的學習方向與刷題策略。

## 課程定位

### 這是什麼課
- 2026 年 AIGC 初級考試「全題庫精通」強化課的第一小時
- 涵蓋單選題 60 題、多選題 40 題，共 100 題理論題庫
- 以四輪分組刷題為核心，搭配自查提示卡與答案解析

### 學習目標
- 能叫出 AIGC 核心技術的正式名字（Transformer、擴散模型、GAN、DALL-E、VideoGPT）
- 知道每個技術名稱背後在做什麼事
- 掌握數據安全三端風險與法律框架
- 熟練 Prompt 萬能公式與文案模型（AIDA / PAS）

## 刷題流程總覽

[flow]
1. Round 1 — AIGC 基礎與數據安全（26 題，17 分鐘）
2. Round 2 — 核心算法模型（34 題，20 分鐘）
3. Round 3 — 提示詞工程與文案應用（35 題，15 分鐘）
4. Round 4 — 倫理與綜合應用（5 題 + 回補，8 分鐘）
[/flow]

[tags]
- [blue] 六大知識模塊：提示詞工程 / 核心算法 / AIGC 基礎 / 文案生成 / 數據安全 / 倫理社會
- [green] 單選 60 題 + 多選 40 題
- [orange] 多選題為易失分重災區
- [purple] 每輪附自查提示卡
[/tags]

[callout type="tip" title="刷題策略"]
本課程採用「學生自刷 + 教師輪末快速回顧」模式。每輪刷題結束後對照自查提示卡核對思路，標記不確定的知識點，留待第二小時針對性補強。
[/callout]

## 六大知識模塊一覽

[compare-table headers="模塊 | 涵蓋知識點 | 相關題數"]
- A. 提示詞工程 | Prompt 設計、萬能公式、類型、倫理 | ~18 題
- B. 核心算法模型 | VideoGPT、DALL-E、擴散模型、GAN、VQ-VAE | ~22 題
- C. AIGC 基礎概念 | 定義、特點、發展驅動、跨模態 | ~10 題
- D. 文案生成應用 | AIDA / PAS 模型、大模型寫作、優化 | ~14 題
- E. 數據安全 | 輸入 / 傳輸 / 輸出風險、法規、技術保障 | ~18 題
- F. 倫理與社會影響 | 隱私、偏見、虛假信息 | ~8 題
[/compare-table]

---

# Round 1：AIGC 基礎與數據安全
> 第一輪涵蓋 AIGC 核心定義、發展驅動因素、跨模態概念，以及數據安全三端風險與法律框架。共 26 題（單選 16 題 + 多選 10 題），建議 17 分鐘完成。

## AIGC 核心概念

### AIGC 的定義與特點

AIGC 全稱為 AI Generated Content，即「人工智能內容生成」。關鍵在於 G = Generated，指 AI 端到端生成內容，而非輔助或用戶生成。

[quiz type="single"]
Q: AIGC 是指？（Q51）
- [ ] A. 專業內容生成
- [ ] B. 用戶內容生成
- [ ] C. AI 輔助內容生成
- [x] D. 人工智能內容生成
Hint: AIGC = AI Generated Content，G = Generated，強調 AI 端到端生成。
[/quiz]

[quiz type="single"]
Q: 下列不屬於 AIGC 生成內容範圍的是？（Q49）
- [ ] A. 文本內容
- [ ] B. 視頻內容
- [x] C. GPS 中頻數字信號
- [ ] D. 圖像內容
Hint: GPS 中頻數字信號是物理信號，不是 AI 生成內容。
[/quiz]

[quiz type="single"]
Q: AIGC 相比以人工為主內容生成的優勢是？（Q57）
- [x] A. 速度更快
- [ ] B. 內容更專業
- [ ] C. 成本更高
- [ ] D. 內容更穩定
Hint: AIGC 核心優勢 = 快 + 省，不是「更專業」或「更穩定」。
[/quiz]

[quiz type="single"]
Q: 下面不屬於 AIGC 發展驅動因素的是？（Q4）
- [ ] A. 更多的數據和算力
- [x] B. 慢工出細活的工匠精神
- [ ] C. 更好的模型
- [ ] D. 更豐富的應用需求
Hint: AIGC 三駕馬車 = 數據算力 + 模型 + 應用需求。「工匠精神」是干擾項。
[/quiz]

### 跨模態與單模態

跨模態生成是指模型的輸入和輸出屬於不同的模態（如文字生成圖片）。單模態則是輸入輸出屬於同一模態（如文字生成文字）。

[quiz type="single"]
Q: AIGC 的跨模態生成是指？（Q7）
- [ ] A. 模型的輸入是兩個不同的模態
- [x] B. 模型的輸入和輸出屬於不同的模態
- [ ] C. 模型的輸出是兩個不同的模態
- [ ] D. 模型的輸入和輸出都是兩個不同的模態
Hint: 跨模態定義 = 輸入輸出模態類型不同，如文生圖、文生視頻。
[/quiz]

### 算力與數據

[quiz type="single"]
Q: 關於 AIGC 算力的表述錯誤的是？（Q52）
- [ ] A. 算力一般指 GPU/TPU 為主的 AI 專用加速器的計算和傳輸能力
- [ ] B. AIGC 模型的規模和複雜度不斷增加，對算力的需求也在急劇上升
- [x] C. 大部分 AIGC 大模型單台服務可完成預訓練
- [ ] D. 數據和算力對 AIGC 的發展都很重要
Hint: 大模型必須分布式訓練，單台伺服器無法完成預訓練。
[/quiz]

[quiz type="single"]
Q: 關於 AIGC 數據的表述錯誤的是？（Q18）
- [ ] A. 數據是 AIGC 發展的基礎要素
- [ ] B. 數據的質量、多樣性和規模對模型性能有直接影響
- [x] C. AIGC 大模型以大規模標注數據有監督預訓練為主
- [ ] D. 沒有足夠的數據，大模型無法進行有效的訓練和優化
Hint: 大模型多採用自監督 / 半監督學習，而非有監督預訓練。
[/quiz]

## 數據安全三端風險

### 輸入端、傳輸端、輸出端

數據安全風險按照數據流向分為三端，每端有各自的風險類型。

[callout type="warning" title="三端風險口訣"]
輸入怕偷怕毒，傳輸怕攔怕改，輸出怕壞人用。

- 輸入端：非法獲取 / 數據投毒
- 傳輸端：數據攔截 / 數據篡改 / 未授權訪問
- 輸出端：惡意內容生成 / 指令注入攻擊
[/callout]

[quiz type="single"]
Q: 數據安全風險分析中，哪一項屬於數據輸入端的風險？（Q22）
- [x] A. 數據非法獲取與投毒風險
- [ ] B. 數據訓練偏見風險
- [ ] C. 數據洩露風險
- [ ] D. 惡意內容生成風險
Hint: 輸入端特有風險 = 非法獲取 + 投毒。訓練偏見屬於模型階段問題。
[/quiz]

[quiz type="single"]
Q: 根據課程內容，數據傳輸端的風險不包括下列哪項？（Q42）
- [ ] A. 數據攔截風險
- [ ] B. 數據篡改風險
- [x] C. 數據訓練偏見風險
- [ ] D. 未經授權訪問風險
Hint: 訓練偏見屬於模型階段，不是傳輸端風險。傳輸端 = 攔截 + 篡改 + 未授權。
[/quiz]

[quiz type="single"]
Q: 在數據輸出端，惡意內容生成風險主要包括下列哪種攻擊方式？（Q14）
- [ ] A. 數據非法獲取
- [x] B. 指令注入攻擊
- [ ] C. 數據洩露
- [ ] D. 數據訓練偏見
Hint: 輸出端 = 指令注入 + 惡意生成。非法獲取是輸入端的事。
[/quiz]

### 真實案例：三星數據洩露

> **2023 年三星事件**
> 三星員工將公司內部源代碼貼入 ChatGPT 詢問問題，導致機密數據進入 OpenAI 訓練池，事後無法撤回。這屬於輸入端風險（數據非法流出）。

[callout type="info" title="典型案例"]
WannaCry 勒索病毒事件（Q33）屬於傳輸端被攻擊的典型案例。考題問「哪個不屬於傳輸端」，答案是「數據訓練偏見」——那是模型問題，不是傳輸問題。
[/callout]

[quiz type="single"]
Q: 以下哪個案例體現了網絡安全防護的重要性？（Q33）
- [ ] A. 某公司員工誤將重要文件發送至錯誤郵箱
- [x] B. WannaCry 勒索病毒事件
- [ ] C. 某工廠電力故障導致設備損壞
- [ ] D. 某社交應用未考慮用戶隱私引發抵制
Hint: WannaCry 是典型的網絡安全事件，其餘選項屬於操作失誤 / 物理故障 / 隱私設計問題。
[/quiz]

## 數據安全法律框架

### 三法口訣

[callout type="warning" title="三法口訣：網絡、個人、數據"]
數據安全法律框架只包含三部法律，其餘全是干擾項：
- 網絡安全法
- 個人信息保護法
- 數據安全法

干擾項家族：市場準入法、反壟斷法、勞動法——名字裡沒有「安全」「個人信息」「數據」「網絡」之一的，都是干擾項。
[/callout]

[quiz type="single"]
Q: 關於數據安全需求分析，以下哪項不屬於法律法規保障層面的法律？（Q11）
- [ ] A. 網絡安全法
- [ ] B. 個人信息保護法
- [x] C. 市場准入法
- [ ] D. 數據安全法
Hint: 三法 = 網絡安全法 + 個人信息保護法 + 數據安全法。市場準入法是干擾項。
[/quiz]

[quiz type="single"]
Q: 數據安全政策與標準現狀中提到的法律框架層面，不包括以下哪項？（Q34）
- [ ] A. 網絡安全法
- [x] B. 反壟斷法
- [ ] C. 個人信息保護法
- [ ] D. 數據安全法
Hint: 反壟斷法不在數據安全法律框架內。
[/quiz]

## 技術保障與企業自查

[quiz type="single"]
Q: 數據安全需求分析中提到的技術層面保障不包括以下哪項？（Q54）
- [ ] A. 加密技術
- [ ] B. 密鑰管理
- [ ] C. 訪問控制
- [x] D. 市場營銷策略
Hint: 技術三寶 = 加密 + 密鑰 + 訪問控制。市場營銷屬外部拓展，非技術保障。
[/quiz]

[quiz type="single"]
Q: 傳統安全風險評估的定性評估方法不包括以下哪種？（Q1）
- [ ] A. 風險矩陣法
- [x] B. 概率分析
- [ ] C. 德爾菲法
- [ ] D. 情景分析法
Hint: 概率分析屬於定量評估；風險矩陣法、德爾菲法、情景分析法均為定性評估。
[/quiz]

## Round 1 多選題精選

[quiz type="multi"]
Q: 下列屬於 AIGC 特點的是？（M38）
- [ ] A. AI 為輔人工為主
- [x] B. 快速低成本製作
- [x] C. 跨模態生成內容豐富
- [x] D. AI 端到端生成
Hint: A「AI 為輔人工為主」是舊模式，不是 AIGC 特點。BCD 正確。
[/quiz]

[quiz type="multi"]
Q: 在數據傳輸端，存在哪些風險？（M1）
- [x] A. 數據攔截風險
- [x] B. 數據篡改風險
- [x] C. 未經授權訪問風險
- [ ] D. 數據分類分級不當風險
Hint: 傳輸端三風險 = 攔截 + 篡改 + 未授權。D 屬於內部管理風險。
[/quiz]

[quiz type="multi"]
Q: 數據安全政策與標準現狀中，哪些屬於法律框架層面的法律？（M25）
- [x] A. 網絡安全法
- [x] B. 個人信息保護法
- [ ] C. 勞動法
- [x] D. 數據安全法
Hint: 三法 = 網絡安全法 + 個人信息保護法 + 數據安全法。勞動法是干擾項。
[/quiz]

## Round 1 自查要點

[summary]
- **AIGC 定義** | AIGC = 人工智能「生成」內容（D），非輔助、非用戶生成。三駕馬車 = 數據算力 + 模型 + 應用需求
- **跨模態 vs 單模態** | 跨模態 = 輸入輸出不同模態（文生圖）；單模態 = 同模態（文生文、圖生圖）
- **數據安全三端** | 輸入（非法獲取 / 投毒）、傳輸（攔截 / 篡改 / 未授權）、輸出（指令注入 / 惡意生成）
- **數據安全三法** | 網絡安全法 + 個人信息保護法 + 數據安全法。市場準入法、反壟斷法、勞動法均排除
- **定性 vs 定量** | 定性：風險矩陣法、德爾菲法、情景分析法。定量：概率分析、蒙特卡羅模擬
[/summary]

---

# Round 2：核心算法模型
> 第二輪是本課程最硬的算法題區塊，涵蓋 VideoGPT、Transformer、DALL-E、擴散模型、GAN 五大模型。共 34 題（單選 20 題 + 多選 14 題），建議 20 分鐘完成。

## Transformer 基礎

### 原生 Transformer 的輸出

Transformer 是 AIGC 領域最廣泛應用的架構。2017 年原版設計專為自然語言處理，原生輸出為文本（詞元序列）。後續的 GPT-4o 等多模態版本是改造版，考試問的是原版。

[quiz type="single"]
Q: 原生 Transformer 模型的輸出是？（Q37）
- [ ] A. 圖像
- [ ] B. 視頻
- [ ] C. 音頻
- [x] D. 文本
Hint: 「原生」二字 = 2017 年原版設計 = 文本（詞元序列），不是後來的多模態改造版。
[/quiz]

[quiz type="single"]
Q: 以下哪種模型架構被廣泛應用於 AIGC 並具有顯著優勢？（Q27）
- [ ] A. CNN（卷積神經網絡）
- [ ] B. RNN（循環神經網絡）
- [ ] C. LSTM（長短時記憶網絡）
- [x] D. Transformer
Hint: Transformer 以自注意力 + 並行計算優勢成為 AIGC 主流架構。
[/quiz]

## VideoGPT 架構

### VQ-VAE + Transformer 雙結構

VideoGPT 的核心由兩部分組成：VQ-VAE 負責對視頻下採樣並學習離散潛在表示；Transformer 負責自回歸預測下一時間步的離散潛在表示。

[callout type="tip" title="VideoGPT 口訣"]
VAE 下採樣，Transformer 預測下一步。

- VQ-VAE：把視頻下採樣，轉換為離散潛在表示（碼本）
- Transformer：自回歸預測下一時間步（不是全連接，是軸向注意力 Axial Attention）
- 位置編碼：在編碼器和解碼器的所有軸向注意力層之間共享
[/callout]

[quiz type="single"]
Q: VideoGPT 中用於學習原始視頻下採樣離散潛在表示的技術是？（Q8）
- [ ] A. RNN
- [ ] B. CNN
- [x] C. VQ-VAE
- [ ] D. GAN
Hint: 「離散 + 潛在表示 + 下採樣」三個關鍵詞指向 VQ-VAE。
[/quiz]

[quiz type="single"]
Q: VideoGPT 模型的主體包含哪兩個主要結構？（Q20）
- [ ] A. VQ-VAE 和 BiLSTM
- [x] B. VQ-VAE 和 Transformer
- [ ] C. VQGAN 和 Transformer
- [ ] D. BiLSTM 和 VQGAN
Hint: VideoGPT = VQ-VAE + Transformer，BiLSTM 和 VQGAN 都是干擾項。
[/quiz]

[quiz type="single"]
Q: 以下關於 VideoGPT 的說法錯誤的是？（Q35）
- [ ] A. 主要由 VQ-VAE 和 Transformer 組成
- [x] B. Transformer 採用全連接網絡結構
- [ ] C. VQ-VAE 包含編碼器和解碼器
- [ ] D. Transformer 通過自注意力機制處理視頻信息
Hint: Transformer 是自注意力 + 軸向注意力結構，不是全連接。
[/quiz]

[quiz type="single"]
Q: 在 VideoGPT 中，以下哪個不是 Transformer 的作用？（Q60）
- [ ] A. 對離散潛在變量進行自回歸建模
- [x] B. 進行圖像分類
- [ ] C. 結合時空位置編碼理解視頻序列
- [ ] D. 預測下一個時間步的離散潛在表示
Hint: 圖像分類是 ViT 的事，不是 VideoGPT 中 Transformer 的功能。
[/quiz]

[quiz type="single"]
Q: 以下關於 VideoGPT 中 VQ-VAE 位置編碼的說法，正確的是？（Q17）
- [ ] A. 初始值不是隨機生成的
- [ ] B. 只有編碼器才需要共享，解碼器不需要
- [ ] C. 是固定不變的時空嵌入
- [x] D. 在編碼器和解碼器的所有軸向注意力層之間共享
Hint: 位置編碼的關鍵特點 = 編碼器與解碼器所有軸向注意力層共享。
[/quiz]

## DALL-E 模型

### 開發公司與時間

[quiz type="single"]
Q: DALL-E 的首次發布是在什麼時間？（Q24）
- [ ] A. 2019 年
- [ ] B. 2020 年
- [x] C. 2021 年
- [ ] D. 2022 年
Hint: DALL-E 由 OpenAI 於 2021 年發布。配對記憶：DALL-E = 2021 + OpenAI。
[/quiz]

[quiz type="single"]
Q: DALL-E 是由哪家公司開發的？（Q43）
- [ ] A. Google
- [ ] B. Facebook
- [x] C. OpenAI
- [ ] D. Microsoft
Hint: DALL-E = OpenAI 2021。與上題配對記，省一半時間。
[/quiz]

### DALL-E 三組件（DTC 口訣）

[callout type="warning" title="DTC 口訣"]
DALL-E 三組件 = dVAE + Transformer + CLIP，沒有 GAN。

- dVAE（離散 VAE）：圖像編碼 / 解碼
- Transformer：文字到圖像先驗
- CLIP：文本-圖像對齊

工作流程：文本編碼 -> 先驗分布 -> 圖像解碼（最終圖像在解碼階段生成）
[/callout]

[quiz type="single"]
Q: DALL-E 的工作流程中，哪個階段負責生成最終圖像？（Q12）
- [ ] A. 數據預處理
- [ ] B. 文本編碼
- [x] C. 圖像解碼
- [ ] D. 模型訓練
Hint: DALL-E 圖像解碼階段負責生成最終圖像。
[/quiz]

[quiz type="single"]
Q: DALL-E 模型的應用場景中，以下哪項不是其主要應用？（Q23）
- [ ] A. 創意設計
- [x] B. 自動駕駛汽車
- [ ] C. 廣告創意
- [ ] D. 插畫設計
Hint: DALL-E 是文到圖模型，不涉及自動駕駛。
[/quiz]

## 擴散模型

### 前向與反向過程

擴散模型包含兩個核心過程：前向擴散（數據到噪聲，即加噪）和反向擴散（噪聲到原始數據，即去噪/恢復）。

[quiz type="single"]
Q: 擴散模型的「反向擴散過程」指的是？（Q58）
- [x] A. 從噪聲恢復原始數據的過程
- [ ] B. 從數據生成噪聲圖像的過程
- [ ] C. 訓練模型以最小化噪声
- [ ] D. 將數據映射到潛在空間的過程
Hint: 前向 = 加噪（訓練），反向 = 去噪（生成）。這是最高頻單選題。
[/quiz]

### 擴散模型三兄弟：DDPM、SGMs、SDEs

[compare-table headers="模型 | 核心特徵 | 記憶關鍵詞"]
- DDPM | 去噪擴散概率模型 | 生成高質量圖像
- SGMs | 基於評分函數的生成模型 | 評分函數（Score）
- SDEs | 使用最優貝葉斯去噪 | 最優貝葉斯
[/compare-table]

[quiz type="single"]
Q: 在擴散模型中，DDPM 主要用於？（Q28）
- [x] A. 生成高質量的圖像
- [ ] B. 優化模型訓練過程
- [ ] C. 加快圖像生成速度
- [ ] D. 減少生成過程中的噪聲
Hint: DDPM = Denoising Diffusion Probabilistic Models，主要用途 = 生成高質量圖像。
[/quiz]

[quiz type="single"]
Q: 在擴散模型中，SGMs 的核心思想是？（Q29）
- [ ] A. 使用條件生成模型提高生成質量
- [x] B. 通過優化評分函數來生成高質量圖像
- [ ] C. 使用預訓練模型加速生成過程
- [ ] D. 將數據分布轉化為高斯分布
Hint: SGMs = Score-based Generative Models，Score = 評分函數。
[/quiz]

### 擴散模型的局限性

[quiz type="single"]
Q: 擴散模型的局限性中，哪一項最為突出？（Q25）
- [x] A. 高質量生成圖像所需的計算資源非常大
- [ ] B. 生成過程的噪聲不可控
- [ ] C. 訓練過程的時間過長
- [ ] D. 不適用於大規模數據集
Hint: 記憶口訣：「貴且慢」——steps 越多 = 資源越大 = 速度越慢。
[/quiz]

## GAN 與 VQ-VAE 對比

[compare label-left="VQ-VAE" label-right="GAN"]
- 自編碼器結構（編碼器 + 解碼器） | 生成器 + 判別器對抗訓練
- 沒有判別器 | 有判別器
- 最小化重建誤差 | 使生成圖像騙過判別器
- 用於圖像和視頻的編碼與解碼 | 用於生成新圖像
[/compare]

[quiz type="single"]
Q: 以下關於 VQ-VAE 和 GAN 的說法錯誤的是？（Q39）
- [ ] A. VQ-VAE 主要用於編碼與解碼，GAN 主要用於生成新圖像
- [x] B. VQ-VAE 和 GAN 都包含生成器和判別器
- [ ] C. VQ-VAE 通常採用自編碼器結構，GAN 由生成器和判別器組成
- [ ] D. VQ-VAE 訓練目標是最小化重建誤差，GAN 是使生成圖像騙過判別器
Hint: VQ-VAE 沒有判別器，GAN 才有。這是最易錯的對比題。
[/quiz]

## Round 2 多選題精選

[quiz type="multi"]
Q: DALL-E 的架構包含哪三個重要的組件？（M18）
- [x] A. dVAE
- [x] B. Transformer
- [x] C. CLIP
- [ ] D. GANs
Hint: DTC 口訣 = dVAE + Transformer + CLIP。GAN 不是 DALL-E 組件。
[/quiz]

[quiz type="multi"]
Q: 擴散模型包含哪兩個過程？（M34）
- [x] A. 前向擴散過程
- [x] B. 反向擴散過程
- [ ] C. 向上擴散過程
- [ ] D. 向下擴散過程
Hint: 擴散模型只有前向（加噪）和反向（去噪）兩個過程，C/D 是虛構選項。
[/quiz]

[quiz type="multi"]
Q: 擴散模型的主要優點包括哪些？（M20）
- [x] A. 生成的圖像質量高
- [ ] B. 訓練過程非常快速
- [x] C. 能夠生成多樣化的圖像
- [ ] D. 需要較少的計算資源
Hint: B 和 D 恰好是擴散模型的缺點（訓練慢、資源多），不是優點。
[/quiz]

[quiz type="multi"]
Q: 生成對抗網絡通常包括哪些組件？（M24）
- [x] A. 生成器 Generator
- [x] B. 判別器 Discriminator
- [ ] C. 長時記憶
- [ ] D. 短時記憶
Hint: GAN = 生成器 + 判別器。長時 / 短時記憶是 LSTM 的概念。
[/quiz]

[quiz type="multi"]
Q: 主流的生成對抗網絡類型包括？（M6）
- [x] A. 深度卷積生成對抗網絡 DCGAN
- [ ] B. 近似最鄰域 ANN
- [x] C. Wasserstein GAN
- [x] D. 循環生成對抗網絡 CycleGAN
Hint: 主流 GAN 三家族 = DCGAN + WGAN + CycleGAN。ANN 是搜索算法，不是 GAN。
[/quiz]

## Round 2 自查要點

[summary]
- **Transformer** | 原生輸出 = 文本。AIGC 主流架構，自注意力 + 軸向注意力（非全連接）
- **VideoGPT** | VQ-VAE（下採樣 + 離散潛在表示）+ Transformer（自回歸預測）。位置編碼全層共享
- **DALL-E** | 2021 年 OpenAI。三組件 DTC = dVAE + Transformer + CLIP（無 GAN）
- **擴散模型** | 反向 = 從噪聲恢復數據。DDPM = 高質量；SGMs = 評分函數；SDEs = 最優貝葉斯。局限 = 計算資源大
- **GAN** | 生成器 + 判別器。變體：DCGAN / WGAN / CycleGAN。VQ-VAE 沒有判別器
[/summary]

[bonus title="模型對比記憶表"]
| 模型 | 核心組件 | 輸入到輸出 | 公司/年份 | 你遇過的場景 |
|------|---------|----------|---------|-------------|
| DALL-E | dVAE + CLIP + Transformer | 文字到圖像 | OpenAI (2021) | ChatGPT 的圖像生成功能 |
| VideoGPT | VQ-VAE + Transformer | 視頻/文字到視頻 | -- | AI 生成短片、視頻補幀 |
| GAN | 生成器 + 判別器 | 噪聲到圖像 | -- | 換臉 App、DeepFake |
| 擴散模型 | 前向/反向過程 | 噪聲到圖像 | -- | Stable Diffusion 的 steps 參數 |
| Stable Diffusion | 噪聲添加 + 圖像去噪 | 文字到圖像 | -- | Midjourney、ComfyUI |
[/bonus]

---

# Round 3：提示詞工程與文案應用
> 第三輪聚焦 Prompt 工程的萬能公式、高質量提示詞設計原則，以及 AIDA / PAS 文案模型。共 35 題（單選 21 題 + 多選 14 題），建議 15 分鐘完成。

## 提示詞工程核心

### Prompt 工程基本概念

提示詞工程（Prompt Engineering）是針對語言模型進行優化的技術方法，目標是提升生成文本的質量和相關性。

[quiz type="single"]
Q: 提示詞工程主要是針對什麼進行優化的技術方法？（Q40）
- [ ] A. 數據模型
- [x] B. 語言模型
- [ ] C. 算法邏輯
- [ ] D. 用戶界面
Hint: Prompt 工程針對語言模型優化，與數據模型、算法邏輯、用戶界面無關。
[/quiz]

[quiz type="single"]
Q: 提示詞工程能夠顯著提升什麼？（Q26）
- [ ] A. 模型的訓練速度
- [x] B. 生成文本的質量和相關性
- [ ] C. 用戶的計算機技能
- [ ] D. 模型的存儲效率
Hint: Prompt 工程的核心目的 = 提升生成文本的質量和相關性。
[/quiz]

### 高質量提示詞設計

[quiz type="single"]
Q: 在設計高質量的提示詞時，哪一項是最關鍵的？（Q46）
- [ ] A. 使用複雜語言
- [x] B. 提供具體的背景信息
- [ ] C. 提供簡短的指令
- [ ] D. 使用抽象的描述
Hint: 高質量 Prompt = 具體背景信息。複雜語言和抽象描述都是反效果。
[/quiz]

[quiz type="single"]
Q: 在設計提示詞時，以下哪個因素最不重要？（Q2）
- [ ] A. 目標受眾的特徵
- [ ] B. 文本生成的目標
- [x] C. 模型的訓練算法
- [ ] D. 信息傳遞的效果
Hint: Prompt 工程關注輸入端，與模型內部訓練算法無關。
[/quiz]

## Prompt 萬能公式

### 四要素框架

[callout type="warning" title="萬能公式四要素（必背）"]
1. 定義角色
2. 交代背景
3. 任務目標
4. 結構化要求

「提供示例」不是四要素之一。示例屬於 Few-Shot 進階技巧，做實操題時可以加，但考單選不算四要素。
[/callout]

[quiz type="single"]
Q: 課程中所講解的提示詞萬能公式的要素中，不包括以下哪一項？（Q47）
- [ ] A. 定義角色
- [ ] B. 交代背景
- [x] C. 提供示例
- [ ] D. 任務目標
Hint: 萬能公式四要素 = 角色 + 背景 + 目標 + 結構。提供示例是 Few-Shot 進階技巧，不在基礎四要素中。
[/quiz]

[quiz type="single"]
Q: 在文案生成過程中，提示詞設計不包括以下哪個要素？（Q38）
- [ ] A. 明確提問目標
- [ ] B. 提供背景信息
- [x] C. 使用複雜的術語
- [ ] D. 設定格式和風格
Hint: 高質量 Prompt 不等於複雜術語，應該使用簡明扼要的語言。
[/quiz]

### 萬能公式實戰範例

以下為實操題 Q3（618 業績通報）套用四要素框架的示範：

```prompt [label="實操範例：618 業績通報"]
[角色定義] 你是人力資源部主管，負責公司內部文案書寫

[背景交代] 2026 年 618，銷售額同比增長 35%，創歷史紀錄

[任務目標] 撰寫面向全體員工的內部簡報

[結構化要求]
  - 包含：彙報成果 / 肯定工作 / 榜樣力量 / 激勵人心
  - 字數：300-500 字
  - 風格：言簡意賅，帶激動情緒色彩
  - 落款：公司
```

## AIDA 與 PAS 文案模型

### AIDA 模型

AIDA 順序：Attention（注意）-> Interest（興趣）-> Desire（欲望）-> Action（行動）。第一步是 Attention。

### PAS 模型

PAS 順序：Problem（問題）-> Agitate（激發）-> Solution（解決方案）。第二步是 Agitate。

[callout type="tip" title="AIDA 與 PAS 對照記法"]
- AIDA 第一個 A = Attention（注意）
- PAS 第二個 A = Agitate（激發）
- Prove 和 Attention（在 PAS 題中出現時）都是干擾項：Prove 不屬於 PAS，Attention 屬於 AIDA
[/callout]

[quiz type="single"]
Q: AIDA 模型中的第一個步驟是？（Q6）
- [ ] A. Interest（興趣）
- [ ] B. Desire（欲望）
- [ ] C. Action（行動）
- [x] D. Attention（注意）
Hint: AIDA = Attention -> Interest -> Desire -> Action。第一個 A 是 Attention。
[/quiz]

[quiz type="single"]
Q: PAS 模型中的第二步是？（Q41）
- [ ] A. Problem（問題）
- [ ] B. Solution（解決方案）
- [ ] C. Prove（證明）
- [x] D. Agitate（激發）
Hint: PAS = Problem -> Agitate -> Solution。第二步是 Agitate（激發），不是 Prove。
[/quiz]

[quiz type="multi"]
Q: PAS 模型的結構包括哪些部分？（M4）
- [x] A. Problem（問題）
- [x] B. Agitate（激發）
- [x] C. Solution（解決方案）
- [ ] D. Prove（證明）
- [ ] E. Attention（注意）
Hint: PAS = Problem + Agitate + Solution。Prove 是虛構干擾，Attention 屬於 AIDA。
[/quiz]

## 文案生成與質量評估

### 人類與 AI 的分工

[quiz type="single"]
Q: 在文案生成的過程中，人類的主要職責是什麼？（Q9）
- [ ] A. 生成初稿
- [ ] B. 內容擴展
- [x] C. 方向設定和資料收集
- [ ] D. 增加創意性
Hint: 人類管方向 + 資料 + 把關 + 細節；AI 管執行 + 產出初稿。
[/quiz]

### 大模型寫作的革新

[quiz type="single"]
Q: 大模型在文案寫作中的哪個方面帶來了顯著提升？（Q45）
- [ ] A. 視頻生成
- [x] B. 寫作效率
- [ ] C. 圖片生成
- [ ] D. 語音識別
Hint: 大模型在文案寫作的顯著提升點 = 寫作效率。視頻、圖片、語音都不是文案範疇。
[/quiz]

### 文案質量評估標準

[quiz type="single"]
Q: 在評估生成的文案質量時，哪一個因素不需要重點考慮？（Q56）
- [ ] A. 準確性
- [ ] B. 連貫性
- [ ] C. 創意性
- [x] D. 生成速度
Hint: 質量評估三維 = 準確 + 連貫 + 創意。生成速度不是質量指標。
[/quiz]

[quiz type="single"]
Q: 在確保文案質量時，應該採用什麼方法？（Q36）
- [ ] A. 單次生成並直接使用
- [ ] B. 使用 A/B 測試
- [ ] C. 結合多樣化風格
- [x] D. 迭代優化
Hint: 質量保證 = 迭代優化。不能無條件信任初稿，必須多輪修改。
[/quiz]

[quiz type="single"]
Q: 利用大模型進行文案寫作的有效實用方法不包括？（Q44）
- [ ] A. 明確目標和受眾
- [ ] B. 提供清晰的指令
- [ ] C. 多輪生成
- [x] D. 完全信任初稿
Hint: 寫作必須迭代，不能無條件信任初稿。
[/quiz]

## 提示詞工程應用領域

[quiz type="single"]
Q: 在提示詞工程中，為了引導語言模型生成與特定行業相關的文本，以下哪種策略最有效？（Q10）
- [x] A. 使用行業通用的術語和概念
- [ ] B. 增加模型的訓練數據量
- [ ] C. 提高模型的計算複雜度
- [ ] D. 減少模型的訓練輪次
Hint: Prompt 引導行業內容，用行業術語直接定錨最有效。
[/quiz]

[quiz type="single"]
Q: 在機器翻譯領域，提示詞工程如何改進翻譯質量？（Q16）
- [ ] A. 通過增加翻譯模型的複雜度
- [ ] B. 通過減少源語言和目標語言的差異
- [x] C. 通過提供適當的上下文提示詞
- [ ] D. 通過提高翻譯模型的訓練效率
Hint: Prompt 工程核心 = 提供上下文，而非改變模型本身。
[/quiz]

## Round 3 多選題精選

[quiz type="multi"]
Q: 設計高質量提示詞時應注意哪些要素？（M23）
- [x] A. 提供明確的任務目標
- [x] B. 使用簡明扼要的語言
- [x] C. 提供足夠的背景信息
- [x] D. 指定輸出格式和風格
- [ ] E. 包含複雜的技術術語
Hint: 高質量 Prompt 四要素全選（ABCD），E「複雜術語」是反向設計陷阱。
[/quiz]

[quiz type="multi"]
Q: 人類在文案生成過程中需要負責哪些任務？（M22）
- [x] A. 方向設定和資料收集
- [ ] B. 生成初稿
- [x] C. 質量把關
- [x] D. 細節調整
- [ ] E. 內容擴展
Hint: 人類負責方向 + 把關 + 細節（ACD）。生成初稿和內容擴展是 AI 可代勞的。
[/quiz]

[quiz type="multi"]
Q: 文案生成的優化方法包括哪些？（M31）
- [x] A. 反饋調整
- [x] B. 多次生成
- [ ] C. 使用單一提示詞
- [x] D. 人工編輯
- [x] E. 持續學習
Hint: ABDE 都是優化方法。C「使用單一提示詞」不是優化方法。
[/quiz]

## Round 3 自查要點

[summary]
- **Prompt 萬能公式** | 角色 + 背景 + 目標 + 結構（四要素）。提供示例不是四要素之一
- **高質量 Prompt** | 提供具體背景信息。複雜術語、抽象描述都是反效果
- **AIDA 模型** | Attention -> Interest -> Desire -> Action（第一步是 Attention）
- **PAS 模型** | Problem -> Agitate -> Solution（第二步是 Agitate）
- **文案質量評估** | 準確性 + 連貫性 + 創意性（生成速度不是質量指標）
- **人類職責** | 方向設定 + 資料收集 + 質量把關 + 細節調整（生成初稿是 AI 的事）
[/summary]

---

# Round 4：倫理與綜合應用
> 第四輪聚焦生成式 AI 的倫理問題、社會影響與隱私保護。僅 5 題（單選 3 題 + 多選 2 題），建議 8 分鐘完成（含回補前三輪錯題時間）。

## 生成式 AI 的倫理問題

### 識別危害與正面影響

[callout type="info" title="解題技巧：排除法"]
遇到「危害不包括」「不屬於倫理問題」類題目，找選項中唯一一個「好事」排除掉即可。正面影響（提高效率、降低成本、增加就業）不是危害。
[/callout]

[quiz type="single"]
Q: 生成式人工智能帶來的倫理問題可能有哪些？（Q13）
- [x] A. 使用者傳播虛假或不實數據
- [ ] B. 提高工作效率
- [ ] C. 降低生產成本
- [ ] D. 增加信息透明度
Hint: B/C/D 都是正面影響，不是倫理問題。只有 A 是負面行為。
[/quiz]

[quiz type="single"]
Q: 生成式人工智能可能帶來的危害不包括以下哪一項？（Q48）
- [ ] A. 影響信息可信度
- [x] B. 增加就業機會
- [ ] C. 引發個人隱私擔憂
- [ ] D. 帶來倫理問題
Hint: 「增加就業機會」是正面影響，不是危害。看到危害題中的正面選項 = 排除。
[/quiz]

## 隱私保護措施

[quiz type="single"]
Q: 為了應對生成式人工智能帶來的個人隱私保護擔憂，需要採取什麼措施？（Q15）
- [ ] A. 加強數據加密
- [x] B. 制定法規和機制
- [ ] C. 減少人工智能應用
- [ ] D. 忽視服務條款中的隱私風險
Hint: 加密是治標，法規機制才是治本。減少應用是過激措施，忽視風險完全錯誤。
[/quiz]

## Round 4 多選題

[quiz type="multi"]
Q: 生成式人工智能可能帶來哪些危害？（M16）
- [x] A. 影響信息可信度
- [x] B. 引發個人隱私擔憂
- [x] C. 帶來倫理問題
- [ ] D. 縮小貧富差距
Hint: ABC 是危害。D「縮小貧富差距」是干擾項（即使字面上像好事，也不是已確認的影響）。
[/quiz]

[quiz type="multi"]
Q: 應對生成式人工智能個人隱私保護擔憂的措施有哪些？（M35）
- [x] A. 加強數據加密
- [x] B. 制定法規和機制
- [x] C. 提高公眾意識
- [ ] D. 限制人工智能應用
Hint: ABC 三管齊下。D「限制 AI 應用」不是推薦措施，是過激做法。
[/quiz]

## Round 4 自查要點

[summary]
- **倫理問題** | 使用者傳播虛假數據是核心倫理問題。提高效率、降低成本是正面影響
- **危害識別** | 影響信息可信度 + 隱私擔憂 + 倫理問題。「增加就業」「縮小貧富」是干擾
- **隱私保護** | 加密 + 法規 + 提高公眾意識三管齊下。「限制 AI 應用」不是正確方向
[/summary]

---

# 總結：刷題回顧與考前策略
> 整合四輪刷題的核心知識點，濃縮為考前必記清單與應試策略，為第二小時的算法精講與實操做準備。

## 考前必記 10 點

[flow]
1. AIGC = 人工智能「生成」內容（D，不是輔助）
2. Transformer 原生輸出 = 文本（不是圖像、視頻、音頻）
3. VideoGPT = VQ-VAE + Transformer（非 BiLSTM / GAN / 全連接）
4. DALL-E = 2021 年 + OpenAI；三組件 DTC = dVAE + Transformer + CLIP
5. 反向擴散 = 從噪聲恢復原始數據（前向才是加噪）
6. DDPM = 高質量；SGMs = 評分函數；SDEs = 最優貝葉斯去噪
7. Prompt 萬能公式 = 角色 + 背景 + 目標 + 結構（無「示例」）
8. AIDA 第一步 = Attention；PAS 第二步 = Agitate（激發）
9. 數據安全三端：輸入（投毒）/ 傳輸（攔截/篡改）/ 輸出（指令注入）
10. 數據安全三法：網絡安全法 + 個人信息保護法 + 數據安全法
[/flow]

## 最易混淆清單

[compare label-left="正確答案" label-right="常見誤選"]
- Transformer 輸出 = 文本 | 圖像 / 視頻 / 音頻
- VideoGPT 注意力 = 軸向注意力 | 全連接
- DALL-E 年份 = 2021 年 | 2020 / 2022
- DALL-E 組件 = dVAE + Transformer + CLIP | GAN
- 反向擴散 = 噪聲到原始數據 | 數據到噪聲（那是前向）
- SDEs = 最優貝葉斯去噪 | DDPM / SGMs
- Prompt 萬能公式 = 角色+背景+目標+結構 | 含「提供示例」
- AIDA 第一步 = Attention | Interest / Desire
- PAS 第二步 = Agitate | Solution / Prove
- 數據安全三法 = 網絡+個人信息+數據安全 | 市場準入 / 反壟斷 / 勞動法
[/compare]

## 多選題三大陷阱

### 混淆類陷阱

選項中混入其他模型的組件或概念。例如：DALL-E 三組件題中放入 GAN；PAS 結構題中放入 Attention（屬於 AIDA）。

### 定義類陷阱

選項看似正確但定義不精確。例如：單模態 AIGC 題中放入「文生圖」（實際是跨模態）。

### 反向類陷阱

把模型的缺點包裝成優點。例如：擴散模型優點題中放入「訓練快速」「資源少」——這些恰好是缺點。

[callout type="warning" title="多選題作答策略"]
1. 先排除明顯錯誤選項
2. 警惕「絕對化」詞語（如「沒有限制」「完全不需要」）
3. 反向類陷阱：問「優點」時檢查選項是否實際是缺點
4. 混淆類陷阱：檢查選項是否屬於其他模型而非題目所問模型
[/callout]

## 課後實戰任務

### 今晚必做

- [x] 登入官網考試系統，完成全部理論題一次
- [x] 完成全部實操題一次（Prompt 設計類）
- [x] 把做錯的題目記下來（截圖或抄題號）

### 三天內必做

- [x] 使用互動刷題工具「錯題回看」重做課堂錯題
- [x] 對照答案解析查看官方解析
- [x] 整理 3 個最不確定的題目帶到第二小時課堂發問

## 第二小時預覽

[tags]
- [blue] 算法精講：生成式模型核心架構全景圖
- [green] 多選題易錯點逐一擊破
- [orange] 實操訓練：Prompt 萬能公式實戰 + 文生圖 + 對話系統
- [purple] 考前必記 10 點速覽 + 三色投票
[/tags]

[bonus title="延伸閱讀：實操題 Prompt 範例"]
**實操 Q1 獨角獸文生圖：**
童話動畫風格，一隻可愛的白色獨角獸，擁有彩虹色鬃毛和尾巴，額頭上有閃耀的金色獨角，在七彩祥雲中飛翔，夢幻天空背景，全身照，正面視角，高質量，細節豐富，溫馨氛圍。

**實操 Q4 兔子警長：**
童話動畫風格，一隻穿著藍色警服戴著警帽的可愛兔子，表情嚴肅專業，全身照，站立姿勢，背景為城市街道，高質量，細節豐富，適合兒童。

**結構化圖像 Prompt 六要素模板：**
風格 + 主體描述 + 動作/狀態 + 場景/背景 + 構圖/鏡頭 + 質量關鍵詞
[/bonus]

[callout type="tip" title="考前提醒"]
課堂上的 100 題刷題只是熱身，真正計分的考試在官網。趁手感最熱，今晚就上官網把全部理論題和實操題各做一次。課堂版幫你建立答題感覺，官網版才是你考前要熟悉的真實環境。
[/callout]
