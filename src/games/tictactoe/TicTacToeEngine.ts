/**
 * Tic Tac Toe Game Engine
 * 
 * Classic 3x3 Tic Tac Toe implementation.
 * Handles full game logic including:
 * - Placing X/O markers
 * - Turn management
 * - Win detection (rows, columns, diagonals)
 * - Draw detection
 */

import { GameEngine, GamePlayer } from '../base/GameEngine';
import {
    TicTacToeGameState,
    TicTacToePlayerState,
    TicTacToeMovePayload,
    CellValue,
    BOARD_SIZE,
    MIN_PLAYERS,
    MAX_PLAYERS,
    PLAYER_SYMBOLS,
    WINNING_COMBINATIONS,
    isValidCellIndex,
} from './TicTacToeTypes';

export class TicTacToeEngine extends GameEngine<TicTacToeGameState> {

    getGameType(): string {
        return 'tictactoe';
    }

    getMinPlayers(): number {
        return MIN_PLAYERS;
    }

    getMaxPlayers(): number {
        return MAX_PLAYERS;
    }

    getInitialState(): TicTacToeGameState {
        return {
            board: Array(BOARD_SIZE).fill(null),
            currentPlayer: 0,
            players: {},
            winner: null,
            isDraw: false,
            gameStarted: false,
            winningLine: null,
            lastMove: null,
        };
    }

    /**
     * Initialize the game with joined players
     */
    initializeGame(): void {
        // Reset the board
        this.state.board = Array(BOARD_SIZE).fill(null);
        this.state.currentPlayer = 0;
        this.state.winner = null;
        this.state.isDraw = false;
        this.state.winningLine = null;
        this.state.lastMove = null;
        this.state.gameStarted = true;

        // Assign symbols to players
        this.players.forEach((player, index) => {
            this.state.players[index] = {
                symbol: PLAYER_SYMBOLS[index],
                moves: 0,
            };
        });

        this.updatedAt = Date.now();
    }

    /**
     * Handle a player action
     */
    handleAction(playerId: string, action: string, payload: unknown): TicTacToeGameState {
        switch (action) {
            case 'move':
                return this.handleMove(playerId, payload as TicTacToeMovePayload);
            case 'restart':
                return this.handleRestart();
            default:
                throw new Error(`Unknown action: ${action}`);
        }
    }

    /**
     * Restart the game - reset board but keep players
     */
    private handleRestart(): TicTacToeGameState {
        this.state.board = Array(BOARD_SIZE).fill(null);
        this.state.currentPlayer = 0;
        this.state.winner = null;
        this.state.isDraw = false;
        this.state.winningLine = null;
        this.state.lastMove = null;

        // Reset player move counts
        Object.keys(this.state.players).forEach(key => {
            this.state.players[parseInt(key)].moves = 0;
        });

        this.updatedAt = Date.now();
        return this.state;
    }

    /**
     * Handle a move action (placing X or O)
     */
    private handleMove(playerId: string, payload: TicTacToeMovePayload): TicTacToeGameState {
        const { cellIndex } = payload;

        // Get player index
        const playerIndex = this.players.findIndex(p => p.sessionId === playerId);
        if (playerIndex === -1) {
            throw new Error('Player not found');
        }

        // Validate it's this player's turn
        if (playerIndex !== this.state.currentPlayer) {
            throw new Error('Not your turn');
        }

        // Check game is not over
        if (this.state.winner !== null || this.state.isDraw) {
            throw new Error('Game is already over');
        }

        // Validate cell index
        if (!isValidCellIndex(cellIndex)) {
            throw new Error('Invalid cell index');
        }

        // Check cell is empty
        if (this.state.board[cellIndex] !== null) {
            throw new Error('Cell is already occupied');
        }

        // Place the marker
        const symbol = this.state.players[playerIndex].symbol;
        this.state.board[cellIndex] = symbol;
        this.state.lastMove = cellIndex;
        this.state.players[playerIndex].moves++;

        // Check for win
        const winningLine = this.checkWin(symbol);
        if (winningLine) {
            this.state.winner = playerIndex;
            this.state.winningLine = winningLine;
        }
        // Check for draw (board full)
        else if (this.isBoardFull()) {
            this.state.isDraw = true;
        }
        // Switch turns
        else {
            this.state.currentPlayer = (this.state.currentPlayer + 1) % 2;
        }

        this.updatedAt = Date.now();
        return this.state;
    }

    /**
     * Check if the given symbol has won
     * Returns the winning line indices if won, null otherwise
     */
    private checkWin(symbol: CellValue): number[] | null {
        for (const combination of WINNING_COMBINATIONS) {
            const [a, b, c] = combination;
            if (
                this.state.board[a] === symbol &&
                this.state.board[b] === symbol &&
                this.state.board[c] === symbol
            ) {
                return combination;
            }
        }
        return null;
    }

    /**
     * Check if the board is full (draw condition)
     */
    private isBoardFull(): boolean {
        return this.state.board.every(cell => cell !== null);
    }

    /**
     * Check if game has ended
     */
    isGameOver(): boolean {
        return this.state.winner !== null || this.state.isDraw;
    }

    /**
     * Get winner index, or null if no winner
     */
    getWinner(): number | null {
        return this.state.winner;
    }

    /**
     * Get current player index
     */
    getCurrentPlayerIndex(): number {
        return this.state.currentPlayer;
    }

    /**
     * Auto-play for disconnected player (random move)
     * Used by turnTimer when a player times out
     */
    autoPlay(playerIndex: number): TicTacToeGameState {
        if (this.state.currentPlayer !== playerIndex) {
            return this.state;
        }

        // Find empty cells
        const emptyCells: number[] = [];
        this.state.board.forEach((cell, index) => {
            if (cell === null) {
                emptyCells.push(index);
            }
        });

        if (emptyCells.length === 0) {
            return this.state;
        }

        // Pick random empty cell
        const randomIndex = Math.floor(Math.random() * emptyCells.length);
        const cellIndex = emptyCells[randomIndex];

        // Make the move
        const playerId = this.players[playerIndex].sessionId;
        return this.handleMove(playerId, { cellIndex });
    }

    /**
     * Eliminate player (forfeit - opponent wins)
     */
    eliminatePlayer(playerIndex: number): void {
        if (!this.isGameOver()) {
            // Other player wins
            this.state.winner = (playerIndex + 1) % 2;
        }
        this.updatedAt = Date.now();
    }
}
