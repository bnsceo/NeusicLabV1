/* ═══════════════════════════════════════════════
   Pro mixer: sends/returns, LUFS metering, master limiter, stereo width
═══════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════════
   PHASE 7A — MIXER: SENDS / RETURNS / LUFS / MASTER LIMITER
════════════════════════════════════════════════════════════════ */
Object.assign(Audio_,{
  returnGains:{},sendGains:{},masterLimiterNode:null,
  lufsAnalyser:null,lufsBuffer:null,lufsValue:-70,

  ensureReturn(retId){
    this.ensure();
    if(!this.returnGains[retId]){
      const g=this.ctx.createGain();g.gain.value=0.85;
      g.connect(this.masterLimiter());
      this.returnGains[retId]=g;
    }
    return this.returnGains[retId];
  },
  ensureSend(trackId,retId){
    trackId=Number(trackId);this.ensure();
    if(!this.sendGains[trackId])this.sendGains[trackId]={};
    if(!this.sendGains[trackId][retId]){
      const g=this.ctx.createGain();g.gain.value=0;
      this.ensureTrackGain(trackId).connect(g);
      g.connect(this.ensureReturn(retId));
      this.sendGains[trackId][retId]=g;
    }
    return this.sendGains[trackId][retId];
  },
  setSend(trackId,retId,val){
    this.ensureSend(trackId,retId).gain.setTargetAtTime(Math.max(0,Math.min(1,val)),this.ctx.currentTime,0.01);
    if(!S.sends[trackId])S.sends[trackId]={};
    S.sends[trackId][retId]=val;
  },
  masterLimiter(){
    this.ensure();
    if(!this.masterLimiterNode){
      const comp=this.ctx.createDynamicsCompressor();
      comp.threshold.value=-1;comp.knee.value=0;comp.ratio.value=20;
      comp.attack.value=0.001;comp.release.value=0.05;
      comp.connect(this.masterAnalyserLUFS());
      this.masterLimiterNode=comp;
      this.master.disconnect();this.master.connect(comp);
    }
    return this.masterLimiterNode;
  },
  masterAnalyserLUFS(){
    this.ensure();
    if(!this.lufsAnalyser){
      const a=this.ctx.createAnalyser();a.fftSize=4096;
      a.connect(this.ctx.destination);
      this.lufsAnalyser=a;this.lufsBuffer=new Float32Array(a.fftSize);
    }
    return this.lufsAnalyser;
  },
  readLUFS(){
    if(!this.lufsAnalyser)return -70;
    this.lufsAnalyser.getFloatTimeDomainData(this.lufsBuffer);
    let sum=0;for(let i=0;i<this.lufsBuffer.length;i++)sum+=this.lufsBuffer[i]**2;
    const rms=Math.sqrt(sum/this.lufsBuffer.length);
    const lufs=rms>0?20*Math.log10(rms)-0.691:-70;
    this.lufsValue=this.lufsValue*0.92+lufs*0.08;
    return Math.max(-70,Math.min(0,this.lufsValue));
  },
  setStereoWidth(val){
    this.ensure();
    if(!this._splitter){
      const sp=this.ctx.createChannelSplitter(2);
      const mg=this.ctx.createGain();const sg=this.ctx.createGain();
      const merger=this.ctx.createChannelMerger(2);
      this.master.disconnect();this.master.connect(sp);
      sp.connect(mg,0);sp.connect(mg,1);sp.connect(sg,0);sp.connect(sg,1);
      mg.connect(merger,0,0);mg.connect(merger,0,1);
      sg.connect(merger,0,0);sg.connect(merger,0,1);
      merger.connect(this.masterLimiter());
      this._splitter={sp,mg,sg,merger};
    }
    const mid=1-Math.max(0,val-1);const side=Math.min(1,val);
    this._splitter.mg.gain.value=mid;this._splitter.sg.gain.value=side;
    S.stereoWidth=val;
  },
});

Object.assign(S,{
  sends:{},
  returns:{
    A:{name:'Reverb A',color:'#a78bfa',on:true},
    B:{name:'Delay B', color:'#60a5fa',on:true},
    C:{name:'Room C',  color:'#34d399',on:false},
  },
  limiterOn:true,stereoWidth:1.0,lufsTarget:-14,
});

window.buildMixer=function(el){
  Audio_.ensure();Audio_.masterLimiter();
  const tracks=S.tracks;const masterIdx=tracks.length;
  const retIds=Object.keys(S.returns);

  el.innerHTML=`<div class="pmx-wrap">
    <div class="pmx-strips" id="pmx-strips">
      ${tracks.map((t,i)=>{
        const vol=(S.trackVol[t.id]??0.85);
        return `<div class="pmx-ch" data-ti="${i}" data-tid="${t.id}">
          <div class="pmx-ch-label" style="background:${t.color}22;border-top:2px solid ${t.color};">
            <span class="pmx-ch-icon">${t.icon}</span><span class="pmx-ch-name">${t.name}</span>
          </div>
          <div class="pmx-sends">
            ${retIds.map(rid=>!S.returns[rid].on?'':`
              <div class="pmx-send-row">
                <span class="pmx-send-lbl" style="color:${S.returns[rid].color}">${rid}</span>
                <div class="pmx-send-knob-wrap"><canvas class="pmx-send-knob" width="28" height="28"
                  data-tid="${t.id}" data-ret="${rid}" data-val="${S.sends[t.id]?.[rid]??0}"></canvas></div>
                <span class="pmx-send-val" id="sv-${t.id}-${rid}">${Math.round((S.sends[t.id]?.[rid]??0)*100)}%</span>
              </div>`).join('')}
          </div>
          <div class="pmx-pan-row">
            <span class="pmx-pan-lbl">PAN</span>
            <input type="range" class="pmx-pan" min="-100" max="100" value="0" data-tid="${t.id}" oninput="onPanChange(this)">
          </div>
          <div class="pmx-fader-zone">
            <div class="pmx-meter-col">
              <div class="pmx-meter-bar"><div class="pmx-meter-fill" id="pmf-${i}" style="background:${t.color}"></div></div>
              <div class="pmx-meter-bar"><div class="pmx-meter-fill" id="pmf-${i}r" style="background:${t.color}"></div></div>
            </div>
            <div class="pmx-fader-col">
              <div class="pmx-fader-track"><div class="pmx-fader-groove"></div>
                <div class="pmx-thumb" id="pmth-${i}" style="top:${Math.round((1-vol)*86)}%" data-ti="${i}" data-tid="${t.id}"></div>
              </div>
              <div class="pmx-db" id="pmdb-${i}">${volToDb(vol)}</div>
            </div>
          </div>
          <div class="pmx-ms">
            <button class="pmx-ms-btn${t.m?' active red':''}" onclick="toggleM(${i})">M</button>
            <button class="pmx-ms-btn${t.s?' active yel':''}" onclick="toggleS(${i})">S</button>
          </div>
        </div>`;
      }).join('')}
      <div class="pmx-ch pmx-master">
        <div class="pmx-ch-label" style="background:#22c55e22;border-top:2px solid #22c55e;">
          <span class="pmx-ch-icon">M</span><span class="pmx-ch-name">Master</span>
        </div>
        <div class="pmx-sends" style="min-height:20px;"></div>
        <div style="display:flex;align-items:center;gap:5px;padding:3px 0;">
          <button class="pmx-ms-btn${S.limiterOn?' active grn':''}" id="limiter-btn"
            onclick="toggleLimiter(this)" style="font-size:9px;padding:2px 5px;border-radius:4px;">LIM</button>
          <span style="font-size:9px;color:var(--txt2);">−1 dBFS</span>
        </div>
        <div class="pmx-pan-row">
          <span class="pmx-pan-lbl">WIDTH</span>
          <input type="range" class="pmx-pan" min="0" max="200" value="${Math.round(S.stereoWidth*100)}"
            oninput="Audio_.setStereoWidth(this.value/100);document.getElementById('width-val').textContent=this.value+'%'">
        </div>
        <div class="pmx-fader-zone">
          <div class="pmx-meter-col">
            <div class="pmx-meter-bar"><div class="pmx-meter-fill" id="pmf-${masterIdx}" style="background:#22c55e"></div></div>
            <div class="pmx-meter-bar"><div class="pmx-meter-fill" id="pmf-${masterIdx}r" style="background:#22c55e"></div></div>
          </div>
          <div class="pmx-fader-col">
            <div class="pmx-fader-track"><div class="pmx-fader-groove"></div>
              <div class="pmx-thumb" id="pmth-${masterIdx}" style="top:${Math.round((1-S.masterVol)*86)}%" data-is-master="true"></div>
            </div>
            <div class="pmx-db" id="pmdb-${masterIdx}">${volToDb(S.masterVol)}</div>
          </div>
        </div>
        <div class="pmx-ms"><span id="width-val" style="font-size:9px;color:var(--txt2);">${Math.round(S.stereoWidth*100)}%</span></div>
      </div>
    </div>
    <div class="pmx-returns">
      <div class="pmx-ret-title">Return Buses</div>
      ${retIds.map(rid=>{const r=S.returns[rid];return `
        <div class="pmx-ret-bus${r.on?'':' pmx-ret-off'}" id="ret-${rid}">
          <div class="pmx-ret-hdr" style="border-left:3px solid ${r.color};">
            <span style="color:${r.color};font-size:10px;font-weight:700;">${rid}</span>
            <span class="pmx-ret-name">${r.name}</span>
            <button class="pmx-ms-btn${r.on?' active grn':''}" onclick="toggleReturn('${rid}',this)">${r.on?'ON':'OFF'}</button>
          </div>
          <div class="pmx-ret-meter"><div class="pmx-ret-fill" id="ret-fill-${rid}" style="background:${r.color}"></div></div>
        </div>`;}).join('')}
    </div>
    <div class="pmx-lufs-row">
      <div class="pmx-lufs-block"><div class="pmx-lufs-lbl">LUFS</div><div class="pmx-lufs-val" id="lufs-val">—</div>
        <div class="pmx-lufs-target">target <strong>${S.lufsTarget}</strong></div></div>
      <div class="pmx-lufs-block"><div class="pmx-lufs-lbl">PEAK</div><div class="pmx-lufs-val" id="peak-val" style="color:var(--grn)">—</div>
        <div class="pmx-lufs-target">dBFS</div></div>
      <div class="pmx-lufs-block" style="flex:1;"><canvas id="lufs-meter" height="22" style="width:100%;display:block;border-radius:4px;"></canvas>
        <div style="font-size:9px;color:var(--txt2);margin-top:3px;text-align:center;">Integrated loudness</div></div>
      <div class="pmx-lufs-block"><button class="chop-btn sec" style="padding:4px 9px;font-size:10px;" onclick="autoGain()">Auto Gain</button></div>
    </div>
  </div>`;

  setupProFaderDrags();drawSendKnobs();startProMeterAnim();
  tracks.forEach(t=>{retIds.forEach(rid=>{if(S.sends[t.id]?.[rid]!=null)Audio_.setSend(t.id,rid,S.sends[t.id][rid]);});});
};

function volToDb(v){if(v<=0)return '-∞';const db=20*Math.log10(v);return (db>=0?'+':'')+db.toFixed(1)+' dB';}
function onPanChange(el){
  const tid=Number(el.dataset.tid);const pan=el.value/100;Audio_.ensure();
  Audio_.ensureTrackPanner(tid).pan.setTargetAtTime(pan,Audio_.ctx.currentTime,0.01);
}
function toggleLimiter(btn){
  S.limiterOn=!S.limiterOn;btn.classList.toggle('active',S.limiterOn);btn.classList.toggle('grn',S.limiterOn);
  if(Audio_.masterLimiterNode)Audio_.masterLimiterNode.ratio.value=S.limiterOn?20:1;
  toast(S.limiterOn?'Master limiter ON':'Master limiter OFF');
}
function toggleReturn(rid,btn){
  S.returns[rid].on=!S.returns[rid].on;
  btn.classList.toggle('active',S.returns[rid].on);btn.classList.toggle('grn',S.returns[rid].on);
  btn.textContent=S.returns[rid].on?'ON':'OFF';
  document.getElementById('ret-'+rid)?.classList.toggle('pmx-ret-off',!S.returns[rid].on);
  toast(`Return ${rid}: ${S.returns[rid].on?'on':'off'}`);
}
function drawSendKnobs(){
  document.querySelectorAll('.pmx-send-knob').forEach(cvs=>{
    const val=parseFloat(cvs.dataset.val)||0;
    const ctx=cvs.getContext('2d'),w=cvs.width,h=cvs.height,cx=w/2,cy=h/2+2,r=10;
    ctx.clearRect(0,0,w,h);
    ctx.beginPath();ctx.arc(cx,cy,r,-0.75*Math.PI,0.75*Math.PI);
    ctx.strokeStyle='rgba(255,255,255,0.12)';ctx.lineWidth=3;ctx.stroke();
    const angle=-0.75*Math.PI+val*1.5*Math.PI;
    ctx.beginPath();ctx.arc(cx,cy,r,-0.75*Math.PI,angle);
    ctx.strokeStyle=S.returns[cvs.dataset.ret]?.color||'var(--acc)';ctx.lineWidth=3;ctx.stroke();
    const dx=cx+r*Math.cos(angle),dy=cy+r*Math.sin(angle);
    ctx.beginPath();ctx.arc(dx,dy,2.5,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();
    if(!cvs._wired){
      cvs._wired=true;let startY,startVal;
      const onDown=e=>{
        startY=e.touches?e.touches[0].clientY:e.clientY;startVal=parseFloat(cvs.dataset.val)||0;
        const onMove=ev=>{
          const cy2=ev.touches?ev.touches[0].clientY:ev.clientY;
          const newVal=Math.max(0,Math.min(1,startVal-(cy2-startY)/80));
          cvs.dataset.val=newVal;Audio_.setSend(Number(cvs.dataset.tid),cvs.dataset.ret,newVal);
          const lbl=document.getElementById(`sv-${cvs.dataset.tid}-${cvs.dataset.ret}`);
          if(lbl)lbl.textContent=Math.round(newVal*100)+'%';
          drawSendKnobs();
        };
        const onUp=()=>{
          window.removeEventListener('mousemove',onMove);window.removeEventListener('mouseup',onUp);
          window.removeEventListener('touchmove',onMove);window.removeEventListener('touchend',onUp);
        };
        window.addEventListener('mousemove',onMove);window.addEventListener('mouseup',onUp);
        window.addEventListener('touchmove',onMove,{passive:true});window.addEventListener('touchend',onUp);
      };
      cvs.addEventListener('mousedown',onDown);cvs.addEventListener('touchstart',onDown,{passive:true});
    }
  });
}
function setupProFaderDrags(){
  document.querySelectorAll('.pmx-thumb').forEach(thumb=>{
    const ti=thumb.dataset.ti!=null?parseInt(thumb.dataset.ti,10):-1;
    const tid=thumb.dataset.tid!=null?Number(thumb.dataset.tid):null;
    const isMaster=thumb.dataset.isMaster==='true';
    const onDown=e=>{
      e.stopPropagation();
      const sy=e.touches?e.touches[0].clientY:e.clientY;const st=parseFloat(thumb.style.top)||0;
      const onMove=ev=>{
        const cy=ev.touches?ev.touches[0].clientY:ev.clientY;
        const nt=Math.max(0,Math.min(86,st+(cy-sy)));thumb.style.top=nt+'%';
        const g=Math.max(0,Math.min(1,(100-nt)/100));
        if(isMaster){Audio_.setMasterVol(g);const db=document.getElementById('pmdb-'+S.tracks.length);if(db)db.textContent=volToDb(g);}
        else{Audio_.setTrackFader(tid,g);const db=document.getElementById('pmdb-'+ti);if(db)db.textContent=volToDb(g);}
      };
      const onUp=()=>{
        window.removeEventListener('mousemove',onMove);window.removeEventListener('mouseup',onUp);
        window.removeEventListener('touchmove',onMove);window.removeEventListener('touchend',onUp);
      };
      window.addEventListener('mousemove',onMove);window.addEventListener('mouseup',onUp);
      window.addEventListener('touchmove',onMove,{passive:true});window.addEventListener('touchend',onUp);
    };
    thumb.addEventListener('mousedown',onDown);thumb.addEventListener('touchstart',onDown,{passive:true});
  });
}
let _proMeterRaf;
function startProMeterAnim(){
  cancelAnimationFrame(_proMeterRaf);
  if(S.activePanel!=='mixer')return;
  function tick(){
    if(S.activePanel!=='mixer'){cancelAnimationFrame(_proMeterRaf);return;}
    const masterIdx=S.tracks.length;
    S.tracks.forEach((t,i)=>{
      const a=S.playing?Audio_.ensureTrackAnalyser(t.id):null;
      const lvl=a?Audio_.readLevel(a):0;const pct=Math.min(100,Math.max(0,lvl*200));
      const lFill=document.getElementById('pmf-'+i);const rFill=document.getElementById('pmf-'+i+'r');
      if(lFill){lFill.style.height=pct+'%';lFill.style.background=pct>85?'var(--red)':pct>70?'var(--yel)':t.color;}
      if(rFill)rFill.style.height=Math.max(0,pct-5+Math.random()*8)+'%';
    });
    const masterLvl=S.playing?Audio_.readLevel(Audio_.ensureMasterAnalyser()):0;
    const masterPct=Math.min(100,masterLvl*200);
    const mf=document.getElementById('pmf-'+masterIdx);const mfr=document.getElementById('pmf-'+masterIdx+'r');
    if(mf){mf.style.height=masterPct+'%';mf.style.background=masterPct>85?'var(--red)':masterPct>70?'var(--yel)':'#22c55e';}
    if(mfr)mfr.style.height=Math.max(0,masterPct-3+Math.random()*6)+'%';
    const lufs=Audio_.readLUFS();
    const lufsEl=document.getElementById('lufs-val');
    if(lufsEl){lufsEl.textContent=lufs.toFixed(1)+' LU';lufsEl.style.color=lufs>S.lufsTarget+3?'var(--red)':lufs>S.lufsTarget-1?'var(--yel)':'var(--grn)';}
    const peakEl=document.getElementById('peak-val');
    if(peakEl){const peak=Math.max(-70,20*Math.log10(Math.max(0.000001,masterLvl)));peakEl.textContent=peak.toFixed(1)+' dB';peakEl.style.color=peak>-1?'var(--red)':peak>-6?'var(--yel)':'var(--grn)';}
    const mc=document.getElementById('lufs-meter');
    if(mc){
      mc.width=mc.offsetWidth||200;
      const mctx=mc.getContext('2d'),mw=mc.width,mh=mc.height;
      const pct=Math.max(0,Math.min(1,(lufs+70)/70));
      mctx.clearRect(0,0,mw,mh);
      const grad=mctx.createLinearGradient(0,0,mw,0);
      grad.addColorStop(0,'#22c55e');grad.addColorStop(0.7,'#fbbf24');grad.addColorStop(1,'#f87171');
      mctx.fillStyle='rgba(255,255,255,0.06)';mctx.fillRect(0,0,mw,mh);
      mctx.fillStyle=grad;mctx.fillRect(0,2,pct*mw,mh-4);
      const tx=((S.lufsTarget+70)/70)*mw;
      mctx.strokeStyle='rgba(255,255,255,0.5)';mctx.lineWidth=1;
      mctx.setLineDash([2,2]);mctx.beginPath();mctx.moveTo(tx,0);mctx.lineTo(tx,mh);mctx.stroke();mctx.setLineDash([]);
    }
    Object.keys(S.returns).forEach(rid=>{
      if(!S.returns[rid].on)return;
      const rg=Audio_.returnGains[rid];if(!rg)return;
      const fill=document.getElementById('ret-fill-'+rid);if(fill)fill.style.width=(masterLvl*150)+'%';
    });
    _proMeterRaf=requestAnimationFrame(tick);
  }
  _proMeterRaf=requestAnimationFrame(tick);
}
function autoGain(){
  const lufs=Audio_.readLUFS();
  if(lufs<-65){toast('Play audio to measure before Auto Gain');return;}
  const diff=S.lufsTarget-lufs;
  const newVol=Math.max(0.1,Math.min(1.5,S.masterVol*Math.pow(10,diff/20)));
  Audio_.setMasterVol(newVol);S.masterVol=newVol;
  toast(`Auto Gain: ${diff>0?'+':''}${diff.toFixed(1)} LU → master ${volToDb(newVol)}`);
}
/* Pro mixer CSS now static: css/mixer-pro.css */
