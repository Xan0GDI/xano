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
  const syncBtn = document.getElementById('syncBeatButton');
  const caret = document.querySelector('.caret');

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
          if (!bgAudioSaved && bgVideo) {
            bgAudioSaved = { muted: bgVideo.muted, volume: bgVideo.volume, gain: (gainNode ? gainNode.gain.value : null) };
            // Begin fade to silence
            if (audioCtx && gainNode) {
              const now = audioCtx.currentTime;
              gainNode.gain.cancelScheduledValues(now);
              gainNode.gain.setValueAtTime(gainNode.gain.value, now);
              gainNode.gain.linearRampToValueAtTime(0.0001, now + 0.35);
            } else {
              fadeElementVolume(bgVideo, 0, 350);
            }
            // After fade, ensure muted flag
            if (muteSafetyTimeout) { clearTimeout(muteSafetyTimeout); }
            muteSafetyTimeout = setTimeout(() => { try { bgVideo.muted = true; } catch(_){} }, 380);
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
        if (bgAudioSaved && bgVideo) {
          // Restore gain/volume smoothly
          const targetVol = Math.max(0, Math.min(1, bgAudioSaved.volume ?? 1));
          if (audioCtx && gainNode) {
            // Unmute immediately if it was unmuted before, so the ramp is audible
            if (!bgAudioSaved.muted) bgVideo.muted = false;
            const now = audioCtx.currentTime;
            gainNode.gain.cancelScheduledValues(now);
            gainNode.gain.setValueAtTime(gainNode.gain.value || 0.0001, now);
            const targetGain = (typeof bgAudioSaved.gain === 'number') ? bgAudioSaved.gain : 1;
            gainNode.gain.linearRampToValueAtTime(Math.max(0.0001, targetGain), now + 0.45);
          } else {
            // Unmute first if it was not originally muted
            if (!bgAudioSaved.muted) bgVideo.muted = false;
            fadeElementVolume(bgVideo, targetVol, 450);
          }
          // Finally restore muted flag to original state after the fade
          if (muteSafetyTimeout) { clearTimeout(muteSafetyTimeout); muteSafetyTimeout = null; }
          setTimeout(() => {
            try { bgVideo.muted = !!bgAudioSaved.muted; } catch(_){}
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
  // Disable Sync button when running from file:// to avoid CORS zeroes
  if (syncBtn && location.protocol === 'file:') {
    syncBtn.setAttribute('disabled', 'true');
    syncBtn.title = 'Run via http:// (local server) to enable audio sync';
  }

  // Keep audio graph single-instance to avoid MediaElementSourceNode duplication errors
  let audioCtx = null;
  let mediaSrc = null;
  let analyser = null;
  let gainNode = null; // for smooth volume fades when using AudioContext
  let audioDataArray = null;
  let audioBufferLen = 0;

  if (syncBtn && bgVideo) {
    syncBtn.addEventListener('click', async () => {
      try {
        if (location.protocol === 'file:') throw new Error('Audio analysis blocked on file://');
        syncBtn.setAttribute('aria-pressed', 'true');
        effectsEnabled = true; // user explicitly opted into effects

        // Ensure audible playback via the element itself
        bgVideo.removeAttribute('muted');
        bgVideo.muted = false;
        bgVideo.volume = 1;
        await bgVideo.play();

        // Create or reuse audio graph
        if (!audioCtx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          audioCtx = new AudioCtx();
        }
        if (audioCtx.state === 'suspended') await audioCtx.resume();

        if (!mediaSrc) {
          // IMPORTANT: only create once for a given HTMLMediaElement
          mediaSrc = audioCtx.createMediaElementSource(bgVideo);
          analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          audioBufferLen = analyser.frequencyBinCount;
          audioDataArray = new Uint8Array(audioBufferLen);
          // Tap into the graph for analysis AND ensure audible output via AudioContext
          gainNode = audioCtx.createGain();
          gainNode.gain.value = 1;
          mediaSrc.connect(analyser);
          mediaSrc.connect(gainNode);
          gainNode.connect(audioCtx.destination);
        }

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
      } catch (e) {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(tick);
        syncBtn.setAttribute('aria-pressed', 'false');
        console.warn('Audio sync failed:', e && e.message ? e.message : e);
      }
    });
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
