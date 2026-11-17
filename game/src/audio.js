// Sound, all synthesised live with WebAudio: no audio files, no network. Engine hum
// follows speed, the siren is a two-tone wail, and every action has a small synth cue.
export function createAudio() {
  const audio = {
    ctx: null, muted: false, engineOsc: null, engineGain: null, sirenOsc: null, sirenGain: null,
    ensure() {
      if (this.ctx) return;
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
      } catch { /* no audio in this browser */ }
    },
    setMuted(m) {
      this.muted = m;
      if (this.master) this.master.gain.value = m ? 0 : 0.5;
    },
    engine(level) {
      if (!this.ctx || this.muted) return;
      if (!this.engineOsc) {
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        this.engineOsc.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();
      }
      this.engineOsc.frequency.value = 52 + level * 130;
      this.engineGain.gain.value = level > 0.02 ? 0.05 + level * 0.06 : 0;
    },
    siren(on) {
      if (!this.ctx || this.muted) return;
      if (on && !this.sirenOsc) {
        this.sirenOsc = this.ctx.createOscillator();
        this.sirenOsc.type = 'sine';
        this.sirenGain = this.ctx.createGain();
        this.sirenGain.gain.value = 0.045;
        this.sirenOsc.connect(this.sirenGain);
        this.sirenGain.connect(this.master);
        this.sirenOsc.start();
        this._sirenT = 0;
        this._sirenOn = true;
      } else if (!on && this.sirenOsc) {
        try { this.sirenOsc.stop(); } catch { /* already stopped */ }
        this.sirenOsc = null;
        this.sirenGain = null;
        this._sirenOn = false;
      }
      if (this.sirenOsc) {
        this._sirenT = (this._sirenT ?? 0) + 0.016;
        const hi = Math.sin(this._sirenT * 4) > 0;
        this.sirenOsc.frequency.value = hi ? 880 : 660;
      }
    },
    tone(freq, dur, type = 'sine', vol = 0.2, slide = 0) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + dur);
    },
    noise(dur, vol = 0.25) {
      if (!this.ctx || this.muted) return;
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const gain = this.ctx.createGain();
      gain.gain.value = vol;
      src.connect(gain);
      gain.connect(this.master);
      src.start(t);
    },
    play(name) {
      if (!this.ctx || this.muted) return;
      switch (name) {
        case 'pickup': this.tone(660, 0.12, 'sine', 0.22); setTimeout(() => this.tone(990, 0.16, 'sine', 0.22), 90); break;
        case 'mission': [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'triangle', 0.22), i * 110)); break;
        case 'win': [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, 'triangle', 0.22), i * 130)); break;
        case 'crash': this.noise(0.22, 0.3); this.tone(90, 0.18, 'sine', 0.25, -40); break;
        case 'hit': this.noise(0.12, 0.2); this.tone(140, 0.1, 'sine', 0.2, -60); break;
        case 'punch': this.tone(180, 0.09, 'square', 0.18, -90); break;
        case 'steal': this.tone(330, 0.1, 'square', 0.15); setTimeout(() => this.tone(440, 0.12, 'square', 0.15), 80); break;
        case 'siren-blip': this.tone(880, 0.12, 'sine', 0.12); setTimeout(() => this.tone(660, 0.12, 'sine', 0.12), 110); break;
        case 'busted': [392, 330, 262].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, 'sawtooth', 0.18), i * 160)); break;
        case 'wasted': [330, 262, 196, 131].forEach((f, i) => setTimeout(() => this.tone(f, 0.35, 'sawtooth', 0.18), i * 180)); break;
        case 'click': this.tone(700, 0.05, 'sine', 0.12); break;
        default: break;
      }
    },
  };
  return audio;
}
