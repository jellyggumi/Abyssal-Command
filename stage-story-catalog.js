const deepFreeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
};

const eventBinding = (type, fields = {}) => ({ type, ...fields });
const objective = (id, label, type, fields = {}) => ({ id, label, event: eventBinding(type, fields) });
const beat = (id, kind, type, dialogue, fields = {}) => ({
  id,
  kind,
  event: eventBinding(type, fields),
  dialogue,
  cutscene: { id: `story:${id}`, kind },
});

const PROP_BLADE = "assets/mesh/prop/prop-sprite-sheet-single-object.03/glb/base_basic_pbr.glb";
const PROP_RELIC = "assets/mesh/prop/prop-sprite-sheet-single-object.05/glb/base_basic_pbr.glb";

export const STAGE_STORIES = deepFreeze({
  "cinder-span": {
    stageId: "cinder-span",
    title: "사슬 아래의 길",
    quest: {
      id: "cinder-span:unchain-the-descent",
      giverNpcId: "cinder-span:ember-lookout",
      acquisitionDialogue: [
        { speaker: "EMBER LOOKOUT", text: "사슬이 길을 막는다고 생각하나요? 서쪽 불씨를 버티고, 무엇을 붙들고 있는지 직접 보세요." },
        { speaker: "DUSK WARDEN", text: "문을 지키는 사슬인지, 무너지는 길을 붙드는 사슬인지 확인하겠다." },
      ],
      objectives: [
        objective("cross-ember-relay", "불씨 중계로를 사수하라", "ENCOUNTER_OBJECTIVE_COMPLETED", { objectiveId: "cinder-relay-crossing" }),
        objective("hold-drowned-forge", "잠긴 용광로의 압력을 끊어라", "ENCOUNTER_OBJECTIVE_COMPLETED", { objectiveId: "cinder-forge-stand" }),
        objective("reverse-cinder-seal", "재의 봉인을 역전하라", "OCCUPATION_CAPTURED", { occupationPointId: "cinder-seal" }),
        objective("release-the-chains", "Cinder Warden을 쓰러뜨려 사슬의 진실을 밝혀라", "OBJECTIVE_COMPLETED", { objectiveId: "boss-kill" }),
      ],
    },
    extractionReward: { skillId: "rift-bolt", level: 1 },
    appearanceReward: {
      id: "cinder-span-ember-chain",
      slot: "back",
      name: "잔불 사슬",
      modelPath: PROP_RELIC,
      scale: 0.18,
      offset: { x: -0.2, y: 0.08, z: 0.24 },
      yaw: 3.1416,
    },
    storyBeats: [
      beat("cinder-span:acquisition", "questAcquisition", "STAGE_STARTED", { speaker: "EMBER LOOKOUT", text: "서쪽 불씨를 버티고 사슬의 진실을 확인하세요." }, { stageId: "cinder-span" }),
      beat("cinder-span:reversal", "occupationReversal", "OCCUPATION_CAPTURED", { speaker: "CINDER WARDEN", text: "봉인을 풀면 길이 열리는 게 아니다. 네 뒤의 다리가 먼저 무너진다." }, { occupationPointId: "cinder-seal" }),
      beat("cinder-span:boss-entry", "bossEntry", "BOSS_SPAWNED", { speaker: "CINDER WARDEN", text: "등불을 내려라. 네가 찾는 길은 내 사슬 아래서 끝난다." }, { bossId: "s1-cinder-warden" }),
      beat("cinder-span:completion", "questCompletion", "OBJECTIVE_COMPLETED", { speaker: "DUSK WARDEN", text: "그는 문을 지킨 게 아니었다. 문이 올라오지 못하게 묶고 있었다." }, { objectiveId: "boss-kill" }),
    ],
    completionOutcome: {
      id: "cinder-span:retreat-broken",
      text: "사슬이 풀리고 퇴로가 무너졌다. 남은 길은 심연의 성전으로 내려간다.",
    },
  },
  "abyss-chancel": {
    stageId: "abyss-chancel",
    title: "반복되는 답을 거부하라",
    quest: {
      id: "abyss-chancel:refuse-repeated-answer",
      giverNpcId: "abyss-chancel:veil-lookout",
      acquisitionDialogue: [
        { speaker: "VEIL LOOKOUT", text: "등불을 들었군요. 여섯 번째 손이 같은 길을 걷고 있습니다." },
        { speaker: "DUSK WARDEN", text: "내 앞의 손들은 뭘 했지?" },
        { speaker: "VEIL LOOKOUT", text: "모두 거울 속 손이 보여준 서약을 되풀이했습니다. 당신도 그럴 건가요?" },
      ],
      objectives: [
        objective("advance-the-nave", "거울보다 먼저 본당을 돌파하라", "ENCOUNTER_OBJECTIVE_COMPLETED", { objectiveId: "chancel-nave-advance" }),
        objective("lock-the-transept", "교차 회랑의 세 갈래 압력을 끊어라", "ENCOUNTER_OBJECTIVE_COMPLETED", { objectiveId: "chancel-transept-lock" }),
        objective("refuse-the-oath", "거울의 답을 따르지 않고 서약을 점령하라", "OCCUPATION_CAPTURED", { occupationPointId: "chancel-oath" }),
        objective("shatter-classification", "Veil Tactician의 분류를 끝내라", "OBJECTIVE_COMPLETED", { objectiveId: "boss-kill" }),
      ],
    },
    extractionReward: { skillId: "grave-pulse", level: 1 },
    appearanceReward: {
      id: "abyss-chancel-ward",
      slot: "ward",
      name: "서약 거부의 보호구",
      modelPath: PROP_BLADE,
      scale: 0.12,
      offset: { x: 0.18, y: 0.02, z: 0.08 },
      yaw: 1.5708,
    },
    storyBeats: [
      beat("abyss-chancel:acquisition", "questAcquisition", "STAGE_STARTED", { speaker: "VEIL LOOKOUT", text: "거울이 먼저 내놓은 답을 거부하세요." }, { stageId: "abyss-chancel" }),
      beat("abyss-chancel:reversal", "occupationReversal", "OCCUPATION_CAPTURED", { speaker: "VEIL TACTICIAN", text: "그렇다면 왕좌도 너를 분류하지 못하겠군." }, { occupationPointId: "chancel-oath" }),
      beat("abyss-chancel:boss-entry", "bossEntry", "BOSS_SPAWNED", { speaker: "VEIL TACTICIAN", text: "또 같은 등불, 또 같은 서약." }, { bossId: "s2-veil-tactician" }),
      beat("abyss-chancel:completion", "questCompletion", "OBJECTIVE_COMPLETED", { speaker: "VEIL TACTICIAN", text: "거울이 깨져도, 왕좌가 사라지는 것은 아니다." }, { objectiveId: "boss-kill" }),
    ],
    completionOutcome: {
      id: "abyss-chancel:mirror-refused",
      text: "거울은 과거의 등불지기들을 비춘 채 멈췄고, 분류되지 않은 길이 왕좌로 이어졌다.",
    },
  },
  "echo-throne": {
    stageId: "echo-throne",
    title: "왕좌의 명령을 끊어라",
    quest: {
      id: "echo-throne:break-the-command",
      giverNpcId: "echo-throne:throne-lookout",
      acquisitionDialogue: [
        { speaker: "THRONE LOOKOUT", text: "왕좌는 비어 있지만 명령은 아직 회랑을 돌고 있습니다. 돌아오는 메아리보다 먼저 단상에 서세요." },
        { speaker: "DUSK WARDEN", text: "주인이 아니라 명령을 끝내겠다." },
      ],
      objectives: [
        objective("break-the-aisle", "되돌아오는 왕좌 회랑을 돌파하라", "ENCOUNTER_OBJECTIVE_COMPLETED", { objectiveId: "throne-aisle-break" }),
        objective("stand-at-the-dais", "왕좌를 소유하지 않고 단상을 지켜라", "ENCOUNTER_OBJECTIVE_COMPLETED", { objectiveId: "throne-dais-stand" }),
        objective("claim-the-domain", "왕좌 영역의 명령을 역전하라", "OCCUPATION_CAPTURED", { occupationPointId: "throne-domain" }),
        objective("break-the-sovereign-command", "Gate Sovereign의 마지막 명령을 끊어라", "OBJECTIVE_COMPLETED", { objectiveId: "boss-kill" }),
      ],
    },
    extractionReward: { skillId: "void-aegis", level: 1 },
    appearanceReward: {
      id: "echo-throne-crown",
      slot: "head",
      name: "빈 왕좌의 관",
      modelPath: PROP_RELIC,
      scale: 0.1,
      offset: { x: 0, y: 0.03, z: 0.32 },
      yaw: 0,
    },
    storyBeats: [
      beat("echo-throne:acquisition", "questAcquisition", "STAGE_STARTED", { speaker: "THRONE LOOKOUT", text: "빈 왕좌보다 오래 남은 명령을 끊으세요." }, { stageId: "echo-throne" }),
      beat("echo-throne:reversal", "occupationReversal", "OCCUPATION_CAPTURED", { speaker: "GATE SOVEREIGN", text: "단상을 차지해도 왕좌의 명령은 너에게 돌아온다." }, { occupationPointId: "throne-domain" }),
      beat("echo-throne:boss-entry", "bossEntry", "BOSS_SPAWNED", { speaker: "GATE SOVEREIGN", text: "마침내 내가 놓았던 등불을 네가 들고 왔다." }, { bossId: "s3-gate-sovereign" }),
      beat("echo-throne:completion", "questCompletion", "OBJECTIVE_COMPLETED", { speaker: "DUSK WARDEN", text: "왕좌는 비었다. 그런데 명령은 내 등불 안에서 계속된다." }, { objectiveId: "boss-kill" }),
    ],
    completionOutcome: {
      id: "echo-throne:command-severed",
      text: "마지막 등불지기는 해방되었고 왕좌는 비었다. 그러나 끊긴 명령의 메아리는 등불 안에 남았다.",
    },
  },
});

const matchesEvent = (binding, event) => Boolean(binding && event && Object.entries(binding).every(([key, value]) => event[key] === value));

export function stageStoryFor(stageId) {
  return STAGE_STORIES[stageId] ?? null;
}

export function storyBeatForEvent(stageId, event) {
  return stageStoryFor(stageId)?.storyBeats.find((entry) => matchesEvent(entry.event, event)) ?? null;
}

export function questObjectiveForEvent(stageId, event) {
  return stageStoryFor(stageId)?.quest.objectives.find((entry) => matchesEvent(entry.event, event)) ?? null;
}

export function questProgressForEvents(stageId, events) {
  const story = stageStoryFor(stageId);
  if (!story) return null;
  const records = Array.isArray(events) ? events : [];
  const completedObjectiveIds = [];
  let eventIndex = 0;
  for (const entry of story.quest.objectives) {
    const matchedIndex = records.findIndex((event, index) => index >= eventIndex && matchesEvent(entry.event, event));
    if (matchedIndex < 0) break;
    completedObjectiveIds.push(entry.id);
    eventIndex = matchedIndex + 1;
  }
  const completedObjectives = completedObjectiveIds.length;
  const currentObjective = story.quest.objectives[completedObjectives] ?? null;
  return deepFreeze({
    questId: story.quest.id,
    completedObjectiveIds,
    completedObjectives,
    totalObjectives: story.quest.objectives.length,
    currentObjectiveId: currentObjective?.id ?? null,
    completed: completedObjectives === story.quest.objectives.length,
  });
}
