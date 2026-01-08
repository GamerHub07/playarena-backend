/**
 * Chess Game Types
 * 
 * Production-ready type definitions for Chess gameplay.
 * Follows the same patterns as LudoTypes.ts and SnakeLadderTypes.ts for consistency.
 */

// ═══════════════════════════════════════════════════════════════
// PIECE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

export type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';
export type PlayerColor = 'white' | 'black';

export interface ChessPiece {
    type: PieceType;
    color: PlayerColor;
    hasMoved: boolean;
}

export interface Position {
    row: number; // 0-7 (0 = rank 8, 7 = rank 1)
    col: number; // 0-7 (0 = file a, 7 = file h)
}

// Board is 8x8, null means empty square
export type Board = (ChessPiece | null)[][];

// ═══════════════════════════════════════════════════════════════
// MOVE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

export type SpecialMoveType =
    | 'castling-kingside'
    | 'castling-queenside'
    | 'en-passant'
    | 'promotion';

export interface ChessMove {
    from: Position;
    to: Position;
    piece: ChessPiece;
    capturedPiece?: ChessPiece;
    specialMove?: SpecialMoveType;
    promotionPiece?: PieceType; // For pawn promotion
    timestamp: number;
}

export interface MoveResult {
    valid: boolean;
    move?: ChessMove;
    newBoard?: Board;
    isCheck?: boolean;
    isCheckmate?: boolean;
    isStalemate?: boolean;
    isDraw?: boolean;
    error?: string;
}

// ═══════════════════════════════════════════════════════════════
// GAME STATE
// ═══════════════════════════════════════════════════════════════

export type GameResult =
    | 'white-wins-checkmate'
    | 'black-wins-checkmate'
    | 'white-wins-resignation'
    | 'black-wins-resignation'
    | 'draw-stalemate'
    | 'draw-agreement'
    | 'draw-insufficient-material'
    | 'draw-fifty-moves'
    | 'draw-threefold-repetition';

export interface ChessGameState {
    board: Board;
    currentPlayer: PlayerColor;
    moveHistory: ChessMove[];
    isCheck: boolean;
    isCheckmate: boolean;
    isStalemate: boolean;
    isDraw: boolean;
    gameResult: GameResult | null;
    winner: number | null; // 0 = white (first player), 1 = black (second player)

    // For special move tracking
    enPassantTarget: Position | null; // Square where en passant capture can occur
    halfMoveClock: number; // For 50-move rule
    fullMoveNumber: number;

    // Draw offers
    drawOfferedBy: PlayerColor | null;

    // Captured pieces for display
    capturedByWhite: ChessPiece[];
    capturedByBlack: ChessPiece[];
}

// ═══════════════════════════════════════════════════════════════
// ACTION PAYLOADS
// ═══════════════════════════════════════════════════════════════

export interface ChessMovePayload {
    from: Position;
    to: Position;
    promotionPiece?: PieceType; // Required when pawn reaches last rank
}

export interface ChessActionPayload {
    action: 'move' | 'resign' | 'offer_draw' | 'accept_draw' | 'decline_draw';
    data?: ChessMovePayload;
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

export const BOARD_SIZE = 8;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 2;

// Player colors for UI (matches design system)
export const PLAYER_COLORS = {
    white: '#F5F5F5',
    black: '#2D2D2D',
};

// Initial piece setup (white's perspective, row 0 = black's back rank)
export const INITIAL_BACK_RANK: PieceType[] = [
    'rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'
];

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Convert position to algebraic notation (e.g., {row: 6, col: 4} -> "e2")
 */
export function positionToAlgebraic(pos: Position): string {
    const file = String.fromCharCode(97 + pos.col); // a-h
    const rank = (8 - pos.row).toString(); // 1-8
    return file + rank;
}

/**
 * Convert algebraic notation to position (e.g., "e2" -> {row: 6, col: 4})
 */
export function algebraicToPosition(notation: string): Position | null {
    if (notation.length !== 2) return null;
    const col = notation.charCodeAt(0) - 97; // a=0, h=7
    const rank = parseInt(notation[1]);
    if (col < 0 || col > 7 || rank < 1 || rank > 8) return null;
    return { row: 8 - rank, col };
}

/**
 * Check if position is within board bounds
 */
export function isValidPosition(pos: Position): boolean {
    return pos.row >= 0 && pos.row < 8 && pos.col >= 0 && pos.col < 8;
}

/**
 * Compare two positions for equality
 */
export function positionsEqual(a: Position, b: Position): boolean {
    return a.row === b.row && a.col === b.col;
}

/**
 * Create a deep copy of the board
 */
export function cloneBoard(board: Board): Board {
    return board.map(row =>
        row.map(cell =>
            cell ? { ...cell } : null
        )
    );
}

/**
 * Get the opposite color
 */
export function getOppositeColor(color: PlayerColor): PlayerColor {
    return color === 'white' ? 'black' : 'white';
}
