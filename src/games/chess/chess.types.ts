export type ChessColor = "white" | "black";

export type ChessPieceType =
  | "pawn"
  | "rook"
  | "knight"
  | "bishop"
  | "queen"
  | "king";

export interface ChessPiece {
  type: ChessPieceType;
  color: ChessColor;
}

export type BoardSquare = ChessPiece | null;

export type ChessBoard = BoardSquare[][]; // 8x8

export interface ChessMove {
  from: string; // e.g. "e2"
  to: string;   // e.g. "e4"
  san?: string; // Standard Algebraic Notation (e.g., "Nf3", "O-O")
  promotion?: string; // Promotion piece if any
}

export type ChessGameStatus =
  | "waiting"
  | "playing"
  | "check"
  | "checkmate"
  | "stalemate"
  | "draw";

export interface ChessGameState {
  board: ChessBoard;
  fen: string;
  turn: ChessColor;
  status: ChessGameStatus;
  winner: ChessColor | null;
  moveHistory: ChessMove[];
  playerColors: Record<string, ChessColor>;

}
