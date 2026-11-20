// The DJ section: two turntables, a mixer and two beat-grid screens, drawn in WebGL in the same dark neumorphic material as the pad board.
// A picture of the Studio's DJ view, not a working deck: nothing here scratches or makes sound. The drums the visitor plays on the hero board make the mixer lights pulse.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { on as onBeat } from './beat.js';

const cv = document.getElementById('decks');
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = innerWidth < 700;
const PLAT = [[-2.05, 0.55], [2.05, 0.55]], MIX = [0, 0.55], STRIP = [[-2.05, -1.3], [2.05, -1.3]];
const RPM = [33.333, 45].map((r) => (r / 60) * Math.PI * 2), BPS = [96 / 60, 124 / 60]; // platter speeds (rad/s) and beat-grid speeds (beats/s)

function start() {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch (e) { return false; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, small ? 1.5 : 2));
  renderer.toneMapping = THREE.NoToneMapping;
  const css = getComputedStyle(document.documentElement);
  const neon = (v, d) => new THREE.Color(css.getPropertyValue(v).trim() || d);
  const base = neon('--bg', '#11131e'), led = neon('--led', '#5fd0ff'), pink = neon('--pink', '#ff6fb0'), violet = neon('--violet', '#a070ee');
  const lift = (parseFloat(css.getPropertyValue('--pad-lift')) || 1).toFixed(4);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(24, 2, 0.1, 100);
  const tex = new THREE.TextureLoader().load('/assets/site/logo.jpg', (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); });
  tex.colorSpace = THREE.SRGBColorSpace;
  const T = { uTime: { value: 0 }, uPulse: { value: 0 } };

  const COMMON = /* glsl */ `
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float sdR(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
    vec3 shade(vec3 n, vec3 b){ float l = dot(n.xz, vec2(-0.7071)); return b * (1.0 + 0.2 * l) + vec3(0.1 * ${lift}) * max(l, 0.0); }`;
  const VERT = /* glsl */ `varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(mat3(modelMatrix) * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  // One material recipe for every object: the sides are shaded like the pads, `frag` paints the top face (where `top` is 1) into `col`; `decl` declares its extra uniforms.
  const mk = (frag, uniforms = {}, decl = '') => new THREE.ShaderMaterial({ uniforms: { uBase: { value: base }, uLed: { value: led }, ...T, ...uniforms }, vertexShader: VERT,
    fragmentShader: `uniform vec3 uBase, uLed; uniform float uTime, uPulse; ${decl} varying vec3 vN; varying vec3 vP; ${COMMON}
      void main(){
        vec3 n = normalize(vN); float top = smoothstep(0.75, 0.97, n.y); vec3 col = shade(n, uBase);
        ${frag}
        col += (hash(gl_FragCoord.xy) - 0.5) * 0.012 * ${lift};
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }` });

  // The surface: every object throws a soft shadow down-right and a soft light up-left, and the mixer lights it on the beat.
  const shapes = `float shape(vec2 p, int k){ if (k == 0) return length(p - vec2(${PLAT[0]})) - 1.0; if (k == 1) return length(p - vec2(${PLAT[1]})) - 1.0;
    if (k == 2) return sdR(p - vec2(${MIX}), vec2(0.66, 1.25), 0.18); if (k == 3) return sdR(p - vec2(${STRIP[0]}), vec2(1.05, 0.32), 0.12); return sdR(p - vec2(${STRIP[1]}), vec2(1.05, 0.32), 0.12); }`;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 12), new THREE.ShaderMaterial({
    transparent: true, uniforms: { uBase: { value: base }, uLed: { value: led }, ...T },
    vertexShader: /* glsl */ `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBase, uLed; uniform float uPulse; varying vec3 vW; ${COMMON} ${shapes}
      void main(){
        vec2 p = vW.xz; float sh = 0.0, hi = 0.0; vec2 off = vec2(0.16);
        for (int k = 0; k < 5; k++) {
          sh = max(sh, 1.0 - smoothstep(-0.03, 0.3, shape(p - off, k)));
          hi = max(hi, 1.0 - smoothstep(-0.03, 0.3, shape(p + off, k)));
        }
        // shade and light laid over the page behind (premultiplied, in screen colour), so no edge shows and the mixer's light spills out
        vec3 add = vec3(0.9 * ${lift}) * hi * (1.0 - sh) + max(pow(uLed * exp(-length(p - vec2(${MIX})) * 1.1) * 0.05 * (0.4 + uPulse), vec3(0.45)) - 0.06, 0.0) * (1.0 - sh);
        gl_FragColor = vec4(add, 0.17 * sh);
      }`, premultipliedAlpha: true }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);

  // A turntable: grooves that catch the light where the pointer is, a strobe ring, and the logo as the label, spinning.
  const decks = [0, 1].map((d) => {
    const u = { uSpin: { value: 0 }, uLightA: { value: 0 }, uTex: { value: tex } };
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.16, 72), mk(/* glsl */ `
      vec2 p = vP.xz; float r = length(p), a = atan(p.y, p.x);
      float groove = 0.5 + 0.5 * sin(r * 260.0);
      float band = smoothstep(0.36, 0.38, r) * (1.0 - smoothstep(0.915, 0.935, r));
      float w = pow(max(cos(a - uLightA), 0.0), 12.0) + pow(max(cos(a - uLightA - 3.14159), 0.0), 12.0);
      vec3 t = vec3(0.004, 0.004, 0.007) + vec3(0.05, 0.06, 0.11) * w * (0.3 + 0.7 * groove) * band + vec3(0.003) * groove * band;
      t = mix(t, uBase * 1.15, smoothstep(0.935, 0.95, r)); // the raised rim is the surface colour
      float da = abs(fract((a + uSpin) * 60.0 / 6.28318) - 0.5); // strobe dots turn with the platter
      t = mix(t, vec3(0.2, 0.23, 0.32), (1.0 - smoothstep(0.1, 0.18, da)) * step(0.962, r) * step(r, 0.988));
      float cs = cos(uSpin), sn = sin(uSpin); vec2 lp = vec2(cs * p.x - sn * p.y, sn * p.x + cs * p.y) / 0.37;
      vec4 tx = texture2D(uTex, vec2(lp.x, -lp.y) * 0.5 + 0.5);
      t = mix(t, mix(vec3(0.01), tx.rgb, tx.a), 1.0 - smoothstep(0.355, 0.37, r));
      float x = (r - 0.385) / 0.012; t += uLed * exp(-x * x) * (0.1 + 0.5 * uPulse);
      t = mix(t, vec3(0.45, 0.47, 0.55), 1.0 - smoothstep(0.02, 0.03, r)); // spindle
      col = mix(col, t, top);`, u, 'uniform float uSpin, uLightA; uniform sampler2D uTex;'));
    m.position.set(PLAT[d][0], 0.08, PLAT[d][1]); m.userData = { u, d }; scene.add(m); return m;
  });

  // The mixer: two channel faders, a crossfader, two level columns that rest low and jump when a drum plays on the hero board.
  const mixer = new THREE.Mesh(new RoundedBoxGeometry(1.32, 0.2, 2.5, 4, 0.1), mk(/* glsl */ `
    vec2 p = vP.xz; vec3 t = uBase * 1.02;
    for (int s = 0; s < 2; s++) {
      float x = s == 0 ? -0.27 : 0.27, cz = (s == 0 ? 0.25 : -0.2) + 0.12 * sin(uTime * 0.35 + float(s) * 2.1);
      t = mix(t, uBase * 0.25, 1.0 - smoothstep(-0.008, 0.008, sdR(p - vec2(x, -0.1), vec2(0.03, 0.78), 0.03)));
      float sd = sdR(p - vec2(x + 0.02, cz - 0.07), vec2(0.115, 0.055), 0.025), cap = sdR(p - vec2(x, cz - 0.1), vec2(0.115, 0.055), 0.025);
      t *= 1.0 - 0.4 * (1.0 - smoothstep(-0.01, 0.03, sd)) * step(0.0, cap);
      t = mix(t, uBase * 1.6, 1.0 - smoothstep(-0.006, 0.006, cap));
      t = mix(t, uLed, (1.0 - smoothstep(0.0, 0.01, abs(p.y - (cz - 0.1)))) * step(abs(p.x - x), 0.09) * step(cap, 0.0));
    }
    float cx = 0.2 * sin(uTime * 0.25);
    t = mix(t, uBase * 0.25, 1.0 - smoothstep(-0.008, 0.008, sdR(p - vec2(0.0, 1.0), vec2(0.4, 0.028), 0.028)));
    t = mix(t, uBase * 1.6, 1.0 - smoothstep(-0.006, 0.006, sdR(p - vec2(cx, 0.97), vec2(0.06, 0.1), 0.025)));
    for (int s = 0; s < 2; s++) { // level columns: ten segments, rest low, rise with the beat
      float x = s == 0 ? -0.53 : 0.53, ib = floor((0.75 - p.y) / 0.17), fz = fract((0.75 - p.y) / 0.17);
      float level = 0.22 + 0.12 * sin(uTime * 1.1 + float(s) * 1.7) + 0.62 * uPulse * (s == 0 ? 1.0 : 0.8);
      float seg = step(abs(p.x - x), 0.05) * step(0.0, ib) * step(ib, 9.0) * step(0.12, fz) * step(fz, 0.88);
      vec3 lc = ib >= 8.0 ? uPink : uLed;
      t = mix(t, ib < level * 10.0 ? lc * 1.1 : uBase * 0.45, seg);
    }
    col = mix(col, t, top);`, { uPink: { value: pink } }, 'uniform vec3 uPink;'));
  mixer.position.set(MIX[0], 0.1, MIX[1]); scene.add(mixer);

  // Beat-grid screens: a waveform scrolling past a playhead with the beat grid over it, as the DJ view shows a loaded track.
  const strips = [0, 1].map((d) => {
    const c = d ? pink : led, m = new THREE.Mesh(new RoundedBoxGeometry(2.1, 0.08, 0.64, 4, 0.04), mk(/* glsl */ `
      vec2 s = vec2(vP.x / 1.05, vP.z / 0.32); vec3 t = vec3(0.002, 0.003, 0.006);
      float x = s.x * 3.0 + uTime * uBps, ci = floor(x * 40.0), f = fract(x * 40.0);
      float amp = (0.3 + 0.55 * pow(1.0 - fract(x), 2.0)) * (0.45 + 0.55 * hash(vec2(ci, uSeed)));
      t += uColor * step(abs(s.y), amp * 0.85) * step(0.12, f) * step(f, 0.88) * (s.x < 0.0 ? 0.3 : 0.75);
      float g = abs(fract(x + 0.5) - 0.5), fw = fwidth(x); t = mix(t, vec3(0.1, 0.12, 0.2), (1.0 - smoothstep(fw * 0.6, fw * 1.4, g)) * 0.7);
      t = mix(t, vec3(0.9), (1.0 - smoothstep(0.0, 0.012, abs(s.x))) * 0.9);
      t *= 1.0 - 0.7 * smoothstep(0.75, 1.0, abs(s.x));
      col = mix(col, t, top);`, { uColor: { value: c }, uBps: { value: BPS[d] }, uSeed: { value: d * 7.0 } }, 'uniform vec3 uColor; uniform float uBps, uSeed;'));
    m.position.set(STRIP[d][0], 0.04, STRIP[d][1]); scene.add(m); return m;
  });

  // Camera: fits the board's width, tilted down at it, swaying a little toward the pointer. The light on the grooves follows the pointer too.
  const tilt = [0, 0], tiltTo = [0, 0], lightTo = new THREE.Vector2(0, 0), light = new THREE.Vector2(0, 0), ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), pt = new THREE.Vector3();
  let dist = 12, pointer = false, visible = true, raf = 0, last = performance.now() / 1000, time = 0, pulse = 0;
  const spin = [0.6, 2.1];
  const place = () => { camera.position.set(tilt[0] * 0.4, dist * 0.86 + tilt[1] * 0.25, dist * 0.52); camera.lookAt(0, 0, 0.1); };
  function resize() {
    const W = cv.clientWidth || 1, H = cv.clientHeight || 1; renderer.setSize(W, H, false); camera.aspect = W / H;
    const fovH = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
    dist = Math.max(3.5 / Math.tan(fovH / 2), (1.75 * 0.86 + 0.2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    place(); camera.updateProjectionMatrix();
  }
  function draw(dt) {
    time += dt; pulse *= Math.exp(-5 * dt);
    T.uTime.value = time; T.uPulse.value = pulse;
    const k = 1 - Math.exp(-4 * dt); tilt[0] += (tiltTo[0] - tilt[0]) * k; tilt[1] += (tiltTo[1] - tilt[1]) * k; place();
    if (!pointer) lightTo.set(Math.cos(time * 0.3) * 3, Math.sin(time * 0.3) * 3); light.lerp(lightTo, 1 - Math.exp(-5 * dt));
    for (const m of decks) { const d = m.userData.d; spin[d] += still ? 0 : dt * RPM[d]; m.userData.u.uSpin.value = spin[d]; m.userData.u.uLightA.value = Math.atan2(light.y - PLAT[d][1], light.x - PLAT[d][0]); }
    renderer.render(scene, camera);
  }
  function frame() {
    raf = requestAnimationFrame(frame);
    const now = performance.now() / 1000, dt = Math.min(now - last, 0.05); last = now;
    if (document.hidden || !visible) return;
    draw(dt);
  }
  document.documentElement.classList.add('gl-decks'); // first: a hidden canvas has no size to measure
  resize(); if ('ResizeObserver' in window) new ResizeObserver(resize).observe(cv); else addEventListener('resize', resize);
  if (still) { draw(3); return true; }
  onBeat((row) => { pulse = Math.max(pulse, row === 0 ? 1 : 0.55); });
  if (matchMedia('(hover: hover)').matches) {
    addEventListener('pointermove', (e) => {
      const b = cv.getBoundingClientRect(), inside = e.clientX > b.left && e.clientX < b.right && e.clientY > b.top && e.clientY < b.bottom;
      tiltTo[0] = Math.max(-1, Math.min(1, ((e.clientX - b.left) / b.width - 0.5) * 2)); tiltTo[1] = Math.max(-1, Math.min(1, ((e.clientY - b.top) / b.height - 0.5) * 2));
      pointer = inside; if (inside) { ndc.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); ray.setFromCamera(ndc, camera); if (ray.ray.intersectPlane(plane, pt)) lightTo.set(pt.x, pt.z); }
    });
    document.documentElement.addEventListener('pointerleave', () => { pointer = false; tiltTo[0] = tiltTo[1] = 0; });
  }
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) last = performance.now() / 1000; }).observe(cv);
  cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); cancelAnimationFrame(raf); document.documentElement.classList.remove('gl-decks'); });
  cv.addEventListener('webglcontextrestored', () => { document.documentElement.classList.add('gl-decks'); resize(); raf = requestAnimationFrame(frame); });
  addEventListener('pagehide', () => { cancelAnimationFrame(raf); renderer.dispose(); });
  raf = requestAnimationFrame(frame);
  window.__decks = { renderer };
  return true;
}
if (cv) start();
