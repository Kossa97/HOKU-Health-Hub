var HokuAuge = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/features/dot/engine/auge.ts
  var auge_exports = {};
  __export(auge_exports, {
    HOER_RING: () => HOER_RING,
    IRIS_ANTEIL: () => IRIS_ANTEIL,
    PUPILLE: () => PUPILLE,
    PUPILLE_HOEREN: () => PUPILLE_HOEREN,
    WEG: () => WEG,
    augePunkt: () => augePunkt,
    augeSchritt: () => augeSchritt,
    blickZu: () => blickZu,
    blinzle: () => blinzle,
    lidStand: () => lidStand,
    neuesAuge: () => neuesAuge
  });

  // src/features/dot/engine/geometry.ts
  var clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  var clamp01 = (x) => clamp(x, 0, 1);
  var TAU = Math.PI * 2;

  // src/features/dot/engine/auge.ts
  var PUPILLE = 0.4;
  var PUPILLE_HOEREN = 1.22;
  var HOER_RING = { abstand: 1.32, puls: 0.16, heb: 1.15 };
  var IRIS_ANTEIL = 0.1;
  function neuesAuge() {
    return {
      gx: 0,
      gy: 0,
      yaw: 0,
      pitch: 0,
      vyaw: 0,
      vpitch: 0,
      sx: 0,
      sy: 0,
      naechsterBlick: 1.5,
      lidP: 0,
      blinzelAb: -1,
      zweites: -1,
      naechstesBlinzeln: 2.5,
      weit: 0,
      offen: 0,
      hoer: 0,
      irisW: 0,
      t: 0,
      G: [0, 0, 1],
      rx: [1, 0, 0],
      uy: [0, 1, 0],
      rp: PUPILLE,
      lidKante: -PUPILLE,
      stimme: 0
    };
  }
  function lidStand(tb) {
    if (tb < 0) return 0;
    if (tb < 0.09) {
      const x = tb / 0.09;
      return x * x;
    }
    if (tb < 0.14) return 1;
    if (tb < 0.31) {
      const x = (tb - 0.14) / 0.17;
      return Math.pow(1 - x, 3);
    }
    return 0;
  }
  var WEG = { yaw: 2.45, pitch: 0.3 };
  var feder = (x, v, ziel, k, zeta, dt) => {
    v += (k * (ziel - x) - 2 * Math.sqrt(k) * zeta * v) * dt;
    return [x + v * dt, v];
  };
  function blinzle(a, doppelt = false) {
    if (a.blinzelAb >= 0) return;
    a.blinzelAb = a.t;
    a.zweites = doppelt ? a.t + 0.36 : -1;
  }
  function augeSchritt(a, dt, e) {
    const zufall = e.zufall ?? Math.random;
    dt = Math.min(dt, 0.05);
    a.t += dt;
    if (e.ziel) {
      a.sx = e.ziel.gx;
      a.sy = e.ziel.gy;
      a.naechsterBlick = a.t + 1.2 + zufall() * 1.5;
    } else if (!e.weniger && a.t > a.naechsterBlick) {
      a.sx = (zufall() * 2 - 1) * 0.42;
      a.sy = (zufall() * 2 - 1) * 0.3;
      a.naechsterBlick = a.t + 1.1 + zufall() * 2.4;
    }
    if (e.weniger) {
      a.sx = e.ziel ? e.ziel.gx : 0;
      a.sy = e.ziel ? e.ziel.gy : 0;
    }
    const kb = e.weniger ? 1 : 1 - Math.exp(-dt * 12);
    a.gx += (a.sx - a.gx) * kb;
    a.gy += (a.sy - a.gy) * kb;
    const weg = e.weg ? Math.sign(e.weg) : 0;
    const yawZiel = weg ? weg * WEG.yaw : Math.asin(Math.max(-0.62, Math.min(0.62, a.gx)));
    const pitchZiel = weg ? WEG.pitch : -Math.asin(Math.max(-0.5, Math.min(0.5, a.gy)));
    if (e.weniger) {
      a.yaw = yawZiel;
      a.pitch = pitchZiel;
      a.vyaw = a.vpitch = 0;
    } else {
      const gross = e.gross || weg !== 0 || Math.abs(a.yaw) > 1;
      const k = gross ? 46 : 70, z = gross ? 0.72 : 1;
      [a.yaw, a.vyaw] = feder(a.yaw, a.vyaw, yawZiel, k, z, dt);
      [a.pitch, a.vpitch] = feder(a.pitch, a.vpitch, pitchZiel, k, z, dt);
    }
    if (!e.weniger && a.blinzelAb < 0 && a.t > a.naechstesBlinzeln && a.offen > 0.9) blinzle(a, zufall() < 0.22);
    if (a.blinzelAb >= 0) {
      let tb = a.t - a.blinzelAb;
      if (a.zweites > 0 && a.t >= a.zweites) {
        a.blinzelAb = a.zweites;
        a.zweites = -1;
        tb = 0;
      }
      a.lidP = e.weniger ? 0 : lidStand(tb);
      if (tb > 0.31 && a.zweites < 0) {
        a.blinzelAb = -1;
        a.lidP = 0;
        a.weit = 1;
        a.naechstesBlinzeln = a.t + 2.6 + zufall() * 3.6;
      }
    }
    a.weit *= Math.exp(-dt * 2.5);
    const offenZiel = e.sichtbar ? 1 : 0;
    a.offen += (offenZiel - a.offen) * (e.weniger ? 1 : 1 - Math.exp(-dt * (offenZiel > a.offen ? 7 : 22)));
    a.hoer += ((e.hoert ? 1 : 0) - a.hoer) * (e.weniger ? 1 : 1 - Math.exp(-dt * 4));
    a.stimme = e.hoert ? clamp01(e.stimme) : 0;
    if (!e.weniger) a.irisW += dt * (0.5 + 2.6 * a.stimme);
    const cp = Math.cos(a.pitch), sp = Math.sin(a.pitch), cy = Math.cos(a.yaw), sy = Math.sin(a.yaw);
    const G = a.G;
    G[0] = cp * sy;
    G[1] = -sp;
    G[2] = cp * cy;
    const rl = Math.hypot(G[2], G[0]) || 1;
    a.rx[0] = G[2] / rl;
    a.rx[1] = 0;
    a.rx[2] = -G[0] / rl;
    let ux = G[1] * a.rx[2] - G[2] * a.rx[1], uyy = G[2] * a.rx[0] - G[0] * a.rx[2], uz = G[0] * a.rx[1] - G[1] * a.rx[0];
    if (uyy < 0) {
      ux = -ux;
      uyy = -uyy;
      uz = -uz;
    }
    a.uy[0] = ux;
    a.uy[1] = uyy;
    a.uy[2] = uz;
    a.rp = PUPILLE * (1 + 0.1 * a.weit) * (1 + (PUPILLE_HOEREN - 1) * a.hoer);
    const lid = Math.max(a.lidP, 1 - a.offen);
    a.lidKante = -a.rp * 1.08 + 2.16 * a.rp * lid;
  }
  function augePunkt(a, x, y, z, iris, i, aus) {
    aus[0] = x;
    aus[1] = y;
    aus[2] = 1;
    aus[3] = 1;
    aus[4] = z;
    const offen = a.offen;
    if (offen < 5e-3) return;
    const G = a.G, rx = a.rx, uy = a.uy, rp = a.rp;
    const dd = x * G[0] + y * G[1] + z * G[2];
    const pa = x * rx[0] + z * rx[2], pb = x * uy[0] + y * uy[1] + z * uy[2];
    const kante = a.lidKante - 1.1 * pa * pa;
    const bedeckt = pb < kante;
    if (dd <= 0.5) {
      const vorn = clamp01(G[2] * 5);
      if (z < 0 && vorn > 0) {
        const tief = Math.sqrt(Math.max(0, 1 - rp * rp)), dx = x - G[0] * tief, dy = y - G[1] * tief;
        const det = rx[0] * uy[1] - rx[1] * uy[0];
        if (Math.abs(det) > 1e-3) {
          const u = (dx * uy[1] - dy * uy[0]) / det, v = (rx[0] * dy - rx[1] * dx) / det;
          if (v >= a.lidKante - 1.1 * u * u) aus[2] = 1 - 0.97 * (1 - glatt(rp * 0.85, rp * 1.05, Math.hypot(u, v))) * offen * vorn;
        }
      }
    } else {
      const r = Math.hypot(pa, pb), aussen = rp * 1.3;
      if (!bedeckt && r < aussen) {
        const q = r / aussen, r2 = rp * (1 + 0.28 * q), schub = (r2 - r) * offen;
        const nx = r > 1e-4 ? pa / r : 1, ny = r > 1e-4 ? pb / r : 0;
        aus[0] += (nx * rx[0] + ny * uy[0]) * schub;
        aus[1] += ny * uy[1] * schub;
        aus[3] = 1 + 0.45 * (1 - q) * offen;
      }
      const lid = Math.max(a.lidP, 1 - offen);
      if (lid > 0.04 && lid < 0.98 && r < aussen) {
        const naehe = 1 - glatt(0, 0.06, Math.abs(pb - kante));
        aus[3] = Math.max(aus[3], 1 + 0.7 * naehe);
      }
    }
    if (iris && a.hoer > 0.01) {
      const st = a.stimme, rho = rp * HOER_RING.abstand * (1 + HOER_RING.puls * st);
      const w = i * 2.399963 + a.irisW, c = Math.cos(w), s = Math.sin(w);
      const tief = Math.sqrt(Math.max(0, 1 - rho * rho)), heb = HOER_RING.heb;
      const ix = (G[0] * tief + rho * (c * rx[0] + s * uy[0])) * heb;
      const iy = (G[1] * tief + rho * s * uy[1]) * heb;
      const iz = (G[2] * tief + rho * (c * rx[2] + s * uy[2])) * heb;
      const unterLid = rho * s < a.lidKante - 1.1 * rho * rho * c * c ? 1 : 0;
      const L = a.hoer * offen;
      aus[0] += (ix - aus[0]) * L;
      aus[1] += (iy - aus[1]) * L;
      aus[4] += (iz - aus[4]) * L;
      aus[2] += (1 - 0.9 * unterLid - aus[2]) * L;
      aus[3] += (1.5 + 0.8 * st - aus[3]) * L;
    }
  }
  function glatt(a, b, x) {
    const t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  }
  function blickZu(hx, hy, r, px, py) {
    const dx = px - hx, dy = py - hy, d = Math.hypot(dx, dy);
    if (d < r * 0.8) return { gx: 0, gy: 0 };
    const s = Math.min(0.62, d / (r * 3.5)) / d;
    return { gx: dx * s, gy: dy * s };
  }
  return __toCommonJS(auge_exports);
})();
