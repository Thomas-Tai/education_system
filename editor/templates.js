// templates.js — Slide template library for PPT Editor
// Each template is a complete <section> element using Professor Slide Design CSS classes.

const SLIDE_TEMPLATES = [
  {
    id: 'cover',
    name: '封面',
    desc: '課程封面投影片',
    preview: 'cover',
    html: `<section data-label="Cover" class="slide title-slide" style="justify-content:flex-end;">
  <div class="slide-header" style="position:absolute;top:clamp(24px,4vw,80px);left:clamp(32px,6vw,120px);right:clamp(32px,6vw,120px);">
    <span class="eyebrow">COURSE</span>
    <span class="caption">2026</span>
  </div>
  <div style="margin-bottom:clamp(40px,6vw,120px);">
    <h1 class="assertion" style="font-size:clamp(40px,6vw,100px);max-width:95%;">
      輸入<span class="focal">課程標題</span>
    </h1>
    <p class="lead" style="margin-top:clamp(12px,1.5vw,32px);">副標題說明文字</p>
    <div style="display:flex;gap:8px;margin-top:clamp(16px,2vw,40px);">
      <span class="pill accent">標籤一</span>
      <span class="pill slate">標籤二</span>
    </div>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:flex-end;">
    <div>
      <div class="caption" style="margin-bottom:4px;">講師</div>
      <div style="font-size:clamp(14px,1.4vw,24px);color:var(--ink);">講師名稱</div>
    </div>
    <span class="caption">機構名稱</span>
  </div>
  <div class="slide-meta"><span></span><span class="num"></span></div>
</section>`
  },
  {
    id: 'darkDivider',
    name: '段落分隔',
    desc: '深色段落分隔頁',
    preview: 'dark',
    html: `<section data-label="Part 1 Title" class="slide dark" style="justify-content:center;">
  <span class="section-tag" style="margin-bottom:clamp(24px,3vw,56px);">PART 01</span>
  <h1 style="font-size:clamp(36px,5vw,96px);line-height:1.08;max-width:90%;letter-spacing:-0.02em;color:#F8F4EA;">
    段落標題 <span style="color:var(--accent);">強調文字</span>
  </h1>
  <p style="font-size:clamp(14px,1.5vw,28px);max-width:70%;margin-top:clamp(12px,1.5vw,32px);color:rgba(248,244,234,0.65);line-height:1.5;">
    段落描述文字
  </p>
  <div class="slide-meta"><span></span><span class="num"></span></div>
</section>`
  },
  {
    id: 'content',
    name: '內容頁',
    desc: '標準內容投影片',
    preview: 'content',
    html: `<section data-label="Content" class="slide">
  <div class="slide-header">
    <span class="eyebrow">SECTION</span>
    <span class="caption">01</span>
  </div>
  <h2 class="assertion">輸入主要<span class="focal">論述</span></h2>
  <p class="lead" style="margin-top:clamp(8px,1vw,20px);">支援說明文字，補充論述內容</p>
  <div class="stack" style="margin-top:clamp(20px,3vw,48px);gap:clamp(10px,1.2vw,20px);">
    <p style="font-size:clamp(13px,1.3vw,22px);line-height:1.6;color:var(--ink-muted);">
      正文內容區域。在此放置詳細說明、要點列表或其他元件。
    </p>
  </div>
  <div class="slide-meta"><span></span><span class="num"></span></div>
</section>`
  },
  {
    id: 'threeCards',
    name: '三卡片',
    desc: '三欄卡片佈局',
    preview: 'grid3',
    html: `<section data-label="Three Cards" class="slide">
  <div class="slide-header">
    <span class="eyebrow">SECTION</span>
    <span class="caption">01</span>
  </div>
  <h2 class="assertion">三個<span class="focal">重點</span></h2>
  <div class="grid-3" style="margin-top:clamp(20px,3vw,48px);">
    <div class="card">
      <h3 style="font-size:clamp(14px,1.4vw,24px);margin-bottom:8px;">卡片一</h3>
      <p style="font-size:clamp(11px,1.1vw,18px);color:var(--ink-muted);line-height:1.5;">說明文字</p>
    </div>
    <div class="card tinted">
      <h3 style="font-size:clamp(14px,1.4vw,24px);margin-bottom:8px;">卡片二</h3>
      <p style="font-size:clamp(11px,1.1vw,18px);color:var(--ink-muted);line-height:1.5;">說明文字</p>
    </div>
    <div class="card">
      <h3 style="font-size:clamp(14px,1.4vw,24px);margin-bottom:8px;">卡片三</h3>
      <p style="font-size:clamp(11px,1.1vw,18px);color:var(--ink-muted);line-height:1.5;">說明文字</p>
    </div>
  </div>
  <div class="slide-meta"><span></span><span class="num"></span></div>
</section>`
  },
  {
    id: 'fourCards',
    name: '四卡片',
    desc: '四欄卡片佈局',
    preview: 'grid4',
    html: `<section data-label="Four Cards" class="slide">
  <div class="slide-header">
    <span class="eyebrow">SECTION</span>
    <span class="caption">01</span>
  </div>
  <h2 class="assertion">四個<span class="focal">要素</span></h2>
  <div class="grid-4" style="margin-top:clamp(20px,3vw,48px);">
    <div class="card"><h3 style="font-size:clamp(13px,1.3vw,22px);margin-bottom:6px;">要素一</h3><p style="font-size:clamp(10px,1vw,16px);color:var(--ink-muted);">說明</p></div>
    <div class="card"><h3 style="font-size:clamp(13px,1.3vw,22px);margin-bottom:6px;">要素二</h3><p style="font-size:clamp(10px,1vw,16px);color:var(--ink-muted);">說明</p></div>
    <div class="card"><h3 style="font-size:clamp(13px,1.3vw,22px);margin-bottom:6px;">要素三</h3><p style="font-size:clamp(10px,1vw,16px);color:var(--ink-muted);">說明</p></div>
    <div class="card"><h3 style="font-size:clamp(13px,1.3vw,22px);margin-bottom:6px;">要素四</h3><p style="font-size:clamp(10px,1vw,16px);color:var(--ink-muted);">說明</p></div>
  </div>
  <div class="slide-meta"><span></span><span class="num"></span></div>
</section>`
  },
  {
    id: 'compare',
    name: '左右對比',
    desc: '雙欄對比佈局',
    preview: 'compare',
    html: `<section data-label="Compare" class="slide">
  <div class="slide-header">
    <span class="eyebrow">COMPARISON</span>
    <span class="caption">01</span>
  </div>
  <h2 class="assertion">A vs B <span class="focal">對比</span></h2>
  <div class="grid-2" style="margin-top:clamp(20px,3vw,48px);gap:clamp(16px,2vw,40px);">
    <div class="card" style="position:relative;">
      <span class="pill bad" style="position:absolute;top:-10px;left:16px;font-size:11px;">方案 A</span>
      <h3 style="font-size:clamp(14px,1.4vw,24px);margin:12px 0 8px;">標題</h3>
      <ul style="font-size:clamp(11px,1.1vw,18px);color:var(--ink-muted);line-height:1.7;padding-left:20px;">
        <li>特點一</li><li>特點二</li><li>特點三</li>
      </ul>
    </div>
    <div class="card" style="position:relative;">
      <span class="pill ok" style="position:absolute;top:-10px;left:16px;font-size:11px;">方案 B</span>
      <h3 style="font-size:clamp(14px,1.4vw,24px);margin:12px 0 8px;">標題</h3>
      <ul style="font-size:clamp(11px,1.1vw,18px);color:var(--ink-muted);line-height:1.7;padding-left:20px;">
        <li>特點一</li><li>特點二</li><li>特點三</li>
      </ul>
    </div>
  </div>
  <div class="slide-meta"><span></span><span class="num"></span></div>
</section>`
  },
  {
    id: 'quiz',
    name: '測驗',
    desc: '互動測驗題',
    preview: 'quiz',
    html: `<section data-label="Quiz" class="slide">
  <div class="slide-header">
    <span class="eyebrow">QUIZ</span>
    <span class="caption">Q01</span>
  </div>
  <h2 class="assertion">輸入<span class="focal">題目</span>？</h2>
  <div class="quiz-box" data-quiz style="margin-top:clamp(20px,3vw,48px);">
    <div class="opt" data-quiz-option="a">A. 選項一</div>
    <div class="opt" data-quiz-option="b" data-correct>B. 選項二（正確）</div>
    <div class="opt" data-quiz-option="c">C. 選項三</div>
    <div class="opt" data-quiz-option="d">D. 選項四</div>
  </div>
  <div class="slide-meta"><span></span><span class="num"></span></div>
</section>`
  },
  {
    id: 'keypoint',
    name: '重點記憶',
    desc: '記憶點卡片',
    preview: 'keypoint',
    html: `<section data-label="Key Point" class="slide">
  <div class="slide-header">
    <span class="eyebrow">KEY POINT</span>
    <span class="caption">01</span>
  </div>
  <h2 class="assertion">核心<span class="focal">記憶點</span></h2>
  <div class="keypoint" data-label="記憶點" style="margin-top:clamp(20px,3vw,48px);padding:clamp(16px,2vw,36px);border:2px solid var(--accent);border-radius:12px;">
    <p style="font-size:clamp(16px,1.8vw,32px);font-weight:500;line-height:1.5;">
      輸入需要學生記住的核心內容
    </p>
  </div>
  <p class="lead" style="margin-top:clamp(12px,1.5vw,24px);">補充說明</p>
  <div class="slide-meta"><span></span><span class="num"></span></div>
</section>`
  },
  {
    id: 'flow',
    name: '流程圖',
    desc: '步驟流程',
    preview: 'flow',
    html: `<section data-label="Flow" class="slide">
  <div class="slide-header">
    <span class="eyebrow">PROCESS</span>
    <span class="caption">01</span>
  </div>
  <h2 class="assertion">操作<span class="focal">流程</span></h2>
  <div style="display:flex;align-items:center;gap:clamp(8px,1vw,16px);margin-top:clamp(24px,3vw,56px);">
    <div class="card" style="flex:1;text-align:center;padding:clamp(12px,1.5vw,28px);">
      <div class="num-label" style="color:var(--accent);margin-bottom:6px;">STEP 1</div>
      <p style="font-size:clamp(12px,1.2vw,20px);">步驟一</p>
    </div>
    <div style="font-size:24px;color:var(--slate);">&#8594;</div>
    <div class="card" style="flex:1;text-align:center;padding:clamp(12px,1.5vw,28px);">
      <div class="num-label" style="color:var(--accent);margin-bottom:6px;">STEP 2</div>
      <p style="font-size:clamp(12px,1.2vw,20px);">步驟二</p>
    </div>
    <div style="font-size:24px;color:var(--slate);">&#8594;</div>
    <div class="card" style="flex:1;text-align:center;padding:clamp(12px,1.5vw,28px);">
      <div class="num-label" style="color:var(--accent);margin-bottom:6px;">STEP 3</div>
      <p style="font-size:clamp(12px,1.2vw,20px);">步驟三</p>
    </div>
  </div>
  <div class="slide-meta"><span></span><span class="num"></span></div>
</section>`
  },
  {
    id: 'agenda',
    name: '目錄',
    desc: '課程目錄頁',
    preview: 'agenda',
    html: `<section data-label="Agenda" class="slide">
  <div class="slide-header">
    <span class="eyebrow">AGENDA</span>
    <span class="caption"></span>
  </div>
  <h2 class="assertion">課程<span class="focal">大綱</span></h2>
  <div style="margin-top:clamp(20px,3vw,48px);display:flex;flex-direction:column;gap:clamp(10px,1.2vw,20px);">
    <div style="display:flex;align-items:baseline;gap:clamp(12px,1.5vw,24px);">
      <span class="num-label" style="color:var(--accent);min-width:clamp(24px,3vw,48px);">01</span>
      <span style="font-size:clamp(14px,1.5vw,26px);font-weight:500;">第一部分</span>
      <span class="caption">— 描述</span>
    </div>
    <div style="display:flex;align-items:baseline;gap:clamp(12px,1.5vw,24px);">
      <span class="num-label" style="color:var(--accent);min-width:clamp(24px,3vw,48px);">02</span>
      <span style="font-size:clamp(14px,1.5vw,26px);font-weight:500;">第二部分</span>
      <span class="caption">— 描述</span>
    </div>
    <div style="display:flex;align-items:baseline;gap:clamp(12px,1.5vw,24px);">
      <span class="num-label" style="color:var(--accent);min-width:clamp(24px,3vw,48px);">03</span>
      <span style="font-size:clamp(14px,1.5vw,26px);font-weight:500;">第三部分</span>
      <span class="caption">— 描述</span>
    </div>
  </div>
  <div class="slide-meta"><span></span><span class="num"></span></div>
</section>`
  },
  {
    id: 'summary',
    name: '總結',
    desc: '課堂總結頁',
    preview: 'summary',
    html: `<section data-label="Summary" class="slide">
  <div class="slide-header">
    <span class="eyebrow">SUMMARY</span>
    <span class="caption"></span>
  </div>
  <h2 class="assertion">課堂<span class="focal">總結</span></h2>
  <div class="grid-2" style="margin-top:clamp(20px,3vw,48px);gap:clamp(16px,2vw,32px);">
    <div>
      <div class="keypoint" data-label="重點" style="padding:clamp(12px,1.5vw,28px);border:2px solid var(--slate);border-radius:10px;margin-bottom:clamp(10px,1.2vw,20px);">
        <p style="font-size:clamp(13px,1.3vw,22px);line-height:1.5;">重點一</p>
      </div>
      <div class="keypoint" data-label="重點" style="padding:clamp(12px,1.5vw,28px);border:2px solid var(--slate);border-radius:10px;">
        <p style="font-size:clamp(13px,1.3vw,22px);line-height:1.5;">重點二</p>
      </div>
    </div>
    <div>
      <div class="keypoint" data-label="重點" style="padding:clamp(12px,1.5vw,28px);border:2px solid var(--slate);border-radius:10px;margin-bottom:clamp(10px,1.2vw,20px);">
        <p style="font-size:clamp(13px,1.3vw,22px);line-height:1.5;">重點三</p>
      </div>
      <div class="keypoint" data-label="重點" style="padding:clamp(12px,1.5vw,28px);border:2px solid var(--slate);border-radius:10px;">
        <p style="font-size:clamp(13px,1.3vw,22px);line-height:1.5;">重點四</p>
      </div>
    </div>
  </div>
  <div class="slide-meta"><span></span><span class="num"></span></div>
</section>`
  },
  {
    id: 'closing',
    name: '結尾',
    desc: '感謝頁',
    preview: 'closing',
    html: `<section data-label="Thank You" class="slide dark" style="justify-content:center;align-items:center;text-align:center;">
  <h1 style="font-size:clamp(48px,7vw,120px);color:#F8F4EA;letter-spacing:-0.02em;line-height:1.1;">
    Thank You
  </h1>
  <p style="font-size:clamp(16px,1.8vw,32px);color:rgba(248,244,234,0.6);margin-top:clamp(12px,1.5vw,32px);">
    聯絡資訊 / QR Code / 社群連結
  </p>
  <div class="slide-meta"><span></span><span class="num"></span></div>
</section>`
  },
  {
    id: 'taskFrame',
    name: '任務',
    desc: '實作任務說明',
    preview: 'task',
    html: `<section data-label="Task" class="slide">
  <div class="slide-header">
    <span class="eyebrow">TASK</span>
    <span class="caption">01</span>
  </div>
  <h2 class="assertion">實作<span class="focal">任務</span></h2>
  <div class="task-frame" style="margin-top:clamp(16px,2vw,36px);padding:clamp(16px,2vw,32px);border-left:4px solid var(--slate);font-family:var(--mono);">
    <p style="font-size:clamp(12px,1.2vw,20px);line-height:1.7;">
      1. 第一步驟說明<br>
      2. 第二步驟說明<br>
      3. 第三步驟說明
    </p>
  </div>
  <div class="tip-box" style="margin-top:clamp(12px,1.5vw,24px);padding:clamp(10px,1.2vw,20px);border-left:3px solid var(--ok);background:rgba(47,107,74,0.06);border-radius:0 6px 6px 0;">
    <p style="font-size:clamp(11px,1.1vw,18px);color:var(--ok);">提示：補充說明</p>
  </div>
  <div class="slide-meta"><span></span><span class="num"></span></div>
</section>`
  },
  {
    id: 'blank',
    name: '空白',
    desc: '空白投影片',
    preview: 'blank',
    html: `<section data-label="Blank" class="slide">
  <div class="slide-header">
    <span class="eyebrow">SECTION</span>
    <span class="caption"></span>
  </div>
  <h2 class="assertion">標題</h2>
  <div class="slide-meta"><span></span><span class="num"></span></div>
</section>`
  }
];

function getTemplateHtml(id) {
  const t = SLIDE_TEMPLATES.find(t => t.id === id);
  return t ? t.html : '';
}
