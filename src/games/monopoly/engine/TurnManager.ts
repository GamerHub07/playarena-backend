import { MonopolyGameState } from "../types/monopoly.types";

export function advanceTurn(
  state: MonopolyGameState,
  orderedPlayers: string[]
) {
  let next = state.currentTurnIndex;

  do {
    next = (next + 1) % orderedPlayers.length;
  } while (state.playerState[orderedPlayers[next]].bankrupt);

  state.currentTurnIndex = next;
  state.phase = "ROLL";
  state.dice = null;
  state.doublesCount = 0; // Reset doubles count on turn change
}
