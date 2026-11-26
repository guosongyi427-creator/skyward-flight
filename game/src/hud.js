// Skyward Flight — the HUD and the screens. All DOM, no canvas drawing:
// a glass instrument bar (ALT / SPD / HDG / fuel / throttle / score / ring),
// a centre message line, a compass strip, and title / pause / end overlays.
// The HUD is always legible: dark glass panels, big numerals, colour warnings.
import { PALETTE, RINGS } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_COMPLETE = 'complete';

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

export function createHud(root) {
  root.innerHTML = `
    <div id="hud">
      <div class="hud-row">
        <div class="gauge"><span class="label">ALT</span><span id="hud-alt" class="value">0</span><span class="unit">m</span></div>
        <div class="gauge"><span class="label">SPD</span><span id="hud-spd" class="value">0</span><span class="unit">km/h</span></div>
        <div class="gauge"><span class="label">HDG</span><span id="hud-hdg" class="value">180°</span><span class="unit" id="hud-compass">S</span></div>
        <div class="gauge"><span class="label">FUEL</span><span id="hud-fuel" class="value">100</span><span class="unit">%</span><div class="bar"><i id="hud-fuel-bar"></i></div></div>
        <div class="gauge"><span class="label">THR</span><span id="hud-thr" class="value">0</span><span class="unit">%</span><div class="bar"><i id="hud-thr-bar"></i></div></div>
        <div class="gauge"><span class="label">SCORE</span><span id="hud-score" class="value">0</span><span class="unit" id="hud-ring">Ring 0/${RINGS.length}</span></div>
      </div>
      <div id="hud-msg"></div>
      <div id="hud-warn"></div>
      <div id="hud-hint">↑↓ pitch &nbsp; ←→ bank &nbsp; A/D rudder &nbsp; W/S throttle &nbsp; drag mouse to steer &nbsp; P pause</div>
    </div>
    <div id="overlay"></div>`;

  const el = (id) => root.querySelector('#' + id);
  const alt = el('hud-alt'), spd = el('hud-spd'), hdg = el('hud-hdg'), compass = el('hud-compass');
  const fuel = el('hud-fuel'), fuelBar = el('hud-fuel-bar'), thr = el('hud-thr'), thrBar = el('hud-thr-bar');
  const score = el('hud-score'), ring = el('hud-ring'), msg = el('hud-msg'), warn = el('hud-warn');
  const overlay = el('overlay');

  function draw(state, screen, best) {
    // ALT is height above sea level, the number a pilot reads on the altimeter.
    const altitude = Math.max(0, Math.round(state.pos.y));
    alt.textContent = altitude;
    spd.textContent = Math.round(state.speed * 3.6);
    const h = Math.round(state.heading);
    hdg.textContent = String(h).padStart(3, '0') + '°';
    compass.textContent = COMPASS[Math.round(h / 22.5) % 16];
    fuel.textContent = Math.round(state.fuel);
    fuelBar.style.width = state.fuel + '%';
    fuelBar.style.background = state.fuel < 25 ? PALETTE.hudBad : state.fuel < 50 ? PALETTE.hudWarn : '#35e0a1';
    thr.textContent = Math.round(state.throttle * 100);
    thrBar.style.width = (state.throttle * 100) + '%';
    score.textContent = state.score;
    ring.textContent = `Ring ${state.ringsPassed}/${RINGS.length}` + (state.combo > 1 ? ` · combo x${state.combo}` : '');
    msg.textContent = state.time < state.messageUntil ? state.message : '';
    const stalled = state.speed < 26 && state.status === 'flying';
    warn.textContent = state.status === 'crashed' ? 'CRASHED' : stalled ? '⚠ STALL — add throttle, lower the nose' : state.fuel < 25 ? '⚠ LOW FUEL' : '';
    warn.style.color = stalled || state.status === 'crashed' ? PALETTE.hudBad : PALETTE.hudWarn;

    if (screen === SCREEN_TITLE) {
      overlay.className = 'show title';
      overlay.innerHTML = `<div class="panel"><h1>SKYWARD FLIGHT</h1>
        <p class="tag">Ring Run over Green Valley — fly the hoops, then bring her home.</p>
        <p>Fly through all ${RINGS.length} glowing rings in order, then land gently on the runway.
        Watch your fuel, mind the stall speed, and keep the wings level on final.</p>
        <p class="keys">↑ ↓ pitch &nbsp;·&nbsp; ← → bank &nbsp;·&nbsp; A / D rudder<br>W / S throttle &nbsp;·&nbsp; mouse drag steers &nbsp;·&nbsp; P pause &nbsp;·&nbsp; R restart</p>
        <p class="cta">Press SPACE or click to take off</p>
        <p class="best">${best > 0 ? 'Best score: ' + best : 'Free flight is always open — take off and explore.'}</p></div>`;
    } else if (screen === SCREEN_PAUSED) {
      overlay.className = 'show paused';
      overlay.innerHTML = `<div class="panel"><h1>PAUSED</h1><p>Score ${state.score} · Ring ${state.ringsPassed}/${RINGS.length} · Fuel ${Math.round(state.fuel)}%</p><p class="cta">Press P or SPACE to keep flying</p></div>`;
    } else if (screen === SCREEN_OVER) {
      overlay.className = 'show over';
      overlay.innerHTML = `<div class="panel"><h1>${state.status === 'outoffuel' ? 'OUT OF FUEL' : 'CRASHED'}</h1>
        <p>Score ${state.score} · Rings ${state.ringsPassed}/${RINGS.length} · Best combo x${state.bestCombo}</p>
        <p>${state.status === 'crashed' ? 'The valley wins this round. Throttle up early, keep speed above stall, and flare gently.' : 'The tank ran dry. Fly leaner — full throttle drinks fuel.'}</p>
        <p class="cta">Press SPACE or R to fly again</p></div>`;
    } else if (screen === SCREEN_COMPLETE) {
      overlay.className = 'show complete';
      overlay.innerHTML = `<div class="panel"><h1>MISSION COMPLETE ✈</h1>
        <p>All ${RINGS.length} rings cleared and a safe landing on the runway.</p>
        <p>Score ${state.score} · Best combo x${state.bestCombo} · Time ${Math.round(state.time)}s · Hull ${Math.round(state.hull)}%</p>
        <p class="cta">Press SPACE or R to fly it again</p></div>`;
    } else {
      overlay.className = '';
      overlay.innerHTML = '';
    }
  }
  return { draw };
}
