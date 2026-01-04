export type PokerPhase =
  | "WAITING"
  | "PREFLOP"
  | "FLOP"
  | "TURN"
  | "RIVER"
  | "SHOWDOWN"
  | "ENDED";

export interface PokerPlayerState {
  sessionId: string;
  username: string;
  chips: number;
  bet: number;
  status: "ACTIVE" | "FOLDED" | "ALL_IN" | "SITTING_OUT";
  hand?: string[];
  actionRequired?: boolean; // If true, it's this player's turn
  totalBetThisRound: number; // How much they put in THIS round (reset on phase change)
}

export interface PokerState {
  phase: PokerPhase;

  currentTurn: number | null;
  pot: number;
  communityCards: string[];
  players: PokerPlayerState[];
  winnerIndex?: number;
  winnerHand?: string; // e.g., "Full House"

  // Betting Round Info
  currentBet: number;      // The amount to call
  minRaise: number;        // Minimum raise amount
  lastAggressor: number | null; // Index of player who last raised
  dealerIndex: number;
  smallBlind: number;
  bigBlind: number;

  // Last action for UI
  lastAction?: {
    playerId: string;
    action: string;
    amount?: number;
  };
}
