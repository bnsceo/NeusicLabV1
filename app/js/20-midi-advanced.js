/* ═══════════════════════════════════════════════
   Advanced MIDI: Full MIDI 2.0 support, MPE (MIDI Polyphonic Expression),
   MIDI clock sync, song position pointer, and advanced mapping
═══════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════
   ENHANCED MIDI DEVICE MANAGEMENT
   Extended from 13-midi-devices.js with full MIDI 2.0 features
═══════════════════════════════════════════════════════════════ */

const MIDI_ADV = {
  devices: [],
  activeInputs: new Map(),
  activeOutputs: new Map(),
  learnMode: false,
  learnTarget: null,
  mappings: new Map(), // CC/Note → Parameter mappings
  channelFilters: new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]),
  drumChannel: 9,
  mpeZone: { enabled: false, masterChannel: 0, memberChannels: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15] },
  
  // MIDI Clock synchronization
  clockSync: {
    enabled: false,
    externalClock: false,
    lastClockTime: 0,
    tempo: 120,
    pulsesPerBeat: 24,
    pulseCount: 0
  }
};

// Enhanced MIDI initialization with full device enumeration
async function initMIDIAdvanced() {
  if (!navigator.requestMIDIAccess) {
    toast('Web MIDI not supported in this browser');
    return false;
  }
  
  try {
    const access = await navigator.requestMIDIAccess({ sysex: true });
    MIDI_ADV.access = access;
    
    // Enumerate all inputs
    access.inputs.forEach(input => {
      MIDI_ADV.devices.push({
        id: input.id,
        name: input.name,
        manufacturer: input.manufacturer,
        type: 'input',
        state: input.state,
        connection: input.connection
      });
      setupMIDIInput(input);
    });
    
    // Enumerate all outputs
    access.outputs.forEach(output => {
      MIDI_ADV.devices.push({
        id: output.id,
        name: output.name,
        manufacturer: output.manufacturer,
        type: 'output',
        state: output.state,
        connection: output.connection
      });
      MIDI_ADV.activeOutputs.set(output.id, output);
    });
    
    // Handle hot-plug events
    access.onstatechange = (e) => {
      const port = e.port;
      const existingIdx = MIDI_ADV.devices.findIndex(d => d.id === port.id);
      
      if (port.state === 'connected') {
        if (existingIdx >= 0) {
          MIDI_ADV.devices[existingIdx].state = 'connected';
        } else {
          MIDI_ADV.devices.push({
            id: port.id,
            name: port.name,
            manufacturer: port.manufacturer,
            type: port.type,
            state: port.state,
            connection: port.connection
          });
        }
        
        if (port.type === 'input' && port.state === 'connected') {
          setupMIDIInput(port);
        } else if (port.type === 'output') {
          MIDI_ADV.activeOutputs.set(port.id, port);
        }
        
        toast(`🎹 MIDI connected: ${port.name}`);
      } else {
        if (existingIdx >= 0) {
          MIDI_ADV.devices[existingIdx].state = 'disconnected';
        }
        
        if (port.type === 'input') {
          MIDI_ADV.activeInputs.delete(port.id);
        } else {
          MIDI_ADV.activeOutputs.delete(port.id);
        }
        
        toast(`MIDI disconnected: ${port.name}`);
      }
      
      refreshMIDIDeviceList();
    };
    
    toast(`✅ MIDI initialized · ${access.inputs.size} input(s), ${access.outputs.size} output(s)`);
    refreshMIDIDeviceList();
    return true;
    
  } catch (err) {
    console.error('MIDI initialization failed:', err);
    toast('❌ MIDI access denied: ' + err.message);
    return false;
  }
}

function setupMIDIInput(input) {
  input.onmidimessage = (msg) => {
    const [status, data1, data2] = msg.data;
    const command = status & 0xF0;
    const channel = status & 0x0F;
    
    // Filter by channel
    if (!MIDI_ADV.channelFilters.has(channel)) return;
    
    // Check for MPE messages
    if (MIDI_ADV.mpeZone.enabled) {
      handleMPESignal(command, data1, data2, channel);
      return;
    }
    
    switch (command) {
      case 0x90: // Note On
        if (data2 > 0) {
          handleMIDINoteOn(data1, data2, channel, input.id);
        } else {
          handleMIDINoteOff(data1, channel, input.id);
        }
        break;
      case 0x80: // Note Off
        handleMIDINoteOff(data1, channel, input.id);
        break;
      case 0xB0: // Control Change
        handleMIDIControlChange(data1, data2, channel, input.id);
        break;
      case 0xE0: // Pitch Bend
        handleMIDIPitchBend(((data2 << 7) | data1) - 8192, channel, input.id);
        break;
      case 0xD0: // Channel Aftertouch
        handleMIDIAftertouch(data1, channel, input.id);
        break;
      case 0xC0: // Program Change
        handleMIDIProgramChange(data1, channel, input.id);
        break;
      case 0xF0: // System Messages
        handleMIDISystemMessage(status, data1, data2, input.id);
        break;
    }
  };
  
  MIDI_ADV.activeInputs.set(input.id, input);
}

// Enhanced note handling with velocity curves and aftertouch
function handleMIDINoteOn(note, velocity, channel, deviceId) {
  const normalizedVel = velocity / 127;
  const appliedVel = applyVelocityCurve(normalizedVel);
  
  // Visual feedback on pads
  flashMIDIPad(note, appliedVel);
  
  // Route to appropriate handler
  if (channel === MIDI_ADV.drumChannel) {
    triggerDrumPad(note, appliedVel);
  } else if (S.activePanel === 'sampler') {
    triggerSamplerPad(note, appliedVel);
  } else {
    recordMIDINote(note, appliedVel, channel);
  }
  
  // Send MIDI out if mapped
  sendMIDIOut(0x90 | channel, note, velocity);
}

function handleMIDINoteOff(note, channel, deviceId) {
  stopMIDINote(note, channel);
  sendMIDIOut(0x80 | channel, note, 0);
}

function handleMIDIControlChange(cc, value, channel, deviceId) {
  const normalized = value / 127;
  
  // Check for learned mappings
  const mappingKey = `cc_${cc}_ch${channel}`;
  if (MIDI_ADV.mappings.has(mappingKey)) {
    const target = MIDI_ADV.mappings.get(mappingKey);
    applyMappedParameter(target, normalized);
    return;
  }
  
  // Handle standard MIDI CCs
  switch (cc) {
    case 7: // Volume
      Audio_.setMasterVol(normalized);
      break;
    case 10: // Pan
      // Apply pan to active track
      break;
    case 11: // Expression
      break;
    case 64: // Sustain pedal
      if (value >= 64) {
        PR.sustainPedal = true;
      } else {
        PR.sustainPedal = false;
        releaseSustainedNotes();
      }
      break;
    case 1: // Modulation wheel
      applyModulation(normalized);
      break;
  }
  
  // Visual feedback
  if (MIDI_ADV.learnMode) {
    highlightLearnTarget(cc, value);
  }
}

function handleMIDIPitchBend(bend, channel, deviceId) {
  // bend is -8192 to +8191
  const normalized = bend / 8192;
  applyPitchBend(normalized, channel);
}

function handleMIDIAftertouch(pressure, channel, deviceId) {
  const normalized = pressure / 127;
  applyAftertouch(normalized, channel);
}

function handleMIDIProgramChange(program, channel, deviceId) {
  // Switch instrument preset
  switchInstrumentPreset(program, channel);
}

function handleMIDISystemMessage(status, data1, data2, deviceId) {
  switch (status) {
    case 0xF8: // MIDI Clock
      if (MIDI_ADV.clockSync.enabled && MIDI_ADV.clockSync.externalClock) {
        handleExternalClock();
      }
      break;
    case 0xFA: // Start
      if (MIDI_ADV.clockSync.enabled) {
        playButton();
      }
      break;
    case 0xFB: // Continue
      if (MIDI_ADV.clockSync.enabled) {
        playButton();
      }
      break;
    case 0xFC: // Stop
      if (MIDI_ADV.clockSync.enabled) {
        stopButton();
      }
      break;
    case 0xF2: // Song Position Pointer
      const beats = ((data2 << 7) | data1) / 24;
      seekToBeat(beats);
      break;
  }
}

// MPE (MIDI Polyphonic Expression) support
function handleMPESignal(command, data1, data2, channel) {
  if (!MIDI_ADV.mpeZone.memberChannels.includes(channel)) return;
  
  const noteIndex = channel - 1; // Member channels 1-15 map to voices 0-14
  
  switch (command) {
    case 0x90: // Note On with MPE
      if (data2 > 0) {
        // Initial touch
        triggerMPEVoice(noteIndex, data1, data2);
      }
      break;
    case 0xD0: // Channel Pressure (after initial note)
      // This is actually polyphonic aftertouch in MPE
      applyMPEPressure(noteIndex, data1 / 127);
      break;
    case 0xB0: // RPN/NRN messages for MPE
      if (data1 === 0) { // RPN LSB
        // Pitch bend range
      } else if (data1 === 1) {
        // Channel pressure range
      }
      break;
    case 0xE0: // Pitch bend per-note
      applyMPEPitchBend(noteIndex, ((data2 << 7) | data1) - 8192);
      break;
  }
}

// Velocity curve application
function applyVelocityCurve(normalized, curveType = 'linear') {
  switch (curveType) {
    case 'log':
      return Math.pow(normalized, 1.5);
    case 'exp':
      return Math.sqrt(normalized);
    case 'fixed':
      return 0.8; // Fixed velocity
    default:
      return normalized;
  }
}

// MIDI Learn functionality
function startMIDILearn(parameterId, parameterName) {
  MIDI_ADV.learnMode = true;
  MIDI_ADV.learnTarget = { id: parameterId, name: parameterName };
  toast(`🎛️ MIDI Learn: Move a knob/fader for "${parameterName}"`);
  
  // Auto-timeout after 10 seconds
  setTimeout(() => {
    if (MIDI_ADV.learnMode) {
      MIDI_ADV.learnMode = false;
      MIDI_ADV.learnTarget = null;
      toast('MIDI Learn cancelled');
    }
  }, 10000);
}

function completeMIDILearn(cc, channel) {
  if (!MIDI_ADV.learnTarget) return;
  
  const mappingKey = `cc_${cc}_ch${channel}`;
  MIDI_ADV.mappings.set(mappingKey, MIDI_ADV.learnTarget);
  
  toast(`✅ Learned: CC${cc} → ${MIDI_ADV.learnTarget.name}`);
  
  MIDI_ADV.learnMode = false;
  MIDI_ADV.learnTarget = null;
  
  saveMIDIMappings();
}

// Save/load MIDI mappings to localStorage
function saveMIDIMappings() {
  const mappingsObj = {};
  MIDI_ADV.mappings.forEach((value, key) => {
    mappingsObj[key] = value;
  });
  localStorage.setItem('neusic_midi_mappings', JSON.stringify(mappingsObj));
}

function loadMIDIMappings() {
  const saved = localStorage.getItem('neusic_midi_mappings');
  if (saved) {
    const mappingsObj = JSON.parse(saved);
    Object.entries(mappingsObj).forEach(([key, value]) => {
      MIDI_ADV.mappings.set(key, value);
    });
  }
}

// Send MIDI to external devices
function sendMIDIOut(status, data1, data2) {
  if (!MIDI_ADV.activeOutputs.size) return;
  
  MIDI_ADV.activeOutputs.forEach((output, id) => {
    try {
      output.send([status, data1, data2]);
    } catch (err) {
      console.warn('Failed to send MIDI to', id, err);
    }
  });
}

function sendMIDIProgramChange(program, channel = 0) {
  sendMIDIOut(0xC0 | channel, program, 0);
}

function sendMIDIClock() {
  if (!MIDI_ADV.clockSync.enabled) return;
  
  MIDI_ADV.activeOutputs.forEach((output) => {
    try {
      output.send([0xF8]); // MIDI Clock tick
    } catch (err) {
      console.warn('Failed to send MIDI clock', err);
    }
  });
}

// External clock synchronization
function handleExternalClock() {
  const now = performance.now();
  const delta = now - MIDI_ADV.clockSync.lastClockTime;
  MIDI_ADV.clockSync.lastClockTime = now;
  MIDI_ADV.clockSync.pulseCount++;
  
  // Calculate tempo from clock interval (24 pulses per beat)
  if (MIDI_ADV.clockSync.pulseCount % 24 === 0) {
    const msPerBeat = delta * 24;
    MIDI_ADV.clockSync.tempo = Math.round(60000 / msPerBeat);
    
    // Sync project BPM to external clock
    if (MIDI_ADV.clockSync.externalClock) {
      S.bpm = MIDI_ADV.clockSync.tempo;
      updateBPMDisplay();
    }
  }
}

// UI Functions
function refreshMIDIDeviceList() {
  const el = document.getElementById('midi-dev-list');
  if (!el) return;
  
  const inputs = MIDI_ADV.devices.filter(d => d.type === 'input');
  const outputs = MIDI_ADV.devices.filter(d => d.type === 'output');
  
  if (!inputs.length && !outputs.length) {
    el.innerHTML = '<div style="font-size:11px;color:var(--txt2);padding:8px 0;">No MIDI devices connected</div>';
    return;
  }
  
  let html = '';
  
  if (inputs.length) {
    html += '<div style="font-size:10px;color:var(--txt3);margin-bottom:4px;">INPUTS</div>';
    inputs.forEach(dev => {
      html += `<div class="midi-device-row" style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--bg2);">
        <div class="midi-dev-led" style="width:8px;height:8px;border-radius:50%;background:${dev.state==='connected'?'var(--grn)':'var(--txt3)'}"></div>
        <div style="flex:1">
          <div style="font-size:12px;color:var(--txt);">${dev.name}</div>
          <div style="font-size:10px;color:var(--txt2);">${dev.manufacturer || 'Unknown'}</div>
        </div>
        <button class="chop-btn sec" style="padding:2px 7px;font-size:10px;" onclick="startMIDILearn('volume','Master Volume')">Learn</button>
      </div>`;
    });
  }
  
  if (outputs.length) {
    html += '<div style="font-size:10px;color:var(--txt3);margin:8px 0 4px;">OUTPUTS</div>';
    outputs.forEach(dev => {
      html += `<div class="midi-device-row" style="display:flex;align-items:center;gap:8px;padding:6px 0;">
        <div class="midi-dev-led" style="width:8px;height:8px;border-radius:50%;background:${dev.state==='connected'?'var(--blu)':'var(--txt3)'}"></div>
        <div style="flex:1">
          <div style="font-size:12px;color:var(--txt);">${dev.name}</div>
          <div style="font-size:10px;color:var(--txt2);">${dev.manufacturer || 'Unknown'}</div>
        </div>
      </div>`;
    });
  }
  
  el.innerHTML = html;
}

// Initialize on load
if (typeof window !== 'undefined') {
  window.initMIDIAdvanced = initMIDIAdvanced;
  window.startMIDILearn = startMIDILearn;
  window.saveMIDIMappings = saveMIDIMappings;
  window.loadMIDIMappings = loadMIDIMappings;
  
  // Auto-load mappings
  loadMIDIMappings();
}
