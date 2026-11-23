// cameras.js — wall-mounted security cameras that sweep back and forth.
// A camera that sees the thief raises the alarm fast and beeps. Cutting the
// power at a junction box (E) disables the nearest camera for a short while.

(function () {
  'use strict';

  var C = window.AURUM_CONFIG;
  var L = window.AURUM_LEVEL;

  function cameraAngle(cam, now) {
    return cam.baseAngle + Math.sin(now * cam.speed + cam.phase) * cam.sweep;
  }

  function canSeeCamera(level, cam, px, py, sneaking, now) {
    if (now < cam.disabledUntil) return { sees: false };
    var dx = px - cam.x, dy = py - cam.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > C.CAMERA_VIEW_RANGE) return { sees: false, dist: dist };
    var ang = Math.atan2(dy, dx);
    if (Math.abs(L.angleDiff(ang, cam.angle)) > C.CAMERA_VIEW_HALF_ANGLE) {
      return { sees: false, dist: dist };
    }
    if (!L.hasLineOfSight(level, cam.x, cam.y, px, py)) return { sees: false, dist: dist };
    var rate = 1;
    if (sneaking) rate *= 0.6;
    if (L.isDarkAt(level, px, py)) rate *= 0.55;
    return { sees: true, dist: dist, rate: rate };
  }

  // dt seconds. Returns true while any camera sees the thief.
  function updateCameras(level, cameras, player, dt, now, audio) {
    var anySees = false;
    cameras.forEach(function (cam) {
      cam.angle = cameraAngle(cam, now);
      var seen = canSeeCamera(level, cam, player.x, player.y, player.sneaking, now);
      cam.seeing = seen.sees;
      if (seen.sees) {
        anySees = true;
        cam.beepTimer -= dt;
        if (cam.beepTimer <= 0) {
          cam.beepTimer = 0.55;
          if (audio) audio.cameraBeep();
        }
      }
    });
    return anySees;
  }

  // Cut power: every camera on the grid goes dark for a while. The junction
  // box kills the whole camera circuit — that is what it is for. Returns how
  // many cameras were disabled.
  function cutCameraPower(cameras, now) {
    var n = 0;
    cameras.forEach(function (cam) {
      if (now < cam.disabledUntil) return;
      cam.disabledUntil = now + C.CAMERA_DISABLE_SECONDS;
      n++;
    });
    return n;
  }

  window.AURUM_CAMERAS = {
    cameraAngle: cameraAngle, canSeeCamera: canSeeCamera,
    updateCameras: updateCameras, cutCameraPower: cutCameraPower
  };
})();
