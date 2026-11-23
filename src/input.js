// input.js — keyboard + mouse input for AURUM AFTER DARK.
// WASD/arrows move, Shift sneaks, E interacts, P/Esc pauses, R restarts, M mutes.

(function () {
  'use strict';

  function createInput(canvas) {
    var keys = {};
    var pressed = {}; // edge-triggered keys, consumed once per frame
    var mouse = { x: 0, y: 0, clicked: false, clickX: 0, clickY: 0 };

    function keyName(e) {
      var k = e.key;
      if (k === ' ') return 'space';
      return k.length === 1 ? k.toLowerCase() : k.toLowerCase();
    }

    window.addEventListener('keydown', function (e) {
      var k = keyName(e);
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'space'].indexOf(k) !== -1) {
        e.preventDefault();
      }
      if (!keys[k]) pressed[k] = true;
      keys[k] = true;
    });
    window.addEventListener('keyup', function (e) {
      keys[e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase()] = false;
    });
    window.addEventListener('blur', function () { keys = {}; });

    canvas.addEventListener('mousemove', function (e) {
      var r = canvas.getBoundingClientRect();
      mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
      mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
    });
    canvas.addEventListener('click', function (e) {
      var r = canvas.getBoundingClientRect();
      mouse.clickX = (e.clientX - r.left) * (canvas.width / r.width);
      mouse.clickY = (e.clientY - r.top) * (canvas.height / r.height);
      mouse.clicked = true;
    });

    function axis() {
      var x = 0, y = 0;
      if (keys['a'] || keys['arrowleft']) x -= 1;
      if (keys['d'] || keys['arrowright']) x += 1;
      if (keys['w'] || keys['arrowup']) y -= 1;
      if (keys['s'] || keys['arrowdown']) y += 1;
      if (x !== 0 && y !== 0) { x *= 0.7071; y *= 0.7071; }
      return { x: x, y: y };
    }

    return {
      keys: keys,
      mouse: mouse,
      axis: axis,
      isSneaking: function () { return !!(keys['shift']); },
      wasPressed: function (k) { return !!pressed[k]; },
      consumeClick: function () {
        if (!mouse.clicked) return null;
        mouse.clicked = false;
        return { x: mouse.clickX, y: mouse.clickY };
      },
      endFrame: function () { pressed = {}; }
    };
  }

  window.AURUM_INPUT = { createInput: createInput };
})();
