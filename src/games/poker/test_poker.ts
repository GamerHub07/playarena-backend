
import { PokerEngine } from './PokerEngine';
import { PlayerState } from './PokerTypes';

// Mock Player
const mockPlayers = [
    { sessionId: 'p1', username: 'Alice', position: 0 },
    { sessionId: 'p2', username: 'Bob', position: 1 },
    { sessionId: 'p3', username: 'Charlie', position: 2 }
];

function runTest() {
    console.log('🃏 Starting Poker Logic Test...\n');

    // 1. Initialize Engine
    const engine = new PokerEngine('TEST_ROOM');

    // Add players (simulating what the Handler does)
    mockPlayers.forEach(p => engine.addPlayer(p));

    console.log(`✅ Added ${mockPlayers.length} players`);

    // 2. Start Game
    let state = engine.handleAction('p1', 'init', null);
    console.log('✅ Game initialized');
    console.log(`   Phase: ${state.currentPhase}`);
    console.log(`   Pot: ${state.pot}`);
    console.log(`   Current Player: ${state.players[state.currentPlayer].username}`);

    // Verify Blinds
    const sb = state.players[1]; // Bob (SB)
    const bb = state.players[2]; // Charlie (BB)

    if (sb.currentBet !== 10 || bb.currentBet !== 20) {
        console.error('❌ Blinds incorrect!', { sb: sb.currentBet, bb: bb.currentBet });
        process.exit(1);
    }
    console.log('✅ Blinds posted correctly');

    // 3. Pre-Flop Betting
    // Alice (Dealer) acts first in pre-flop because of the blinds? 
    // Wait, with 3 players: Dealer(0), SB(1), BB(2). 
    // Action starts at BB+1 = Dealer(0).
    const currentPlayerIdx = state.currentPlayer;
    const currentPlayer = state.players[currentPlayerIdx];

    console.log(`\n👉 ${currentPlayer.username}'s turn (Call 20)`);
    state = engine.handleAction(currentPlayer.sessionId, 'call', null);

    // Bob (SB) calls (needs to add 10)
    console.log(`👉 Bob's turn (Call 10 to match 20)`);
    state = engine.handleAction('p2', 'call', null);

    // Charlie (BB) checks
    console.log(`👉 Charlie's turn (Check)`);
    state = engine.handleAction('p3', 'check', null);

    if (state.currentPhase !== 'flop') {
        console.error(`❌ Phase mismatch. Expected 'flop', got '${state.currentPhase}'`);
        process.exit(1);
    }
    console.log('\n✅ Pre-flop betting complete. Phase is FLOP');
    console.log(`   Community Cards: ${state.communityCards.map(c => c.rank + c.suit).join(' ')}`);

    // 4. Flop Betting (Check all)
    console.log('\n👉 Checking around...');
    // Order resets to Dealer+1 = SB(1) -> BB(2) -> Dealer(0)
    state = engine.handleAction('p2', 'check', null); // Bob
    state = engine.handleAction('p3', 'check', null); // Charlie
    state = engine.handleAction('p1', 'check', null); // Alice

    if (state.currentPhase !== 'turn') {
        console.error(`❌ Phase mismatch. Expected 'turn', got '${state.currentPhase}'`);
        process.exit(1);
    }
    console.log('✅ Flop complete. Phase is TURN');
    console.log(`   Community Cards: ${state.communityCards.map(c => c.rank + c.suit).join(' ')}`);

    // 5. Turn Betting (Check all)
    console.log('\n👉 Checking around...');
    state = engine.handleAction('p2', 'check', null);
    state = engine.handleAction('p3', 'check', null);
    state = engine.handleAction('p1', 'check', null);

    if (state.currentPhase !== 'river') {
        console.error(`❌ Phase mismatch. Expected 'river', got '${state.currentPhase}'`);
        process.exit(1);
    }
    console.log('✅ Turn complete. Phase is RIVER');

    // 6. River Betting (Check all)
    console.log('\n👉 Checking around...');
    state = engine.handleAction('p2', 'check', null);
    state = engine.handleAction('p3', 'check', null);
    state = engine.handleAction('p1', 'check', null);

    if (state.currentPhase !== 'showdown') {
        console.error(`❌ Phase mismatch. Expected 'showdown', got '${state.currentPhase}'`);
        process.exit(1);
    }

    console.log('\n🏆 Showdown!');
    console.log(`   Winners: ${state.winner?.map(idx => mockPlayers[idx].username).join(', ')}`);
    console.log('✅ Test Passed Successfully');
}

try {
    runTest();
} catch (e) {
    console.error('❌ Test Failed:', e);
}
