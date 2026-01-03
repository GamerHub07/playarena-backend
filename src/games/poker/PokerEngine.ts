import { GameEngine, GamePlayer } from "../base/GameEngine";
import { PokerState } from "./PokerTypes";
import { PokerDeck } from "./PokerDeck";

export class PokerEngine extends GameEngine<PokerState> {
  private deck: PokerDeck;
  private holeCards: Map<string, string[]> = new Map();


  getWinner(): number | null {
  if (!this.isGameOver()) return null;
  return this.state.winnerIndex ?? null;
}

  constructor(roomCode: string) {
    super(roomCode);
    this.deck = new PokerDeck();
  }

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

  handleAction(
    playerId: string,
    action: string,
    payload: unknown
  ): PokerState {
    if (this.state.phase === "ENDED") return this.state;

    switch (action) {
      case "bet":
        return this.handleBet(playerId, payload as { amount: number });

      case "check":
        return this.handleCheck(playerId);

      case "fold":
        return this.handleFold(playerId);

      default:
        return this.state;
    }
  }

  isGameOver(): boolean {
    return this.state.phase === "ENDED";
  }

  getWinnerIndex(): number | null {
    if (!this.isGameOver()) return null;
    return this.state.winnerIndex ?? null;
  }

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

  startGame() {
    if (!this.canStart()) return;

    this.deck.reset();
    this.dealPrivateCards();

    this.state.phase = "PREFLOP";
    this.state.currentTurn =
      (this.state.dealerIndex + 1) % this.players.length;

    // this.emitState();
  }

  private dealPrivateCards() {
    this.players.forEach(p => {
      this.holeCards.set(p.sessionId, [
        this.deck.deal(),
        this.deck.deal(),
      ]);
    });
  }

  private handleBet(playerId: string, payload: { amount: number }): PokerState {
    // betting logic later
    return this.state;
  }

  private handleCheck(playerId: string): PokerState {
    return this.state;
  }

  private handleFold(playerId: string): PokerState {
    const p = this.state.players.find(p => p.sessionId === playerId);
    if (p) p.status = "FOLDED";
    return this.state;
  }

  getPlayerCards(sessionId: string): string[] {
    return this.holeCards.get(sessionId) ?? [];
  }
}
