// Solmara — missions: the five story jobs.
// A mission is a small state machine: a list of steps, each with a marker on the map
// and a line of objective text. The game checks the step's condition every frame; when
// it holds, the step advances, and when the steps run out the job pays. Failing a timed
// job, or dying mid-job, fails the mission and Mara can take it again from the phone.

import { MISSIONS, LANDMARKS, WORLD, dist2 } from './config.js';
import { addWanted, clearWanted } from './police.js';
import { makeCar, spawnParkedCar } from './vehicles.js';
import { makeThug } from './combat.js';

export function missionDef(id) {
  return MISSIONS.find((m) => m.id === id);
}

export function createMissionState() {
  return {
    active: null,
    completed: [],
    failed: null,
  };
}

// Start a job: set up its first step and whatever the step needs in the world (a
// target car, a timer, a crew of thugs). Returns false when the job is already done.
export function startMission(state, id) {
  const def = missionDef(id);
  if (!def) return false;
  if (state.missions.completed.includes(id)) {
    state.toast('That job is already done.');
    return false;
  }
  const m = { id, def, step: 0, timer: 0, targetCar: null, thugsLeft: 0, startedAt: state.time };
  state.missions.active = m;
  state.missions.failed = null;
  if (id === 1) {
    m.marker = { x: LANDMARKS.marinaPier.x, y: LANDMARKS.marinaPier.y, label: 'Pickup: Marina Pier' };
    m.objective = 'Pick up the parcel at Marina Pier';
  } else if (id === 2) {
    const car = spawnParkedCar(state.city, state.rng, 'sports');
    car.x = 1620;
    car.y = 1150;
    car.angle = 0;
    car.color = '#e8c820';
    state.cars.push(car);
    m.targetCar = car;
    m.marker = { x: car.x, y: car.y, label: 'The gold Comet' };
    m.objective = 'Steal the gold Comet by the plaza';
  } else if (id === 3) {
    m.timer = 100;
    m.marker = { x: LANDMARKS.harborDock.x, y: LANDMARKS.harborDock.y, label: 'Harbor Dock 7' };
    m.objective = 'Deliver to Harbor Dock 7 — 100 seconds';
  } else if (id === 4) {
    m.marker = { x: LANDMARKS.plaza.x, y: LANDMARKS.plaza.y, label: 'Solmara Plaza' };
    m.objective = 'Meet the informant at Solmara Plaza';
  } else if (id === 5) {
    addWanted(state, 3, 'The whole city is awake');
    m.marker = { x: LANDMARKS.safehouse.x, y: LANDMARKS.safehouse.y, label: 'Safehouse' };
    m.objective = 'Reach the safehouse, alive';
  }
  state.toast(`Job started: ${def.name} — $${def.pay}`);
  state.audio.missionStart();
  return true;
}

function completeMission(state) {
  const m = state.missions.active;
  if (!m) return;
  state.player.cash += m.def.pay;
  state.missions.completed.push(m.id);
  state.missions.active = null;
  state.missionCompleteAt = state.time;
  state.screen = 'complete';
  state.audio.missionComplete();
  state.toast(`Job done: ${m.def.name} — +$${m.def.pay}`);
}

function failMission(state, reason) {
  const m = state.missions.active;
  if (!m) return;
  state.missions.failed = { id: m.id, reason };
  state.missions.active = null;
  state.screen = 'failed';
  state.audio.missionFail();
}

// Check the active job's current step. Called every frame while a job is running.
export function updateMission(state, dt) {
  const m = state.missions.active;
  if (!m) return;
  const p = state.player;

  if (m.id === 1) {
    if (m.step === 0) {
      if (dist2(p.x, p.y, m.marker.x, m.marker.y) < 70 * 70) {
        m.step = 1;
        m.marker = { x: 1220, y: 640, label: 'Drop-off: Old Town' };
        m.objective = 'Deliver the parcel to Old Town';
        state.toast('Parcel collected. Deliver it to Old Town.');
        state.audio.pickup();
      }
    } else if (dist2(p.x, p.y, m.marker.x, m.marker.y) < 70 * 70) {
      completeMission(state);
    }
  } else if (m.id === 2) {
    if (m.step === 0) {
      if (p.car === m.targetCar) {
        m.step = 1;
        addWanted(state, 1, 'Car reported stolen');
        m.marker = null;
        m.objective = 'Lose the cops — get your wanted level to zero';
        state.toast('It is yours now. Lose the heat.');
      }
    } else if (state.wanted === 0) {
      completeMission(state);
    }
  } else if (m.id === 3) {
    m.timer -= dt;
    m.objective = `Deliver to Harbor Dock 7 — ${Math.max(0, Math.ceil(m.timer))}s left`;
    if (m.timer <= 0) {
      failMission(state, 'The delivery window closed.');
    } else if (dist2(p.x, p.y, m.marker.x, m.marker.y) < 80 * 80) {
      completeMission(state);
    }
  } else if (m.id === 4) {
    if (m.step === 0) {
      if (dist2(p.x, p.y, m.marker.x, m.marker.y) < 90 * 90) {
        m.step = 1;
        m.objective = 'Deal with the crew';
        state.toast('The informant is here. His crew is coming. Fight!');
        state.audio.missionStart();
        const plaza = LANDMARKS.plaza;
        for (let i = 0; i < 3; i += 1) {
          const thug = makeThug(plaza.x + (i - 1) * 70, plaza.y - 60, state.rng);
          state.thugs.push(thug);
        }
        m.thugsLeft = 3;
        m.marker = null;
      }
    } else if (m.thugsLeft <= 0) {
      completeMission(state);
    }
  } else if (m.id === 5) {
    if (dist2(p.x, p.y, m.marker.x, m.marker.y) < 80 * 80) {
      clearWanted(state, 'Safe. The heat is off — for now.');
      completeMission(state);
    }
  }
}

// The phone: the list of jobs Mara can take, with their state.
export function missionList(state) {
  return MISSIONS.map((def) => ({
    def,
    done: state.missions.completed.includes(def.id),
    active: state.missions.active !== null && state.missions.active.id === def.id,
  }));
}
