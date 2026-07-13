/* ============================================
   HERO HLS BG VIDEO
   ============================================ */
function initBunnyPlayerBackground() {
  document.querySelectorAll('[data-bunny-background-init]').forEach(function (player) {
    var src = player.getAttribute('data-player-src');
    if (!src) return;

    var video = player.querySelector('video');
    if (!video) return;

    try {
      video.pause();
    } catch (_) {}
    try {
      video.removeAttribute('src');
      video.load();
    } catch (_) {}

    function setStatus(s) {
      if (player.getAttribute('data-player-status') !== s) {
        player.setAttribute('data-player-status', s);
      }
    }
    function setActivated(v) {
      player.setAttribute('data-player-activated', v ? 'true' : 'false');
    }
    if (!player.hasAttribute('data-player-activated')) setActivated(false);

    var lazyMode = player.getAttribute('data-player-lazy');
    var isLazyTrue = lazyMode === 'true';
    var autoplay = player.getAttribute('data-player-autoplay') === 'true';
    var initialMuted = player.getAttribute('data-player-muted') === 'true';

    var pendingPlay = false;

    if (autoplay) {
      video.muted = true;
      video.loop = true;
    } else {
      video.muted = initialMuted;
    }

    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.playsInline = true;
    if (typeof video.disableRemotePlayback !== 'undefined') video.disableRemotePlayback = true;
    if (autoplay) video.autoplay = false;

    var isSafariNative = !!video.canPlayType('application/vnd.apple.mpegurl');
    var canUseHlsJs = !!(window.Hls && Hls.isSupported()) && !isSafariNative;

    var isAttached = false;
    var userInteracted = false;
    var lastPauseBy = '';
    function attachMediaOnce() {
      if (isAttached) return;
      isAttached = true;

      if (player._hls) {
        try {
          player._hls.destroy();
        } catch (_) {}
        player._hls = null;
      }

      if (isSafariNative) {
        video.preload = isLazyTrue ? 'none' : 'auto';
        video.src = src;
        video.addEventListener(
          'loadedmetadata',
          function () {
            readyIfIdle(player, pendingPlay);
          },
          { once: true }
        );
      } else if (canUseHlsJs) {
        var hls = new Hls({ maxBufferLength: 10 });
        hls.attachMedia(video);
        hls.on(Hls.Events.MEDIA_ATTACHED, function () {
          hls.loadSource(src);
        });
        hls.on(Hls.Events.MANIFEST_PARSED, function () {
          readyIfIdle(player, pendingPlay);
        });
        player._hls = hls;
      } else {
        video.src = src;
      }
    }

    if (isLazyTrue) {
      video.preload = 'none';
    } else {
      attachMediaOnce();
    }

    function togglePlay() {
      userInteracted = true;
      if (video.paused || video.ended) {
        if (isLazyTrue && !isAttached) attachMediaOnce();
        pendingPlay = true;
        lastPauseBy = '';
        setStatus('loading');
        safePlay(video);
      } else {
        lastPauseBy = 'manual';
        video.pause();
      }
    }

    function toggleMute() {
      video.muted = !video.muted;
      player.setAttribute('data-player-muted', video.muted ? 'true' : 'false');
    }

    player.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-player-control]');
      if (!btn || !player.contains(btn)) return;
      var type = btn.getAttribute('data-player-control');
      if (type === 'play' || type === 'pause' || type === 'playpause') togglePlay();
      else if (type === 'mute') toggleMute();
    });

    video.addEventListener('play', function () {
      setActivated(true);
      setStatus('playing');
    });
    video.addEventListener('playing', function () {
      pendingPlay = false;
      setStatus('playing');
    });
    video.addEventListener('pause', function () {
      pendingPlay = false;
      setStatus('paused');
    });
    video.addEventListener('waiting', function () {
      setStatus('loading');
    });
    video.addEventListener('canplay', function () {
      readyIfIdle(player, pendingPlay);
    });
    video.addEventListener('ended', function () {
      pendingPlay = false;
      setStatus('paused');
      setActivated(false);
    });

    if (autoplay) {
      if (player._io) {
        try {
          player._io.disconnect();
        } catch (_) {}
      }
      var io = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            var inView = entry.isIntersecting && entry.intersectionRatio > 0;
            if (inView) {
              if (isLazyTrue && !isAttached) attachMediaOnce();
              if (lastPauseBy === 'io' || (video.paused && lastPauseBy !== 'manual')) {
                setStatus('loading');
                if (video.paused) togglePlay();
                lastPauseBy = '';
              }
            } else {
              if (!video.paused && !video.ended) {
                lastPauseBy = 'io';
                video.pause();
              }
            }
          });
        },
        { threshold: 0.1 }
      );
      io.observe(player);
      player._io = io;
    }
  });

  function readyIfIdle(player, pendingPlay) {
    if (!pendingPlay && player.getAttribute('data-player-activated') !== 'true' && player.getAttribute('data-player-status') === 'idle') {
      player.setAttribute('data-player-status', 'ready');
    }
  }

  function safePlay(video) {
    var p = video.play();
    if (p && typeof p.then === 'function') p.catch(function () {});
  }
}

/* ============================================
   ODOMETER ANIMATION
   ============================================ */
function initNumberOdometer() {
  gsap.registerPlugin(ScrollTrigger);

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const initFlag = 'data-odometer-initialized';
  const activeTweens = new WeakMap();

  const defaults = {
    duration: 1,
    ease: 'power3.out',
    elementStagger: 0.1,
    digitStagger: 0.04,
    revealDuration: 0.5,
    revealEase: 'power2.out',
    triggerStart: 'top 80%',
    staggerOrder: 'left',
    digitCycles: 2,
  };

  document.querySelectorAll('[data-odometer-group]').forEach((group) => {
    if (group.hasAttribute(initFlag)) return;
    group.setAttribute(initFlag, '');

    const elements = Array.from(group.querySelectorAll('[data-odometer-element]'));
    if (!elements.length || prefersReducedMotion) return;

    const staggerOrder = group.getAttribute('data-odometer-stagger-order') || defaults.staggerOrder;
    const triggerStart = group.getAttribute('data-odometer-trigger-start') || defaults.triggerStart;
    const elementStagger = parseFloat(group.getAttribute('data-odometer-stagger')) || defaults.elementStagger;

    const elementData = elements.map((el) => {
      const originalText = el.textContent.trim();
      const hasExplicitStart = el.hasAttribute('data-odometer-start');
      const startValue = parseFloat(el.getAttribute('data-odometer-start')) || 0;
      const duration = parseFloat(el.getAttribute('data-odometer-duration')) || defaults.duration;
      const step = getLineHeightRatio(el);

      let segments = parseSegments(originalText);
      segments = mapStartDigits(segments, startValue);
      segments = markHiddenSegments(segments, startValue);

      const grow = shouldGrow(el, hasExplicitStart, startValue, segments);
      const { rollers, revealEls } = buildRollerDOM(el, segments, step, grow);

      const fontSize = parseFloat(getComputedStyle(el).fontSize);
      const revealData = revealEls.map((revealEl) => {
        const widthEm = revealEl.offsetWidth / fontSize;
        gsap.set(revealEl, { width: 0, overflow: 'hidden' });
        return { el: revealEl, widthEm };
      });

      return { el, rollers, duration, step, revealData, originalText };
    });

    const ordered = applyStaggerOrder(elementData, staggerOrder);

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: group,
        start: triggerStart,
        once: true,
      },
      onComplete() {
        elementData.forEach(({ el, originalText }) => {
          cleanupElement(el, originalText);
        });
      },
    });

    ordered.forEach((data, orderIdx) => {
      const { rollers, duration, revealData } = data;
      const offset = orderIdx * elementStagger;

      revealData.forEach(({ el, widthEm }) => {
        tl.to(
          el,
          {
            width: widthEm + 'em',
            opacity: 1,
            duration: defaults.revealDuration,
            ease: defaults.revealEase,
          },
          offset
        );
      });

      rollers.forEach(({ roller, targetPos }, digitIdx) => {
        const reversedIdx = rollers.length - 1 - digitIdx;
        tl.to(
          roller,
          {
            y: -targetPos * data.step + 'em',
            duration,
            ease: defaults.ease,
            force3D: true,
          },
          offset + reversedIdx * defaults.digitStagger
        );
      });
    });
  });

  function updateOdometer(el, newText, options = {}) {
    const currentText = el.textContent.trim();
    if (currentText === newText) return;

    const duration = options.duration || defaults.duration;
    const ease = options.ease || defaults.ease;
    const step = getLineHeightRatio(el);

    const existing = activeTweens.get(el);
    if (existing) {
      existing.kill();
      gsap.set(el, { clearProps: 'width,overflow' });
    }

    const fontSize = parseFloat(getComputedStyle(el).fontSize);
    const oldWidthEm = el.getBoundingClientRect().width / fontSize;

    const startSegments = parseSegments(currentText);
    const startDigitsStr = startSegments
      .filter((s) => s.type === 'digit')
      .map((s) => s.char)
      .join('');
    const startValue = parseInt(startDigitsStr, 10) || 0;

    let segments = parseSegments(newText);
    segments = mapStartDigits(segments, startValue);
    segments = markHiddenSegments(segments, startValue);
    const { rollers, revealEls } = buildRollerDOM(el, segments, step, true);

    const newWidthEm = el.getBoundingClientRect().width / fontSize;
    const widthChanged = Math.abs(oldWidthEm - newWidthEm) > 0.01;

    if (widthChanged) {
      gsap.set(el, { width: oldWidthEm + 'em', overflow: 'hidden' });
    }

    const tl = gsap.timeline({
      onComplete() {
        cleanupElement(el, newText);
        activeTweens.delete(el);
      },
    });
    activeTweens.set(el, tl);

    if (widthChanged) {
      tl.to(
        el,
        {
          width: newWidthEm + 'em',
          duration: defaults.revealDuration,
          ease: defaults.revealEase,
        },
        0
      );
    }

    revealEls.forEach((revealEl) => {
      if (revealEl.getAttribute('data-odometer-part') === 'static') {
        tl.to(revealEl, { opacity: 1, duration: 0.2 }, 0);
      }
    });

    rollers.forEach(({ roller, targetPos }, digitIdx) => {
      const reversedIdx = rollers.length - 1 - digitIdx;
      tl.to(
        roller,
        {
          y: -targetPos * step + 'em',
          duration,
          ease,
          force3D: true,
        },
        reversedIdx * defaults.digitStagger
      );
    });
  }

  function getLineHeightRatio(el) {
    const cs = getComputedStyle(el);
    const lh = cs.lineHeight;
    if (lh === 'normal') return 1.2;
    return parseFloat(lh) / parseFloat(cs.fontSize);
  }

  function parseSegments(text) {
    return [...text].map((char) => ({
      type: /\d/.test(char) ? 'digit' : 'static',
      char,
    }));
  }

  function mapStartDigits(segments, startValue) {
    const digitSlots = segments.filter((s) => s.type === 'digit');
    const padded = String(Math.floor(Math.abs(startValue)))
      .padStart(digitSlots.length, '0')
      .slice(-digitSlots.length);
    let di = 0;
    return segments.map((s) => (s.type === 'digit' ? { ...s, startDigit: parseInt(padded[di++], 10) } : s));
  }

  function markHiddenSegments(segments, startValue) {
    const totalDigits = segments.filter((s) => s.type === 'digit').length;
    const absStart = Math.floor(Math.abs(startValue));
    const startDigitCount = absStart === 0 ? 1 : String(absStart).length;
    const leadingZeros = Math.max(0, totalDigits - startDigitCount);
    if (leadingZeros === 0) return segments;
    let digitsSeen = 0;
    let firstDigitSeen = false;
    let prevDigitHidden = false;
    return segments.map((seg) => {
      if (seg.type === 'digit') {
        firstDigitSeen = true;
        const hidden = digitsSeen < leadingZeros;
        prevDigitHidden = hidden;
        digitsSeen++;
        return { ...seg, hidden };
      }
      const hidden = firstDigitSeen && prevDigitHidden;
      return { ...seg, hidden };
    });
  }

  function shouldGrow(el, hasExplicitStart, startValue, segments) {
    if (el.hasAttribute('data-odometer-grow')) {
      return el.getAttribute('data-odometer-grow') !== 'false';
    }
    if (!hasExplicitStart) return false;
    const absStart = Math.floor(Math.abs(startValue));
    const startDigitCount = absStart === 0 ? 1 : String(absStart).length;
    const endDigitCount = segments.filter((s) => s.type === 'digit').length;
    return startDigitCount < endDigitCount;
  }

  function buildRollerDOM(el, segments, step, grow) {
    el.innerHTML = '';
    el.style.height = '';
    const rollers = [];
    const revealEls = [];
    const totalCells = 10 * defaults.digitCycles;
    segments.forEach((seg) => {
      if (seg.type === 'static') {
        const span = document.createElement('span');
        span.setAttribute('data-odometer-part', 'static');
        span.style.height = step + 'em';
        span.style.lineHeight = step;
        span.textContent = seg.char;
        el.appendChild(span);
        if (grow && seg.hidden) {
          gsap.set(span, { opacity: 0 });
          revealEls.push(span);
        }
        return;
      }
      const mask = document.createElement('span');
      mask.setAttribute('data-odometer-part', 'mask');
      mask.style.height = step + 'em';
      mask.style.lineHeight = step;
      const roller = document.createElement('span');
      roller.setAttribute('data-odometer-part', 'roller');
      roller.style.lineHeight = step;

      const digits = [];
      for (let d = 0; d < totalCells; d++) {
        digits.push(d % 10);
      }
      roller.textContent = digits.join('\n');
      mask.appendChild(roller);
      el.appendChild(mask);
      const startDigit = seg.startDigit || 0;
      const isReveal = grow && seg.hidden;
      gsap.set(roller, { y: isReveal ? step + 'em' : -startDigit * step + 'em' });
      const endDigit = parseInt(seg.char, 10);
      const targetPos = endDigit > startDigit ? endDigit : 10 + endDigit;
      rollers.push({ roller, targetPos });
      if (isReveal) revealEls.push(mask);
    });
    return { rollers, revealEls };
  }

  function cleanupElement(el, originalText) {
    el.style.overflow = '';
    el.style.height = '';

    const digits = [...originalText].filter((c) => /\d/.test(c));
    let di = 0;

    el.querySelectorAll('[data-odometer-part="mask"]').forEach((mask) => {
      const roller = mask.querySelector('[data-odometer-part="roller"]');
      if (roller) roller.remove();
      mask.textContent = digits[di++] || '';
      mask.style.opacity = '';
      mask.style.overflow = '';
    });

    el.querySelectorAll('[data-odometer-part="static"]').forEach((stat) => {
      stat.style.opacity = '';
    });
  }

  function recalcOnResize() {
    document.querySelectorAll('[data-odometer-element]').forEach((el) => {
      const running = activeTweens.get(el);
      if (running) {
        running.progress(1);
        activeTweens.delete(el);
      }

      const hasRollers = el.querySelector('[data-odometer-part="roller"]');

      if (hasRollers) {
        const step = getLineHeightRatio(el);
        el.querySelectorAll('[data-odometer-part="mask"]').forEach((mask) => {
          mask.style.height = step + 'em';
          mask.style.lineHeight = step;
        });
        el.querySelectorAll('[data-odometer-part="roller"]').forEach((roller) => {
          roller.style.lineHeight = step;
        });
        el.querySelectorAll('[data-odometer-part="static"]').forEach((stat) => {
          stat.style.lineHeight = step;
        });
      }
    });
    ScrollTrigger.refresh();
  }

  let resizeTimer;
  let lastWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      recalcOnResize();
    }, 250);
  });

  function applyStaggerOrder(items, order) {
    const arr = [...items];
    if (order === 'right') return arr.reverse();
    if (order === 'random') return shuffleArray(arr);
    return arr;
  }

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  return updateOdometer;
}

/* ============================================
   LIGHTBOX PLAYER
   ============================================ */
function initBunnyLightboxPlayer() {
  var player = document.querySelector('[data-bunny-lightbox-init]');
  if (!player) return;

  var wrapper = player.closest('[data-bunny-lightbox-status]');
  if (!wrapper) return;

  var video = player.querySelector('video');
  if (!video) return;

  try {
    video.pause();
  } catch (_) {}
  try {
    video.removeAttribute('src');
    video.load();
  } catch (_) {}

  function setAttr(el, name, val) {
    var str = typeof val === 'boolean' ? (val ? 'true' : 'false') : String(val);
    if (el.getAttribute(name) !== str) el.setAttribute(name, str);
  }
  function setStatus(s) {
    setAttr(player, 'data-player-status', s);
  }
  function setMutedState(v) {
    video.muted = !!v;
    setAttr(player, 'data-player-muted', video.muted);
  }
  function setFsAttr(v) {
    setAttr(player, 'data-player-fullscreen', !!v);
  }
  function setActivated(v) {
    setAttr(player, 'data-player-activated', !!v);
  }
  if (!player.hasAttribute('data-player-activated')) setActivated(false);

  var timeline = player.querySelector('[data-player-timeline]');
  var progressBar = player.querySelector('[data-player-progress]');
  var bufferedBar = player.querySelector('[data-player-buffered]');
  var handle = player.querySelector('[data-player-timeline-handle]');
  var timeDurationEls = player.querySelectorAll('[data-player-time-duration]');
  var timeProgressEls = player.querySelectorAll('[data-player-time-progress]');
  var playerPlaceholderImg = player.querySelector('[data-bunny-lightbox-placeholder]');

  var updateSize = player.getAttribute('data-player-update-size');
  var autoplay = player.getAttribute('data-player-autoplay') === 'true';
  var initialMuted = player.getAttribute('data-player-muted') === 'true';

  var pendingPlay = false;

  video.loop = false;
  setMutedState(initialMuted);

  video.setAttribute('playsinline', '');
  video.setAttribute('webkit-playsinline', '');
  video.playsInline = true;
  if (typeof video.disableRemotePlayback !== 'undefined') video.disableRemotePlayback = true;
  if (autoplay) video.autoplay = false;

  var isSafariNative = !!video.canPlayType('application/vnd.apple.mpegurl');
  var canUseHlsJs = !!(window.Hls && Hls.isSupported()) && !isSafariNative;

  var isAttached = false;
  var currentSrc = '';
  var lastPauseBy = '';
  var rafId;
  var autoStartOnReady = false;

  function setupLightboxClamp(player, wrapper, video, updateSize) {
    var calcBox = wrapper.querySelector('[data-bunny-lightbox-calc-height]');
    if (!calcBox) return;

    function getRatio() {
      if (updateSize === 'cover') return null;

      if (updateSize === 'true') {
        if (video.videoWidth && video.videoHeight) return video.videoWidth / video.videoHeight;
        var before = player.querySelector('[data-player-before]');
        if (before && before.style && before.style.paddingTop) {
          var pct = parseFloat(before.style.paddingTop);
          if (pct > 0) return 100 / pct;
        }
        var r = player.getBoundingClientRect();
        if (r.height > 0) return r.width / r.height;
        return 16 / 9;
      }

      var beforeFalse = player.querySelector('[data-player-before]');
      if (beforeFalse && beforeFalse.style && beforeFalse.style.paddingTop) {
        var pad = parseFloat(beforeFalse.style.paddingTop);
        if (pad > 0) return 100 / pad;
      }
      var rb = player.getBoundingClientRect();
      if (rb.height > 0) return rb.width / rb.height;
      return 16 / 9;
    }

    function applyClamp() {
      if (updateSize === 'cover') {
        calcBox.style.maxWidth = '';
        calcBox.style.maxHeight = '';
        return;
      }

      var parent = wrapper;
      var cs = getComputedStyle(parent);
      var pt = parseFloat(cs.paddingTop) || 0;
      var pb = parseFloat(cs.paddingBottom) || 0;
      var pl = parseFloat(cs.paddingLeft) || 0;
      var pr = parseFloat(cs.paddingRight) || 0;

      var cw = parent.clientWidth - pl - pr;
      var ch = parent.clientHeight - pt - pb;
      if (cw <= 0 || ch <= 0) return;

      var ratio = getRatio();
      if (!ratio) {
        calcBox.style.maxWidth = '';
        calcBox.style.maxHeight = '';
        return;
      }

      var hIfFullWidth = cw / ratio;

      if (hIfFullWidth <= ch) {
        calcBox.style.maxWidth = '100%';
        calcBox.style.maxHeight = (hIfFullWidth / ch) * 100 + '%';
      } else {
        calcBox.style.maxHeight = '100%';
        calcBox.style.maxWidth = ((ch * ratio) / cw) * 100 + '%';
      }
    }

    var rafPending = false;
    function debouncedApply() {
      if (rafPending) return;
      if (wrapper.getAttribute('data-bunny-lightbox-status') !== 'active') return;
      rafPending = true;
      requestAnimationFrame(function () {
        rafPending = false;
        applyClamp();
      });
    }

    var ro = new ResizeObserver(debouncedApply);
    ro.observe(wrapper);

    window.addEventListener('resize', debouncedApply);
    window.addEventListener('orientationchange', debouncedApply);

    if (updateSize === 'true') {
      video.addEventListener('loadedmetadata', debouncedApply);
      video.addEventListener('loadeddata', debouncedApply);
      video.addEventListener('playing', debouncedApply);
    }

    player._applyClamp = debouncedApply;
    debouncedApply();
  }

  setupLightboxClamp(player, wrapper, video, updateSize);

  function withAttach(src, onReady) {
    if (isSafariNative) {
      video.preload = 'auto';
      video.src = src;
      video.addEventListener('loadedmetadata', onReady, { once: true });
      return;
    }
    if (canUseHlsJs) {
      var hls = new Hls({ maxBufferLength: 10 });
      player._hls = hls;
      hls.attachMedia(video);
      hls.on(Hls.Events.MEDIA_ATTACHED, function () {
        hls.loadSource(src);
      });
      hls.on(Hls.Events.MANIFEST_PARSED, function () {
        onReady();
      });
      hls.on(Hls.Events.LEVEL_LOADED, function (e, data) {
        if (data && data.details && isFinite(data.details.totalduration) && timeDurationEls.length) {
          setText(timeDurationEls, formatTime(data.details.totalduration));
        }
      });
      return;
    }
    video.preload = 'auto';
    video.src = src;
    video.addEventListener('loadedmetadata', onReady, { once: true });
  }

  function attachMediaFor(src) {
    if (currentSrc === src && isAttached) return;
    if (player._hls) {
      try {
        player._hls.destroy();
      } catch (_) {}
      player._hls = null;
    }
    if (timeDurationEls.length) setText(timeDurationEls, '00:00');

    currentSrc = src;
    isAttached = true;

    withAttach(src, function onReady() {
      readyIfIdle(player, pendingPlay);
      updateBeforeRatioIOSSafe();
      if (typeof player._applyClamp === 'function') player._applyClamp();
      if (timeDurationEls.length && video.duration) setText(timeDurationEls, formatTime(video.duration));

      if (autoStartOnReady && wrapper.getAttribute('data-bunny-lightbox-status') === 'active') {
        setStatus('loading');
        safePlay(video);
        autoStartOnReady = false;
      }
    });
  }

  function ensureOpenUI(isActive) {
    var state = isActive ? 'active' : 'not-active';
    if (wrapper.getAttribute('data-bunny-lightbox-status') !== state) {
      wrapper.setAttribute('data-bunny-lightbox-status', state);
    }
    if (isActive && typeof player._applyClamp === 'function') player._applyClamp();
  }

  function isSameSrc(next) {
    return currentSrc && currentSrc === next;
  }
  function planOnOpen(next) {
    var same = isSameSrc(next);
    if (!same) {
      try {
        if (!video.paused && !video.ended) video.pause();
      } catch (_) {}
      if (player._hls) {
        try {
          player._hls.destroy();
        } catch (_) {}
        player._hls = null;
      }
      isAttached = false;
      currentSrc = '';
      if (timeDurationEls.length) setText(timeDurationEls, '00:00');
      setActivated(false);
      setStatus('idle');

      attachMediaFor(next);
      autoStartOnReady = !!autoplay;
      pendingPlay = !!autoplay;
      return;
    }
    autoStartOnReady = !!autoplay;
    if (autoplay) {
      setStatus('loading');
      safePlay(video);
    } else {
      try {
        if (!video.paused && !video.ended) video.pause();
      } catch (_) {}
      setActivated(false);
      setStatus('paused');
    }
  }

  function openLightbox(src, placeholderUrl) {
    if (!src) return;

    function activate() {
      ensureOpenUI(true);
      planOnOpen(src);
    }

    if (playerPlaceholderImg && placeholderUrl) {
      var needsSwap = playerPlaceholderImg.getAttribute('src') !== placeholderUrl;
      if (needsSwap || !playerPlaceholderImg.complete || !playerPlaceholderImg.naturalWidth) {
        playerPlaceholderImg.onload = function () {
          playerPlaceholderImg.onload = null;
          activate();
        };
        playerPlaceholderImg.onerror = function () {
          playerPlaceholderImg.onerror = null;
          activate();
        };
        if (needsSwap) playerPlaceholderImg.setAttribute('src', placeholderUrl);
        else playerPlaceholderImg.dispatchEvent(new Event('load'));
      } else {
        activate();
      }
    } else {
      activate();
    }
  }

  function togglePlay() {
    if (video.paused || video.ended) {
      pendingPlay = true;
      lastPauseBy = '';
      setStatus('loading');
      safePlay(video);
    } else {
      lastPauseBy = 'manual';
      video.pause();
    }
  }
  function toggleMute() {
    setMutedState(!video.muted);
  }

  player.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-player-control]');
    if (!btn || !player.contains(btn)) return;
    var type = btn.getAttribute('data-player-control');
    if (type === 'play' || type === 'pause' || type === 'playpause') togglePlay();
    else if (type === 'mute') toggleMute();
    else if (type === 'fullscreen') toggleFullscreen();
  });

  function isFsActive() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }
  function enterFullscreen() {
    if (player.requestFullscreen) return player.requestFullscreen();
    if (video.requestFullscreen) return video.requestFullscreen();
    if (video.webkitSupportsFullscreen && typeof video.webkitEnterFullscreen === 'function') return video.webkitEnterFullscreen();
  }
  function exitFullscreen() {
    if (document.exitFullscreen) return document.exitFullscreen();
    if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
    if (video.webkitDisplayingFullscreen && typeof video.webkitExitFullscreen === 'function') return video.webkitExitFullscreen();
  }
  function toggleFullscreen() {
    if (isFsActive() || video.webkitDisplayingFullscreen) exitFullscreen();
    else enterFullscreen();
  }
  document.addEventListener('fullscreenchange', function () {
    setFsAttr(isFsActive());
  });
  document.addEventListener('webkitfullscreenchange', function () {
    setFsAttr(isFsActive());
  });
  video.addEventListener('webkitbeginfullscreen', function () {
    setFsAttr(true);
  });
  video.addEventListener('webkitendfullscreen', function () {
    setFsAttr(false);
  });

  function updateTimeTexts() {
    if (timeDurationEls.length) setText(timeDurationEls, formatTime(video.duration));
    if (timeProgressEls.length) setText(timeProgressEls, formatTime(video.currentTime));
  }
  video.addEventListener('timeupdate', updateTimeTexts);
  video.addEventListener('loadedmetadata', function () {
    updateTimeTexts();
    updateBeforeRatioIOSSafe();
  });
  video.addEventListener('loadeddata', function () {
    updateBeforeRatioIOSSafe();
  });
  video.addEventListener('playing', function () {
    updateBeforeRatioIOSSafe();
  });
  video.addEventListener('durationchange', updateTimeTexts);

  function updateProgressVisuals() {
    if (!video.duration) return;
    var playedPct = (video.currentTime / video.duration) * 100;
    if (progressBar) progressBar.style.transform = 'translateX(' + (-100 + playedPct) + '%)';
    if (handle) handle.style.left = pctClamp(playedPct) + '%';
  }
  function pctClamp(p) {
    return p < 0 ? 0 : p > 100 ? 100 : p;
  }
  function loop() {
    updateProgressVisuals();
    if (!video.paused && !video.ended) rafId = requestAnimationFrame(loop);
  }

  function updateBufferedBar() {
    if (!bufferedBar || !video.duration || !video.buffered.length) return;
    var end = video.buffered.end(video.buffered.length - 1);
    var buffPct = (end / video.duration) * 100;
    bufferedBar.style.transform = 'translateX(' + (-100 + buffPct) + '%)';
  }
  video.addEventListener('progress', updateBufferedBar);
  video.addEventListener('loadedmetadata', updateBufferedBar);
  video.addEventListener('durationchange', updateBufferedBar);

  video.addEventListener('play', function () {
    setActivated(true);
    cancelAnimationFrame(rafId);
    loop();
    setStatus('playing');
  });
  video.addEventListener('playing', function () {
    pendingPlay = false;
    setStatus('playing');
  });
  video.addEventListener('pause', function () {
    pendingPlay = false;
    cancelAnimationFrame(rafId);
    updateProgressVisuals();
    setStatus('paused');
  });
  video.addEventListener('waiting', function () {
    setStatus('loading');
  });
  video.addEventListener('canplay', function () {
    readyIfIdle(player, pendingPlay);
  });

  video.addEventListener('ended', function () {
    pendingPlay = false;
    cancelAnimationFrame(rafId);
    updateProgressVisuals();
    setActivated(false);
    video.currentTime = 0;

    if (document.fullscreenElement || document.webkitFullscreenElement || video.webkitDisplayingFullscreen) {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      else if (video.webkitExitFullscreen) video.webkitExitFullscreen();
    }

    closeLightbox();
  });

  if (timeline) {
    var dragging = false,
      wasPlaying = false,
      targetTime = 0,
      lastSeekTs = 0,
      seekThrottle = 180,
      rect = null;
    window.addEventListener('resize', function () {
      if (!dragging) rect = null;
    });
    function getFractionFromX(x) {
      if (!rect) rect = timeline.getBoundingClientRect();
      var f = (x - rect.left) / rect.width;
      if (f < 0) f = 0;
      if (f > 1) f = 1;
      return f;
    }
    function previewAtFraction(f) {
      if (!video.duration) return;
      var pct = f * 100;
      if (progressBar) progressBar.style.transform = 'translateX(' + (-100 + pct) + '%)';
      if (handle) handle.style.left = pct + '%';
      if (timeProgressEls.length) setText(timeProgressEls, formatTime(f * video.duration));
    }
    function maybeSeek(now) {
      if (!video.duration) return;
      if (now - lastSeekTs < seekThrottle) return;
      lastSeekTs = now;
      video.currentTime = targetTime;
    }
    function onPointerDown(e) {
      if (!video.duration) return;
      dragging = true;
      wasPlaying = !video.paused && !video.ended;
      if (wasPlaying) video.pause();
      player.setAttribute('data-timeline-drag', 'true');
      rect = timeline.getBoundingClientRect();
      var f = getFractionFromX(e.clientX);
      targetTime = f * video.duration;
      previewAtFraction(f);
      maybeSeek(performance.now());
      timeline.setPointerCapture && timeline.setPointerCapture(e.pointerId);
      window.addEventListener('pointermove', onPointerMove, { passive: false });
      window.addEventListener('pointerup', onPointerUp, { passive: true });
      e.preventDefault();
    }
    function onPointerMove(e) {
      if (!dragging) return;
      var f = getFractionFromX(e.clientX);
      targetTime = f * video.duration;
      previewAtFraction(f);
      maybeSeek(performance.now());
      e.preventDefault();
    }
    function onPointerUp() {
      if (!dragging) return;
      dragging = false;
      player.setAttribute('data-timeline-drag', 'false');
      rect = null;
      video.currentTime = targetTime;
      if (wasPlaying) safePlay(video);
      else {
        updateProgressVisuals();
        updateTimeTexts();
      }
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    }
    timeline.addEventListener('pointerdown', onPointerDown, { passive: false });
    if (handle) handle.addEventListener('pointerdown', onPointerDown, { passive: false });
  }

  var hoverTimer;
  var hoverHideDelay = 3000;
  function setHover(state) {
    if (player.getAttribute('data-player-hover') !== state) {
      player.setAttribute('data-player-hover', state);
    }
  }
  function scheduleHide() {
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(function () {
      setHover('idle');
    }, hoverHideDelay);
  }
  function wakeControls() {
    setHover('active');
    scheduleHide();
  }
  player.addEventListener('pointerdown', wakeControls);
  document.addEventListener('fullscreenchange', wakeControls);
  document.addEventListener('webkitfullscreenchange', wakeControls);
  var trackingMove = false;
  function onPointerMoveGlobal(e) {
    var r = player.getBoundingClientRect();
    if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) wakeControls();
  }
  player.addEventListener('pointerenter', function () {
    wakeControls();
    if (!trackingMove) {
      trackingMove = true;
      window.addEventListener('pointermove', onPointerMoveGlobal, { passive: true });
    }
  });
  player.addEventListener('pointerleave', function () {
    setHover('idle');
    clearTimeout(hoverTimer);
    if (trackingMove) {
      trackingMove = false;
      window.removeEventListener('pointermove', onPointerMoveGlobal);
    }
  });

  function closeLightbox() {
    ensureOpenUI(false);

    var hasPlayed = false;
    try {
      if (video.played && video.played.length) {
        for (var i = 0; i < video.played.length; i++) {
          if (video.played.end(i) > 0) {
            hasPlayed = true;
            break;
          }
        }
      } else {
        hasPlayed = video.currentTime > 0;
      }
    } catch (_) {}

    try {
      if (!video.paused && !video.ended) video.pause();
    } catch (_) {}

    setActivated(false);
    setStatus(hasPlayed ? 'paused' : 'idle');
  }

  document.addEventListener('click', function (e) {
    var openBtn = e.target.closest('[data-bunny-lightbox-control="open"]');
    if (openBtn) {
      var src = openBtn.getAttribute('data-bunny-lightbox-src') || '';
      if (!src) return;
      var imgEl = openBtn.querySelector('[data-bunny-lightbox-placeholder]');
      var placeholderUrl = imgEl ? imgEl.getAttribute('src') : '';
      openLightbox(src, placeholderUrl);
      return;
    }
    var closeBtn = e.target.closest('[data-bunny-lightbox-control="close"]');
    if (closeBtn) {
      var closeInWrapper = closeBtn.closest('[data-bunny-lightbox-status]');
      if (closeInWrapper === wrapper) closeLightbox();
      return;
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeLightbox();
  });

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }
  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) return '00:00';
    var s = Math.floor(sec),
      h = Math.floor(s / 3600),
      m = Math.floor((s % 3600) / 60),
      r = s % 60;
    return h > 0 ? h + ':' + pad2(m) + ':' + pad2(r) : pad2(m) + ':' + pad2(r);
  }
  function setText(nodes, text) {
    nodes.forEach(function (n) {
      n.textContent = text;
    });
  }

  function safePlay(video) {
    var p = video.play();
    if (p && typeof p.then === 'function') p.catch(function () {});
  }

  function readyIfIdle(player, pendingPlay) {
    if (!pendingPlay && player.getAttribute('data-player-activated') !== 'true' && player.getAttribute('data-player-status') === 'idle') {
      player.setAttribute('data-player-status', 'ready');
    }
  }

  function setBeforeRatio(player, updateSize, w, h) {
    if (updateSize !== 'true' || !w || !h) return;
    var before = player.querySelector('[data-player-before]');
    if (!before) return;
    before.style.paddingTop = (h / w) * 100 + '%';
  }

  function updateBeforeRatioIOSSafe() {
    if (updateSize !== 'true') return;
    var before = player.querySelector('[data-player-before]');
    if (!before) return;

    function apply(w, h) {
      if (!w || !h) return;
      before.style.paddingTop = (h / w) * 100 + '%';
      if (typeof player._applyClamp === 'function') player._applyClamp();
    }

    if (video.videoWidth && video.videoHeight) {
      apply(video.videoWidth, video.videoHeight);
      return;
    }

    if (player._hls && player._hls.levels && player._hls.levels.length) {
      var lvls = player._hls.levels;
      var best = lvls.reduce(function (a, b) {
        return (b.width || 0) > (a.width || 0) ? b : a;
      }, lvls[0]);
      if (best && best.width && best.height) {
        apply(best.width, best.height);
        return;
      }
    }

    requestAnimationFrame(function () {
      if (video.videoWidth && video.videoHeight) {
        apply(video.videoWidth, video.videoHeight);
        return;
      }

      var master = typeof currentSrc === 'string' && currentSrc ? currentSrc : '';
      if (!master || master.indexOf('blob:') === 0) {
        var attrSrc = player.getAttribute('data-bunny-lightbox-src') || player.getAttribute('data-player-src') || '';
        if (attrSrc && attrSrc.indexOf('blob:') !== 0) master = attrSrc;
      }
      if (!master || !/^https?:/i.test(master)) return;

      fetch(master, { credentials: 'omit', cache: 'no-store' })
        .then(function (r) {
          if (!r.ok) throw new Error();
          return r.text();
        })
        .then(function (txt) {
          var lines = txt.split(/\r?\n/);
          var bestW = 0,
            bestH = 0,
            last = null;
          for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            if (line.indexOf('#EXT-X-STREAM-INF:') === 0) {
              last = line;
            } else if (last && line && line[0] !== '#') {
              var m = /RESOLUTION=(\d+)x(\d+)/.exec(last);
              if (m) {
                var W = parseInt(m[1], 10),
                  H = parseInt(m[2], 10);
                if (W > bestW) {
                  bestW = W;
                  bestH = H;
                }
              }
              last = null;
            }
          }
          if (bestW && bestH) apply(bestW, bestH);
        })
        .catch(function () {});
    });
  }
}

/* ============================================
   MARQUEE SCROLL DIRECTION
   ============================================ */
/*
function initMarqueeScrollDirection() {
  document.querySelectorAll('[data-marquee-scroll-direction-target]').forEach((marquee) => {
    // Query marquee elements
    const marqueeContent = marquee.querySelector('[data-marquee-collection-target]');
    const marqueeScroll = marquee.querySelector('[data-marquee-scroll-target]');
    if (!marqueeContent || !marqueeScroll) return;

    // Get data attributes
    const { marqueeSpeed: speed, marqueeDirection: direction, marqueeDuplicate: duplicate, marqueeScrollSpeed: scrollSpeed } = marquee.dataset;

    // Convert data attributes to usable types
    const marqueeSpeedAttr = parseFloat(speed);
    const marqueeDirectionAttr = direction === 'right' ? 1 : -1; // 1 for right, -1 for left
    const duplicateAmount = parseInt(duplicate || 0);
    const scrollSpeedAttr = parseFloat(scrollSpeed);
    const speedMultiplier = window.innerWidth < 479 ? 0.25 : window.innerWidth < 991 ? 0.5 : 1;

    let marqueeSpeed = marqueeSpeedAttr * (marqueeContent.offsetWidth / window.innerWidth) * speedMultiplier;

    // Precompute styles for the scroll container
    marqueeScroll.style.marginLeft = `${scrollSpeedAttr * -1}%`;
    marqueeScroll.style.width = `${(scrollSpeedAttr * 2) + 100}%`;

    // Duplicate marquee content
    if (duplicateAmount > 0) {
      const fragment = document.createDocumentFragment();
      for (let i = 0; i < duplicateAmount; i++) {
        fragment.appendChild(marqueeContent.cloneNode(true));
      }
      marqueeScroll.appendChild(fragment);
    }

    // GSAP animation for marquee content
    const marqueeItems = marquee.querySelectorAll('[data-marquee-collection-target]');
    const animation = gsap.to(marqueeItems, {
      xPercent: -100, // Move completely out of view
      repeat: -1,
      duration: marqueeSpeed,
      ease: 'linear'
    }).totalProgress(0.5);

    // Initialize marquee in the correct direction
    gsap.set(marqueeItems, { xPercent: marqueeDirectionAttr === 1 ? 100 : -100 });
    animation.timeScale(marqueeDirectionAttr); // Set correct direction
    animation.play(); // Start animation immediately

    // Set initial marquee status
    marquee.setAttribute('data-marquee-status', 'normal');

    // ScrollTrigger logic for direction inversion
    ScrollTrigger.create({
      trigger: marquee,
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: (self) => {
        const isInverted = self.direction === 1; // Scrolling down
        const currentDirection = isInverted ? -marqueeDirectionAttr : marqueeDirectionAttr;

        // Update animation direction and marquee status
        animation.timeScale(currentDirection);
        marquee.setAttribute('data-marquee-status', isInverted ? 'normal' : 'inverted');
      }
    });

    // Extra speed effect on scroll
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: marquee,
        start: '0% 100%',
        end: '100% 0%',
        scrub: 0
      }
    });

    const scrollStart = marqueeDirectionAttr === -1 ? scrollSpeedAttr : -scrollSpeedAttr;
    const scrollEnd = -scrollStart;

    tl.fromTo(marqueeScroll, { x: `${scrollStart}vw` }, { x: `${scrollEnd}vw`, ease: 'none' });
  });
}

// Initialize Marquee with Scroll Direction
document.addEventListener('DOMContentLoaded', () => {
  initMarqueeScrollDirection();
});

*/

/* ============================================
   SWIPER SLIDER (jQuery based)
   ============================================ */
function initSwiperSliders() {
  $('.slider-main_component').each(function () {
    let loopMode = false;
    if ($(this).attr('loop-mode') === 'true') {
      loopMode = true;
    }
    let sliderDuration = 300;
    if ($(this).attr('slider-duration') !== undefined) {
      sliderDuration = +$(this).attr('slider-duration');
    }
    new Swiper($(this).find('.swiper')[0], {
      speed: sliderDuration,
      loop: loopMode,
      autoHeight: false,
      centeredSlides: loopMode,
      followFinger: true,
      freeMode: false,
      slideToClickedSlide: false,
      slidesPerView: 'auto',
      spaceBetween: '0%',
      rewind: false,
      mousewheel: {
        forceToAxis: true,
      },
      keyboard: {
        enabled: true,
        onlyInViewport: true,
      },
      breakpoints: {
        480: {
          slidesPerView: 'auto',
          spaceBetween: '0%',
        },
        768: {
          slidesPerView: 'auto',
          spaceBetween: '0%',
        },
        992: {
          slidesPerView: 'auto',
          spaceBetween: '0%',
        },
      },
      pagination: {
        el: $(this).find('.swiper-bullet-wrapper')[0],
        bulletActiveClass: 'is-active',
        bulletClass: 'swiper-bullet',
        bulletElement: 'button',
        clickable: true,
      },
      navigation: {
        nextEl: $(this).find('.swiper-next')[0],
        prevEl: $(this).find('.swiper-prev')[0],
        disabledClass: 'is-disabled',
      },
      scrollbar: {
        el: $(this).find('.swiper-drag-wrapper')[0],
        draggable: true,
        dragClass: 'swiper-drag',
        snapOnRelease: true,
      },
      slideActiveClass: 'is-active',
      slideDuplicateActiveClass: 'is-active',
    });
  });
}

/* ============================================
   INIT ALL ON DOM READY
   ============================================ */
document.addEventListener('DOMContentLoaded', function () {
  initBunnyPlayerBackground();
  initNumberOdometer();
  initBunnyLightboxPlayer();
  if (typeof $ !== 'undefined' && typeof Swiper !== 'undefined') {
    initSwiperSliders();
  }
});





/* ============================================ */
/* AUTO TABS CHAGING FOR CASE STUDY */
 /*  ============================================ */

document.addEventListener('DOMContentLoaded', function () {
  const AUTOPLAY_DELAY = 5000; // 5s per slide

  // Scope to every .slider-auto-tab-component on page
  const components = document.querySelectorAll('.slider-auto-tab-component');

  components.forEach((component) => {
    const wrapper = component.querySelector('.swiper-wrapper.is-slider-main');
    if (!wrapper) return; // skip if structure missing

    const swiperEl = component.querySelector('.swiper.is-slider-main');
    if (!swiperEl) return;

    const originalSlides = Array.from(wrapper.querySelectorAll('.swiper-slide.is-slider-main'));
    const totalSlides = originalSlides.length;
    if (totalSlides === 0) return;

    // Duplicate slides, appended after last real slide
    originalSlides.forEach((slide) => {
      const clone = slide.cloneNode(true);
      clone.setAttribute('data-swiper-clone', 'true');
      wrapper.appendChild(clone);
    });

    const tabItems = component.querySelectorAll('.cs-tab-thumbs');
    const progressBars = component.querySelectorAll('.thumbs_progress-bar-active');

    const mainSwiper = new Swiper(swiperEl, {
      slidesPerView: 'auto',
      loop: false,
      observer: true,
      observeParents: true,
      autoplay: {
        delay: AUTOPLAY_DELAY,
        disableOnInteraction: false,
      },
      speed: 600,
      on: {
        init: function () {
          setActiveTab(this.activeIndex % totalSlides);
          startProgress(this.activeIndex % totalSlides);
        },
        slideChange: function () {
          setActiveTab(this.activeIndex % totalSlides);
          resetAllProgress();
          startProgress(this.activeIndex % totalSlides);
        },
        transitionEnd: function () {
          if (this.activeIndex >= totalSlides) {
            const realIndex = this.activeIndex - totalSlides;
            this.slideTo(realIndex, 0, false);
          }
        },
      },
    });

    tabItems.forEach((tab, index) => {
      tab.addEventListener('click', () => {
        mainSwiper.slideTo(index);
      });
    });

    function setActiveTab(activeIndex) {
      tabItems.forEach((tab, index) => {
        tab.classList.toggle('is-active', index === activeIndex);
      });
    }

    function resetAllProgress() {
      progressBars.forEach((bar) => {
        bar.style.transition = 'none';
        bar.style.width = '0%';
        bar.offsetHeight; // force reflow
      });
    }

    function startProgress(activeIndex) {
      const bar = progressBars[activeIndex];
      if (!bar) return;
      bar.style.transition = `width ${AUTOPLAY_DELAY}ms linear`;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          bar.style.width = '100%';
        });
      });
    }
  });
});






      
