/* ============================================================
   deck-script.js — runtime helpers for the Professor template
   - auto-number page meta
   - top-of-slide progress rail (with section markers)
   - pause-slide countdown (slide labelled 'Pause Slide')
   - quiz & branching reveal interactions
   - vanilla Tweaks panel (accent · font · rail)
   ============================================================ */
(function () {
  'use strict';

  function init() {
    const deck = document.querySelector('deck-stage');
    if (!deck) return;
    // Live state — recomputed by rebuild() so skip / reorder / delete in the
    // deck-stage thumbnail rail keep footers, the progress rail, and the
    // Shift+1–9 phase jumps in sync. Plain `let` (not const) for that reason.
    let slides = [];
    let total = 0;
    let partStartIdx = [];   // indices of part-divider slides (phase jumps)
    let partPhase = {};      // slide index → part number string
    let navIdx = [];         // slide indices that are navigable (skip omitted);
                             // each progress-rail tick maps to navIdx[k]

    function pageNum(i) {
      const n = String(i + 1).padStart(2, '0');
      const t = String(total).padStart(2, '0');
      return n + ' / ' + t;
    }

    /* -------- 1+2. (Re)build footers, counts, and progress rails ------
       Part dividers are the dark section slides whose data-label names a
       part, e.g. "03 Part 1 Cognitive" — their ticks get a notch via
       .tick.part-start and carry the part number in data-phase. Not every
       dark slide is a part (Thank-You, the Starter quote, and the Appendix
       divider are dark too), so match the label, not the class. ----------- */
    function rebuild() {
      slides = Array.from(deck.querySelectorAll(':scope > section'));
      total  = slides.length;

      // Auto-number every .slide-meta .num (source ships them empty).
      slides.forEach((s, i) => {
        const num = s.querySelector('.slide-meta .num');
        if (num) num.textContent = pageNum(i);
      });
      // [data-deck-count] (e.g. the cover's "NN slides") tracks section count.
      document.querySelectorAll('[data-deck-count]').forEach(el => {
        el.textContent = String(total);
      });

      // Recompute part dividers.
      partStartIdx = [];
      partPhase = {};
      slides.forEach((s, i) => {
        const m = (s.dataset.label || '').match(/Part\s+(\d+)/i);
        if (s.classList.contains('dark') && m) {
          partStartIdx.push(i);
          partPhase[i] = m[1];
        }
      });

      // Rebuild each slide's progress rail. Skipped slides (hidden from
      // deck-stage navigation via data-deck-skip) are omitted from the tick
      // count so the rail can't over-count a trimmed-for-time lecture.
      navIdx = slides
        .map((s, i) => (s.hasAttribute('data-deck-skip') ? -1 : i))
        .filter(i => i !== -1);
      const activeIdx = slides.findIndex(s => s.hasAttribute('data-deck-active'));
      slides.forEach((s, idx) => {
        const old = s.querySelector(':scope > .progress-rail');
        if (old) old.remove();
        const rail = document.createElement('div');
        rail.className = 'progress-rail';
        navIdx.forEach((slideIndex) => {
          const tick = document.createElement('div');
          tick.className = 'tick';
          if (slideIndex === idx) tick.classList.add('active');
          else if (slideIndex < idx) tick.classList.add('past');
          if (partPhase[slideIndex] != null) {
            tick.classList.add('part-start');
            tick.dataset.phase = partPhase[slideIndex];
          }
          rail.appendChild(tick);
        });
        s.insertBefore(rail, s.firstChild);
      });
      // Re-paint active/past against the current slide after a rebuild.
      if (activeIdx >= 0) updateRailAll(activeIdx);
    }
    rebuild();

    /* -------- 3. Pause/round timer (with controls) ----------- */
    const timerState = { interval: null, remaining: 0, total: 0, el: null };

    function renderTimer() {
      if (!timerState.el) return;
      const m = Math.floor(timerState.remaining / 60);
      const s = timerState.remaining % 60;
      timerState.el.innerHTML =
        String(m).padStart(2,'0') +
        '<span class="sep">:</span>' +
        String(s).padStart(2,'0');
      timerState.el.classList.toggle('done', timerState.remaining <= 0);
      syncTimerControls();
    }
    const isZhDeck = (document.documentElement.lang || '').toLowerCase().startsWith('zh');
    const TIMER_LABEL = isZhDeck
      ? { running: '⏸ 暫停', paused: '▶ 開始' }
      : { running: '⏸ Pause', paused: '▶ Start' };
    function syncTimerControls() {
      const running = !!timerState.interval;
      document.querySelectorAll('[data-timer-action="toggle"]').forEach(btn => {
        btn.dataset.timerState = running ? 'running' : 'paused';
        btn.textContent = running ? TIMER_LABEL.running : TIMER_LABEL.paused;
      });
    }
    function startTick() {
      if (timerState.interval || !timerState.el) return;
      timerState.interval = setInterval(() => {
        timerState.remaining = Math.max(0, timerState.remaining - 1);
        renderTimer();
        if (timerState.remaining <= 0) pauseTick();
      }, 1000);
      syncTimerControls();
    }
    function pauseTick() {
      if (timerState.interval) { clearInterval(timerState.interval); timerState.interval = null; }
      syncTimerControls();
    }
    function setupTimer(slide) {
      pauseTick();
      const timerEl = slide.querySelector('[data-pause-timer]');
      if (!timerEl) { timerState.el = null; return; }
      timerState.el = timerEl;
      timerState.total = parseInt(timerEl.dataset.pauseTimer || '120', 10);
      timerState.remaining = timerState.total;
      renderTimer();
      // Manual mode: don't auto-start (lecturer must press play)
      const manual = timerEl.hasAttribute('data-manual');
      if (!manual) startTick();
    }

    // Wire timer control buttons (delegated, lives forever)
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-timer-action]');
      if (!btn) return;
      const a = btn.dataset.timerAction;
      if (a === 'toggle') (timerState.interval ? pauseTick : startTick)();
      if (a === 'play')   startTick();
      if (a === 'pause')  pauseTick();
      if (a === 'add60')  {
        timerState.total    += 60;
        timerState.remaining += 60;
        renderTimer();
      }
      if (a === 'reset')  {
        pauseTick();
        timerState.remaining = timerState.total;
        renderTimer();
      }
    });

    /* -------- 4. Reset interactive state on slide entry ------ */
    function resetInteractives(slide) {
      slide.querySelectorAll('[data-quiz]').forEach(q => q.removeAttribute('data-revealed'));
      slide.querySelectorAll('[data-branch]').forEach(b => b.removeAttribute('data-revealed'));
      const t = slide.querySelector('[data-pause-timer]');
      if (t) t.classList.remove('done');
    }

    /* -------- 5. Quiz + branch reveal on click --------------- */
    function attachReveal(root) {
      root.addEventListener('click', (e) => {
        const opt = e.target.closest('[data-quiz-option], [data-branch-option]');
        if (!opt) return;
        const container = opt.closest('[data-quiz], [data-branch]');
        if (container) container.setAttribute('data-revealed', 'true');
      });
    }
    attachReveal(deck);

    // Keyboard a11y for click-to-reveal options (quiz slide 25 +
    // branch-reveal slide 26). Both are plain <div>s activated by the
    // attachReveal click handler; make them tabbable and Enter/Space-able.
    deck.querySelectorAll('.quiz-opt, [data-branch-option]').forEach(opt => {
      opt.setAttribute('tabindex', '0');
      opt.setAttribute('role', 'button');
      opt.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          opt.click();
        }
      });
    });

    /* -------- 6. Update rail + timer on slide change --------- */
    function updateRailAll(activeIdx) {
      // Tick k represents the navigable slide navIdx[k], so compare against
      // the active *slide* index rather than the tick's position.
      slides.forEach((s) => {
        const rail = s.querySelector(':scope > .progress-rail');
        if (!rail) return;
        rail.querySelectorAll('.tick').forEach((t, k) => {
          const slideIndex = navIdx[k];
          t.classList.toggle('active', slideIndex === activeIdx);
          t.classList.toggle('past',   slideIndex <  activeIdx);
        });
      });
    }

    deck.addEventListener('slidechange', (e) => {
      const idx = e.detail.index;
      const slide = e.detail.slide;
      updateRailAll(idx);
      resetInteractives(slide);
      setupTimer(slide);
    });

    // deck-stage emits deckchange when a slide is skipped, reordered, or
    // deleted from its thumbnail rail. Rebuild footers, the cover count, and
    // the progress rails so none of them drift out of sync with the new deck.
    deck.addEventListener('deckchange', () => rebuild());

    if (slides[0]) setupTimer(slides[0]);

    /* -------- 6b. Shift + 1–9 → jump to part N ----------------
       Plain 1–9 is owned by deck-stage.js (jump to *slide* N), so phase
       jumps use Shift to avoid the collision. Shift turns e.key into a
       symbol (!@#…), so read the physical key from e.code instead. ------ */
    document.addEventListener('keydown', (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (!e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
      const m = /^Digit([1-9])$/.exec(e.code || '');
      if (!m) return;
      const n = parseInt(m[1], 10);
      if (partStartIdx[n - 1] != null) {
        deck.goTo(partStartIdx[n - 1]);
        e.preventDefault();
      }
    });

    /* -------- 7. Tweaks panel -------------------------------- */
    setupTweaks(deck);

    /* -------- 8. TIER 1 interactive demos -------------------- */
    setupFHeatmap();
    setupRatioSliders();
    setupContrastChecker();
    setupMuddiest();

    /* -------- 9. TIER 2 appendix interactions ---------------- */
    setupDragHierarchy();
    setupBranchNav();
    setupSpecGlyphs();

    /* -------- 10. TIER 3 designer overlay (D key) ------------ */
    setupDesignerOverlay();

    /* -------- 11. T3 #10 — class clock (T key) -------------- */
    setupClassClock();
  }

  /* ============================================================
     Tier 1 · F-pattern heatmap
     ============================================================ */
  function setupFHeatmap() {
    const stage = document.querySelector('[data-heatmap]');
    if (!stage) return;
    const cursor = stage.querySelector('.heatmap-cursor');
    let lastTrailAt = 0;

    stage.addEventListener('pointermove', (e) => {
      const rect = stage.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      stage.classList.add('active');
      if (cursor) {
        cursor.style.left = x + 'px';
        cursor.style.top  = y + 'px';
      }
      // throttle trail dots
      const now = Date.now();
      if (now - lastTrailAt > 90) {
        lastTrailAt = now;
        const dot = document.createElement('div');
        dot.className = 'heatmap-trail';
        dot.style.left = x + 'px';
        dot.style.top  = y + 'px';
        stage.appendChild(dot);
        setTimeout(() => dot.remove(), 1800);
      }
    });
    stage.addEventListener('pointerleave', () => {
      stage.classList.remove('active');
    });
  }

  /* ============================================================
     Tier 1 · 60-30-10 ratio sliders
     ============================================================ */
  function setupRatioSliders() {
    const stage = document.querySelector('[data-ratio]');
    if (!stage) return;
    const primary   = stage.querySelector('.seg.primary');
    const secondary = stage.querySelector('.seg.secondary');
    const accent    = stage.querySelector('.seg.accent');
    const primaryPct   = stage.querySelector('.seg.primary   .pct');
    const secondaryPct = stage.querySelector('.seg.secondary .pct');
    const accentPct    = stage.querySelector('.seg.accent    .pct');
    const slider1 = stage.querySelector('[data-slider="1"]'); // where primary ends
    const slider2 = stage.querySelector('[data-slider="2"]'); // where secondary ends
    const val1 = stage.querySelector('[data-val="1"]');
    const val2 = stage.querySelector('[data-val="2"]');
    const status = stage.querySelector('.ratio-status');

    function render() {
      let v1 = +slider1.value;          // 0–100 — primary end
      let v2 = +slider2.value;          // 0–100 — secondary end
      if (v2 < v1 + 5) v2 = v1 + 5;     // keep secondary >= 5 wide
      if (v2 > 100) v2 = 100;
      slider2.value = v2;

      const p = v1;
      const s = v2 - v1;
      const a = 100 - v2;

      primary.style.flex   = p + ' 0 0';
      secondary.style.flex = s + ' 0 0';
      accent.style.flex    = a + ' 0 0';

      primaryPct.textContent   = Math.round(p) + '%';
      secondaryPct.textContent = Math.round(s) + '%';
      accentPct.textContent    = Math.round(a) + '%';
      val1.textContent = Math.round(p) + '%';
      val2.textContent = Math.round(s) + '%';

      // perception score: how close to canonical 60-30-10
      const off = Math.abs(p - 60) + Math.abs(s - 30) + Math.abs(a - 10);
      const warn = a > 18 || a < 4 || p < 45;
      status.classList.toggle('warn', warn);
      if (a > 18) {
        status.innerHTML = '<strong>Accent diluted.</strong> Above 15% the focal stops being focal — students stop seeing the highlight.';
      } else if (a < 4) {
        status.innerHTML = '<strong>Accent invisible.</strong> Below 5% the focal is too rare to register as the answer color.';
      } else if (p < 45) {
        status.innerHTML = '<strong>Base too small.</strong> The neutral surround should dominate — without it the slide feels claustrophobic.';
      } else if (off < 15) {
        status.innerHTML = '<strong>Canonical 60-30-10.</strong> The accent reads as scarce; the base feels calm.';
      } else {
        status.innerHTML = '<strong>Workable.</strong> Within tolerance — the focal still reads as focal.';
      }
    }

    slider1.addEventListener('input', render);
    slider2.addEventListener('input', render);
    render();
  }

  /* ============================================================
     Tier 1 · Live contrast checker
     ============================================================ */
  function relLuminance(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return 0;
    const n = parseInt(m[1], 16);
    const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }
  function contrastRatio(bg, fg) {
    const a = relLuminance(bg), b = relLuminance(fg);
    const L1 = Math.max(a, b), L2 = Math.min(a, b);
    return (L1 + 0.05) / (L2 + 0.05);
  }

  function setupContrastChecker() {
    const tool = document.querySelector('[data-contrast]');
    if (!tool) return;
    const bgInput = tool.querySelector('[data-bg]');
    const fgInput = tool.querySelector('[data-fg]');
    const bgHex = tool.querySelector('[data-bg-hex]');
    const fgHex = tool.querySelector('[data-fg-hex]');
    const preview = tool.querySelector('.preview');
    const ratioEl = preview.querySelector('.ratio');
    const verdict = preview.querySelector('.verdict');

    function render() {
      const bg = bgInput.value;
      const fg = fgInput.value;
      preview.style.background = bg;
      preview.style.color = fg;
      bgHex.textContent = bg.toUpperCase();
      fgHex.textContent = fg.toUpperCase();
      const r = contrastRatio(bg, fg);
      ratioEl.textContent = r.toFixed(2) + ':1';

      verdict.classList.remove('aaa', 'aa', 'large', 'fail');
      if (r >= 7) {
        verdict.classList.add('aaa');
        verdict.textContent = 'AAA · all text';
      } else if (r >= 4.5) {
        verdict.classList.add('aa');
        verdict.textContent = 'AA · normal text';
      } else if (r >= 3) {
        verdict.classList.add('large');
        verdict.textContent = 'Large text only · ≥ 18 pt';
      } else {
        verdict.classList.add('fail');
        verdict.textContent = 'Fail · do not use';
      }
    }
    bgInput.addEventListener('input', render);
    fgInput.addEventListener('input', render);
    render();
  }

  /* ============================================================
     Tier 1 · Muddiest-point submissions
     ============================================================ */
  function setupMuddiest() {
    const box = document.querySelector('[data-muddiest]');
    if (!box) return;
    const form = box.querySelector('form');
    const input = box.querySelector('textarea');
    const list = box.querySelector('.muddiest-list');
    const meta = box.querySelector('.muddiest-meta');
    const STORE_KEY = 'muddiest-points';
    const isZh = (document.documentElement.lang || '').toLowerCase().startsWith('zh');
    const L = isZh ? {
      empty: '還沒有提交 · 輸入文字後按 Enter',
      count: (n) => n + ' 則匿名提交',
      clear: '清除全部'
    } : {
      empty: 'No submissions yet · type and press enter to add',
      count: (n) => n + ' anonymous submission' + (n === 1 ? '' : 's'),
      clear: 'Clear all'
    };

    // Add admin clear button next to the meta
    if (!box.querySelector('.muddiest-clear')) {
      const clr = document.createElement('button');
      clr.className = 'muddiest-clear';
      clr.type = 'button';
      clr.textContent = L.clear;
      clr.addEventListener('click', () => {
        save([]); render();
      });
      meta.appendChild(clr);
    }

    function load() {
      try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); }
      catch (e) { return []; }
    }
    function save(items) {
      try { localStorage.setItem(STORE_KEY, JSON.stringify(items)); } catch (e) {}
    }
    function render() {
      const items = load();
      list.innerHTML = '';
      items.slice(-8).forEach((text, i) => {
        const pill = document.createElement('span');
        pill.className = 'muddiest-pill';
        pill.innerHTML = `<span class="dot"></span><span>${escapeHtml(text)}</span><button class="x" aria-label="Remove">×</button>`;
        pill.querySelector('.x').addEventListener('click', () => {
          const all = load();
          const realIdx = all.length - Math.min(all.length, 8) + i;
          all.splice(realIdx, 1);
          save(all);
          render();
        });
        list.appendChild(pill);
      });
      // Re-attach clear button after innerHTML reset (we set meta.textContent below, then re-append)
      meta.textContent = items.length === 0 ? L.empty : L.count(items.length);
      const clr = box.querySelector('.muddiest-clear');
      if (clr) meta.appendChild(clr);
    }
    function escapeHtml(s) {
      return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = input.value.trim();
      if (!v) return;
      const items = load();
      items.push(v.slice(0, 120));
      save(items);
      input.value = '';
      render();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
    });
    render();
  }

  /* ============================================================
     Tier 2 · Drag-to-reorder hierarchy (appendix)
     ============================================================ */
  function setupDragHierarchy() {
    const stack = document.querySelector('[data-drag-stack]');
    if (!stack) return;
    const preview = document.querySelector('[data-drag-preview]');
    let dragging = null;

    function getItems() {
      return Array.from(stack.querySelectorAll('.drag-item'));
    }

    function updatePreview() {
      const items = getItems();
      const topRank = items[0]?.dataset.lever || '';
      const num = preview.querySelector('.num');
      // re-render KPI styling based on what's at rank 1
      // size / weight / color → biggest / boldest / accent
      let fontSize = 96, weight = 400, useAccent = false;
      if (topRank === 'size')   fontSize = 220;
      if (topRank === 'weight') { fontSize = 120; weight = 800; }
      if (topRank === 'color')  { fontSize = 120; useAccent = true; }
      num.style.fontSize = fontSize + 'px';
      num.style.fontWeight = weight;
      num.classList.toggle('accent', useAccent);

      // update rank labels in list
      items.forEach((el, i) => {
        const r = el.querySelector('.rank');
        if (r) r.textContent = String(i + 1).padStart(2, '0');
      });
    }

    stack.addEventListener('dragstart', (e) => {
      const item = e.target.closest('.drag-item');
      if (!item) return;
      dragging = item;
      item.classList.add('dragging');
      try { e.dataTransfer.effectAllowed = 'move'; } catch(_){}
    });

    stack.addEventListener('dragover', (e) => {
      if (!dragging) return;
      e.preventDefault();
      const target = e.target.closest('.drag-item');
      if (!target || target === dragging) return;
      const rect = target.getBoundingClientRect();
      const below = (e.clientY - rect.top) > rect.height / 2;
      stack.insertBefore(dragging, below ? target.nextSibling : target);
    });

    stack.addEventListener('dragend', () => {
      if (dragging) dragging.classList.remove('dragging');
      dragging = null;
      updatePreview();
    });

    getItems().forEach(el => el.setAttribute('draggable', 'true'));
    updatePreview();
  }

  /* ============================================================
     Tier 2 · Real branching navigation (slide 37)
     ============================================================ */
  function setupBranchNav() {
    const decision    = document.querySelector('[data-branch-nav="decision"]');
    const consequence = document.querySelector('[data-branch-nav="consequence"]');
    if (!decision || !consequence) return;

    const CONSEQUENCES = {
      a: {
        label: '→ Outcome A',
        title: 'You propose three fixes immediately.',
        body:  'The team-lead nods but the metric is unchanged a week later — because the drop wasn\'t real. Your fixes shipped, your roadmap slipped, and the underlying question stayed unasked.'
      },
      b: {
        label: '→ Outcome B',
        title: 'You ask what changed in the pipeline first.',
        body:  'Discovery: the metric is correct but its definition shifted last week. You\'ve avoided two days of wasted remediation and surfaced a more interesting question about how the team measures success.'
      },
      c: {
        label: '→ Outcome C',
        title: 'You defer to the analytics team.',
        body:  'A week later, analytics reports back: the metric is fine, the question is the definition. The work was done — just by the wrong people, two layers removed from the team that actually owns the outcome.'
      },
      d: {
        label: '→ Outcome D',
        title: 'You ask the team-lead to define the metric first.',
        body:  'Awkward thirty seconds. Then a real conversation about what "key" actually means here. The metric was fine; the alignment wasn\'t. You\'ve set a precedent that definitions get questioned before fixes get proposed.'
      }
    };

    const labelEl = consequence.querySelector('[data-consequence-label]');
    const titleEl = consequence.querySelector('[data-consequence-title]');
    const bodyEl  = consequence.querySelector('[data-consequence-body]');
    const backBtn = consequence.querySelector('[data-branch-back]');

    decision.querySelectorAll('[data-branch-go]').forEach(opt => {
      // The option cards are plain <div>s — make them keyboard-operable.
      opt.setAttribute('tabindex', '0');
      opt.setAttribute('role', 'button');
      opt.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opt.click(); }
      });
      opt.addEventListener('click', () => {
        const key = opt.dataset.branchGo;
        const c = CONSEQUENCES[key];
        if (!c) return;
        labelEl.textContent = c.label;
        titleEl.textContent = c.title;
        bodyEl.textContent  = c.body;
        decision.style.display = 'none';
        consequence.style.display = 'block';
        // Move focus into the consequence view so keyboard users aren't
        // stranded on a now-hidden card.
        if (backBtn && backBtn.focus) backBtn.focus();
      });
    });

    backBtn.addEventListener('click', () => {
      consequence.style.display = 'none';
      decision.style.display = 'block';
    });
  }

  /* ============================================================
     Appendix · hover-spec glyphs — keyboard reachability
     The tooltip is CSS :hover/:focus-visible driven; glyphs just need to
     be focusable + announced. (The slide's own caption already flags that
     hover alone isn't reachable — this is the production fix it names.)
     ============================================================ */
  function setupSpecGlyphs() {
    document.querySelectorAll('.spec-glyph[data-note]').forEach(g => {
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'img');
      // Glyph + its note, so a screen reader gets both the character and why.
      g.setAttribute('aria-label', g.textContent.trim() + ' — ' + g.dataset.note);
    });
  }

  /* ============================================================
     Tier 3 · Designer overlay (press D)
     Toggles a translucent grid + element font-size labels.
     ============================================================ */
  function setupDesignerOverlay() {
    const css = `
      body.designer-on deck-stage > section.active-designer::before {
        content: ""; position: absolute; inset: 0; pointer-events: none; z-index: 100;
        background:
          repeating-linear-gradient(to right, rgba(164,69,47,0.06) 0 1px, transparent 1px 160px),
          repeating-linear-gradient(to bottom, rgba(164,69,47,0.06) 0 1px, transparent 1px 90px);
      }
      body.designer-on .designer-readout {
        position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
        background: var(--ink); color: var(--cream);
        font-family: var(--ui-font); font-size: 12px;
        letter-spacing: 0.14em; text-transform: uppercase;
        padding: 8px 16px; border-radius: 999px;
        z-index: 1001; box-shadow: 0 6px 24px rgba(0,0,0,0.25);
      }
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    const readout = document.createElement('div');
    readout.className = 'designer-readout';
    readout.style.display = 'none';
    const isZh = (document.documentElement.lang || '').toLowerCase().startsWith('zh');
    readout.textContent = isZh ? '設計模式 · 按 D 離開' : 'Designer mode · press D to exit';
    document.body.appendChild(readout);

    document.addEventListener('keydown', (e) => {
      // Ignore typing in form fields
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'd' || e.key === 'D') {
        const on = !document.body.classList.contains('designer-on');
        document.body.classList.toggle('designer-on', on);
        readout.style.display = on ? 'block' : 'none';
        // mark active slide
        const deck = document.querySelector('deck-stage');
        if (deck) {
          deck.querySelectorAll(':scope > section').forEach(s => s.classList.remove('active-designer'));
          // crude: first non-hidden section
          const active = Array.from(deck.querySelectorAll(':scope > section'))
            .find(s => getComputedStyle(s).opacity !== '0' && getComputedStyle(s).visibility !== 'hidden');
          if (active) active.classList.add('active-designer');
        }
      }
    });

    // keep "active-designer" in sync with slide changes
    const deck = document.querySelector('deck-stage');
    if (deck) {
      deck.addEventListener('slidechange', (e) => {
        deck.querySelectorAll(':scope > section').forEach(s => s.classList.remove('active-designer'));
        if (document.body.classList.contains('designer-on') && e.detail.slide) {
          e.detail.slide.classList.add('active-designer');
        }
      });
    }
  }

  /* ============================================================
     T3 #10 · Class clock (toggled with T key, counts elapsed time)
     ============================================================ */
  function setupClassClock() {
    const isZh = (document.documentElement.lang || '').toLowerCase().startsWith('zh');
    const labels = isZh
      ? { hint: '上課計時', resetTitle: '歸零' }
      : { hint: 'Class clock', resetTitle: 'Reset' };

    const clock = document.createElement('div');
    clock.className = 'class-clock';
    clock.innerHTML =
      '<span class="dot"></span>' +
      '<span class="label">' + labels.hint + '</span>' +
      '<span class="time">00:00</span>' +
      '<button class="reset-btn" title="' + labels.resetTitle + '">↻</button>';
    document.body.appendChild(clock);

    let elapsed = 0;
    let interval = null;
    const timeEl = clock.querySelector('.time');

    function render() {
      const h = Math.floor(elapsed / 3600);
      const m = Math.floor((elapsed % 3600) / 60);
      const s = elapsed % 60;
      timeEl.textContent =
        (h > 0 ? String(h).padStart(2,'0') + ':' : '') +
        String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
    }
    function start() {
      if (interval) return;
      interval = setInterval(() => { elapsed++; render(); }, 1000);
      clock.classList.remove('paused');
    }
    function pause() {
      if (interval) { clearInterval(interval); interval = null; }
      clock.classList.add('paused');
    }
    function toggle() { interval ? pause() : start(); }
    function reset() { pause(); elapsed = 0; render(); }

    document.addEventListener('keydown', (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 't' || e.key === 'T') {
        if (e.shiftKey) { reset(); return; }
        if (!clock.classList.contains('on')) { clock.classList.add('on'); start(); }
        else toggle();
      }
    });

    clock.querySelector('.reset-btn').addEventListener('click', (e) => {
      e.stopPropagation(); reset();
    });
    clock.addEventListener('click', (e) => {
      if (e.target.closest('.reset-btn')) return;
      toggle();
    });

    render();
  }
  const TWEAKS = /*EDITMODE-BEGIN*/{
    "accent":   "#A4452F",
    "font":     "Atkinson Hyperlegible",
    "rail":     true
  }/*EDITMODE-END*/;

  const ACCENT_OPTIONS = [
    { name: 'Terracotta', value: '#A4452F', soft: '#EFD5CC' },
    { name: 'Forest',     value: '#2F6B4A', soft: '#D4E5DA' },
    { name: 'Indigo',     value: '#3A4FA8', soft: '#D6DBF0' },
    { name: 'Ochre',      value: '#9A6B14', soft: '#EFE0C4' }
  ];

  const FONT_OPTIONS = [
    { name: 'Atkinson Hyperlegible', stack: '"Atkinson Hyperlegible", "Verdana", system-ui, sans-serif' },
    { name: 'Lexend',                stack: '"Lexend", "Atkinson Hyperlegible", system-ui, sans-serif' },
    { name: 'Verdana',               stack: 'Verdana, Geneva, "Atkinson Hyperlegible", sans-serif' }
  ];

  function applyTweaks(t) {
    const r = document.documentElement.style;
    const accent = ACCENT_OPTIONS.find(a => a.value === t.accent) || ACCENT_OPTIONS[0];
    r.setProperty('--accent', accent.value);
    r.setProperty('--accent-soft', accent.soft);
    const font = FONT_OPTIONS.find(f => f.name === t.font) || FONT_OPTIONS[0];
    r.setProperty('--body-font', font.stack);
    document.body.classList.toggle('no-progress-rail', !t.rail);
  }

  function setupTweaks(deck) {
    applyTweaks(TWEAKS);

    const isZh = (document.documentElement.lang || '').toLowerCase().startsWith('zh');
    const L = isZh ? {
      title:  '個人化',
      accent: '主色',
      font:   '字體',
      rail:   '進度條',
      hint:   '改動會儲存 · 點擊色塊切換配色',
      close:  '關閉'
    } : {
      title:  'Tweaks',
      accent: 'Accent color',
      font:   'Body font',
      rail:   'Progress rail',
      hint:   'Changes persist · click swatches to switch palette.',
      close:  'Close'
    };

    const panel = document.createElement('div');
    panel.id = 'tweaks-panel';
    panel.style.display = 'none';
    panel.innerHTML = `
      <h4>${L.title} <button class="close" aria-label="${L.close}">×</button></h4>

      <div class="tweak-group">
        <div class="tweak-label">${L.accent}</div>
        <div class="swatch-row" data-swatches></div>
      </div>

      <div class="tweak-group">
        <div class="tweak-label">${L.font}</div>
        <select data-font></select>
      </div>

      <div class="tweak-group">
        <div class="toggle-row">
          <label for="tw-rail">${L.rail}</label>
          <input type="checkbox" id="tw-rail" data-rail />
        </div>
      </div>

      <div style="font-size:11px; color:var(--ink-faint); letter-spacing:0.06em; line-height:1.4; margin-top:6px;">
        ${L.hint}
      </div>
    `;
    document.body.appendChild(panel);

    // Swatches
    const swatchRow = panel.querySelector('[data-swatches]');
    ACCENT_OPTIONS.forEach(opt => {
      const sw = document.createElement('div');
      sw.className = 'swatch';
      sw.style.background = opt.value;
      sw.title = opt.name;
      sw.dataset.value = opt.value;
      if (opt.value === TWEAKS.accent) sw.dataset.active = 'true';
      sw.addEventListener('click', () => {
        TWEAKS.accent = opt.value;
        applyTweaks(TWEAKS);
        swatchRow.querySelectorAll('.swatch').forEach(s =>
          s.dataset.active = (s.dataset.value === opt.value).toString()
        );
        persist();
      });
      swatchRow.appendChild(sw);
    });

    // Font select
    const fontSel = panel.querySelector('[data-font]');
    FONT_OPTIONS.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt.name; o.textContent = opt.name;
      if (opt.name === TWEAKS.font) o.selected = true;
      fontSel.appendChild(o);
    });
    fontSel.addEventListener('change', () => {
      TWEAKS.font = fontSel.value;
      applyTweaks(TWEAKS);
      persist();
    });

    // Rail toggle
    const railToggle = panel.querySelector('[data-rail]');
    railToggle.checked = TWEAKS.rail;
    railToggle.addEventListener('change', () => {
      TWEAKS.rail = railToggle.checked;
      applyTweaks(TWEAKS);
      persist();
    });

    // Close button
    panel.querySelector('.close').addEventListener('click', () => {
      panel.style.display = 'none';
      try { window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*'); } catch (e) {}
    });

    function persist() {
      try {
        window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { ...TWEAKS } }, '*');
      } catch (e) {}
    }

    // Host protocol — listen FIRST, then announce availability
    window.addEventListener('message', (e) => {
      if (!e.data) return;
      if (e.data.type === '__activate_edit_mode')   panel.style.display = 'block';
      if (e.data.type === '__deactivate_edit_mode') panel.style.display = 'none';
    });
    try { window.parent.postMessage({ type: '__edit_mode_available' }, '*'); } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
