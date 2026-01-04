import { MonopolyGameState, BoardSquare } from "../types/monopoly.types";
import { COLOR_GROUP_SIZES } from "../data/board";

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

 * Get all properties of a color group
 */
export function getPropertiesOfColor(
  state: MonopolyGameState,
  color: string
): BoardSquare[] {
  return state.board.filter(
    s => s.type === "PROPERTY" && s.color === color
  );
}

/**
 * Check if a player can build a house on a property
 * Rules:
 * - Must own all properties in the color group (monopoly)
 * - Must build evenly (difference of max 1 house across properties)
 * - Maximum 4 houses before upgrading to hotel
 * - Must have enough cash
 */
export function canBuildHouse(
  state: MonopolyGameState,
  playerId: string,
  propertyId: string
): { canBuild: boolean; reason?: string } {
  const square = state.board.find(s => s.id === propertyId);
  const player = state.playerState[playerId];

  if (!square || square.type !== "PROPERTY") {
    return { canBuild: false, reason: "Not a property" };
  }

  if (square.owner !== playerId) {
    return { canBuild: false, reason: "You don't own this property" };
  }

  if (!square.color || !hasMonopoly(state, playerId, square.color)) {
    return { canBuild: false, reason: "You need a complete monopoly to build" };
  }

  const houses = square.houses ?? 0;
  if (houses >= 5) {
    return { canBuild: false, reason: "Property already has a hotel" };
  }

  if (houses >= 4) {
    return { canBuild: false, reason: "Use 'Build Hotel' to upgrade from 4 houses" };
  }

  // Check even building rule
  const colorProperties = getPropertiesOfColor(state, square.color);
  const minHouses = Math.min(...colorProperties.map(p => p.houses ?? 0));

  if (houses > minHouses) {
    return { canBuild: false, reason: "Must build evenly - build on other properties first" };
  }

  const cost = square.houseCost ?? 0;
  if (player.cash < cost) {
    return { canBuild: false, reason: `Insufficient funds (need $${cost})` };
  }

  return { canBuild: true };
}

/**
 * Check if a player can build a hotel on a property
 * Rules:
 * - Must have 4 houses on the property
 * - Must own all properties in the color group
 * - Must build evenly (all properties in group must have 4+ houses)
 * - Must have enough cash
 */
export function canBuildHotel(
  state: MonopolyGameState,
  playerId: string,
  propertyId: string
): { canBuild: boolean; reason?: string } {
  const square = state.board.find(s => s.id === propertyId);
  const player = state.playerState[playerId];

  if (!square || square.type !== "PROPERTY") {
    return { canBuild: false, reason: "Not a property" };
  }

  if (square.owner !== playerId) {
    return { canBuild: false, reason: "You don't own this property" };
  }

  if (!square.color || !hasMonopoly(state, playerId, square.color)) {
    return { canBuild: false, reason: "You need a complete monopoly to build" };
  }

  const houses = square.houses ?? 0;
  if (houses >= 5) {
    return { canBuild: false, reason: "Property already has a hotel" };
  }

  if (houses < 4) {
    return { canBuild: false, reason: "Need 4 houses before building a hotel" };
  }

  // Check even building rule - all properties must have at least 4 houses
  const colorProperties = getPropertiesOfColor(state, square.color);
  const minHouses = Math.min(...colorProperties.map(p => p.houses ?? 0));

  if (minHouses < 4) {
    return { canBuild: false, reason: "All properties must have 4 houses before building a hotel" };
  }

  const cost = square.houseCost ?? 0;
  if (player.cash < cost) {
    return { canBuild: false, reason: `Insufficient funds (need $${cost})` };
  }

  return { canBuild: true };
}

/**
 * Calculate rent for a property based on houses/hotel
 * - Base rent for unimproved property
 * - Double rent if player has monopoly (all of that color) with no houses
 * - Use rent tiers if houses/hotel are built
 */
export function calculateRent(
  state: MonopolyGameState,
  square: BoardSquare,
  ownerId: string
): number {
  const houses = square.houses ?? 0;

  // If there are houses/hotel, use rent tiers
  if (houses > 0 && square.rentTiers && square.rentTiers.length > houses) {
    return square.rentTiers[houses];
  }

  const baseRent = square.rent ?? 0;

  // Check for monopoly bonus (double rent) only if no houses
  if (houses === 0 && square.color && hasMonopoly(state, ownerId, square.color)) {
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
