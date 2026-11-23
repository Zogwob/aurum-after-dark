// guards.js — guard patrol, suspicion, alert and chase.
// A guard patrols waypoints, gets suspicious ("?") and investigates what it
// half-sees or hears, and when it fully spots the thief ("!") it chases and
// raises the alarm. Detection is slower when the thief sneaks or hides in dark.

(function () {
  'use strict';

  var C = window.AURUM_CONFIG;
  var L = window.AURUM_LEVEL;

  function canSeeGuard(level, guard, px, py, sneaking) {
    var dx = px - guard.x, dy = py - guard.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > C.GUARD_VIEW_RANGE) return { sees: false, dist: dist };
    var ang = Math.atan2(dy, dx);
    if (Math.abs(L.angleDiff(ang, guard.angle)) > C.GUARD_VIEW_HALF_ANGLE) {
      return { sees: false, dist: dist };
    }
    if (!L.hasLineOfSight(level, guard.x, guard.y, px, py)) return { sees: false, dist: dist };
    var inDark = L.isDarkAt(level, px, py);
    // Rate: closer + running + lit = fast; far + sneaking + dark = slow.
    var rate = C.DETECT_BASE_RATE;
    rate *= 1.6 - (dist / C.GUARD_VIEW_RANGE) * 0.9; // closer sees faster
    if (sneaking) rate *= 0.45;
    if (inDark) rate *= 0.5;
    return { sees: true, dist: dist, rate: rate };
  }

  function moveToward(level, guard, tx, ty, speed, dt) {
    var dx = tx - guard.x, dy = ty - guard.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d < 2) return true;
    var step = Math.min(d, speed * dt);
    var nx = dx / d, ny = dy / d;
    guard.angle = Math.atan2(ny, nx);
    L.moveCircle(level, guard, nx * step, ny * step, guard.radius);
    guard.stepPhase += dt * 10;
    return d - step < 4;
  }

  // dt seconds. Returns events: {spotted, caught, noiseHeard} for the main loop.
  function updateGuard(level, guard, player, dt, now, audio) {
    var ev = { spotted: false, caught: false };
    var seen = canSeeGuard(level, guard, player.x, player.y, player.sneaking);

    if (guard.state === 'patrol') {
      if (seen.sees) {
        guard.detection += seen.rate * dt;
        if (guard.detection >= 100) {
          guard.state = 'alerted';
          guard.detection = 60;
          ev.spotted = true;
          if (audio) audio.alert();
        }
      } else {
        guard.detection = Math.max(0, guard.detection - C.DETECT_DECAY * dt);
        // Half-seen glimpses make a guard curious: investigate the spot.
        if (guard.detection > 45) {
          guard.state = 'suspicious';
          guard.investigate = { x: player.x, y: player.y };
          guard.lookTimer = 0;
          if (audio) audio.suspicious();
        }
      }
      if (guard.state === 'patrol') {
        if (guard.pauseLeft > 0) {
          guard.pauseLeft -= dt;
          guard.angle += Math.sin(now * 0.7 + guard.stepPhase) * dt * 0.6;
        } else {
          var wp = guard.waypoints[guard.wpIndex % guard.waypoints.length];
          if (moveToward(level, guard, wp.x, wp.y, C.GUARD_SPEED, dt)) {
            guard.wpIndex++;
            guard.pauseLeft = guard.pause;
          }
        }
      }
    } else if (guard.state === 'suspicious') {
      if (seen.sees) {
        guard.detection += seen.rate * 1.4 * dt;
        if (guard.detection >= 100) {
          guard.state = 'alerted';
          guard.detection = 60;
          ev.spotted = true;
          if (audio) audio.alert();
        }
      } else {
        guard.detection = Math.max(0, guard.detection - C.DETECT_DECAY * 0.5 * dt);
      }
      if (guard.state === 'suspicious' && guard.investigate) {
        if (moveToward(level, guard, guard.investigate.x, guard.investigate.y, C.GUARD_SPEED * 1.25, dt)) {
          guard.lookTimer += dt;
          guard.angle += dt * 2.2; // look around
          if (guard.lookTimer > 2.4) {
            guard.state = 'patrol';
            guard.investigate = null;
            guard.detection = Math.max(0, guard.detection - 30);
          }
        }
      }
    } else if (guard.state === 'alerted') {
      // Chase the thief's current position; lose the trail after a while unseen.
      if (seen.sees) {
        guard.detection = 100;
        moveToward(level, guard, player.x, player.y, C.CHASE_SPEED, dt);
        guard.loseTimer = 0;
      } else {
        guard.loseTimer = (guard.loseTimer || 0) + dt;
        moveToward(level, guard, player.x, player.y, C.CHASE_SPEED * 0.8, dt);
        if (guard.loseTimer > 5) {
          guard.state = 'suspicious';
          guard.investigate = { x: player.x, y: player.y };
          guard.lookTimer = 0;
          guard.detection = 50;
        }
      }
      var cdx = player.x - guard.x, cdy = player.y - guard.y;
      if (Math.sqrt(cdx * cdx + cdy * cdy) < guard.radius + player.radius + 2) {
        ev.caught = true;
      }
    }
    return ev;
  }

  // A loud noise (sprint, a toppled vase) draws every patrolling guard nearby.
  function hearNoise(level, guards, x, y, radius) {
    guards.forEach(function (g) {
      if (g.state !== 'patrol') return;
      var dx = g.x - x, dy = g.y - y;
      if (Math.sqrt(dx * dx + dy * dy) < radius) {
        g.state = 'suspicious';
        g.investigate = { x: x, y: y };
        g.lookTimer = 0;
        g.detection = Math.max(g.detection, 55);
      }
    });
  }

  window.AURUM_GUARDS = {
    canSeeGuard: canSeeGuard, updateGuard: updateGuard, hearNoise: hearNoise
  };
})();
