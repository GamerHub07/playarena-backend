export class PokerDeck {
  private cards: string[] = [];

  reset() {
    const suits = ["H", "D", "C", "S"];
    const values = ["2","3","4","5","6","7","8","9","T","J","Q","K","A"];

    this.cards = suits.flatMap(s =>
      values.map(v => `${v}${s}`)
    );

    this.shuffle();
  }

  private shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  deal(): string {
    return this.cards.pop()!;
  }
}
