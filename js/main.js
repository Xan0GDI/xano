document.addEventListener('DOMContentLoaded', () => {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointerQuery = window.matchMedia('(pointer: fine)');
  const isPrecisePointer = (evt) => !evt || !evt.pointerType || evt.pointerType === 'mouse' || evt.pointerType === 'pen';

  const pointer = { targetX: 0, targetY: 0, x: 0, y: 0 };
  const updatePointer = (event) => {
    if (!isPrecisePointer(event)) return;
    const nx = (event.clientX / window.innerWidth) * 2 - 1;
    const ny = (event.clientY / window.innerHeight) * 2 - 1;
    pointer.targetX = Math.max(-1, Math.min(1, nx));
    pointer.targetY = Math.max(-1, Math.min(1, ny));
    if (prefersReduced) updateDepthTargets(true);
  };
  document.addEventListener('pointermove', updatePointer);

  // Layered parallax stack
  const captureBaseTransform = (el) => {
    const previous = el.style.transform;
    el.style.transform = '';
    const computed = window.getComputedStyle(el).transform;
    el.style.transform = previous;
    return computed && computed !== 'none' ? computed : '';
  };
  const depthTargets = Array.from(document.querySelectorAll('[data-depth]')).map((el) => ({
    el,
    depth: parseFloat(el.dataset.depth) || 0,
    base: captureBaseTransform(el)
  }));
  const depthState = { x: 0, y: 0 };
  const updateDepthTargets = (instant = false) => {
    if (!depthTargets.length) return;
    if (instant) {
      depthState.x = pointer.targetX;
      depthState.y = pointer.targetY;
    } else {
      depthState.x += (pointer.targetX - depthState.x) * 0.08;
      depthState.y += (pointer.targetY - depthState.y) * 0.08;
    }
    depthTargets.forEach((target) => {
      const tx = depthState.x * target.depth * 120;
      const ty = depthState.y * target.depth * 70;
      target.el.style.transform = target.base
        ? `${target.base} translate3d(${tx}px, ${ty}px, 0)`
        : `translate3d(${tx}px, ${ty}px, 0)`;
    });
  };

  // 3D starfield background
  const canvas = document.getElementById('bgCanvas');
  const ctx = canvas?.getContext('2d', { alpha: false });
  let width = 0;
  let height = 0;
  let dpr = 1;
  let stars = [];
  let rafId = null;

  const makeStar = () => ({
    x: Math.random() * 2 - 1,
    y: Math.random() * 2 - 1,
    z: Math.random() * 0.9 + 0.1,
    speed: 0.0006 + Math.random() * 0.0018
  });

  const resizeCanvas = () => {
    if (!canvas || !ctx) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    width = Math.floor(window.innerWidth * dpr);
    height = Math.floor(window.innerHeight * dpr);
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${Math.floor(width / dpr)}px`;
    canvas.style.height = `${Math.floor(height / dpr)}px`;
  };

  const initStars = () => {
    if (!canvas || !ctx) return;
    const area = window.innerWidth * window.innerHeight;
    const count = Math.max(220, Math.min(900, Math.floor(area / 3500)));
    stars = Array.from({ length: count }, () => makeStar());
  };

  const drawStaticBackdrop = () => {
    if (!ctx) return;
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 160; i += 1) {
      ctx.fillRect(Math.random() * width, Math.random() * height, 1, 1);
    }
  };

  const renderBackground = () => {
    if (!ctx) return;
    pointer.x += (pointer.targetX - pointer.x) * 0.04;
    pointer.y += (pointer.targetY - pointer.y) * 0.04;

    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, width, height);
    const cx = width / 2 + pointer.x * 80 * dpr;
    const cy = height / 2 + pointer.y * 50 * dpr;

    for (let i = 0; i < stars.length; i += 1) {
      const star = stars[i];
      star.z -= star.speed;
      if (star.z <= 0.02) {
        stars[i] = makeStar();
        continue;
      }
      const perspective = 1 / star.z;
      const sx = cx + (star.x + pointer.x * 0.2) * perspective * width * 0.16;
      const sy = cy + (star.y + pointer.y * 0.2) * perspective * height * 0.18;
      const alpha = 0.1 + (1 - star.z) * 0.9;
      const radius = Math.max(0.35, (1 - star.z) * 2.4) * dpr;
 
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
      ctx.arc(sx, sy, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(255,255,255,${(alpha * 0.4).toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + pointer.x * 25, sy + pointer.y * 25);
      ctx.stroke();
    }

    updateDepthTargets();
    rafId = requestAnimationFrame(renderBackground);
  };

  const startBackground = () => {
    if (!canvas || !ctx) return;
    resizeCanvas();
    initStars();
    if (prefersReduced) {
      drawStaticBackdrop();
    } else {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(renderBackground);
    }
  };

  startBackground();
  window.addEventListener('resize', () => {
    startBackground();
  });

  // Cursor system (core + ring + glow)
  let teardownCursor = null;
  const cursorLayers = {
    core: document.querySelector('.cursor-core'),
    ring: document.querySelector('.cursor-ring'),
    glow: document.querySelector('.cursor-glow')
  };

  const activateCursor = () => {
    if (teardownCursor || !finePointerQuery.matches) return;
    if (!cursorLayers.core || !cursorLayers.ring || !cursorLayers.glow) return;
    document.body.classList.add('has-custom-cursor');

    const state = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      tx: window.innerWidth / 2,
      ty: window.innerHeight / 2
    };
    let frame;

    const setLayerPosition = (el, x, y) => {
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    };

    const setVisibility = (visible) => {
      Object.values(cursorLayers).forEach((layer) => {
        layer.classList.toggle('visible', visible);
      });
    };

    setLayerPosition(cursorLayers.core, state.x, state.y);
    setLayerPosition(cursorLayers.ring, state.x, state.y);
    setLayerPosition(cursorLayers.glow, state.x, state.y);

    const animate = () => {
      state.x += (state.tx - state.x) * 0.2;
      state.y += (state.ty - state.y) * 0.2;
      setLayerPosition(cursorLayers.ring, state.x, state.y);
      setLayerPosition(cursorLayers.glow, state.x, state.y);
      frame = requestAnimationFrame(animate);
    };
    animate();

    const move = (event) => {
      if (!isPrecisePointer(event)) return;
      state.tx = event.clientX;
      state.ty = event.clientY;
      setLayerPosition(cursorLayers.core, state.tx, state.ty);
      setVisibility(true);
    };

    const leave = (event) => {
      if (!isPrecisePointer(event)) return;
      if (!event.relatedTarget) setVisibility(false);
    };

    const setPressed = (down) => {
      cursorLayers.core.classList.toggle('pressed', down);
      cursorLayers.ring.classList.toggle('pressed', down);
    };
    const handleDown = () => setPressed(true);
    const handleUp = () => setPressed(false);

    const interactiveSelectors = 'a, button, .btn, .tile, [role="button"], .lab-card';
    const handleOver = (event) => {
      if (!isPrecisePointer(event)) return;
      const hovering = event.target.closest(interactiveSelectors);
      if (hovering) {
        cursorLayers.ring.classList.add('hover');
        cursorLayers.glow.classList.add('hover');
      }
    };
    const handleOut = (event) => {
      if (!isPrecisePointer(event)) return;
      const leavingInteractive =
        event.target.closest(interactiveSelectors) &&
        (!event.relatedTarget || !event.relatedTarget.closest(interactiveSelectors));
      if (leavingInteractive) {
        cursorLayers.ring.classList.remove('hover');
        cursorLayers.glow.classList.remove('hover');
      }
    };

    document.addEventListener('pointermove', move);
    document.body.addEventListener('pointerleave', leave);
    document.addEventListener('pointerdown', handleDown);
    document.addEventListener('pointerup', handleUp);
    document.addEventListener('pointerover', handleOver);
    document.addEventListener('pointerout', handleOut);

    teardownCursor = () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointermove', move);
      document.body.removeEventListener('pointerleave', leave);
      document.removeEventListener('pointerdown', handleDown);
      document.removeEventListener('pointerup', handleUp);
      document.removeEventListener('pointerover', handleOver);
      document.removeEventListener('pointerout', handleOut);
      document.body.classList.remove('has-custom-cursor');
      setVisibility(false);
      teardownCursor = null;
    };
  };

  if (finePointerQuery.matches) activateCursor();
  finePointerQuery.addEventListener?.('change', (event) => {
    if (event.matches) activateCursor();
    else if (teardownCursor) {
      teardownCursor();
    }
  });

  // Tilt interactions
  const attachTilt = (elements, strength = 10) => {
    if (prefersReduced) return;
    elements.forEach((el) => {
      const maxRotate = strength;
      const maxTranslate = strength * 0.6;
      const handleMove = (event) => {
        if (!isPrecisePointer(event)) return;
        const rect = el.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
        el.style.setProperty('--ry', `${x * maxRotate}deg`);
        el.style.setProperty('--rx', `${-y * maxRotate}deg`);
        el.style.setProperty('--tx', `${x * maxTranslate}px`);
        el.style.setProperty('--ty', `${y * maxTranslate}px`);
        el.style.setProperty('--tz', '20px');
      };
      const reset = () => {
        el.style.setProperty('--ry', '0deg');
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--tx', '0px');
        el.style.setProperty('--ty', '0px');
        el.style.setProperty('--tz', '0px');
      };
      el.addEventListener('pointermove', handleMove);
      el.addEventListener('pointerleave', reset);
      el.addEventListener('pointerup', reset);
    });
  };

  attachTilt(Array.from(document.querySelectorAll('.tile')));
  attachTilt(Array.from(document.querySelectorAll('.lab-card')), 6);
  const heroTilt = document.querySelectorAll('[data-tilt]');
  attachTilt(Array.from(heroTilt), 8);

  // Scroll helpers
  document.querySelectorAll('[data-scroll]').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      const target = document.querySelector(btn.dataset.scroll);
      if (target) {
        event.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Navigation toggle + scroll spy
  const nav = document.getElementById('nav');
  const dockLinks = Array.from(document.querySelectorAll('.dock-link'));
  const dockToggle = nav?.querySelector('.dock-toggle');
  const closeNav = () => {
    nav?.classList.remove('open');
    dockToggle?.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  };
  if (dockToggle) {
    dockToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      const open = nav.classList.toggle('open');
      dockToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.style.overflow = open ? 'hidden' : '';
    });
    document.addEventListener('click', (event) => {
      if (!nav.contains(event.target) && nav.classList.contains('open')) closeNav();
    });
    dockLinks.forEach((link) => link.addEventListener('click', closeNav));
  }

  const sections = ['intro', 'projects', 'lab']
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  if (sections.length && dockLinks.length) {
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            dockLinks.forEach((link) => {
              link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`);
            });
          }
        });
      },
      { threshold: 0.25 }
    );
    sections.forEach((section) => spy.observe(section));
  }

  // Reveal observer
  const revealEls = document.querySelectorAll('.reveal');
  if (revealEls.length) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add('is-visible');
      });
    }, { threshold: 0.15 });
    revealEls.forEach((el) => revealObserver.observe(el));
  }

  // Modal setup
  const modal = document.getElementById('projectModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalDesc = document.getElementById('modalDescription');
  const modalTech = document.getElementById('modalTech');
  const modalYoutube = document.getElementById('modalYoutube');
  const modalFallback = document.getElementById('modalFallback');
  const modalFallbackText = document.getElementById('modalFallbackText');
  const modalYoutubeLink = document.getElementById('modalYoutubeLink');
  const closeBtn = modal?.querySelector('.close-button');
  const projectCards = Array.from(document.querySelectorAll('.project-card.tile'));

  const extractYouTubeId = (value) => {
    if (!value) return null;
    const str = String(value).trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
    try {
      const url = new URL(str);
      if (url.hostname.includes('youtu.be')) return url.pathname.replace(/\//g, '');
      if (url.hostname.includes('youtube.com')) {
        const id = url.searchParams.get('v');
        if (id) return id;
      }
    } catch (_) {
      return null;
    }
    return null;
  };

  const openModal = (card) => {
    if (!modal) return;
    const { dataset } = card;
    modalTitle.textContent = dataset.title || 'Project';
    modalDesc.textContent = dataset.description || '';
    modalTech.innerHTML = '';
    (dataset.tech || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => {
        const li = document.createElement('li');
        li.textContent = item;
        modalTech.appendChild(li);
      });

    modalFallback.style.display = 'none';
    modalYoutube.src = '';
    const ytid = extractYouTubeId(dataset.youtube);
    if (ytid) {
      modalYoutube.parentElement.style.display = 'block';
      modalYoutube.src = `https://www.youtube-nocookie.com/embed/${ytid}?autoplay=1&mute=1&playsinline=1&rel=0`;
    } else {
      modalYoutube.parentElement.style.display = 'none';
      modalFallback.style.display = 'block';
      modalFallbackText.textContent = dataset.fallback || 'Video unavailable.';
      if (dataset.fallbackLink) {
        modalYoutubeLink.textContent = dataset.fallbackLinkLabel || 'Open link';
        modalYoutubeLink.href = dataset.fallbackLink;
        modalYoutubeLink.style.display = '';
      } else {
        modalYoutubeLink.removeAttribute('href');
        modalYoutubeLink.style.display = 'none';
      }
    }

    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    modalYoutube.src = '';
    document.body.style.overflow = '';
  };

  projectCards.forEach((card) => {
    card.addEventListener('click', () => openModal(card));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openModal(card);
      }
    });
  });

  closeBtn?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal?.classList.contains('show')) closeModal();
  });
});
