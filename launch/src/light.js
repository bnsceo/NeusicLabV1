// The hero's light: a dark field of slow colour behind the headline, and a ring of light for every drum the pad board plays.
// One full-screen shader, drawn small and stretched (it is soft), only while the hero is on screen.
import * as THREE from 'three';
import { on as onBeat } from './beat.js';

const cv = document.getElementById('light');
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = innerWidth < 700;
const weak = (navigator.hardwareConcurrency || 8) <= 2 || (navigator.deviceMemory || 8) <= 2;

function start() {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: false, powerPreference: 'low-power' }); } catch (e) { return; }
  renderer.setClearColor(0x000000, 0);
  const css = getComputedStyle(document.documentElement);
  // sRGB values straight from the page's neon, written out as they are (no colour conversion in this shader)
  const rgb = (v, d) => { const s = (css.getPropertyValue(v).trim() || d).replace('#', ''); return new THREE.Vector3(...[0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255)); };
  const hits = Array.from({ length: 8 }, () => new THREE.Vector4(0, 0, -100, 0));
  const U = { uTime: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) }, uHit: { value: hits }, uMouse: { value: new THREE.Vector3(0.5, 0.7, 0) },
    uLed: { value: rgb('--led', '#5fd0ff') }, uViolet: { value: rgb('--violet', '#a070ee') }, uPink: { value: rgb('--pink', '#ff6fb0') } };
  const mat = new THREE.ShaderMaterial({
    uniforms: U, defines: { OCT: small ? 3 : 5 }, blending: THREE.NoBlending, depthTest: false, depthWrite: false,
    vertexShader: /* glsl */ `void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec2 uRes; uniform vec4 uHit[8]; uniform vec3 uMouse, uLed, uViolet, uPink;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }
      float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < OCT; i++) { v += a * noise(p); p = p * 2.02 + vec2(1.7, 9.2); a *= 0.5; } return v; }
      void main(){
        vec2 uv = gl_FragCoord.xy / uRes; float asp = uRes.x / uRes.y; vec2 p = vec2(uv.x * asp, uv.y); float t = uTime;
        // slow aurora: noise bent by noise, tinted along the page's cyan, violet, pink
        vec2 q = vec2(fbm(p * 1.6 + vec2(t * 0.025, 0.0)), fbm(p * 1.6 + vec2(5.2, 1.3) - t * 0.02));
        float n = fbm(p * 1.3 + 3.0 * q + vec2(0.0, t * 0.03));
        vec3 tint = mix(uLed, uViolet, smoothstep(0.15, 0.8, uv.x + q.x * 0.5));
        tint = mix(tint, uPink, smoothstep(0.55, 1.0, uv.x + q.y * 0.4) * 0.6);
        float top = smoothstep(0.0, 0.8, uv.y) * (0.5 + 0.5 * uv.y);
        vec3 L = tint * smoothstep(0.35, 0.85, n) * top * 0.11;
        // a ring of light for each drum that just played: kick wide and slow and cyan, snare violet, hat pink and quick, rim a pale tick
        for (int i = 0; i < 8; i++) {
          vec4 h = uHit[i]; float age = t - h.z; if (age < 0.0 || age > 3.0) continue;
          int k = int(h.w + 0.5); float r = length((uv - h.xy) * vec2(asp, 1.0));
          float sp = k == 0 ? 0.30 : k == 1 ? 0.50 : k == 2 ? 0.75 : 0.90;
          float wd = k == 0 ? 0.07 : k == 1 ? 0.04 : k == 2 ? 0.022 : 0.014;
          vec3 c = k == 0 ? uLed : k == 1 ? uViolet : k == 2 ? uPink : vec3(0.85, 0.95, 1.0);
          float amp = (k == 0 ? 0.34 : 0.24) * exp(-age * (k == 0 ? 1.3 : 2.2));
          float x = (r - age * sp) / wd;
          L += c * amp * (exp(-x * x) + exp(-r * r * (k == 0 ? 7.0 : 40.0)) * exp(-age * (k == 0 ? 5.0 : 9.0)) * 1.1) * (0.4 + 0.6 * top);
        }
        // a soft light under the pointer
        float md = length((uv - uMouse.xy) * vec2(asp, 1.0)); L += mix(uLed, vec3(1.0), 0.4) * exp(-md * md * 14.0) * 0.06 * uMouse.z;
        L *= smoothstep(0.0, 0.25, uv.y); // melts into the page at the bottom edge
        float m = max(L.r, max(L.g, L.b));
        L += (hash(gl_FragCoord.xy + fract(t) * 100.0) - 0.5) / 255.0 * 2.0 * smoothstep(0.0, 0.03, m); // dither: no banding in the dark
        gl_FragColor = vec4(max(L, 0.0), clamp(m, 0.0, 1.0) * 0.2); // light is added: almost no alpha
      }`,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(quad); const cam = new THREE.Camera();
  const t0 = performance.now() / 1000, T = () => performance.now() / 1000 - t0;
  let raf = 0, visible = true, last = 0, h = 0; const mouse = U.uMouse.value, mouseTo = new THREE.Vector3(0.5, 0.7, 0);
  const scale = (small ? 0.45 : 0.6) * Math.min(devicePixelRatio || 1, 1.5);
  function resize() { renderer.setPixelRatio(scale); renderer.setSize(cv.clientWidth || 1, cv.clientHeight || 1, false); renderer.getDrawingBufferSize(U.uRes.value); }
  function draw(t) { U.uTime.value = t; renderer.render(scene, cam); }
  function frame() {
    raf = requestAnimationFrame(frame);
    const t = T(); if (document.hidden || !visible || (small && t - last < 1 / 30)) return; last = t;
    mouse.lerp(mouseTo, 0.08); draw(t);
  }
  document.documentElement.classList.add('gl-light'); // first: a hidden canvas has no size to measure
  resize(); if ('ResizeObserver' in window) new ResizeObserver(resize).observe(cv); else addEventListener('resize', resize);
  if (still) { draw(40); return; } // a single quiet frame
  onBeat((row, col, x, y) => { if (!visible) return; const b = cv.getBoundingClientRect(); hits[h].set((x - b.left) / b.width, 1 - (y - b.top) / b.height, T(), row); h = (h + 1) % hits.length; });
  if (matchMedia('(hover: hover)').matches) {
    addEventListener('pointermove', (e) => { const b = cv.getBoundingClientRect(); mouseTo.set((e.clientX - b.left) / b.width, 1 - (e.clientY - b.top) / b.height, 1); });
    document.documentElement.addEventListener('pointerleave', () => { mouseTo.z = 0; });
  }
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(cv);
  cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); cancelAnimationFrame(raf); document.documentElement.classList.remove('gl-light'); });
  cv.addEventListener('webglcontextrestored', () => { document.documentElement.classList.add('gl-light'); resize(); raf = requestAnimationFrame(frame); });
  addEventListener('pagehide', () => { cancelAnimationFrame(raf); renderer.dispose(); });
  raf = requestAnimationFrame(frame);
  window.__light = { renderer, hits };
}
if (cv && !weak) start();
