// editor.js — Main PPT Editor application logic

(function() {
  'use strict';

  // ── State ──────────────────────────────────────────────────────
  const State = {
    fileName: 'Untitled.html',
    currentIndex: 0,
    slideCount: 0,
    undoStack: [],
    redoStack: [],
    dirty: false,
    previewMode: false,
    bridgeReady: false,
    tweaks: { accent: '#A4452F', font: 'Noto Sans HK', rail: true },
    fileHandle: null,
    dragIndex: -1,
  };

  const MAX_UNDO = 50;
  const iframe = document.getElementById('deckFrame');
  const thumbList = document.getElementById('thumbList');

  // ── Deck HTML template ────────────────────────────────────────
  function buildDeckHTML(slidesHTML) {
    const slides = slidesHTML || `<section data-label="Cover" class="slide title-slide" style="justify-content:flex-end;">
  <div class="slide-header" style="position:absolute;top:clamp(24px,4vw,80px);left:clamp(32px,6vw,120px);right:clamp(32px,6vw,120px);">
    <span class="eyebrow">COURSE</span>
    <span class="caption">2026</span>
  </div>
  <div style="margin-bottom:clamp(40px,6vw,120px);">
    <h1 class="assertion" style="font-size:clamp(40px,6vw,100px);max-width:95%;">
      輸入<span class="focal">課程標題</span>
    </h1>
    <p class="lead" style="margin-top:clamp(12px,1.5vw,32px);">副標題說明文字</p>
  </div>
  <div class="slide-meta"><span></span><span class="num"></span></div>
</section>`;

    return `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&family=Lexend:wght@300;400;500;600;700&family=Noto+Sans+HK:wght@400;500;700;900&family=Noto+Sans+TC:wght@400;500;700;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="deck-styles.css">
</head>
<body>
<deck-stage width="1920" height="1080" noscale>
${slides}
</deck-stage>
<script src="deck-stage.js"><\/script>
<script src="deck-script.js"><\/script>
</body>
</html>`;
  }

  // ── iframe management ──────────────────────────────────────────
  function loadDeck(slidesHTML) {
    const bridgeCode = `<script src="editor-bridge.js"><\/script>`;
    let html = buildDeckHTML(slidesHTML);
    html = html.replace('</body>', bridgeCode + '\n</body>');
    iframe.srcdoc = html;
    State.bridgeReady = false;
    scaleIframe();
  }

  function scaleIframe() {
    const area = document.getElementById('previewArea');
    const availW = area.clientWidth - 40;
    const availH = area.clientHeight - 40;
    const scale = Math.min(availW / 1920, availH / 1080, 1);
    iframe.style.transform = `scale(${scale})`;
    iframe.style.transformOrigin = 'center center';
  }

  window.addEventListener('resize', scaleIframe);

  // ── Message handling ───────────────────────────────────────────
  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'editor:ready':
        State.bridgeReady = true;
        State.slideCount = msg.slideCount;
        setStatus('就緒');
        refreshThumbnails();
        updateSlideCount();
        ImagePanel.updatePromptFromSlide(State.currentIndex);
        break;

      case 'editor:slideChanged':
        State.currentIndex = msg.index;
        State.slideCount = msg.total;
        highlightThumb(msg.index);
        updateSlideCount();
        updatePropertyPanel(msg.index);
        ImagePanel.updatePromptFromSlide(msg.index);
        document.getElementById('statusSlide').textContent = `${msg.index + 1} / ${msg.total}`;
        break;

      case 'editor:contentChanged':
        pushUndo();
        refreshThumbnail(msg.slideIndex);
        State.dirty = true;
        updateDirtyState();
        break;

      case 'editor:deckMutated':
        pushUndo();
        refreshThumbnails();
        State.dirty = true;
        updateDirtyState();
        break;

      case 'editor:elementClicked':
        navigateToSlide(msg.slideIndex);
        break;

      case 'editor:htmlResponse':
        handleSaveResponse(msg.html);
        break;
    }
  });

  // ── Thumbnail rendering ────────────────────────────────────────
  function refreshThumbnails() {
    if (!iframe.contentDocument) return;
    const deck = iframe.contentDocument.querySelector('deck-stage');
    if (!deck) return;
    const slides = Array.from(deck.children).filter(el => el.tagName === 'SECTION');
    State.slideCount = slides.length;
    thumbList.innerHTML = '';

    slides.forEach((slide, i) => {
      const item = document.createElement('div');
      item.className = 'thumb-item' + (i === State.currentIndex ? ' active' : '');
      if (slide.hasAttribute('data-deck-skip')) item.classList.add('skipped');
      item.dataset.index = i;
      item.draggable = true;

      const num = document.createElement('span');
      num.className = 'thumb-num';
      num.textContent = String(i + 1).padStart(2, '0');

      const label = document.createElement('span');
      label.className = 'thumb-label';
      label.textContent = slide.dataset.label || `Slide ${i + 1}`;

      // Mini preview via foreignObject SVG
      const canvas = createMiniPreview(slide, i);

      item.appendChild(canvas);
      item.appendChild(num);
      item.appendChild(label);

      item.addEventListener('click', () => navigateToSlide(i));
      item.addEventListener('contextmenu', (e) => showContextMenu(e, i));
      item.addEventListener('dragstart', (e) => onDragStart(e, i));
      item.addEventListener('dragover', onDragOver);
      item.addEventListener('drop', (e) => onDrop(e, i));
      item.addEventListener('dragend', onDragEnd);

      thumbList.appendChild(item);
    });

    updateSlideCount();
  }

  function createMiniPreview(slide, index) {
    const canvas = document.createElement('div');
    canvas.className = 'thumb-canvas';
    const isDark = slide.classList.contains('dark');
    canvas.style.background = isDark ? 'var(--slate-dark)' : 'var(--cream)';
    canvas.style.display = 'flex';
    canvas.style.flexDirection = 'column';
    canvas.style.justifyContent = 'center';
    canvas.style.padding = '6px 8px';
    canvas.style.overflow = 'hidden';

    const titleEl = slide.querySelector('.assertion, h1, h2');
    if (titleEl) {
      const title = document.createElement('div');
      title.style.cssText = `font-size:7px;font-weight:700;color:${isDark ? '#F8F4EA' : 'var(--ink)'};line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`;
      title.textContent = titleEl.textContent.trim().slice(0, 40);
      canvas.appendChild(title);
    }

    const subEl = slide.querySelector('.lead, .eyebrow');
    if (subEl) {
      const sub = document.createElement('div');
      sub.style.cssText = `font-size:5px;color:${isDark ? 'rgba(248,244,234,0.5)' : 'var(--ink-muted)'};margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`;
      sub.textContent = subEl.textContent.trim().slice(0, 60);
      canvas.appendChild(sub);
    }

    return canvas;
  }

  function refreshThumbnail(index) {
    const items = thumbList.querySelectorAll('.thumb-item');
    if (!items[index] || !iframe.contentDocument) return;
    const deck = iframe.contentDocument.querySelector('deck-stage');
    if (!deck) return;
    const slides = Array.from(deck.children).filter(el => el.tagName === 'SECTION');
    if (!slides[index]) return;

    const item = items[index];
    const oldCanvas = item.querySelector('.thumb-canvas');
    if (oldCanvas) oldCanvas.replaceWith(createMiniPreview(slides[index], index));
    const label = item.querySelector('.thumb-label');
    if (label) label.textContent = slides[index].dataset.label || `Slide ${index + 1}`;
  }

  function highlightThumb(index) {
    thumbList.querySelectorAll('.thumb-item').forEach((item, i) => {
      item.classList.toggle('active', i === index);
    });
    const activeItem = thumbList.querySelector(`.thumb-item[data-index="${index}"]`);
    if (activeItem) activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ── Navigation ─────────────────────────────────────────────────
  function navigateToSlide(index) {
    if (!State.bridgeReady) return;
    iframe.contentWindow.postMessage({ type: 'editor:goTo', index }, '*');
    State.currentIndex = index;
    highlightThumb(index);
    updatePropertyPanel(index);
    ImagePanel.updatePromptFromSlide(index);
  }

  // ── Slide operations ───────────────────────────────────────────
  function addSlide(templateId) {
    const html = getTemplateHtml(templateId);
    if (!html) return;
    pushUndo();
    iframe.contentWindow.postMessage({
      type: 'editor:insertSlide',
      index: State.slideCount,
      html
    }, '*');
    setTimeout(() => {
      refreshThumbnails();
      navigateToSlide(State.slideCount - 1);
    }, 200);
  }

  function deleteSlide(index) {
    if (State.slideCount <= 1) return;
    pushUndo();
    iframe.contentWindow.postMessage({ type: 'editor:deleteSlide', index }, '*');
    setTimeout(() => {
      refreshThumbnails();
      if (State.currentIndex >= State.slideCount - 1) {
        navigateToSlide(Math.max(0, State.slideCount - 2));
      }
    }, 200);
  }

  function duplicateSlide(index) {
    pushUndo();
    iframe.contentWindow.postMessage({ type: 'editor:duplicateSlide', index }, '*');
    setTimeout(() => {
      refreshThumbnails();
      navigateToSlide(index + 1);
    }, 200);
  }

  function moveSlide(from, to) {
    if (from === to) return;
    pushUndo();
    iframe.contentWindow.postMessage({ type: 'editor:moveSlide', from, to }, '*');
    setTimeout(() => {
      refreshThumbnails();
      navigateToSlide(to);
    }, 200);
  }

  // ── Drag & Drop (thumbnails) ──────────────────────────────────
  function onDragStart(e, index) {
    State.dragIndex = index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index);
    e.target.style.opacity = '0.5';
  }

  function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drag-over');
  }

  function onDrop(e, toIndex) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const fromIndex = State.dragIndex;
    if (fromIndex >= 0 && fromIndex !== toIndex) {
      moveSlide(fromIndex, toIndex);
    }
  }

  function onDragEnd(e) {
    e.target.style.opacity = '1';
    thumbList.querySelectorAll('.thumb-item').forEach(el => el.classList.remove('drag-over'));
    State.dragIndex = -1;
  }

  // ── Context menu ───────────────────────────────────────────────
  const ctxMenu = document.getElementById('ctxMenu');
  let ctxTargetIndex = -1;

  function showContextMenu(e, index) {
    e.preventDefault();
    ctxTargetIndex = index;
    ctxMenu.style.left = e.clientX + 'px';
    ctxMenu.style.top = e.clientY + 'px';
    ctxMenu.classList.add('active');
  }

  document.addEventListener('click', () => ctxMenu.classList.remove('active'));

  ctxMenu.querySelectorAll('.ctx-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const i = ctxTargetIndex;
      switch (action) {
        case 'duplicate': duplicateSlide(i); break;
        case 'moveUp': if (i > 0) moveSlide(i, i - 1); break;
        case 'moveDown': if (i < State.slideCount - 1) moveSlide(i, i + 1); break;
        case 'skip': toggleSkip(i, true); break;
        case 'unskip': toggleSkip(i, false); break;
        case 'delete': deleteSlide(i); break;
      }
      ctxMenu.classList.remove('active');
    });
  });

  function toggleSkip(index, skip) {
    if (!iframe.contentDocument) return;
    const deck = iframe.contentDocument.querySelector('deck-stage');
    const slides = Array.from(deck.children).filter(el => el.tagName === 'SECTION');
    if (slides[index]) {
      if (skip) slides[index].setAttribute('data-deck-skip', '');
      else slides[index].removeAttribute('data-deck-skip');
      refreshThumbnails();
    }
  }

  // ── Template modal ─────────────────────────────────────────────
  const templateModal = document.getElementById('templateModal');
  const templateGrid = document.getElementById('templateGrid');

  function showTemplateModal() {
    templateGrid.innerHTML = '';
    SLIDE_TEMPLATES.forEach(tmpl => {
      const card = document.createElement('div');
      card.className = 'template-card';
      card.innerHTML = `
        <div class="tmpl-preview" style="background:${tmpl.preview === 'dark' || tmpl.preview === 'closing' ? 'var(--slate-dark)' : 'var(--cream)'};">
          <div style="font-size:10px;font-weight:600;color:${tmpl.preview === 'dark' || tmpl.preview === 'closing' ? '#F8F4EA' : 'var(--ink)'};">${tmpl.name}</div>
        </div>
        <div class="tmpl-name">${tmpl.name}</div>
        <div class="tmpl-desc">${tmpl.desc}</div>
      `;
      card.addEventListener('click', () => {
        addSlide(tmpl.id);
        templateModal.classList.remove('active');
      });
      templateGrid.appendChild(card);
    });
    templateModal.classList.add('active');
  }

  templateModal.addEventListener('click', (e) => {
    if (e.target === templateModal) templateModal.classList.remove('active');
  });

  // ── Property panel ─────────────────────────────────────────────
  function updatePropertyPanel(index) {
    if (!iframe.contentDocument) return;
    const deck = iframe.contentDocument.querySelector('deck-stage');
    const slides = Array.from(deck.children).filter(el => el.tagName === 'SECTION');
    const slide = slides[index];
    if (!slide) return;

    document.getElementById('propLabel').value = slide.dataset.label || '';
    document.getElementById('propDark').checked = slide.classList.contains('dark');
  }

  document.getElementById('propLabel').addEventListener('change', (e) => {
    iframe.contentWindow.postMessage({
      type: 'editor:setLabel', index: State.currentIndex, label: e.target.value
    }, '*');
    refreshThumbnail(State.currentIndex);
  });

  document.getElementById('propDark').addEventListener('change', (e) => {
    pushUndo();
    iframe.contentWindow.postMessage({
      type: 'editor:setDark', index: State.currentIndex, dark: e.target.checked
    }, '*');
    setTimeout(() => refreshThumbnail(State.currentIndex), 200);
  });

  document.getElementById('btnDuplicate').addEventListener('click', () => duplicateSlide(State.currentIndex));
  document.getElementById('btnDeleteSlide').addEventListener('click', () => deleteSlide(State.currentIndex));

  // ── Element insertion ──────────────────────────────────────────
  document.querySelectorAll('.element-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.element;
      const html = getElementHtml(type);
      if (!html) return;
      pushUndo();
      iframe.contentWindow.postMessage({
        type: 'editor:insertElement',
        slideIndex: State.currentIndex,
        html
      }, '*');
      setTimeout(() => refreshThumbnail(State.currentIndex), 200);
    });
  });

  function getElementHtml(type) {
    const elements = {
      card: '<div class="card" style="padding:clamp(12px,1.5vw,28px);border-radius:10px;margin-top:12px;"><h3 style="font-size:clamp(13px,1.3vw,22px);margin-bottom:6px;">卡片標題</h3><p style="font-size:clamp(11px,1.1vw,18px);color:var(--ink-muted);">卡片內容</p></div>',
      pill: '<span class="pill accent" style="margin:8px 4px;">標籤</span>',
      kpi: '<div style="text-align:center;margin:12px 0;"><div class="kpi" style="font-family:var(--ui-font);font-size:clamp(36px,5vw,96px);font-weight:600;color:var(--slate);">100</div><div class="caption">指標名稱</div></div>',
      grid2: '<div class="grid-2" style="margin-top:12px;gap:clamp(12px,1.5vw,24px);"><div class="card"><p style="font-size:clamp(12px,1.2vw,20px);">左欄</p></div><div class="card"><p style="font-size:clamp(12px,1.2vw,20px);">右欄</p></div></div>',
      grid3: '<div class="grid-3" style="margin-top:12px;"><div class="card"><p>一</p></div><div class="card"><p>二</p></div><div class="card"><p>三</p></div></div>',
      grid4: '<div class="grid-4" style="margin-top:12px;"><div class="card"><p>一</p></div><div class="card"><p>二</p></div><div class="card"><p>三</p></div><div class="card"><p>四</p></div></div>',
      quiz: '<div class="quiz-box" data-quiz style="margin-top:12px;"><div class="opt" data-quiz-option="a">A. 選項一</div><div class="opt" data-quiz-option="b" data-correct>B. 選項二（正確）</div><div class="opt" data-quiz-option="c">C. 選項三</div><div class="opt" data-quiz-option="d">D. 選項四</div></div>',
      keypoint: '<div class="keypoint" data-label="記憶點" style="margin-top:12px;padding:clamp(12px,1.5vw,28px);border:2px solid var(--accent);border-radius:10px;"><p style="font-size:clamp(14px,1.5vw,26px);font-weight:500;">核心記憶內容</p></div>',
      image: '<div style="margin-top:12px;text-align:center;"><div class="imgph" style="width:60%;aspect-ratio:16/9;margin:0 auto;background:var(--cream-soft);border:2px dashed var(--cream-line);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--ink-faint);">圖片佔位</div></div>',
      code: '<div class="code-block" style="margin-top:12px;background:var(--slate-dark);color:#F8F4EA;padding:clamp(12px,1.5vw,24px);border-radius:8px;font-family:var(--mono);font-size:clamp(11px,1.1vw,18px);line-height:1.6;">console.log("Hello");</div>',
      table: '<table class="data" style="margin-top:12px;width:100%;border-collapse:collapse;"><caption style="font-size:11px;color:var(--ink-faint);text-align:left;margin-bottom:8px;">表格標題</caption><thead><tr><th style="border-bottom:2px solid var(--slate);padding:8px 12px;text-align:left;font-size:clamp(11px,1.1vw,18px);">欄位一</th><th style="border-bottom:2px solid var(--slate);padding:8px 12px;text-align:left;font-size:clamp(11px,1.1vw,18px);">欄位二</th></tr></thead><tbody><tr><td style="border-bottom:1px solid var(--cream-line);padding:8px 12px;font-size:clamp(11px,1vw,16px);">資料一</td><td style="border-bottom:1px solid var(--cream-line);padding:8px 12px;font-size:clamp(11px,1vw,16px);">資料二</td></tr></tbody></table>',
      formula: '<div class="formula-box" style="margin-top:12px;background:var(--slate-dark);color:#F8F4EA;padding:clamp(16px,2vw,36px);border-radius:10px;text-align:center;font-size:clamp(16px,2vw,36px);font-weight:500;">A + B = C</div>',
    };
    return elements[type] || '';
  }

  // ── Undo/Redo ──────────────────────────────────────────────────
  function pushUndo() {
    if (!iframe.contentDocument) return;
    const deck = iframe.contentDocument.querySelector('deck-stage');
    if (!deck) return;
    State.undoStack.push(deck.innerHTML);
    if (State.undoStack.length > MAX_UNDO) State.undoStack.shift();
    State.redoStack = [];
    updateUndoRedoButtons();
  }

  function undo() {
    if (State.undoStack.length === 0) return;
    const deck = iframe.contentDocument.querySelector('deck-stage');
    if (!deck) return;
    State.redoStack.push(deck.innerHTML);
    deck.innerHTML = State.undoStack.pop();
    refreshThumbnails();
    updateUndoRedoButtons();
  }

  function redo() {
    if (State.redoStack.length === 0) return;
    const deck = iframe.contentDocument.querySelector('deck-stage');
    if (!deck) return;
    State.undoStack.push(deck.innerHTML);
    deck.innerHTML = State.redoStack.pop();
    refreshThumbnails();
    updateUndoRedoButtons();
  }

  function updateUndoRedoButtons() {
    document.getElementById('btnUndo').disabled = State.undoStack.length === 0;
    document.getElementById('btnRedo').disabled = State.redoStack.length === 0;
  }

  document.getElementById('btnUndo').addEventListener('click', undo);
  document.getElementById('btnRedo').addEventListener('click', redo);

  // ── Save/Load ──────────────────────────────────────────────────
  async function save() {
    if (!State.bridgeReady) return;
    iframe.contentWindow.postMessage({ type: 'editor:getHTML' }, '*');
  }

  async function handleSaveResponse(html) {
    try {
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: State.fileName,
          types: [{ description: 'HTML', accept: { 'text/html': ['.html'] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(html);
        await writable.close();
        State.fileHandle = handle;
        State.fileName = handle.name;
        document.getElementById('fileName').value = State.fileName;
        setStatus('已儲存');
      } else {
        downloadBlob(html, State.fileName);
        setStatus('已下載');
      }
      State.dirty = false;
      updateDirtyState();
    } catch (err) {
      if (err.name !== 'AbortError') setStatus('儲存失敗: ' + err.message, true);
    }
  }

  function downloadBlob(content, filename) {
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function load() {
    document.getElementById('fileInput').click();
  }

  document.getElementById('fileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const html = ev.target.result;
      const bridgeCode = '<script src="editor-bridge.js"><\/script>';
      const patched = html.replace('</body>', bridgeCode + '\n</body>');
      iframe.srcdoc = patched;
      State.bridgeReady = false;
      State.fileName = file.name;
      document.getElementById('fileName').value = State.fileName;
      State.undoStack = [];
      State.redoStack = [];
      updateUndoRedoButtons();
      setStatus('載入中...');
    };
    reader.readAsText(file);
    e.target.value = '';
  });

  document.getElementById('btnSave').addEventListener('click', save);
  document.getElementById('btnLoad').addEventListener('click', load);

  // ── Preview mode ───────────────────────────────────────────────
  function togglePreview() {
    State.previewMode = !State.previewMode;
    document.getElementById('sidebarLeft').style.display = State.previewMode ? 'none' : '';
    document.getElementById('sidebarRight').style.display = State.previewMode ? 'none' : '';
    document.querySelector('.toolbar').style.display = State.previewMode ? 'none' : '';
    document.querySelector('.status-bar').style.display = State.previewMode ? 'none' : '';
    document.getElementById('previewOverlay').style.display = State.previewMode ? 'flex' : 'none';
    scaleIframe();
  }

  document.getElementById('btnPreview').addEventListener('click', togglePreview);

  // ── Print ──────────────────────────────────────────────────────
  document.getElementById('btnPrint').addEventListener('click', () => {
    if (iframe.contentWindow) iframe.contentWindow.print();
  });

  // ── Settings modal ─────────────────────────────────────────────
  const settingsModal = document.getElementById('settingsModal');

  document.getElementById('btnSettings').addEventListener('click', () => {
    document.getElementById('settingsAccent').value = State.tweaks.accent;
    document.getElementById('accentHex').textContent = State.tweaks.accent;
    document.getElementById('settingsFont').value = State.tweaks.font;
    document.getElementById('settingsRail').checked = State.tweaks.rail;
    settingsModal.classList.add('active');
  });

  document.getElementById('settingsAccent').addEventListener('input', (e) => {
    document.getElementById('accentHex').textContent = e.target.value;
  });

  document.getElementById('btnSettingsCancel').addEventListener('click', () => {
    settingsModal.classList.remove('active');
  });

  document.getElementById('btnSettingsApply').addEventListener('click', () => {
    State.tweaks = {
      accent: document.getElementById('settingsAccent').value,
      font: document.getElementById('settingsFont').value,
      rail: document.getElementById('settingsRail').checked,
    };
    iframe.contentWindow.postMessage({
      type: 'editor:setTweaks', tweaks: State.tweaks
    }, '*');
    settingsModal.classList.remove('active');
    setTimeout(() => refreshThumbnails(), 300);
  });

  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.classList.remove('active');
  });

  // ── Image generation ───────────────────────────────────────────
  document.getElementById('btnGenImage').addEventListener('click', async () => {
    const imageData = await ImagePanel.generateImage();
    if (imageData) {
      pushUndo();
      iframe.contentWindow.postMessage({
        type: 'editor:insertImage',
        slideIndex: State.currentIndex,
        targetSelector: '.imgph',
        imageData
      }, '*');
      setTimeout(() => refreshThumbnail(State.currentIndex), 300);
    }
  });

  document.getElementById('btnCopyPrompt').addEventListener('click', () => ImagePanel.copyPrompt());

  // ── Add slide button ───────────────────────────────────────────
  document.getElementById('btnAddSlide').addEventListener('click', showTemplateModal);

  // ── Keyboard shortcuts ─────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if (e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); }
      if (e.key === 's') { e.preventDefault(); save(); }
      if (e.key === 'n') { e.preventDefault(); showTemplateModal(); }
    }

    if (e.key === 'Escape' && State.previewMode) togglePreview();
    if (e.key === 'Delete' && State.bridgeReady) deleteSlide(State.currentIndex);
  });

  // ── File name editing ──────────────────────────────────────────
  document.getElementById('fileName').addEventListener('change', (e) => {
    State.fileName = e.target.value || 'Untitled.html';
  });

  // ── Status helpers ─────────────────────────────────────────────
  function setStatus(msg, isError) {
    document.getElementById('statusText').textContent = msg;
    document.getElementById('statusDot').className = 'status-dot' + (isError ? ' dirty' : '');
  }

  function updateSlideCount() {
    document.getElementById('slideCount').textContent =
      `${State.currentIndex + 1} / ${State.slideCount}`;
  }

  function updateDirtyState() {
    document.getElementById('statusDot').className = 'status-dot' + (State.dirty ? ' dirty' : '');
  }

  // ── Initialize ─────────────────────────────────────────────────
  loadDeck();
  setStatus('初始化中...');
  scaleIframe();

})();
