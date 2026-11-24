// Missions: Mara's five jobs across Solmara. Each mission is a small state machine
// with stages, a live objective line, a map marker and a cash reward. Finishing
// one unlocks the next and saves the game.
import { MISSIONS, SAFEHOUSE } from './config.js';
import { makeCar } from './vehicles.js';

export function createMissions() {
  return {
    active: null, // { def, stage, timer, checkpoint, targetCar, thugsLeft, done }
    completed: [false, false, false, false, false],
    selected: 0,
  };
}

export function startMission(state, index) {
  const def = MISSIONS[index];
  if (!def) return false;
  if (state.missions.completed[index]) {
    state.message('That job is already done.', 2);
    return false;
  }
  const m = { def, stage: 0, timer: def.timeLimit || 0, checkpoint: 0, targetCar: null, thugsLeft: 0, started: true };
  if (def.id === 2) {
    const car = makeCar('sports', def.carSpot.x, def.carSpot.y, Math.PI / 2, '#e6b800', true);
    car.target = true;
    state.cars.push(car);
    m.targetCar = car;
  }
  if (def.id === 5) {
    state.police.stars = 3;
    state.police.decayTimer = 9;
  }
  state.missions.active = m;
  state.message(def.name + ': ' + def.brief, 5);
  state.audio.pickup();
  return true;
}

function near(state, x, y, r) {
  return Math.hypot(state.player.x - x, state.player.y - y) < r;
}

function completeMission(state) {
  const m = state.missions.active;
  const reward = m.def.reward;
  state.player.cash += reward;
  state.missions.completed[m.def.id - 1] = true;
  state.missions.active = null;
  state.message('Job done! +$' + reward, 4);
  state.audio.missionDone();
  state.saveGame();
}

function failMission(state, reason) {
  state.missions.active = null;
  state.message('Job failed: ' + reason, 4);
  state.audio.missionFail();
}

export function missionObjective(state) {
  const m = state.missions.active;
  if (!m) return null;
  const def = m.def;
  if (def.id === 1) return m.stage === 0 ? 'Pick up the parcel: ' + def.pickup.label : 'Deliver to: ' + def.dropoff.label;
  if (def.id === 2) {
    if (m.stage === 0) return 'Steal the gold Comet in the Hills';
    return 'Lose the heat: get to 0 stars';
  }
  if (def.id === 3) return 'Checkpoint ' + (m.checkpoint + 1) + ' of 3: ' + def.checkpoints[m.checkpoint].label + '  (' + Math.ceil(m.timer) + 's)';
  if (def.id === 4) {
    if (m.stage === 0) return 'Meet the informant at Solmara Plaza';
    return 'Deal with the crew (' + m.thugsLeft + ' left)';
  }
  if (def.id === 5) return 'Reach the Marina safehouse, alive';
  return def.name;
}

export function missionMarker(state) {
  const m = state.missions.active;
  if (!m) return null;
  const def = m.def;
  if (def.id === 1) return m.stage === 0 ? def.pickup : def.dropoff;
  if (def.id === 2) return m.stage === 0 ? def.carSpot : SAFEHOUSE;
  if (def.id === 3) return def.checkpoints[m.checkpoint];
  if (def.id === 4) return def.meet;
  if (def.id === 5) return def.safehouse;
  return null;
}

export function updateMissions(state, dt) {
  const m = state.missions.active;
  if (!m) return;
  const def = m.def;

  if (def.id === 1) {
    if (m.stage === 0 && near(state, def.pickup.x, def.pickup.y, 70)) {
      m.stage = 1;
      state.message('Parcel picked up. Take it to the Harbor Gate.', 3);
      state.audio.pickup();
    } else if (m.stage === 1 && near(state, def.dropoff.x, def.dropoff.y, 80)) {
      completeMission(state);
    }
  } else if (def.id === 2) {
    if (m.stage === 0) {
      const car = m.targetCar;
      if (car && state.player.inCar && state.car === car) {
        m.stage = 1;
        state.police.stars = Math.max(state.police.stars, 2);
        state.message('That is grand theft, Mara. Lose the cops.', 3);
      }
    } else if (state.police.stars === 0) {
      completeMission(state);
    }
  } else if (def.id === 3) {
    m.timer -= dt;
    const cp = def.checkpoints[m.checkpoint];
    if (near(state, cp.x, cp.y, 90)) {
      m.checkpoint += 1;
      state.audio.pickup();
      if (m.checkpoint >= def.checkpoints.length) {
        completeMission(state);
        return;
      }
      state.message('Checkpoint! Next: ' + def.checkpoints[m.checkpoint].label, 2.5);
    }
    if (m.timer <= 0) failMission(state, 'out of time');
  } else if (def.id === 4) {
    if (m.stage === 0 && near(state, def.meet.x, def.meet.y, 70)) {
      m.stage = 1;
      state.message('The informant is here. His crew is coming. Fight!', 3.5);
      // Two thugs from the crew step out of the crowd.
      const rng = state.rng;
      for (let i = 0; i < 2; i += 1) {
        const x = def.meet.x + (i === 0 ? 90 : -90);
        const y = def.meet.y + (i === 0 ? 60 : -60);
        const thug = {
          x, y, angle: 0, speed: 150, state: 'fight', shirt: '#3a3a3a', skin: '#c98d5f', hair: '#111111',
          targetX: x, targetY: y, wait: 0, panic: 0, health: 70, thug: true, attackCooldown: 0,
        };
        state.peds.push(thug);
        m.thugsLeft += 1;
      }
    } else if (m.stage === 1) {
      const alive = state.peds.filter((p) => p.thug && p.state !== 'down').length;
      m.thugsLeft = alive;
      if (alive === 0) completeMission(state);
    }
  } else if (def.id === 5) {
    if (near(state, def.safehouse.x, def.safehouse.y, 120)) {
      state.police.stars = 0;
      state.police.cruisers = [];
      state.police.footCops = [];
      completeMission(state);
    }
  }
}
