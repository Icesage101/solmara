// missions.js — Mara Voss's story: five jobs for the people of Solmara,
// each a briefing, a chain of stages, a marker on the map and a cash
// reward. One job: run the mission state machine. Driving, fighting and
// the law live in their own files; this file only says what to do next.

import { commitCrime } from './police.js';
import { makeCar } from './vehicles.js';
import { makePed } from './pedestrians.js';
import { sfx } from './audio.js';

export function missionDefs(world) {
  const P = world.places;
  return [
    {
      id: 'fare', title: 'First Fare', giver: 'Old Rosa', reward: 200,
      brief: 'Rosa runs the Sunspill Diner in the Marina. Her nephew is stranded at the Old Town garage and the buses are on strike. Pick him up and bring him home before his shift starts.',
      stages: [
        { type: 'driveTo', x: P.garage.x, y: P.garage.y, label: 'Pick up Rosa\'s nephew at the Old Town garage', time: 150 },
        { type: 'driveTo', x: P.diner.x, y: P.diner.y, label: 'Drop him at the Sunspill Diner in the Marina', time: 150 },
      ],
    },
    {
      id: 'wheels', title: 'Borrowed Wheels', giver: 'Dex', reward: 350,
      brief: 'Dex the fixer needs a Vireo GT, the red one parked by the Hills lookout, and he needs it quiet. Take the car, shake any heat, and park it at Mara\'s safehouse.',
      stages: [
        { type: 'steal', x: P.lookout.x, y: P.lookout.y, carType: 'sports', label: 'Steal the Vireo GT at the Hills lookout' },
        { type: 'escape', x: P.safehouse.x, y: P.safehouse.y, label: 'Lose the heat and park at the safehouse', needCalm: true },
      ],
    },
    {
      id: 'harbor', title: 'Harbor Run', giver: 'Captain Ibe', reward: 450,
      brief: 'A crate of medicine has to cross the city from Pier 9 to the Hills clinic, and the tide clock is running. Drive it fast, drive it whole, and do not stop for anyone.',
      stages: [
        { type: 'driveTo', x: P.dock.x, y: P.dock.y, label: 'Collect the crate at Pier 9 in the Harbor', time: 120 },
        { type: 'driveTo', x: P.lookout.x, y: P.lookout.y, label: 'Deliver to the Hills clinic, fast', time: 110 },
      ],
    },
    {
      id: 'informant', title: 'The Informant', giver: 'Dex', reward: 550,
      brief: 'A police informant named Sal is selling names at the Old Town plaza. Follow him on foot, keep your distance, and when he meets his handler, make sure Sal never talks again.',
      stages: [
        { type: 'walkTo', x: P.garage.x + 260, y: P.garage.y + 200, label: 'Find Sal near the Old Town plaza' },
        { type: 'fight', x: P.garage.x + 300, y: P.garage.y + 240, label: 'Silence Sal the informant' },
      ],
    },
    {
      id: 'getaway', title: 'Sunset Getaway', giver: 'Mara herself', reward: 800,
      brief: 'One last score. The Marina bank job went loud and every cruiser in Solmara is awake. Three stars, one car, one safehouse. Drive like the sun is going down on all of it.',
      stages: [
        { type: 'escape', x: P.safehouse.x, y: P.safehouse.y, label: 'Reach the safehouse with the city watching', stars: 3 },
      ],
    },
  ];
}

export function startMission(G, def) {
  G.mission = {
    def, stage: 0, state: 'run', timer: def.stages[0].time || 0,
    targetCar: null, targetPed: null,
  };
  G.banner = { title: def.title, text: def.brief, until: G.time + 6 };
  setupStage(G);
  sfx('win');
}

function setupStage(G) {
  const m = G.mission;
  const stage = m.def.stages[m.stage];
  m.timer = stage.time || 0;
  m.targetCar = null;
  m.targetPed = null;
  if (stage.type === 'steal') {
    const car = makeCar(stage.carType, stage.x + 30, stage.y + 10, 0, 'target', G.rng);
    car.color = '#d8443c';
    G.cars.push(car);
    m.targetCar = car;
  }
  if (stage.type === 'fight') {
    const ped = makePed(stage.x, stage.y, G.rng, 'target');
    ped.hp = 90;
    ped.state = 'fight';
    G.peds.push(ped);
    m.targetPed = ped;
  }
  if (stage.type === 'escape' && stage.stars) {
    G.wanted.stars = Math.max(G.wanted.stars, stage.stars);
    commitCrime(G, 0.5, G.player.x, G.player.y);
  }
  G.objective = stage.label;
}

function completeMission(G) {
  const m = G.mission;
  G.player.cash += m.def.reward;
  G.progress.done = Math.max(G.progress.done, G.progress.unlocked);
  G.progress.unlocked = Math.min(5, G.progress.unlocked + 1);
  G.banner = { title: 'Mission complete', text: `${m.def.title} — $${m.def.reward} earned.`, until: G.time + 5 };
  G.objective = '';
  G.mission = null;
  sfx('cash');
  G.saveGame();
}

function failMission(G, why) {
  G.banner = { title: 'Mission failed', text: why, until: G.time + 5 };
  G.objective = '';
  G.mission = null;
  sfx('fail');
}

export function updateMission(G, dt) {
  const m = G.mission;
  if (!m) return;
  const stage = m.def.stages[m.stage];
  if (stage.time) {
    m.timer -= dt;
    if (m.timer <= 0) return failMission(G, 'Out of time. The job is off.');
  }
  const d = Math.hypot(G.player.x - stage.x, G.player.y - stage.y);
  let done = false;
  if (stage.type === 'driveTo') done = d < 62 && !!G.player.car;
  else if (stage.type === 'walkTo') done = d < 46 && !G.player.car;
  else if (stage.type === 'steal') done = G.player.car === m.targetCar;
  else if (stage.type === 'fight') {
    const ped = m.targetPed;
    if (ped) {
      // Sal fights back: he closes in and swings at Mara.
      const pd = Math.hypot(ped.x - G.player.x, ped.y - G.player.y);
      if (pd > 24) {
        ped.angle = Math.atan2(G.player.y - ped.y, G.player.x - ped.x);
        ped.x += Math.cos(ped.angle) * 120 * dt;
        ped.y += Math.sin(ped.angle) * 120 * dt;
      } else if (G.time - (ped.lastSwing || 0) > 0.9) {
        ped.lastSwing = G.time;
        G.player.hp -= 7;
        G.player.lastHurt = G.time;
        if (G.player.hp <= 0) G.mode = 'wasted';
      }
      done = ped.state === 'down';
    }
  } else if (stage.type === 'escape') {
    done = d < 70 && (!stage.needCalm || G.wanted.stars < 0.6);
  }
  if (stage.type === 'steal' && m.targetCar && m.targetCar.role === 'gone') {
    return failMission(G, 'The car is wrecked. Dex is not pleased.');
  }
  if (!done) return;
  m.stage += 1;
  if (m.stage >= m.def.stages.length) completeMission(G);
  else {
    setupStage(G);
    sfx('door');
  }
}

// Where the current stage wants the player, for the minimap and the
// on-screen marker. Null when no mission is running.
export function missionMarker(G) {
  if (!G.mission) return null;
  const stage = G.mission.def.stages[G.mission.stage];
  return { x: stage.x, y: stage.y, label: stage.label };
}
