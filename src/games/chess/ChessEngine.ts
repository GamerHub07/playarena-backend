/**
 * Chess Game Engine
 * 
 * Production-ready game engine with full chess rules:
 * - All piece movements (king, queen, rook, bishop, knight, pawn)
 * - Special moves (castling, en passant, pawn promotion)
 * - Check and checkmate detection
 * - Stalemate and draw detection
 * - Move validation ensuring king safety
 */

import { GameEngine, GamePlayer } from '../base/GameEngine';
import {
    ChessGameState,
    ChessPiece,
    Position,
    Board,
    ChessMove,
    PlayerColor,
    PieceType,
    SpecialMoveType,
    ChessMovePayload,
    TimeControl,
    TIME_CONTROL_PRESETS,
    BOARD_SIZE,
    MIN_PLAYERS,
    MAX_PLAYERS,
    INITIAL_BACK_RANK,
    isValidPosition,
    positionsEqual,
    cloneBoard,
    getOppositeColor,
} from './ChessTypes';

export class ChessEngine extends GameEngine<ChessGameState> {

    getGameType(): string {
        return 'chess';
    }

    getMinPlayers(): number {
        return MIN_PLAYERS;
    }

    getMaxPlayers(): number {
        return MAX_PLAYERS;
    }

    getInitialState(): ChessGameState {
        return {
            board: this.createInitialBoard(),
            currentPlayer: 'white',
            moveHistory: [],
            isCheck: false,
            isCheckmate: false,
            isStalemate: false,
            isDraw: false,
            gameResult: null,
            winner: null,
            enPassantTarget: null,
            halfMoveClock: 0,
            fullMoveNumber: 1,
            drawOfferedBy: null,
            capturedByWhite: [],
            capturedByBlack: [],
            // Timer fields - initialized later via setTimeControl
            timeControl: null,
            whiteTimeRemainingMs: 0,
            blackTimeRemainingMs: 0,
            lastMoveTimestamp: null,
        };
    }

    /**
     * Create the standard chess starting position
     */
    private createInitialBoard(): Board {
        const board: Board = Array(8).fill(null).map(() => Array(8).fill(null));

        // Set up black pieces (row 0 and 1)
        for (let col = 0; col < 8; col++) {
            // Back rank
            board[0][col] = {
                type: INITIAL_BACK_RANK[col],
                color: 'black',
                hasMoved: false,
            };
            // Pawns
            board[1][col] = {
                type: 'pawn',
                color: 'black',
                hasMoved: false,
            };
        }

        // Set up white pieces (row 6 and 7)
        for (let col = 0; col < 8; col++) {
            // Pawns
            board[6][col] = {
                type: 'pawn',
                color: 'white',
                hasMoved: false,
            };
            // Back rank
            board[7][col] = {
                type: INITIAL_BACK_RANK[col],
                color: 'white',
                hasMoved: false,
            };
        }

        return board;
    }

    /**
     * Initialize the game with joined players
     */
    initializeGame(): void {
        this.state = this.getInitialState();
    }

    /**
     * Set the time control for this game
     */
    setTimeControl(timeControlKey: string): void {
        const timeControl = TIME_CONTROL_PRESETS[timeControlKey];
        if (timeControl && timeControl.type !== 'unlimited') {
            this.state.timeControl = timeControl;
            this.state.whiteTimeRemainingMs = timeControl.initialTimeMs;
            this.state.blackTimeRemainingMs = timeControl.initialTimeMs;
            this.state.lastMoveTimestamp = Date.now();
        }
    }

    /**
     * Get current time remaining for a player (accounting for elapsed time)
     */
    getTimeRemaining(color: PlayerColor): number {
        if (!this.state.timeControl || this.state.timeControl.type === 'unlimited') {
            return -1; // Unlimited time
        }

        const baseTime = color === 'white'
            ? this.state.whiteTimeRemainingMs
            : this.state.blackTimeRemainingMs;

        // If it's this player's turn, account for elapsed time
        if (this.state.currentPlayer === color && this.state.lastMoveTimestamp && !this.isGameOver()) {
            const elapsed = Date.now() - this.state.lastMoveTimestamp;
            return Math.max(0, baseTime - elapsed);
        }

        return baseTime;
    }

    /**
     * Check if a player has run out of time
     */
    checkTimeout(): PlayerColor | null {
        if (!this.state.timeControl || this.state.timeControl.type === 'unlimited') {
            return null;
        }

        const whiteTime = this.getTimeRemaining('white');
        const blackTime = this.getTimeRemaining('black');

        if (whiteTime <= 0) return 'white';
        if (blackTime <= 0) return 'black';
        return null;
    }

    /**
     * Handle timeout - called by handler when time runs out
     */
    handleTimeout(losingColor: PlayerColor): ChessGameState {
        this.state.gameResult = losingColor === 'white'
            ? 'black-wins-timeout'
            : 'white-wins-timeout';
        this.state.winner = losingColor === 'white' ? 1 : 0;
        return this.state;
    }

    handleAction(playerId: string, action: string, payload: unknown): ChessGameState {
        const playerIndex = this.players.findIndex(p => p.sessionId === playerId);

        if (playerIndex === -1) {
            throw new Error('Player not found');
        }

        if (action === 'init') {
            this.initializeGame();
            return this.state;
        }

        // Game already over
        if (this.state.gameResult !== null) {
            throw new Error('Game is already over');
        }

        // Determine player color (first player is white, second is black)
        const playerColor: PlayerColor = playerIndex === 0 ? 'white' : 'black';

        switch (action) {
            case 'move':
                return this.handleMove(playerColor, payload as ChessMovePayload);
            case 'resign':
                return this.handleResign(playerColor);
            case 'offer_draw':
                return this.handleOfferDraw(playerColor);
            case 'accept_draw':
                return this.handleAcceptDraw(playerColor);
            case 'decline_draw':
                return this.handleDeclineDraw();
            default:
                throw new Error(`Unknown action: ${action}`);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // MOVE HANDLING
    // ═══════════════════════════════════════════════════════════════

    private handleMove(playerColor: PlayerColor, payload: ChessMovePayload): ChessGameState {
        // Check turn
        if (this.state.currentPlayer !== playerColor) {
            throw new Error('Not your turn');
        }

        const { from, to, promotionPiece } = payload;

        // Validate positions
        if (!isValidPosition(from) || !isValidPosition(to)) {
            throw new Error('Invalid position');
        }

        const piece = this.state.board[from.row][from.col];
        if (!piece) {
            throw new Error('No piece at source position');
        }

        if (piece.color !== playerColor) {
            throw new Error('Cannot move opponent\'s piece');
        }

        // Check if move is valid
        const validMoves = this.getValidMovesForPiece(from);
        const targetMove = validMoves.find(m => positionsEqual(m, to));

        if (!targetMove) {
            throw new Error('Invalid move');
        }

        // Check for pawn promotion
        const isPromotion = piece.type === 'pawn' &&
            ((playerColor === 'white' && to.row === 0) ||
                (playerColor === 'black' && to.row === 7));

        if (isPromotion && !promotionPiece) {
            throw new Error('Promotion piece required');
        }

        if (isPromotion && promotionPiece &&
            !['queen', 'rook', 'bishop', 'knight'].includes(promotionPiece)) {
            throw new Error('Invalid promotion piece');
        }

        // Execute the move
        this.executeMove(from, to, promotionPiece);

        return this.state;
    }

    private executeMove(from: Position, to: Position, promotionPiece?: PieceType): void {
        const piece = this.state.board[from.row][from.col]!;
        const capturedPiece = this.state.board[to.row][to.col];
        const playerColor = piece.color;
        let specialMove: SpecialMoveType | undefined;

        // Clear draw offer on any move
        this.state.drawOfferedBy = null;

        // Detect special moves
        // Castling
        if (piece.type === 'king' && Math.abs(to.col - from.col) === 2) {
            specialMove = to.col > from.col ? 'castling-kingside' : 'castling-queenside';
            this.executeCastling(from, to);
        }
        // En passant
        else if (piece.type === 'pawn' &&
            this.state.enPassantTarget &&
            positionsEqual(to, this.state.enPassantTarget)) {
            specialMove = 'en-passant';
            this.executeEnPassant(from, to);
        }
        // Pawn promotion
        else if (piece.type === 'pawn' &&
            ((playerColor === 'white' && to.row === 0) ||
                (playerColor === 'black' && to.row === 7))) {
            specialMove = 'promotion';
            this.executePromotion(from, to, promotionPiece || 'queen');
        }
        // Normal move
        else {
            this.executeNormalMove(from, to);
        }

        // Track captured pieces
        if (capturedPiece) {
            if (playerColor === 'white') {
                this.state.capturedByWhite.push(capturedPiece);
            } else {
                this.state.capturedByBlack.push(capturedPiece);
            }
        }

        // Update en passant target
        if (piece.type === 'pawn' && Math.abs(to.row - from.row) === 2) {
            // Pawn moved two squares, set en passant target
            this.state.enPassantTarget = {
                row: (from.row + to.row) / 2,
                col: from.col,
            };
        } else {
            this.state.enPassantTarget = null;
        }

        // Update half-move clock (for 50-move rule)
        if (piece.type === 'pawn' || capturedPiece) {
            this.state.halfMoveClock = 0;
        } else {
            this.state.halfMoveClock++;
        }

        // Update full-move number
        if (playerColor === 'black') {
            this.state.fullMoveNumber++;
        }

        // Record the move
        const move: ChessMove = {
            from,
            to,
            piece: { ...piece, hasMoved: true },
            capturedPiece: capturedPiece || undefined,
            specialMove,
            promotionPiece: specialMove === 'promotion' ? (promotionPiece || 'queen') : undefined,
            timestamp: Date.now(),
        };
        this.state.moveHistory.push(move);

        // Switch turns
        const nextPlayer = getOppositeColor(playerColor);
        this.state.currentPlayer = nextPlayer;

        // Check game ending conditions
        this.updateGameStatus(nextPlayer);
    }

    private executeNormalMove(from: Position, to: Position): void {
        const piece = this.state.board[from.row][from.col]!;
        this.state.board[to.row][to.col] = { ...piece, hasMoved: true };
        this.state.board[from.row][from.col] = null;
    }

    private executeCastling(kingFrom: Position, kingTo: Position): void {
        // Move king
        const king = this.state.board[kingFrom.row][kingFrom.col]!;
        this.state.board[kingTo.row][kingTo.col] = { ...king, hasMoved: true };
        this.state.board[kingFrom.row][kingFrom.col] = null;

        // Move rook
        const isKingside = kingTo.col > kingFrom.col;
        const rookFromCol = isKingside ? 7 : 0;
        const rookToCol = isKingside ? 5 : 3;

        const rook = this.state.board[kingFrom.row][rookFromCol]!;
        this.state.board[kingFrom.row][rookToCol] = { ...rook, hasMoved: true };
        this.state.board[kingFrom.row][rookFromCol] = null;
    }

    private executeEnPassant(from: Position, to: Position): void {
        const piece = this.state.board[from.row][from.col]!;

        // Move pawn
        this.state.board[to.row][to.col] = { ...piece, hasMoved: true };
        this.state.board[from.row][from.col] = null;

        // Remove captured pawn (it's on the same row as 'from', same col as 'to')
        const capturedPawn = this.state.board[from.row][to.col]!;
        this.state.board[from.row][to.col] = null;

        // Track captured pawn
        if (piece.color === 'white') {
            this.state.capturedByWhite.push(capturedPawn);
        } else {
            this.state.capturedByBlack.push(capturedPawn);
        }
    }

    private executePromotion(from: Position, to: Position, promotionPiece: PieceType): void {
        const piece = this.state.board[from.row][from.col]!;

        // Place promoted piece
        this.state.board[to.row][to.col] = {
            type: promotionPiece,
            color: piece.color,
            hasMoved: true,
        };
        this.state.board[from.row][from.col] = null;
    }

    // ═══════════════════════════════════════════════════════════════
    // MOVE VALIDATION
    // ═══════════════════════════════════════════════════════════════

    /**
     * Get all valid moves for a piece, considering check constraints
     */
    private getValidMovesForPiece(pos: Position): Position[] {
        const piece = this.state.board[pos.row][pos.col];
        if (!piece) return [];

        const pseudoLegalMoves = this.getPseudoLegalMoves(pos, piece);

        // Filter out moves that would leave king in check
        return pseudoLegalMoves.filter(to => !this.moveLeavesKingInCheck(pos, to));
    }

    /**
     * Get pseudo-legal moves (basic piece movement, not considering check)
     * @param skipCastling - If true, skip castling for king (used in attack detection to prevent infinite recursion)
     */
    private getPseudoLegalMoves(pos: Position, piece: ChessPiece, skipCastling: boolean = false): Position[] {
        switch (piece.type) {
            case 'pawn':
                return this.getPawnMoves(pos, piece);
            case 'rook':
                return this.getRookMoves(pos, piece);
            case 'knight':
                return this.getKnightMoves(pos, piece);
            case 'bishop':
                return this.getBishopMoves(pos, piece);
            case 'queen':
                return this.getQueenMoves(pos, piece);
            case 'king':
                return this.getKingMoves(pos, piece, skipCastling);
            default:
                return [];
        }
    }

    private getPawnMoves(pos: Position, piece: ChessPiece): Position[] {
        const moves: Position[] = [];
        const direction = piece.color === 'white' ? -1 : 1;
        const startRow = piece.color === 'white' ? 6 : 1;

        // Forward move
        const oneForward: Position = { row: pos.row + direction, col: pos.col };
        if (isValidPosition(oneForward) && !this.state.board[oneForward.row][oneForward.col]) {
            moves.push(oneForward);

            // Two square advance from starting position
            if (pos.row === startRow) {
                const twoForward: Position = { row: pos.row + 2 * direction, col: pos.col };
                if (!this.state.board[twoForward.row][twoForward.col]) {
                    moves.push(twoForward);
                }
            }
        }

        // Captures (diagonal)
        for (const colOffset of [-1, 1]) {
            const capturePos: Position = { row: pos.row + direction, col: pos.col + colOffset };
            if (isValidPosition(capturePos)) {
                const targetPiece = this.state.board[capturePos.row][capturePos.col];
                if (targetPiece && targetPiece.color !== piece.color) {
                    moves.push(capturePos);
                }
                // En passant
                if (this.state.enPassantTarget && positionsEqual(capturePos, this.state.enPassantTarget)) {
                    moves.push(capturePos);
                }
            }
        }

        return moves;
    }

    private getRookMoves(pos: Position, piece: ChessPiece): Position[] {
        return this.getSlidingMoves(pos, piece, [
            { row: -1, col: 0 }, // up
            { row: 1, col: 0 },  // down
            { row: 0, col: -1 }, // left
            { row: 0, col: 1 },  // right
        ]);
    }

    private getBishopMoves(pos: Position, piece: ChessPiece): Position[] {
        return this.getSlidingMoves(pos, piece, [
            { row: -1, col: -1 }, // up-left
            { row: -1, col: 1 },  // up-right
            { row: 1, col: -1 },  // down-left
            { row: 1, col: 1 },   // down-right
        ]);
    }

    private getQueenMoves(pos: Position, piece: ChessPiece): Position[] {
        return [
            ...this.getRookMoves(pos, piece),
            ...this.getBishopMoves(pos, piece),
        ];
    }

    private getKnightMoves(pos: Position, piece: ChessPiece): Position[] {
        const moves: Position[] = [];
        const offsets = [
            { row: -2, col: -1 }, { row: -2, col: 1 },
            { row: -1, col: -2 }, { row: -1, col: 2 },
            { row: 1, col: -2 }, { row: 1, col: 2 },
            { row: 2, col: -1 }, { row: 2, col: 1 },
        ];

        for (const offset of offsets) {
            const newPos: Position = { row: pos.row + offset.row, col: pos.col + offset.col };
            if (isValidPosition(newPos)) {
                const targetPiece = this.state.board[newPos.row][newPos.col];
                if (!targetPiece || targetPiece.color !== piece.color) {
                    moves.push(newPos);
                }
            }
        }

        return moves;
    }

    private getKingMoves(pos: Position, piece: ChessPiece, skipCastling: boolean = false): Position[] {
        const moves: Position[] = [];

        // Normal king moves (one square in any direction)
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const newPos: Position = { row: pos.row + dr, col: pos.col + dc };
                if (isValidPosition(newPos)) {
                    const targetPiece = this.state.board[newPos.row][newPos.col];
                    if (!targetPiece || targetPiece.color !== piece.color) {
                        moves.push(newPos);
                    }
                }
            }
        }

        // Castling - skip if we're checking for attacks (prevents infinite recursion)
        if (!skipCastling && !piece.hasMoved && !this.isSquareUnderAttack(pos, getOppositeColor(piece.color))) {
            // Kingside castling
            if (this.canCastle(piece.color, true)) {
                moves.push({ row: pos.row, col: pos.col + 2 });
            }
            // Queenside castling
            if (this.canCastle(piece.color, false)) {
                moves.push({ row: pos.row, col: pos.col - 2 });
            }
        }

        return moves;
    }

    private getSlidingMoves(pos: Position, piece: ChessPiece, directions: { row: number; col: number }[]): Position[] {
        const moves: Position[] = [];

        for (const dir of directions) {
            let current: Position = { row: pos.row + dir.row, col: pos.col + dir.col };

            while (isValidPosition(current)) {
                const targetPiece = this.state.board[current.row][current.col];

                if (!targetPiece) {
                    moves.push({ ...current });
                } else if (targetPiece.color !== piece.color) {
                    moves.push({ ...current });
                    break; // Can capture but can't go further
                } else {
                    break; // Blocked by own piece
                }

                current = { row: current.row + dir.row, col: current.col + dir.col };
            }
        }

        return moves;
    }

    // ═══════════════════════════════════════════════════════════════
    // CHECK AND CHECKMATE DETECTION
    // ═══════════════════════════════════════════════════════════════

    /**
     * Find the king's position for a given color
     */
    private findKing(color: PlayerColor): Position | null {
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const piece = this.state.board[row][col];
                if (piece && piece.type === 'king' && piece.color === color) {
                    return { row, col };
                }
            }
        }
        return null;
    }

    /**
     * Check if a square is under attack by the opponent
     * Uses skipCastling=true to prevent infinite recursion when checking king moves
     */
    private isSquareUnderAttack(pos: Position, attackerColor: PlayerColor): boolean {
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const piece = this.state.board[row][col];
                if (piece && piece.color === attackerColor) {
                    // Skip castling when getting king moves to prevent infinite recursion
                    const moves = this.getPseudoLegalMoves({ row, col }, piece, true);
                    if (moves.some(m => positionsEqual(m, pos))) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    /**
     * Check if the given color's king is in check
     */
    private isInCheck(color: PlayerColor): boolean {
        const kingPos = this.findKing(color);
        if (!kingPos) return false;
        return this.isSquareUnderAttack(kingPos, getOppositeColor(color));
    }

    /**
     * Check if a move would leave the moving player's king in check
     */
    private moveLeavesKingInCheck(from: Position, to: Position): boolean {
        const piece = this.state.board[from.row][from.col];
        if (!piece) return true;

        // Make the move temporarily
        const originalTo = this.state.board[to.row][to.col];
        this.state.board[to.row][to.col] = piece;
        this.state.board[from.row][from.col] = null;

        // Handle en passant specially
        let capturedEnPassant: ChessPiece | null = null;
        if (piece.type === 'pawn' &&
            this.state.enPassantTarget &&
            positionsEqual(to, this.state.enPassantTarget)) {
            capturedEnPassant = this.state.board[from.row][to.col];
            this.state.board[from.row][to.col] = null;
        }

        // Check if king is in check after the move
        const inCheck = this.isInCheck(piece.color);

        // Undo the move
        this.state.board[from.row][from.col] = piece;
        this.state.board[to.row][to.col] = originalTo;
        if (capturedEnPassant) {
            this.state.board[from.row][to.col] = capturedEnPassant;
        }

        return inCheck;
    }

    /**
     * Check if the player has any legal moves
     */
    private hasLegalMoves(color: PlayerColor): boolean {
        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const piece = this.state.board[row][col];
                if (piece && piece.color === color) {
                    const moves = this.getValidMovesForPiece({ row, col });
                    if (moves.length > 0) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    /**
     * Check if castling is possible
     */
    private canCastle(color: PlayerColor, kingside: boolean): boolean {
        const row = color === 'white' ? 7 : 0;
        const kingCol = 4;
        const rookCol = kingside ? 7 : 0;

        // Check king and rook haven't moved
        const king = this.state.board[row][kingCol];
        const rook = this.state.board[row][rookCol];

        if (!king || king.type !== 'king' || king.hasMoved) return false;
        if (!rook || rook.type !== 'rook' || rook.hasMoved) return false;

        // Check path is clear
        const startCol = kingside ? 5 : 1;
        const endCol = kingside ? 6 : 3;

        for (let col = startCol; col <= endCol; col++) {
            if (this.state.board[row][col] !== null) {
                return false;
            }
        }

        // Check king doesn't pass through or end on attacked squares
        const checkCols = kingside ? [5, 6] : [2, 3];
        for (const col of checkCols) {
            if (this.isSquareUnderAttack({ row, col }, getOppositeColor(color))) {
                return false;
            }
        }

        return true;
    }

    /**
     * Update game status after a move
     */
    private updateGameStatus(nextPlayer: PlayerColor): void {
        this.state.isCheck = this.isInCheck(nextPlayer);

        const hasLegalMoves = this.hasLegalMoves(nextPlayer);

        if (!hasLegalMoves) {
            if (this.state.isCheck) {
                // Checkmate
                this.state.isCheckmate = true;
                this.state.gameResult = nextPlayer === 'white'
                    ? 'black-wins-checkmate'
                    : 'white-wins-checkmate';
                this.state.winner = nextPlayer === 'white' ? 1 : 0;
            } else {
                // Stalemate
                this.state.isStalemate = true;
                this.state.isDraw = true;
                this.state.gameResult = 'draw-stalemate';
            }
        }

        // Check for 50-move rule
        if (this.state.halfMoveClock >= 100) { // 50 moves = 100 half-moves
            this.state.isDraw = true;
            this.state.gameResult = 'draw-fifty-moves';
        }

        // Check for insufficient material
        if (this.hasInsufficientMaterial()) {
            this.state.isDraw = true;
            this.state.gameResult = 'draw-insufficient-material';
        }
    }

    /**
     * Check for insufficient material to checkmate
     */
    private hasInsufficientMaterial(): boolean {
        const pieces: ChessPiece[] = [];

        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const piece = this.state.board[row][col];
                if (piece) {
                    pieces.push(piece);
                }
            }
        }

        // Only kings
        if (pieces.length === 2) return true;

        // King vs King + Bishop or King vs King + Knight
        if (pieces.length === 3) {
            const nonKings = pieces.filter(p => p.type !== 'king');
            if (nonKings.length === 1 &&
                (nonKings[0].type === 'bishop' || nonKings[0].type === 'knight')) {
                return true;
            }
        }

        return false;
    }

    // ═══════════════════════════════════════════════════════════════
    // DRAW AND RESIGNATION HANDLING
    // ═══════════════════════════════════════════════════════════════

    private handleResign(playerColor: PlayerColor): ChessGameState {
        this.state.gameResult = playerColor === 'white'
            ? 'black-wins-resignation'
            : 'white-wins-resignation';
        this.state.winner = playerColor === 'white' ? 1 : 0;
        return this.state;
    }

    private handleOfferDraw(playerColor: PlayerColor): ChessGameState {
        this.state.drawOfferedBy = playerColor;
        return this.state;
    }

    private handleAcceptDraw(playerColor: PlayerColor): ChessGameState {
        // Can only accept if opponent offered
        if (this.state.drawOfferedBy && this.state.drawOfferedBy !== playerColor) {
            this.state.isDraw = true;
            this.state.gameResult = 'draw-agreement';
        }
        return this.state;
    }

    private handleDeclineDraw(): ChessGameState {
        this.state.drawOfferedBy = null;
        return this.state;
    }

    // ═══════════════════════════════════════════════════════════════
    // GAME STATUS METHODS (required by base class)
    // ═══════════════════════════════════════════════════════════════

    isGameOver(): boolean {
        return this.state.gameResult !== null;
    }

    getWinner(): number | null {
        return this.state.winner;
    }

    /**
     * Get all valid moves for the current player (for UI hints)
     */
    getAllValidMoves(): Map<string, Position[]> {
        const moves = new Map<string, Position[]>();
        const currentColor = this.state.currentPlayer;

        for (let row = 0; row < BOARD_SIZE; row++) {
            for (let col = 0; col < BOARD_SIZE; col++) {
                const piece = this.state.board[row][col];
                if (piece && piece.color === currentColor) {
                    const validMoves = this.getValidMovesForPiece({ row, col });
                    if (validMoves.length > 0) {
                        moves.set(`${row},${col}`, validMoves);
                    }
                }
            }
        }

        return moves;
    }
}
