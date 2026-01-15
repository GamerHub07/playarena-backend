export type TurnPhase = "ROLL" | "RESOLVE" | "DECISION" | "END_TURN" | "DEBT" | "JAIL";

export interface MonopolyPlayerState {
  sessionId: string;
  username: string;
  position: number;
  cash: number;
  properties: string[];
  inJail: boolean;
  jailTurns: number;
  bankrupt: boolean;
  hasGetOutOfJailCard?: boolean;
}

export interface BoardSquare {
  id: string;
  type: 'GO' | 'PROPERTY' | 'TAX' | 'JAIL' | 'GO_TO_JAIL' | 'FREE_PARKING' | 'CHANCE' | 'COMMUNITY_CHEST' | 'RAILROAD' | 'UTILITY';
  name?: string;
  price?: number;
  rent?: number;
  owner?: string | null;
  amount?: number;
  color?: string;
  // House/Hotel support
  houses?: number; // 0-4 houses, 5 = hotel
  houseCost?: number; // Cost to build one house
  rentTiers?: number[]; // [base, 1house, 2house, 3house, 4house, hotel]
}

export interface DrawnCard {
  id: string;
  text: string;
}

export interface TradeOffer {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  offeringProperties: string[];  // Property IDs being offered
  offeringCash: number;
  requestingProperties: string[];  // Property IDs being requested
  requestingCash: number;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  createdAt: number;
}

export type GameLogType = 
  | 'PASS_GO'           // Collected $200 passing GO
  | 'RENT_PAID'         // Paid rent to another player
  | 'RENT_RECEIVED'     // Received rent from another player
  | 'TAX_PAID'          // Paid tax
  | 'PROPERTY_BOUGHT'   // Bought a property
  | 'PROPERTY_SOLD'     // Sold a property (mortgage)
  | 'JAIL_FINE'         // Paid jail fine
  | 'CARD_COLLECT'      // Collected money from card
  | 'CARD_PAY'          // Paid money from card
  | 'CARD_TRANSFER'     // Transferred money (from/to other players via card)
  | 'HOUSE_BUILT'       // Built a house
  | 'HOTEL_BUILT'       // Built a hotel
  | 'HOUSE_SOLD'        // Sold a house
  | 'TRADE_PROPOSED'    // Trade offer proposed
  | 'TRADE_ACCEPTED'    // Trade accepted
  | 'TRADE_REJECTED'    // Trade rejected
  | 'TRADE_CANCELLED'   // Trade cancelled
  | 'JAIL_RELEASE'      // Released from jail
  | 'JAIL_STAY';        // Turned in jail

export interface GameLogEntry {
  id: string;
  type: GameLogType;
  playerId: string;
  playerName: string;
  amount: number;
  description: string;
  timestamp: number;
  relatedPlayerId?: string;    // For rent/transfers - the other player
  relatedPlayerName?: string;
  propertyName?: string;       // For property-related logs
}

export interface MonopolyGameState {
  currentTurnIndex: number;
  phase: TurnPhase;
  dice: [number, number] | null;
  board: BoardSquare[];
  playerState: Record<string, MonopolyPlayerState>;
  lastCard?: DrawnCard | null;
  doublesCount: number; // Track consecutive doubles (3 = jail)
  gameLog: GameLogEntry[]; // Transaction log for money flow
  bankruptcyOrder: string[]; // sessionIds of eliminated players (in order of elimination)
  pendingTrades: TradeOffer[]; // Active trade offers
}
