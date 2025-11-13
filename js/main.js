document.addEventListener('DOMContentLoaded', () => {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointerQuery = window.matchMedia ? window.matchMedia('(pointer: fine)') : { matches: false };
  const isPrecisePointer = (evt) => !evt || !evt.pointerType || evt.pointerType === 'mouse' || evt.pointerType === 'pen';

  // ------------------------------
  // Generative background (monochrome flow field)
  // ------------------------------
  const canvas = document.getElementById('bgCanvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  let dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  let width = 0, height = 0;
  let rafId = null;
  let particles = [];
  let t = 0; // time for noise scrolling
  let lastT = performance.now();

  function resize() {
    dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    width = Math.floor(window.innerWidth * dpr);
    height = Math.floor(window.innerHeight * dpr);
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${Math.floor(width/dpr)}px`;
    canvas.style.height = `${Math.floor(height/dpr)}px`;
    if (!ctx) return;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0,0,width,height);
  }
  resize();
  // Debounce resize to avoid reinit thrash
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    resize();
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { initParticles(true); }, 120);
  });

  // Lightweight 2D Perlin noise implementation
  const p = new Uint8Array(512);
  const perm = new Uint8Array(256);
  for (let i=0;i<256;i++) perm[i] = i;
  for (let i=255;i>0;i--) { const j = (Math.random()* (i+1))|0; const tmp=perm[i]; perm[i]=perm[j]; perm[j]=tmp; }
  for (let i=0;i<512;i++) p[i] = perm[i & 255];
  function fade(n){return n*n*n*(n*(n*6-15)+10);} // smootherstep
  function lerp(a,b,t){return a+(b-a)*t;}
  function grad(hash,x,y){
    switch(hash & 3){
      case 0: return  x + y;
      case 1: return -x + y;
      case 2: return  x - y;
      default:return -x - y;
    }
  }
  function perlin2(x,y){
    const X = Math.floor(x) & 255; const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x); const yf = y - Math.floor(y);
    const u = fade(xf); const v = fade(yf);
    const aa = p[p[X]+Y], ab = p[p[X]+Y+1];
    const ba = p[p[X+1]+Y], bb = p[p[X+1]+Y+1];
    const x1 = lerp(grad(aa, xf,   yf),   grad(ba, xf-1, yf),   u);
    const x2 = lerp(grad(ab, xf,   yf-1), grad(bb, xf-1, yf-1), u);
    return (lerp(x1,x2,v)+1)/2; // 0..1
  }

  function initParticles(fromResize=false) {
    // Use CSS pixel area for stable counts across DPR
    const cssArea = window.innerWidth * window.innerHeight;
    const base = Math.floor(cssArea / 9000);
    const count = Math.max(140, Math.min(460, base));
    particles = new Array(count).fill(0).map(() => ({
      x: Math.random()*width,
      y: Math.random()*height,
      s: 0.4 + Math.random()*0.9, // speed factor
      a: Math.random()*Math.PI*2,
      life: 0
    }));
    if (fromResize) {
      // Clear immediately to avoid ghost trails on size jumps
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0,0,width,height);
    }
  }
  initParticles();

  function step(now = performance.now()) {
    // Compute time delta and clamp
    const dt = Math.max(0, Math.min(100, now - lastT));
    lastT = now;
    // subtle fade to create trails
    ctx.globalCompositeOperation = 'source-over';
    // Adjust fade by delta time to keep consistent motion on slow frames
    const fade = Math.max(0.04, Math.min(0.12, 0.06 * (dt / 16)));
    ctx.fillStyle = `rgba(10,10,10,${fade.toFixed(3)})`;
    ctx.fillRect(0,0,width,height);

    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 0.7 * dpr;

    const scale = 0.0016 * dpr; // noise scale
    const flow = 4.2; // angle multiplier

    for (let i=0;i<particles.length;i++){
      const p = particles[i];
      const nx = p.x * scale, ny = p.y * scale;
      const n = perlin2(nx + t*0.08, ny - t*0.05); // 0..1
      const angle = (n * Math.PI * 2) * flow;
      const vx = Math.cos(angle) * p.s;
      const vy = Math.sin(angle) * p.s;

      const ox = p.x, oy = p.y;
      p.x += vx; p.y += vy; p.life++;

      if (p.x < -5 || p.x > width+5 || p.y < -5 || p.y > height+5 || p.life > 1200){
        p.x = Math.random()*width; p.y = Math.random()*height; p.life = 0;
      }

      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }

    t += 0.0025 * (dt / 16); // time advance scaled to delta
    rafId = requestAnimationFrame(step);
  }

  if (!prefersReduced) {
    step();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { cancelAnimationFrame(rafId); rafId = null; }
      else if (!rafId) { lastT = performance.now(); rafId = requestAnimationFrame(step); }
    });
  } else {
    // Static background
    ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0,0,width,height);
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i=0;i<120;i++) { ctx.fillRect(Math.random()*width, Math.random()*height, 1, 1); }
  }

  // ------------------------------
  // Custom cursor (fine pointers only)
  // ------------------------------
  let teardownCursor = null;
  function activateCursor() {
    if (teardownCursor || !finePointerQuery.matches) return;
    const dot = document.createElement('div');
    dot.className = 'cursor-dot';
    const ring = document.createElement('div');
    ring.className = 'cursor-ring';
    document.body.appendChild(ring);
    document.body.appendChild(dot);
    document.body.classList.add('has-custom-cursor');

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let ringX = targetX;
    let ringY = targetY;
    let raf;

    const setDot = (x, y) => {
      dot.style.left = `${x}px`;
      dot.style.top = `${y}px`;
    };
    const setRing = (x, y) => {
      ring.style.left = `${x}px`;
      ring.style.top = `${y}px`;
    };
    setDot(targetX, targetY);
    setRing(ringX, ringY);

    const setVisible = (state) => {
      dot.classList.toggle('visible', state);
      ring.classList.toggle('visible', state);
    };

    const move = (e) => {
      if (!isPrecisePointer(e)) return;
      targetX = e.clientX;
      targetY = e.clientY;
      setDot(targetX, targetY);
      setVisible(true);
    };

    const animate = () => {
      ringX += (targetX - ringX) * 0.2;
      ringY += (targetY - ringY) * 0.2;
      setRing(ringX, ringY);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const leave = (e) => {
      if (!isPrecisePointer(e)) return;
      if (!e.relatedTarget) setVisible(false);
    };
    const blur = () => setVisible(false);

    const down = (e) => { if (isPrecisePointer(e)) ring.classList.add('pressed'); };
    const up = () => ring.classList.remove('pressed');

    const interactiveSelectors = 'a, button, .tile, .close-button';
    const over = (e) => {
      if (!isPrecisePointer(e)) return;
      if (e.target.closest(interactiveSelectors)) ring.classList.add('hover');
    };
    const out = (e) => {
      if (!isPrecisePointer(e)) return;
      const leavingInteractive = e.target.closest(interactiveSelectors) &&
        (!e.relatedTarget || !e.relatedTarget.closest(interactiveSelectors));
      if (leavingInteractive) ring.classList.remove('hover');
    };

    document.addEventListener('pointermove', move);
    document.body.addEventListener('pointerleave', leave);
    window.addEventListener('blur', blur);
    document.addEventListener('pointerdown', down);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointerover', over);
    document.addEventListener('pointerout', out);

    teardownCursor = () => {
      cancelAnimationFrame(raf);
      document.body.classList.remove('has-custom-cursor');
      dot.remove();
      ring.remove();
      document.removeEventListener('pointermove', move);
      document.body.removeEventListener('pointerleave', leave);
      window.removeEventListener('blur', blur);
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointerover', over);
      document.removeEventListener('pointerout', out);
      teardownCursor = null;
    };
  }
  if (finePointerQuery.matches) activateCursor();
  const pointerChange = (e) => {
    if (e.matches) activateCursor();
    else if (teardownCursor) teardownCursor();
  };
  if (typeof finePointerQuery.addEventListener === 'function') {
    finePointerQuery.addEventListener('change', pointerChange);
  } else if (typeof finePointerQuery.addListener === 'function') {
    finePointerQuery.addListener(pointerChange);
  }

  // ------------------------------
  // Dock nav: scroll spy + mobile toggle
  // ------------------------------
  const nav = document.getElementById('nav');
  const dockLinks = Array.from(document.querySelectorAll('.dock-link'));
  const sections = ['intro','work'].map(id => document.getElementById(id)).filter(Boolean);

  const spy = new IntersectionObserver((entries)=>{
    entries.forEach(entry => {
      const id = entry.target.getAttribute('id');
      if (entry.isIntersecting) {
        dockLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#${id}`));
      }
    });
  }, { rootMargin: '-50% 0px -50% 0px', threshold: 0 });
  sections.forEach(s => spy.observe(s));

  const dockToggle = document.querySelector('.dock-toggle');
  if (dockToggle && nav) {
    const setExpanded = (open) => dockToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    dockToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = nav.classList.toggle('open');
      setExpanded(open);
      document.body.style.overflow = open ? 'hidden' : '';
    });
    document.addEventListener('click', (e) => {
      if (!nav.contains(e.target) && e.target !== dockToggle) {
        nav.classList.remove('open');
        setExpanded(false);
        document.body.style.overflow = '';
      }
    });
    // Close on link click (mobile UX)
    dockLinks.forEach(a => a.addEventListener('click', () => {
      nav.classList.remove('open');
      setExpanded(false);
      document.body.style.overflow = '';
    }));
  }

  // ------------------------------
  // Reveal effects
  // ------------------------------
  const revealEls = Array.from(document.querySelectorAll('.reveal'));
  const revObs = new IntersectionObserver((entries)=>{
    entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('is-visible'); });
  }, { threshold: 0.1 });
  revealEls.forEach(el => revObs.observe(el));

  // ------------------------------
  // Modal (YouTube embed with nocookie + fallback)
  // ------------------------------
  const modal = document.getElementById('projectModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalDesc = document.getElementById('modalDescription');
  const modalTech = document.getElementById('modalTech');
  const modalYoutube = document.getElementById('modalYoutube');
  const modalFallback = document.getElementById('modalFallback');
  const modalFallbackText = document.getElementById('modalFallbackText');
  const modalYoutubeLink = document.getElementById('modalYoutubeLink');
  const closeBtn = modal.querySelector('.close-button');
  const tiles = Array.from(document.querySelectorAll('.tile'));

  if (!prefersReduced) {
    tiles.forEach(tile => {
      tile.addEventListener('pointermove', (e) => {
        if (!isPrecisePointer(e)) return;
        const rect = tile.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        tile.style.setProperty('--mx', `${x}%`);
        tile.style.setProperty('--my', `${y}%`);
      });
      tile.addEventListener('pointerleave', () => {
        tile.style.removeProperty('--mx');
        tile.style.removeProperty('--my');
      });
    });
  }

  // Create desc placeholder element if missing
  if (!modalDesc) {
    const p = document.createElement('p');
    p.id = 'modalDescription';
    modal.querySelector('.modal-details').prepend(p);
  }

  function extractYouTubeId(val){
    if (!val) return null;
    const s = String(val).trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
    try {
      const u = new URL(s);
      if (u.hostname.includes('youtu.be')) return u.pathname.replace(/^\//,'');
      if (u.hostname.includes('youtube.com')) {
        const v = u.searchParams.get('v'); if (v) return v;
      }
    } catch(_){}
    return null;
  }

  function openModal(from) {
    const title = from.dataset.title || 'Project';
    const desc = from.dataset.description || '';
    const tech = (from.dataset.tech || '').split(',').map(s => s.trim()).filter(Boolean);
    const ytid = extractYouTubeId(from.dataset.youtube);

    modalTitle.textContent = title;
    document.getElementById('modalDescription').textContent = desc;
    modalTech.innerHTML = '';
    tech.forEach(t => { const li = document.createElement('li'); li.textContent = t; modalTech.appendChild(li); });

    modalFallback.style.display = 'none';
    modalYoutube.src = '';

    if (ytid) {
      const url = `https://www.youtube-nocookie.com/embed/${ytid}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1`;
      modalYoutube.parentElement.style.display = 'block';
      // Use load event for a smooth reveal; no cross-origin peeking
      const onLoad = () => { modalYoutube.removeEventListener('load', onLoad); };
      modalYoutube.addEventListener('load', onLoad);
      modalYoutube.src = url;
    } else {
      modalYoutube.parentElement.style.display = 'none';
      modalFallback.style.display = 'block';
      const fallbackCopy = from.dataset.fallback || 'Video unavailable.';
      if (modalFallbackText) modalFallbackText.textContent = fallbackCopy;
      const fallbackLink = from.dataset.fallbackLink;
      if (fallbackLink) {
        modalYoutubeLink.style.display = '';
        modalYoutubeLink.textContent = from.dataset.fallbackLinkLabel || 'Open link';
        modalYoutubeLink.href = fallbackLink;
      } else {
        modalYoutubeLink.removeAttribute('href');
        modalYoutubeLink.style.display = 'none';
      }
    }

    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    try { modalYoutube.src = ''; } catch(_){}
    document.body.style.overflow = '';
  }

  tiles.forEach(tile => tile.addEventListener('click', () => openModal(tile)));
  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e)=>{ if (e.target === modal) closeModal(); });
  window.addEventListener('keydown', (e)=>{ if (e.key === 'Escape' && modal.classList.contains('show')) closeModal(); });
});
