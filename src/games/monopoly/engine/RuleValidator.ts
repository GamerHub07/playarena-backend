import { MonopolyGameState } from "../types/monopoly.types";

export function assertPlayersTurn(
  playerId: string,
  state: MonopolyGameState,
  orderedPlayers: string[]
) {
  const expected = orderedPlayers[state.currentTurnIndex];
  if (expected !== playerId) {
    throw new Error("Not your turn");
  }
}
