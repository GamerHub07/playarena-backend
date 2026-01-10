import { MonopolyGameState } from "../types/monopoly.types";
import { JAIL_INDEX } from "../data/board";
import { drawChanceCard, drawCommunityChestCard, executeCard } from "./CardResolver";
import { checkAndSetDebtPhase } from "./BalanceResolver";
import { calculateRent, calculateRailroadRent, calculateUtilityRent } from "./RentCalculator";

/**
 * Check if doubles were rolled
 */
function isDoubles(state: MonopolyGameState): boolean {
  return state.dice !== null && state.dice[0] === state.dice[1];
}

/**
 * Determine next phase accounting for doubles
 */
function getNextPhase(state: MonopolyGameState): "ROLL" | "END_TURN" {
  return isDoubles(state) ? "ROLL" : "END_TURN";
}

export function resolveSquare(
  state: MonopolyGameState,
  playerId: string,
  orderedPlayers: string[] = []
) {
  const player = state.playerState[playerId];
  const square = state.board[player.position];

  // Clear any previous card
  state.lastCard = null;

  switch (square.type) {
    case "PROPERTY":
      if (!square.owner) {
        state.phase = "DECISION";
      } else if (square.owner !== playerId) {
        // Calculate rent with monopoly bonus
        const rent = calculateRent(state, square, square.owner);
        player.cash -= rent;
        state.playerState[square.owner].cash += rent;
        checkAndSetDebtPhase(state, playerId, getNextPhase(state));
      } else {
        state.phase = getNextPhase(state);
      }
      break;

    case "RAILROAD":
      if (!square.owner) {
        state.phase = "DECISION";
      } else if (square.owner !== playerId) {
        // Calculate rent based on number of railroads owned
        const rent = calculateRailroadRent(state, square.owner);
        player.cash -= rent;
        state.playerState[square.owner].cash += rent;
        checkAndSetDebtPhase(state, playerId, getNextPhase(state));
      } else {
        state.phase = getNextPhase(state);
      }
      break;

    case "UTILITY":
      if (!square.owner) {
        state.phase = "DECISION";
      } else if (square.owner !== playerId) {
        // Calculate rent based on dice roll and utilities owned
        const rent = calculateUtilityRent(state, square.owner);
        player.cash -= rent;
        state.playerState[square.owner].cash += rent;
        checkAndSetDebtPhase(state, playerId, getNextPhase(state));
      } else {
        state.phase = getNextPhase(state);
      }
      break;

    case "TAX":
      player.cash -= square.amount ?? 0;
      checkAndSetDebtPhase(state, playerId, getNextPhase(state));
      break;

    case "GO_TO_JAIL":
      player.position = JAIL_INDEX;
      player.inJail = true;
      state.phase = "END_TURN";
      break;

    case "CHANCE": {
      const card = drawChanceCard();
      executeCard(state, playerId, card, orderedPlayers);
      
      if (player.inJail) {
        state.phase = "END_TURN";
      } else {
        checkAndSetDebtPhase(state, playerId, getNextPhase(state));
      }
      break;
    }

    case "COMMUNITY_CHEST": {
      const card = drawCommunityChestCard();
      executeCard(state, playerId, card, orderedPlayers);
      
      if (player.inJail) {
        state.phase = "END_TURN";
      } else {
        checkAndSetDebtPhase(state, playerId, getNextPhase(state));
      }
      break;
    }

    case "GO":
    case "JAIL":
    case "FREE_PARKING":
    default:
      state.phase = getNextPhase(state);
  }
}
