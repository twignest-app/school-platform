// ===== Nestopia · Nesty, the AI helper: chat bubble on the home page, School Hub and Parent Portal =====
(function () {
  if (window.__nestyChat) return; window.__nestyChat = 1;
  const FN = 'https://gvhzbxpgebgjnegdiijp.supabase.co/functions/v1/ask-nesty';
  const page = location.pathname.split('/').pop() || 'index.html';
  const who = page === 'parent.html' ? 'parent' : page === 'index.html' || page === '' ? 'visitor or school staff' : 'school staff member';
  const ar = () => /^ar/i.test(document.documentElement.lang || '');
  const T = () => ar() ? {
      btn: 'اسأل نستي', title: 'نستي · مساعد نستوبيا', hello: 'مرحبًا! 👋 أنا نستي، مساعد نستوبيا. اسألني عن المنصة، أو بوابة أولياء الأمور، أو نستلينجز، أو كيف تبدأ مدرستك.',
      ph: 'اكتب سؤالك…', send: 'إرسال', note: 'إجابات الذكاء الاصطناعي قد تخطئ. لا تشارك معلومات شخصية أو معلومات عن الطلاب. لمساعدة أكثر: <a href="/" data-nesty-demo>اطلب عرضًا</a>.',
      wait: 'أفكّر…', busy: 'الكثير من الأسئلة الآن. حاول مرة أخرى بعد دقيقة.', fail: 'عذرًا، لم أستطع الإجابة الآن. جرّب لاحقًا أو <a href="/" data-nesty-demo>اطلب عرضًا</a> وسنتواصل معك.',
      close: 'إغلاق', clear: 'محادثة جديدة',
      ex: page === 'parent.html' ? ['كيف أرسل ملاحظة غياب؟', 'كيف أرى أعمال طفلي في نستلينجز؟', 'كيف أحجز اجتماعًا مع المعلم؟']
                                 : ['ما هي نستوبيا؟', 'كيف تسجّل مدرستنا؟', 'ما هي نستلينجز؟'] }
    : { btn: 'Ask Nesty', title: 'Nesty · Nestopia helper', hello: 'Hi! 👋 I’m Nesty, the Nestopia helper. Ask me about the platform, the Parent Portal, Nestlings or how your school can get started.',
      ph: 'Type your question…', send: 'Send', note: 'AI answers can be wrong. Please don’t share personal or student details. Need more help? <a href="/" data-nesty-demo>Request a demo</a>.',
      wait: 'Thinking…', busy: 'Lots of questions right now. Please try again in a minute.', fail: 'Sorry, I can’t answer right now. Please try again later or <a href="/" data-nesty-demo>request a demo</a> and we’ll get back to you.',
      close: 'Close', clear: 'New chat',
      ex: page === 'parent.html' ? ['How do I send an absence note?', 'How do I see my child’s Nestlings work?', 'How do I book a teacher meeting?']
                                 : ['What is Nestopia?', 'How does our school sign up?', 'What is Nestlings?'] };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // light formatting: **bold**, bullets, line breaks, links to Nestopia pages only
  const fmt = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^\s*[-*•]\s+/gm, '• ')
    .replace(/(https:\/\/(?:www\.)?nestopia\.school\/[^\s<)]*)/g, '<a href="$1">$1</a>').replace(/\n/g, '<br>');
  let hist = [];
  try { hist = JSON.parse(sessionStorage.getItem('nesty_chat') || '[]'); } catch (_) {}
  const save = () => { try { sessionStorage.setItem('nesty_chat', JSON.stringify(hist.slice(-20))); } catch (_) {} };
  const BIRD = `<svg viewBox="0 0 120 110" aria-hidden="true"><path d="M40 20C56 2 86 8 90 36c3 18 14 30 22 42-16 7-38 12-56 8C34 82 23 62 27 44c2-10 6-18 13-24z" fill="#7BB3E6"/><path d="M29 33 12 29l15 11z" fill="#F2B544"/><circle cx="52" cy="34" r="5" fill="#33405A"/></svg>`;

  const css = `
  .nesty-btn{position:fixed;inset-inline-end:18px;bottom:18px;z-index:900;border:0;border-radius:30px;background:#33405A;color:#fff;font:inherit;font-weight:800;padding:7px 18px 7px 8px;box-shadow:0 8px 24px rgba(51,64,90,.3);cursor:pointer;display:flex;gap:8px;align-items:center}
  .nesty-btn:hover{background:#26314a}.nesty-btn:focus-visible{outline:3px solid #F2B544;outline-offset:2px}
  .nesty-box{position:fixed;inset-inline-end:18px;bottom:18px;z-index:901;width:min(380px,calc(100vw - 24px));height:min(560px,calc(100vh - 36px));background:#fff;border-radius:18px;box-shadow:0 18px 50px rgba(51,64,90,.35);display:flex;flex-direction:column;overflow:hidden;font-family:inherit}
  .nesty-box[hidden],.nesty-btn[hidden]{display:none}
  .nesty-head{background:#33405A;color:#fff;padding:12px 14px;display:flex;align-items:center;gap:10px}
  .nesty-head b{flex:1;font-size:1rem}.nesty-head button{background:none;border:0;color:#fff;font:inherit;cursor:pointer;font-size:.85rem;opacity:.9}
  .nesty-head .x{font-size:1.3rem;line-height:1}
  .nesty-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:#F7F9FD}
  .nesty-m{max-width:86%;padding:9px 12px;border-radius:14px;line-height:1.5;font-size:.95rem;color:#33405A;word-wrap:break-word}
  .nesty-m.bot{background:#fff;border:1px solid #E1E8F3;align-self:flex-start}.nesty-m.me{background:#7BB3E6;color:#1d2a40;align-self:flex-end}
  .nesty-m a{color:inherit;text-decoration:underline}.nesty-m.wait{opacity:.7;font-style:italic}
  .nesty-ex{display:flex;flex-wrap:wrap;gap:6px}.nesty-ex button{border:1px solid #C9D9EE;background:#fff;color:#33405A;border-radius:20px;padding:6px 10px;font:inherit;font-size:.82rem;cursor:pointer}
  .nesty-ex button:hover{border-color:#7BB3E6;background:#EEF5FC}
  .nesty-form{display:flex;gap:8px;padding:10px;border-top:1px solid #E1E8F3}
  .nesty-form input{flex:1;min-width:0;border:1px solid #D3DCE8;border-radius:12px;padding:10px 12px;font:inherit}
  .nesty-form button{border:0;background:#F2B544;color:#33405A;border-radius:12px;padding:0 14px;font:inherit;font-weight:800;cursor:pointer}
  .nesty-form button:disabled{opacity:.6}
  .nesty-note{font-size:.72rem;color:#6b7891;padding:0 12px 10px;margin:0}.nesty-note a{color:#33405A}
  .nesty-bird{flex:none;width:40px;height:40px;border-radius:50%;background:#fff;display:grid;place-items:center;box-shadow:0 2px 6px rgba(51,64,90,.15)}.nesty-bird svg{width:30px;height:28px}
  .nesty-head .nesty-bird{width:34px;height:34px}.nesty-head .nesty-bird svg{width:25px;height:23px}
  [dir=rtl] .nesty-btn{padding:7px 8px 7px 18px}[dir=rtl] .nesty-bird svg{transform:scaleX(-1)}
  @media print{.nesty-btn,.nesty-box{display:none!important}}
  @media(max-width:600px){.nesty-btn span{display:none}.nesty-btn,[dir=rtl] .nesty-btn{padding:7px}}`;

  function build() {
    if (document.getElementById('nesty-btn')) return;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    const b = document.createElement('button'); b.id = 'nesty-btn'; b.type = 'button'; b.className = 'nesty-btn';
    const box = document.createElement('section'); box.className = 'nesty-box'; box.hidden = true; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Nesty, the Nestopia helper');
    document.body.append(b, box);
    const paint = () => {
      const t = T(); b.innerHTML = `<i class="nesty-bird">${BIRD}</i><span>${t.btn}</span>`; b.setAttribute('aria-label', t.btn);
      box.dir = ar() ? 'rtl' : 'ltr';
      box.innerHTML = `<div class="nesty-head"><i class="nesty-bird">${BIRD}</i><b>${t.title}</b><button type="button" data-clear>${t.clear}</button><button type="button" class="x" data-close aria-label="${t.close}">✕</button></div>
        <div class="nesty-log" aria-live="polite"><div class="nesty-m bot">${t.hello}</div>${hist.length ? '' : `<div class="nesty-ex">${t.ex.map(q => `<button type="button" data-ex>${esc(q)}</button>`).join('')}</div>`}
          ${hist.map(m => `<div class="nesty-m ${m.role === 'user' ? 'me' : 'bot'}">${m.role === 'user' ? esc(m.text) : fmt(m.text)}</div>`).join('')}</div>
        <form class="nesty-form"><input type="text" maxlength="500" placeholder="${t.ph}" aria-label="${t.ph}"><button>${t.send}</button></form><p class="nesty-note">${t.note}</p>`;
      const log = box.querySelector('.nesty-log'); log.scrollTop = log.scrollHeight;
    };
    paint();
    // repaint the button when the page switches language (Parent Portal English/Arabic toggle)
    new MutationObserver(() => { if (box.hidden) paint(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    b.onclick = () => { paint(); box.hidden = false; b.hidden = true; const i = box.querySelector('input'); if (i) i.focus(); };
    async function ask(q) {
      const t = T(), log = box.querySelector('.nesty-log'), form = box.querySelector('form');
      const ex = box.querySelector('.nesty-ex'); if (ex) ex.remove();
      hist.push({ role: 'user', text: q }); save();
      log.insertAdjacentHTML('beforeend', `<div class="nesty-m me">${esc(q)}</div><div class="nesty-m bot wait">${t.wait}</div>`); log.scrollTop = log.scrollHeight;
      form.querySelector('button').disabled = true;
      let html = t.fail;
      try {
        const r = await fetch(FN, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: hist.slice(-10), page, who, lang: ar() ? 'ar' : 'en' }) });
        const j = await r.json().catch(() => ({}));
        if (j.answer) { hist.push({ role: 'assistant', text: j.answer }); html = fmt(j.answer); }
        else { hist.pop(); if (r.status === 429 || j.error === 'busy') html = t.busy; }
      } catch (_) { hist.pop(); }
      save();
      const w = log.querySelector('.wait'); if (w) { w.classList.remove('wait'); w.innerHTML = html; }
      form.querySelector('button').disabled = false; log.scrollTop = log.scrollHeight;
    }
    box.addEventListener('click', e => {
      if (e.target.closest('[data-close]')) { box.hidden = true; b.hidden = false; return; }
      if (e.target.closest('[data-clear]')) { hist = []; save(); paint(); return; }
      const d = e.target.closest('[data-nesty-demo]');
      if (d) { const btn = document.querySelector('[data-demo]'); if (btn) { e.preventDefault(); box.hidden = true; b.hidden = false; btn.click(); } return; }
      const ex = e.target.closest('[data-ex]'); if (ex) ask(ex.textContent);
    });
    box.addEventListener('submit', e => {
      e.preventDefault(); const i = box.querySelector('input'), q = i.value.trim(); if (!q) return;
      i.value = ''; ask(q);
    });
    box.addEventListener('keydown', e => { if (e.key === 'Escape') { box.hidden = true; b.hidden = false; b.focus(); } });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
