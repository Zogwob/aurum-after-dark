// audio.js — all sounds synthesized with WebAudio. No audio files, no network.
// Footsteps, pickup chimes, alert stings, camera beeps, a low gallery hum.

(function () {
  'use strict';

  function createAudio() {
    var ctx = null;
    var master = null;
    var muted = false;
    var humNodes = null;

    function ensure() {
      if (ctx) return true;
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.5;
        master.connect(ctx.destination);
        return true;
      } catch (e) { return false; }
    }

    function tone(freq, dur, type, vol, slideTo) {
      if (!ensure() || muted) return;
      try {
        var t = ctx.currentTime;
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.type = type || 'sine';
        o.frequency.setValueAtTime(freq, t);
        if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
        g.gain.setValueAtTime(vol || 0.2, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g); g.connect(master);
        o.start(t); o.stop(t + dur + 0.02);
      } catch (e) { /* audio is best-effort */ }
    }

    function noiseBurst(dur, vol, lowpass) {
      if (!ensure() || muted) return;
      try {
        var t = ctx.currentTime;
        var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
        var buf = ctx.createBuffer(1, len, ctx.sampleRate);
        var data = buf.getChannelData(0);
        for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
        var src = ctx.createBufferSource();
        src.buffer = buf;
        var f = ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = lowpass || 800;
        var g = ctx.createGain();
        g.gain.value = vol || 0.15;
        src.connect(f); f.connect(g); g.connect(master);
        src.start(t);
      } catch (e) { /* best-effort */ }
    }

    return {
      unlock: function () { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
      toggleMute: function () { muted = !muted; return muted; },
      isMuted: function () { return muted; },
      footstep: function (sneaking) { noiseBurst(0.07, sneaking ? 0.04 : 0.12, sneaking ? 400 : 900); },
      pickup: function () { tone(880, 0.12, 'sine', 0.22); tone(1318, 0.18, 'sine', 0.18); },
      starPickup: function () {
        tone(523, 0.15, 'triangle', 0.25); tone(659, 0.15, 'triangle', 0.25);
        tone(784, 0.2, 'triangle', 0.25); tone(1046, 0.35, 'triangle', 0.28);
      },
      suspicious: function () { tone(440, 0.18, 'square', 0.10, 330); },
      alert: function () {
        tone(220, 0.25, 'sawtooth', 0.20, 440);
        tone(440, 0.3, 'sawtooth', 0.16, 220);
      },
      cameraBeep: function () { tone(1560, 0.07, 'square', 0.06); },
      powerCut: function () { tone(180, 0.3, 'sawtooth', 0.18, 60); noiseBurst(0.2, 0.1, 500); },
      caught: function () { tone(110, 0.5, 'sawtooth', 0.25, 55); },
      vaseBreak: function () { noiseBurst(0.25, 0.22, 2400); tone(1400, 0.12, 'triangle', 0.1, 500); },
      levelComplete: function () {
        tone(523, 0.18, 'triangle', 0.25); tone(659, 0.18, 'triangle', 0.25);
        tone(784, 0.18, 'triangle', 0.25); tone(1046, 0.4, 'triangle', 0.3);
      },
      startHum: function () {
        if (!ensure() || humNodes) return;
        try {
          var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 55;
          var g = ctx.createGain(); g.gain.value = 0.035;
          var o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 110.5;
          var g2 = ctx.createGain(); g2.gain.value = 0.012;
          o.connect(g); g.connect(master); o2.connect(g2); g2.connect(master);
          o.start(); o2.start();
          humNodes = { o: o, o2: o2 };
        } catch (e) { /* best-effort */ }
      }
    };
  }

  window.AURUM_AUDIO = { createAudio: createAudio };
})();
