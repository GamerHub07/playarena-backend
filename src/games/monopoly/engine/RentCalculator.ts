import { MonopolyGameState, BoardSquare } from "../types/monopoly.types";

/**
 * Property color groups - number of properties in each group
 */
const COLOR_GROUP_SIZES: Record<string, number> = {
  brown: 2,
  lightBlue: 3,
  pink: 3,
  orange: 3,
  red: 3,
  yellow: 3,
  green: 3,
  blue: 2,
};

/**
 * Check if a player owns a complete monopoly (all properties of a color)
 */
export function hasMonopoly(
  state: MonopolyGameState,
  playerId: string,
  color: string
): boolean {
  if (!color || !COLOR_GROUP_SIZES[color]) return false;
  
  const propertiesOfColor = state.board.filter(
    s => s.type === "PROPERTY" && s.color === color
  );
  
  const ownedCount = propertiesOfColor.filter(
    s => s.owner === playerId
  ).length;
  
  return ownedCount === COLOR_GROUP_SIZES[color];
}

/**
 * Calculate rent for a property
 * - Base rent for unimproved property
 * - Double rent if player has monopoly (all of that color)
 */
export function calculateRent(
  state: MonopolyGameState,
  square: BoardSquare,
  ownerId: string
): number {
  const baseRent = square.rent ?? 0;
  
  // Check for monopoly bonus (double rent)
  if (square.color && hasMonopoly(state, ownerId, square.color)) {
    return baseRent * 2;
  }
  
  return baseRent;
}

/**
 * Calculate railroad rent based on how many railroads owner has
 * 1 RR = $25, 2 RR = $50, 3 RR = $100, 4 RR = $200
 */
export function calculateRailroadRent(
  state: MonopolyGameState,
  ownerId: string
): number {
  const railroads = state.board.filter(
    s => s.type === "RAILROAD" && s.owner === ownerId
  );
  
  const count = railroads.length;
  if (count === 0) return 0;
  
  return 25 * Math.pow(2, count - 1); // 25, 50, 100, 200
}

/**
 * Calculate utility rent based on dice roll and how many utilities owner has
 * 1 utility = 4x dice total, 2 utilities = 10x dice total
 */
export function calculateUtilityRent(
  state: MonopolyGameState,
  ownerId: string
): number {
  const utilities = state.board.filter(
    s => s.type === "UTILITY" && s.owner === ownerId
  );
  
  const count = utilities.length;
  const diceTotal = state.dice ? state.dice[0] + state.dice[1] : 7;
  
  if (count === 1) return 4 * diceTotal;
  if (count === 2) return 10 * diceTotal;
  
  return 0;
}
