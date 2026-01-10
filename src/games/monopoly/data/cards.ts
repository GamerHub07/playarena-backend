import { JAIL_INDEX } from "./board";

export interface Card {
  id: string;
  text: string;
  action: CardAction;
}

export type CardAction =
  | { type: "COLLECT"; amount: number }
  | { type: "PAY"; amount: number }
  | { type: "MOVE_TO"; position: number }
  | { type: "MOVE_BACK"; spaces: number }
  | { type: "GO_TO_JAIL" }
  | { type: "GET_OUT_OF_JAIL" }
  | { type: "COLLECT_FROM_EACH"; amount: number }
  | { type: "PAY_EACH"; amount: number }
  | { type: "REPAIRS"; perHouse: number; perHotel: number };

/**
 * Chance Cards - 16 cards
 */
export const CHANCE_CARDS: Card[] = [
  {
    id: "CH1",
    text: "Advance to GO. Collect ₹200.",
    action: { type: "MOVE_TO", position: 0 },
  },
  {
    id: "CH2",
    text: "Advance to Candolim Beach (Goa). If you pass GO, collect ₹200.",
    action: { type: "MOVE_TO", position: 39 },
  },
  {
    id: "CH3",
    text: "Advance to MG Road (Bangalore). If you pass GO, collect ₹200.",
    action: { type: "MOVE_TO", position: 21 },
  },
  {
    id: "CH4",
    text: "Advance to Connaught Place (Delhi). If you pass GO, collect ₹200.",
    action: { type: "MOVE_TO", position: 8 },
  },
  {
    id: "CH5",
    text: "Advance to nearest Railway Station. Pay owner twice the usual rent.",
    action: { type: "MOVE_TO", position: 5 }, // Mumbai Central
  },
  {
    id: "CH6",
    text: "Advance to nearest Utility. Pay 10x dice roll if owned.",
    action: { type: "MOVE_TO", position: 12 }, // BSES Electric
  },
  {
    id: "CH7",
    text: "Bank pays you dividend of ₹50.",
    action: { type: "COLLECT", amount: 50 },
  },
  {
    id: "CH8",
    text: "Get Out of Jail Free. Keep until needed or sold.",
    action: { type: "GET_OUT_OF_JAIL" },
  },
  {
    id: "CH9",
    text: "Go back 3 spaces.",
    action: { type: "MOVE_BACK", spaces: 3 },
  },
  {
    id: "CH10",
    text: "Go directly to Jail. Do not pass GO. Do not collect ₹200.",
    action: { type: "GO_TO_JAIL" },
  },
  {
    id: "CH11",
    text: "Make general repairs on all your property. Pay ₹25 per house, ₹100 per hotel.",
    action: { type: "REPAIRS", perHouse: 25, perHotel: 100 },
  },
  {
    id: "CH12",
    text: "Pay speeding fine of ₹15.",
    action: { type: "PAY", amount: 15 },
  },
  {
    id: "CH13",
    text: "Take a trip to Mumbai Central Railway. If you pass GO, collect ₹200.",
    action: { type: "MOVE_TO", position: 5 },
  },
  {
    id: "CH14",
    text: "You have been elected Chairman of the Board. Pay each player ₹50.",
    action: { type: "PAY_EACH", amount: 50 },
  },
  {
    id: "CH15",
    text: "Your building loan matures. Collect ₹150.",
    action: { type: "COLLECT", amount: 150 },
  },
  {
    id: "CH16",
    text: "You have won a crossword competition. Collect ₹100.",
    action: { type: "COLLECT", amount: 100 },
  },
];

/**
 * Community Chest Cards - 16 cards
 */
export const COMMUNITY_CHEST_CARDS: Card[] = [
  {
    id: "CC1",
    text: "Advance to GO. Collect ₹200.",
    action: { type: "MOVE_TO", position: 0 },
  },
  {
    id: "CC2",
    text: "Bank error in your favor. Collect ₹200.",
    action: { type: "COLLECT", amount: 200 },
  },
  {
    id: "CC3",
    text: "Doctor's fee. Pay ₹50.",
    action: { type: "PAY", amount: 50 },
  },
  {
    id: "CC4",
    text: "From sale of stock you get ₹50.",
    action: { type: "COLLECT", amount: 50 },
  },
  {
    id: "CC5",
    text: "Get Out of Jail Free. Keep until needed or sold.",
    action: { type: "GET_OUT_OF_JAIL" },
  },
  {
    id: "CC6",
    text: "Go directly to Jail. Do not pass GO. Do not collect ₹200.",
    action: { type: "GO_TO_JAIL" },
  },
  {
    id: "CC7",
    text: "Grand Opera Night. Collect ₹50 from every player.",
    action: { type: "COLLECT_FROM_EACH", amount: 50 },
  },
  {
    id: "CC8",
    text: "Holiday Fund matures. Collect ₹100.",
    action: { type: "COLLECT", amount: 100 },
  },
  {
    id: "CC9",
    text: "Income tax refund. Collect ₹20.",
    action: { type: "COLLECT", amount: 20 },
  },
  {
    id: "CC10",
    text: "It's your birthday. Collect ₹10 from each player.",
    action: { type: "COLLECT_FROM_EACH", amount: 10 },
  },
  {
    id: "CC11",
    text: "Life insurance matures. Collect ₹100.",
    action: { type: "COLLECT", amount: 100 },
  },
  {
    id: "CC12",
    text: "Hospital fees. Pay ₹100.",
    action: { type: "PAY", amount: 100 },
  },
  {
    id: "CC13",
    text: "School fees. Pay ₹50.",
    action: { type: "PAY", amount: 50 },
  },
  {
    id: "CC14",
    text: "Receive consultancy fee. Collect ₹25.",
    action: { type: "COLLECT", amount: 25 },
  },
  {
    id: "CC15",
    text: "Street repairs. Pay ₹40 per house, ₹115 per hotel.",
    action: { type: "REPAIRS", perHouse: 40, perHotel: 115 },
  },
  {
    id: "CC16",
    text: "You have won second prize in a beauty contest. Collect ₹10.",
    action: { type: "COLLECT", amount: 10 },
  },
];

// Export jail index for use in card actions
export { JAIL_INDEX };
