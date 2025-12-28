// Abstract base class for all game engines

export interface GamePlayer {
    sessionId: string;
    username: string;
    position: number;
}

export abstract class GameEngine<TState = unknown> {
    protected roomCode: string;
    protected players: GamePlayer[];
    protected state: TState;

    constructor(roomCode: string) {
        this.roomCode = roomCode;
        this.players = [];
        this.state = this.getInitialState();
    }

    abstract getInitialState(): TState;
    abstract getMinPlayers(): number;
    abstract getMaxPlayers(): number;
    abstract handleAction(playerId: string, action: string, payload: unknown): TState;
    abstract isGameOver(): boolean;
    abstract getWinner(): number | null;

    addPlayer(player: GamePlayer): boolean {
        if (this.players.length >= this.getMaxPlayers()) {
            return false;
        }
        this.players.push(player);
        return true;
    }

    removePlayer(sessionId: string): boolean {
        const index = this.players.findIndex(p => p.sessionId === sessionId);
        if (index !== -1) {
            this.players.splice(index, 1);
            return true;
        }
        return false;
    }

    canStart(): boolean {
        return this.players.length >= this.getMinPlayers();
    }

    getState(): TState {
        return this.state;
    }

    getPlayers(): GamePlayer[] {
        return this.players;
    }

    getRoomCode(): string {
        return this.roomCode;
    }
}
