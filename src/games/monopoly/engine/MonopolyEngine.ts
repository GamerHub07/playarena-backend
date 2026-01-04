import { GameEngine } from "../../base/GameEngine";
import { BOARD } from "../data/board";
import {
  MonopolyGameState,
  MonopolyPlayerState,
} from "../types/monopoly.types";
import { assertPlayersTurn } from "./RuleValidator";
import { resolveSquare } from "./BoardResolver";
import { advanceTurn } from "./TurnManager";

export class MonopolyEngine extends GameEngine<MonopolyGameState> {
  getGameType(): string {
    return "monopoly";
  }

  getMinPlayers(): number {
    return 2;
  }

  getMaxPlayers(): number {
    return 6;
  }

  getInitialState(): MonopolyGameState {
    return {
      currentTurnIndex: 0,
      phase: "ROLL",
      dice: null,
      board: JSON.parse(JSON.stringify(BOARD)),
      playerState: {},
      doublesCount: 0,
    };
  }

  addPlayer(player: any): boolean {
    const added = super.addPlayer(player);
    if (added) {
      this.state.playerState[player.sessionId] = {
        sessionId: player.sessionId,
        username: player.username,
        position: 0,
        cash: 1500,
        properties: [],
        inJail: false,
        jailTurns: 0,
        bankrupt: false,
      };
    }
    return added;
  }

  handleAction(playerId: string, action: string, payload: unknown) {
    const orderedPlayers = this.players.map((p) => p.sessionId);

    assertPlayersTurn(playerId, this.state, orderedPlayers);

    const player = this.state.playerState[playerId];

    switch (action) {
      case "ROLL_DICE": {
        if (this.state.phase !== "ROLL") {
          throw new Error("Invalid phase");
        }

        const d1 = Math.ceil(Math.random() * 6);
        const d2 = Math.ceil(Math.random() * 6);
        this.state.dice = [d1, d2];
        const isDoubles = d1 === d2;

        // Handle jail
        if (player.inJail) {
          player.jailTurns++;
          // Rolled doubles - get out of jail free
          if (isDoubles) {
            player.inJail = false;
            player.jailTurns = 0;
            this.state.doublesCount = 1; // Count this as first double
            player.position = (player.position + d1 + d2) % this.state.board.length;
            this.state.phase = "RESOLVE";
            resolveSquare(this.state, playerId, orderedPlayers);
          } else if (player.jailTurns >= 3) {
            // After 3 turns, must pay $50 and move
            player.cash -= 50;
            player.inJail = false;
            player.jailTurns = 0;
            this.state.doublesCount = 0;
            player.position = (player.position + d1 + d2) % this.state.board.length;
            this.state.phase = "RESOLVE";
            resolveSquare(this.state, playerId, orderedPlayers);
          } else {
            // Stay in jail, end turn
            this.state.phase = "END_TURN";
          }
        } else {
          // Track consecutive doubles
          if (isDoubles) {
            this.state.doublesCount++;
            // 3 consecutive doubles = go to jail!
            if (this.state.doublesCount >= 3) {
              const JAIL_INDEX = this.state.board.findIndex(s => s.type === "JAIL");
              player.position = JAIL_INDEX;
              player.inJail = true;
              this.state.doublesCount = 0;
              this.state.phase = "END_TURN";
              break;
            }
          } else {
            this.state.doublesCount = 0;
          }
          // Normal movement
          player.position = (player.position + d1 + d2) % this.state.board.length;
          this.state.phase = "RESOLVE";
          resolveSquare(this.state, playerId, orderedPlayers);
        }
        break;
      }

      case "PAY_JAIL_FINE": {
        if (!player.inJail) {
          throw new Error("Not in jail");
        }
        if (player.cash < 50) {
          throw new Error("Insufficient funds");
        }
        player.cash -= 50;
        player.inJail = false;
        player.jailTurns = 0;
        // Now player can roll normally
        break;
      }

      case "USE_JAIL_CARD": {
        if (!player.inJail) {
          throw new Error("Not in jail");
        }
        if (!player.hasGetOutOfJailCard) {
          throw new Error("No Get Out of Jail card");
        }
        player.hasGetOutOfJailCard = false;
        player.inJail = false;
        player.jailTurns = 0;
        break;
      }

      case "BUY_PROPERTY": {
        const square = this.state.board[player.position];
        if (!["PROPERTY", "RAILROAD", "UTILITY"].includes(square.type) || square.owner) {
          throw new Error("Property not available");
        }
        if (player.cash < (square.price ?? 0)) {
          throw new Error("Insufficient funds");
        }

        player.cash -= square.price!;
        square.owner = playerId;
        player.properties.push(square.id);
        // Check for doubles - player gets another roll
        const isDoublesRoll = this.state.dice && this.state.dice[0] === this.state.dice[1];
        this.state.phase = isDoublesRoll ? "ROLL" : "END_TURN";
        break;
      }

      case "SELL_PROPERTY": {
        const { propertyId } = payload as { propertyId: string };
        const propIndex = player.properties.indexOf(propertyId);
        if (propIndex === -1) {
          throw new Error("Player does not own this property");
        }
        const square = this.state.board.find(s => s.id === propertyId);
        if (!square) {
          throw new Error("Property not found");
        }

        // Sell for half price
        player.cash += Math.floor((square.price ?? 0) / 2);
        player.properties.splice(propIndex, 1);
        square.owner = null;

        // If in DEBT phase, check if debt is resolved
        if (this.state.phase === "DEBT") {
          if (player.cash >= 0) {
            // Debt resolved - check if doubles were rolled for next phase
            const isDoubles = this.state.dice && this.state.dice[0] === this.state.dice[1];
            this.state.phase = isDoubles ? "ROLL" : "END_TURN";
          } else if (player.properties.length === 0) {
            // No more properties to sell and still in debt - bankrupt
            player.cash = 0;
            player.bankrupt = true;
            this.state.phase = "END_TURN";
          }
          // Otherwise stay in DEBT phase to sell more
        }
        break;
      }

      case "DECLINE_PROPERTY": {
        // Player declined to buy - check for doubles
        if (this.state.phase !== "DECISION") {
          throw new Error("Not in decision phase");
        }
        const isDoublesDecline = this.state.dice && this.state.dice[0] === this.state.dice[1];
        this.state.phase = isDoublesDecline ? "ROLL" : "END_TURN";
        break;
      }
      case "BUILD_HOUSE": {
        const { propertyId } = payload as { propertyId: string };
        const square = this.state.board.find(s => s.id === propertyId);

        if (!square || square.type !== "PROPERTY") {
          throw new Error("Invalid property");
        }

        if (square.owner !== playerId) {
          throw new Error("You don't own this property");
        }

        // Import validation function
        const { canBuildHouse } = require("./RentCalculator");
        const result = canBuildHouse(this.state, playerId, propertyId);

        if (!result.canBuild) {
          throw new Error(result.reason || "Cannot build house");
        }

        const cost = square.houseCost ?? 0;
        player.cash -= cost;
        square.houses = (square.houses ?? 0) + 1;

        // Don't change phase - player can keep building or take other actions
        break;
      }

      case "BUILD_HOTEL": {
        const { propertyId: hotelPropertyId } = payload as { propertyId: string };
        const hotelSquare = this.state.board.find(s => s.id === hotelPropertyId);

        if (!hotelSquare || hotelSquare.type !== "PROPERTY") {
          throw new Error("Invalid property");
        }

        if (hotelSquare.owner !== playerId) {
          throw new Error("You don't own this property");
        }

        // Import validation function
        const { canBuildHotel } = require("./RentCalculator");
        const hotelResult = canBuildHotel(this.state, playerId, hotelPropertyId);

        if (!hotelResult.canBuild) {
          throw new Error(hotelResult.reason || "Cannot build hotel");
        }

        const hotelCost = hotelSquare.houseCost ?? 0;
        player.cash -= hotelCost;
        hotelSquare.houses = 5; // 5 = hotel

        // Don't change phase - player can keep building or take other actions
        break;
      }
      case "END_TURN":
        advanceTurn(this.state, orderedPlayers);
        break;

      default:
        throw new Error("Unknown action");
    }

    this.updatedAt = Date.now();
    return this.state;
  }

  isGameOver(): boolean {
    const alive = Object.values(this.state.playerState).filter(
      (p) => !p.bankrupt
    );
    return alive.length <= 1;
  }

  getWinner(): number | null {
    if (!this.isGameOver()) return null;
    const winnerId = Object.values(this.state.playerState).find(
      (p) => !p.bankrupt
    )?.sessionId;
    return this.players.findIndex((p) => p.sessionId === winnerId);
  }
}
