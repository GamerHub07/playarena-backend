import { MonopolyGameState, MonopolyPlayerState } from "../types/monopoly.types";
import { Card, CardAction, CHANCE_CARDS, COMMUNITY_CHEST_CARDS, JAIL_INDEX } from "../data/cards";
import { logCardCollect, logCardPay, logCardTransfer, logPassGo } from "./GameLogger";


// Shuffled card decks (in memory per game)
let chanceIndex = 0;
let communityChestIndex = 0;
let shuffledChance: Card[] = [];
let shuffledCommunityChest: Card[] = [];

/**
 * Shuffle an array using Fisher-Yates algorithm
 */
function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Initialize card decks (call at game start)
 */
export function initializeCards(): void {
  shuffledChance = shuffle(CHANCE_CARDS);
  shuffledCommunityChest = shuffle(COMMUNITY_CHEST_CARDS);
  chanceIndex = 0;
  communityChestIndex = 0;
}

/**
 * Draw a Chance card
 */
export function drawChanceCard(): Card {
  if (shuffledChance.length === 0) {
    shuffledChance = shuffle(CHANCE_CARDS);
    chanceIndex = 0;
  }
  const card = shuffledChance[chanceIndex];
  chanceIndex = (chanceIndex + 1) % shuffledChance.length;
  return card;
}

/**
 * Draw a Community Chest card
 */
export function drawCommunityChestCard(): Card {
  if (shuffledCommunityChest.length === 0) {
    shuffledCommunityChest = shuffle(COMMUNITY_CHEST_CARDS);
    communityChestIndex = 0;
  }
  const card = shuffledCommunityChest[communityChestIndex];
  communityChestIndex = (communityChestIndex + 1) % shuffledCommunityChest.length;
  return card;
}

/**
 * Execute a card action
 */
export function executeCard(
  state: MonopolyGameState,
  playerId: string,
  card: Card,
  orderedPlayers: string[]
): void {
  const player = state.playerState[playerId];
  const action = card.action;

  // Store drawn card for frontend to display
  state.lastCard = { id: card.id, text: card.text };

  switch (action.type) {
    case "COLLECT":
      player.cash += action.amount;
      logCardCollect(state, playerId, action.amount, card.text);
      break;

    case "PAY":
      player.cash -= action.amount;
      logCardPay(state, playerId, action.amount, card.text);
      // Check bankruptcy
      if (player.cash < 0) {
        player.bankrupt = true;
        player.cash = 0;
      }
      break;

    case "MOVE_TO": {
      const oldPosition = player.position;
      player.position = action.position;
      // Collect $200 if passing GO (moving forward)
      if (action.position < oldPosition && action.position !== JAIL_INDEX) {
        player.cash += 200;
        logPassGo(state, playerId);
      }
      break;
    }

    case "MOVE_BACK":
      player.position = (player.position - action.spaces + state.board.length) % state.board.length;
      break;

    case "GO_TO_JAIL":
      player.position = JAIL_INDEX;
      player.inJail = true;
      player.jailTurns = 0;
      break;

    case "GET_OUT_OF_JAIL":
      player.hasGetOutOfJailCard = true;
      break;

    case "COLLECT_FROM_EACH":
      for (const pid of orderedPlayers) {
        if (pid !== playerId) {
          const other = state.playerState[pid];
          if (!other.bankrupt) {
            const payment = Math.min(action.amount, other.cash);
            other.cash -= payment;
            player.cash += payment;
            if (payment > 0) {
              logCardTransfer(state, pid, playerId, payment, card.text);
            }
          }
        }
      }
      break;

    case "PAY_EACH":
      for (const pid of orderedPlayers) {
        if (pid !== playerId) {
          const other = state.playerState[pid];
          if (!other.bankrupt) {
            const payment = Math.min(action.amount, player.cash);
            player.cash -= payment;
            other.cash += payment;
            if (payment > 0) {
              logCardTransfer(state, playerId, pid, payment, card.text);
            }
          }
        }
      }
      break;


    case "REPAIRS": {
      // Calculate repair costs based on houses/hotels
      let totalCost = 0;
      for (const square of state.board) {
        if (square.owner === playerId && square.houses) {
          if (square.houses === 5) {
            totalCost += action.perHotel;
          } else {
            totalCost += square.houses * action.perHouse;
          }
        }
      }
      if (totalCost > 0) {
        player.cash -= totalCost;
        logCardPay(state, playerId, totalCost, card.text);
      }
      break;
    }
  }
}
