/* 44-nw-agent.js — Neusic Agent 1.0 client.
   Identity (user/project/session), six-section preferences, provider status
   (backend + Ollama), API-key config, thin chat client to the FastAPI bridge. */
(() => {
'use strict';
if (window.__nwAgent) return; window.__nwAgent = true;

const uid = p => p + '_' + Math.random().toString(36).slice(2, 10);
const LSID = 'nw-identity';
const identity = (() => {
  let i; try { i = JSON.parse(localStorage.getItem(LSID)); } catch (_) {}
  if (!i || !i.userId) i = { userId: uid('user'), workspaceId: uid('ws') };
  i.projectId = i.projectId || uid('proj');
  i.sessionId = uid('sess');
  try { localStorage.setItem(LSID, JSON.stringify({ userId: i.userId, workspaceId: i.workspaceId, projectId: i.projectId })); } catch (_) {}
  return i;
})();

const LSPREF = 'nw-agent-prefs';
const DEFAULTS = {
  verbosity: 'concise', suggestionFrequency: 'balanced',
  interventionLevel: 'ask-before-changes', agentRole: 'general-copilot',
  creativeRisk: 50, explanationStyle: 'plain-language',
  analysisMode: 'selection-aware', performanceMode: 'studio',
  suppressDuringRecording: true, alwaysProvideUndo: true,
  previewBeforeApplying: true, createRestorePoints: true,
  notifications: { chat: true, toast: true, timelineMarkers: false, highlightControls: true, voice: false },
  proactiveSuggestions: { clipping: true, latency: true, timing: true, pitch: true, arrangement: true, mixing: true, mastering: true, soundReplacement: false },
  confirmation: { destructiveEdits: true, deleteTrack: true, overwriteRecording: true, changeTempo: true, changeKey: true, modifyMasterBus: true, renameAndOrganize: false },
  productionProfile: { genres: ['Hip-Hop'], soundCharacter: 'warm', mixWidth: 'wide', masterStyle: 'dynamic', era: 'modern' },
  provider: 'hermes', backendUrl: 'http://localhost:8000', apiKey: '',
};
let prefs = (() => { try { return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(LSPREF)) || {}) }; } catch (_) { return { ...DEFAULTS }; } })();
const savePrefs = () => { try { localStorage.setItem(LSPREF, JSON.stringify(prefs)); } catch (_) {} };
window.NeusicAgentPreferences = { get: () => ({ verbosity: prefs.verbosity, suggestion_frequency: prefs.suggestionFrequency, intervention_level: prefs.interventionLevel }) };

const LSMEM = 'nw-session-mem-' + identity.projectId;
let sessionMsgs = (() => { try { return JSON.parse(localStorage.getItem(LSMEM)) || []; } catch (_) { return []; } })();
const remember = (role, content) => {
  sessionMsgs.push({ role, content, t: Date.now() });
  if (sessionMsgs.length > 24) sessionMsgs = sessionMsgs.slice(-24);
  try { localStorage.setItem(LSMEM, JSON.stringify(sessionMsgs)); } catch (_) {}
};

function context() {
  if (typeof S === 'undefined') return {};
  return {
    project: { bpm: S.bpm, playing: S.playing, kit: S.drumKit || 'classic' },
    tracks: (S.tracks || []).map(t => ({ id: t.id, name: t.name, type: t.type, mute: t.m, solo: t.s, clips: t.clips?.length ?? 0 })),
    active_track: (S.tracks || [])[S.activeTrack] ? { name: S.tracks[S.activeTrack].name, type: S.tracks[S.activeTrack].type } : null,
  };
}

async function api(path, opts = {}) {
  const r = await fetch(prefs.backendUrl.replace(/\/$/, '') + path, {
    headers: { 'Content-Type': 'application/json', ...(prefs.apiKey ? { 'X-Neusic-Key': prefs.apiKey } : {}) },
    ...opts,
  });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}
async function chat(prompt) {
  remember('user', prompt);
  const body = JSON.stringify({
    source: 'neusic-copilot', version: 3,
    user_id: identity.userId, workspace_id: identity.workspaceId,
    project_id: identity.projectId, session_id: identity.sessionId,
    prompt, preferences: window.NeusicAgentPreferences.get(),
    context: context(), recent: sessionMsgs.slice(-12),
  });
  try {
    const res = await api('/api/hermes/chat', { method: 'POST', body });
    remember('assistant', res.reply || '');
    return res;
  } catch (e) {
    const fallback = { reply: 'Backend unreachable at ' + prefs.backendUrl + '. Start the Python service (see Settings → Provider) or check the URL.', offline: true };
    remember('assistant', fallback.reply);
    return fallback;
  }
}

async function refreshStatus() {
  const lamp = document.getElementById('nw-agent-lamp');
  const set = (cls, txt) => { if (lamp) { lamp.className = 'nw-lamp ' + cls; lamp.querySelector('span').textContent = txt; } };
  set('busy', 'Checking…');
  try {
    await api('/health');
    try {
      const o = await api('/api/providers/ollama/status');
      set('ok', o.available ? ('Local model · ' + (o.default_model || 'ready')) : 'Online · Hermes');
      return { backend: true, ollama: !!o.available, models: o.models || [] };
    } catch (_) { set('ok', 'Online · Hermes'); return { backend: true, ollama: false, models: [] }; }
  } catch (_) { set('err', 'Backend offline'); return { backend: false, ollama: false, models: [] }; }
}

function openPanel() {
  let p = document.getElementById('nw-agent-panel');
  if (p) { p.remove(); return; }
  p = document.createElement('div'); p.id = 'nw-agent-panel';
  p.style.cssText = 'position:fixed;right:10px;bottom:10px;width:min(340px,92vw);height:min(420px,70dvh);z-index:110;display:flex;flex-direction:column;border-radius:3px;overflow:hidden';
  p.className = 'nw-surface';
  p.innerHTML = `
    <header style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid rgba(0,0,0,.55)">
      <span class="nw-label">Neusic Agent</span>
      <span style="margin-left:auto"></span>
      <button class="nw-btn" data-pop title="Open as window">⧉</button>
      <button class="nw-btn" data-x>✕</button></header>
    <div data-log style="flex:1;overflow:auto;padding:10px;display:flex;flex-direction:column;gap:8px"></div>
    <form data-f style="display:flex;gap:6px;padding:8px;border-top:1px solid rgba(0,0,0,.55)">
      <input data-in placeholder="Ask about your mix, arrangement, sounds…" style="flex:1;font:600 10px/1.3 var(--nw-font);background:#141614;border:1px solid #0e100f;border-radius:2px;color:#d7dad9;padding:8px">
      <button class="nw-btn is-active">Send</button></form>`;
  const log = p.querySelector('[data-log]');
  const line = (role, txt) => { const d = document.createElement('div');
    d.style.cssText = 'font:600 10px/1.5 var(--nw-font);padding:7px 9px;border-radius:2px;max-width:92%;' +
      (role === 'user' ? 'align-self:flex-end;background:color-mix(in srgb,var(--nw-accent) 26%,#2c2f2d);color:#eef1f0'
                       : 'align-self:flex-start;background:#232625;color:#c2c6c4;border:1px solid rgba(0,0,0,.4)');
    d.textContent = txt; log.appendChild(d); log.scrollTop = log.scrollHeight; };
  sessionMsgs.slice(-8).forEach(m => line(m.role, m.content));
  p.querySelector('[data-x]').onclick = () => p.remove();
  p.querySelector('[data-pop]').onclick = () => {
    const w = window.open('', 'neusic-agent', 'width=420,height=560');
    if (w) { w.document.title = 'Neusic Agent'; w.document.body.style.cssText = 'margin:0;background:#181817'; w.document.body.appendChild(p); }
  };
  p.querySelector('[data-f]').onsubmit = async e => {
    e.preventDefault();
    const inp = p.querySelector('[data-in]'); const q = inp.value.trim(); if (!q) return;
    inp.value = ''; line('user', q);
    const res = await chat(q); line('assistant', res.reply || '(no reply)');
  };
  document.body.appendChild(p);
}

const seg = (key, options, obj = prefs) => `<div class="nw-seg" data-seg="${key}">` +
  options.map(o => `<button data-v="${o}" class="${(obj[key] ?? '') === o ? 'on' : ''}">${o.replace(/-/g, ' ')}</button>`).join('') + '</div>';
const check = (path, label) => { const v = path.split('.').reduce((a, k) => a?.[k], prefs);
  return `<label class="nw-check"><input type="checkbox" data-check="${path}" ${v ? 'checked' : ''}> ${label}</label>`; };

function openSettings() {
  const d = window.NWDialogs.open('nw-settings', 'Settings', `
    <div class="nw-tabs">
      ${['Provider','Behavior','Actions','Listening','Notifications','Performance','Profile'].map((t,i)=>`<button class="${i===0?'on':''}" data-tab="${i}">${t}</button>`).join('')}
    </div>
    <div class="nw-tabpage on" data-page="0">
      <div class="nw-field"><span class="nw-label">Provider</span>${seg('provider', ['hermes','ollama','auto'])}</div>
      <div class="nw-field"><span class="nw-label">Backend URL</span><input data-in="backendUrl" value="${prefs.backendUrl}" placeholder="http://localhost:8000"></div>
      <div class="nw-field"><span class="nw-label">Agent API Key</span><input data-in="apiKey" type="password" value="${prefs.apiKey}" placeholder="Connect Hermes/CrewAI — AI mixing, auto-arrange, sound matching">
        <span class="nw-micro">Leave blank to disable AI features. Stored on this device only.</span></div>
      <div style="display:flex;gap:8px;align-items:center;margin-top:4px">
        <span class="nw-lamp busy" id="nw-set-lamp"><i></i><span>—</span></span>
        <button class="nw-btn" data-act="test">Test connection</button>
        <button class="nw-btn" data-act="ollama">Ollama setup</button></div>
      <div class="nw-micro" id="nw-ollama-help" style="display:none;margin-top:8px;line-height:1.6">
        LOCAL MODEL — install Ollama from ollama.com, run <b>ollama pull llama3.2</b>, keep it running.
        The backend auto-detects it at localhost:11434. The DAW keeps working without it.</div>
    </div>
    <div class="nw-tabpage" data-page="1">
      <div class="nw-field"><span class="nw-label">Verbosity</span>${seg('verbosity', ['minimal','concise','balanced','detailed'])}</div>
      <div class="nw-field"><span class="nw-label">Suggestions</span>${seg('suggestionFrequency', ['off','low','balanced','high'])}</div>
      <div class="nw-field"><span class="nw-label">Role</span>${seg('agentRole', ['general-copilot','producer','mix-engineer','beat-assistant','songwriter'])}</div>
      <div class="nw-field"><span class="nw-label">Creative risk — ${prefs.creativeRisk}</span>
        <input type="range" min="0" max="100" value="${prefs.creativeRisk}" data-range="creativeRisk"></div>
    </div>
    <div class="nw-tabpage" data-page="2">
      <div class="nw-field"><span class="nw-label">Intervention</span>${seg('interventionLevel', ['advise-only','ask-before-changes','auto-fix-safe','autonomous'])}</div>
      ${check('confirmation.destructiveEdits','Confirm destructive edits')}
      ${check('confirmation.deleteTrack','Confirm delete track')}
      ${check('confirmation.changeTempo','Confirm tempo change')}
      ${check('confirmation.changeKey','Confirm key change')}
      ${check('confirmation.modifyMasterBus','Confirm master-bus changes')}
      ${check('alwaysProvideUndo','Always show Undo after AI actions')}
      ${check('previewBeforeApplying','Preview before applying')}
      ${check('createRestorePoints','Restore point before major edits')}
    </div>
    <div class="nw-tabpage" data-page="3">
      <div class="nw-field"><span class="nw-label">Analysis</span>${seg('analysisMode', ['on-request','selection-aware','session-aware'])}</div>
      ${check('suppressDuringRecording','Stay silent while recording')}
    </div>
    <div class="nw-tabpage" data-page="4">
      ${check('notifications.chat','Chat replies')}
      ${check('notifications.toast','Toast alerts')}
      ${check('notifications.timelineMarkers','Timeline markers')}
      ${check('notifications.highlightControls','Highlight affected controls')}
      ${check('notifications.voice','Voice (TTS)')}
      ${check('proactiveSuggestions.clipping','Warn about clipping')}
      ${check('proactiveSuggestions.timing','Detect timing issues')}
      ${check('proactiveSuggestions.pitch','Detect pitch issues')}
      ${check('proactiveSuggestions.mixing','Suggest mix changes')}
    </div>
    <div class="nw-tabpage" data-page="5">
      <div class="nw-field"><span class="nw-label">Performance</span>${seg('performanceMode', ['studio','low-cpu','live','battery'])}</div>
    </div>
    <div class="nw-tabpage" data-page="6">
      <div class="nw-field"><span class="nw-label">Sound character</span>${seg('soundCharacter', ['warm','clean','raw'], prefs.productionProfile)}</div>
      <div class="nw-field"><span class="nw-label">Master style</span>${seg('masterStyle', ['dynamic','loud'], prefs.productionProfile)}</div>
      <div class="nw-micro">Session memory: ${sessionMsgs.length} messages · <button class="nw-btn" data-act="clearmem" style="margin-left:6px">Clear</button></div>
    </div>`,
    `<button class="nw-btn" data-nw-close>Cancel</button><button class="nw-btn is-active" data-act="save">Save settings</button>`);

  d.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
    d.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', x === b));
    d.querySelectorAll('.nw-tabpage').forEach(pg => pg.classList.toggle('on', pg.dataset.page === b.dataset.tab));
  });
  d.querySelectorAll('.nw-seg').forEach(sg => sg.onclick = e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    sg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    const key = sg.dataset.seg;
    if (['soundCharacter', 'masterStyle'].includes(key)) prefs.productionProfile[key] = b.dataset.v;
    else prefs[key] = b.dataset.v;
  });
  d.querySelectorAll('[data-check]').forEach(c => c.onchange = () => {
    const ks = c.dataset.check.split('.'); let o = prefs;
    while (ks.length > 1) o = o[ks.shift()];
    o[ks[0]] = c.checked;
  });
  d.querySelectorAll('[data-range]').forEach(r => r.oninput = () => { prefs[r.dataset.range] = +r.value; });
  d.addEventListener('click', async e => {
    const act = e.target.closest('[data-act]')?.dataset.act; if (!act) return;
    if (act === 'save') {
      prefs.backendUrl = d.querySelector('[data-in="backendUrl"]').value.trim() || DEFAULTS.backendUrl;
      prefs.apiKey = d.querySelector('[data-in="apiKey"]').value.trim();
      savePrefs(); window.toast?.('Settings saved'); window.NWDialogs.closeAll(); refreshStatus();
    }
    if (act === 'test') {
      prefs.backendUrl = d.querySelector('[data-in="backendUrl"]').value.trim() || DEFAULTS.backendUrl;
      const lamp = d.querySelector('#nw-set-lamp'); lamp.className = 'nw-lamp busy'; lamp.querySelector('span').textContent = 'Checking…';
      const st = await refreshStatus();
      lamp.className = 'nw-lamp ' + (st.backend ? 'ok' : 'err');
      lamp.querySelector('span').textContent = st.backend ? (st.ollama ? 'Connected · local model' : 'Connected · Hermes') : 'Service unavailable';
    }
    if (act === 'ollama') { const h = d.querySelector('#nw-ollama-help'); h.style.display = h.style.display === 'none' ? 'block' : 'none'; }
    if (act === 'clearmem') { sessionMsgs = []; try { localStorage.removeItem(LSMEM); } catch (_) {} window.toast?.('Session memory cleared'); }
  });
}

window.NeusicAgent = { identity, prefs: () => prefs, chat, openPanel, openSettings, refreshStatus };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(refreshStatus, 600));
else setTimeout(refreshStatus, 600);
})();
