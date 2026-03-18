
import type { NPC, Location, Faction, RollableTable, Item, Scene, SceneType, AdventureForBatchAdd, Article, PointOfInterest, PlayerCharacter, RealmChatResponse, ChatMessage, DraftEntity, ModelTier } from '../../types/index';
import type { BatchAddData } from '../../types/index';

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
  ],
  relationships: [],
  history: [
      { id: 'h1', summary: 'Saved the party from a rockslide', referenceType: 'session', referenceId: 's1' }
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
  history: [],
};

const mockFactionData: Omit<Faction, 'id' | 'leaderId' | 'memberIds'> = {
    name: "The Mocked Silent Hand",
    description: "A clandestine guild of spies and assassins operating in the city's shadows.",
    goals: "To destabilize the current noble houses and seize political power from behind the scenes.",
    alignment: "Neutral Evil",
    resources: "Network of safehouses, poison supplies, blackmail material.",
    influence: "Strong ties to the criminal underworld and corrupt city officials."
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
    rewards: "15 gold pieces, a half-eaten loaf of bread, and a shiny rock.",
    status: 'planned'
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
        { name: "Elara", description: "A stoic warden of the woods.", traits: "Speaks to animals.", exampleQuote: "The forest remembers.", backstory: "Raised by wolves.", motivations: "Protect the ancient groves.", secrets: "Is part dryad.", stats: "Ranger", factionId: "The Emerald Enclave", relationships: [], history: [] },
        { name: "Kaelen", description: "A shadowy figure in a dark cloak.", traits: "Never shows his face.", exampleQuote: "Knowledge is a sharper blade than any sword.", backstory: "A disgraced noble.", motivations: "To reclaim his birthright.", secrets: "Works for the Shadow Syndicate.", stats: "Assassin", factionId: "The Shadow Syndicate", relationships: [], history: [] },
    ],
    locations: [
        { name: "The Sunken Temple", description: "An ancient temple slowly being reclaimed by the sea.", secrets: "A hidden chamber lies behind the main altar.", parentLocationId: undefined, loot: [], connections: [], pointsOfInterest: [], history: [] },
        { name: "The Tidal Chamber", description: "A chamber that floods with the high tide.", secrets: "The tide reveals glowing runes on the walls.", parentLocationId: "The Sunken Temple", loot: [], connections: [], pointsOfInterest: [], history: [] },
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
                    locationId: "The Sunken Temple",
                    status: 'planned'
                },
                {
                    title: "The Tidal Chamber Puzzle",
                    type: "puzzle" as SceneType,
                    readAloudText: "This circular chamber is already ankle-deep in water. Runes glow on the walls, shifting in a complex pattern as the water level slowly rises.",
                    gmNotes: "Kaelen is here, also trying to solve the puzzle. He may fight the players or attempt to trick them.",
                    skillChecks: [{ id: "mock-sc-wiz-2", skill: "Arcana", dc: 16, description: "To decipher the runes and solve the puzzle." }],
                    rewards: "Access to the artifact.",
                    npcIds: ["Kaelen"],
                    locationId: "The Tidal Chamber",
                    status: 'planned'
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

export const parseCharacterSheetPdf = async (pdfBase64: string, campaignContext?: string, isMockMode?: boolean): Promise<Omit<PlayerCharacter, 'id'>> => {
    console.log(`[MOCK MODE] Called parseCharacterSheetPdf`);
    logContext(campaignContext);
    await new Promise(resolve => setTimeout(resolve, MOCK_DELAY * 2));
    return Promise.resolve({
        playerName: "Djinsidevoice",
        characterSocial: {
            characterName: "Elowyn",
            background: "Soldier",
            species: "Dark Elf (Drow)",
            personality: "I can stare down a hell hound without flinching. I face problems head-on. A simple, direct solution is the best path to success.",
            appearance: "A standard Dark Elf with typical features for their species.",
            backstory: "Elowyn's first memory was of fire and the sickening wet sound of blades colliding with flesh. A band of orcs had found the cave network by chance, and the long history between drow and orcs had spawned no friendships over the centuries. He survived by sheer luck, finding a tiny crevice that was too small to notice in the cave network. He watched as orcs picked over the bodies, one snatching the necklace from his mother's body. Once the orcs moved on, Elowyn made his way to the surface to find a way to survive. He was taken in by a band of migrants, where he learned to hunt and support his newly found tribe. But as time went on, his desire for revenge remained strong. When the kingdom began recruiting for war against the orcs, Elowyn joined the ranks and advanced quickly. However, his unit was deceived and ambushed, and he was the last one standing before being struck down.",
            ideals: "Independence. When people follow orders blindly, they embrace a kind of tyranny. (Chaotic)",
            bonds: "I'll never forget the crushing defeat my company suffered or the enemies who dealt it.",
            flaws: "My hatred of my enemies is blind and unreasoning."
        },
        characterStatistics: {
            classes: {
                charClass: "Ranger",
                level: 5,
                subclass: "Ronin"
            },
            attributes: {
                strength: 14,
                dexterity: 16,
                constitution: 14,
                intelligence: 10,
                wisdom: 10,
                charisma: 11
            },
            skills: {
                acrobatics: "proficient",
                animal_handling: "none",
                arcana: "none",
                athletics: "proficient",
                deception: "none",
                history: "none",
                insight: "none",
                intimidation: "proficient",
                investigation: "none",
                medicine: "none",
                nature: "none",
                perception: "proficient",
                performance: "none",
                persuasion: "none",
                religion: "none",
                sleight_of_hand: "proficient",
                stealth: "proficient",
                survival: "proficient"
            },
            actions: ["Acheron Blade, Longsword", "Crossbow, Heavy", "Orcish Eye Taker", "Unarmed Strike"],
            specialActions: ["Favored Enemy", "Natural Explorer", "Fighting Style: Archery", "Spellcasting", "Ranger Archetype: Ronin", "Primeval Awareness", "Slash Draw", "Extra Attack", "Sharpshooter"]
        }
    });
};

export const generateChatResponse = async (history: { role: 'user' | 'model', text: string }[], campaignContext?: string, isMockMode?: boolean): Promise<string> => {
    console.log(`[MOCK MODE] Called generateChatResponse with history:`, history);
    logContext(campaignContext);
    await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
    const lastUserMessage = history.filter(h => h.role === 'user').pop();
    return Promise.resolve(`This is a mocked response to your message: "${lastUserMessage?.text || '...'}"`);
};

export const chatWithRealmWeaver = async (
    history: ChatMessage[],
    currentDrafts: DraftEntity[],
    approvedEntitiesLog: string[],
    campaignContext: string,
    tier: ModelTier,
    focusedEntityType?: 'npc' | 'location' | 'faction' | 'item' | 'adventure' | 'article'
): Promise<RealmChatResponse> => {
    console.log(`[MOCK MODE] Called chatWithRealmWeaver. Tier: ${tier}, Focused Type: ${focusedEntityType}`);
    logContext(campaignContext);
    await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));

    const lastMsg = history[history.length - 1].text.toLowerCase();
    const newDrafts = [...currentDrafts];
    
    // 1. Focused Mode
    if (focusedEntityType) {
        let draft = newDrafts.find(d => d.type === focusedEntityType);
        if (!draft) {
             // @ts-ignore
            draft = {
                id: `mock-draft-${focusedEntityType}-${Date.now()}`,
                type: focusedEntityType,
                status: 'draft',
                data: { name: `Mocked ${focusedEntityType}`, description: "Generated in focused mock chat." }
            };
            newDrafts.push(draft);
        } else {
             // Update existing
             // @ts-ignore
             draft.data.description = (draft.data.description || "") + " ...and more mock details.";
        }
        
        return Promise.resolve({
            message: `[Mock] I've updated the ${focusedEntityType} draft based on: "${lastMsg}". What else?`,
            suggestions: ["Add a secret", "Change the name", "Finish it"],
            draftEntities: newDrafts
        });
    }

    // 2. General Chat Mode - Detect intent
    let message = `[Mock] Interesting point about "${lastMsg}". I can help you create content for your campaign.`;
    const suggestions = ["Tell me a rumor", "Create an NPC", "Describe a location"];

    if (lastMsg.includes('create') || lastMsg.includes('make') || lastMsg.includes('draft')) {
        if (lastMsg.includes('npc')) {
             // @ts-ignore
             newDrafts.push({
                id: `mock-draft-npc-${Date.now()}`,
                type: 'npc',
                status: 'draft',
                data: { name: "Mocked NPC", description: "Created via general mock chat." }
            });
            message = "[Mock] I've started a draft for that NPC. You can see it in the drafts bar above.";
        } else if (lastMsg.includes('location')) {
             // @ts-ignore
             newDrafts.push({
                id: `mock-draft-loc-${Date.now()}`,
                type: 'location',
                status: 'draft',
                data: { name: "Mocked Location", description: "Created via general mock chat." }
            });
            message = "[Mock] Location draft started.";
        }
    }

    return Promise.resolve({
        message,
        suggestions,
        draftEntities: newDrafts
    });
}

export const analyzeSessionNotes = async (notes: string, knownEntityNames: string[], campaignContext?: string, isMockMode?: boolean): Promise<{entries: {content: string, relatedEntityNames: string[]}[]}> => {
    console.log(`[MOCK MODE] Called analyzeSessionNotes with notes length: ${notes.length}`);
    await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
    return Promise.resolve({
        entries: [
            { content: "The party entered the dungeon and fought three goblins.", relatedEntityNames: [] },
            { content: "They found a hidden chest containing a strange map.", relatedEntityNames: [] },
            { content: "Elara spoke with the ghost of the previous guardian.", relatedEntityNames: ["Elara"] }
        ]
    });
}
