// image-panel.js — AI image generation panel for PPT Editor

const ImagePanel = (() => {
  const PROXY_URL = 'http://localhost:4321/api/generate';

  function extractSlideText(slide) {
    if (!slide) return '';
    const texts = [];
    slide.querySelectorAll('h1, h2, h3, .assertion, .lead, .eyebrow, p').forEach(el => {
      const t = el.textContent.trim();
      if (t && t.length > 2) texts.push(t);
    });
    return texts.slice(0, 5).join(' | ');
  }

  function generatePrompt(slideText) {
    const base = slideText || 'educational concept';
    return `Educational illustration for a lecture slide about: ${base}\nStyle: Clean, modern, flat design illustration. No text in image.\nColor palette: cream (#F2EEE5), slate blue (#3F5B7E), terracotta (#A4452F).\nAspect ratio: 16:9. Professional, minimal, suitable for university lecture.`;
  }

  function updatePromptFromSlide(slideIndex) {
    const iframe = document.getElementById('deckFrame');
    if (!iframe || !iframe.contentDocument) return;
    const deck = iframe.contentDocument.querySelector('deck-stage');
    if (!deck) return;
    const slides = Array.from(deck.children).filter(el => el.tagName === 'SECTION');
    const slide = slides[slideIndex];
    const text = extractSlideText(slide);
    document.getElementById('imagePrompt').value = generatePrompt(text);
    document.getElementById('imagePreview').innerHTML = '<span class="placeholder-text">尚未生成圖片</span>';
  }

  async function generateImage() {
    const prompt = document.getElementById('imagePrompt').value.trim();
    if (!prompt) { setStatus('請輸入圖片描述', true); return null; }

    const model = document.getElementById('imageModel').value;
    const size = document.getElementById('imageSize').value;
    const apiKey = document.getElementById('apiKey').value.trim();
    const btn = document.getElementById('btnGenImage');

    btn.disabled = true;
    btn.textContent = '生成中...';
    setStatus('正在生成圖片...');

    try {
      let imageData;

      if (apiKey) {
        const resp = await fetch(PROXY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, model, size, quality: 'auto', apiKey })
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${await resp.text()}`);
        const data = await resp.json();
        if (data.data && data.data[0]) {
          const item = data.data[0];
          imageData = item.b64_json
            ? `data:image/png;base64,${item.b64_json}`
            : item.url;
        } else {
          throw new Error('No image data in response');
        }
      } else {
        setStatus('未提供 API Key，已複製 Prompt 到剪貼簿');
        await navigator.clipboard.writeText(prompt);
        btn.disabled = false;
        btn.textContent = '生成圖片';
        return null;
      }

      if (imageData) {
        document.getElementById('imagePreview').innerHTML = `<img src="${imageData}" alt="Generated">`;
        setStatus('圖片生成成功');
        btn.disabled = false;
        btn.textContent = '生成圖片';
        return imageData;
      }
    } catch (err) {
      setStatus(`生成失敗: ${err.message}`, true);
      btn.disabled = false;
      btn.textContent = '生成圖片';
      return null;
    }
  }

  function setStatus(msg, isError) {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    text.textContent = msg;
    dot.className = 'status-dot' + (isError ? ' dirty' : '');
  }

  async function copyPrompt() {
    const prompt = document.getElementById('imagePrompt').value;
    try {
      await navigator.clipboard.writeText(prompt);
      setStatus('Prompt 已複製到剪貼簿');
    } catch {
      setStatus('複製失敗', true);
    }
  }

  return { generateImage, copyPrompt, updatePromptFromSlide, generatePrompt };
})();
