import type { NPC, Location, Faction, RollableTable, Item, Scene, SceneType, AdventureForBatchAdd, Article, PointOfInterest } from '../../types';
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
  secrets: "Behind the waterfall is a hidden cave entrance.",
  loot: [
      { id: "mock-loot-1", description: "A waterlogged chest containing 15gp", pointOfInterestId: "mock-poi-1" }
  ],
  connections: [
      { id: "mock-conn-1", targetLocationId: "some-other-mock-id", description: "A hidden path leads to the Gloomwood" }
  ],
  pointsOfInterest: [
      {
          id: "mock-poi-1",
          name: "The Sunken Chest",
          passivePerceptionDC: 13,
          description: "At the bottom of the crystal-clear pool, a small, barnacle-encrusted chest is partially visible, half-buried in the silt.",
          investigationChecks: [
              { id: 'mock-ic-1', description: "DC 12 Investigation", outcome: "The chest is not locked, but the latch is rusted shut. It can be forced open with a DC 14 Strength check." }
          ],
          interactions: [
              { id: 'mock-ia-1', description: "If players make a loud noise or disturb the water too much", outcome: "A territorial Giant Crab scuttles out from a nearby rock to defend its territory." }
          ]
      }
  ],
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

const mockArticleData: Omit<Article, 'id' | 'parentArticleId' | 'subArticleIds'> = {
  title: "The Mock War of the Whispering Peaks",
  category: "history",
  content: "A long and bloody conflict fought between the dwarves of Ironhold and the goblins of the Slashed Eye tribe. The war concluded with the dwarves victorious, but at a great cost, leaving many ancient mountain passes haunted by the spirits of the fallen.",
};

const mockComplexCampaignFillData: BatchAddData = {
    npcs: [
        { name: "Elara", description: "A stoic warden of the woods.", traits: "Speaks to animals.", exampleQuote: "The forest remembers.", backstory: "Raised by wolves.", motivations: "Protect the ancient groves.", secrets: "Is part dryad.", stats: "Ranger", factionId: "The Emerald Enclave" },
        { name: "Kaelen", description: "A shadowy figure in a dark cloak.", traits: "Never shows his face.", exampleQuote: "Knowledge is a sharper blade than any sword.", backstory: "A disgraced noble.", motivations: "To reclaim his birthright.", secrets: "Works for the Shadow Syndicate.", stats: "Assassin", factionId: "The Shadow Syndicate" },
    ],
    locations: [
        { name: "The Sunken Temple", description: "An ancient temple slowly being reclaimed by the sea.", secrets: "A hidden chamber lies behind the main altar.", parentLocationId: undefined, loot: [], connections: [], pointsOfInterest: [] },
        { name: "The Tidal Chamber", description: "A chamber that floods with the high tide.", secrets: "The tide reveals glowing runes on the walls.", parentLocationId: "The Sunken Temple", loot: [], connections: [], pointsOfInterest: [] },
    ],
    factions: [
        { name: "The Emerald Enclave", description: "Guardians of the natural order.", goals: "To stop civilization's encroachment." },
        { name: "The Shadow Syndicate", description: "A guild of spies and information brokers.", goals: "To control the city from the shadows." }
    ],
    adventures: [
        { 
            title: "The Sunken Temple's Secret", 
            hook: "A powerful artifact is said to be hidden within a Sunken Temple, but a rising tide threatens to seal it away forever.", 
            theme: "Exploration, Puzzle, Time-Pressure", 
            level: 4,
            scenes: [
                {
                    title: "The Temple Entrance",
                    type: "exploration" as SceneType,
                    readAloudText: "The entrance to the temple is a grand, seaweed-choked archway. Saltwater drips from the ceiling, and the sound of the distant tide echoes ominously.",
                    gmNotes: "The players meet Elara here, who warns them of the temple's dangers and the rising tide.",
                    skillChecks: [{ id: "mock-sc-wiz-1", skill: "Nature", dc: 14, description: "To understand the tidal patterns and estimate they have about 3 hours." }],
                    rewards: "Guidance from Elara.",
                    npcIds: ["Elara"],
                    locationId: "The Sunken Temple"
                },
                {
                    title: "The Tidal Chamber Puzzle",
                    type: "puzzle" as SceneType,
                    readAloudText: "This circular chamber is already ankle-deep in water. Runes glow on the walls, shifting in a complex pattern as the water level slowly rises.",
                    gmNotes: "Kaelen is here, also trying to solve the puzzle. He may fight the players or attempt to trick them.",
                    skillChecks: [{ id: "mock-sc-wiz-2", skill: "Arcana", dc: 16, description: "To decipher the runes and solve the puzzle." }],
                    rewards: "Access to the artifact.",
                    npcIds: ["Kaelen"],
                    locationId: "The Tidal Chamber"
                }
            ]
        }
    ],
    items: [
        { name: "Amulet of the Tides", description: "An amulet that allows the wearer to breathe underwater.", rarity: 'uncommon', properties: 'Grants the Water Breathing spell once per day.' }
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

export const generateArticle = async (prompt: string, campaignContext?: string): Promise<Omit<Article, 'id' | 'parentArticleId' | 'subArticleIds'>> => {
  console.log(`[MOCK MODE] Called generateArticle with prompt: "${prompt}"`);
  logContext(campaignContext);
  await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
  return Promise.resolve(mockArticleData);
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
    
    const data = JSON.parse(JSON.stringify(mockComplexCampaignFillData));
    
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

export const generatePoiFromLoot = async (prompt: string, campaignContext?: string, isMockMode: boolean = false): Promise<Omit<PointOfInterest, 'id'>> => {
    console.log(`[MOCK MODE] Called generatePoiFromLoot with prompt: "${prompt}"`);
    logContext(campaignContext);
    await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
    return Promise.resolve({
        name: `POI for "${prompt.substring(0, 20)}..."`,
        passivePerceptionDC: 14,
        description: `You notice something glinting under a pile of rubble. It's a ${prompt}.`,
        investigationChecks: [
            { id: 'mock-ic-1', description: 'DC 12 Investigation', outcome: 'The item seems to be of ancient make.'}
        ],
        interactions: []
    });
};

// FIX: Add missing mock implementation for generateChatResponse.
export const generateChatResponse = async (history: { role: 'user' | 'model', text: string }[], campaignContext?: string, isMockMode?: boolean): Promise<string> => {
    console.log(`[MOCK MODE] Called generateChatResponse with history:`, history);
    logContext(campaignContext);
    await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
    const lastUserMessage = history.filter(h => h.role === 'user').pop();
    return Promise.resolve(`This is a mocked response to your message: "${lastUserMessage?.text || '...'}"`);
};