import { MonopolyGameState, GameLogEntry, GameLogType } from "../types/monopoly.types";

let logIdCounter = 0;

function generateLogId(): string {
  return `log_${Date.now()}_${++logIdCounter}`;
}

/**
 * Add a log entry to the game state
 */
export function addLog(
  state: MonopolyGameState,
  type: GameLogType,
  playerId: string,
  amount: number,
  description: string,
  options?: {
    relatedPlayerId?: string;
    propertyName?: string;
  }
): void {
  const player = state.playerState[playerId];
  const relatedPlayer = options?.relatedPlayerId 
    ? state.playerState[options.relatedPlayerId] 
    : undefined;

  const entry: GameLogEntry = {
    id: generateLogId(),
    type,
    playerId,
    playerName: player?.username || 'Unknown',
    amount,
    description,
    timestamp: Date.now(),
    relatedPlayerId: options?.relatedPlayerId,
    relatedPlayerName: relatedPlayer?.username,
    propertyName: options?.propertyName,
  };

  state.gameLog.push(entry);
}

/**
 * Log passing GO
 */
export function logPassGo(state: MonopolyGameState, playerId: string): void {
  addLog(state, 'PASS_GO', playerId, 200, 'Collected ₹200 for passing GO');
}

/**
 * Log rent payment
 */
export function logRentPaid(
  state: MonopolyGameState,
  payerId: string,
  ownerId: string,
  amount: number,
  propertyName: string
): void {
  const ownerName = state.playerState[ownerId]?.username || 'Unknown';
  addLog(state, 'RENT_PAID', payerId, amount, `Paid ₹${amount} rent to ${ownerName} for ${propertyName}`, {
    relatedPlayerId: ownerId,
    propertyName,
  });

  const payerName = state.playerState[payerId]?.username || 'Unknown';
  addLog(state, 'RENT_RECEIVED', ownerId, amount, `Received ₹${amount} rent from ${payerName} for ${propertyName}`, {
    relatedPlayerId: payerId,
    propertyName,
  });
}

/**
 * Log tax payment
 */
export function logTaxPaid(
  state: MonopolyGameState,
  playerId: string,
  amount: number,
  taxName: string
): void {
  addLog(state, 'TAX_PAID', playerId, amount, `Paid ₹${amount} for ${taxName}`);
}

/**
 * Log property purchase
 */
export function logPropertyBought(
  state: MonopolyGameState,
  playerId: string,
  amount: number,
  propertyName: string
): void {
  addLog(state, 'PROPERTY_BOUGHT', playerId, amount, `Bought ${propertyName} for ₹${amount}`, {
    propertyName,
  });
}

/**
 * Log property sale (mortgage)
 */
export function logPropertySold(
  state: MonopolyGameState,
  playerId: string,
  amount: number,
  propertyName: string
): void {
  addLog(state, 'PROPERTY_SOLD', playerId, amount, `Sold ${propertyName} for ₹${amount}`, {
    propertyName,
  });
}

/**
 * Log jail fine payment
 */
export function logJailFine(state: MonopolyGameState, playerId: string, amount: number): void {
  addLog(state, 'JAIL_FINE', playerId, amount, `Paid ₹${amount} jail fine`);
}

/**
 * Log card collect (gained money from card)
 */
export function logCardCollect(
  state: MonopolyGameState,
  playerId: string,
  amount: number,
  cardText: string
): void {
  addLog(state, 'CARD_COLLECT', playerId, amount, `Collected ₹${amount}: ${cardText}`);
}

/**
 * Log card pay (paid money from card)
 */
export function logCardPay(
  state: MonopolyGameState,
  playerId: string,
  amount: number,
  cardText: string
): void {
  addLog(state, 'CARD_PAY', playerId, amount, `Paid ₹${amount}: ${cardText}`);
}

/**
 * Log card transfer (money between players from card)
 */
export function logCardTransfer(
  state: MonopolyGameState,
  fromPlayerId: string,
  toPlayerId: string,
  amount: number,
  description: string
): void {
  const toPlayerName = state.playerState[toPlayerId]?.username || 'Unknown';
  const fromPlayerName = state.playerState[fromPlayerId]?.username || 'Unknown';

  addLog(state, 'CARD_TRANSFER', fromPlayerId, amount, `Paid ₹${amount} to ${toPlayerName}: ${description}`, {
    relatedPlayerId: toPlayerId,
  });

  addLog(state, 'CARD_TRANSFER', toPlayerId, amount, `Received ₹${amount} from ${fromPlayerName}: ${description}`, {
    relatedPlayerId: fromPlayerId,
  });
}

/**
 * Log house built
 */
export function logHouseBuilt(
  state: MonopolyGameState,
  playerId: string,
  amount: number,
  propertyName: string,
  houseCount: number
): void {
  addLog(state, 'HOUSE_BUILT', playerId, amount, `Built house #${houseCount} on ${propertyName} for ₹${amount}`, {
    propertyName,
  });
}

/**
 * Log hotel built
 */
export function logHotelBuilt(
  state: MonopolyGameState,
  playerId: string,
  amount: number,
  propertyName: string
): void {
  addLog(state, 'HOTEL_BUILT', playerId, amount, `Built hotel on ${propertyName} for ₹${amount}`, {
    propertyName,
  });
}

/**
 * Log house sold
 */
export function logHouseSold(
  state: MonopolyGameState,
  playerId: string,
  amount: number,
  propertyName: string
): void {
  addLog(state, 'HOUSE_SOLD', playerId, amount, `Sold house on ${propertyName} for ₹${amount}`, {
    propertyName,
  });
}

export function logJailStay(
  state: MonopolyGameState,
  playerId: string
): void {
  const player = state.playerState[playerId];
  const entry: GameLogEntry = {
    id: generateLogId(),
    type: 'JAIL_STAY',
    playerId,
    playerName: player?.username || 'Unknown',
    amount: 0,
    description: 'stayed in jail',
    timestamp: Date.now(),
  };
  state.gameLog.push(entry);
}

export function logJailRelease(
  state: MonopolyGameState,
  playerId: string,
  reason: string
): void {
  const player = state.playerState[playerId];
  const entry: GameLogEntry = {
    id: generateLogId(),
    type: 'JAIL_RELEASE',
    playerId,
    playerName: player?.username || 'Unknown',
    amount: 0,
    description: `was released from jail (${reason})`,
    timestamp: Date.now(),
  };
  state.gameLog.push(entry);
}

/**
 * Log trade proposed
 */
export function logTradeProposed(
  state: MonopolyGameState,
  fromPlayerId: string,
  toPlayerId: string
): void {
  const fromPlayer = state.playerState[fromPlayerId];
  const toPlayer = state.playerState[toPlayerId];
  addLog(state, 'TRADE_PROPOSED', fromPlayerId, 0, `proposed a trade to ${toPlayer?.username}`, {
    relatedPlayerId: toPlayerId,
  });
}

/**
 * Log trade accepted
 */
export function logTradeAccepted(
  state: MonopolyGameState,
  fromPlayerId: string,
  toPlayerId: string
): void {
  const toPlayer = state.playerState[toPlayerId];
  addLog(state, 'TRADE_ACCEPTED', toPlayerId, 0, `accepted trade from ${state.playerState[fromPlayerId]?.username}`, {
    relatedPlayerId: fromPlayerId,
  });
}

/**
 * Log trade rejected
 */
export function logTradeRejected(
  state: MonopolyGameState,
  fromPlayerId: string,
  toPlayerId: string
): void {
  addLog(state, 'TRADE_REJECTED', toPlayerId, 0, `rejected trade from ${state.playerState[fromPlayerId]?.username}`, {
    relatedPlayerId: fromPlayerId,
  });
}

/**
 * Log trade cancelled
 */
export function logTradeCancelled(
  state: MonopolyGameState,
  playerId: string
): void {
  addLog(state, 'TRADE_CANCELLED', playerId, 0, 'cancelled their trade offer');
}
