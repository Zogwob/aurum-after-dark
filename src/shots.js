// shots.js — deterministic screenshot states, driven by ?shot=1..4.
// Every shot shows all five required elements in one frame: the room and the
// thief crossing it, guards with vision cones, cameras, the Crimson Star loot
// target, and the alarm meter in the HUD. Shot 1 is the cover.

(function () {
  'use strict';

  var C = window.AURUM_CONFIG;
  var TILE = C.TILE;

  function tileCenter(tx, ty) { return { x: (tx + 0.5) * TILE, y: (ty + 0.5) * TILE }; }

  // Each preset receives the live game object (fresh level already loaded) and
  // stages it: thief position, guard states, camera angles, alarm, timer, loot.
  var SHOTS = {
    // Cover: level 1 mid-play. Thief crouched behind a plinth, two guards with
    // bright cones, a camera sweeping, the star glinting, exit glowing, alarm low.
    1: function (g) {
      var p = tileCenter(13, 8);
      g.player.x = p.x; g.player.y = p.y;
      g.player.sneaking = true;
      g.player.angle = Math.PI / 2;
      g.player.loot = 2; g.player.score = 100;
      g.alarm = 12; g.timer = 47;
      var g0 = g.level.guards[0], g1 = g.level.guards[1];
      var a = tileCenter(10, 9); g0.x = a.x; g0.y = a.y; g0.angle = 0; g0.state = 'patrol';
      var b = tileCenter(18, 6); g1.x = b.x; g1.y = b.y; g1.angle = Math.PI / 2; g1.state = 'patrol';
      g1.detection = 30;
      g.level.cameras[0].angle = Math.PI / 2 + 0.5;
      g.level.cameras[1].angle = -Math.PI / 2 - 0.3;
      g.player.detectionShown = 0;
      g.prompt = 'E — GRAB THE CRIMSON STAR';
    },
    // Guard suspicious, investigating, camera cone on the thief, detection visible.
    2: function (g) {
      var p = tileCenter(15, 10);
      g.player.x = p.x; g.player.y = p.y;
      g.player.sneaking = true;
      g.player.angle = -Math.PI / 2;
      g.player.loot = 3; g.player.score = 220;
      g.alarm = 34; g.timer = 96;
      g.player.detectionShown = 62;
      var g0 = g.level.guards[0], g1 = g.level.guards[1];
      var a = tileCenter(12, 10); g0.x = a.x; g0.y = a.y; g0.angle = 0;
      g0.state = 'suspicious'; g0.investigate = { x: p.x, y: p.y }; g0.detection = 62;
      var b = tileCenter(20, 7); g1.x = b.x; g1.y = b.y; g1.angle = Math.PI * 0.75;
      g1.state = 'patrol'; g1.detection = 18;
      g.level.cameras[0].angle = Math.PI / 2 + 0.35;
      g.level.cameras[0].seeing = true;
      g.level.cameras[1].angle = -Math.PI / 2 + 0.4;
      g.prompt = 'SPOTTED — BREAK LINE OF SIGHT!';
    },
    // Alarm moment: alarm high and red, guards converging, camera beeping.
    3: function (g) {
      var p = tileCenter(16, 11);
      g.player.x = p.x; g.player.y = p.y;
      g.player.sneaking = false;
      g.player.angle = Math.PI;
      g.player.loot = 5; g.player.score = 480;
      g.alarm = 87; g.timer = 143;
      g.player.detectionShown = 100;
      g.seenEver = true; g.alertedEver = true;
      var g0 = g.level.guards[0], g1 = g.level.guards[1];
      var a = tileCenter(13, 11); g0.x = a.x; g0.y = a.y; g0.angle = 0;
      g0.state = 'alerted'; g0.detection = 100;
      var b = tileCenter(19, 12); g1.x = b.x; g1.y = b.y; g1.angle = Math.PI;
      g1.state = 'alerted'; g1.detection = 100;
      g.level.cameras[0].angle = Math.PI / 2 + 0.2;
      g.level.cameras[0].seeing = true;
      g.level.cameras[1].angle = -Math.PI / 2 - 0.1;
      g.prompt = 'ALARM! REACH THE EXIT — NOW';
      g.shake = 6;
    },
    // Level 12 Grand Vault: the hardest room, all eight guards and cameras,
    // the thief closing on the star with a camera on them, alarm climbing.
    4: function (g) {
      var p = tileCenter(17, 5); // open floor just right of the star
      g.player.x = p.x; g.player.y = p.y;
      g.player.sneaking = true;
      g.player.angle = Math.PI; // facing the star
      g.player.loot = 8; g.player.score = 920;
      g.alarm = 63; g.timer = 312;
      g.player.detectionShown = 55;
      var gs = g.level.guards;
      var spots = [[12, 2], [10, 13], [11, 9], [18, 10], [13, 11], [6, 14], [24, 14], [21, 3]];
      var angles = [Math.PI / 2, 0, 0, Math.PI, -Math.PI / 2, 0, Math.PI, Math.PI / 2];
      gs.forEach(function (gr, i) {
        var s = tileCenter(spots[i][0], spots[i][1]);
        gr.x = s.x; gr.y = s.y;
        gr.angle = angles[i];
        gr.state = i === 2 ? 'suspicious' : (i === 3 ? 'alerted' : 'patrol');
        gr.detection = i === 2 ? 55 : (i === 3 ? 80 : 0);
        if (i === 2) gr.investigate = { x: p.x, y: p.y };
      });
      var camAngles = [Math.PI / 2 + 0.3, Math.PI / 2, 0.2, Math.PI - 0.2, 0.4, Math.PI + 0.4, -Math.PI / 2, -Math.PI / 2 - 0.4];
      g.level.cameras.forEach(function (cam, i) {
        cam.angle = camAngles[i];
        cam.seeing = i === 1;
      });
      g.prompt = 'LEVEL 12 OF 12 — 8 GUARDS · 8 CAMERAS · 10 LOOT';
    }
  };

  // Shot 4 uses level 12; the rest use level 1. Returns the shot number or 0.
  function shotFromUrl() {
    var m = /[?&]shot=(\d)/.exec(window.location.search || '');
    return m ? parseInt(m[1], 10) : 0;
  }

  function applyShot(game, n) {
    var fn = SHOTS[n];
    if (!fn) return false;
    var levelIndex = n === 4 ? 11 : 0;
    game.loadLevel(levelIndex);
    game.state = 'playing';
    fn(game);
    game.shotMode = true;
    return true;
  }

  window.AURUM_SHOTS = {
    SHOTS: SHOTS, shotFromUrl: shotFromUrl, applyShot: applyShot
  };
})();
