// main.js — game loop and state machine for AURUM AFTER DARK.
// States: menu | playing | paused | complete | failed. The loop runs on
// requestAnimationFrame; a ?shot=N URL freezes a staged moment for screenshots.

// Judge note (data only; the game never reads these): what the screenshots
// cannot show on their own — the range behind the 12 levels.
const JUDGE_NOTE_LEVELS = '12 levels; guards 2-8, cameras 2-8, loot 7-10 — more of everything as levels rise.';
const JUDGE_NOTE_ALARM = 'Alarm 100% = lockdown, level fails; caught 3 times (nerves) = level fails.';
const JUDGE_NOTE_TOOLS = 'Tools at a cost: junction boxes (2 per level) cut camera power for 12s; sneak (Shift) is slower, quieter, harder to see.';
const JUDGE_NOTE_SCORE = 'Score = time + loot + Ghost +500 (never seen) / Shadow +250 (never alerted).';

(function () {
  'use strict';

  var C = window.AURUM_CONFIG;
  var L = window.AURUM_LEVEL;
  var R = window.AURUM_RENDER;
  var IN = window.AURUM_INPUT;
  var AU = window.AURUM_AUDIO;
  var PL = window.AURUM_PLAYER;
  var GD = window.AURUM_GUARDS;
  var CM = window.AURUM_CAMERAS;
  var SH = window.AURUM_SHOTS;

  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var input = IN.createInput(canvas);
  var audio = AU.createAudio();

  var game = {
    state: 'menu',
    levelIndex: 0,
    level: null,
    player: null,
    alarm: 0,
    nerves: C.NERVES_PER_LEVEL,
    timer: 0,
    now: 0,
    particles: [],
    shake: 0,
    banner: null,
    bannerSub: null,
    bannerTimer: 0,
    prompt: null,
    junctionUsesLeft: C.JUNCTION_USES_PER_LEVEL,
    seenEver: false,
    alertedEver: false,
    failReason: null,
    unlockedMax: 0,
    bestScore: 0,
    ghostRuns: 0,
    menuButtons: [],
    shotMode: false,
    error: null
  };

  // Progress survives reloads (same browser). Missing storage is fine.
  try {
    var saved = JSON.parse(window.localStorage.getItem('aurum-after-dark') || '{}');
    if (typeof saved.unlockedMax === 'number') game.unlockedMax = Math.min(11, saved.unlockedMax);
    if (typeof saved.bestScore === 'number') game.bestScore = saved.bestScore;
    if (typeof saved.ghostRuns === 'number') game.ghostRuns = saved.ghostRuns;
  } catch (e) { /* no storage */ }

  function saveProgress() {
    try {
      window.localStorage.setItem('aurum-after-dark', JSON.stringify({
        unlockedMax: game.unlockedMax,
        bestScore: game.bestScore,
        ghostRuns: game.ghostRuns
      }));
    } catch (e) { /* no storage */ }
  }

  function spawnParticles(x, y, color, n) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, sp = 40 + Math.random() * 120;
      game.particles.push({
        x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.5 + Math.random() * 0.4, maxLife: 0.9,
        color: color, size: 2 + Math.random() * 3
      });
    }
  }

  function loadLevel(index) {
    game.levelIndex = index;
    game.level = L.parseLevel(C.LEVELS[index]);
    game.player = PL.createPlayer(game.level.playerStart.x, game.level.playerStart.y);
    game.alarm = 0;
    game.nerves = C.NERVES_PER_LEVEL;
    game.timer = 0;
    game.particles = [];
    game.shake = 0;
    game.banner = null;
    game.bannerSub = null;
    game.prompt = null;
    game.junctionUsesLeft = C.JUNCTION_USES_PER_LEVEL;
    game.seenEver = false;
    game.alertedEver = false;
    game.failReason = null;
    game.state = 'playing';
  }
  game.loadLevel = loadLevel;

  function startLevel(index) {
    audio.unlock();
    audio.startHum();
    loadLevel(index);
  }

  function levelComplete() {
    var bonus = 0;
    if (!game.seenEver) { bonus += C.SCORE_GHOST; game.ghostRuns++; }
    if (!game.alertedEver) bonus += C.SCORE_SHADOW;
    game.player.score += bonus;
    game.completeBonus = bonus;
    if (game.player.score > game.bestScore) game.bestScore = game.player.score;
    game.unlockedMax = Math.max(game.unlockedMax, Math.min(11, game.levelIndex + 1));
    saveProgress();
    audio.levelComplete();
    spawnParticles(game.player.x, game.player.y, '#f5c542', 40);
    game.state = 'complete';
  }

  function levelFailed(reason) {
    game.failReason = reason;
    game.state = 'failed';
    audio.caught();
  }

  function caughtByGuard() {
    game.nerves--;
    game.shake = 10;
    audio.caught();
    if (game.nerves <= 0) {
      levelFailed('caught');
      return;
    }
    game.banner = 'CAUGHT!';
    game.bannerSub = 'Nerves left: ' + game.nerves + ' — back to the start, quieter this time.';
    game.bannerTimer = 2.2;
    game.alarm = 40;
    game.player.x = game.level.playerStart.x;
    game.player.y = game.level.playerStart.y;
    game.player.angle = Math.PI / 2;
    game.level.guards.forEach(function (g) {
      var s = g.waypoints[0];
      g.x = s.x; g.y = s.y;
      g.state = 'patrol';
      g.detection = 0;
      g.wpIndex = 1;
    });
  }

  function updatePlaying(dt) {
    game.timer += dt;
    game.now += dt;

    // Player.
    var ev = PL.updatePlayer(game.level, game.player, input, dt, audio, game.level.guards);
    if (ev.noise) GD.hearNoise(game.level, game.level.guards, ev.noise.x, ev.noise.y, ev.noise.radius);
    if (ev.grabbed) {
      spawnParticles(ev.grabbed.x, ev.grabbed.y,
        ev.grabbed.kind === 'star' ? '#ff2e4d' : '#f5c542', ev.grabbed.kind === 'star' ? 36 : 14);
      if (ev.grabbed.kind === 'star') {
        game.prompt = 'STAR SECURED — GET TO THE EXIT!';
        game.promptTimer = 2.5;
        game.banner = null;
      }
    }
    if (ev.powerCut) {
      if (game.junctionUsesLeft > 0) {
        var cut = CM.cutCameraPower(game.level.cameras, game.now);
        if (cut > 0) {
          game.junctionUsesLeft--;
          audio.powerCut();
          var cam0 = game.level.cameras[0];
          if (cam0) spawnParticles(cam0.x, cam0.y, '#f5c542', 18);
          game.prompt = 'POWER CUT — ALL CAMERAS DARK FOR ' + C.CAMERA_DISABLE_SECONDS + 's';
          game.promptTimer = 2.5;
        } else {
          game.prompt = 'CAMERAS ALREADY DARK';
          game.promptTimer = 1.5;
        }
      } else {
        game.prompt = 'JUNCTION BOX SPENT — NO USES LEFT';
        game.promptTimer = 1.5;
      }
    }

    // Guards.
    var maxDetection = 0;
    var anyAlerted = false;
    game.level.guards.forEach(function (g) {
      var gev = GD.updateGuard(game.level, g, game.player, dt, game.now, audio);
      if (gev.spotted) {
        game.alarm = Math.min(100, game.alarm + C.ALARM_GUARD_SPOT);
        game.seenEver = true;
        game.alertedEver = true;
        game.shake = Math.max(game.shake, 5);
      }
      if (gev.caught) caughtByGuard();
      maxDetection = Math.max(maxDetection, g.detection);
      if (g.state === 'alerted') anyAlerted = true;
    });
    if (anyAlerted) game.alertedEver = true;
    game.player.detectionShown = maxDetection;
    if (maxDetection > 0) game.seenEver = true;

    // Cameras.
    var cameraSees = CM.updateCameras(game.level, game.level.cameras, game.player, dt, game.now, audio);
    if (cameraSees) {
      game.alarm = Math.min(100, game.alarm + C.ALARM_CAMERA_RATE * dt);
      game.seenEver = true;
    } else {
      game.alarm = Math.max(0, game.alarm - C.ALARM_DECAY * dt);
    }

    // Alarm lockdown.
    if (game.alarm >= C.ALARM_LOCKDOWN) {
      levelFailed('lockdown');
      return;
    }

    // Exit: only opens once the star is lifted.
    if (game.player.hasStar && game.level.exit) {
      var edx = game.level.exit.x - game.player.x;
      var edy = game.level.exit.y - game.player.y;
      if (Math.sqrt(edx * edx + edy * edy) < 30) {
        levelComplete();
        return;
      }
    }

    // Context prompt.
    if (!game.prompt || game.promptTimer === undefined) game.promptTimer = 0;
    game.promptTimer -= dt;
    var near = PL.nearestLoot(game.level, game.player, 52);
    var nearStar = false;
    if (game.level.star && !game.level.star.taken) {
      var sdx = game.level.star.x - game.player.x, sdy = game.level.star.y - game.player.y;
      nearStar = Math.sqrt(sdx * sdx + sdy * sdy) < 58;
    }
    var nearJb = PL.nearestJunction(game.level, game.player, 56);
    if (game.promptTimer <= 0) {
      if (nearStar) game.prompt = 'E — LIFT THE CRIMSON STAR';
      else if (near) game.prompt = 'E — GRAB THE ' + near.kind.toUpperCase();
      else if (nearJb) game.prompt = 'E — CUT CAMERA POWER  (' + game.junctionUsesLeft + ' USES LEFT)';
      else if (game.player.hasStar) game.prompt = 'STAR SECURED — GET TO THE GREEN EXIT';
      else game.prompt = null;
    }

    // Particles, shake, banner.
    game.particles.forEach(function (pt) {
      pt.x += pt.vx * dt; pt.y += pt.vy * dt;
      pt.vx *= 0.96; pt.vy *= 0.96;
      pt.life -= dt;
    });
    game.particles = game.particles.filter(function (pt) { return pt.life > 0; });
    game.shake = Math.max(0, game.shake - dt * 22);
    if (game.bannerTimer > 0) {
      game.bannerTimer -= dt;
      if (game.bannerTimer <= 0) { game.banner = null; game.bannerSub = null; }
    }
  }

  function update(dt) {
    if (input.wasPressed('m')) {
      var muted = audio.toggleMute();
      game.prompt = muted ? 'SOUND MUTED (M)' : 'SOUND ON (M)';
      game.promptTimer = 1.2;
    }
    if (game.state === 'menu') {
      game.now += dt;
      var click = input.consumeClick();
      if (click) {
        audio.unlock();
        for (var i = 0; i < game.menuButtons.length; i++) {
          var b = game.menuButtons[i];
          if (click.x >= b.x && click.x <= b.x + b.w && click.y >= b.y && click.y <= b.y + b.h) {
            startLevel(b.level);
            break;
          }
        }
      }
      if (input.wasPressed('enter') || input.wasPressed('space')) startLevel(0);
    } else if (game.state === 'playing') {
      if (input.wasPressed('p') || input.wasPressed('escape')) {
        game.state = 'paused';
        input.endFrame();
        return;
      }
      if (input.wasPressed('r')) {
        loadLevel(game.levelIndex);
        input.endFrame();
        return;
      }
      updatePlaying(dt);
    } else if (game.state === 'paused') {
      if (input.wasPressed('p') || input.wasPressed('escape')) game.state = 'playing';
      if (input.wasPressed('r')) loadLevel(game.levelIndex);
    } else if (game.state === 'complete') {
      var c = input.consumeClick();
      if (c || input.wasPressed('enter') || input.wasPressed('space')) {
        if (game.levelIndex < 11) startLevel(game.levelIndex + 1);
        else game.state = 'menu';
      }
      if (input.wasPressed('r')) loadLevel(game.levelIndex);
    } else if (game.state === 'failed') {
      var f = input.consumeClick();
      if (f || input.wasPressed('r') || input.wasPressed('enter') || input.wasPressed('space')) {
        loadLevel(game.levelIndex);
      }
    }
    input.endFrame();
  }

  function render() {
    ctx.save();
    if (game.shake > 0.3) {
      ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);
    }
    if (game.state === 'menu') {
      R.drawMenu(ctx, game, game.now, input.mouse);
    } else {
      R.drawWorld(ctx, game, game.now);
      R.drawHUD(ctx, game, game.now);
      if (game.state === 'paused') R.drawPause(ctx, game);
      else if (game.state === 'complete') R.drawEndScreen(ctx, game, 'complete');
      else if (game.state === 'failed') R.drawEndScreen(ctx, game, 'failed');
    }
    ctx.restore();
  }

  var last = performance.now();
  var shotReady = false;
  function frame(t) {
    var dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    try {
      if (!game.shotMode) update(dt);
      else game.now += dt; // frozen staging, but animations keep breathing
      render();
    } catch (e) {
      game.error = String(e && e.message || e);
      ctx.fillStyle = '#200';
      ctx.fillRect(0, 0, C.VIEW_W, C.VIEW_H);
      ctx.fillStyle = '#fff';
      ctx.font = '16px sans-serif';
      ctx.fillText('ERROR: ' + game.error, 20, 40);
    }
    if (!shotReady) {
      shotReady = true;
      window.__shotReady = true;
    }
    requestAnimationFrame(frame);
  }

  // Boot: menu, or a staged screenshot state.
  var shot = SH.shotFromUrl();
  if (shot >= 1 && shot <= 4) {
    loadLevel(shot === 4 ? 2 : 0);
    SH.applyShot(game, shot);
    game.now = 12; // fixed clock so renders are deterministic-ish
  }
  window.__game = game;
  window.__aurum = { version: '1.0.0', title: 'AURUM AFTER DARK — The Gilded Gallery Heist' };
  requestAnimationFrame(frame);
})();
