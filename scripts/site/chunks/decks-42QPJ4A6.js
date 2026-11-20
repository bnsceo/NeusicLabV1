import{b as U,c as z,d as C,e as g,f as A,h as J,i as m,j as $,l as K,m as Q,n as Z,o as ee,p as te,q as oe,r as se,s as ae,t as F,u as ne}from"./chunk-U6LFAHKW.js";var n=document.getElementById("decks"),ie=matchMedia("(prefers-reduced-motion: reduce)").matches,ue=innerWidth<700,c=[[-2.05,.55],[2.05,.55]],E=[0,.55],w=[[-2.05,-1.3],[2.05,-1.3]],me=[33.333,45].map(s=>s/60*Math.PI*2),ve=[96/60,124/60];function de(){let s;try{s=new ae({canvas:n,antialias:!0,alpha:!0,powerPreference:"high-performance"})}catch{return!1}s.setPixelRatio(Math.min(devicePixelRatio||1,ue?1.5:2)),s.toneMapping=U;let V=getComputedStyle(document.documentElement),v=(e,t)=>new J(V.getPropertyValue(e).trim()||t),I=v("--bg","#11131e"),R=v("--led","#5fd0ff"),W=v("--pink","#ff6fb0"),fe=v("--violet","#a070ee"),T=(parseFloat(V.getPropertyValue("--pad-lift"))||1).toFixed(4),l=new Q,a=new K(24,2,.1,100),_=new oe().load("/assets/site/logo.jpg",e=>{e.colorSpace=z,e.anisotropy=Math.min(8,s.capabilities.getMaxAnisotropy())});_.colorSpace=z;let d={uTime:{value:0},uPulse:{value:0}},q=`
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float sdR(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
    vec3 shade(vec3 n, vec3 b){ float l = dot(n.xz, vec2(-0.7071)); return b * (1.0 + 0.2 * l) + vec3(0.1 * ${T}) * max(l, 0.0); }`,re="varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(mat3(modelMatrix) * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",M=(e,t={},o="")=>new $({uniforms:{uBase:{value:I},uLed:{value:R},...d,...t},vertexShader:re,fragmentShader:`uniform vec3 uBase, uLed; uniform float uTime, uPulse; ${o} varying vec3 vN; varying vec3 vP; ${q}
      void main(){
        vec3 n = normalize(vN); float top = smoothstep(0.75, 0.97, n.y); vec3 col = shade(n, uBase);
        ${e}
        col += (hash(gl_FragCoord.xy) - 0.5) * 0.012 * ${T};
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`}),ce=`float shape(vec2 p, int k){ if (k == 0) return length(p - vec2(${c[0]})) - 1.0; if (k == 1) return length(p - vec2(${c[1]})) - 1.0;
    if (k == 2) return sdR(p - vec2(${E}), vec2(0.66, 1.25), 0.18); if (k == 3) return sdR(p - vec2(${w[0]}), vec2(1.05, 0.32), 0.12); return sdR(p - vec2(${w[1]}), vec2(1.05, 0.32), 0.12); }`,D=new m(new te(20,12),new $({transparent:!0,uniforms:{uBase:{value:I},uLed:{value:R},...d},vertexShader:"varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",fragmentShader:`
      uniform vec3 uBase, uLed; uniform float uPulse; varying vec3 vW; ${q} ${ce}
      void main(){
        vec2 p = vW.xz; float sh = 0.0, hi = 0.0; vec2 off = vec2(0.16);
        for (int k = 0; k < 5; k++) {
          sh = max(sh, 1.0 - smoothstep(-0.03, 0.3, shape(p - off, k)));
          hi = max(hi, 1.0 - smoothstep(-0.03, 0.3, shape(p + off, k)));
        }
        // shade and light laid over the page behind (premultiplied, in screen colour), so no edge shows and the mixer's light spills out
        vec3 add = vec3(0.9 * ${T}) * hi * (1.0 - sh) + max(pow(uLed * exp(-length(p - vec2(${E})) * 1.1) * 0.05 * (0.4 + uPulse), vec3(0.45)) - 0.06, 0.0) * (1.0 - sh);
        gl_FragColor = vec4(add, 0.17 * sh);
      }`,premultipliedAlpha:!0}));D.rotation.x=-Math.PI/2,l.add(D);let le=[0,1].map(e=>{let t={uSpin:{value:0},uLightA:{value:0},uTex:{value:_}},o=new m(new ee(1,1,.16,72),M(`
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
      col = mix(col, t, top);`,t,"uniform float uSpin, uLightA; uniform sampler2D uTex;"));return o.position.set(c[e][0],.08,c[e][1]),o.userData={u:t,d:e},l.add(o),o}),G=new m(new F(1.32,.2,2.5,4,.1),M(`
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
    col = mix(col, t, top);`,{uPink:{value:W}},"uniform vec3 uPink;"));G.position.set(E[0],.1,E[1]),l.add(G);let he=[0,1].map(e=>{let t=e?W:R,o=new m(new F(2.1,.08,.64,4,.04),M(`
      vec2 s = vec2(vP.x / 1.05, vP.z / 0.32); vec3 t = vec3(0.002, 0.003, 0.006);
      float x = s.x * 3.0 + uTime * uBps, ci = floor(x * 40.0), f = fract(x * 40.0);
      float amp = (0.3 + 0.55 * pow(1.0 - fract(x), 2.0)) * (0.45 + 0.55 * hash(vec2(ci, uSeed)));
      t += uColor * step(abs(s.y), amp * 0.85) * step(0.12, f) * step(f, 0.88) * (s.x < 0.0 ? 0.3 : 0.75);
      float g = abs(fract(x + 0.5) - 0.5), fw = fwidth(x); t = mix(t, vec3(0.1, 0.12, 0.2), (1.0 - smoothstep(fw * 0.6, fw * 1.4, g)) * 0.7);
      t = mix(t, vec3(0.9), (1.0 - smoothstep(0.0, 0.012, abs(s.x))) * 0.9);
      t *= 1.0 - 0.7 * smoothstep(0.75, 1.0, abs(s.x));
      col = mix(col, t, top);`,{uColor:{value:t},uBps:{value:ve[e]},uSeed:{value:e*7}},"uniform vec3 uColor; uniform float uBps, uSeed;"));return o.position.set(w[e][0],.04,w[e][1]),l.add(o),o}),i=[0,0],r=[0,0],b=new g(0,0),P=new g(0,0),N=new se,O=new g,pe=new Z(new A(0,1,0),0),y=new A,H=12,S=!1,L=!0,p=0,k=performance.now()/1e3,f=0,h=0,X=[.6,2.1],j=()=>{a.position.set(i[0]*.4,H*.86+i[1]*.25,H*.52),a.lookAt(0,0,.1)};function x(){let e=n.clientWidth||1,t=n.clientHeight||1;s.setSize(e,t,!1),a.aspect=e/t;let o=2*Math.atan(Math.tan(C.degToRad(a.fov/2))*a.aspect);H=Math.max(3.5/Math.tan(o/2),(1.75*.86+.2)/Math.tan(C.degToRad(a.fov/2))),j(),a.updateProjectionMatrix()}function Y(e){f+=e,h*=Math.exp(-5*e),d.uTime.value=f,d.uPulse.value=h;let t=1-Math.exp(-4*e);i[0]+=(r[0]-i[0])*t,i[1]+=(r[1]-i[1])*t,j(),S||b.set(Math.cos(f*.3)*3,Math.sin(f*.3)*3),P.lerp(b,1-Math.exp(-5*e));for(let o of le){let u=o.userData.d;X[u]+=ie?0:e*me[u],o.userData.u.uSpin.value=X[u],o.userData.u.uLightA.value=Math.atan2(P.y-c[u][1],P.x-c[u][0])}s.render(l,a)}function B(){p=requestAnimationFrame(B);let e=performance.now()/1e3,t=Math.min(e-k,.05);k=e,!(document.hidden||!L)&&Y(t)}return document.documentElement.classList.add("gl-decks"),x(),"ResizeObserver"in window?new ResizeObserver(x).observe(n):addEventListener("resize",x),ie?(Y(3),!0):(ne(e=>{h=Math.max(h,e===0?1:.55)}),matchMedia("(hover: hover)").matches&&(addEventListener("pointermove",e=>{let t=n.getBoundingClientRect(),o=e.clientX>t.left&&e.clientX<t.right&&e.clientY>t.top&&e.clientY<t.bottom;r[0]=Math.max(-1,Math.min(1,((e.clientX-t.left)/t.width-.5)*2)),r[1]=Math.max(-1,Math.min(1,((e.clientY-t.top)/t.height-.5)*2)),S=o,o&&(O.set((e.clientX-t.left)/t.width*2-1,-((e.clientY-t.top)/t.height)*2+1),N.setFromCamera(O,a),N.ray.intersectPlane(pe,y)&&b.set(y.x,y.z))}),document.documentElement.addEventListener("pointerleave",()=>{S=!1,r[0]=r[1]=0})),"IntersectionObserver"in window&&new IntersectionObserver(([e])=>{L=e.isIntersecting,L&&(k=performance.now()/1e3)}).observe(n),n.addEventListener("webglcontextlost",e=>{e.preventDefault(),cancelAnimationFrame(p),document.documentElement.classList.remove("gl-decks")}),n.addEventListener("webglcontextrestored",()=>{document.documentElement.classList.add("gl-decks"),x(),p=requestAnimationFrame(B)}),addEventListener("pagehide",()=>{cancelAnimationFrame(p),s.dispose()}),p=requestAnimationFrame(B),window.__decks={renderer:s},!0)}n&&de();
