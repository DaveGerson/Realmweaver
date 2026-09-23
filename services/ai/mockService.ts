
import type { NPC, Location, Faction, RollableTable, Item, Scene, SceneType, AdventureForBatchAdd, Article, PointOfInterest, PlayerCharacter, RealmChatResponse, ChatMessage, DraftEntity, Campaign } from '../../types/index';
import type { ModelTier, LegacyRealmChatTier } from './modelConfig';
import { abortableDelay } from '@/utils/abort';
import type { BatchAddData } from '../../types/index';
import type { WorldEvent } from './worldSimulation';
import type { CallbackComplicationRequest, ColdOpenRequest, ExtraNpc, SceneMenuDraft, StrongStartRequest } from './dmCoach';
import { hasColdOpenMaterial } from './dmCoach';
import type { SecretDraft } from './realmWeaver';
import type { AudioTranscriptionConfig, AudioTranscriptionSession } from './audioTranscription';

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
  // Lazy DM step 5 ("develop fantastic locations") — every newly generated
  // location arrives with 2-3 sensory one-liners alongside its description.
  aspects: [
    "Cold mist beads on every surface and smells faintly of moss.",
    "The falls swallow every other sound but a low, constant roar.",
  ],
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

export const generateNpc = async (prompt: string, useGroundedSearch: boolean, campaignContext?: string, signal?: AbortSignal): Promise<Omit<NPC, 'id' | 'factionId'>> => {
  console.log(`[MOCK MODE] Called generateNpc with prompt: "${prompt}" and useGroundedSearch: ${useGroundedSearch}`);
  logContext(campaignContext);
  await abortableDelay(MOCK_DELAY, signal);
  return Promise.resolve(mockNpcData);
};

export const generateLocation = async (prompt: string, campaignContext?: string, signal?: AbortSignal): Promise<Omit<Location, 'id' | 'parentLocationId' | 'subLocationIds'>> => {
  console.log(`[MOCK MODE] Called generateLocation with prompt: "${prompt}"`);
  logContext(campaignContext);
  await abortableDelay(MOCK_DELAY, signal);
  return Promise.resolve(mockLocationData);
};

export const generateFaction = async (prompt: string, campaignContext?: string, signal?: AbortSignal): Promise<Omit<Faction, 'id' | 'leaderId' | 'memberIds'>> => {
  console.log(`[MOCK MODE] Called generateFaction with prompt: "${prompt}"`);
  logContext(campaignContext);
  await abortableDelay(MOCK_DELAY, signal);
  return Promise.resolve(mockFactionData);
};

export const generateItem = async (prompt: string, campaignContext?: string, signal?: AbortSignal): Promise<Omit<Item, 'id'>> => {
  console.log(`[MOCK MODE] Called generateItem with prompt: "${prompt}"`);
  logContext(campaignContext);
  await abortableDelay(MOCK_DELAY, signal);
  return Promise.resolve(mockItemData);
};

export const generateScene = async (prompt: string, campaignContext?: string, signal?: AbortSignal): Promise<Omit<Scene, 'id' | 'locationId' | 'npcIds'>> => {
  console.log(`[MOCK MODE] Called generateScene with prompt: "${prompt}"`);
  logContext(campaignContext);
  await abortableDelay(MOCK_DELAY, signal);
  return Promise.resolve({ ...mockSceneData, npcIds: [] });
};

export const generateAdventure = async (prompt: string, campaignContext?: string, signal?: AbortSignal): Promise<AdventureForBatchAdd> => {
  console.log(`[MOCK MODE] Called generateAdventure with prompt: "${prompt}"`);
  logContext(campaignContext);
  await abortableDelay(MOCK_DELAY, signal);
  return Promise.resolve(mockAdventureData);
};

export const generateArticle = async (prompt: string, campaignContext?: string, signal?: AbortSignal): Promise<Omit<Article, 'id' | 'parentArticleId' | 'subArticleIds'>> => {
  console.log(`[MOCK MODE] Called generateArticle with prompt: "${prompt}"`);
  logContext(campaignContext);
  await abortableDelay(MOCK_DELAY, signal);
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

/** P2 — the Callback Machine's mock counterpart. Same empty-material rejection as the real path. */
export const generateCallbackComplication = async (request: CallbackComplicationRequest, signal?: AbortSignal): Promise<string> => {
    const material = request?.material ?? [];
    if (material.length === 0) {
        throw new Error(
            'generateCallbackComplication needs at least one piece of dormant material to reincorporate; the sample was empty.'
        );
    }
    const names = material.map((piece) => piece.label).join(', ');
    console.log(`[MOCK MODE] Called generateCallbackComplication with material: ${names}`);
    await abortableDelay(MOCK_DELAY, signal);
    return `This is a mock complication reincorporating ${names}: it ties them back into the current scene.`;
}

/** P4 — mock parity for the cold open. Same empty-campaign refusal as the real path. */
export const generateColdOpen = async (request: ColdOpenRequest, signal?: AbortSignal): Promise<string> => {
    const { campaign } = request;
    if (!hasColdOpenMaterial(campaign)) {
        throw new Error(
            'There is nothing to draft a cold open from yet — write a recap, a loose end, or star a moment first.'
        );
    }
    console.log(`[MOCK MODE] Called generateColdOpen for campaign: "${campaign.title}"`);
    await abortableDelay(MOCK_DELAY, signal);
    return `Previously on ${campaign.title}: the party's choices from last session are still echoing, and the table is about to find out what they cost.`;
};

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
    tier: ModelTier | LegacyRealmChatTier,
    focusedEntityType?: 'npc' | 'location' | 'faction' | 'item' | 'adventure' | 'article' | 'scene',
    signal?: AbortSignal
): Promise<RealmChatResponse> => {
    console.log(`[MOCK MODE] Called chatWithRealmWeaver. Tier: ${tier}, Focused Type: ${focusedEntityType}`);
    logContext(campaignContext);
    await abortableDelay(MOCK_DELAY, signal);

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

export const generateSessionRecap = async (
    sessionNotes: string,
    plotSummaries: string,
    campaignContext?: string
): Promise<{ recap: string; looseEnds: string[]; playerFacingRecap: string }> => {
    console.log(`[MOCK MODE] Called generateSessionRecap with notes length: ${sessionNotes.length}`);
    logContext(campaignContext);
    await new Promise(resolve => setTimeout(resolve, MOCK_DELAY * 2));
    return Promise.resolve({
        recap: "The session began with the party arriving at the ancient ruins of Thornkeep, where they discovered the entrance had been recently disturbed. After navigating a trapped corridor, they encountered a band of cultists performing a dark ritual.\n\nA fierce battle ensued in the ritual chamber. The party's fighter held the line while the rogue flanked from the shadows. The cultist leader escaped through a hidden passage, but not before the wizard disrupted the ritual, preventing the summoning of a shadow demon.\n\nWith the immediate threat neutralized, the party explored the deeper chambers and found evidence linking the cultists to the missing merchant guild members. A coded journal recovered from the scene hints at a larger conspiracy involving the city's nobility.",
        looseEnds: [
            "The cultist leader escaped through a hidden passage and remains at large",
            "The coded journal needs to be deciphered to reveal the noble conspirators",
            "Three merchant guild members are still missing",
            "The disrupted ritual's residual energy may have attracted other dark entities"
        ],
        playerFacingRecap: "Our heroes ventured into the ruins of Thornkeep, where they clashed with mysterious cultists in the midst of a dark ritual. Through skill and bravery, they disrupted the ceremony and scattered the cultists, though their leader slipped away. The party recovered a coded journal that may hold the key to unraveling a deeper conspiracy."
    });
};

export const generateNpcRoleplay = async (
    npcContext: string,
    conversationHistory: Array<{ role: string; text: string }>,
    userMessage: string,
    campaignContext?: string
): Promise<{ dialogue: string; moodCue: string }> => {
    console.log(`[MOCK MODE] Called generateNpcRoleplay. Message: "${userMessage}"`);
    logContext(campaignContext);
    await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
    return Promise.resolve({
        dialogue: "Well, well... another adventurer seeking favors. Tell me, what makes you think I should help you? I've heard many promises from your kind — most of them hollow.",
        moodCue: "crosses arms, raises an eyebrow skeptically",
    });
};

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

export const generateStarterNpcs = async (worldDescription: string, campaignContext?: string): Promise<Array<Omit<NPC, 'id' | 'factionId'>>> => {
    console.log(`[MOCK MODE] Called generateStarterNpcs with worldDescription length: ${worldDescription.length}`);
    logContext(campaignContext);
    await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
    return Promise.resolve([
        {
            name: "Aldric the Innkeeper",
            description: "A stout, weathered man with a salt-and-pepper beard and kind eyes creased by years of smiling at strangers.",
            traits: "Remembers every face that passes through his door. Speaks in aphorisms.",
            exampleQuote: "Trouble has a way of finding folk who aren't lookin' for it, and doubly so for those who are.",
            backstory: "A retired soldier who bought the inn with his severance pay. He's seen enough bloodshed to last three lifetimes.",
            motivations: "Keep his inn profitable and his regulars safe. He's the unofficial mayor of Main Street.",
            secrets: "He shelters fugitives from the local lord in his cellar — he won't say why, but old loyalties die hard.",
            stats: "Commoner with Veteran stats when pushed",
            knowsPlayerHistory: [],
            relationships: [],
            history: []
        },
        {
            name: "Serafine Dusk",
            description: "A willowy woman in travel-stained robes, her silver-streaked hair pulled back under a wide-brimmed hat. Her eyes are mismatched: one green, one white as a cloud.",
            traits: "Speaks to her familiar (an invisible cat) mid-conversation. Never walks through doorways without pausing.",
            exampleQuote: "The dead are chattier than the living give them credit for.",
            backstory: "A hedge witch who drifts from town to town trading in minor charms and grave-readings.",
            motivations: "She's searching for the tomb of her mentor, who she believes left her a final message from beyond.",
            secrets: "Her white eye can see spirits. The invisible cat is actually her dead mentor's soul, unable to move on.",
            stats: "Mage (CR6), specializes in divination and necromancy",
            knowsPlayerHistory: [],
            relationships: [],
            history: []
        },
        {
            name: "Vorn Ashbane",
            description: "Broad-shouldered and scarred, with close-cropped dark hair and the cautious posture of someone expecting an ambush.",
            traits: "Stands with his back to walls. Barely speaks above a murmur. Unusually good with animals.",
            exampleQuote: "I don't talk about what I've done. Or what I'll do if pushed.",
            backstory: "Former enforcer for a thieves' guild he eventually betrayed. Now lays low in this frontier town.",
            motivations: "Stay invisible. Survive. Maybe, eventually, atone.",
            secrets: "He has the guild's ledger — a list of nobles who paid for murders — and they want it back.",
            stats: "Assassin (CR8)",
            knowsPlayerHistory: [],
            relationships: [],
            history: []
        }
    ]);
};

export const generateStarterLocations = async (worldDescription: string, npcs: Array<Omit<NPC, 'id' | 'factionId'>>, campaignContext?: string): Promise<Array<Omit<Location, 'id' | 'parentLocationId' | 'subLocationIds'>>> => {
    console.log(`[MOCK MODE] Called generateStarterLocations with worldDescription length: ${worldDescription.length}`);
    logContext(campaignContext);
    await new Promise(resolve => setTimeout(resolve, MOCK_DELAY));
    return Promise.resolve([
        {
            name: "The Ashwood Inn",
            description: "A two-story timber-frame building leaning slightly to the left, as if tired. Smoke-stained beams, a roaring hearth, and a dartboard with a wanted poster as the bulls-eye.",
            secrets: "A hidden trapdoor beneath the bar rug leads to a cellar Aldric uses to shelter fugitives.",
            loot: [],
            connections: [],
            pointsOfInterest: [
                {
                    id: crypto.randomUUID(),
                    name: "The Notice Board",
                    passivePerceptionDC: 10,
                    description: "A corkboard thick with parchment: job postings, missing persons, and a hand-drawn map of the local ruins.",
                    investigationChecks: [],
                    interactions: []
                }
            ],
            history: []
        },
        {
            name: "The Warden's Gate",
            description: "The crumbling remnant of an old fortification at the edge of town. Three of its four towers still stand. The local watch uses it as a guardhouse and holding cell.",
            secrets: "The fourth tower's foundation leads to a pre-built smuggler's tunnel connecting to the forest.",
            loot: [],
            connections: [],
            pointsOfInterest: [],
            history: []
        },
        {
            name: "The Sunken Chapel",
            description: "A small stone chapel half-submerged into a hillside, its entrance nearly hidden by ivy. The faith that built it is long forgotten, but the stonework is immaculate.",
            secrets: "Below the altar is a burial vault. One of the tombs is occupied by someone who was interred alive and did not stay dead.",
            loot: [],
            connections: [],
            pointsOfInterest: [],
            history: []
        }
    ]);
};

export const generateStarterAdventure = async (worldDescription: string, npcs: Array<Omit<NPC, 'id' | 'factionId'>>, locations: Array<Omit<Location, 'id' | 'parentLocationId' | 'subLocationIds'>>, campaignContext?: string): Promise<{ title: string; hook: string; theme: string; level: number; scenes: Array<{ title: string; type: string; readAloudText: string; gmNotes: string; rewards: string; npcIds: string[]; locationId?: string; status: string; skillChecks: [] }> }> => {
    console.log(`[MOCK MODE] Called generateStarterAdventure`);
    logContext(campaignContext);
    await new Promise(resolve => setTimeout(resolve, MOCK_DELAY * 2));
    const npcName0 = npcs[0]?.name || 'The Innkeeper';
    const npcName2 = npcs[2]?.name || 'The Stranger';
    const locName0 = locations[0]?.name || 'The Inn';
    const locName2 = locations[2]?.name || 'The Chapel';
    return Promise.resolve({
        title: "Ledger of the Dead",
        hook: `${npcName0} finds a dead man slumped against the inn's back door at dawn. His pockets are empty save for a torn page from an encoded ledger — and someone is watching from the alleyway.`,
        theme: "Mystery, Intrigue, Low-Level Danger",
        level: 1,
        scenes: [
            {
                title: "A Corpse Before Breakfast",
                type: "social",
                readAloudText: `The back door of ${locName0} opens onto the alley just as pale light catches the shape of a man crumpled against the wall. He's dead — and recently. The torn page in his fist bears a partial list of names in cipher.`,
                gmNotes: `${npcName0} is visibly shaken. The dead man is a guild courier. The players can make a DC 12 Investigation check to find a second watcher's footprint in the mud.`,
                rewards: "The partial ledger page, a guild medallion worth 5gp.",
                npcIds: [],
                locationId: undefined,
                status: "planned",
                skillChecks: []
            },
            {
                title: "Questions in Dark Places",
                type: "social",
                readAloudText: `The name on the ledger points to ${npcName2}, who is currently nursing a drink alone at the far end of the bar. His eyes track you the moment you enter.`,
                gmNotes: `${npcName2} knows exactly what the ledger is. He'll deny it at first (DC 14 Insight to catch the lie). If the players press carefully, he'll admit the guild is coming for him — and offer to trade information for passage out of town.`,
                rewards: "The full story: the ledger, who it names, and why the guild wants it back.",
                npcIds: [],
                locationId: undefined,
                status: "planned",
                skillChecks: []
            },
            {
                title: "Answers Beneath the Hill",
                type: "exploration",
                readAloudText: `${locName2} sits at the edge of the settlement, half-buried in the hillside. The ivy-choked door is ajar. Someone has been here recently — the lock has been forced from the inside.`,
                gmNotes: `The guild sent an advance scout to retrieve a copy of the ledger buried here with an old contact. The scout is still inside — dead, with no visible wounds. The vault below holds the original ledger and something that should not be walking.`,
                rewards: "The original ledger (enough to start a major plot thread), 40gp in old coin, and one uncommon magic item.",
                npcIds: [],
                locationId: undefined,
                status: "planned",
                skillChecks: []
            }
        ]
    });
};

export const analyzeWritingStyle = async (
    samples: string[],
    campaignContext?: string
): Promise<string> => {
    console.log(`[MOCK MODE] Called analyzeWritingStyle with ${samples.length} samples.`);
    logContext(campaignContext);
    await new Promise(resolve => setTimeout(resolve, MOCK_DELAY * 2));
    return Promise.resolve(
        'Terse, atmospheric prose with a preference for concrete sensory detail over abstraction. ' +
        'Sentences run short and punchy in moments of tension, then expand into longer, image-laden ' +
        'constructions during description. Vocabulary is accessible but precise — no archaic flourishes, ' +
        'but a careful eye for the right word. Metaphors lean toward the mundane made strange: rot, ' +
        'rust, smoke, and wet stone recur as anchors. Thematic preoccupations include fractured loyalty, ' +
        'the weight of secrets, and the indifference of history to individual suffering. ' +
        'Descriptions tend toward the oblique — readers infer more than they are told.'
    );
};

export const generateWorldEvents = async (
    campaign: Campaign,
    daysPassed: number,
    campaignContext?: string
): Promise<WorldEvent[]> => {
    console.log(`[MOCK MODE] Called generateWorldEvents. Days: ${daysPassed}, Campaign: "${campaign.title}"`);
    logContext(campaignContext);
    await new Promise(resolve => setTimeout(resolve, MOCK_DELAY * 2));

    // Use actual campaign entity IDs if available, otherwise fall back to placeholders
    const firstFaction = campaign.factions[0];
    const secondFaction = campaign.factions[1];
    const firstNpc = campaign.npcs[0];
    const firstLocation = campaign.locations[0];
    const firstPlot = campaign.plots?.[0];

    const timeLabel =
        daysPassed === 1 ? '1 day' :
        daysPassed < 7 ? `${daysPassed} days` :
        daysPassed < 30 ? `${Math.round(daysPassed / 7)} week${Math.round(daysPassed / 7) > 1 ? 's' : ''}` :
        `about ${Math.round(daysPassed / 30)} month${Math.round(daysPassed / 30) > 1 ? 's' : ''}`;

    const events: WorldEvent[] = [
        {
            id: crypto.randomUUID(),
            title: firstFaction
                ? `${firstFaction.name} Tightens Its Grip`
                : "The Shadow Guild Expands",
            description: firstFaction
                ? `Over the past ${timeLabel}, ${firstFaction.name} has moved aggressively to consolidate resources in the eastern trade districts. Several minor rivals have either been absorbed or quietly disappeared. Their public face remains charitable, but rumors of coercion are spreading among the merchant class.`
                : `Over the past ${timeLabel}, a powerful guild has moved aggressively to consolidate resources. Rivals have disappeared, and whispers of coercion spread.`,
            affectedEntityIds: firstFaction ? [firstFaction.id] : [],
            affectedEntityTypes: firstFaction ? ['faction'] : [],
            suggestedUpdates: firstFaction ? [
                {
                    entityId: firstFaction.id,
                    entityType: 'faction',
                    field: 'influence',
                    currentValue: firstFaction.influence || 'Unknown influence',
                    proposedValue: (firstFaction.influence || 'Unknown influence') + ' Now controls three additional trade posts in the eastern district; rival guilds have gone suspiciously quiet.',
                },
            ] : [],
            severity: 'major',
            category: 'faction',
        },
        {
            id: crypto.randomUUID(),
            title: firstNpc
                ? `${firstNpc.name} Receives a Warning`
                : "A Key Figure is Threatened",
            description: firstNpc
                ? `${firstNpc.name} received an unsigned letter — a single black feather and three words: "Your time ends." The message was found pinned to their door with a dagger of unusual make. They have become noticeably more guarded and are asking discreet questions about known assassins.`
                : `A prominent figure in the campaign received an ominous threat. They have become noticeably more guarded and suspicious of strangers.`,
            affectedEntityIds: firstNpc ? [firstNpc.id] : [],
            affectedEntityTypes: firstNpc ? ['npc'] : [],
            suggestedUpdates: firstNpc ? [
                {
                    entityId: firstNpc.id,
                    entityType: 'npc',
                    field: 'motivations',
                    currentValue: firstNpc.motivations || 'Unknown motivations',
                    proposedValue: (firstNpc.motivations || 'Unknown motivations') + ' Since the threatening letter arrived, has become increasingly paranoid and is quietly seeking protection or allies.',
                },
            ] : [],
            severity: 'major',
            category: 'npc',
        },
        {
            id: crypto.randomUUID(),
            title: firstLocation
                ? `Unrest Near ${firstLocation.name}`
                : "A Location Falls into Disrepair",
            description: firstLocation
                ? `Strange lights have been seen near ${firstLocation.name} at odd hours. Two travelers reported hearing voices from within when it should have been empty. Local superstition has grown, and foot traffic in the area has dropped sharply.`
                : `Strange events have been reported near a key location. Local foot traffic has dropped sharply due to fear and superstition.`,
            affectedEntityIds: firstLocation ? [firstLocation.id] : [],
            affectedEntityTypes: firstLocation ? ['location'] : [],
            suggestedUpdates: firstLocation ? [
                {
                    entityId: firstLocation.id,
                    entityType: 'location',
                    field: 'description',
                    currentValue: firstLocation.description || 'No description',
                    proposedValue: (firstLocation.description || 'No description') + ' Recently, strange lights and voices have been reported here at night, and locals are avoiding the area.',
                },
            ] : [],
            severity: firstPlot ? 'minor' : 'minor',
            category: 'location',
        },
    ];

    // Only include events that have at least some campaign data to anchor them
    return Promise.resolve(events);
};

// --- Audio Transcription (Mock) ---
const MOCK_TRANSCRIPT_CHUNKS = [
    "The party approaches the crumbling gate.",
    "Someone whispers, 'Did you hear that?'",
    "Dice clatter across the table.",
];

/**
 * Mock implementation of audio transcription. Never touches the microphone
 * or the real-time Gemini Live API — instead emits a handful of canned
 * transcript chunks on a short timer, so mock-mode runs and E2E tests never
 * open a live, billed websocket or request mic permission (finding #42).
 */
export const startAudioTranscription = (
    config: AudioTranscriptionConfig
): Promise<AudioTranscriptionSession> => {
    const { onTranscript, onConnected, onDisconnected } = config;

    const timers: ReturnType<typeof setTimeout>[] = [];
    let stopped = false;

    timers.push(setTimeout(() => {
        if (!stopped) onConnected();
    }, 0));

    MOCK_TRANSCRIPT_CHUNKS.forEach((chunk, i) => {
        timers.push(setTimeout(() => {
            if (!stopped) onTranscript(chunk);
        }, (i + 1) * 50));
    });

    const stop = async (): Promise<void> => {
        stopped = true;
        timers.forEach(clearTimeout);
        onDisconnected();
    };

    return Promise.resolve({ stop });
};

/// --- R2: "Generate ten, keep what you like" (Secrets Tracker) ---------------

const MOCK_SECRET_DRAFTS: SecretDraft[] = [
    { title: 'The mayor pays the smugglers to look the other way', content: 'A cut of every "confiscated" crate ends up in the mayoral coffers, laundered through the harbor tax.', category: 'secret' },
    { title: 'Salt on the doorstep', content: 'Someone has been tracing a warding sigil in salt outside the old chapel every new moon.', category: 'clue' },
    { title: 'The count never left the crypt', content: "The man ruling from the manor is a doppelganger; the real count has been dead for three years.", category: 'revelation' },
    { title: "They say the well water turned red last spring", content: 'True or not, half the town still refuses to drink from it.', category: 'rumor' },
    { title: 'The missing ledger page', content: "A single page has been razored out of the harbormaster's ledger, right where last month's shipment would be listed.", category: 'clue' },
    { title: 'The blacksmith owes a debt he cannot repay', content: 'He forges weapons for the thieves\' guild at cost, working off a debt from a bad winter three years back.', category: 'secret' },
    { title: 'A second set of footprints', content: 'Whoever robbed the shrine wore boots two sizes too small for the story they told about it.', category: 'clue' },
    { title: 'The plague was never natural', content: "It was seeded in the granary by agents of a rival house, timed to break the town's will before the siege.", category: 'revelation' },
    { title: "Folk swear the lighthouse keeper hasn't aged a day in twenty years", content: 'Most laugh it off as a tall tale from sailors with too much grog in them.', category: 'rumor' },
    { title: 'The locked drawer in the vicar\'s study', content: 'It rattles like coin when the wagon rolls by outside, though the vicar claims it holds only old sermons.', category: 'clue' },
];

/**
 * Mock counterpart of `realmWeaver.generateSecretBatch`. Mock parity is
 * mandatory for every facade function (services/ai/CLAUDE.md) — this never
 * touches the provider stack, resolving instead to a fixed, well-formed
 * roster of distinct drafts after the standard mock delay.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const generateSecretBatch = async (prompt: string, campaignContext?: string, signal?: AbortSignal): Promise<SecretDraft[]> => {
    await abortableDelay(MOCK_DELAY, signal);
    return MOCK_SECRET_DRAFTS.map(d => ({ ...d }));
};

/// --- Lazy DM step 5: "develop fantastic locations" -------------------------

const MOCK_LOCATION_ASPECTS: string[] = [
    "Cold mist beads on every surface and smells faintly of moss.",
    "The falls swallow every other sound but a low, constant roar.",
    "Slick stone underfoot makes every step feel provisional.",
];

/**
 * Mock counterpart of `realmWeaver.generateLocationAspects`. Retrofits a
 * fixed, well-formed set of sensory one-liners onto an existing location —
 * never touches the provider stack, same MOCK_DELAY as every other mock.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const generateLocationAspects = async (
    location: { name: string; description: string },
    campaignContext?: string,
    signal?: AbortSignal,
): Promise<string[]> => {
    console.log(`[MOCK MODE] Called generateLocationAspects for: "${location.name}"`);
    logContext(campaignContext);
    await abortableDelay(MOCK_DELAY, signal);
    return [...MOCK_LOCATION_ASPECTS];
};

/// --- §4.2: GM Intrusion (zero-precondition live complication) --------------

const MOCK_GM_INTRUSION = 'A side door bangs open and a stranger stumbles in, already mid-sentence to someone who is not there.';

/**
 * Mock counterpart of `dmCoach.generateGmIntrusion`. Mock parity is
 * mandatory (services/ai/CLAUDE.md) — never touches the provider stack.
 * Unlike `generateCallbackComplication`'s mock, this never rejects: the
 * whole point of GM Intrusion is that it has no material precondition to
 * enforce, on an empty campaign or otherwise.
 */
export const generateGmIntrusion = async (
    campaignContext?: string,
    sceneSummary?: string,
    useLiteModel: boolean = false,
    signal?: AbortSignal,
): Promise<string> => {
    console.log('[MOCK MODE] Called generateGmIntrusion');
    logContext(campaignContext);
    void useLiteModel;
    await abortableDelay(MOCK_DELAY, signal);
    return sceneSummary ? `${MOCK_GM_INTRUSION} (${sceneSummary})` : MOCK_GM_INTRUSION;
};

/// --- §4.8: Extras & spear-carriers ------------------------------------------

const MOCK_EXTRAS: ExtraNpc[] = [
    { name: 'Bram Kettle', detail: 'Talks with his hands full even when they are empty.' },
    { name: 'Sela Voss', detail: 'A scar through one eyebrow she never explains the same way twice.' },
    { name: 'Old Tam', detail: 'Smells faintly of pipe smoke and complains about the weather, constantly.' },
    { name: 'Ivo Renn', detail: 'A nervous laugh that arrives half a second before anything is funny.' },
    { name: 'Ushka', detail: 'Wears a hat two sizes too large and refuses every offer to fix it.' },
    { name: 'Corwin Dale', detail: 'Counts coins twice, out loud, every single time.' },
];

/**
 * Mock counterpart of `dmCoach.generateExtras`. Mock parity is mandatory
 * (services/ai/CLAUDE.md) — resolves a fixed, well-formed roster of distinct
 * name + one-line-detail pairs, sized to the caller's requested count.
 */
export const generateExtras = async (
    count: number,
    campaignContext?: string,
    useLiteModel: boolean = false,
    signal?: AbortSignal,
): Promise<ExtraNpc[]> => {
    console.log(`[MOCK MODE] Called generateExtras with count: ${count}`);
    logContext(campaignContext);
    void useLiteModel;
    await abortableDelay(MOCK_DELAY, signal);
    const n = Number.isFinite(count) ? Math.min(MOCK_EXTRAS.length, Math.max(1, Math.floor(count))) : 5;
    return MOCK_EXTRAS.slice(0, n).map(e => ({ ...e }));
};

/// --- Table Pulse §4.3: "Ask the Table" check-in questions -------------------

const MOCK_CHECK_IN_QUESTIONS: string[] = [
    'What does your character want most right now?',
    'What moment from last session stuck with you?',
    'Anything you wish had gone differently?',
    'Who do you want to see again soon?',
    'What kind of scene are you hoping for next time?',
];

/**
 * Mock counterpart of `dmCoach.generateCheckInQuestions`. Mock parity is
 * mandatory (services/ai/CLAUDE.md). Like the real path, this has no material
 * precondition — it never throws, even for a brand-new campaign with an empty
 * roster. Accepts the same request shape as `dmCoach.CheckInQuestionsRequest`
 * (typed structurally here rather than imported, so this file's append-only
 * edit never has to touch the shared import block at the top).
 */
export const generateCheckInQuestions = async (
    request: { campaign?: Campaign; campaignContext?: string; useLiteModel?: boolean } = {},
    signal?: AbortSignal,
): Promise<string[]> => {
    console.log(`[MOCK MODE] Called generateCheckInQuestions for campaign: "${request.campaign?.title ?? '(none)'}"`);
    logContext(request.campaignContext);
    void request.useLiteModel;
    await abortableDelay(MOCK_DELAY, signal);
    return MOCK_CHECK_IN_QUESTIONS.map(q => q);
};

/// --- §4.1 Scene Menu Generator (Session Prep Wizard bundle) -----------------

const MOCK_SCENE_MENU_DRAFTS: SceneMenuDraft[] = [
    { title: 'A stranger buys the whole bar a round', hook: 'They are fishing for information about the party, not celebrating anything.' },
    { title: 'The watch closes the bridge without explanation', hook: 'Guards are turning away every wagon, no reason given.' },
    { title: 'A courier collapses at the door', hook: 'The letter in their satchel is addressed to someone in the party.' },
    { title: 'Something is wrong at the shrine', hook: 'The bell has not rung at dusk for three nights running.' },
    { title: 'An old contact wants to meet, quietly' },
    { title: 'A rival crew is asking the same questions the party is' },
];

/**
 * Mock counterpart of `dmCoach.generateSceneMenu`. Mock parity is mandatory
 * (services/ai/CLAUDE.md) — resolves a fixed, well-formed roster of distinct
 * drafts after the standard mock delay, the same shape as the real path.
 */
export const generateSceneMenu = async (campaignContext?: string, signal?: AbortSignal): Promise<SceneMenuDraft[]> => {
    console.log(`[MOCK MODE] Called generateSceneMenu`);
    logContext(campaignContext);
    await abortableDelay(MOCK_DELAY, signal);
    return MOCK_SCENE_MENU_DRAFTS.map(d => ({ ...d }));
};

/// --- §4.6 Strong Start Styles (Session Prep Wizard bundle) ------------------

/**
 * Mock counterpart of `dmCoach.generateStrongStart`. Same "reincorporate
 * needs a sampled piece" guard as the real path, so the two paths cannot
 * drift.
 */
export const generateStrongStart = async (request: StrongStartRequest, signal?: AbortSignal): Promise<string> => {
    const { style, campaign, dormantPiece } = request;
    if (style === 'reincorporate' && !dormantPiece) {
        throw new Error(
            'generateStrongStart needs a sampled dormant piece for the "reincorporate" style; none was supplied.'
        );
    }
    console.log(`[MOCK MODE] Called generateStrongStart with style: "${style}" for campaign: "${campaign.title}"`);
    await abortableDelay(MOCK_DELAY, signal);
    if (style === 'reincorporate' && dormantPiece) {
        return `The scene opens already in motion, built around ${dormantPiece.label}: ${dormantPiece.reason.toLowerCase()} — and tonight it finally matters again.`;
    }
    return `Drop the party straight into motion: doors already breaking, voices already raised, no time to catch their breath before the first decision is theirs to make.`;
};
