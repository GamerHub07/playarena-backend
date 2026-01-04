import { BoardSquare } from "../types/monopoly.types";

/**
 * Indian Monopoly Board - 40 Squares
 * Based on classic Monopoly layout with Indian cities
 */
export const BOARD: BoardSquare[] = [
    // Bottom row (left to right): GO to Jail/Visiting
    { id: "GO", type: "GO", name: "GO" },
    { id: "MUMBAI_1", type: "PROPERTY", name: "Dharavi", price: 60, rent: 2, owner: null, color: "brown" },
    { id: "COMMUNITY_1", type: "COMMUNITY_CHEST", name: "Community Chest" },
    { id: "MUMBAI_2", type: "PROPERTY", name: "Bandra", price: 60, rent: 4, owner: null, color: "brown" },
    { id: "TAX_INCOME", type: "TAX", name: "Income Tax", amount: 200 },
    { id: "RAIL_MUMBAI", type: "RAILROAD", name: "Mumbai Central", price: 200, rent: 25, owner: null },
    { id: "DELHI_1", type: "PROPERTY", name: "Chandni Chowk", price: 100, rent: 6, owner: null, color: "lightBlue" },
    { id: "CHANCE_1", type: "CHANCE", name: "Chance" },
    { id: "DELHI_2", type: "PROPERTY", name: "Connaught Place", price: 100, rent: 6, owner: null, color: "lightBlue" },
    { id: "DELHI_3", type: "PROPERTY", name: "Rajpath", price: 120, rent: 8, owner: null, color: "lightBlue" },
    
    // Left column (bottom to top): Jail to Free Parking
    { id: "JAIL", type: "JAIL", name: "Jail / Visiting" },
    { id: "KOLKATA_1", type: "PROPERTY", name: "Park Street", price: 140, rent: 10, owner: null, color: "pink" },
    { id: "UTILITY_ELECTRIC", type: "UTILITY", name: "BSES Electric", price: 150, rent: 0, owner: null },
    { id: "KOLKATA_2", type: "PROPERTY", name: "Howrah", price: 140, rent: 10, owner: null, color: "pink" },
    { id: "KOLKATA_3", type: "PROPERTY", name: "Salt Lake", price: 160, rent: 12, owner: null, color: "pink" },
    { id: "RAIL_KOLKATA", type: "RAILROAD", name: "Howrah Junction", price: 200, rent: 25, owner: null },
    { id: "CHENNAI_1", type: "PROPERTY", name: "T. Nagar", price: 180, rent: 14, owner: null, color: "orange" },
    { id: "COMMUNITY_2", type: "COMMUNITY_CHEST", name: "Community Chest" },
    { id: "CHENNAI_2", type: "PROPERTY", name: "Marina Beach", price: 180, rent: 14, owner: null, color: "orange" },
    { id: "CHENNAI_3", type: "PROPERTY", name: "Anna Nagar", price: 200, rent: 16, owner: null, color: "orange" },
    
    // Top row (right to left): Free Parking to Go To Jail
    { id: "FREE_PARKING", type: "FREE_PARKING", name: "Free Parking" },
    { id: "BANGALORE_1", type: "PROPERTY", name: "MG Road", price: 220, rent: 18, owner: null, color: "red" },
    { id: "CHANCE_2", type: "CHANCE", name: "Chance" },
    { id: "BANGALORE_2", type: "PROPERTY", name: "Koramangala", price: 220, rent: 18, owner: null, color: "red" },
    { id: "BANGALORE_3", type: "PROPERTY", name: "Whitefield", price: 240, rent: 20, owner: null, color: "red" },
    { id: "RAIL_BANGALORE", type: "RAILROAD", name: "Bangalore City", price: 200, rent: 25, owner: null },
    { id: "HYDERABAD_1", type: "PROPERTY", name: "Charminar", price: 260, rent: 22, owner: null, color: "yellow" },
    { id: "HYDERABAD_2", type: "PROPERTY", name: "Banjara Hills", price: 260, rent: 22, owner: null, color: "yellow" },
    { id: "UTILITY_WATER", type: "UTILITY", name: "Jal Board", price: 150, rent: 0, owner: null },
    { id: "HYDERABAD_3", type: "PROPERTY", name: "HITEC City", price: 280, rent: 24, owner: null, color: "yellow" },
    
    // Right column (top to bottom): Go To Jail to GO
    { id: "GO_TO_JAIL", type: "GO_TO_JAIL", name: "Go To Jail" },
    { id: "PUNE_1", type: "PROPERTY", name: "Koregaon Park", price: 300, rent: 26, owner: null, color: "green" },
    { id: "PUNE_2", type: "PROPERTY", name: "Shivaji Nagar", price: 300, rent: 26, owner: null, color: "green" },
    { id: "COMMUNITY_3", type: "COMMUNITY_CHEST", name: "Community Chest" },
    { id: "PUNE_3", type: "PROPERTY", name: "Hinjewadi", price: 320, rent: 28, owner: null, color: "green" },
    { id: "RAIL_PUNE", type: "RAILROAD", name: "Pune Junction", price: 200, rent: 25, owner: null },
    { id: "CHANCE_3", type: "CHANCE", name: "Chance" },
    { id: "GOA_1", type: "PROPERTY", name: "Panaji", price: 350, rent: 35, owner: null, color: "blue" },
    { id: "TAX_LUXURY", type: "TAX", name: "Luxury Tax", amount: 100 },
    { id: "GOA_2", type: "PROPERTY", name: "Candolim Beach", price: 400, rent: 50, owner: null, color: "blue" },
];

// Find jail index for Go To Jail functionality
export const JAIL_INDEX = BOARD.findIndex(s => s.type === "JAIL");
