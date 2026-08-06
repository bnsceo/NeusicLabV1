/* =========================================================================
   BNS Foundry — shared behavior
   Progressive enhancement throughout: every section below is skipped when its
   markup isn't on the page, so one file serves the home, project, and about
   pages without per-page branching.
   ========================================================================= */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isTouch = window.matchMedia('(hover: none)').matches;
  var FIELDS = ['intelligence', 'sound', 'stories', 'knowledge'];

  /* ------------------------------------------------------------------ menu */
  var menuBtn = document.getElementById('menuBtn');
  var overlayNav = document.getElementById('overlayNav');
  if (menuBtn && overlayNav) {
    var setMenu = function (open) {
      overlayNav.classList.toggle('is-open', open);
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    menuBtn.addEventListener('click', function () {
      setMenu(!overlayNav.classList.contains('is-open'));
    });
    overlayNav.querySelectorAll('[data-nav-close]').forEach(function (a) {
      a.addEventListener('click', function () { setMenu(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlayNav.classList.contains('is-open')) {
        setMenu(false);
        menuBtn.focus();
      }
    });
    document.addEventListener('click', function (e) {
      if (!overlayNav.contains(e.target) && !menuBtn.contains(e.target)) setMenu(false);
    });
  }

  /* ------------------------------------------------------- canvas plumbing */
  function fitCanvas(c) {
    var rect = c.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.max(1, Math.round(rect.width * dpr));
    c.height = Math.max(1, Math.round(rect.height * dpr));
    var ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: rect.width, h: rect.height };
  }

  function seededRand(seed) {
    return function () { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  }

  /* Motifs are pure draw functions over a cached `geo` object. Geometry is
     rebuilt only on resize (see ensureGeo), never per frame — the node graph
     in particular is O(n^2) and rebuilding it at 60fps was the whole cost. */

  var motifs = {
    '': {
      geo: function (w, h, seed) {
        var rnd = seededRand(seed), pts = [];
        var n = Math.max(18, Math.round((w * h) / 34000));
        for (var i = 0; i < n; i++) pts.push({ x: rnd() * w, y: rnd() * h, r: 1 + rnd() * 0.6, i: i });
        return pts;
      },
      draw: function (ctx, w, h, t, color, geo) {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = color;
        for (var i = 0; i < geo.length; i++) {
          var p = geo[i];
          var x = (p.x + t * 0.004 * (p.i % 3 ? 1 : -1)) % w;
          ctx.globalAlpha = 0.12 + 0.1 * Math.sin(t * 0.0006 + p.i);
          ctx.beginPath(); ctx.arc((x + w) % w, p.y, p.r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    },

    /* Intelligence — a graph that keeps finding its own connections. */
    intelligence: {
      geo: function (w, h, seed) {
        var rnd = seededRand(seed);
        var cols = Math.max(6, Math.round(w / 120)), rows = Math.max(4, Math.round(h / 120));
        var pts = [], edges = [];
        for (var y = 0; y <= rows; y++)
          for (var x = 0; x <= cols; x++)
            pts.push({ x: (x / cols) * w + (rnd() - 0.5) * 40, y: (y / rows) * h + (rnd() - 0.5) * 40 });
        for (var i = 0; i < pts.length; i++)
          for (var j = i + 1; j < pts.length; j++) {
            var dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
            var d = Math.sqrt(dx * dx + dy * dy);
            if (d < 130) edges.push({ a: i, b: j, alpha: (1 - d / 130) * 0.35 });
          }
        return { pts: pts, edges: edges };
      },
      draw: function (ctx, w, h, t, color, geo) {
        ctx.clearRect(0, 0, w, h);
        var pts = geo.pts, edges = geo.edges;
        ctx.strokeStyle = color; ctx.lineWidth = 1;
        for (var e = 0; e < edges.length; e++) {
          var ed = edges[e];
          ctx.globalAlpha = ed.alpha;
          ctx.beginPath();
          ctx.moveTo(pts[ed.a].x, pts[ed.a].y);
          ctx.lineTo(pts[ed.b].x, pts[ed.b].y);
          ctx.stroke();
        }
        ctx.fillStyle = color; ctx.globalAlpha = 0.5;
        for (var i = 0; i < pts.length; i++) {
          ctx.beginPath(); ctx.arc(pts[i].x, pts[i].y, 1.6, 0, Math.PI * 2); ctx.fill();
        }
        var idx = Math.floor(t / 900) % Math.max(1, pts.length - 1);
        var a = pts[idx], b = pts[(idx + 7) % pts.length];
        if (a && b) {
          var pct = (t % 900) / 900;
          ctx.globalAlpha = 1;
          ctx.beginPath();
          ctx.arc(a.x + (b.x - a.x) * pct, a.y + (b.y - a.y) * pct, 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    },

    /* Sound — a spectrum that leans toward the cursor. */
    sound: {
      geo: function (w, h, seed) { return { bars: 48, seed: seed }; },
      draw: function (ctx, w, h, t, color, geo, mx) {
        ctx.clearRect(0, 0, w, h);
        var bars = geo.bars, bw = w / bars;
        ctx.fillStyle = color;
        for (var i = 0; i < bars; i++) {
          var cx = i * bw + bw / 2;
          var proximity = mx != null ? Math.max(0, 1 - Math.abs(cx - mx) / (w * 0.35)) : 0;
          var freq = 0.4 + (i % 6) * 0.22;
          var amp = Math.sin(t * 0.0032 * freq + i * 0.5 + geo.seed) * 0.5 + 0.5;
          var bh = 6 + amp * (h * 0.32) + proximity * (h * 0.28);
          ctx.globalAlpha = 0.3 + amp * 0.45 + proximity * 0.3;
          ctx.fillRect(cx - bw * 0.32, (h - bh) / 2, bw * 0.64, bh);
        }
        ctx.globalAlpha = 1;
      }
    },

    /* Stories — grain, vignette, and a horizon that will not sit still. */
    stories: {
      geo: function (w, h, seed) { return { seed: seed }; },
      draw: function (ctx, w, h, t, color, geo) {
        ctx.clearRect(0, 0, w, h);
        var g = ctx.createRadialGradient(w * 0.7, h * 0.35, 0, w * 0.7, h * 0.35, w * 0.75);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        var rnd = seededRand(Math.floor(t / 70) + geo.seed);
        ctx.fillStyle = '#fff';
        for (var i = 0; i < 140; i++) {
          ctx.globalAlpha = rnd() * 0.05;
          ctx.fillRect(rnd() * w, rnd() * h, 1, 1);
        }
        ctx.strokeStyle = color; ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
        ctx.beginPath();
        for (var x = 0; x <= w; x += 6) {
          var y = h * 0.72 + Math.sin(x * 0.01 + t * 0.0004 + geo.seed) * h * 0.05;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    },

    /* Knowledge — roots working downward, the way a source tree does. */
    knowledge: {
      geo: function (w, h, seed) {
        var branches = [];
        for (var b = 0; b < 5; b++) {
          var rnd = seededRand(seed + b * 17);
          var x = w * (0.12 + b * 0.19), y = h * (0.15 + rnd() * 0.1);
          var segs = [{ x: x, y: y }], spurs = [];
          for (var s = 0; s < 9; s++) {
            var nx = x + (rnd() - 0.35) * w * 0.05;
            var ny = y + (h * 0.7) / 9;
            segs.push({ x: nx, y: ny, phase: s + b });
            if (rnd() > 0.62) spurs.push({ x: nx, y: ny, dx: (rnd() - 0.5) * 40, dy: -rnd() * 30 });
            x = nx; y = ny;
          }
          branches.push({ segs: segs, spurs: spurs });
        }
        return branches;
      },
      draw: function (ctx, w, h, t, color, geo) {
        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.globalAlpha = 0.38;
        for (var b = 0; b < geo.length; b++) {
          var br = geo[b], segs = br.segs;
          ctx.beginPath();
          ctx.moveTo(segs[0].x, segs[0].y);
          for (var s = 1; s < segs.length; s++) {
            var py = segs[s - 1].y, ny = segs[s].y + Math.sin(t * 0.0003 + segs[s].phase) * 4;
            ctx.quadraticCurveTo(segs[s - 1].x, (py + ny) / 2, segs[s].x, ny);
          }
          ctx.stroke();
          ctx.beginPath();
          for (var p = 0; p < br.spurs.length; p++) {
            var sp = br.spurs[p];
            ctx.moveTo(sp.x, sp.y);
            ctx.lineTo(sp.x + sp.dx, sp.y + sp.dy);
          }
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }
  };

  var accentVar = {
    '': '--idle-accent', intelligence: '--intel-accent', sound: '--sound-accent',
    stories: '--stories-accent', knowledge: '--knowledge-accent'
  };

  /* Every animated canvas registers here. The loop only touches canvases that
     are on screen, so the four reel panels cost nothing until scrolled to. */
  var scenes = [];

  function registerCanvas(el, opts) {
    var scene = {
      el: el,
      field: opts.field,                 // fixed field, or null to read from `follow`
      follow: opts.follow || null,       // element whose data-field drives the motif
      seed: opts.seed || 42,
      trackMouse: !!opts.trackMouse,
      fit: null, geo: null, geoField: null, geoW: 0, geoH: 0,
      visible: true, mouseX: null
    };
    scenes.push(scene);

    if (scene.trackMouse) {
      var host = opts.mouseHost || el.parentNode;
      host.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        scene.mouseX = e.clientX - r.left;
      });
      host.addEventListener('mouseleave', function () { scene.mouseX = null; });
    }
    return scene;
  }

  function sceneField(scene) {
    if (scene.field != null) return scene.field;
    return (scene.follow && scene.follow.dataset.field) || '';
  }

  function ensureGeo(scene, field, w, h) {
    if (scene.geo && scene.geoField === field && scene.geoW === w && scene.geoH === h) return;
    var motif = motifs[field] || motifs[''];
    scene.geo = motif.geo(w, h, scene.seed);
    scene.geoField = field; scene.geoW = w; scene.geoH = h;
  }

  function refit(scene) {
    scene.fit = fitCanvas(scene.el);
    scene.geo = null; // force geometry rebuild at the new size
  }

  var rootStyle = null;
  function accent(field) {
    if (!rootStyle) rootStyle = getComputedStyle(document.documentElement);
    return rootStyle.getPropertyValue(accentVar[field] || '--idle-accent').trim() || '#888';
  }

  function renderScene(scene, t) {
    if (!scene.fit || !scene.visible) return;
    var field = sceneField(scene);
    var motif = motifs[field] || motifs[''];
    ensureGeo(scene, field, scene.fit.w, scene.fit.h);
    motif.draw(scene.fit.ctx, scene.fit.w, scene.fit.h, t, accent(field), scene.geo, scene.mouseX);
  }

  function startLoop() {
    if (!scenes.length) return;
    scenes.forEach(refit);

    if ('IntersectionObserver' in window) {
      var vis = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var scene = scenes.filter(function (s) { return s.el === en.target; })[0];
          if (scene) scene.visible = en.isIntersecting;
        });
      }, { rootMargin: '120px' });
      scenes.forEach(function (s) { vis.observe(s.el); });
    }

    if (reduceMotion) {
      // One static composition, no rAF. The motifs still read as artwork.
      scenes.forEach(function (s) { s.visible = true; renderScene(s, 0); });
    } else {
      var frame = function (t) {
        for (var i = 0; i < scenes.length; i++) renderScene(scenes[i], t);
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }

    var resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        scenes.forEach(refit);
        if (reduceMotion) scenes.forEach(function (s) { renderScene(s, 0); });
      }, 150);
    });
  }

  /* ----------------------------------------------------------- switchboard */
  var board = document.querySelector('.switchboard');
  if (board) {
    var frameEl = document.querySelector('.mockup-frame') || document.body;
    var heroCanvas = document.getElementById('fieldCanvas');
    if (heroCanvas) {
      registerCanvas(heroCanvas, { field: null, follow: board, seed: 42, trackMouse: true, mouseHost: board });
    }

    var fieldEls = Array.prototype.slice.call(document.querySelectorAll('.field'));
    var leaveTimer = null;

    var activate = function (key) {
      clearTimeout(leaveTimer);
      board.dataset.field = key;
      frameEl.dataset.field = key;
      board.classList.add('is-active');
      fieldEls.forEach(function (el) { el.classList.toggle('is-current', el.dataset.field === key); });
    };
    var scheduleDeactivate = function () {
      clearTimeout(leaveTimer);
      leaveTimer = setTimeout(function () {
        board.classList.remove('is-active');
        board.dataset.field = '';
        frameEl.dataset.field = '';
        fieldEls.forEach(function (el) { el.classList.remove('is-current'); });
      }, 140);
    };

    fieldEls.forEach(function (el) {
      var link = el.querySelector('a') || el;
      el.addEventListener('mouseenter', function () { if (!isTouch) activate(el.dataset.field); });
      link.addEventListener('focus', function () { activate(el.dataset.field); });
      // On touch there's no hover, so the first tap previews the field and a
      // second tap on the same one follows the link.
      link.addEventListener('click', function (e) {
        if (isTouch && board.dataset.field !== el.dataset.field) {
          e.preventDefault();
          activate(el.dataset.field);
        }
      });
    });
    board.addEventListener('mouseleave', function () { if (!isTouch) scheduleDeactivate(); });
    board.addEventListener('mouseenter', function () { clearTimeout(leaveTimer); });
    board.addEventListener('focusout', function (e) {
      if (!board.contains(e.relatedTarget)) scheduleDeactivate();
    });

    // Arrow keys walk the rail once anything in it has focus.
    board.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      var current = FIELDS.indexOf(board.dataset.field);
      if (current === -1) return;
      e.preventDefault();
      var next = (current + (e.key === 'ArrowDown' ? 1 : -1) + FIELDS.length) % FIELDS.length;
      var target = fieldEls.filter(function (el) { return el.dataset.field === FIELDS[next]; })[0];
      if (target) (target.querySelector('a') || target).focus();
    });

    var touchStartX = null;
    board.addEventListener('touchstart', function (e) { touchStartX = e.touches[0].clientX; }, { passive: true });
    board.addEventListener('touchend', function (e) {
      if (touchStartX == null) return;
      var dx = e.changedTouches[0].clientX - touchStartX;
      touchStartX = null;
      if (Math.abs(dx) < 50) return;
      var idx = FIELDS.indexOf(board.dataset.field);
      if (idx === -1) idx = dx < 0 ? -1 : 0;
      else idx = dx < 0 ? idx + 1 : idx - 1;
      activate(FIELDS[(idx + FIELDS.length) % FIELDS.length]);
    }, { passive: true });
  }

  /* ------------------------------------------------------------------ reel */
  var track = document.getElementById('reelTrack');
  if (track) {
    var panels = Array.prototype.slice.call(track.children);
    var dotsWrap = document.getElementById('reelDots');
    var reelCurrentEl = document.getElementById('reelCurrent');

    panels.forEach(function (p, i) {
      var c = p.querySelector('canvas');
      if (c) registerCanvas(c, { field: p.dataset.field, seed: 100 + i * 30 });
    });

    if (dotsWrap) {
      panels.forEach(function (_, i) {
        var dot = document.createElement('span');
        dot.className = 'reel__dot' + (i === 0 ? ' is-active' : '');
        dotsWrap.appendChild(dot);
      });
      var dots = Array.prototype.slice.call(dotsWrap.children);
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting && entry.intersectionRatio > 0.55) {
              var i = panels.indexOf(entry.target);
              if (reelCurrentEl) reelCurrentEl.textContent = String(i + 1).padStart(2, '0');
              dots.forEach(function (d, di) { d.classList.toggle('is-active', di === i); });
            }
          });
        }, { root: track, threshold: [0.55] });
        panels.forEach(function (p) { io.observe(p); });
      }
    }
  }

  /* -------------------------------------------------- project page backdrop */
  var projectHero = document.querySelector('[data-project-canvas]');
  if (projectHero) {
    registerCanvas(projectHero, {
      field: projectHero.dataset.projectCanvas,
      seed: 77,
      trackMouse: true,
      mouseHost: projectHero.closest('.project__hero') || projectHero.parentNode
    });
  }

  startLoop();
})();
