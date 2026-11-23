// player.js — the thief: movement, sneaking, noise, loot grabs, junction boxes.
// Running is loud and fast; sneaking is slow, quiet and harder to see. E grabs
// loot and cuts power at a junction box. Sprinting into a vase knocks it over.

(function () {
  'use strict';

  var C = window.AURUM_CONFIG;
  var L = window.AURUM_LEVEL;

  function createPlayer(x, y) {
    return {
      x: x, y: y, radius: 13,
      angle: Math.PI / 2, sneaking: false, moving: false,
      speedNow: 0, stepTimer: 0, stepPhase: 0,
      loot: 0, score: 0, hasStar: false,
      noiseTimer: 0
    };
  }

  function nearestLoot(level, player, maxDist) {
    var best = null, bestD = maxDist;
    level.loot.forEach(function (item) {
      if (item.taken || item.broken) return;
      var dx = item.x - player.x, dy = item.y - player.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestD) { best = item; bestD = d; }
    });
    return best;
  }

  function nearestJunction(level, player, maxDist) {
    var best = null, bestD = maxDist;
    level.junctionBoxes.forEach(function (jb) {
      var dx = jb.x - player.x, dy = jb.y - player.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestD) { best = jb; bestD = d; }
    });
    return best;
  }

  function lootScore(kind) {
    if (kind === 'coin') return C.SCORE_COIN;
    if (kind === 'vase') return C.SCORE_VASE;
    if (kind === 'painting') return C.SCORE_PAINTING;
    return 0;
  }

  // dt seconds. Returns events for the main loop.
  function updatePlayer(level, player, input, dt, audio, guards) {
    var ev = { grabbed: null, powerCut: false, vaseTipped: null, noise: null };
    var a = input.axis();
    player.sneaking = input.isSneaking();
    var speed = player.sneaking ? C.SNEAK_SPEED : C.WALK_SPEED;
    var dx = a.x * speed * dt, dy = a.y * speed * dt;
    player.moving = (dx !== 0 || dy !== 0);
    if (player.moving) {
      player.angle = Math.atan2(dy, dx);
      player.speedNow = speed;
      L.moveCircle(level, player, dx, dy, player.radius);
      player.stepTimer -= dt;
      if (player.stepTimer <= 0) {
        player.stepTimer = player.sneaking ? 0.55 : 0.34;
        if (audio) audio.footstep(player.sneaking);
        // Running is loud: guards nearby come to look.
        if (!player.sneaking) {
          player.noiseTimer = 0.4;
          ev.noise = { x: player.x, y: player.y, radius: 210 };
        }
      }
    } else {
      player.speedNow = 0;
      player.noiseTimer = Math.max(0, player.noiseTimer - dt);
    }

    // Sprinting into a vase knocks it over: a crash, no loot, guards investigate.
    level.loot.forEach(function (item) {
      if (item.kind !== 'vase' || item.taken || item.broken) return;
      var ddx = item.x - player.x, ddy = item.y - player.y;
      var d = Math.sqrt(ddx * ddx + ddy * ddy);
      if (d < player.radius + 16 && player.moving && !player.sneaking) {
        item.broken = true;
        ev.vaseTipped = item;
        ev.noise = { x: item.x, y: item.y, radius: 260 };
        if (audio) audio.vaseBreak();
      }
    });

    // E: grab loot / lift the star / cut power at a junction box.
    if (input.wasPressed('e')) {
      var item = nearestLoot(level, player, 52);
      if (item) {
        item.taken = true;
        player.loot++;
        player.score += lootScore(item.kind);
        ev.grabbed = item;
        if (audio) audio.pickup();
      } else if (level.star && !level.star.taken) {
        var sdx = level.star.x - player.x, sdy = level.star.y - player.y;
        if (Math.sqrt(sdx * sdx + sdy * sdy) < 58) {
          level.star.taken = true;
          player.hasStar = true;
          player.score += C.SCORE_STAR;
          ev.grabbed = { kind: 'star', x: level.star.x, y: level.star.y };
          if (audio) audio.starPickup();
        }
      }
      if (!ev.grabbed) {
        var jb = nearestJunction(level, player, 56);
        if (jb) {
          ev.powerCut = true; // main.js checks remaining uses
        }
      }
    }
    return ev;
  }

  window.AURUM_PLAYER = {
    createPlayer: createPlayer, updatePlayer: updatePlayer,
    nearestLoot: nearestLoot, nearestJunction: nearestJunction,
    lootScore: lootScore
  };
})();
