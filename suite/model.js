// Musical state is independent from the browser, renderer and audio graph.
export const uid = () => crypto.randomUUID();
export const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const COLORS = ['#3ab6ed', '#eeb552', '#aa8aec', '#37d3cc', '#ee927c'];
export const beatsToSeconds = (beats, bpm) => beats * 60 / bpm;
export const secondsToBeats = (seconds, bpm) => seconds * bpm / 60;
export const duration = asset => asset.channels[0].length / asset.sampleRate;
export const mixSettings = () => ({volume: .72, pan: 0, muted: false, solo: false, delay: 0, reverb: 0, tone: 0});
export function newProject() {
  return {version: 1, id: uid(), name: 'Untitled session', bpm: 112, loopBars: 4,
    lanes: ['Beatbox', 'Bass', 'Chords', 'Harmony', 'Lead'].map((name, i) => ({id: uid(), name, color: COLORS[i], layers: [], ...mixSettings()})),
    samples: [], sequences: [], tracks: [], scenes: {},
    loom: {assetId: null, slices: [], events: [], bars: 4, sensitivity: .5},
    sections: [{name: 'Intro', beat: 0}, {name: 'Verse', beat: 16}, {name: 'Chorus', beat: 48}, {name: 'Outro', beat: 80}],
    songBeats: 96, updatedAt: Date.now()};
}
export function makeAsset(name, sampleRate, channels, origin = 'recording') {
  if (!channels.length || !channels[0].length) throw new Error('Audio contains no samples.');
  return {id: uid(), name, sampleRate, channels: channels.map(c => new Float32Array(c)), origin};
}
export function makeTrack(name, color = COLORS[0]) { return {id: uid(), name, color, clips: [], ...mixSettings()}; }
export function makeClip(asset, bpm, beat = 0, length) {
  return {id: uid(), assetId: asset.id, name: asset.name, beat, length: length ?? secondsToBeats(duration(asset), bpm), offset: 0, gain: 1};
}
export function transferLanes(project, assets) {
  const created = [];
  for (const lane of project.lanes) {
    if (!lane.layers.length) continue;
    const track = {...makeTrack(lane.name, lane.color), volume: lane.volume, pan: lane.pan, muted: lane.muted,
      delay: lane.delay, reverb: lane.reverb, tone: lane.tone};
    // Each overdub remains a separate clip referencing its immutable source asset.
    track.clips = lane.layers.map(id => makeClip(assets.get(id), project.bpm, 0, project.loopBars * 4));
    created.push(track);
  }
  project.tracks.push(...created);
  return created;
}
export function detectSlices(asset, sensitivity = .5, limit = 16) {
  const pcm = asset.channels[0], sr = asset.sampleRate;
  const hop = Math.max(1, Math.round(sr * .005));
  const energies = [];
  for (let i = 0; i < pcm.length; i += hop) {
    let energy = 0;
    for (let j = i; j < Math.min(i + hop, pcm.length); j++) energy += pcm[j] ** 2;
    energies.push(Math.sqrt(energy / hop));
  }
  const peak = energies.reduce((a, b) => Math.max(a, b), 0);
  const candidates = [];
  let previous = 0;
  for (let i = 1; i < energies.length; i++) {
    const e = energies[i], rise = e - previous;
    if (e > peak * (.12 + (1 - sensitivity) * .3) && rise > peak * (.025 + (1 - sensitivity) * .13)) {
      candidates.push({frame: Math.max(0, (i - 1) * hop), score: rise});
    }
    previous = previous * .65 + e * .35;
  }
  const selected = [0];
  for (const c of candidates.sort((a, b) => b.score - a.score)) {
    if (selected.length >= limit) break;
    if (selected.every(frame => Math.abs(c.frame - frame) > sr * .075) && c.frame < pcm.length - sr * .025) selected.push(c.frame);
  }
  selected.sort((a, b) => a - b);
  return selected.map((frame, i) => ({id: uid(), start: frame / sr, end: (selected[i + 1] ?? pcm.length) / sr, gain: 1, pitch: 0}));
}
export function equalSlices(asset, count = 16) {
  const d = duration(asset);
  return Array.from({length: count}, (_, i) => ({id: uid(), start: i * d / count, end: (i + 1) * d / count, gain: 1, pitch: 0}));
}
export function renderSlice(asset, slice) {
  const rate = 2 ** (slice.pitch / 12);
  const start = Math.round(slice.start * asset.sampleRate);
  const end = Math.min(asset.channels[0].length, Math.round(slice.end * asset.sampleRate));
  const frames = Math.max(1, Math.round((end - start) / rate));
  const fade = Math.min(Math.round(asset.sampleRate * .003), Math.floor(frames / 2));
  return makeAsset(`${asset.name} · slice`, asset.sampleRate, asset.channels.map(pcm => {
    const output = new Float32Array(frames);
    for (let i = 0; i < frames; i++) {
      const pos = start + i * rate, k = Math.floor(pos), fraction = pos - k;
      const value = (pcm[k] ?? 0) * (1 - fraction) + (pcm[Math.min(k + 1, end - 1)] ?? 0) * fraction;
      const envelope = fade ? Math.min(1, i / fade, (frames - 1 - i) / fade) : 1;
      output[i] = value * slice.gain * envelope;
    }
    return output;
  }), 'slice');
}
export function renderSequence(asset, slices, events, bars, bpm) {
  const frames = Math.round(beatsToSeconds(bars * 4, bpm) * asset.sampleRate);
  const channels = asset.channels.map(() => new Float32Array(frames));
  const ordered = events.filter(e => e.beat >= 0 && e.beat < bars * 4 && slices.some(s => s.id === e.sliceId)).sort((a, b) => a.beat - b.beat);
  ordered.forEach((event, i) => {
    const slice = slices.find(s => s.id === event.sliceId);
    const rendered = renderSlice(asset, slice);
    const start = Math.round(beatsToSeconds(event.beat, bpm) * asset.sampleRate);
    // Monophonic choke: an event is cut exactly at the next trigger.
    const next = ordered[i + 1] ? Math.round(beatsToSeconds(ordered[i + 1].beat, bpm) * asset.sampleRate) : frames;
    const length = Math.min(rendered.channels[0].length, next - start, frames - start);
    channels.forEach((out, c) => {
      for (let j = 0; j < length; j++) out[start + j] = rendered.channels[c][j] * Math.min(1, (length - j) / 64);
    });
  });
  return makeAsset(`${asset.name} · pad sequence`, asset.sampleRate, channels, 'sequence');
}
export function mixLane(lane, assets, seconds, sampleRate) {
  const frames = Math.round(seconds * sampleRate);
  const channels = [new Float32Array(frames), new Float32Array(frames)];
  lane.layers.forEach(id => {
    const asset = assets.get(id);
    if (!asset) return;
    channels.forEach((out, c) => {
      const pcm = asset.channels[Math.min(c, asset.channels.length - 1)];
      for (let i = 0; i < frames; i++) {
        const sourceIndex = Math.floor(i * asset.sampleRate / sampleRate);
        out[i] += pcm[sourceIndex] ?? 0;
      }
    });
  });
  return makeAsset(`${lane.name} · Live Loop`, sampleRate, channels, 'live-loop');
}
export function encodeWav(asset) {
  const channels = asset.channels, frames = channels[0].length, block = channels.length * 2;
  const bytes = new ArrayBuffer(44 + frames * block), view = new DataView(bytes);
  const str = (at, value) => [...value].forEach((ch, i) => view.setUint8(at + i, ch.charCodeAt(0)));
  str(0, 'RIFF'); view.setUint32(4, bytes.byteLength - 8, true); str(8, 'WAVE'); str(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels.length, true);
  view.setUint32(24, asset.sampleRate, true); view.setUint32(28, asset.sampleRate * block, true);
  view.setUint16(32, block, true); view.setUint16(34, 16, true); str(36, 'data'); view.setUint32(40, frames * block, true);
  for (let i = 0; i < frames; i++) channels.forEach((pcm, c) => {
    const v = clamp(pcm[i], -1, 1); view.setInt16(44 + i * block + c * 2, Math.round(v * (v < 0 ? 32768 : 32767)), true);
  });
  return bytes;
}
export function validateProject(p, assets) {
  if (p?.version !== 1 || !Number.isFinite(p.bpm) || p.bpm < 40 || p.bpm > 220 || !Array.isArray(p.lanes) || p.lanes.length !== 5 || !p.loom || !Array.isArray(p.tracks)) throw new Error('Not a supported Neusical Suite project.');
  if (![1, 2, 4, 8].includes(p.loopBars) || ![1, 2, 4, 8].includes(p.loom.bars)) throw new Error('Invalid loop length.');
  const idOK = id => typeof id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(id);
  const finite = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;
  if (!idOK(p.id) || typeof p.name !== 'string' || p.name.length > 120 || !Array.isArray(p.samples) || !Array.isArray(p.sequences) || !Array.isArray(p.sections) || !p.scenes || !finite(p.songBeats, 4, 2048)) throw new Error('Invalid project metadata.');
  if (p.tracks.length > 128 || p.samples.length > 1024 || assets.size > 2048) throw new Error('Project exceeds preview capacity.');
  for (const track of [...p.lanes, ...p.tracks]) {
    if (!idOK(track.id) || typeof track.name !== 'string' || !/^#[a-fA-F0-9]{6}$/.test(track.color) || !finite(track.volume, 0, 1.2) || !finite(track.pan, -1, 1) || !finite(track.delay, 0, .6) || !finite(track.reverb, 0, .6) || !finite(track.tone, -12, 12)) throw new Error('Invalid track settings.');
  }
  for (const l of p.lanes) if (!Array.isArray(l.layers) || l.layers.length > 128 || l.layers.some(id => !idOK(id))) throw new Error('Invalid loop layers.');
  for (const t of p.tracks) {
    if (!Array.isArray(t.clips) || t.clips.length > 2048) throw new Error('Invalid track clips.');
    for (const c of t.clips) if (!idOK(c.id) || !idOK(c.assetId) || typeof c.name !== 'string' || !finite(c.beat, 0, 2048) || !finite(c.length, .001, 512) || !finite(c.offset, 0, 3600) || !finite(c.gain, 0, 2)) throw new Error('Invalid audio clip.');
  }
  if (!Array.isArray(p.loom.slices) || p.loom.slices.length > 16 || !Array.isArray(p.loom.events) || p.loom.events.length > 10000 || !finite(p.loom.sensitivity, 0, 1)) throw new Error('Invalid sampler state.');
  const source = assets.get(p.loom.assetId);
  for (const s of p.loom.slices) if (!source || !idOK(s.id) || !finite(s.start, 0, duration(source)) || !finite(s.end, s.start + .00001, duration(source)) || !finite(s.pitch, -12, 12) || !finite(s.gain, 0, 2)) throw new Error('Invalid slice boundaries.');
  for (const e of p.loom.events) if (!idOK(e.id) || !p.loom.slices.some(s => s.id === e.sliceId) || !finite(e.beat, 0, p.loom.bars * 4 - .00001)) throw new Error('Invalid pad event.');
  for (const s of p.sections) if (typeof s.name !== 'string' || !finite(s.beat, 0, p.songBeats)) throw new Error('Invalid song section.');
  for (const scene of Object.values(p.scenes)) {
    if (!Array.isArray(scene) || scene.length !== 5 || scene.some(s => !finite(s.volume,0,1.2) || !finite(s.pan,-1,1) || !finite(s.delay,0,.6) || !finite(s.reverb,0,.6) || !finite(s.tone,-12,12))) throw new Error('Invalid scene settings.');
  }
  const refs = [...p.lanes.flatMap(l => l.layers), ...p.tracks.flatMap(t => t.clips.map(c => c.assetId)), ...p.samples];
  if (p.loom.assetId) refs.push(p.loom.assetId);
  for (const id of refs) if (!assets.has(id)) throw new Error(`Missing audio asset: ${id}`);
  for (const a of assets.values()) {
    if (!idOK(a.id) || typeof a.name !== 'string') throw new Error('Invalid asset metadata.');
    if (!Number.isFinite(a.sampleRate) || a.sampleRate < 8000 || a.sampleRate > 192000 || !Array.isArray(a.channels) || !a.channels.length || a.channels.length > 2) throw new Error('Invalid audio asset.');
    const n = a.channels[0].length;
    if (!n || a.channels.some(c => c.length !== n || c.some(v => !Number.isFinite(v)))) throw new Error('Invalid audio samples.');
  }
  return true;
}
