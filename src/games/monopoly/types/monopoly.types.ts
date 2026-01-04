export type TurnPhase = "ROLL" | "RESOLVE" | "DECISION" | "END_TURN" | "DEBT";

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
}

export interface DrawnCard {
  id: string;
  text: string;
}

export interface MonopolyGameState {
  currentTurnIndex: number;
  phase: TurnPhase;
  dice: [number, number] | null;
  board: BoardSquare[];
  playerState: Record<string, MonopolyPlayerState>;
  lastCard?: DrawnCard | null;
  doublesCount: number; // Track consecutive doubles (3 = jail)
}

