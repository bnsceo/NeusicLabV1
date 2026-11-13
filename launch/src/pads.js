// NeusicWave landing: a neumorphic drum-pad board drawn in WebGL (Three.js, two custom shaders) that really plays.
// The pads and the surface are one colour; all the depth is light and shadow, worked out in the shaders.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const cv = document.getElementById('pads');
const COLS = 8, ROWS = 4, N = COLS * ROWS;
// Kick, snare, hat, rim: a dembow to start from.
const pattern = [1, 0, 0, 0, 1, 0, 0, 0, /**/ 0, 0, 0, 1, 0, 0, 1, 0, /**/ 1, 1, 1, 1, 1, 1, 1, 1, /**/ 0, 0, 1, 0, 0, 1, 0, 0];
const BPM = 96, STEP = 60 / BPM / 2;

function start() {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch (e) { return false; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.NoToneMapping;
  const css = getComputedStyle(document.documentElement);
  const base = new THREE.Color(css.getPropertyValue('--bg').trim() || '#e4e7ec'), led = new THREE.Color(css.getPropertyValue('--led').trim() || '#00b3c7');
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(24, 2, 0.1, 100);
  const press = new Float32Array(N), hit = new Float32Array(N), on = Float32Array.from(pattern);
  const U = { uBase: { value: base }, uLed: { value: led }, uPress: { value: press }, uTime: { value: 0 } };
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const COMMON = /* glsl */ `
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float sdRound(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }`;

  // The surface: for every pixel, the soft dark shadow a pad throws down-right and the soft light it throws up-left.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 10), new THREE.ShaderMaterial({
    transparent: true, uniforms: U,
    vertexShader: /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBase; uniform float uPress[${N}]; varying vec3 vW; ${COMMON}
      float padH(vec2 c){ if (c.x < 0.0 || c.x > ${COLS - 1}.0 || c.y < 0.0 || c.y > ${ROWS - 1}.0) return 0.0; return 1.0 - 0.8 * uPress[int(c.y) * ${COLS} + int(c.x)]; }
      void main(){
        vec2 gp = vec2(vW.x + ${((COLS - 1) / 2).toFixed(1)}, vW.z + ${((ROWS - 1) / 2).toFixed(1)}); // pad centres sit on whole numbers
        vec2 near = floor(gp + 0.5); float sh = 0.0, hi = 0.0;
        for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
          vec2 c = near + vec2(float(i), float(j)); float h = padH(c); if (h <= 0.0) continue;
          vec2 off = vec2(0.15) * h; float soft = 0.2 * h + 0.04;
          sh = max(sh, (1.0 - smoothstep(-0.03, soft, sdRound(gp - c - off, vec2(0.4), 0.13))) * h);
          hi = max(hi, (1.0 - smoothstep(-0.03, soft, sdRound(gp - c + off, vec2(0.4), 0.13))) * h);
        }
        vec3 col = uBase * (1.0 - 0.3 * sh) + vec3(0.22) * hi * (1.0 - sh);
        col += (hash(gl_FragCoord.xy) - 0.5) * 0.012;
        // the board melts into the page: no visible canvas edge
        float edge = sdRound(vW.xz, vec2(${COLS / 2}.0 + 0.5, ${ROWS / 2}.0 + 0.5), 0.6);
        gl_FragColor = vec4(col, 1.0 - smoothstep(0.0, 1.1, edge));
        #include <colorspace_fragment>
      }`,
  }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);

  // The pads: same colour as the surface. Sides catch the light or fall away from it; a pad that is on sinks, turns concave and lights its lamp.
  const geo = new RoundedBoxGeometry(0.8, 0.26, 0.8, 5, 0.1), pads = [];
  for (let i = 0; i < N; i++) {
    const u = { uBase: U.uBase, uLed: U.uLed, uOn: { value: 0 }, uHit: { value: 0 } };
    const m = new THREE.Mesh(geo, new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vL; void main(){ vN = normalize(mat3(modelMatrix) * normal); vL = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uBase, uLed; uniform float uOn, uHit; varying vec3 vN; varying vec3 vL; ${COMMON}
        void main(){
          vec3 n = normalize(vN); float top = smoothstep(0.75, 0.97, n.y);
          float lit = dot(n.xz, vec2(-0.7071)); // up-left faces are lit, down-right faces are in shade
          vec3 col = uBase * (1.0 + 0.2 * lit * (1.0 - top)) + vec3(0.1) * max(lit, 0.0) * (1.0 - top);
          // on: the top turns into a shallow dish (dark on its up-left inner wall, light on its down-right one)
          float d = sdRound(vL.xz, vec2(0.31), 0.09), dish = smoothstep(-0.2, -0.03, d) * step(d, 0.0); // strongest near the rim of the dish, nothing in its middle
          float side = dot(normalize(vL.xz + 1e-4), vec2(-0.7071));
          col -= uBase * 0.3 * dish * max(side, 0.0) * uOn * top; col += vec3(0.2) * dish * max(-side, 0.0) * uOn * top;
          // the lamp: a small soft dot, brighter for an instant when the step plays
          float lamp = (1.0 - smoothstep(0.045, 0.075, length(vL.xz - vec2(0.0, -0.2)))) * top;
          col = mix(col, mix(uBase * 0.82, uLed, uOn), lamp);
          col += uLed * (1.0 - smoothstep(0.0, 0.36, length(vL.xz - vec2(0.0, -0.2)))) * top * uOn * (0.1 + 0.55 * uHit);
          col += vec3(0.05) * uHit * top;
          col += (hash(gl_FragCoord.xy) - 0.5) * 0.012;
          gl_FragColor = vec4(col, 1.0);
          #include <colorspace_fragment>
        }`,
    }));
    m.position.set((i % COLS) - (COLS - 1) / 2, 0.13, Math.floor(i / COLS) - (ROWS - 1) / 2); m.userData = { i, u };
    scene.add(m); pads.push(m);
  }

  // Sound: four small synthesized drums. Nothing is loaded.
  let ac = null, noise = null, playing = false;
  function audio() {
    if (ac) return ac;
    const A = window.AudioContext || window.webkitAudioContext; if (!A) return null;
    ac = new A(); noise = ac.createBuffer(1, ac.sampleRate * 0.4, ac.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ac;
  }
  function env(g, t, peak, len) { g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.0008, t + len); }
  function tone(type, f0, f1, len, peak) { const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + len); env(g, t, peak, len); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + len + 0.02); }
  function hiss(freq, len, peak, q) { const t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noise; f.type = q ? 'bandpass' : 'highpass'; f.frequency.value = freq; if (q) f.Q.value = q; env(g, t, peak, len); s.connect(f).connect(g).connect(ac.destination); s.start(t); s.stop(t + len + 0.02); }
  const voice = [() => tone('sine', 150, 42, 0.32, 0.9), () => { hiss(1800, 0.18, 0.5, 0.8); tone('triangle', 220, 150, 0.1, 0.3); }, () => hiss(7500, 0.05, 0.22, 0), () => tone('square', 1700, 900, 0.035, 0.18)];
  const sound = (row) => { if (ac && ac.state === 'running') voice[row](); };

  // Clock. shortcut: steps are timed on animation frames, fine for a demo board; the Studio schedules on the audio clock.
  let step = -1, t0 = performance.now() / 1000, last = t0, raf = 0, W = 1, H = 1, hot = true;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function resize() {
    W = cv.clientWidth || 1; H = cv.clientHeight || 1; renderer.setSize(W, H, false); camera.aspect = W / H;
    // fit the board's width (and its height on wide screens) with the camera tilted down at it
    const fovH = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
    const dist = Math.max((COLS + 1.3) / 2 / Math.tan(fovH / 2), (ROWS * 0.86 + 1.1) / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    camera.position.set(0, dist * 0.86, dist * 0.52); camera.lookAt(0, 0, 0.1); camera.updateProjectionMatrix(); hot = true;
  }
  function frame() {
    raf = requestAnimationFrame(frame);
    const now = performance.now() / 1000, dt = Math.min(now - last, 0.05); last = now;
    if (document.hidden) return;
    if (playing) {
      const s = Math.floor((now - t0) / STEP) % COLS;
      if (s !== step) { step = s; for (let r = 0; r < ROWS; r++) { const i = r * COLS + s; hit[i] = 1; if (on[i]) sound(r); } hot = true; }
    }
    let moving = false;
    for (let i = 0; i < N; i++) {
      const target = on[i] ? 0.55 : 0, p0 = press[i];
      press[i] = THREE.MathUtils.damp(press[i], Math.min(1, target + hit[i] * 0.45), 18, dt); hit[i] = THREE.MathUtils.damp(hit[i], 0, 9, dt);
      const m = pads[i]; m.position.y = 0.13 - press[i] * 0.2; m.userData.u.uOn.value = THREE.MathUtils.damp(m.userData.u.uOn.value, on[i], 14, dt); m.userData.u.uHit.value = hit[i];
      if (Math.abs(press[i] - p0) > 1e-4 || hit[i] > 1e-3) moving = true;
    }
    if (!hot && !moving) return; // nothing changed: skip the draw
    hot = false; renderer.render(scene, camera);
  }
  function pick(e) { const r = cv.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); const h = ray.intersectObjects(pads, false)[0]; return h ? h.object.userData.i : -1; }
  cv.addEventListener('pointermove', (e) => { cv.style.cursor = pick(e) >= 0 ? 'pointer' : ''; });
  cv.addEventListener('pointerdown', (e) => {
    const i = pick(e); if (i < 0) return;
    on[i] = on[i] ? 0 : 1; hit[i] = 1; hot = true;
    if (audio()) { ac.resume(); if (on[i]) voice[Math.floor(i / COLS)](); }
  });
  const btn = document.getElementById('play');
  function setPlaying(v) {
    playing = v && !!audio(); if (playing) { ac.resume(); t0 = performance.now() / 1000; step = -1; }
    if (btn) { btn.setAttribute('aria-pressed', String(playing)); btn.querySelector('span').textContent = playing ? btn.dataset.stop : btn.dataset.play; }
  }
  if (btn) btn.addEventListener('click', () => setPlaying(!playing));
  const clear = document.getElementById('clear'); if (clear) clear.addEventListener('click', () => { on.fill(0); hot = true; });
  addEventListener('resize', resize); addEventListener('pagehide', () => { cancelAnimationFrame(raf); if (ac) ac.close(); renderer.dispose(); geo.dispose(); });
  cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); cancelAnimationFrame(raf); document.documentElement.classList.remove('gl'); });
  document.documentElement.classList.add('gl'); resize();
  if (still) for (let i = 0; i < N; i++) { press[i] = on[i] ? 0.55 : 0; pads[i].userData.u.uOn.value = on[i]; }
  raf = requestAnimationFrame(frame);
  window.__pads = { on, get playing() { return playing; }, renderer };
  return true;
}
if (cv) start();
