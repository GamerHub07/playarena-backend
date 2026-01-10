import { MonopolyGameState } from "../types/monopoly.types";

/**
 * Check if player is in debt (negative balance)
 * Sets phase to DEBT if player needs to sell properties
 * If player has no properties and is in debt, they go bankrupt
 */
export function checkAndSetDebtPhase(
  state: MonopolyGameState,
  playerId: string,
  nextPhase: "ROLL" | "END_TURN"
): void {
  const player = state.playerState[playerId];

  if (player.cash < 0) {
    if (player.properties.length > 0) {
      // Player has properties to sell - enter DEBT phase
      state.phase = "DEBT";
    } else {
      // No properties to sell - player is bankrupt
      player.cash = 0;
      player.bankrupt = true;
      state.phase = nextPhase;
    }
  } else {
    state.phase = nextPhase;
  }
}

/**
 * Check if player has resolved their debt
 * Call after selling a property
 */
export function isDebtResolved(state: MonopolyGameState, playerId: string): boolean {
  const player = state.playerState[playerId];
  return player.cash >= 0;
}
