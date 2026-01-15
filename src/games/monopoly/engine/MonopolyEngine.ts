import { GameEngine } from "../../base/GameEngine";
import { BOARD } from "../data/board";
import {
  MonopolyGameState,
  MonopolyPlayerState,
  TradeOffer,
} from "../types/monopoly.types";
import { assertPlayersTurn } from "./RuleValidator";
import { resolveSquare } from "./BoardResolver";
import { advanceTurn } from "./TurnManager";
import { logPassGo, logJailFine, logPropertyBought, logPropertySold, logHouseBuilt, logHotelBuilt, logHouseSold, logJailStay, logJailRelease, logTradeProposed, logTradeAccepted, logTradeRejected, logTradeCancelled } from "./GameLogger";

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
      gameLog: [],
      bankruptcyOrder: [],
      pendingTrades: [],
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

    // Trade actions can happen anytime, no turn check needed
    const noTurnCheckActions = ['PROPOSE_TRADE', 'ACCEPT_TRADE', 'REJECT_TRADE', 'CANCEL_TRADE'];
    if (!noTurnCheckActions.includes(action)) {
      assertPlayersTurn(playerId, this.state, orderedPlayers);
    }

    const player = this.state.playerState[playerId];

    switch (action) {
      case "ROLL_DICE": {
        // Allow rolling from ROLL phase (normal) or JAIL phase (trying to roll doubles)
        if (this.state.phase !== "ROLL" && this.state.phase !== "JAIL") {
          throw new Error("Invalid phase");
        }

        const d1 = Math.ceil(Math.random() * 6);
        const d2 = Math.ceil(Math.random() * 6);
        this.state.dice = [d1, d2];
        const isDoubles = d1 === d2;
        // Helper to move player and collect $200 if passing GO
        const movePlayer = (spaces: number) => {
          const oldPosition = player.position;
          const newPosition = (oldPosition + spaces) % this.state.board.length;
          // Passed GO if we wrapped around (new position < old position means we crossed position 0)
          if (newPosition < oldPosition) {
            player.cash += 200;
            logPassGo(this.state, playerId);
          }
          player.position = newPosition;
        };


        // Handle jail
        if (player.inJail) {
          player.jailTurns++;
          // Rolled doubles - get out of jail free
          if (isDoubles) {
            player.inJail = false;
            player.jailTurns = 0;
            this.state.doublesCount = 1; // Count this as first double
            logJailRelease(this.state, playerId, "rolled doubles");
            movePlayer(d1 + d2);
            this.state.phase = "RESOLVE";
            resolveSquare(this.state, playerId, orderedPlayers);
          } else if (player.jailTurns >= 3) {
            // After 3 turns, must pay $50 and move
            player.cash -= 50;
            logJailFine(this.state, playerId, 50);
            player.inJail = false;
            player.jailTurns = 0;
            this.state.doublesCount = 0;
            logJailRelease(this.state, playerId, "paid fine after 3 turns");
            movePlayer(d1 + d2);
            this.state.phase = "RESOLVE";
            resolveSquare(this.state, playerId, orderedPlayers);
          } else {
            // Stay in jail, end turn
            logJailStay(this.state, playerId);
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
              player.jailTurns = 0; // Reset jail turns
              this.state.doublesCount = 0;
              this.state.phase = "END_TURN";
              break;
            }
          } else {
            this.state.doublesCount = 0;
          }
          // Normal movement
          movePlayer(d1 + d2);
          this.state.phase = "RESOLVE";
          resolveSquare(this.state, playerId, orderedPlayers);
        }
        break;
      }

      case "PAY_JAIL_FINE": {
        if (this.state.phase !== "JAIL") {
          throw new Error("Not in jail phase");
        }
        if (!player.inJail) {
          throw new Error("Not in jail");
        }
        if (player.cash < 50) {
          throw new Error("Insufficient funds");
        }
        player.cash -= 50;
        logJailFine(this.state, playerId, 50);
        player.inJail = false;
        player.jailTurns = 0;
        // Now player can roll normally
        this.state.phase = "ROLL";
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
        logJailRelease(this.state, playerId, "used card");
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
        logPropertyBought(this.state, playerId, square.price!, square.name || square.id);
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
        const salePrice = Math.floor((square.price ?? 0) / 2);
        player.cash += salePrice;
        logPropertySold(this.state, playerId, salePrice, square.name || square.id);
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
        logHouseBuilt(this.state, playerId, cost, square.name || square.id, square.houses);

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
        logHotelBuilt(this.state, playerId, hotelCost, hotelSquare.name || hotelSquare.id);

        // Don't change phase - player can keep building or take other actions
        break;
      }

      case "SELL_HOUSE": {
        const { propertyId: sellHousePropertyId } = payload as { propertyId: string };
        const sellHouseSquare = this.state.board.find(s => s.id === sellHousePropertyId);

        if (!sellHouseSquare || sellHouseSquare.type !== "PROPERTY") {
          throw new Error("Invalid property");
        }

        if (sellHouseSquare.owner !== playerId) {
          throw new Error("You don't own this property");
        }

        const currentHouses = sellHouseSquare.houses ?? 0;
        if (currentHouses === 0) {
          throw new Error("No houses to sell");
        }

        // Check even building rule - can only sell if this property has the most houses in the color group
        const colorProps = this.state.board.filter(
          s => s.type === "PROPERTY" && s.color === sellHouseSquare.color
        );
        const maxHouses = Math.max(...colorProps.map(p => p.houses ?? 0));
        if (currentHouses < maxHouses) {
          throw new Error("Must sell houses evenly - sell from properties with more houses first");
        }

        // Sell house at half price
        const houseCost = sellHouseSquare.houseCost ?? 0;
        const salePrice = Math.floor(houseCost / 2);
        player.cash += salePrice;
        sellHouseSquare.houses = currentHouses - 1;
        logHouseSold(this.state, playerId, salePrice, sellHouseSquare.name || sellHouseSquare.id);

        // If in DEBT phase, check if debt is resolved
        if (this.state.phase === "DEBT") {
          if (player.cash >= 0) {
            const isDoubles = this.state.dice && this.state.dice[0] === this.state.dice[1];
            this.state.phase = isDoubles ? "ROLL" : "END_TURN";
          }
        }
        break;
      }

      case "END_TURN":
        advanceTurn(this.state, orderedPlayers);
        break;

      case "PROPOSE_TRADE": {
        const { toPlayerId, offeringProperties, offeringCash, requestingProperties, requestingCash } = payload as {
          toPlayerId: string;
          offeringProperties: string[];
          offeringCash: number;
          requestingProperties: string[];
          requestingCash: number;
        };

        const targetPlayer = this.state.playerState[toPlayerId];
        if (!targetPlayer || targetPlayer.bankrupt) {
          throw new Error("Target player not found or is bankrupt");
        }

        // Validate offering player owns the properties
        for (const propId of offeringProperties) {
          if (!player.properties.includes(propId)) {
            throw new Error("You don't own a property you're trying to trade");
          }
          const square = this.state.board.find(s => s.id === propId);
          if (square && (square.houses ?? 0) > 0) {
            throw new Error("Cannot trade properties with houses. Sell houses first.");
          }
        }

        // Validate target player owns requested properties
        for (const propId of requestingProperties) {
          if (!targetPlayer.properties.includes(propId)) {
            throw new Error("Target player doesn't own a property you're requesting");
          }
          const square = this.state.board.find(s => s.id === propId);
          if (square && (square.houses ?? 0) > 0) {
            throw new Error("Cannot trade properties with houses. They must sell houses first.");
          }
        }

        // Validate cash amounts
        if (offeringCash > player.cash) {
          throw new Error("You don't have enough cash to offer");
        }

        // Remove any existing pending trade between these players
        this.state.pendingTrades = this.state.pendingTrades.filter(
          t => !(t.fromPlayerId === playerId && t.toPlayerId === toPlayerId && t.status === 'pending')
        );

        // Create new trade offer
        const tradeOffer: TradeOffer = {
          id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          fromPlayerId: playerId,
          toPlayerId,
          offeringProperties,
          offeringCash,
          requestingProperties,
          requestingCash,
          status: 'pending',
          createdAt: Date.now(),
        };

        this.state.pendingTrades.push(tradeOffer);
        logTradeProposed(this.state, playerId, toPlayerId);
        break;
      }

      case "ACCEPT_TRADE": {
        const { tradeId } = payload as { tradeId: string };
        const trade = this.state.pendingTrades.find(t => t.id === tradeId && t.status === 'pending');
        
        if (!trade) {
          throw new Error("Trade not found or already processed");
        }

        if (trade.toPlayerId !== playerId) {
          throw new Error("You can only accept trades sent to you");
        }

        const fromPlayer = this.state.playerState[trade.fromPlayerId];
        const toPlayer = this.state.playerState[trade.toPlayerId];

        if (!fromPlayer || fromPlayer.bankrupt || !toPlayer || toPlayer.bankrupt) {
          throw new Error("One of the players is no longer valid");
        }

        // Validate cash availability
        if (fromPlayer.cash < trade.offeringCash) {
          throw new Error("Proposer no longer has enough cash");
        }
        if (toPlayer.cash < trade.requestingCash) {
          throw new Error("You don't have enough cash");
        }

        // Execute trade - swap properties
        for (const propId of trade.offeringProperties) {
          fromPlayer.properties = fromPlayer.properties.filter(p => p !== propId);
          toPlayer.properties.push(propId);
          const square = this.state.board.find(s => s.id === propId);
          if (square) square.owner = trade.toPlayerId;
        }

        for (const propId of trade.requestingProperties) {
          toPlayer.properties = toPlayer.properties.filter(p => p !== propId);
          fromPlayer.properties.push(propId);
          const square = this.state.board.find(s => s.id === propId);
          if (square) square.owner = trade.fromPlayerId;
        }

        // Swap cash
        fromPlayer.cash -= trade.offeringCash;
        toPlayer.cash += trade.offeringCash;
        toPlayer.cash -= trade.requestingCash;
        fromPlayer.cash += trade.requestingCash;

        trade.status = 'accepted';
        logTradeAccepted(this.state, trade.fromPlayerId, trade.toPlayerId);
        break;
      }

      case "REJECT_TRADE": {
        const { tradeId: rejectTradeId } = payload as { tradeId: string };
        const rejectTrade = this.state.pendingTrades.find(t => t.id === rejectTradeId && t.status === 'pending');
        
        if (!rejectTrade) {
          throw new Error("Trade not found or already processed");
        }

        if (rejectTrade.toPlayerId !== playerId) {
          throw new Error("You can only reject trades sent to you");
        }

        rejectTrade.status = 'rejected';
        logTradeRejected(this.state, rejectTrade.fromPlayerId, rejectTrade.toPlayerId);
        break;
      }

      case "CANCEL_TRADE": {
        const { tradeId: cancelTradeId } = payload as { tradeId: string };
        const cancelTrade = this.state.pendingTrades.find(t => t.id === cancelTradeId && t.status === 'pending');
        
        if (!cancelTrade) {
          throw new Error("Trade not found or already processed");
        }

        if (cancelTrade.fromPlayerId !== playerId) {
          throw new Error("You can only cancel trades you proposed");
        }

        cancelTrade.status = 'cancelled';
        logTradeCancelled(this.state, playerId);
        break;
      }

      case "BANKRUPT": {
        player.bankrupt = true;
        this.state.bankruptcyOrder.push(playerId);
        player.cash = 0;
        
        // Return properties to bank
        player.properties.forEach(propId => {
          const square = this.state.board.find(s => s.id === propId);
          if (square) {
            square.owner = null;
            square.houses = 0;
          }
        });
        player.properties = [];

        // If it was their turn, advance
        if (this.state.currentTurnIndex === orderedPlayers.indexOf(playerId)) {
           advanceTurn(this.state, orderedPlayers);
        }
        break;
      }

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
