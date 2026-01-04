
import { PokerEngine } from './src/games/poker/PokerEngine';
import { GamePlayer } from './src/games/base/GameEngine';

const runTest = () => {
    console.log("🃏 Starting Poker Test...");
    const engine = new PokerEngine("TEST_ROOM");

    const p1: GamePlayer = { sessionId: "p1", username: "Alice", position: 0 };
    const p2: GamePlayer = { sessionId: "p2", username: "Bob", position: 1 };
    const p3: GamePlayer = { sessionId: "p3", username: "Charlie", position: 2 };

    engine.addPlayer(p1);
    engine.addPlayer(p2);
    engine.addPlayer(p3);

    console.log("Added 3 players. Starting game...");
    engine.startGame();

    let state = engine.getState();
    console.log(`Phase: ${state.phase}, Pot: ${state.pot}, Dealer: ${state.dealerIndex}`);
    // Dealer is 1 (Bob).
    // SB = 2 (Charlie). BB = 0 (Alice).
    // Preflop Turn Order: UTG (1-Bob) -> SB (2-Charlie) -> BB (0-Alice) (wait, UTG is left of BB?)
    // BB is 0. Left of 0 is 1. So 1 (Bob) starts. Correct.

    console.log(`Current Turn: ${state.currentTurn} (Expected 1-Bob)`);

    // Bob calls 20
    console.log("Bob (UTG/D) calls 20...");
    state = engine.handleAction("p2", "call", {});

    // Charlie (SB) calls (needs 10 more)
    console.log("Charlie (SB) calls 10...");
    state = engine.handleAction("p3", "call", {});

    // Alice (BB) checks
    console.log("Alice (BB) checks...");
    state = engine.handleAction("p1", "check", {});

    console.log(`Phase After Preflop: ${state.phase} (Expected FLOP)`);
    console.log(`Community Cards: ${state.communityCards}`);

    // Flop Order: SB(2-Charlie) -> BB(0-Alice) -> BTN(1-Bob)
    console.log("Flop: Charlie (SB) checks...");
    state = engine.handleAction("p3", "check", {});

    console.log("Flop: Alice (BB) checks...");
    state = engine.handleAction("p1", "check", {});

    console.log("Flop: Bob (BTN) checks...");
    state = engine.handleAction("p2", "check", {});

    console.log(`Phase After Flop: ${state.phase} (Expected TURN)`);

    // Turn: Charlie checks
    console.log("Turn: Charlie checks...");
    state = engine.handleAction("p3", "check", {});

    // Alice bets 50
    console.log("Turn: Alice bets 50...");
    state = engine.handleAction("p1", "raise", { amount: 50 });

    // Bob calls
    console.log("Turn: Bob calls 50...");
    state = engine.handleAction("p2", "call", {});

    // Charlie folds
    console.log("Turn: Charlie folds...");
    state = engine.handleAction("p3", "fold", {});

    console.log(`Phase After Turn: ${state.phase} (Expected RIVER)`);

    // River Order: Alice -> Bob (Charlie folded)
    console.log("River: Alice checks...");
    state = engine.handleAction("p1", "check", {});

    console.log("River: Bob checks...");
    state = engine.handleAction("p2", "check", {});

    console.log(`Phase After River: ${state.phase} (Expected ENDED)`);
    console.log(`Winner Index: ${state.winnerIndex}`);
    console.log(`Winner Hand: ${state.winnerHand}`);
    console.log(`Winner Pot: ${state.pot} (Should be 0 if distributed, or total?)`);
    // Note: handleShowdown distributes pot, so pot might remain or reset? 
    // Usually engine pot variable is accumulated, chips updated.

    console.log("Players State:", JSON.stringify(state.players.map(p => ({
        user: p.username,
        chips: p.chips,
        status: p.status
    })), null, 2));
};

runTest();
