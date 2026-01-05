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
  // Set phase to JAIL if the next player is in jail, otherwise ROLL
  const nextPlayer = state.playerState[orderedPlayers[next]];
  state.phase = nextPlayer.inJail ? "JAIL" : "ROLL";
  state.dice = null;
  state.doublesCount = 0; // Reset doubles count on turn change
}
