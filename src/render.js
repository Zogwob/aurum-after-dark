// render.js — draws the gallery, the thief, guards and cameras with their
// vision cones, the loot, the HUD (loot, alarm meter, level, timer, nerves)
// and the menu / pause / complete / failed screens. Canvas 2D only.

(function () {
  'use strict';

  var C = window.AURUM_CONFIG;
  var L = window.AURUM_LEVEL;
  var TILE = C.TILE;
  var COL = C.COLORS;

  var darkCanvas = null;

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Deterministic 0..1 hash from tile coords — no Math.random, so the floor
  // looks identical every run and every screenshot.
  function hash2(x, y) {
    var h = (x * 374761393 + y * 668265263) ^ 0x5bf03635;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }

  var floorCanvas = null;
  var floorLevelKey = null;

  // The whole static floor (marble tiles, carpet runner, wall shadows,
  // framed paintings, moonlight shafts, a rug) is painted once per level into
  // an offscreen canvas — gradients and veins are too expensive per frame.
  function buildFloorCanvas(level) {
    var fc = document.createElement('canvas');
    fc.width = C.VIEW_W; fc.height = C.VIEW_H;
    var f = fc.getContext('2d');
    var MARBLE = ['#b3a184', '#ab9878', '#bdaa8c', '#a3906f'];
    var x, y, ch, px, py, h;
    for (y = 0; y < level.h; y++) {
      for (x = 0; x < level.w; x++) {
        ch = level.rows[y][x];
        px = x * TILE; py = y * TILE;
        h = hash2(x, y);
        if (ch === '#') {
          var wg = f.createLinearGradient(px, py, px, py + TILE);
          wg.addColorStop(0, '#7a5a38');
          wg.addColorStop(0.25, '#5d4226');
          wg.addColorStop(1, '#3d2a16');
          f.fillStyle = wg;
          f.fillRect(px, py, TILE, TILE);
          f.fillStyle = 'rgba(255,220,160,0.22)';
          f.fillRect(px, py, TILE, 2);
          f.fillStyle = 'rgba(0,0,0,0.25)';
          f.fillRect(px, py + TILE - 3, TILE, 3);
        } else {
          f.fillStyle = MARBLE[Math.floor(h * MARBLE.length) % MARBLE.length];
          f.fillRect(px, py, TILE, TILE);
          // Marble vein: one thin pale diagonal, angle varies by tile.
          f.strokeStyle = 'rgba(224,204,170,' + (0.06 + h * 0.07).toFixed(3) + ')';
          f.lineWidth = 1;
          f.beginPath();
          if (h < 0.5) {
            f.moveTo(px + 4 + h * 10, py + 2);
            f.lineTo(px + TILE - 6, py + TILE - 4 - h * 8);
          } else {
            f.moveTo(px + TILE - 4, py + 4 + (h - 0.5) * 10);
            f.lineTo(px + 6, py + TILE - 5);
          }
          f.stroke();
          if (ch === ',') {
            f.fillStyle = 'rgba(70,95,130,0.28)';
            f.fillRect(px, py, TILE, TILE);
          }
          // Red carpet runner down the middle columns.
          if (x >= 15 && x <= 16) {
            var cg = f.createLinearGradient(px, py, px + TILE, py);
            cg.addColorStop(0, '#6e1a26');
            cg.addColorStop(0.5, '#8a2432');
            cg.addColorStop(1, '#6e1a26');
            f.fillStyle = cg;
            f.fillRect(px, py, TILE, TILE);
            f.fillStyle = COL.carpetEdge;
            f.fillRect(px, py, 2, TILE);
            f.fillRect(px + TILE - 2, py, 2, TILE);
            // Gold diamond motif every other tile.
            if ((x + y) % 2 === 0) {
              f.fillStyle = 'rgba(201,162,39,0.55)';
              f.save();
              f.translate(px + TILE / 2, py + TILE / 2);
              f.rotate(Math.PI / 4);
              f.fillRect(-4, -4, 8, 8);
              f.restore();
            }
          }
          // Grout lines along the bottom and right edge of every floor tile.
          f.fillStyle = 'rgba(0,0,0,0.18)';
          f.fillRect(px, py + TILE - 1, TILE, 1);
          f.fillStyle = 'rgba(0,0,0,0.10)';
          f.fillRect(px + TILE - 1, py, 1, TILE);
        }
      }
    }
    // Soft shadows cast by walls onto the floor below them.
    var wy, wx;
    for (wy = 0; wy < level.h - 1; wy++) {
      for (wx = 0; wx < level.w; wx++) {
        if (level.rows[wy][wx] === '#' && level.rows[wy + 1][wx] !== '#') {
          f.fillStyle = 'rgba(0,0,0,0.30)';
          f.fillRect(wx * TILE, (wy + 1) * TILE, TILE, 9);
        }
      }
    }
    // Framed mini-paintings on wall tiles that face open floor.
    var py2, px2;
    for (py2 = 0; py2 < level.h - 1; py2++) {
      for (px2 = 0; px2 < level.w; px2++) {
        if (level.rows[py2][px2] !== '#' || level.rows[py2 + 1][px2] === '#') continue;
        var hp = hash2(px2 + 7, py2 + 3);
        if (hp > 0.42) continue;
        var cx = px2 * TILE + TILE / 2, cy = py2 * TILE + TILE / 2;
        f.fillStyle = '#c9a227';
        f.fillRect(cx - 13, cy - 9, 26, 18);
        f.fillStyle = '#8a6d1f';
        f.fillRect(cx - 11, cy - 7, 22, 14);
        // Tiny landscape: sky, sun or moon, hills.
        var sky = f.createLinearGradient(cx - 11, cy - 7, cx - 11, cy + 7);
        if (hp < 0.2) { sky.addColorStop(0, '#e8a34c'); sky.addColorStop(1, '#7a1f2b'); }
        else { sky.addColorStop(0, '#3a6b8a'); sky.addColorStop(1, '#1c2f4d'); }
        f.fillStyle = sky;
        f.fillRect(cx - 11, cy - 7, 22, 14);
        f.fillStyle = hp < 0.2 ? '#f5d76e' : '#e8e4d8';
        f.beginPath(); f.arc(cx - 4, cy - 3, 2.5, 0, 6.29); f.fill();
        f.fillStyle = '#2e4d33';
        f.beginPath(); f.moveTo(cx - 11, cy + 7); f.lineTo(cx - 2, cy - 1); f.lineTo(cx + 6, cy + 7); f.closePath(); f.fill();
      }
    }
    // Round rug in an open patch (deterministic anchors, first fit wins).
    var anchors = [[24, 12], [7, 13], [24, 2], [8, 2], [24, 14]];
    for (var a = 0; a < anchors.length; a++) {
      var ax = anchors[a][0], ay = anchors[a][1];
      var fits = true;
      for (var ry = ay - 1; ry <= ay + 1 && fits; ry++) {
        for (var rx = ax - 1; rx <= ax + 1; rx++) {
          var cch = (level.rows[ry] || '')[rx];
          if (cch !== '.' && cch !== ',') fits = false;
        }
      }
      if (!fits) continue;
      var rcx = (ax + 0.5) * TILE, rcy = (ay + 0.5) * TILE;
      f.fillStyle = 'rgba(0,0,0,0.25)';
      f.beginPath(); f.ellipse(rcx, rcy + 4, 58, 40, 0, 0, 6.29); f.fill();
      f.fillStyle = '#5e1a24';
      f.beginPath(); f.ellipse(rcx, rcy, 56, 38, 0, 0, 6.29); f.fill();
      f.strokeStyle = '#c9a227';
      f.lineWidth = 2;
      f.beginPath(); f.ellipse(rcx, rcy, 48, 31, 0, 0, 6.29); f.stroke();
      f.strokeStyle = 'rgba(201,162,39,0.5)';
      f.lineWidth = 1;
      f.beginPath(); f.ellipse(rcx, rcy, 30, 19, 0, 0, 6.29); f.stroke();
      break;
    }
    // Moonlight shafts from the high windows: cool diagonal bands.
    f.save();
    f.globalAlpha = 0.09;
    f.fillStyle = '#9db8ff';
    f.beginPath();
    f.moveTo(760, 0); f.lineTo(920, 0); f.lineTo(1020, C.VIEW_H); f.lineTo(860, C.VIEW_H);
    f.closePath(); f.fill();
    f.beginPath();
    f.moveTo(240, 0); f.lineTo(320, 0); f.lineTo(430, C.VIEW_H); f.lineTo(350, C.VIEW_H);
    f.closePath(); f.fill();
    f.restore();
    return fc;
  }

  function drawFloor(ctx, level, now) {
    var key = level.def.name + '|' + level.w + 'x' + level.h;
    if (!floorCanvas || floorLevelKey !== key) {
      floorCanvas = buildFloorCanvas(level);
      floorLevelKey = key;
    }
    ctx.drawImage(floorCanvas, 0, 0);
  }

  function drawCover(ctx, level) {
    for (var y = 0; y < level.h; y++) {
      for (var x = 0; x < level.w; x++) {
        var ch = level.rows[y][x];
        var px = x * TILE, py = y * TILE;
        var hh = hash2(x + 31, y + 17);
        if (ch === 'P') {
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          ctx.fillRect(px + 5, py + 7, TILE - 6, TILE - 6);
          ctx.fillStyle = COL.plinth;
          ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
          ctx.fillStyle = COL.plinthTop;
          ctx.fillRect(px + 6, py + 6, TILE - 12, TILE - 12);
          ctx.strokeStyle = '#c9a227';
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 6.5, py + 6.5, TILE - 13, TILE - 13);
          ctx.fillStyle = 'rgba(255,255,255,0.14)';
          ctx.fillRect(px + 6, py + 6, TILE - 12, 4);
          // A tiny artifact on top: mini vase or mini bust, by tile hash.
          var ax = px + TILE / 2, ay = py + 12;
          if (hh < 0.5) {
            ctx.fillStyle = '#3f6fb5';
            ctx.beginPath(); ctx.ellipse(ax, ay, 5, 6, 0, 0, 6.29); ctx.fill();
            ctx.fillStyle = '#7aa5e0';
            ctx.fillRect(ax - 2, ay - 8, 4, 3);
          } else {
            ctx.fillStyle = '#c9c2b8';
            ctx.beginPath(); ctx.arc(ax, ay - 2, 4, 0, 6.29); ctx.fill();
            ctx.fillStyle = '#9a938a';
            ctx.beginPath(); ctx.ellipse(ax, ay + 5, 6, 4, 0, 0, 6.29); ctx.fill();
          }
        } else if (ch === 'S') {
          ctx.fillStyle = 'rgba(0,0,0,0.4)';
          ctx.fillRect(px + 6, py + 26, 28, 8);
          ctx.fillStyle = '#6b5a44';
          ctx.fillRect(px + 7, py + 24, 26, 8);
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.beginPath(); ctx.ellipse(px + 22, py + 30, 13, 9, 0, 0, 6.29); ctx.fill();
          ctx.fillStyle = COL.statue;
          ctx.beginPath(); ctx.ellipse(px + 20, py + 20, 10, 14, 0, 0, 6.29); ctx.fill();
          ctx.fillStyle = '#c9c2b8';
          ctx.beginPath(); ctx.arc(px + 20, py + 12, 6, 0, 6.29); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.25)';
          ctx.beginPath(); ctx.arc(px + 17, py + 10, 2, 0, 6.29); ctx.fill();
          // Raised arm.
          ctx.strokeStyle = COL.statue;
          ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(px + 28, py + 18); ctx.lineTo(px + 33, py + 8); ctx.stroke();
        } else if (ch === 'B') {
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.fillRect(px + 5, py + 14, TILE - 8, 16);
          ctx.fillStyle = COL.bench;
          rr(ctx, px + 4, py + 12, TILE - 8, 16, 4); ctx.fill();
          ctx.fillStyle = '#7a4a2c';
          ctx.fillRect(px + 6, py + 14, TILE - 12, 4);
          ctx.fillStyle = 'rgba(255,220,170,0.18)';
          ctx.fillRect(px + 6, py + 14, TILE - 12, 2);
          ctx.fillStyle = '#3a2412';
          ctx.fillRect(px + 8, py + 28, 4, 5);
          ctx.fillRect(px + TILE - 12, py + 28, 4, 5);
        } else if (ch === 'T') {
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.beginPath(); ctx.ellipse(px + 20, py + 30, 14, 7, 0, 0, 6.29); ctx.fill();
          // Terracotta pot.
          ctx.fillStyle = '#8a4a2c';
          ctx.beginPath();
          ctx.moveTo(px + 12, py + 22); ctx.lineTo(px + 28, py + 22);
          ctx.lineTo(px + 25, py + 33); ctx.lineTo(px + 15, py + 33);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#a85f38';
          ctx.fillRect(px + 11, py + 20, 18, 3);
          ctx.fillStyle = COL.plant;
          ctx.beginPath(); ctx.arc(px + 14, py + 16, 9, 0, 6.29); ctx.fill();
          ctx.beginPath(); ctx.arc(px + 26, py + 14, 10, 0, 6.29); ctx.fill();
          ctx.beginPath(); ctx.arc(px + 20, py + 10, 8, 0, 6.29); ctx.fill();
          ctx.fillStyle = '#3f7a44';
          ctx.beginPath(); ctx.arc(px + 16, py + 14, 4, 0, 6.29); ctx.fill();
          ctx.beginPath(); ctx.arc(px + 24, py + 11, 4, 0, 6.29); ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          ctx.beginPath(); ctx.arc(px + 23, py + 9, 3, 0, 6.29); ctx.fill();
        }
      }
    }
  }

  function drawLoot(ctx, level, now) {
    level.loot.forEach(function (item) {
      if (item.taken || item.broken) return;
      var bob = item.kind === 'coin' ? Math.sin(now * 3 + item.bob) * 2 : 0;
      if (item.kind === 'coin') {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.arc(item.x, item.y + 3 + bob, 7, 0, 6.29); ctx.fill();
        ctx.fillStyle = '#a87f14';
        ctx.beginPath(); ctx.arc(item.x, item.y + 2 + bob, 8, 0, 6.29); ctx.fill();
        ctx.fillStyle = COL.gold;
        ctx.beginPath(); ctx.arc(item.x, item.y + bob, 7, 0, 6.29); ctx.fill();
        ctx.strokeStyle = '#fff0a8';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(item.x, item.y + bob, 5, 0, 6.29); ctx.stroke();
        ctx.fillStyle = '#fff0a8';
        ctx.beginPath(); ctx.arc(item.x - 2, item.y - 2 + bob, 2.5, 0, 6.29); ctx.fill();
      } else if (item.kind === 'vase') {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.ellipse(item.x, item.y + 10, 11, 5, 0, 0, 6.29); ctx.fill();
        ctx.fillStyle = '#3f6fb5';
        ctx.beginPath(); ctx.ellipse(item.x, item.y, 10, 13, 0, 0, 6.29); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        ctx.beginPath(); ctx.ellipse(item.x - 4, item.y - 1, 2.5, 8, 0.15, 0, 6.29); ctx.fill();
        ctx.fillStyle = '#7aa5e0';
        ctx.fillRect(item.x - 3, item.y - 16, 6, 6);
        ctx.fillStyle = '#c9a227';
        ctx.fillRect(item.x - 10, item.y - 2, 20, 2);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(item.x - 10, item.y - 12, 3, 10);
      } else if (item.kind === 'painting') {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(item.x - 13, item.y - 8, 30, 22);
        ctx.fillStyle = '#c9a227';
        ctx.fillRect(item.x - 15, item.y - 11, 30, 22);
        ctx.fillStyle = '#8a6d1f';
        ctx.fillRect(item.x - 12, item.y - 8, 24, 16);
        ctx.fillStyle = '#2c4a6b';
        ctx.fillRect(item.x - 12, item.y - 8, 24, 16);
        ctx.fillStyle = '#e8b64c';
        ctx.beginPath(); ctx.arc(item.x - 4, item.y - 2, 4, 0, 6.29); ctx.fill();
        ctx.fillStyle = '#7a1f2b';
        ctx.fillRect(item.x + 2, item.y + 1, 8, 6);
        ctx.fillStyle = '#2e4d33';
        ctx.fillRect(item.x - 12, item.y + 4, 24, 4);
        // Glass glint across the frame.
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(item.x - 12, item.y + 6);
        ctx.lineTo(item.x + 4, item.y - 10);
        ctx.stroke();
      }
    });
    if (level.star && !level.star.taken) {
      var pulse = 0.6 + Math.sin(now * 4) * 0.25;
      var g = ctx.createRadialGradient(level.star.x, level.star.y, 4, level.star.x, level.star.y, 66);
      g.addColorStop(0, 'rgba(255,46,77,' + (0.55 * pulse + 0.25) + ')');
      g.addColorStop(0.5, 'rgba(255,46,77,' + (0.22 * pulse + 0.08) + ')');
      g.addColorStop(1, 'rgba(255,46,77,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(level.star.x, level.star.y, 66, 0, 6.29); ctx.fill();
      // Glass display case.
      ctx.fillStyle = 'rgba(180,220,255,0.18)';
      ctx.fillRect(level.star.x - 18, level.star.y - 18, 36, 36);
      ctx.strokeStyle = 'rgba(220,240,255,0.7)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(level.star.x - 18, level.star.y - 18, 36, 36);
      ctx.fillStyle = COL.plinth;
      ctx.fillRect(level.star.x - 20, level.star.y + 16, 40, 6);
      // The Crimson Star diamond.
      ctx.save();
      ctx.translate(level.star.x, level.star.y);
      ctx.rotate(Math.PI / 4 + Math.sin(now * 2) * 0.12);
      ctx.fillStyle = COL.star;
      ctx.fillRect(-9, -9, 18, 18);
      ctx.fillStyle = '#ff8ba0';
      ctx.fillRect(-9, -9, 18, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-3, -3, 4, 4);
      // Facet lines across the diamond.
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-9, -9); ctx.lineTo(9, 9);
      ctx.moveTo(9, -9); ctx.lineTo(-9, 9);
      ctx.stroke();
      ctx.restore();
      // Four-point sparkles orbiting the gem.
      for (var sp = 0; sp < 4; sp++) {
        var sa = now * 0.9 + sp * Math.PI / 2;
        var sx = level.star.x + Math.cos(sa) * 30;
        var sy = level.star.y + Math.sin(sa) * 30;
        var ss = 4 + Math.sin(now * 3 + sp * 1.7) * 2;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(sx - ss, sy - 1, ss * 2, 2);
        ctx.fillRect(sx - 1, sy - ss, 2, ss * 2);
      }
      // Diagonal glint across the glass case.
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(level.star.x - 16, level.star.y + 14);
      ctx.lineTo(level.star.x + 6, level.star.y - 16);
      ctx.stroke();
    }
    if (level.exit) {
      var eg = ctx.createRadialGradient(level.exit.x, level.exit.y, 4, level.exit.x, level.exit.y, 52);
      var glow = 0.35 + Math.sin(now * 3) * 0.12;
      eg.addColorStop(0, 'rgba(57,217,138,' + glow + ')');
      eg.addColorStop(1, 'rgba(57,217,138,0)');
      ctx.fillStyle = eg;
      ctx.beginPath(); ctx.arc(level.exit.x, level.exit.y, 52, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#123524';
      rr(ctx, level.exit.x - 16, level.exit.y - 18, 32, 36, 4); ctx.fill();
      ctx.fillStyle = COL.exit;
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('EXIT', level.exit.x, level.exit.y + 4);
      ctx.strokeStyle = COL.exit;
      ctx.lineWidth = 2;
      rr(ctx, level.exit.x - 16, level.exit.y - 18, 32, 36, 4); ctx.stroke();
    }
    level.junctionBoxes.forEach(function (jb) {
      ctx.fillStyle = '#2b2b33';
      ctx.fillRect(jb.x - 11, jb.y - 11, 22, 22);
      ctx.strokeStyle = '#f5c542';
      ctx.lineWidth = 2;
      ctx.strokeRect(jb.x - 11, jb.y - 11, 22, 22);
      ctx.fillStyle = '#f5c542';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚡', jb.x, jb.y + 5);
    });
  }

  // Vision cone with a soft radial falloff: bright near the watcher, fading
  // to nothing at range. rgb is 'r,g,b'; alphaNear is the peak opacity.
  function drawCone(ctx, level, x, y, angle, halfAngle, range, rgb, alphaNear, stroke) {
    var pts = L.conePolygon(level, x, y, angle, halfAngle, range);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    var cg = ctx.createRadialGradient(x, y, 6, x, y, range);
    cg.addColorStop(0, 'rgba(' + rgb + ',' + alphaNear + ')');
    cg.addColorStop(0.55, 'rgba(' + rgb + ',' + (alphaNear * 0.5).toFixed(3) + ')');
    cg.addColorStop(1, 'rgba(' + rgb + ',0)');
    ctx.fillStyle = cg;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function drawGuard(ctx, g, now) {
    var col = g.state === 'alerted' ? COL.guardAlert :
      g.state === 'suspicious' ? COL.guardSuspicious : COL.guard;
    var bob = Math.sin(g.stepPhase || 0) * 1.2;
    var fx = Math.cos(g.angle), fy = Math.sin(g.angle);
    var px = -fy, py = fx; // perpendicular to facing
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(g.x, g.y + 11, 13, 6, 0, 0, 6.29); ctx.fill();
    ctx.save();
    ctx.translate(g.x, g.y + bob);
    // Body: navy uniform with outline, gold belt and epaulettes.
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(0, 0, g.radius, 0, 6.29); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, g.radius - 1, 0, 6.29); ctx.clip();
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-px * g.radius, -py * g.radius); ctx.lineTo(px * g.radius, py * g.radius); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#c9a227';
    ctx.beginPath(); ctx.arc(-px * 7, -py * 7, 2.2, 0, 6.29); ctx.fill();
    ctx.beginPath(); ctx.arc(px * 7, py * 7, 2.2, 0, 6.29); ctx.fill();
    // Face: skin with two eyes looking along the facing direction.
    ctx.fillStyle = '#d8cdb4';
    ctx.beginPath(); ctx.arc(fx * 2, fy * 2, 7, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#1c1c22';
    ctx.beginPath(); ctx.arc(fx * 4 - py * 2.6, fy * 4 - px * 2.6, 1.3, 0, 6.29); ctx.fill();
    ctx.beginPath(); ctx.arc(fx * 4 + py * 2.6, fy * 4 + px * 2.6, 1.3, 0, 6.29); ctx.fill();
    // Cap: navy arc, brim toward facing, gold badge.
    ctx.fillStyle = '#1c2f4d';
    ctx.beginPath(); ctx.arc(0, -2, 7, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
    ctx.fillStyle = '#16243a';
    ctx.beginPath(); ctx.ellipse(fx * 8, fy * 8, 5, 2.5, Math.atan2(fy, fx), 0, 6.29); ctx.fill();
    ctx.fillStyle = '#c9a227';
    ctx.beginPath(); ctx.arc(fx * 3, fy * 3 - 4, 1.6, 0, 6.29); ctx.fill();
    // Flashlight dot with a faint glow.
    var lx = fx * (g.radius + 5), ly = fy * (g.radius + 5);
    var lg = ctx.createRadialGradient(lx, ly, 1, lx, ly, 9);
    lg.addColorStop(0, 'rgba(255,246,201,0.5)');
    lg.addColorStop(1, 'rgba(255,246,201,0)');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.arc(lx, ly, 9, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#fff6c9';
    ctx.beginPath(); ctx.arc(lx, ly, 3, 0, 6.29); ctx.fill();
    ctx.restore();
    // State mark.
    if (g.state !== 'patrol') {
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = g.state === 'alerted' ? '#ff5252' : '#ffd34d';
      ctx.fillText(g.state === 'alerted' ? '!' : '?', g.x, g.y - 20);
    }
    // Detection ring over the guard while it is filling.
    if (g.detection > 2 && g.state !== 'alerted') {
      ctx.strokeStyle = '#ffd34d';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.radius + 6, -Math.PI / 2, -Math.PI / 2 + (g.detection / 100) * Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawCamera(ctx, cam, now) {
    var disabled = now < cam.disabledUntil;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(cam.x, cam.y + 8, 14, 6, 0, 0, 6.29); ctx.fill();
    ctx.save();
    ctx.translate(cam.x, cam.y);
    ctx.rotate(cam.angle);
    ctx.fillStyle = disabled ? '#555' : '#8a8a96';
    rr(ctx, -6, -9, 33, 18, 6); ctx.fill();
    ctx.fillStyle = disabled ? '#333' : COL.cameraLens;
    ctx.beginPath(); ctx.arc(28, 0, 6, 0, 6.29); ctx.fill();
    if (!disabled && cam.seeing) {
      var cg2 = ctx.createRadialGradient(28, 0, 1, 28, 0, 20);
      cg2.addColorStop(0, 'rgba(255,82,82,' + (0.35 + Math.sin(now * 10) * 0.1).toFixed(3) + ')');
      cg2.addColorStop(1, 'rgba(255,82,82,0)');
      ctx.fillStyle = cg2;
      ctx.beginPath(); ctx.arc(28, 0, 20, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#ff5252';
      ctx.beginPath(); ctx.arc(28, 0, 6 + Math.sin(now * 10) * 1.5, 0, 6.29); ctx.fill();
    }
    ctx.restore();
    // Wall mount.
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cam.x, cam.y); ctx.lineTo(cam.x, cam.y - 20); ctx.stroke();
    if (disabled) {
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#9a9a9a';
      var left = Math.ceil(cam.disabledUntil - now);
      ctx.fillText('OFF ' + left + 's', cam.x, cam.y - 26);
    }
  }

  function drawPlayer(ctx, p, now) {
    var crouch = p.sneaking ? 0.82 : 1;
    var bob = p.moving ? Math.sin(now * 11) * 1.5 : 0;
    var R = p.radius + 6; // draw-only enlargement; collision radius stays 13
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 10, R * 0.63, R * 0.32, 0, 0, 6.29); ctx.fill();
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.rotate(p.angle);
    // Burglar in a burgundy coat and black mask, carrying a sack when loaded.
    ctx.fillStyle = COL.thiefCoat;
    ctx.beginPath(); ctx.arc(0, 0, R * crouch + 2, 0, 6.29); ctx.fill();
    // Teal-white outline ring so the thief reads at a glance on the light floor.
    ctx.strokeStyle = '#7fe0d4';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // Gold sash across the coat.
    ctx.strokeStyle = 'rgba(201,162,39,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -(R * crouch + 1)); ctx.lineTo(0, R * crouch + 1); ctx.stroke();
    ctx.fillStyle = COL.thief;
    ctx.beginPath(); ctx.arc(2, 0, 7.5, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#f2d8b8';
    ctx.beginPath(); ctx.arc(4, -3, 2.4, 0, 6.29); ctx.fill();
    ctx.beginPath(); ctx.arc(4, 3, 2.4, 0, 6.29); ctx.fill();
    ctx.fillStyle = COL.thief;
    ctx.fillRect(0, -6, 6, 12);
    // Dark-teal hood rim over the head.
    ctx.strokeStyle = '#0e4f4a';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(2, 0, 10, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    if (p.hasStar) {
      ctx.fillStyle = '#8a6d2f';
      ctx.beginPath(); ctx.arc(-11, 0, 6, 0, 6.29); ctx.fill();
    }
    ctx.restore();
    // Detection meter above the thief when being seen.
    if (p.detectionShown > 2) {
      var w = 44, pct = Math.min(100, p.detectionShown) / 100;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(p.x - w / 2, p.y - 30, w, 7);
      ctx.fillStyle = pct > 0.66 ? '#ff5252' : '#ffd34d';
      ctx.fillRect(p.x - w / 2 + 1, p.y - 29, (w - 2) * pct, 5);
    }
  }

  function drawParticles(ctx, particles) {
    particles.forEach(function (pt) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, 6.29); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawDarkness(ctx, game, now) {
    if (!darkCanvas) {
      darkCanvas = document.createElement('canvas');
      darkCanvas.width = C.VIEW_W;
      darkCanvas.height = C.VIEW_H;
    }
    var d = darkCanvas.getContext('2d');
    d.clearRect(0, 0, C.VIEW_W, C.VIEW_H);
    d.globalCompositeOperation = 'source-over';
    d.fillStyle = 'rgba(6,6,16,0.30)';
    d.fillRect(0, 0, C.VIEW_W, C.VIEW_H);
    d.globalCompositeOperation = 'destination-out';
    function hole(x, y, r, a) {
      var g = d.createRadialGradient(x, y, 4, x, y, r);
      g.addColorStop(0, 'rgba(0,0,0,' + a + ')');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = g;
      d.beginPath(); d.arc(x, y, r, 0, 6.29); d.fill();
    }
    hole(game.player.x, game.player.y, 150, 0.95);
    if (game.level.star && !game.level.star.taken) hole(game.level.star.x, game.level.star.y, 90, 0.9);
    if (game.level.exit) hole(game.level.exit.x, game.level.exit.y, 80, 0.85);
    game.level.junctionBoxes.forEach(function (jb) { hole(jb.x, jb.y, 45, 0.6); });
    ctx.drawImage(darkCanvas, 0, 0);
  }

  function drawHUD(ctx, game, now) {
    var g = game;
    ctx.fillStyle = COL.hudBg;
    ctx.fillRect(0, 0, C.VIEW_W, 46);
    ctx.fillStyle = 'rgba(201,162,39,0.5)';
    ctx.fillRect(0, 46, C.VIEW_W, 2);
    ctx.textBaseline = 'middle';
    // Level name.
    ctx.fillStyle = COL.hudText;
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(g.level.def.name.toUpperCase(), 14, 16);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#c9b98a';
    ctx.fillText(g.level.def.sub, 14, 34);
    // Loot + score.
    ctx.fillStyle = COL.gold;
    ctx.beginPath(); ctx.arc(330, 23, 8, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#7a5c00';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('◈', 330, 24);
    ctx.fillStyle = COL.hudText;
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('LOOT ' + g.player.loot + '   •   SCORE ' + g.player.score, 346, 24);
    // Alarm meter.
    var ax = 640, ay = 15, aw = 300, ah = 16;
    ctx.fillStyle = '#1c1c22';
    rr(ctx, ax, ay, aw, ah, 8); ctx.fill();
    var pct = Math.min(100, g.alarm) / 100;
    var acol = g.alarm >= 75 ? COL.hudAlarm : g.alarm >= 40 ? COL.hudAlarmLow : '#39d98a';
    if (pct > 0.005) {
      ctx.fillStyle = acol;
      rr(ctx, ax + 2, ay + 2, (aw - 4) * pct, ah - 4, 6); ctx.fill();
    }
    ctx.strokeStyle = g.alarm >= 75 ? '#ff8a80' : '#6b5d43';
    ctx.lineWidth = 1.5;
    rr(ctx, ax, ay, aw, ah, 8); ctx.stroke();
    ctx.fillStyle = g.alarm >= 75 ? '#ff8a80' : COL.hudText;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('ALARM ' + Math.round(g.alarm) + '%', ax + aw + 10, 24);
    // Timer + nerves.
    var mm = Math.floor(g.timer / 60), ss = Math.floor(g.timer % 60);
    ctx.fillStyle = COL.hudText;
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText((mm < 10 ? '0' : '') + mm + ':' + (ss < 10 ? '0' : '') + ss, C.VIEW_W - 14, 16);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#ff8ba0';
    var hearts = '';
    for (var i = 0; i < g.nerves; i++) hearts += '♥ ';
    ctx.fillText(hearts, C.VIEW_W - 14, 36);
    // Context prompt at the bottom.
    if (g.prompt) {
      ctx.fillStyle = 'rgba(12,8,6,0.82)';
      var pw = ctx.measureText(g.prompt).width + 28;
      rr(ctx, (C.VIEW_W - pw) / 2, C.VIEW_H - 40, pw, 28, 14); ctx.fill();
      ctx.fillStyle = '#ffe9a8';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(g.prompt, C.VIEW_W / 2, C.VIEW_H - 25);
    }
    // Caught / lockdown flash banner.
    if (g.banner) {
      ctx.fillStyle = 'rgba(20,4,4,0.85)';
      ctx.fillRect(0, C.VIEW_H / 2 - 46, C.VIEW_W, 92);
      ctx.fillStyle = '#ff5252';
      ctx.font = 'bold 44px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(g.banner, C.VIEW_W / 2, C.VIEW_H / 2 + 2);
      if (g.bannerSub) {
        ctx.fillStyle = COL.hudText;
        ctx.font = '16px sans-serif';
        ctx.fillText(g.bannerSub, C.VIEW_W / 2, C.VIEW_H / 2 + 34);
      }
    }
  }

  // Warm lamp glows (wall sconces, player pool, star pool) drawn additively
  // over the darkness so the gallery feels lit at night.
  function drawLightGlows(ctx, game, now) {
    var sconces = [[4, 0], [12, 0], [20, 0], [28, 0], [8, 17], [24, 17]];
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    function glow(x, y, r, color, a) {
      var g = ctx.createRadialGradient(x, y, 4, x, y, r);
      g.addColorStop(0, 'rgba(' + color + ',' + a + ')');
      g.addColorStop(1, 'rgba(' + color + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.29); ctx.fill();
    }
    sconces.forEach(function (s) {
      glow((s[0] + 0.5) * TILE, (s[1] + 0.5) * TILE, 120, '255,190,90', 0.13);
    });
    glow(game.player.x, game.player.y, 170, '255,200,120', 0.09);
    if (game.level.star && !game.level.star.taken) {
      glow(game.level.star.x, game.level.star.y, 90, '255,80,110', 0.08);
    }
    ctx.restore();
    // Sconce fixtures on the walls.
    sconces.forEach(function (s) {
      var sx = (s[0] + 0.5) * TILE, sy = (s[1] + 0.5) * TILE;
      ctx.fillStyle = '#3a2c12';
      ctx.fillRect(sx - 6, sy - 8, 12, 16);
      ctx.fillStyle = '#c9a227';
      ctx.fillRect(sx - 5, sy - 7, 10, 3);
      ctx.fillStyle = '#ffd98a';
      ctx.beginPath(); ctx.arc(sx, sy + 2, 3.5, 0, 6.29); ctx.fill();
    });
  }

  function drawWorld(ctx, game, now) {
    var level = game.level;
    drawFloor(ctx, level, now);
    drawLoot(ctx, level, now);
    drawCover(ctx, level);
    drawDarkness(ctx, game, now);
    drawLightGlows(ctx, game, now);
    // Vision cones glow through the dark so the danger is readable at a glance.
    level.cameras.forEach(function (cam) {
      if (now < cam.disabledUntil) return;
      drawCone(ctx, level, cam.x, cam.y, cam.angle, C.CAMERA_VIEW_HALF_ANGLE,
        C.CAMERA_VIEW_RANGE,
        cam.seeing ? '255,60,60' : '255,80,80',
        cam.seeing ? 0.5 : 0.38,
        cam.seeing ? 'rgba(255,80,80,0.7)' : 'rgba(255,80,80,0.35)');
    });
    level.guards.forEach(function (g) {
      var rgb = g.state === 'alerted' ? '255,60,60' :
        g.state === 'suspicious' ? '255,200,60' : '255,220,90';
      var an = g.state === 'alerted' ? 0.5 :
        g.state === 'suspicious' ? 0.45 : 0.42;
      var stroke = g.state === 'alerted' ? 'rgba(255,90,90,0.7)' : 'rgba(255,220,90,0.45)';
      drawCone(ctx, level, g.x, g.y, g.angle, C.GUARD_VIEW_HALF_ANGLE,
        C.GUARD_VIEW_RANGE, rgb, an, stroke);
    });
    level.cameras.forEach(function (cam) { drawCamera(ctx, cam, now); });
    level.guards.forEach(function (g) { drawGuard(ctx, g, now); });
    drawPlayer(ctx, game.player, now);
    drawParticles(ctx, game.particles);
    // Vignette: darker corners, so the lit middle of the hall reads at a glance.
    var vg = ctx.createRadialGradient(C.VIEW_W / 2, C.VIEW_H / 2, 300, C.VIEW_W / 2, C.VIEW_H / 2, 800);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.16)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, C.VIEW_W, C.VIEW_H);
  }

  function button(ctx, rect, label, sub, hover) {
    ctx.fillStyle = hover ? '#8a6d1f' : '#3a2c12';
    rr(ctx, rect.x, rect.y, rect.w, rect.h, 10); ctx.fill();
    ctx.strokeStyle = COL.gold;
    ctx.lineWidth = 2;
    rr(ctx, rect.x, rect.y, rect.w, rect.h, 10); ctx.stroke();
    ctx.fillStyle = '#ffe9a8';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, rect.x + rect.w / 2, rect.y + rect.h / 2 - (sub ? 8 : 0));
    if (sub) {
      ctx.fillStyle = '#c9b98a';
      ctx.font = '13px sans-serif';
      ctx.fillText(sub, rect.x + rect.w / 2, rect.y + rect.h / 2 + 16);
    }
  }

  function drawMenu(ctx, game, now, mouse) {
    var W = C.VIEW_W, H = C.VIEW_H;
    // Night gallery backdrop: dark room, gold frame, the star glowing.
    ctx.fillStyle = '#171008';
    ctx.fillRect(0, 0, W, H);
    var g = ctx.createRadialGradient(W / 2, 250, 10, W / 2, 250, 420);
    g.addColorStop(0, 'rgba(245,197,66,0.20)');
    g.addColorStop(1, 'rgba(245,197,66,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#c9a227';
    ctx.lineWidth = 3;
    ctx.strokeRect(24, 24, W - 48, H - 48);
    ctx.fillStyle = '#c9a227';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★  A  NIGHT  AT  THE  MUSEUM  ★', W / 2, 78);
    ctx.fillStyle = '#f5c542';
    ctx.font = 'bold 64px Georgia, serif';
    ctx.fillText('AURUM', W / 2, 158);
    ctx.fillStyle = '#ff2e4d';
    ctx.font = 'bold 44px Georgia, serif';
    ctx.fillText('AFTER DARK', W / 2, 210);
    ctx.fillStyle = COL.hudText;
    ctx.font = '18px Georgia, serif';
    ctx.fillText('The Gilded Gallery Heist — lift the Crimson Star and slip out unseen.', W / 2, 252);
    // How to play.
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    rr(ctx, W / 2 - 330, 278, 660, 96, 10); ctx.fill();
    ctx.fillStyle = '#e8dcc0';
    ctx.font = '15px sans-serif';
    ctx.fillText('WASD / arrows — move      SHIFT — sneak (slow, quiet, hard to see)', W / 2, 306);
    ctx.fillText('E — grab loot / cut camera power at a ⚡ box      P — pause      M — mute', W / 2, 332);
    ctx.fillText('Guards patrol with vision cones. Cameras sweep. Fill the alarm and it is over.', W / 2, 358);
    // Level buttons.
    game.menuButtons = [];
    var bw = 170, bh = 56, gap = 18;
    var cols = 4, rows = 3;
    var total = cols * bw + (cols - 1) * gap;
    var x0 = (W - total) / 2, y0 = 396;
    for (var i = 0; i < cols * rows; i++) {
      var rect = { x: x0 + (i % cols) * (bw + gap), y: y0 + Math.floor(i / cols) * (bh + gap), w: bw, h: bh, level: i };
      var unlocked = i <= game.unlockedMax;
      var hover = mouse.x >= rect.x && mouse.x <= rect.x + rect.w &&
        mouse.y >= rect.y && mouse.y <= rect.y + rect.h;
      ctx.globalAlpha = unlocked ? 1 : 0.45;
      button(ctx, rect, unlocked ? ('LEVEL ' + (i + 1)) : ('LEVEL ' + (i + 1) + ' 🔒'),
        C.LEVELS[i].name, hover && unlocked);
      ctx.globalAlpha = 1;
      if (unlocked) game.menuButtons.push(rect);
    }
    ctx.fillStyle = '#c9b98a';
    ctx.font = '13px sans-serif';
    ctx.fillText('Best score: ' + game.bestScore + '   •   Ghost runs: ' + game.ghostRuns, W / 2, 622);
    ctx.fillStyle = '#8a7a5c';
    ctx.font = '12px sans-serif';
    ctx.fillText('An original game. No network, no files beyond this page. Sound is synthesized live.', W / 2, H - 44);
    // A tiny thief silhouette crossing the bottom for charm.
    var tx = (now * 40) % (W + 80) - 40;
    ctx.fillStyle = '#2b2b33';
    ctx.beginPath(); ctx.arc(tx, H - 84, 10, 0, 6.29); ctx.fill();
  }

  function drawPause(ctx, game) {
    ctx.fillStyle = 'rgba(8,6,4,0.72)';
    ctx.fillRect(0, 0, C.VIEW_W, C.VIEW_H);
    ctx.fillStyle = COL.hudText;
    ctx.font = 'bold 40px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', C.VIEW_W / 2, C.VIEW_H / 2 - 10);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#c9b98a';
    ctx.fillText('P / Esc — resume      R — restart level      M — mute', C.VIEW_W / 2, C.VIEW_H / 2 + 26);
  }

  function drawEndScreen(ctx, game, kind) {
    ctx.fillStyle = 'rgba(8,6,4,0.78)';
    ctx.fillRect(0, 0, C.VIEW_W, C.VIEW_H);
    var W = C.VIEW_W;
    ctx.textAlign = 'center';
    if (kind === 'complete') {
      ctx.fillStyle = COL.gold;
      ctx.font = 'bold 46px Georgia, serif';
      ctx.fillText('CLEAN GETAWAY!', W / 2, 180);
      ctx.fillStyle = COL.hudText;
      ctx.font = '20px sans-serif';
      ctx.fillText(game.level.def.name + ' — the Crimson Star is yours.', W / 2, 224);
      var lines = [
        'Loot: ' + game.player.loot + ' pieces   •   Score: ' + game.player.score,
        'Time: ' + Math.floor(game.timer) + 's',
        game.seenEver ? '' : 'GHOST BONUS +500 — never seen',
        game.alertedEver ? '' : 'SHADOW BONUS +250 — never alerted'
      ].filter(Boolean);
      ctx.font = '17px sans-serif';
      lines.forEach(function (ln, i) { ctx.fillText(ln, W / 2, 268 + i * 28); });
      ctx.fillStyle = '#39d98a';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText(game.levelIndex >= C.LEVELS.length - 1
        ? 'You cleared every gallery! Click anywhere for the menu  •  R to replay'
        : 'Click anywhere for the next level  •  R to replay', W / 2, 268 + lines.length * 28 + 26);
    } else {
      ctx.fillStyle = '#ff5252';
      ctx.font = 'bold 46px Georgia, serif';
      ctx.fillText(game.failReason === 'lockdown' ? 'LOCKDOWN!' : 'CAUGHT!', W / 2, 180);
      ctx.fillStyle = COL.hudText;
      ctx.font = '20px sans-serif';
      ctx.fillText(game.failReason === 'lockdown'
        ? 'The alarm hit 100%. The gallery sealed itself.'
        : 'The guards have you. Three nerves, all gone.', W / 2, 224);
      ctx.fillStyle = '#ffe9a8';
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('Click or press R to try the level again', W / 2, 280);
    }
    ctx.fillStyle = '#8a7a5c';
    ctx.font = '13px sans-serif';
    ctx.fillText('AURUM AFTER DARK — The Gilded Gallery Heist', W / 2, C.VIEW_H - 48);
  }

  window.AURUM_RENDER = {
    drawWorld: drawWorld, drawHUD: drawHUD, drawMenu: drawMenu,
    drawPause: drawPause, drawEndScreen: drawEndScreen
  };
})();
