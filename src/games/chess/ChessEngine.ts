import { Chess } from "chess.js";
import { GameEngine, SerializedGame } from "../base/GameEngine";
import {
  ChessGameState,
  ChessMove,
  ChessColor,
  ChessGameStatus,
  ChessPieceType,
} from "./chess.types";

export class ChessEngine extends GameEngine<ChessGameState> {
  private chess = new Chess();
  protected state: ChessGameState;
  private playerColorMap = new Map<string, ChessColor>();

  constructor(roomCode: string) {
    super(roomCode);
    this.state = this.buildState();
  }

  getGameType() { return "chess"; }
  getMinPlayers() { return 2; }
  getMaxPlayers() { return 2; }
  getInitialState() { return this.state; }

  onGameStart() {
    if (this.players.length === 2) {
      this.playerColorMap.set(this.players[0].sessionId, "white");
      this.playerColorMap.set(this.players[1].sessionId, "black");
      // Rebuild state to include the player colors
      this.state = this.buildState();
    }
  }

  resetGame() {
    // Reset to initial position for rematch (swap colors)
    this.chess.reset();
    // Swap colors for fairness
    if (this.players.length === 2) {
      const player1Color = this.playerColorMap.get(this.players[0].sessionId);
      this.playerColorMap.set(this.players[0].sessionId, player1Color === "white" ? "black" : "white");
      this.playerColorMap.set(this.players[1].sessionId, player1Color === "white" ? "white" : "black");
    }
    this.drawOfferedBy = null;
    this.state = this.buildState();
  }

  // Track draw offers
  private drawOfferedBy: string | null = null;

  handleAction(playerId: string, action: string, payload: unknown) {
    console.log(`♟️ ChessEngine.handleAction:`, { playerId, action, payload });

    switch (action) {
      case "move":
        return this.handleMove(playerId, payload);
      case "offerDraw":
        this.drawOfferedBy = playerId;
        return this.state;
      case "acceptDraw":
        if (this.drawOfferedBy && this.drawOfferedBy !== playerId) {
          this.state = { ...this.buildState(), status: "draw", winner: null };
          this.drawOfferedBy = null;
        }
        return this.state;
      case "rejectDraw":
        this.drawOfferedBy = null;
        return this.state;
      case "abort":
        // Opponent of aborting player wins
        const abortingPlayerColor = this.playerColorMap.get(playerId);
        const winnerColor = abortingPlayerColor === "white" ? "black" : "white";
        this.state = { ...this.buildState(), status: "checkmate", winner: winnerColor };
        return this.state;
      case "resign":
        // Opponent of resigning player wins
        const resigningPlayerColor = this.playerColorMap.get(playerId);
        const resignWinnerColor = resigningPlayerColor === "white" ? "black" : "white";
        this.state = { ...this.buildState(), status: "checkmate", winner: resignWinnerColor };
        return this.state;
      default:
        console.log(`❌ Unknown action: ${action}`);
        return this.state;
    }
  }

  private handleMove(playerId: string, payload: unknown) {
    const playerColor = this.playerColorMap.get(playerId);
    const turn: ChessColor = this.chess.turn() === "w" ? "white" : "black";

    console.log(`🎨 Player color: ${playerColor}, Current turn: ${turn}`);
    console.log(`🗺️ playerColorMap:`, Object.fromEntries(this.playerColorMap));

    if (!playerColor || playerColor !== turn) {
      console.log(`❌ Not player's turn or player not found`);
      return this.state;
    }

    const move = payload as ChessMove;
    console.log(`🚀 Attempting move:`, move);

    const result = this.chess.move(move);
    console.log(`📝 Move result:`, result);

    if (!result) {
      console.log(`❌ Invalid move`);
      return this.state;
    }

    this.state = this.buildState();
    console.log(`✅ Move successful, new turn: ${this.state.turn}`);
    return this.state;
  }

  isGameOver() {
    return this.state.status === "checkmate" || this.state.status === "stalemate" || this.state.status === "draw";
  }

  getWinner() {
    if (!this.state.winner) return null;
    return this.state.winner === "white" ? 0 : 1;
  }

  getCurrentPlayerIndex(): number {
    const turn = this.chess.turn() === "w" ? "white" : "black";
    return this.players.findIndex((p) => this.playerColorMap.get(p.sessionId) === turn);
  }

  autoPlay(playerIndex: number): ChessGameState {
    // Only auto-play if it's actually this player's turn
    if (playerIndex !== this.getCurrentPlayerIndex()) {
      return this.state;
    }

    const moves = this.chess.moves();
    if (moves.length > 0) {
      const randomMove = moves[Math.floor(Math.random() * moves.length)];
      this.chess.move(randomMove);
      this.state = this.buildState();
    }
    return this.state;
  }

  eliminatePlayer(playerIndex: number): void {
    if (playerIndex < 0 || playerIndex >= this.players.length) return;

    const player = this.players[playerIndex];
    const playerColor = this.playerColorMap.get(player.sessionId);

    // Opponent wins
    const winnerColor = playerColor === "white" ? "black" : "white";
    this.state = {
      ...this.buildState(),
      status: "checkmate",
      winner: winnerColor
    };
  }

  getState() { return this.state; }

  serialize(): SerializedGame<ChessGameState> {
    return {
      gameType: "chess",
      roomCode: this.roomCode,
      players: [],
      state: this.state,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  restore(data: SerializedGame<ChessGameState>) {
    this.chess.load(data.state.fen);
    this.state = this.buildState();
  }

  private buildState(): ChessGameState {
    let status: ChessGameStatus = "playing";
    let winner: ChessColor | null = null;

    if (this.chess.isCheckmate()) {
      status = "checkmate";
      winner = this.chess.turn() === "w" ? "black" : "white";
    } else if (this.chess.isStalemate()) {
      status = "stalemate";
    } else if (
      this.chess.isDraw() ||
      this.chess.isThreefoldRepetition()
    ) {
      status = "draw";
    } else if (this.chess.isCheck()) {
      status = "check";
    }

    return {
      board: [],
      fen: this.chess.fen(),
      turn: this.chess.turn() === "w" ? "white" : "black",
      status,
      winner,
      moveHistory: this.chess.history({ verbose: true }).map((m) => ({
        from: m.from,
        to: m.to,
        san: m.san,
        promotion: m.promotion,
      })),
      playerColors: Object.fromEntries(this.playerColorMap),
    };
  }

  private mapPieceType(type: string): ChessPieceType {
    return (
      { p: "pawn", r: "rook", n: "knight", b: "bishop", q: "queen", k: "king" }[
      type
      ] as ChessPieceType
    );
  }
}
