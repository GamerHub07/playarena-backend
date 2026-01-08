import { BoardSquare } from "../types/monopoly.types";

/**
 * Indian Monopoly Board - 40 Squares
 * Themed around Indian States and their famous cities
 * 
 * Color Groups represent States:
 * - Brown: Bihar (2 cities) - Lowest value
 * - Light Blue: Madhya Pradesh (3 cities)
 * - Pink: Rajasthan (3 cities)
 * - Orange: Gujarat (3 cities)
 * - Red: Tamil Nadu (3 cities)
 * - Yellow: Telangana (3 cities)
 * - Green: Karnataka (3 cities)
 * - Blue: Maharashtra (2 cities) - Highest value
 * 
 * Railroads: Major Indian Railway Junctions
 * Utilities: Power & Water Boards
 * 
 * rentTiers: [base, 1house, 2houses, 3houses, 4houses, hotel]
 */
export const BOARD: BoardSquare[] = [
    // ===== BOTTOM ROW (Left to Right): GO to Jail =====
    { id: "GO", type: "GO", name: "GO - Collect ₹200" },
    
    // BIHAR (Brown) - Low-value state
    { id: "BIHAR_1", type: "PROPERTY", name: "Patna", price: 60, rent: 2, owner: null, color: "brown", houses: 0, houseCost: 50, rentTiers: [2, 10, 30, 90, 160, 250] },
    { id: "COMMUNITY_1", type: "COMMUNITY_CHEST", name: "Community Chest" },
    { id: "BIHAR_2", type: "PROPERTY", name: "Gaya", price: 60, rent: 4, owner: null, color: "brown", houses: 0, houseCost: 50, rentTiers: [4, 20, 60, 180, 320, 450] },
    { id: "TAX_INCOME", type: "TAX", name: "Income Tax", amount: 200 },
    
    // Railway
    { id: "RAIL_1", type: "RAILROAD", name: "New Delhi Railway", price: 200, rent: 25, owner: null },
    
    // MADHYA PRADESH (Light Blue)
    { id: "MP_1", type: "PROPERTY", name: "Bhopal", price: 100, rent: 6, owner: null, color: "lightBlue", houses: 0, houseCost: 50, rentTiers: [6, 30, 90, 270, 400, 550] },
    { id: "CHANCE_1", type: "CHANCE", name: "Chance" },
    { id: "MP_2", type: "PROPERTY", name: "Indore", price: 100, rent: 6, owner: null, color: "lightBlue", houses: 0, houseCost: 50, rentTiers: [6, 30, 90, 270, 400, 550] },
    { id: "MP_3", type: "PROPERTY", name: "Gwalior", price: 120, rent: 8, owner: null, color: "lightBlue", houses: 0, houseCost: 50, rentTiers: [8, 40, 100, 300, 450, 600] },

    // ===== LEFT COLUMN (Bottom to Top): Jail to Free Parking =====
    { id: "JAIL", type: "JAIL", name: "Jail / Visiting" },
    
    // RAJASTHAN (Pink)
    { id: "RAJASTHAN_1", type: "PROPERTY", name: "Jaipur", price: 140, rent: 10, owner: null, color: "pink", houses: 0, houseCost: 100, rentTiers: [10, 50, 150, 450, 625, 750] },
    { id: "UTILITY_ELECTRIC", type: "UTILITY", name: "Tata Power", price: 150, rent: 0, owner: null },
    { id: "RAJASTHAN_2", type: "PROPERTY", name: "Udaipur", price: 140, rent: 10, owner: null, color: "pink", houses: 0, houseCost: 100, rentTiers: [10, 50, 150, 450, 625, 750] },
    { id: "RAJASTHAN_3", type: "PROPERTY", name: "Jodhpur", price: 160, rent: 12, owner: null, color: "pink", houses: 0, houseCost: 100, rentTiers: [12, 60, 180, 500, 700, 900] },
    
    // Railway
    { id: "RAIL_2", type: "RAILROAD", name: "Mumbai CST", price: 200, rent: 25, owner: null },
    
    // GUJARAT (Orange)
    { id: "GUJARAT_1", type: "PROPERTY", name: "Rajkot", price: 180, rent: 14, owner: null, color: "orange", houses: 0, houseCost: 100, rentTiers: [14, 70, 200, 550, 750, 950] },
    { id: "COMMUNITY_2", type: "COMMUNITY_CHEST", name: "Community Chest" },
    { id: "GUJARAT_2", type: "PROPERTY", name: "Surat", price: 180, rent: 14, owner: null, color: "orange", houses: 0, houseCost: 100, rentTiers: [14, 70, 200, 550, 750, 950] },
    { id: "GUJARAT_3", type: "PROPERTY", name: "Vadodara", price: 200, rent: 16, owner: null, color: "orange", houses: 0, houseCost: 100, rentTiers: [16, 80, 220, 600, 800, 1000] },

    // ===== TOP ROW (Left to Right): Free Parking to Go To Jail =====
    { id: "FREE_PARKING", type: "FREE_PARKING", name: "Free Parking" },
    
    // TAMIL NADU (Red)
    { id: "TAMILNADU_1", type: "PROPERTY", name: "Chennai", price: 220, rent: 18, owner: null, color: "red", houses: 0, houseCost: 150, rentTiers: [18, 90, 250, 700, 875, 1050] },
    { id: "CHANCE_2", type: "CHANCE", name: "Chance" },
    { id: "TAMILNADU_2", type: "PROPERTY", name: "Vellore", price: 220, rent: 18, owner: null, color: "red", houses: 0, houseCost: 150, rentTiers: [18, 90, 250, 700, 875, 1050] },
    { id: "TAMILNADU_3", type: "PROPERTY", name: "Madurai", price: 240, rent: 20, owner: null, color: "red", houses: 0, houseCost: 150, rentTiers: [20, 100, 300, 750, 925, 1100] },
    
    // Railway
    { id: "RAIL_3", type: "RAILROAD", name: "Howrah Junction", price: 200, rent: 25, owner: null },
    
    // TELANGANA (Yellow)
    { id: "TELANGANA_1", type: "PROPERTY", name: "Hyderabad", price: 260, rent: 22, owner: null, color: "yellow", houses: 0, houseCost: 150, rentTiers: [22, 110, 330, 800, 975, 1150] },
    { id: "TELANGANA_2", type: "PROPERTY", name: "Tirupati", price: 260, rent: 22, owner: null, color: "yellow", houses: 0, houseCost: 150, rentTiers: [22, 110, 330, 800, 975, 1150] },
    { id: "UTILITY_WATER", type: "UTILITY", name: "Jal Board", price: 150, rent: 0, owner: null },
    { id: "TELANGANA_3", type: "PROPERTY", name: "Warangal", price: 280, rent: 24, owner: null, color: "yellow", houses: 0, houseCost: 150, rentTiers: [24, 120, 360, 850, 1025, 1200] },

    // ===== RIGHT COLUMN (Top to Bottom): Go To Jail to GO =====
    { id: "GO_TO_JAIL", type: "GO_TO_JAIL", name: "Go To Jail" },
    
    // KARNATAKA (Green)
    { id: "KARNATAKA_1", type: "PROPERTY", name: "Banglore", price: 300, rent: 26, owner: null, color: "green", houses: 0, houseCost: 200, rentTiers: [26, 130, 390, 900, 1100, 1275] },
    { id: "KARNATAKA_2", type: "PROPERTY", name: "Mysuru", price: 300, rent: 26, owner: null, color: "green", houses: 0, houseCost: 200, rentTiers: [26, 130, 390, 900, 1100, 1275] },
    { id: "COMMUNITY_3", type: "COMMUNITY_CHEST", name: "Community Chest" },
    { id: "KARNATAKA_3", type: "PROPERTY", name: "Mangalore", price: 320, rent: 28, owner: null, color: "green", houses: 0, houseCost: 200, rentTiers: [28, 150, 450, 1000, 1200, 1400] },
    
    // Railway
    { id: "RAIL_4", type: "RAILROAD", name: "Chennai Central", price: 200, rent: 25, owner: null },
    
    { id: "CHANCE_3", type: "CHANCE", name: "Chance" },
    
    // MAHARASHTRA (Blue) - High-value state
    { id: "MAHARASHTRA_1", type: "PROPERTY", name: "Mumbai", price: 350, rent: 35, owner: null, color: "blue", houses: 0, houseCost: 200, rentTiers: [35, 175, 500, 1100, 1300, 1500] },
    { id: "TAX_LUXURY", type: "TAX", name: "GST Tax", amount: 100 },
    { id: "MAHARASHTRA_2", type: "PROPERTY", name: "Pune", price: 400, rent: 50, owner: null, color: "blue", houses: 0, houseCost: 200, rentTiers: [50, 200, 600, 1400, 1700, 2000] },
];

// Find jail index for Go To Jail functionality
export const JAIL_INDEX = BOARD.findIndex(s => s.type === "JAIL");

// State name mappings for display
export const STATE_NAMES: Record<string, string> = {
    brown: "Bihar",
    lightBlue: "Madhya Pradesh",
    pink: "Rajasthan",
    orange: "Gujarat",
    red: "Tamil Nadu",
    yellow: "Telangana",
    green: "Karnataka",
    blue: "Maharashtra",
};

// Color group sizes for monopoly check
export const COLOR_GROUP_SIZES: Record<string, number> = {
    brown: 2,
    lightBlue: 3,
    pink: 3,
    orange: 3,
    red: 3,
    yellow: 3,
    green: 3,
    blue: 2,
}
