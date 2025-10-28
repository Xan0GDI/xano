document.addEventListener('DOMContentLoaded', function() {
  // Initialize AOS library for scroll animations
  AOS.init({ duration: 600, once: true });

  const body = document.body;
  const mobileNavToggle = document.querySelector('.mobile-nav-toggle');
  const navMenu = document.querySelector('.nav-menu');
  const navLinks = document.querySelectorAll('.nav-link');
  const modal = document.getElementById('projectModal');
  const sections = document.querySelectorAll('section[id]');
  const bgVideo = document.getElementById('bgVideo');
  const bgVideo2 = document.getElementById('bgVideo2');
  const syncBtn = document.getElementById('syncBeatButton');
  const bgPrevBtn = document.getElementById('bgPrev');
  const bgNextBtn = document.getElementById('bgNext');
  const bgMenuToggle = document.getElementById('bgMenuToggle');
  const bgMenu = document.getElementById('bgMenu');
  const bgList = document.getElementById('bgList');
  const bgSoundToggle = document.getElementById('bgSoundToggle');
  const tapHint = document.getElementById('tapHint');
  const bgContainer = document.querySelector('.bg');
  if (bgVideo2) { bgVideo2.style.display = 'none'; }
  let videoPool = new Map(); // key -> HTMLVideoElement
  const getActiveVideo = () => videoPool.get(BG_VARIANTS[bgIndex].key);
  const caret = document.querySelector('.caret');
  let userActivated = false; // becomes true after first user gesture

  // --- Body Scroll Lock ---
  const lockScroll = () => { body.classList.add('no-scroll'); };
  const unlockScroll = () => { if (!modal.classList.contains('show')) body.classList.remove('no-scroll'); };

  // --- Mobile Navigation Logic ---
  if (mobileNavToggle && navMenu) {
    mobileNavToggle.addEventListener('click', () => {
      const open = navMenu.classList.toggle('open');
      mobileNavToggle.classList.toggle('open');
      mobileNavToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) lockScroll(); else unlockScroll();
    });

    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        if (navMenu.classList.contains('open')) {
          navMenu.classList.remove('open');
          mobileNavToggle.classList.remove('open');
          mobileNavToggle.setAttribute('aria-expanded', 'false');
          unlockScroll();
        }
      });
    });
  }

  // --- Background video carousel (with preloading) ---
  const BG_VARIANTS = [
    { key: 'ricardo', webm: 'media/ricardo.webm', mp4: 'media/ricardo.mp4' },
    { key: 'bg',      webm: 'media/bg.webm',      mp4: 'media/bg.mp4'      },
    { key: 'scp',     webm: 'media/scp.webm',     mp4: 'media/scp.mp4'     },
    { key: 'bra',     webm: 'media/bra.webm',     mp4: 'media/bra.mp4'     }
  ];
  let bgIndex = 0; // ricardo by default

  function buildVideoElement(set, useExistingEl) {
    const v = useExistingEl || document.createElement('video');
    v.className = 'bg-video';
    v.playsInline = true; v.autoplay = true; v.loop = true; v.muted = true; v.crossOrigin = 'anonymous';
    v.style.opacity = '0'; v.style.pointerEvents = 'none';
    let sources = Array.from(v.querySelectorAll('source'));
    if (sources.length === 0) {
      const sWebm = document.createElement('source'); sWebm.type = 'video/webm';
      const sMp4  = document.createElement('source');  sMp4.type  = 'video/mp4';
      v.appendChild(sWebm); v.appendChild(sMp4); sources = [sWebm, sMp4];
    }
    sources.forEach(src => {
      if (src.type.includes('webm')) src.src = set.webm; else if (src.type.includes('mp4')) src.src = set.mp4;
    });
    v.preload = 'auto';
    try { v.load(); } catch(_) {}
    // Warm decoder: try a brief play then pause
    const p = v.play(); if (p && p.then) p.then(() => { try { v.pause(); v.currentTime = 0; } catch(_) {} }).catch(()=>{});
    if (!useExistingEl && bgContainer) bgContainer.appendChild(v);
    return v;
  }

  // Build all background videos in the background container, ready to show instantly
  (function buildPool() {
    // Ensure initial existing video becomes the first variant (ricardo)
    if (bgVideo) {
      videoPool.set('ricardo', buildVideoElement(BG_VARIANTS[0], bgVideo));
    }
    // Create the rest
    for (let i = 1; i < BG_VARIANTS.length; i++) {
      videoPool.set(BG_VARIANTS[i].key, buildVideoElement(BG_VARIANTS[i]));
    }
    // Show default
    const def = videoPool.get('ricardo');
    if (def) { def.style.opacity = '1'; try { def.play(); } catch(_) {} }
  })();

  // Tiny user‑gesture workaround to force autoplay muted
  function ensureAutoplayMuted() {
    const vids = Array.from(videoPool.values());
    vids.forEach(v => { try { v.muted = true; const p = v.play(); if (p && p.catch) p.catch(()=>{}); } catch(_) {} });
  }
  function onFirstGesture() {
    if (userActivated) return;
    userActivated = true;
    ensureAutoplayMuted();
    if (audioCtx && audioCtx.state === 'suspended') { try { audioCtx.resume(); } catch(_) {} }
    if (tapHint) { tapHint.classList.remove('show'); setTimeout(()=>{ try { tapHint.remove(); } catch(_) {} }, 350); }
    // Respect saved preference: if user previously enabled sound, enable it now
    if (localStorage.getItem('bgSound') === 'on') { setAudioEnabled(true); }
    window.removeEventListener('pointerdown', onFirstGesture);
    window.removeEventListener('keydown', onFirstGesture);
    window.removeEventListener('touchstart', onFirstGesture);
  }
  // Try programmatically first; if blocked, first gesture will unlock
  setTimeout(() => { ensureAutoplayMuted(); }, 100);
  window.addEventListener('pointerdown', onFirstGesture, { once: true });
  window.addEventListener('keydown', onFirstGesture, { once: true });
  window.addEventListener('touchstart', onFirstGesture, { once: true });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') ensureAutoplayMuted(); });
  // Show tap hint initially
  if (tapHint) { tapHint.classList.add('show'); }
  if (tapHint) { tapHint.addEventListener('click', onFirstGesture); }

  // Build BG list menu
  if (bgList) {
    bgList.innerHTML = '';
    BG_VARIANTS.forEach((v, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = v.key;
      btn.dataset.key = v.key;
      btn.addEventListener('click', async () => { await crossfadeToIndex(bgIndex, i); bgIndex = i; updateMenuActive(); });
      bgList.appendChild(btn);
    });
    updateMenuActive();
  }

  // Menu toggle and prev/next
  if (bgMenuToggle && bgMenu) {
    const toggleMenu = () => {
      const open = !bgMenu.classList.contains('open');
      bgMenu.classList.toggle('open', open);
      bgMenuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    bgMenuToggle.addEventListener('click', (e)=>{ e.stopPropagation(); toggleMenu(); });
    document.addEventListener('click', (e) => {
      if (!bgMenu.contains(e.target) && e.target !== bgMenuToggle) {
        bgMenu.classList.remove('open');
        bgMenuToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }
  if (bgPrevBtn) bgPrevBtn.addEventListener('click', () => { go(-1); updateMenuActive(); });
  if (bgNextBtn) bgNextBtn.addEventListener('click', () => { go(1); updateMenuActive(); });

  function updateMenuActive() {
    if (!bgList) return;
    const items = bgList.querySelectorAll('button[data-key]');
    items.forEach(btn => {
      if (btn.dataset.key === BG_VARIANTS[bgIndex].key) btn.classList.add('active');
      else btn.classList.remove('active');
    });
  }
  const mediaSrcMap = new WeakMap();
  function rebindAudioTo(element) {
    if (!audioCtx || !element) return;
    try { if (mediaSrc) { mediaSrc.disconnect(); } } catch(_) {}
    try {
      let node = mediaSrcMap.get(element);
      if (!node) { node = audioCtx.createMediaElementSource(element); mediaSrcMap.set(element, node); }
      mediaSrc = node;
      if (!analyser) { analyser = audioCtx.createAnalyser(); analyser.fftSize = 256; audioBufferLen = analyser.frequencyBinCount; audioDataArray = new Uint8Array(audioBufferLen); }
      if (!gainNode) { gainNode = audioCtx.createGain(); gainNode.gain.value = 1; }
      mediaSrc.connect(analyser);
      mediaSrc.connect(gainNode);
      if (!gainNode.context) { gainNode = audioCtx.createGain(); gainNode.gain.value = 1; }
      try { gainNode.connect(audioCtx.destination); } catch(_) {}
    } catch(e) { console.warn('Audio rebind failed:', e && e.message ? e.message : e); }
  }

  async function crossfadeToIndex(prevIndex, newIndex) {
    const currentKey = BG_VARIANTS[prevIndex].key;
    const nextKey = BG_VARIANTS[newIndex].key;
    const currentEl = videoPool.get(currentKey);
    const nextEl = videoPool.get(nextKey);
    if (!nextEl) return;
    try { const p = nextEl.play(); if (p && p.catch) p.catch(()=>{}); } catch(_) {}
    // If sync/audioCtx is active, rebind to the new element
    if (audioEnabled) { rebindAudioTo(nextEl); nextEl.muted = false; } else { nextEl.muted = true; }
    nextEl.style.opacity = '1';
    if (currentEl && currentEl !== nextEl) {
      currentEl.style.opacity = '0';
      // Ensure old audio stops
      try { currentEl.pause(); } catch(_) {}
    }
  }
  async function go(delta) {
    const prev = bgIndex;
    bgIndex = (bgIndex + delta + BG_VARIANTS.length) % BG_VARIANTS.length;
    await crossfadeToIndex(prev, bgIndex);
    updateBgLabel();
  }
  

  // --- Modal Logic ---
  if (modal) {
    const closeButton = modal.querySelector('.close-button');
    const modalTitle = modal.querySelector('#modalTitle');
    const modalDescription = modal.querySelector('#modalDescription');
    const modalTechList = modal.querySelector('#modalTech');
    const modalYoutubeContainer = modal.querySelector('.video-container');
    const modalYoutubeIframe = modal.querySelector('#modalYoutube');
    const modalFallback = document.getElementById('modalFallback');
    const modalYoutubeLink = document.getElementById('modalYoutubeLink');
    const projectCards = document.querySelectorAll('.card');

    // YouTube API loader (for reliable error handling)
    let ytPlayer = null;
    let ytApiReadyPromise = null;
    function loadYouTubeAPIOnce() {
      if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
      if (!ytApiReadyPromise) {
        ytApiReadyPromise = new Promise((resolve) => {
          const tag = document.createElement('script');
          tag.src = 'https://www.youtube.com/iframe_api';
          document.head.appendChild(tag);
          window.onYouTubeIframeAPIReady = () => resolve(window.YT);
        });
      }
      return ytApiReadyPromise;
    }

    // Smooth fades for background audio
    let volFadeRAF = null;
    let muteSafetyTimeout = null;
    function fadeElementVolume(el, to, ms) {
      if (!el) return;
      if (volFadeRAF) cancelAnimationFrame(volFadeRAF);
      const from = el.volume;
      const startT = performance.now();
      const step = (t) => {
        const k = Math.min(1, (t - startT) / ms);
        el.volume = from + (to - from) * k;
        if (k < 1) volFadeRAF = requestAnimationFrame(step); else volFadeRAF = null;
      };
      volFadeRAF = requestAnimationFrame(step);
    }

    // Normalize various YouTube inputs to a canonical 11-char ID
    const extractYouTubeId = (val) => {
      if (!val) return null;
      const trimmed = String(val).trim();
      if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
      try {
        const u = new URL(trimmed);
        if (u.hostname.includes('youtu.be')) {
          const id = u.pathname.replace(/^\//,'');
          if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
        }
        if (u.hostname.includes('youtube.com')) {
          const idParam = u.searchParams.get('v');
          if (idParam && /^[a-zA-Z0-9_-]{11}$/.test(idParam)) return idParam;
          const parts = u.pathname.split('/');
          const last = parts[parts.length - 1];
          if (/^[a-zA-Z0-9_-]{11}$/.test(last)) return last;
        }
      } catch (_) {}
      return null;
    };

    // Track background video audio state so we can fade/mute while a YT modal is open
    let bgAudioSaved = null; // { muted:boolean, volume:number, gain:number|null }

    const openModal = (card) => {
      const title = card.dataset.title || 'Project Details';
      const description = card.dataset.description || 'No description available.';
      const tech = card.dataset.tech || '';
      const youtubeId = extractYouTubeId(card.dataset.youtube);

      modalTitle.textContent = title;
      modalDescription.textContent = description;

      // Populate technologies
      modalTechList.innerHTML = '';
      if (tech) {
        tech.split(',').forEach(techName => {
          const li = document.createElement('li');
          li.textContent = techName.trim();
          modalTechList.appendChild(li);
        });
      }

      // Reset states
      modalFallback.style.display = 'none';
      if (ytPlayer) { try { ytPlayer.destroy(); } catch(_){} ytPlayer = null; }

      if (youtubeId) {
        // Save and fade-out background audio, then mute the element as safety
        try {
          const activeBg = getActiveVideo();
          if (!bgAudioSaved && activeBg) {
            bgAudioSaved = { muted: activeBg.muted, volume: activeBg.volume, gain: (gainNode ? gainNode.gain.value : null) };
            // Begin fade to silence
            if (audioCtx && gainNode) {
              const now = audioCtx.currentTime;
              gainNode.gain.cancelScheduledValues(now);
              gainNode.gain.setValueAtTime(gainNode.gain.value, now);
              gainNode.gain.linearRampToValueAtTime(0.0001, now + 0.35);
            } else {
              fadeElementVolume(activeBg, 0, 350);
            }
            // After fade, ensure muted flag
            if (muteSafetyTimeout) { clearTimeout(muteSafetyTimeout); }
            muteSafetyTimeout = setTimeout(() => { try { activeBg.muted = true; } catch(_){} }, 380);
          }
        } catch(_) {}

        // 1) Set direct embed URL immediately so the iframe isn't blank
        const originParam = (location.origin && location.origin.startsWith('http')) ? `&origin=${encodeURIComponent(location.origin)}` : '';
        const embedUrl = `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1&playsinline=1&mute=1&enablejsapi=1${originParam}`;
        modalYoutubeIframe.src = embedUrl;
        modalYoutubeContainer.style.display = 'block';

        // 2) Try to enhance with the IFrame API for better error handling
        let fallbackTimer = setTimeout(() => {
          // If API didn't attach and still blank, show fallback link
          try {
            const doc = modalYoutubeIframe.contentDocument;
            if (!doc || doc.location.href === 'about:blank') {
              modalYoutubeContainer.style.display = 'none';
              if (modalYoutubeLink) modalYoutubeLink.href = `https://www.youtube.com/watch?v=${youtubeId}`;
              modalFallback.style.display = 'block';
            }
          } catch (_) {}
        }, 2000);

        loadYouTubeAPIOnce().then((YT) => {
          if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
          ytPlayer = new YT.Player('modalYoutube', {
            width: '560', height: '315', videoId: youtubeId,
            host: 'https://www.youtube.com',
            playerVars: {
              autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1, mute: 1,
              origin: (location.origin.startsWith('http')) ? location.origin : undefined,
              enablejsapi: 1
            },
            events: {
              onReady: (e) => { try { e.target.mute(); e.target.playVideo(); } catch(_){} },
              onError: () => {
                // Fallback: show direct link on youtube.com
                modalYoutubeContainer.style.display = 'none';
                if (modalYoutubeLink) modalYoutubeLink.href = `https://www.youtube.com/watch?v=${youtubeId}`;
                modalFallback.style.display = 'block';
              }
            }
          });
        }).catch(() => {
          if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
          // API failed; show fallback link
          modalYoutubeContainer.style.display = 'none';
          if (modalYoutubeLink) modalYoutubeLink.href = `https://www.youtube.com/watch?v=${youtubeId}`;
          modalFallback.style.display = 'block';
        });
      } else {
        modalYoutubeContainer.style.display = 'none';
      }

      modal.classList.add('show');
      lockScroll();
    };

    const closeModal = () => {
      modal.classList.remove('show');
      try { if (ytPlayer) { ytPlayer.stopVideo(); ytPlayer.destroy(); } } catch(_){}
      ytPlayer = null;
      modalYoutubeIframe.src = '';
      modalFallback.style.display = 'none';
      // Restore background video audio state if we muted it
      try {
        const activeBg = getActiveVideo();
        if (bgAudioSaved && activeBg) {
          // Restore gain/volume smoothly
          const targetVol = Math.max(0, Math.min(1, bgAudioSaved.volume ?? 1));
          if (audioCtx && gainNode) {
            // Unmute immediately if it was unmuted before, so the ramp is audible
            if (!bgAudioSaved.muted) activeBg.muted = false;
            const now = audioCtx.currentTime;
            gainNode.gain.cancelScheduledValues(now);
            gainNode.gain.setValueAtTime(gainNode.gain.value || 0.0001, now);
            const targetGain = (typeof bgAudioSaved.gain === 'number') ? bgAudioSaved.gain : 1;
            gainNode.gain.linearRampToValueAtTime(Math.max(0.0001, targetGain), now + 0.45);
          } else {
            // Unmute first if it was not originally muted
            if (!bgAudioSaved.muted) activeBg.muted = false;
            fadeElementVolume(activeBg, targetVol, 450);
          }
          // Finally restore muted flag to original state after the fade
          if (muteSafetyTimeout) { clearTimeout(muteSafetyTimeout); muteSafetyTimeout = null; }
          setTimeout(() => {
            try { activeBg.muted = !!bgAudioSaved.muted; } catch(_){}
          }, 480);
        }
        bgAudioSaved = null;
      } catch(_) {}
      if (!navMenu || !navMenu.classList.contains('open')) unlockScroll();
    };

    projectCards.forEach(card => { card.addEventListener('click', () => openModal(card)); });
    closeButton.addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
  }

  // --- Active Nav Link on Scroll (Scrollspy) ---
  const scrollSpy = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const id = entry.target.getAttribute('id');
      const activeLink = document.querySelector(`.nav-menu a[href="#${id}"]`);
      if (entry.isIntersecting) {
        navLinks.forEach(link => link.classList.remove('active'));
        if (activeLink) activeLink.classList.add('active');
      }
    });
  }, { rootMargin: '-50% 0px -50% 0px', threshold: 0 });
  sections.forEach(section => scrollSpy.observe(section));

  // --- Bottom sentinel handling ---
  const bottomSentinel = document.getElementById('page-bottom-sentinel');
  if (bottomSentinel) {
    const bottomObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        navLinks.forEach(link => link.classList.remove('active'));
        const lastLink = document.querySelector('.nav-menu li:last-child a');
        if (lastLink) lastLink.addEventListener('animationend', ()=>{}, { once:true });
        if (lastLink) lastLink.classList.add('active');
      }
    }, { threshold: 1.0 });
    bottomObserver.observe(bottomSentinel);
  }

  // --- Beat metronome for subtle flashing ---
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let effectsEnabled = !prefersReduced; // allow user override via Sync
  let rafId = null;
  let start = performance.now();
  let bpm = 120; // default pulse

  const tick = (t) => {
    const elapsed = (t - start) / 1000; // seconds
    const phase = (elapsed * bpm) / 60 * Math.PI * 2; // radians
    const s = Math.sin(phase);
    // Ease and clamp the flash intensity (0..1)
    const intensity = Math.max(0, s);
    // Add a small floor to keep it breathing
    const eased = Math.min(1, 0.12 + 0.35 * Math.pow(intensity, 1.6));
    document.documentElement.style.setProperty('--flash', effectsEnabled ? eased.toFixed(3) : '0');
    // Blink caret (~0.8s cycle), combine with flash intensity
    if (caret) {
      const blink = (Math.sin(elapsed * (Math.PI * 2) / 0.8) > 0) ? 1 : 0.25;
      const caretOpacity = prefersReduced ? 0.85 : Math.max(0.25, Math.min(1, blink * (0.6 + 0.6 * eased)));
      caret.style.opacity = caretOpacity.toFixed(2);
    }
    rafId = requestAnimationFrame(tick);
  };
  if (!prefersReduced) rafId = requestAnimationFrame(tick);

  // Optional: sync to audio energy from the video after user gesture
  // Keep audio graph single-instance to avoid MediaElementSourceNode duplication errors
  let audioCtx = null;
  let mediaSrc = null;
  let analyser = null;
  let gainNode = null; // for smooth volume fades when using AudioContext
  let audioDataArray = null;
  let audioBufferLen = 0;
  let audioEnabled = (localStorage.getItem('bgSound') === 'on');

  function updateSoundUI() {
    if (bgSoundToggle) {
      bgSoundToggle.textContent = audioEnabled ? 'Sound On' : 'Sound Off';
      bgSoundToggle.setAttribute('aria-pressed', audioEnabled ? 'true' : 'false');
      if (audioEnabled) bgSoundToggle.classList.add('active'); else bgSoundToggle.classList.remove('active');
    }
  }

  function startAudioSyncLoop() {
    if (!analyser) return;
    if (rafId) cancelAnimationFrame(rafId);
    const audioTick = () => {
      analyser.getByteFrequencyData(audioDataArray);
      const bins = Math.max(1, Math.floor(audioBufferLen * 0.25));
      let sum = 0;
      for (let i = 1; i < bins; i++) sum += audioDataArray[i];
      const avg = sum / bins; // 0..255
      const norm = avg / 255; // 0..1
      const eased = Math.min(1, 0.12 + 0.55 * Math.pow(norm, 1.2));
      document.documentElement.style.setProperty('--flash', effectsEnabled ? eased.toFixed(3) : '0');
      if (caret) {
        const blink = (Math.sin((performance.now()-start)/1000 * (Math.PI * 2) / 0.8) > 0) ? 1 : 0.25;
        const caretOpacity = prefersReduced ? 0.85 : Math.max(0.25, Math.min(1, blink * (0.6 + 0.6 * eased)));
        caret.style.opacity = caretOpacity.toFixed(2);
      }
      rafId = requestAnimationFrame(audioTick);
    };
    rafId = requestAnimationFrame(audioTick);
  }

  async function setAudioEnabled(on) {
    audioEnabled = !!on;
    localStorage.setItem('bgSound', audioEnabled ? 'on' : 'off');
    updateSoundUI();
    const active = getActiveVideo();
    if (!active) return;
    if (!audioEnabled) {
      // Mute all and go back to metronome
      Array.from(videoPool.values()).forEach(v => { try { v.muted = true; } catch(_) {} });
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      rafId = requestAnimationFrame(tick);
      try { if (mediaSrc) mediaSrc.disconnect(); } catch(_) {}
      return;
    }
    try {
      active.muted = false; active.volume = 1; await active.play();
      if (!audioCtx && location.protocol !== 'file:') {
        const AudioCtx = window.AudioContext || window.webkitAudioContext; audioCtx = new AudioCtx();
      }
      if (audioCtx) { if (audioCtx.state === 'suspended') await audioCtx.resume(); rebindAudioTo(active); startAudioSyncLoop(); }
    } catch(e) { console.warn('Enable audio failed:', e && e.message ? e.message : e); }
  }

  if (bgSoundToggle) {
    bgSoundToggle.addEventListener('click', async () => { await setAudioEnabled(!audioEnabled); });
    updateSoundUI();
  }

  // --- Typewriter effect for the hero title (once) ---
  const titleEl = document.querySelector('.hero-title');
  if (titleEl && !prefersReduced) {
    const caretEl = titleEl.querySelector('.caret');
    // Extract text excluding caret
    const fullText = Array.from(titleEl.childNodes)
      .filter(n => n.nodeType === Node.TEXT_NODE)
      .map(n => n.textContent)
      .join('').trim();
    if (fullText) {
      // Clear text and type
      titleEl.childNodes.forEach(n => { if (n.nodeType === Node.TEXT_NODE) n.textContent = ''; });
      let i = 0;
      const type = () => {
        if (i <= fullText.length) {
          // Update text node (create if needed)
          if (!titleEl.firstChild || titleEl.firstChild.nodeType !== Node.TEXT_NODE) {
            titleEl.insertBefore(document.createTextNode(''), titleEl.firstChild);
          }
          titleEl.firstChild.textContent = fullText.slice(0, i);
          i += Math.random() < 0.15 ? 2 : 1; // occasional double-step
          setTimeout(type, 28 + Math.random() * 60);
        }
      };
      type();
      if (caretEl) titleEl.appendChild(caretEl); // ensure caret stays last
    }
  }

  // --- Global Keydown Listener ---
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (modal && modal.classList.contains('show')) {
        modal.querySelector('.close-button').click();
      } else if (navMenu && navMenu.classList.contains('open')) {
        mobileNavToggle.click();
      }
    }
  });
});




