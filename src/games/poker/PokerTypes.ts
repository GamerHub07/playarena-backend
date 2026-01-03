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
  status: "ACTIVE" | "FOLDED" | "ALL_IN";
  hand?: string[];
}

export interface PokerState {
  phase: PokerPhase;
  dealerIndex: number;
  currentTurn: number | null;
  pot: number;
  communityCards: string[];
  players: PokerPlayerState[];
  winnerIndex?: number;
}
