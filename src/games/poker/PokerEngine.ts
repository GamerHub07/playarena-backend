import { GameEngine, GamePlayer } from "../base/GameEngine";
import { PokerState } from "./PokerTypes";
import { PokerDeck } from "./PokerDeck";

export class PokerEngine extends GameEngine<PokerState> {
  private deck: PokerDeck;
  private holeCards: Map<string, string[]> = new Map();

  constructor(roomCode: string) {
    super(roomCode);
    this.deck = new PokerDeck();
  }

  /* ───────────────────────────
     REQUIRED IMPLEMENTATIONS
  ─────────────────────────── */

  getGameType(): string {
    return "poker";
  }

  getMinPlayers(): number {
    return 2;
  }

  getMaxPlayers(): number {
    return 6;
  }

  getInitialState(): PokerState {
    return {
      phase: "WAITING",
      dealerIndex: 0,
      currentTurn: null,
      pot: 0,
      communityCards: [],
      players: [],
    };
  }

  isGameOver(): boolean {
    return this.state.phase === "ENDED";
  }

  getWinner(): number | null {
    return this.state.winnerIndex ?? null;
  }

  /* ───────────────────────────
     PLAYER MANAGEMENT
  ─────────────────────────── */

  override addPlayer(player: GamePlayer): boolean {
    const added = super.addPlayer(player);
    if (!added) return false;

    this.state.players.push({
      sessionId: player.sessionId,
      username: player.username,
      chips: 1000,
      bet: 0,
      status: "ACTIVE",
    });

    return true;
  }

  /* ───────────────────────────
     GAME START
  ─────────────────────────── */

  startGame() {
    if (!this.canStart()) return;

    this.deck.reset();
    this.holeCards.clear();

    this.state.communityCards = [];
    this.state.pot = 0;
    this.state.winnerIndex = undefined;

    this.state.players.forEach(p => {
      p.bet = 0;
      p.status = "ACTIVE";
    });

    this.dealPrivateCards();

    this.state.phase = "PREFLOP";

    // 🔥 IMPORTANT: someone MUST have the turn
    this.state.currentTurn = 0;
  }

  private dealPrivateCards() {
    this.players.forEach(p => {
      this.holeCards.set(p.sessionId, [
        this.deck.deal(),
        this.deck.deal(),
      ]);
    });
  }

  /* ───────────────────────────
     ACTION HANDLER
  ─────────────────────────── */

  handleAction(playerId: string, action: string, payload: any): PokerState {
    if (this.state.phase === "ENDED") return this.state;

    switch (action) {
      case "raise":
        return this.handleRaise(playerId, payload?.amount ?? 0);

      case "call":
        return this.handleCall(playerId);

      case "fold":
        return this.handleFold(playerId);

      default:
        return this.state;
    }
  }

  /* ───────────────────────────
     ACTIONS
  ─────────────────────────── */

  private handleRaise(playerId: string, amount: number): PokerState {
    const idx = this.getPlayerIndex(playerId);
    if (!this.isMyTurn(idx)) return this.state;

    const p = this.state.players[idx];
    if (p.chips < amount || amount <= 0) return this.state;

    p.chips -= amount;
    p.bet += amount;
    this.state.pot += amount;

    this.advanceTurn();
    return this.state;
  }

  private handleCall(playerId: string): PokerState {
    const idx = this.getPlayerIndex(playerId);
    if (!this.isMyTurn(idx)) return this.state;

    // Minimal call logic (no bet matching yet)
    this.advanceTurn();
    return this.state;
  }

  private handleFold(playerId: string): PokerState {
    const idx = this.getPlayerIndex(playerId);
    if (!this.isMyTurn(idx)) return this.state;

    this.state.players[idx].status = "FOLDED";

    const activePlayers = this.state.players.filter(
      p => p.status === "ACTIVE"
    );

    // 🔥 If only one remains → winner
    if (activePlayers.length === 1) {
      this.state.winnerIndex =
        this.state.players.indexOf(activePlayers[0]);
      this.state.phase = "ENDED";
      return this.state;
    }

    this.advanceTurn();
    return this.state;
  }

  /* ───────────────────────────
     TURN + PHASE LOGIC
  ─────────────────────────── */

  private advanceTurn() {
    if (this.state.currentTurn === null) return;

    let next =
      (this.state.currentTurn + 1) % this.state.players.length;

    // Skip folded players
    while (this.state.players[next].status !== "ACTIVE") {
      next = (next + 1) % this.state.players.length;
    }

    this.state.currentTurn = next;

    // If we looped back → advance phase
    if (next === this.state.dealerIndex) {
      this.advancePhase();
    }
  }

  private advancePhase() {
    switch (this.state.phase) {
      case "PREFLOP":
        this.state.communityCards.push(
          this.deck.deal(),
          this.deck.deal(),
          this.deck.deal()
        );
        this.state.phase = "FLOP";
        break;

      case "FLOP":
        this.state.communityCards.push(this.deck.deal());
        this.state.phase = "TURN";
        break;

      case "TURN":
        this.state.communityCards.push(this.deck.deal());
        this.state.phase = "RIVER";
        break;

      case "RIVER":
        // Placeholder winner until hand evaluation
        this.state.phase = "ENDED";
        this.state.winnerIndex = 0;
        break;
    }
  }

  /* ───────────────────────────
     HELPERS
  ─────────────────────────── */

  private getPlayerIndex(sessionId: string): number {
    return this.players.findIndex(p => p.sessionId === sessionId);
  }

  private isMyTurn(idx: number): boolean {
    return idx === this.state.currentTurn;
  }

  getPlayerCards(sessionId: string): string[] {
    return this.holeCards.get(sessionId) ?? [];
  }
}
