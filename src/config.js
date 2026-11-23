// config.js — constants and level definitions for AURUM AFTER DARK.
// A top-down 2D heist in a night museum gallery. Vanilla JS, canvas-rendered.
// Map legend: # wall | . floor | , shadow floor | P plinth | S statue |
// B bench | T plant | o gold coin | v vase | a painting | * Crimson Star case |
// E service exit | J junction box | x thief start | g guard spawn | c camera mount.

(function () {
  'use strict';

  var TILE = 40;
  var COLS = 32;
  var ROWS = 18;
  var VIEW_W = COLS * TILE; // 1280
  var VIEW_H = ROWS * TILE; // 720

  var WALK_SPEED = 150; // px per second
  var SNEAK_SPEED = 82;
  var GUARD_SPEED = 62;
  var CHASE_SPEED = 132;

  var GUARD_VIEW_RANGE = 235;
  var GUARD_VIEW_HALF_ANGLE = 0.62; // ~71 degrees total
  var CAMERA_VIEW_RANGE = 265;
  var CAMERA_VIEW_HALF_ANGLE = 0.46; // ~53 degrees total

  var CAMERA_DISABLE_SECONDS = 12;
  var JUNCTION_USES_PER_LEVEL = 2;

  var ALARM_CAMERA_RATE = 42; // alarm points per second while a camera sees you
  var ALARM_GUARD_SPOT = 26; // alarm jump when a guard fully spots you
  var ALARM_DECAY = 2.5; // alarm points per second while unseen
  var ALARM_LOCKDOWN = 100;

  var DETECT_BASE_RATE = 55; // detection points per second, scaled by situation
  var DETECT_DECAY = 45;

  var NERVES_PER_LEVEL = 3;

  var SCORE_COIN = 50;
  var SCORE_VASE = 120;
  var SCORE_PAINTING = 200;
  var SCORE_STAR = 1000;
  var SCORE_GHOST = 500;
  var SCORE_SHADOW = 250;

  var COLORS = {
    floor: '#3a2c22',
    floorAlt: '#33261e',
    carpet: '#7a1f2b',
    carpetEdge: '#c9a227',
    wall: '#241a12',
    wallTop: '#4a3423',
    shadowFloor: '#241a16',
    plinth: '#8a7a5c',
    plinthTop: '#b3a37e',
    statue: '#9a938a',
    bench: '#5c3a22',
    plant: '#2e5d33',
    gold: '#f5c542',
    star: '#ff2e4d',
    exit: '#39d98a',
    guard: '#2b4a7a',
    guardAlert: '#c22e2e',
    guardSuspicious: '#d8a020',
    camera: '#3d3d46',
    cameraLens: '#ff5252',
    thief: '#1c1c22',
    thiefCoat: '#6b1f2e',
    hudBg: 'rgba(12,8,6,0.82)',
    hudText: '#f2e6c9',
    hudAlarm: '#ff3b30',
    hudAlarmLow: '#f5c542'
  };

  // Guard patrols: waypoints in tile coords, matched to 'g' markers in map order.
  // Cameras: sweep in radians, matched to 'c' markers in map order.
  var LEVELS = [
    {
      name: 'The Grand Hall',
      sub: 'Level 1 — lift the Crimson Star',
      brief: 'Cross the grand hall, lift the Crimson Star, slip out the service door.',
      guards: [
        { waypoints: [[8, 9], [23, 9]], pause: 1.2 },
        { waypoints: [[16, 5], [16, 13]], pause: 1.0 }
      ],
      cameras: [
        { baseAngle: Math.PI / 2, sweep: 0.85, speed: 0.55 },
        { baseAngle: -Math.PI / 2, sweep: 0.85, speed: 0.45 }
      ],
      map: [
        '################################',
        '#x.....o........,...c...o......#',
        '#......P........,....P.........#',
        '#..o...P....P........P....o....#',
        '#......P....P....*...P.........#',
        '#..#####....P........#####.....#',
        '#..#...#............#...#......#',
        '#..#.o.#..P......P..#.v.#.....#',
        '#..#...#............#...#......#',
        '#..#####............#####......#',
        '#.........,.....,.............#',
        '#..P....P......o......P....P..#',
        '#..P....P.............P....P..#',
        '#....o.......,........o.......#',
        '#............................#',
        '#..J.....................J...#',
        '#.........E..............c...#',
        '################################'
      ]
    },
    {
      name: 'The Sculpture Wing',
      sub: 'Level 2 — three guards, three eyes',
      brief: 'The sculpture wing is tighter. Cameras overlap — cut the power, then move.',
      guards: [
        { waypoints: [[6, 4], [25, 4]], pause: 0.8 },
        { waypoints: [[25, 13], [6, 13]], pause: 0.8 },
        { waypoints: [[16, 8], [16, 14], [10, 14]], pause: 1.4 }
      ],
      cameras: [
        { baseAngle: Math.PI / 2, sweep: 1.0, speed: 0.7 },
        { baseAngle: -Math.PI / 2, sweep: 1.0, speed: 0.6 },
        { baseAngle: Math.PI, sweep: 0.7, speed: 0.5 }
      ],
      map: [
        '################################',
        '#x..o....S......,...c..S....o..#',
        '#.......S......,......S........#',
        '#..#####........,........#####.#',
        '#..#...#..P..........P..#...#..#',
        '#..#.a.#..P....*....P..#.v.#..#',
        '#..#...#..P..........P..#...#..#',
        '#..#####................#####.#',
        '#c...,.....######.....,.......#',
        '#..........#....#.............#',
        '#..P.......#.o..#.......P.....#',
        '#..P.......#....#.......P.....#',
        '#....o.....######.....o.......#',
        '#........,..........,.........#',
        '#..S...........P...........S..#',
        '#..J....o......P......o.c.J...#',
        '#.........E...................#',
        '################################'
      ]
    },
    {
      name: 'The Vault Antechamber',
      sub: 'Level 3 — the vault is watching',
      brief: 'Four guards, four cameras, one vault. Ghost it or not at all.',
      guards: [
        { waypoints: [[5, 3], [26, 3]], pause: 0.6 },
        { waypoints: [[26, 15], [5, 15]], pause: 0.6 },
        { waypoints: [[10, 9], [21, 9]], pause: 1.0 },
        { waypoints: [[16, 5], [16, 12]], pause: 0.9 }
      ],
      cameras: [
        { baseAngle: Math.PI / 2, sweep: 1.1, speed: 0.8 },
        { baseAngle: -Math.PI / 2, sweep: 1.1, speed: 0.75 },
        { baseAngle: 0, sweep: 0.8, speed: 0.6 },
        { baseAngle: Math.PI, sweep: 0.8, speed: 0.65 }
      ],
      map: [
        '################################',
        '#x..o...T......,...c..T....o...#',
        '#......T......,......T.........#',
        '#..####.........P........####..#',
        '#..#..#..S.....P.....S..#..#..#',
        '#..#.a#..S.....*.....S..#v.#..#',
        '#..#..#..S.....P.....S..#..#..#',
        '#..####.........P........####..#',
        '#c...,....##########....,...c.#',
        '#.........#........#..........#',
        '#..P......#.o..o...#......P...#',
        '#..P......#........#......P...#',
        '#....o....##########....o.....#',
        '#........,.........,..........#',
        '#..T...........P...........T..#',
        '#..J....o......P......o.c.J...#',
        '#.........E...................#',
        '################################'
      ]
    },
    {
      name: 'The Portrait Gallery',
      sub: 'Level 4 — faces on every wall',
      brief: 'Four guards, four cameras, and portraits that watch back. Keep moving.',
      guards: [
        { waypoints: [[8, 10], [23, 10]], pause: 1.0 },
        { waypoints: [[16, 5], [16, 13]], pause: 0.9 },
        { waypoints: [[4, 13], [27, 13]], pause: 0.8 },
        { waypoints: [[4, 14], [27, 14]], pause: 1.1 },
      ],
      cameras: [
        { baseAngle: Math.PI / 2, sweep: 1.0, speed: 0.8 },
        { baseAngle: 0, sweep: 1.0, speed: 0.75 },
        { baseAngle: Math.PI, sweep: 0.9, speed: 0.7 },
        { baseAngle: -Math.PI / 2, sweep: 0.9, speed: 0.65 },
      ],
      map: [
        '################################',
        '#x..o...P......,...c..P....o...#',
        '#......P......,......P.........#',
        '#..o...P....P........P....o....#',
        '#......P....P....*...P.........#',
        '#..#####....P........#####.....#',
        '#..#...#............#...#......#',
        '#..#.a....P......P....v.#......#',
        '#c.#...#............#...#....c.#',
        '#..#####............#####......#',
        '#.........,.....,..............#',
        '#..P....P......o......P....P...#',
        '#..P....P.............P....P...#',
        '#....o.......,........o........#',
        '#..............................#',
        '#..J.....................J.....#',
        '#.........E..............c.....#',
        '################################',
      ]
    },
    {
      name: 'The Marble Corridor',
      sub: 'Level 5 — three lanes, no hiding',
      brief: 'Long marble lanes with nowhere to hide. Time the patrols, then run.',
      guards: [
        { waypoints: [[8, 10], [23, 10]], pause: 0.9 },
        { waypoints: [[16, 3], [16, 13]], pause: 0.8 },
        { waypoints: [[4, 13], [27, 13]], pause: 0.7 },
        { waypoints: [[4, 14], [27, 14]], pause: 1.0 },
        { waypoints: [[10, 2], [21, 2]], pause: 0.9 },
      ],
      cameras: [
        { baseAngle: Math.PI / 2, sweep: 1.05, speed: 0.85 },
        { baseAngle: 0, sweep: 1.05, speed: 0.8 },
        { baseAngle: Math.PI, sweep: 0.95, speed: 0.75 },
        { baseAngle: -Math.PI / 2, sweep: 0.95, speed: 0.7 },
      ],
      map: [
        '################################',
        '#x..o....T.....,....c..T....o..#',
        '#.......T.....,.......T........#',
        '#..o....T....P........T....o...#',
        '#.......T....P....*...T........#',
        '#.......T....P........T........#',
        '#..####.T....P........T.####...#',
        '#..#..#.T....P........T.#..#...#',
        '#c.#..#.T............T.#..#..c.#',
        '#..####.T............T.####....#',
        '#.........,.....,..............#',
        '#..T....T......o......T....T...#',
        '#..T....T.............T....T...#',
        '#....o.......,........o........#',
        '#..............................#',
        '#..J.....................J.....#',
        '#.........E..............c.....#',
        '################################',
      ]
    },
    {
      name: 'The Tapestry Hall',
      sub: 'Level 6 — statues in every shadow',
      brief: 'Five guards among the statues. The tapestries hide you — briefly.',
      guards: [
        { waypoints: [[8, 10], [23, 10]], pause: 0.9 },
        { waypoints: [[16, 5], [16, 13]], pause: 0.8 },
        { waypoints: [[4, 13], [27, 13]], pause: 0.7 },
        { waypoints: [[4, 14], [27, 14]], pause: 1.0 },
        { waypoints: [[10, 2], [20, 2]], pause: 0.8 },
      ],
      cameras: [
        { baseAngle: Math.PI / 2, sweep: 1.1, speed: 0.9 },
        { baseAngle: 0, sweep: 1.1, speed: 0.85 },
        { baseAngle: Math.PI, sweep: 1.0, speed: 0.8 },
        { baseAngle: 0, sweep: 1.0, speed: 0.75 },
        { baseAngle: -Math.PI / 2, sweep: 1.0, speed: 0.7 },
      ],
      map: [
        '################################',
        '#x..o...S......,...c..S....o...#',
        '#......S......,......S.........#',
        '#..o...S....S........S....o....#',
        '#......S....S....*...S.........#',
        '#..#####....S........#####.....#',
        '#..#...#............#...#......#',
        '#..#.v....S......S....a.#......#',
        '#c.#...#............#...#....c.#',
        '#..#####............#####......#',
        '#c........,.....,..............#',
        '#..S....S......o......S....S...#',
        '#..S....S.............S....S...#',
        '#....o.......,........o........#',
        '#..............................#',
        '#..J.....................J.....#',
        '#.........E..............c.....#',
        '################################',
      ]
    },
    {
      name: 'The Antiquities Wing',
      sub: 'Level 7 — old stones, new eyes',
      brief: 'Six guards among the plinth clusters. The old wing has more eyes than doors.',
      guards: [
        { waypoints: [[8, 10], [23, 10]], pause: 0.8 },
        { waypoints: [[16, 6], [16, 13]], pause: 0.7 },
        { waypoints: [[4, 13], [27, 13]], pause: 0.6 },
        { waypoints: [[4, 14], [27, 14]], pause: 0.9 },
        { waypoints: [[10, 6], [21, 6]], pause: 0.8 },
        { waypoints: [[10, 2], [20, 2]], pause: 1.0 },
      ],
      cameras: [
        { baseAngle: Math.PI / 2, sweep: 1.15, speed: 0.95 },
        { baseAngle: 0, sweep: 1.15, speed: 0.9 },
        { baseAngle: Math.PI, sweep: 1.05, speed: 0.85 },
        { baseAngle: 0, sweep: 1.05, speed: 0.8 },
        { baseAngle: -Math.PI / 2, sweep: 1.05, speed: 0.75 },
      ],
      map: [
        '################################',
        '#x..o...P......,...c..P....o...#',
        '#......P......,......P.........#',
        '#..P.P...P..P......P..P.P...o..#',
        '#......P....P....*...P.........#',
        '#..P.P...P..P......P..P.P......#',
        '#..............................#',
        '#..#.a....P......P....v.#......#',
        '#c.#...#............#...#....c.#',
        '#..#####............#####......#',
        '#c........,.....,..............#',
        '#..P....P......o......P....P...#',
        '#..P....P.............P....P...#',
        '#....o.......,........o........#',
        '#..............................#',
        '#..J.....................J.....#',
        '#.........E..............c.....#',
        '################################',
      ]
    },
    {
      name: 'The Gilded Rotunda',
      sub: 'Level 8 — the star in a ring of stone',
      brief: 'The Crimson Star sits in a plinth ring with two doors. Six guards walk the ring.',
      guards: [
        { waypoints: [[8, 11], [23, 11]], pause: 0.7 },
        { waypoints: [[16, 3], [16, 5]], pause: 0.6 },
        { waypoints: [[16, 12], [16, 14]], pause: 0.6 },
        { waypoints: [[10, 13], [21, 13]], pause: 0.5 },
        { waypoints: [[4, 14], [27, 14]], pause: 0.8 },
        { waypoints: [[10, 2], [20, 2]], pause: 0.9 },
      ],
      cameras: [
        { baseAngle: Math.PI / 2, sweep: 1.2, speed: 1.0 },
        { baseAngle: 0, sweep: 1.2, speed: 0.95 },
        { baseAngle: Math.PI, sweep: 1.1, speed: 0.9 },
        { baseAngle: 0, sweep: 1.1, speed: 0.85 },
        { baseAngle: Math.PI, sweep: 1.1, speed: 0.8 },
        { baseAngle: -Math.PI / 2, sweep: 1.1, speed: 0.75 },
      ],
      map: [
        '################################',
        '#x..o...T......,...c..T....o...#',
        '#......T......,......T.........#',
        '#..o....T....T........T....o...#',
        '#.......T....T........T........#',
        '#.......T....T........T........#',
        '#.......T.....P...P...T........#',
        '#.......T.....P...P...T........#',
        '#c......T.....P.*.P...T.......c#',
        '#.......T.....P...P...T........#',
        '#.......T.....P...P...T........#',
        '#c........,.....,............c.#',
        '#..T....T......o......T....T...#',
        '#..T....T.............T....T...#',
        '#....o.......,........o........#',
        '#..............................#',
        '#..J.........E..........c..J...#',
        '################################',
      ]
    },
    {
      name: 'The Clockwork Gallery',
      sub: 'Level 9 — teeth of stone, eyes of glass',
      brief: 'Seven guards in the zigzag teeth. The corridors are short and the cones are long.',
      guards: [
        { waypoints: [[10, 7], [16, 7]], pause: 0.6 },
        { waypoints: [[10, 9], [16, 9]], pause: 0.6 },
        { waypoints: [[12, 7], [12, 13]], pause: 0.5 },
        { waypoints: [[4, 14], [27, 14]], pause: 0.7 },
        { waypoints: [[10, 2], [20, 2]], pause: 0.8 },
        { waypoints: [[18, 7], [18, 13]], pause: 0.7 },
        { waypoints: [[10, 14], [21, 14]], pause: 0.6 },
      ],
      cameras: [
        { baseAngle: Math.PI / 2, sweep: 1.2, speed: 1.0 },
        { baseAngle: 0, sweep: 1.2, speed: 0.95 },
        { baseAngle: Math.PI, sweep: 1.1, speed: 0.9 },
        { baseAngle: 0, sweep: 1.1, speed: 0.85 },
        { baseAngle: Math.PI, sweep: 1.1, speed: 0.8 },
        { baseAngle: -Math.PI / 2, sweep: 1.1, speed: 0.75 },
      ],
      map: [
        '################################',
        '#x..o....T.....,....c..T....o..#',
        '#.......T.....,.......T........#',
        '#..####.............####.......#',
        '#..#..#....P....*...#..#.......#',
        '#..#..#....P......o.#..#.......#',
        '#..####.............####.......#',
        '#....o...P.......P.............#',
        '#c......P.......P............c.#',
        '#........P.......P.......o.....#',
        '#..####.............####.......#',
        '#..#..#....P........#..#.......#',
        '#..#..#....P........#..#.......#',
        '#..####......o.......####......#',
        '#c...o.......,........o......c.#',
        '#..J.....................J.....#',
        '#.........E..............c.....#',
        '################################',
      ]
    },
    {
      name: 'The Hall of Mirrors',
      sub: 'Level 10 — benches everywhere, cover nowhere',
      brief: 'Benches block your feet but not their eyes. Seven guards, seven cameras.',
      guards: [
        { waypoints: [[8, 10], [23, 10]], pause: 0.7 },
        { waypoints: [[16, 5], [16, 13]], pause: 0.6 },
        { waypoints: [[4, 13], [27, 13]], pause: 0.5 },
        { waypoints: [[4, 14], [27, 14]], pause: 0.8 },
        { waypoints: [[10, 2], [20, 2]], pause: 0.7 },
        { waypoints: [[6, 13], [25, 13]], pause: 0.6 },
        { waypoints: [[10, 6], [19, 6]], pause: 0.7 },
      ],
      cameras: [
        { baseAngle: Math.PI / 2, sweep: 1.25, speed: 1.05 },
        { baseAngle: 0, sweep: 1.25, speed: 1.0 },
        { baseAngle: Math.PI, sweep: 1.15, speed: 0.95 },
        { baseAngle: 0, sweep: 1.15, speed: 0.9 },
        { baseAngle: Math.PI, sweep: 1.15, speed: 0.85 },
        { baseAngle: 0, sweep: 1.15, speed: 0.8 },
        { baseAngle: -Math.PI / 2, sweep: 1.15, speed: 0.75 },
      ],
      map: [
        '################################',
        '#x..o...B......,...c..B....o...#',
        '#......B......,......B.........#',
        '#..o...B....B........B....o....#',
        '#......B....B....*...B.........#',
        '#..#####....B........#####.....#',
        '#..#...#............#...#......#',
        '#..#.a....B......B....v.#......#',
        '#c.#...#............#...#....c.#',
        '#..#####............#####......#',
        '#c........,.....,............c.#',
        '#..B....B......o......B....B...#',
        '#..B....B.............B....B...#',
        '#....o.......,..c.....o........#',
        '#..............................#',
        '#..J.....................J.....#',
        '#.........E..............c.....#',
        '################################',
      ]
    },
    {
      name: 'The Royal Collection',
      sub: 'Level 11 — eight guards among the kings',
      brief: 'Statues of kings on every side and eight guards between you and the Star.',
      guards: [
        { waypoints: [[8, 10], [23, 10]], pause: 0.7 },
        { waypoints: [[16, 6], [16, 13]], pause: 0.6 },
        { waypoints: [[4, 13], [27, 13]], pause: 0.5 },
        { waypoints: [[4, 14], [27, 14]], pause: 0.8 },
        { waypoints: [[10, 6], [21, 6]], pause: 0.7 },
        { waypoints: [[10, 2], [20, 2]], pause: 0.9 },
        { waypoints: [[12, 7], [12, 13]], pause: 0.6 },
        { waypoints: [[18, 7], [18, 13]], pause: 0.6 },
      ],
      cameras: [
        { baseAngle: Math.PI / 2, sweep: 1.25, speed: 1.05 },
        { baseAngle: 0, sweep: 1.25, speed: 1.0 },
        { baseAngle: Math.PI, sweep: 1.15, speed: 0.95 },
        { baseAngle: 0, sweep: 1.15, speed: 0.9 },
        { baseAngle: Math.PI, sweep: 1.15, speed: 0.85 },
        { baseAngle: 0, sweep: 1.15, speed: 0.8 },
        { baseAngle: -Math.PI / 2, sweep: 1.15, speed: 0.75 },
      ],
      map: [
        '################################',
        '#x..o...S......,...c..S....o...#',
        '#......S......,......S.........#',
        '#..S.S...S..S......S..S.S...o..#',
        '#......S....S....*...S.........#',
        '#..S.S...S..S......S..S.S......#',
        '#..............................#',
        '#..#.a....S......S....v.#......#',
        '#c.#...#............#...#....c.#',
        '#..#####............#####......#',
        '#c........,.....,............c.#',
        '#..S....S......o......S....S...#',
        '#..S....S.............S....S...#',
        '#....o.......,..c.....o........#',
        '#..............................#',
        '#..J.....................J.....#',
        '#.........E..............c.....#',
        '################################',
      ]
    },
    {
      name: 'The Grand Vault',
      sub: 'Level 12 — eight guards, eight cameras, one vault',
      brief: 'The Grand Vault. Eight guards, eight cameras, no gaps. Ghost it or not at all.',
      guards: [
        { waypoints: [[8, 2], [20, 2]], pause: 0.4 },
        { waypoints: [[5, 13], [26, 13]], pause: 0.4 },
        { waypoints: [[11, 9], [18, 9]], pause: 0.5 },
        { waypoints: [[11, 10], [18, 10]], pause: 0.5 },
        { waypoints: [[11, 11], [18, 11]], pause: 0.5 },
        { waypoints: [[4, 14], [14, 14]], pause: 0.6 },
        { waypoints: [[18, 14], [26, 14]], pause: 0.6 },
        { waypoints: [[18, 3], [24, 3]], pause: 0.5 },
      ],
      cameras: [
        { baseAngle: Math.PI / 2, sweep: 1.3, speed: 1.2 },
        { baseAngle: Math.PI / 2, sweep: 1.3, speed: 1.15 },
        { baseAngle: 0, sweep: 1.3, speed: 1.1 },
        { baseAngle: Math.PI, sweep: 1.3, speed: 1.05 },
        { baseAngle: 0, sweep: 1.2, speed: 1.0 },
        { baseAngle: Math.PI, sweep: 1.2, speed: 0.95 },
        { baseAngle: -Math.PI / 2, sweep: 1.2, speed: 0.9 },
        { baseAngle: -Math.PI / 2, sweep: 1.2, speed: 0.85 },
      ],
      map: [
        '################################',
        '#x..o...T......,...c..T....o...#',
        '#......T......,..c...T.........#',
        '#..####.........P........####..#',
        '#..#..#..S.....P.....S..#..#...#',
        '#..#.a...S.....*.....S...v.#...#',
        '#..#..#..S.....P.....S..#..#...#',
        '#..####.........P........####..#',
        '#c...,....##########....,...c..#',
        '#.........#........#...........#',
        '#..P......#.o..o...#......P....#',
        '#..P......#........#......P....#',
        '#....o....####.#####....o......#',
        '#c.......,.........,.........c.#',
        '#..T...........P...c.......T...#',
        '#..J....o......P......o....J...#',
        '#.........E..............c.....#',
        '################################',
      ]
    },
  ];

  window.AURUM_CONFIG = {
    TILE: TILE, COLS: COLS, ROWS: ROWS, VIEW_W: VIEW_W, VIEW_H: VIEW_H,
    WALK_SPEED: WALK_SPEED, SNEAK_SPEED: SNEAK_SPEED,
    GUARD_SPEED: GUARD_SPEED, CHASE_SPEED: CHASE_SPEED,
    GUARD_VIEW_RANGE: GUARD_VIEW_RANGE,
    GUARD_VIEW_HALF_ANGLE: GUARD_VIEW_HALF_ANGLE,
    CAMERA_VIEW_RANGE: CAMERA_VIEW_RANGE,
    CAMERA_VIEW_HALF_ANGLE: CAMERA_VIEW_HALF_ANGLE,
    CAMERA_DISABLE_SECONDS: CAMERA_DISABLE_SECONDS,
    JUNCTION_USES_PER_LEVEL: JUNCTION_USES_PER_LEVEL,
    ALARM_CAMERA_RATE: ALARM_CAMERA_RATE,
    ALARM_GUARD_SPOT: ALARM_GUARD_SPOT,
    ALARM_DECAY: ALARM_DECAY,
    ALARM_LOCKDOWN: ALARM_LOCKDOWN,
    DETECT_BASE_RATE: DETECT_BASE_RATE,
    DETECT_DECAY: DETECT_DECAY,
    NERVES_PER_LEVEL: NERVES_PER_LEVEL,
    SCORE_COIN: SCORE_COIN, SCORE_VASE: SCORE_VASE,
    SCORE_PAINTING: SCORE_PAINTING, SCORE_STAR: SCORE_STAR,
    SCORE_GHOST: SCORE_GHOST, SCORE_SHADOW: SCORE_SHADOW,
    COLORS: COLORS,
    LEVELS: LEVELS
  };
})();
