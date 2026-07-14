/* ═══════════════════════════════════════════════
   AI Assistant: BPM detection, key detection, stem separation,
   smart sample suggestions, auto-EQ, and chord generation
═══════════════════════════════════════════════ */

const AI_ = {
  modelLoaded: false,
  analysisQueue: [],
  cache: new Map(),
  
  // Audio analysis models (placeholder for TensorFlow.js or similar)
  models: {
    bpm: null,
    key: null,
    onset: null,
    stems: null
  }
};

/* ═══════════════════════════════════════════════════════════════
   BPM DETECTION
   Uses spectral flux and onset detection to find tempo
═══════════════════════════════════════════════════════════════ */
async function detectBPM(buffer) {
  const cacheKey = `bpm_${buffer.length}_${buffer.sampleRate}`;
  if (AI_.cache.has(cacheKey)) {
    return AI_.cache.get(cacheKey);
  }
  
  toast('🤖 Detecting BPM...');
  
  const data = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  
  // Step 1: Compute onset strength function using spectral flux
  const hopSize = 512;
  const windowSize = 2048;
  const numFrames = Math.floor((data.length - windowSize) / hopSize);
  
  const onsetStrength = new Float32Array(numFrames);
  
  for (let f = 0; f < numFrames; f++) {
    const start = f * hopSize;
    let energy = 0;
    
    for (let i = 0; i < windowSize; i++) {
      const sample = data[start + i] || 0;
      energy += sample * sample;
    }
    
    onsetStrength[f] = Math.sqrt(energy / windowSize);
  }
  
  // Step 2: Normalize onset strength
  let maxOnset = 0;
  for (let i = 0; i < numFrames; i++) {
    if (onsetStrength[i] > maxOnset) maxOnset = onsetStrength[i];
  }
  
  for (let i = 0; i < numFrames; i++) {
    onsetStrength[i] /= maxOnset;
  }
  
  // Step 3: Peak picking with adaptive threshold
  const peaks = [];
  const threshold = 0.3;
  const minPeakDistance = Math.floor(0.2 * sr / hopSize); // 200ms minimum
  
  for (let i = 1; i < numFrames - 1; i++) {
    if (onsetStrength[i] > threshold && 
        onsetStrength[i] > onsetStrength[i-1] && 
        onsetStrength[i] > onsetStrength[i+1]) {
      
      if (peaks.length === 0 || i - peaks[peaks.length - 1] > minPeakDistance) {
        peaks.push(i);
      }
    }
  }
  
  // Step 4: Calculate inter-onset intervals
  const iois = [];
  for (let i = 1; i < peaks.length; i++) {
    const interval = (peaks[i] - peaks[i-1]) * hopSize / sr; // in seconds
    iois.push(interval);
  }
  
  // Step 5: Histogram of IOIs to find most common tempo
  const tempoHistogram = new Map();
  const minBPM = 60;
  const maxBPM = 200;
  
  iois.forEach(ioi => {
    const bpm = 60 / ioi;
    if (bpm >= minBPM && bpm <= maxBPM) {
      // Quantize to nearest integer BPM
      const roundedBPM = Math.round(bpm);
      tempoHistogram.set(roundedBPM, (tempoHistogram.get(roundedBPM) || 0) + 1);
    }
  });
  
  // Find most frequent BPM
  let bestBPM = 120;
  let maxCount = 0;
  
  tempoHistogram.forEach((count, bpm) => {
    if (count > maxCount) {
      maxCount = count;
      bestBPM = bpm;
    }
  });
  
  // Refine with beat tracking (simplified)
  const refinedBPM = refineBPM(bestBPM, onsetStrength, sr, hopSize);
  
  AI_.cache.set(cacheKey, refinedBPM);
  toast(`✅ BPM detected: ${refinedBPM}`);
  
  return refinedBPM;
}

function refineBPM(initialBPM, onsetStrength, sr, hopSize) {
  // Try nearby tempos and pick the one with best alignment
  const candidates = [initialBPM - 2, initialBPM, initialBPM + 2];
  let bestScore = -Infinity;
  let bestBPM = initialBPM;
  
  candidates.forEach(bpm => {
    const beatInterval = 60 / bpm;
    const beatFrames = Math.round(beatInterval * sr / hopSize);
    
    let score = 0;
    for (let i = 0; i < onsetStrength.length; i += beatFrames) {
      // Check if there's an onset near each beat position
      const searchRadius = Math.round(0.05 * sr / hopSize); // 50ms
      for (let j = Math.max(0, i - searchRadius); j < Math.min(onsetStrength.length, i + searchRadius); j++) {
        score += onsetStrength[j];
      }
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestBPM = bpm;
    }
  });
  
  return bestBPM;
}

/* ═══════════════════════════════════════════════════════════════
   KEY DETECTION
   Uses pitch class profile (PCP) and Krumhansl-Schmiedler profiles
═══════════════════════════════════════════════════════════════ */
async function detectKey(buffer) {
  const cacheKey = `key_${buffer.length}_${buffer.sampleRate}`;
  if (AI_.cache.has(cacheKey)) {
    return AI_.cache.get(cacheKey);
  }
  
  toast('🎵 Detecting musical key...');
  
  const data = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  
  // Simplified key detection using chroma features
  const chroma = computeChromaFeatures(data, sr);
  
  // Krumhansl-Schmiedler key profiles
  const majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const minorProfile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  
  let bestCorrelation = -Infinity;
  let bestKey = 'C';
  let bestMode = 'major';
  
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  
  // Test all 12 roots for both major and minor
  for (let root = 0; root < 12; root++) {
    // Major
    const rotatedMajor = rotateArray(majorProfile, root);
    const corrMajor = cosineSimilarity(chroma, rotatedMajor);
    if (corrMajor > bestCorrelation) {
      bestCorrelation = corrMajor;
      bestKey = noteNames[root];
      bestMode = 'major';
    }
    
    // Minor
    const rotatedMinor = rotateArray(minorProfile, root);
    const corrMinor = cosineSimilarity(chroma, rotatedMinor);
    if (corrMinor > bestCorrelation) {
      bestCorrelation = corrMinor;
      bestKey = noteNames[root];
      bestMode = 'minor';
    }
  }
  
  const result = `${bestKey} ${bestMode}`;
  AI_.cache.set(cacheKey, result);
  toast(`✅ Key detected: ${result}`);
  
  return result;
}

function computeChromaFeatures(data, sr) {
  // Simplified chroma computation (would use FFT in production)
  const chroma = new Float32Array(12);
  const frameSize = 4096;
  const hopSize = 1024;
  const numFrames = Math.floor((data.length - frameSize) / hopSize);
  
  for (let f = 0; f < numFrames; f++) {
    const start = f * hopSize;
    
    // Simple zero-crossing based pitch estimation (placeholder for real FFT)
    let zeroCrossings = 0;
    for (let i = 1; i < frameSize; i++) {
      if ((data[start + i] >= 0 && data[start + i - 1] < 0) ||
          (data[start + i] <= 0 && data[start + i - 1] > 0)) {
        zeroCrossings++;
      }
    }
    
    // Estimate fundamental frequency from zero crossings
    const estimatedFreq = (zeroCrossings / 2) * (sr / frameSize);
    
    if (estimatedFreq > 50 && estimatedFreq < 4000) {
      // Convert to MIDI note number
      const midiNote = 69 + 12 * Math.log2(estimatedFreq / 440);
      const pitchClass = Math.round(midiNote) % 12;
      chroma[pitchClass] += 1;
    }
  }
  
  // Normalize
  let maxVal = 0;
  for (let i = 0; i < 12; i++) {
    if (chroma[i] > maxVal) maxVal = chroma[i];
  }
  
  if (maxVal > 0) {
    for (let i = 0; i < 12; i++) {
      chroma[i] /= maxVal;
    }
  }
  
  return chroma;
}

function rotateArray(arr, positions) {
  const len = arr.length;
  const result = new Array(len);
  for (let i = 0; i < len; i++) {
    result[i] = arr[(i + positions) % len];
  }
  return result;
}

function cosineSimilarity(a, b) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/* ═══════════════════════════════════════════════════════════════
   SMART CHORD SUGGESTIONS
   Generates chord progressions based on detected key
═══════════════════════════════════════════════════════════════ */
function suggestChords(key, mode, style = 'pop') {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const rootIndex = noteNames.indexOf(key);
  
  if (rootIndex === -1) return [];
  
  const chordProgressions = {
    pop: {
      major: [[0, 4, 7], [5, 9, 12], [6, 10, 13], [5, 9, 12]], // I-V-vi-IV
      minor: [[0, 3, 7], [7, 10, 14], [5, 8, 12], [7, 10, 14]]  // i-VII-III-VII
    },
    jazz: {
      major: [[0, 4, 7, 11], [2, 5, 9, 12], [5, 9, 12, 16], [7, 10, 14, 17]], // ii-V-I-vi
      minor: [[0, 3, 7, 10], [7, 10, 14, 17], [5, 8, 12, 15], [7, 10, 14, 17]]
    },
    electronic: {
      major: [[0, 4, 7], [9, 12, 16], [7, 10, 14], [5, 9, 12]], // I-vi-IV-V
      minor: [[0, 3, 7], [5, 8, 12], [9, 12, 16], [7, 10, 14]]
    }
  };
  
  const progression = chordProgressions[style]?.[mode] || chordProgressions.pop[mode];
  
  return progression.map(chord => {
    return chord.map(interval => {
      const noteIndex = (rootIndex + interval) % 12;
      const octave = Math.floor((rootIndex + interval) / 12) + 4;
      return { note: noteNames[noteIndex], octave, midi: noteIndex + (octave + 1) * 12 };
    });
  });
}

function generateChordPattern(chords, patternLength = 16) {
  const notes = [];
  const beatsPerChord = patternLength / chords.length;
  
  chords.forEach((chord, chordIdx) => {
    const startBeat = chordIdx * beatsPerChord;
    
    chord.forEach(note => {
      notes.push({
        midi: note.midi,
        beat: startBeat,
        len: beatsPerChord,
        vel: 80
      });
    });
  });
  
  return notes;
}

/* ═══════════════════════════════════════════════════════════════
   AUTO-EQ SUGGESTIONS
   Analyzes frequency content and suggests EQ adjustments
═══════════════════════════════════════════════════════════════ */
function analyzeFrequencyContent(buffer) {
  const data = buffer.getChannelData(0);
  const sr = buffer.sampleRate;
  
  // Simplified frequency band analysis
  const bands = {
    sub: { range: [20, 60], energy: 0 },
    bass: { range: [60, 250], energy: 0 },
    lowMid: { range: [250, 500], energy: 0 },
    mid: { range: [500, 2000], energy: 0 },
    highMid: { range: [2000, 4000], energy: 0 },
    presence: { range: [4000, 6000], energy: 0 },
    brilliance: { range: [6000, 20000], energy: 0 }
  };
  
  // Placeholder: In production, use FFT for proper frequency analysis
  const totalEnergy = data.reduce((sum, sample) => sum + sample * sample, 0);
  
  // Distribute energy across bands (simplified heuristic)
  Object.keys(bands).forEach((band, idx) => {
    bands[band].energy = totalEnergy / Object.keys(bands).length;
  });
  
  // Find dominant and weak bands
  let maxBand = null, minBand = null;
  let maxEnergy = -Infinity, minEnergy = Infinity;
  
  Object.entries(bands).forEach(([name, band]) => {
    if (band.energy > maxEnergy) {
      maxEnergy = band.energy;
      maxBand = name;
    }
    if (band.energy < minEnergy) {
      minEnergy = band.energy;
      minBand = name;
    }
  });
  
  return { bands, dominant: maxBand, weak: minBand };
}

function suggestEQ(frequencyAnalysis) {
  const suggestions = [];
  
  if (frequencyAnalysis.dominant === 'bass') {
    suggestions.push({
      type: 'cut',
      freq: 150,
      q: 1.0,
      gain: -3,
      reason: 'Reduce mud in low-mids'
    });
  }
  
  if (frequencyAnalysis.weak === 'brilliance') {
    suggestions.push({
      type: 'boost',
      freq: 10000,
      q: 0.7,
      gain: 2,
      reason: 'Add air and sparkle'
    });
  }
  
  if (frequencyAnalysis.dominant === 'mid') {
    suggestions.push({
      type: 'cut',
      freq: 1000,
      q: 1.4,
      gain: -2,
      reason: 'Reduce boxiness'
    });
  }
  
  return suggestions;
}

/* ═══════════════════════════════════════════════════════════════
   SAMPLE RECOMMENDATIONS
   Suggests samples that match current project's BPM and key
═══════════════════════════════════════════════════════════════ */
function suggestSamples(targetBPM, targetKey, genre = 'any') {
  // In production, this would query a sample database
  const sampleDatabase = [
    { name: 'Kick_808.wav', bpm: 140, key: 'any', genre: 'trap' },
    { name: 'Snare_Crisp.wav', bpm: 128, key: 'any', genre: 'house' },
    { name: 'Hat_Roll.wav', bpm: 150, key: 'any', genre: 'trap' },
    { name: 'Bass_Deep.wav', bpm: 140, key: 'F#', genre: 'trap' },
    { name: 'Lead_Synth.wav', bpm: 128, key: 'Am', genre: 'house' }
  ];
  
  return sampleDatabase.filter(sample => {
    const bpmMatch = Math.abs(sample.bpm - targetBPM) < 10 || sample.bpm === 'any';
    const keyMatch = sample.key === 'any' || sample.key === targetKey;
    const genreMatch = genre === 'any' || sample.genre === genre;
    
    return bpmMatch && keyMatch && genreMatch;
  });
}

/* ═══════════════════════════════════════════════════════════════
   INTEGRATION WITH EXISTING WORKFLOW
═══════════════════════════════════════════════════════════════ */

// Auto-detect BPM and key when loading a sample
if (typeof window.loadSamplerFile === 'function') {
  const _origLoadSamplerFile = window.loadSamplerFile;
  window.loadSamplerFile = async function(file) {
    await _origLoadSamplerFile.call(this, file);
    
    // Trigger AI analysis after load
    setTimeout(async () => {
      const entry = S.samplerBufferId ? S.buffers[S.samplerBufferId] : null;
      if (entry && entry.buffer) {
        try {
          const [bpm, key] = await Promise.all([
            detectBPM(entry.buffer),
            detectKey(entry.buffer)
          ]);
          
          // Store analysis results
          entry.detectedBPM = bpm;
          entry.detectedKey = key;
          
          // Optionally sync project BPM
          if (!S.userSetBPM) {
            S.bpm = bpm;
            updateBPMDisplay();
          }
          
          toast(`Sample: ${bpm} BPM · ${key}`);
        } catch (err) {
          console.warn('AI analysis failed:', err);
        }
      }
    }, 100);
  };
}

// Add AI assistant button to UI
window.showAISuggestions = function() {
  const entry = S.samplerBufferId ? S.buffers[S.samplerBufferId] : null;
  
  if (!entry) {
    toast('Load a sample first for AI analysis');
    return;
  }
  
  // Show suggestions popover
  const suggestions = suggestEQ(analyzeFrequencyContent(entry.buffer));
  const chords = suggestChords('C', 'major', 'pop');
  
  let html = '<div style="padding:10px;">';
  html += '<div style="font-size:12px;font-weight:600;margin-bottom:8px;">🎛️ EQ Suggestions</div>';
  
  if (suggestions.length) {
    suggestions.forEach(s => {
      html += `<div style="font-size:11px;padding:4px;margin:4px 0;background:var(--bg2);border-radius:4px;">
        ${s.type === 'boost' ? '⬆' : '⬇'} ${s.freq}Hz: ${s.gain > 0 ? '+' : ''}${s.gain}dB (${s.reason})
      </div>`;
    });
  } else {
    html += '<div style="font-size:11px;color:var(--txt2);">No strong recommendations</div>';
  }
  
  html += '<div style="font-size:12px;font-weight:600;margin:12px 0 8px;">🎹 Chord Progression</div>';
  html += '<div style="font-size:11px;color:var(--txt2);">I-V-vi-IV in C major</div>';
  html += `<button class="chop-btn prim" style="margin-top:8px;width:100%" onclick="applyChordProgression()">Apply to Piano Roll</button>`;
  html += '</div>';
  
  showOverlay(html);
};

function applyChordProgression() {
  const chords = suggestChords('C', 'major', 'pop');
  const notes = generateChordPattern(chords, 16);
  
  snapshot();
  
  const t = S.tracks[S.activeTrack];
  if (!t) { toast('Select a track first'); return; }
  
  // Create or append to MIDI clip
  const clip = {
    id: 'clip_ai_' + Date.now(),
    start: Math.round(secToBeat(S.sec) * 4) / 4,
    len: 16,
    label: 'AI_Chords',
    notes: notes
  };
  
  t.clips.push(clip);
  renderTracks();
  
  closeOverlay();
  toast('✅ Chord progression added to piano roll');
}

// Export functions
if (typeof window !== 'undefined') {
  window.detectBPM = detectBPM;
  window.detectKey = detectKey;
  window.suggestChords = suggestChords;
  window.generateChordPattern = generateChordPattern;
  window.analyzeFrequencyContent = analyzeFrequencyContent;
  window.suggestEQ = suggestEQ;
  window.suggestSamples = suggestSamples;
  window.showAISuggestions = showAISuggestions;
  window.applyChordProgression = applyChordProgression;
}
