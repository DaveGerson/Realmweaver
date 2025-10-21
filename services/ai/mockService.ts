import type { NPC, Location, Faction, RollableTable, Item, Scene, SceneType, AdventureForBatchAdd } from '../../types';
import type { BatchAddData } from '../../types';

// --- Mock Data ---
const mockNpcData: Omit<NPC, 'id' | 'factionId'> = {
  name: "Mocked Bjorn Ironhand",
  description: "A burly dwarf with a braided, fiery-red beard and a permanent scowl.",
  traits: "Always polishing his axe, refers to everyone as 'lad' or 'lassie'.",
  exampleQuote: "Bah! The only thing ye can trust is good steel and a strong arm.",
  backstory: "Exiled from his mountain home for a crime he didn't commit.",
  motivations: "To reclaim his honor and find a new home.",
  secrets: "He secretly carries the key to his clan's lost vault.",
  stats: "Veteran warrior, formidable with a battleaxe.",
  knowsPlayerHistory: [
    { playerId: 'Faelan', details: 'Bjorn owes Faelan a life debt after being saved from a rockslide.' },
    { playerId: 'Lyra', details: 'Mistrusts Lyra due to her association with the Silent Hand, but respects her skills.' }
  ]
};

const mockLocationData: Omit<Location, 'id' | 'parentLocationId' | 'subLocationIds'> = {
  name: "The Mocked Whispering Falls",
  description: "A serene waterfall that cascades into a crystal-clear pool, rumored to have healing properties.",
  secrets: "Behind the waterfall is a hidden cave entrance."
};

const mockFactionData: Omit<Faction, 'id' | 'leaderId' | 'memberIds'> = {
    name: "The Mocked Silent Hand",
    description: "A clandestine guild of spies and assassins operating in the city's shadows.",
    goals: "To destabilize the current noble houses and seize political power from behind the scenes."
};

const mockRollableTableData: RollableTable = {
  title: "Mock Forest Encounters",
  dieType: "d6",
  entries: [
    { range: "1", result: "A deer with glowing antlers watches you from a distance." },
    { range: "2-3", result: "You find a patch of unusually vibrant, edible mushrooms." },
    { range: "4", result: "The wind whispers a name you haven't heard in years." },
    { range: "5", result: "A territorial badger blocks your path, hissing." },
    { range: "6", result: "You discover the ruins of an old, moss-covered cabin." },
  ]
};

const mockItemData: Omit<Item, 'id'> = {
    name: "Mocked Sunstone Compass",
    description: "A compass made of polished sunstone that glows faintly in the presence of strong magic.",
    rarity: "uncommon",
    properties: "Requires attunement. Once per day, you can use it to cast the 'Locate Object' spell."
};

const mockSceneData: Omit<Scene, 'id' | 'locationId' | 'npcIds'> = {
    title: "Mocked Goblin Ambush",
    type: "combat",
    readAloudText: "The rustling in the bushes suddenly erupts as three small, green-skinned figures with wicked, sharp-toothed grins leap out, brandishing crude spears and rusty shortswords. 'Give us yer shinies!' one of them screeches.",
    gmNotes: "This is a simple ambush. The goblins are not very bright and will flee if two of them are defeated. They are primarily interested in stealing food and any easily visible valuables.",
    skillChecks: [{ id: "mock-sc-1", skill: "Perception", dc: 14, description: "To notice the goblins hiding in the bushes before they attack." }],
    rewards: "15 gold pieces, a half-eaten loaf of bread, and a shiny rock."
};

const mockAdventureData: AdventureForBatchAdd = {
    title: "The Mock Adventure",
    hook: "A mock hook.",
    theme: "Mocking, Tests",
    level: 1,
    scenes: [
        {
            ...mockSceneData,
            title: "A Mock Scene in an Adventure",
            npcIds: [],
        }
    ]
};

const mockCampaignFillData: BatchAddData = {
    npcs: [
        { name: "Captain Mockimus", description: "A stern, one-eyed captain.", traits: "Taps his wooden leg.", exampleQuote: "Arrr, matey.", backstory: "Lost his eye to a kraken.", motivations: "Find that kraken.", secrets: "Is secretly afraid of water.", stats: "Veteran" },
        { name: "Salty Mock", description: "A parrot with an attitude.", traits: "Squawks insults.", exampleQuote: "Pieces of eight!", backstory: "Was Mockimus's first mate.", motivations: "Crackers.", secrets: "Knows where the treasure is.", stats: "Annoying" },
    ],
    locations: [
        { name: "The Mocking Siren Tavern", description: "A rundown tavern.", secrets: "The rum is watered down." },
        { name: "Mock Rock", description: "A skull-shaped rock.", secrets: "It's just a rock." },
    ],
    factions: [
        { name: "The Mockaneers", description: "A feared pirate crew.", goals: "Get rich." }
    ],
    adventures: [
        { 
            title: "The Mock Treasure of Mock Rock", 
            hook: "A tattered map promises immense riches, but also speaks of a skeletal curse.", 
            theme: "Pirate, Treasure Hunt, Undead", 
            level: 3,
            scenes: [
                {
                    title: "The Rusty Cutlass Tavern",
                    type: "social" as SceneType,
                    readAloudText: "The tavern is a cacophony of sea shanties and spilled rum. A one-eyed pirate in the corner seems to be watching you.",
                    gmNotes: "The pirate, 'Patchy' Pete, knows about the map and will try to steal it or offer to partner up.",
                    skillChecks: [{ id: "mock-sc-wiz-1", skill: "Insight", dc: 14, description: "To notice Pete's shifty eyes." }],
                    rewards: "A potential ally or rival",
                    npcIds: [],
                },
                {
                    title: "The Perilous Voyage",
                    type: "exploration" as SceneType,
                    readAloudText: "The sea journey to Mock Rock is treacherous, with jagged rocks hidden beneath the waves and a strange, unnatural fog.",
                    gmNotes: "A skill challenge to navigate. Failure could lead to a combat encounter with reef sharks.",
                    skillChecks: [{ id: "mock-sc-wiz-2", skill: "Vehicle (Water)", dc: 15, description: "To safely navigate the ship." }],
                    rewards: "Safe arrival at Mock Rock",
                    npcIds: [],
                },
                 {
                    title: "The Crypt of Captain Mockbeard",
                    type: "combat" as SceneType,
                    readAloudText: "Inside the skull-shaped cave, a treasure chest sits atop a pile of gold. As you approach, skeletal pirates claw their way out of the ground!",
                    gmNotes: "Standard skeletons, but their captain has a special ability. The chest is trapped.",
                    skillChecks: [{ id: "mock-sc-wiz-3", skill: "Investigation", dc: 16, description: "To spot the poison dart trap on the chest." }],
                    rewards: "250 gold pieces and a +1 Scimitar",
                    npcIds: [],
                }
            ]
        }
    ],
    items: [
        { name: "Mocking Spyglass", description: "A spyglass that shows you what you least expect.", rarity: 'rare', properties: 'Can cast Scrying once per day.' }
    ]
};

const MOCK_DELAY = 500;

const logContext = (context?: string) => {
    if (context) console.log(`[MOCK MODE] with context:\n---\n${context}\n---`);
};

// --- Mock Service Functions ---

export const generateNpc = async (prompt: string, useGroundedSearch: boolean, campaignContext?: string): Promise<Omit<NPC, 'id' | 'factionId'>> => {
  console.log(`[MOCK MODE] Called generateNpc with prompt: "${prompt}" and useGroundedSearch: ${useGroundedSearch}`);
  logContext(campaignContext);
  await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
  return Promise.resolve(mockNpcData);
};

export const generateLocation = async (prompt: string, campaignContext?: string): Promise<Omit<Location, 'id' | 'parentLocationId' | 'subLocationIds'>> => {
  console.log(`[MOCK MODE] Called generateLocation with prompt: "${prompt}"`);
  logContext(campaignContext);
  await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
  return Promise.resolve(mockLocationData);
};

export const generateFaction = async (prompt: string, campaignContext?: string): Promise<Omit<Faction, 'id' | 'leaderId' | 'memberIds'>> => {
  console.log(`[MOCK MODE] Called generateFaction with prompt: "${prompt}"`);
  logContext(campaignContext);
  await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
  return Promise.resolve(mockFactionData);
};

export const generateItem = async (prompt: string, campaignContext?: string): Promise<Omit<Item, 'id'>> => {
  console.log(`[MOCK MODE] Called generateItem with prompt: "${prompt}"`);
  logContext(campaignContext);
  await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
  return Promise.resolve(mockItemData);
};

export const generateScene = async (prompt: string, campaignContext?: string): Promise<Omit<Scene, 'id' | 'locationId' | 'npcIds'>> => {
  console.log(`[MOCK MODE] Called generateScene with prompt: "${prompt}"`);
  logContext(campaignContext);
  await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
  return Promise.resolve({ ...mockSceneData, npcIds: [] });
};

export const generateAdventure = async (prompt: string, campaignContext?: string): Promise<AdventureForBatchAdd> => {
  console.log(`[MOCK MODE] Called generateAdventure with prompt: "${prompt}"`);
  logContext(campaignContext);
  await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
  return Promise.resolve(mockAdventureData);
};

export const generateNarration = async (prompt: string, campaignContext?: string, useLiteModel: boolean = false, isMockMode: boolean = true): Promise<string> => {
    console.log(`[MOCK MODE] Called generateNarration with prompt: "${prompt}"`);
    logContext(campaignContext);
    await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
    return Promise.resolve(`This is a mock narration for: "${prompt}". The forest is indeed very spooky, with gnarled trees that look like grasping claws and a chilling wind that whispers through the branches.`);
}

export const generateImprovisation = async (prompt: string, campaignContext?: string, useLiteModel: boolean = false, isMockMode: boolean = true): Promise<string> => {
    console.log(`[MOCK MODE] Called generateImprovisation with prompt: "${prompt}"`);
    logContext(campaignContext);
    await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
    return Promise.resolve(`This is a mock improvisation for: "${prompt}". The captain is shocked. The other guards draw their swords. A crowd begins to form, some gasping, others looking for an opportunity.`);
}

export const generateRollableTable = async (prompt: string, campaignContext?: string, useLiteModel: boolean = false, isMockMode: boolean = true): Promise<RollableTable> => {
  console.log(`[MOCK MODE] Called generateRollableTable with prompt: "${prompt}"`);
  logContext(campaignContext);
  await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
  return Promise.resolve(mockRollableTableData);
};

export const generateCampaignFill = async (prompt: string, options: { npcs: boolean, locations: boolean, factions: boolean, adventures: boolean, items: boolean }, isMockMode: boolean = false, campaignContext?: string): Promise<BatchAddData> => {
    console.log(`[MOCK MODE] Called generateCampaignFill with prompt: "${prompt}" and options:`, options);
    logContext(campaignContext);
    await new Promise(resolve => setTimeout(resolve, MOCK_DELAY * 2));
    
    // Create a mutable copy to work with
    const data = JSON.parse(JSON.stringify(mockCampaignFillData));
    
    const result: BatchAddData = {
      npcs: options.npcs ? data.npcs : [],
      locations: options.locations ? data.locations : [],
      factions: options.factions ? data.factions : [],
      adventures: options.adventures ? data.adventures : [],
      items: options.items ? data.items : [],
    };

    return Promise.resolve(result);
};

export const generateEnhancedText = async (prompt: string, campaignContext?: string): Promise<string> => {
    console.log(`[MOCK MODE] Called generateEnhancedText with prompt: "${prompt}"`);
    logContext(campaignContext);
    await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
    return Promise.resolve(`This is mocked enhanced text based on the prompt: "${prompt}". It is creative and evocative.`);
};