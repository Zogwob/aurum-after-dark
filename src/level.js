// level.js — parses a level map from config.js into walls, cover, loot,
// exits, junction boxes, the star case and spawn points. Also line-of-sight
// (raycast against walls and tall cover) and circle-vs-wall collision.

(function () {
  'use strict';

  var C = window.AURUM_CONFIG;
  var TILE = C.TILE;

  // Tiles that block movement.
  function isSolidTile(ch) {
    return ch === '#' || ch === 'P' || ch === 'S' || ch === 'B' || ch === 'T' || ch === '*';
  }
  // Tiles that block sight (tall cover). Benches are low: you can see over them.
  function blocksSight(ch) {
    return ch === '#' || ch === 'P' || ch === 'S' || ch === 'T' || ch === '*';
  }

  function parseLevel(def) {
    var rows = def.map.map(function (r) { return r.split(''); });
    var h = rows.length;
    var w = 0;
    rows.forEach(function (r) { w = Math.max(w, r.length); });
    // Normalize: pad short rows with wall so every row has the same width.
    rows = rows.map(function (r) {
      while (r.length < w) r.push('#');
      return r;
    });

    var level = {
      def: def, rows: rows, w: w, h: h,
      loot: [], guards: [], cameras: [],
      playerStart: { x: TILE * 1.5, y: TILE * 1.5 },
      star: null, exit: null, junctionBoxes: [],
      darkZones: []
    };

    var guardSpawns = [];
    var cameraSpawns = [];
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var ch = rows[y][x];
        var cx = (x + 0.5) * TILE, cy = (y + 0.5) * TILE;
        if (ch === 'x') level.playerStart = { x: cx, y: cy };
        else if (ch === '*') level.star = { x: cx, y: cy, tx: x, ty: y, taken: false };
        else if (ch === 'E') level.exit = { x: cx, y: cy, tx: x, ty: y };
        else if (ch === 'J') level.junctionBoxes.push({ x: cx, y: cy, tx: x, ty: y });
        else if (ch === 'o') level.loot.push({ kind: 'coin', x: cx, y: cy, taken: false, bob: Math.random() * 6.28 });
        else if (ch === 'v') level.loot.push({ kind: 'vase', x: cx, y: cy, taken: false, broken: false, bob: 0 });
        else if (ch === 'a') level.loot.push({ kind: 'painting', x: cx, y: cy, taken: false, bob: 0 });
        else if (ch === 'g') guardSpawns.push({ x: cx, y: cy });
        else if (ch === 'c') cameraSpawns.push({ x: cx, y: cy });
        else if (ch === ',') level.darkZones.push({ x: cx, y: cy });
      }
    }

    // Guards: waypoints come from the level def; spawn at the first waypoint.
    level.guards = def.guards.map(function (g, i) {
      var start = g.waypoints[0];
      return {
        x: (start[0] + 0.5) * TILE, y: (start[1] + 0.5) * TILE,
        waypoints: g.waypoints.map(function (wp) { return { x: (wp[0] + 0.5) * TILE, y: (wp[1] + 0.5) * TILE }; }),
        wpIndex: 1, pause: g.pause || 1, pauseLeft: 0,
        angle: 0, state: 'patrol', // patrol | suspicious | alerted
        target: null, investigate: null, lookTimer: 0,
        detection: 0, radius: 13, stepPhase: Math.random() * 6.28
      };
    });

    // Cameras: mounts come from 'c' markers in map order, sweep from the def.
    level.cameras = def.cameras.map(function (c, i) {
      var m = cameraSpawns[i] || { x: TILE * 16, y: TILE * 1.5 };
      return {
        x: m.x, y: m.y, baseAngle: c.baseAngle, sweep: c.sweep,
        speed: c.speed, phase: Math.random() * 6.28,
        angle: c.baseAngle, disabledUntil: 0, beepTimer: 0
      };
    });
    void guardSpawns;

    return level;
  }

  function tileAt(level, px, py) {
    var tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    if (tx < 0 || ty < 0 || tx >= level.w || ty >= level.h) return '#';
    return level.rows[ty][tx];
  }

  function isWallAt(level, px, py) {
    return isSolidTile(tileAt(level, px, py));
  }

  function isDarkAt(level, px, py) {
    return tileAt(level, px, py) === ',';
  }

  // Move a circle (radius r) with axis-separated collision so it slides on walls.
  function moveCircle(level, obj, dx, dy, r) {
    var nx = obj.x + dx;
    if (!isWallAt(level, nx + (dx > 0 ? r : -r), obj.y - r * 0.7) &&
        !isWallAt(level, nx + (dx > 0 ? r : -r), obj.y + r * 0.7) &&
        !isWallAt(level, nx + (dx > 0 ? r : -r), obj.y)) {
      obj.x = nx;
    }
    var ny = obj.y + dy;
    if (!isWallAt(level, obj.x - r * 0.7, ny + (dy > 0 ? r : -r)) &&
        !isWallAt(level, obj.x + r * 0.7, ny + (dy > 0 ? r : -r)) &&
        !isWallAt(level, obj.x, ny + (dy > 0 ? r : -r))) {
      obj.y = ny;
    }
  }

  // Line of sight: sample along the segment; blocked by walls / tall cover.
  function hasLineOfSight(level, x0, y0, x1, y1) {
    var dx = x1 - x0, dy = y1 - y0;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var steps = Math.max(1, Math.ceil(dist / 8));
    for (var i = 1; i < steps; i++) {
      var t = i / steps;
      if (blocksSight(tileAt(level, x0 + dx * t, y0 + dy * t))) return false;
    }
    return true;
  }

  // Vision-cone polygon: raycast across the field of view, stopping at sight blockers.
  function conePolygon(level, x, y, angle, halfAngle, range) {
    var pts = [{ x: x, y: y }];
    var rays = 14;
    for (var i = 0; i <= rays; i++) {
      var a = angle - halfAngle + (2 * halfAngle * i) / rays;
      var dx = Math.cos(a), dy = Math.sin(a);
      var d = 0, step = 10;
      while (d < range) {
        d += step;
        if (blocksSight(tileAt(level, x + dx * d, y + dy * d))) break;
      }
      pts.push({ x: x + dx * Math.min(d, range), y: y + dy * Math.min(d, range) });
    }
    return pts;
  }

  function angleDiff(a, b) {
    var d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  window.AURUM_LEVEL = {
    parseLevel: parseLevel, tileAt: tileAt, isWallAt: isWallAt,
    isDarkAt: isDarkAt, moveCircle: moveCircle,
    hasLineOfSight: hasLineOfSight, conePolygon: conePolygon,
    angleDiff: angleDiff
  };
})();
