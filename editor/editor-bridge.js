// editor-bridge.js — Injected into the deck iframe to bridge editor <-> deck-stage
(function() {
  'use strict';

  const HOST = window.parent;
  let deckEl = null;
  let editingEl = null;
  let slideIdCounter = 0;

  function post(type, data) {
    HOST.postMessage({ type, ...data }, '*');
  }

  function getSlides() {
    if (!deckEl) return [];
    return Array.from(deckEl.children).filter(el => el.tagName === 'SECTION');
  }

  function assignIds() {
    getSlides().forEach(s => {
      if (!s.dataset.editorId) s.dataset.editorId = 's' + (++slideIdCounter);
    });
  }

  function getSlideHtml(index) {
    const slides = getSlides();
    return slides[index] ? slides[index].outerHTML : '';
  }

  function getFullHTML() {
    const doc = document.documentElement;
    const html = '<!DOCTYPE html>\n' + doc.outerHTML;
    return html;
  }

  function getDeckHTML() {
    return deckEl ? deckEl.innerHTML : '';
  }

  function activateEdit(selector) {
    deactivateEdit();
    const el = document.querySelector(selector);
    if (!el) return;
    editingEl = el;
    el.contentEditable = 'true';
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function deactivateEdit() {
    if (!editingEl) return;
    editingEl.contentEditable = 'false';
    const slide = editingEl.closest('section');
    const slideIndex = getSlides().indexOf(slide);
    post('editor:contentChanged', {
      slideIndex,
      html: slide ? slide.outerHTML : '',
      editorId: slide ? slide.dataset.editorId : ''
    });
    editingEl = null;
  }

  function insertSlide(index, html) {
    const slides = getSlides();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const newSection = doc.body.firstElementChild;
    if (!newSection || newSection.tagName !== 'SECTION') return;
    newSection.dataset.editorId = 's' + (++slideIdCounter);

    if (index >= slides.length) {
      deckEl.appendChild(newSection);
    } else {
      slides[index].parentNode.insertBefore(newSection, slides[index]);
    }
    post('editor:deckMutated', { action: 'insert', index });
  }

  function deleteSlide(index) {
    const slides = getSlides();
    if (slides[index]) {
      slides[index].remove();
      post('editor:deckMutated', { action: 'delete', index });
    }
  }

  function moveSlide(from, to) {
    const slides = getSlides();
    if (from < 0 || from >= slides.length || to < 0 || to >= slides.length) return;
    const el = slides[from];
    el.remove();
    if (to >= slides.length - 1) {
      deckEl.appendChild(el);
    } else {
      const ref = getSlides()[to];
      ref.parentNode.insertBefore(el, ref);
    }
    post('editor:deckMutated', { action: 'move', from, to });
  }

  function duplicateSlide(index) {
    const slides = getSlides();
    if (!slides[index]) return;
    const clone = slides[index].cloneNode(true);
    clone.dataset.editorId = 's' + (++slideIdCounter);
    const next = slides[index + 1];
    if (next) {
      next.parentNode.insertBefore(clone, next);
    } else {
      deckEl.appendChild(clone);
    }
    post('editor:deckMutated', { action: 'duplicate', index });
  }

  function setDark(index, dark) {
    const slides = getSlides();
    if (slides[index]) {
      slides[index].classList.toggle('dark', dark);
      post('editor:contentChanged', { slideIndex: index, html: slides[index].outerHTML });
    }
  }

  function setLabel(index, label) {
    const slides = getSlides();
    if (slides[index]) {
      slides[index].dataset.label = label;
    }
  }

  function insertImage(slideIndex, targetSelector, imageData) {
    const slides = getSlides();
    const slide = slides[slideIndex];
    if (!slide) return;
    let target = targetSelector ? slide.querySelector(targetSelector) : null;
    if (target) {
      const img = document.createElement('img');
      img.src = imageData;
      img.alt = 'AI generated';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:8px;';
      target.replaceWith(img);
    } else {
      const img = document.createElement('img');
      img.src = imageData;
      img.alt = 'AI generated';
      img.style.cssText = 'width:60%;border-radius:8px;margin:16px auto;display:block;';
      slide.appendChild(img);
    }
    post('editor:contentChanged', { slideIndex, html: slide.outerHTML });
  }

  function insertElement(slideIndex, html) {
    const slides = getSlides();
    const slide = slides[slideIndex];
    if (!slide) return;
    const meta = slide.querySelector('.slide-meta');
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
    const el = doc.body.firstElementChild;
    if (meta) {
      meta.parentNode.insertBefore(el, meta);
    } else {
      slide.appendChild(el);
    }
    post('editor:contentChanged', { slideIndex, html: slide.outerHTML });
  }

  function loadHTML(html) {
    document.open();
    document.write(html);
    document.close();
    init();
  }

  function setTweaks(tweaks) {
    const root = document.documentElement;
    if (tweaks.accent) {
      root.style.setProperty('--accent', tweaks.accent);
      root.style.setProperty('--accent-soft', tweaks.accent + '33');
    }
    if (tweaks.font) {
      root.style.setProperty('--body-font', `"${tweaks.font}", "Noto Sans HK", system-ui, sans-serif`);
    }
    if (typeof tweaks.rail === 'boolean') {
      document.body.classList.toggle('no-progress-rail', !tweaks.rail);
    }
    window.dispatchEvent(new Event('tweakchange'));
  }

  // Event listeners
  document.addEventListener('dblclick', (e) => {
    const editable = e.target.closest('h1, h2, h3, h4, p, .assertion, .lead, .caption, .eyebrow, li, .num-label, span');
    if (!editable || editable.closest('.slide-meta')) return;
    const slide = editable.closest('section');
    if (!slide) return;
    e.stopPropagation();
    activateEdit(buildSelector(editable));
  });

  document.addEventListener('focusout', (e) => {
    if (editingEl && !editingEl.contains(e.relatedTarget)) {
      deactivateEdit();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (editingEl && e.key === 'Escape') {
      e.preventDefault();
      deactivateEdit();
    }
  });

  function buildSelector(el) {
    if (el.id) return '#' + el.id;
    if (el.dataset.editorId) return `[data-editor-id="${el.dataset.editorId}"]`;
    const slide = el.closest('section');
    const slides = getSlides();
    const idx = slides.indexOf(slide);
    const tag = el.tagName.toLowerCase();
    const cls = el.className ? '.' + el.className.split(' ').join('.') : '';
    return `section:nth-child(${idx + 1}) ${tag}${cls}`;
  }

  function init() {
    deckEl = document.querySelector('deck-stage');
    if (!deckEl) {
      setTimeout(init, 100);
      return;
    }
    assignIds();

    deckEl.addEventListener('slidechange', (e) => {
      post('editor:slideChanged', {
        index: e.detail.index,
        total: e.detail.total
      });
    });

    post('editor:ready', {
      slideCount: getSlides().length,
      labels: getSlides().map(s => s.dataset.label || '')
    });
  }

  // Message handler
  window.addEventListener('message', (e) => {
    const msg = e.data;
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'editor:goTo':
        if (deckEl) deckEl.goTo(msg.index);
        break;
      case 'editor:activateEdit':
        activateEdit(msg.selector);
        break;
      case 'editor:deactivateEdit':
        deactivateEdit();
        break;
      case 'editor:insertSlide':
        insertSlide(msg.index, msg.html);
        break;
      case 'editor:deleteSlide':
        deleteSlide(msg.index);
        break;
      case 'editor:moveSlide':
        moveSlide(msg.from, msg.to);
        break;
      case 'editor:duplicateSlide':
        duplicateSlide(msg.index);
        break;
      case 'editor:setDark':
        setDark(msg.index, msg.dark);
        break;
      case 'editor:setLabel':
        setLabel(msg.index, msg.label);
        break;
      case 'editor:insertImage':
        insertImage(msg.slideIndex, msg.targetSelector, msg.imageData);
        break;
      case 'editor:insertElement':
        insertElement(msg.slideIndex, msg.html);
        break;
      case 'editor:getHTML':
        post('editor:htmlResponse', { html: getFullHTML() });
        break;
      case 'editor:getDeckHTML':
        post('editor:deckHTMLResponse', { html: getDeckHTML() });
        break;
      case 'editor:loadHTML':
        loadHTML(msg.html);
        break;
      case 'editor:setTweaks':
        setTweaks(msg.tweaks);
        break;
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
