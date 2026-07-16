const PALETTE = Object.freeze({
  ember: Object.freeze({
    background: "#070b13",
    ally: "#70e5d0",
    hostile: "#ff7f79",
    accent: "#ffb85c",
    domain: "#ab68ff",
    grid: "#3b4c68",
    gridSecondary: "#1b2740"
  }),
  veil: Object.freeze({
    background: "#09101a",
    ally: "#8ee7d8",
    hostile: "#c876ff",
    accent: "#ffe18a",
    domain: "#6d7cff",
    grid: "#41566f",
    gridSecondary: "#1d2b3a"
  }),
  throne: Object.freeze({
    background: "#100b18",
    ally: "#88d7ff",
    hostile: "#ff8a5c",
    accent: "#f6c85f",
    domain: "#ba7cff",
    grid: "#55476e",
    gridSecondary: "#2a1f40"
  })
});

export const BATTLE_PRESENTATIONS = Object.freeze({
  "cinder-span": Object.freeze({
    stageNumber: 1,
    operation: "Operation: Ember Break",
    doctrine: "Open the forge lane, raise shades, then sever the Warden's hold.",
    allyLabel: "Dusk Legion",
    hostileLabel: "Ashbound Ward",
    palette: PALETTE.ember
  }),
  "veil-citadel": Object.freeze({
    operation: "Operation: Veil Breach",
    stageNumber: 2,
    doctrine: "Hold both signal nodes before the Tactician closes the listening routes.",
    allyLabel: "Veil Vanguard",
    hostileLabel: "Citadel Screen",
    palette: PALETTE.veil
  }),
  "echo-throne": Object.freeze({
    operation: "Operation: Thronefall",
    stageNumber: 3,
    doctrine: "Secure the throne node, invoke the Domain, and break the Sovereign's gate.",
    allyLabel: "Thronebound Legion",
    hostileLabel: "Sovereign Guard",
    palette: PALETTE.throne
  })
});

export const DEFAULT_BATTLE_PRESENTATION = BATTLE_PRESENTATIONS["cinder-span"];

export function getBattlePresentation(stageId) {
  return BATTLE_PRESENTATIONS[stageId] ?? DEFAULT_BATTLE_PRESENTATION;
}
