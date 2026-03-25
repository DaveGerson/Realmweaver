/**
 * demoTemplates.ts
 *
 * Demo campaign data formerly auto-seeded on first launch.
 * Returns a template-compatible data object that can be imported via
 * campaignService.importTemplateData() or offered as a quick-start
 * option during onboarding.
 *
 * The data is intentionally structured to match the shape expected by
 * importTemplateData() — plain objects with stable placeholder IDs that
 * will be remapped to fresh UUIDs on import.
 */

export interface DemoTemplateData {
    title: string;
    setting: string;
    settingType: 'custom' | 'official';
    npcs: DemoNpc[];
    factions: DemoFaction[];
    locations: DemoLocation[];
    items: DemoItem[];
    adventures: DemoAdventure[];
    plots: DemoPlot[];
    articles: DemoArticle[];
    description: string;
    playstyle: string;
    subtitle: string;
}

interface DemoNpc {
    id: string;
    name: string;
    description: string;
    traits: string;
    motivations: string;
    secrets: string;
    backstory: string;
    stats: string;
    exampleQuote: string;
    factionId?: string;
}

interface DemoFaction {
    id: string;
    name: string;
    description: string;
    goals: string;
    alignment: string;
    resources: string;
    influence: string;
    memberIds: string[];
    headquartersLocationId?: string;
}

interface DemoLocation {
    id: string;
    name: string;
    description: string;
    secrets: string;
    parentLocationId?: string;
    subLocationIds: string[];
}

interface DemoItem {
    id: string;
    name: string;
    description: string;
    rarity: string;
    properties: string;
}

interface DemoScene {
    id: string;
    title: string;
    type: string;
    readAloudText: string;
    gmNotes: string;
    rewards: string;
    npcIds: string[];
    locationId?: string;
}

interface DemoAdventure {
    id: string;
    title: string;
    level: number;
    hook: string;
    theme: string;
    scenes: DemoScene[];
}

interface DemoPlot {
    id: string;
    title: string;
    description: string;
    status: string;
    relatedEntityIds: string[];
}

interface DemoArticle {
    id: string;
    title: string;
    category: string;
    content: string;
}

// Stable placeholder IDs — these are remapped on import so collisions are
// not possible. Using readable names for debuggability.
const IDS = {
    // Factions
    drune: 'demo-faction-drune',
    frostElves: 'demo-faction-frost-elves',
    church: 'demo-faction-church',
    // NPCs
    princess: 'demo-npc-princess',
    sirChyde: 'demo-npc-sir-chyde',
    dolmbrace: 'demo-npc-dolmbrace',
    haithion: 'demo-npc-haithion',
    briarAnne: 'demo-npc-briar-anne',
    griddlegrim: 'demo-npc-griddlegrim',
    grimmlegridge: 'demo-npc-grimmlegridge',
    lordMantle: 'demo-npc-lord-mantle',
    // Locations
    dolmenwood: 'demo-loc-dolmenwood',
    whythingStones: 'demo-loc-whything-stones',
    burialMound: 'demo-loc-burial-mound',
    priestQuarters: 'demo-loc-priest-quarters',
    hallOfHounds: 'demo-loc-hall-of-hounds',
    towerOnLake: 'demo-loc-tower-on-lake',
    princessTower: 'demo-loc-princess-tower',
    // Items
    bindingRing: 'demo-item-binding-ring',
    hubrisBlade: 'demo-item-hubris-blade',
    freezingMirror: 'demo-item-freezing-mirror',
    fungiPouch: 'demo-item-fungi-pouch',
    portrait: 'demo-item-portrait',
    // Adventure
    adventure: 'demo-adv-winters-daughter',
    scene1: 'demo-scene-01',
    scene2: 'demo-scene-02',
    scene3: 'demo-scene-03',
    scene4: 'demo-scene-04',
    scene5: 'demo-scene-05',
    scene6: 'demo-scene-06',
    scene7: 'demo-scene-07',
    scene8: 'demo-scene-08',
    scene9: 'demo-scene-09',
    scene10: 'demo-scene-10',
    // Plots
    plotForbiddenLove: 'demo-plot-forbidden-love',
    plotColdPrince: 'demo-plot-cold-prince',
    // Articles
    articleWar: 'demo-article-war',
    articleStones: 'demo-article-stones',
} as const;

/**
 * Returns the Winter's Daughter demo campaign as a template-compatible
 * data object. IDs are stable placeholders — importTemplateData() remaps
 * them to fresh UUIDs on import.
 */
export function getWintersDaughterTemplate(): DemoTemplateData {
    return {
        title: "Winter's Daughter",
        subtitle: "Dark Fairy Tale Dungeon Crawl",
        description:
            "A near-mythical knight's tomb, a forbidden love spanning centuries, and a portal to the realm of Fairy. Based on the acclaimed Dolmenwood adventure by Necrotic Gnome.",
        playstyle: "Dungeon Crawl / Social",
        setting:
            "Dolmenwood \u2014 a weird fairy tale forest where the mortal world and the immortal realm of Fairy lie close together. Ancient standing stones mark ley lines, mysterious Drune cultists guard stone circles, and the threat of the banished Cold Prince lingers in every frigid wind. The forest is thick with brambles, twisted trees, and the faint sound of unearthly laughter drifting from the glades.",
        settingType: 'custom',

        articles: [
            {
                id: IDS.articleWar,
                title: "The War of Mortal and Fairy",
                category: "history",
                content:
                    "Nine centuries ago, mortals waged war against the fey armies of the Cold Prince, who ruled all of Dolmenwood under an eternal cloak of frost and snow. The mortal armies were ultimately victorious, and the Cold Prince was exiled into his dominion in Fairy. But the threat of his return has never fully faded \u2014 every winter, the magic that banishes him weakens, and frigid winds whisper of his desire to reclaim the mortal world.\n\nAmong the heroes of the war was Sir Chyde, a near-mythical knight who slew the fairy giant Butter-for-Bones with a fabled sword. His tomb, built beside the standing stones where he first met his forbidden love, became a site of pilgrimage \u2014 until the Church sealed it when fey influence began creeping in from the other side.",
            },
            {
                id: IDS.articleStones,
                title: "The Standing Stones of Dolmenwood",
                category: "lore",
                content:
                    "The standing stones \u2014 known locally as 'Whything Stones' \u2014 are ancient markers of ley line intersections throughout the Dolmenwood forest. Rune-etched and mossy, they thrum with magical energy that can be felt by those attuned to the arcane.\n\nThe Drune, a secretive cult of arcanists, jealously guard these stone circles. Common folk avoid the stones after dark, fearful of the Drune's reputation for kidnapping and human sacrifice. The stones serve as focal points for powerful rituals and are said to thin the boundary between the mortal world and the realm of Fairy.",
            },
        ],

        plots: [
            {
                id: IDS.plotForbiddenLove,
                title: "The Forbidden Love",
                description:
                    "The centuries-old love story between Sir Chyde and Princess Snowfall-at-Dusk. The knight's spirit lingers in his tomb, bound by the magical ring that connects their souls. The princess waits in her tower prison in Fairy, holding a perpetual wedding feast for the day her love arrives.",
                status: "active",
                relatedEntityIds: [IDS.sirChyde, IDS.princess],
            },
            {
                id: IDS.plotColdPrince,
                title: "The Cold Prince's Shadow",
                description:
                    "The banished fairy lord who once ruled all Dolmenwood under eternal winter. Though exiled, the Cold Prince's threat lingers \u2014 every year the magic weakening, frigid winds whispering of his return. The discovery of a doorway between worlds in Sir Chyde's tomb could be exactly what the Cold Prince needs to reclaim his dominion.",
                status: "active",
                relatedEntityIds: [],
            },
        ],

        factions: [
            {
                id: IDS.drune,
                name: "The Drune",
                description:
                    "A secretive cult of arcanists known as 'watchers of the wood.' They jealously guard the standing stone circles and ley lines of Dolmenwood. Common folk are terrified of their occult machinations, including kidnapping and rumours of human sacrifice.",
                goals: "Protect the stone circles and ley lines. Maintain their power over Dolmenwood's magical infrastructure.",
                alignment: "Neutral Evil",
                resources: "Powerful magic, stone circle network, influence through fear.",
                influence: "One of the most powerful factions in Dolmenwood, greatly feared for their occult powers.",
                memberIds: [IDS.dolmbrace, IDS.haithion],
                headquartersLocationId: IDS.whythingStones,
            },
            {
                id: IDS.frostElves,
                name: "The Frost Elves",
                description:
                    "The people of the Cold Prince \u2014 immortal fairies as fair as snow and as cruel as ice. They dwell in the realm of Fairy (also called Frigia), serving their banished lord. Some have secretly journeyed to Princess Snowfall-at-Dusk's tower to attend the perpetual wedding feast.",
                goals: "Serve the Cold Prince. Some secretly support the princess's hope for reunion with Sir Chyde.",
                alignment: "Neutral",
                resources: "Fairy magic, immunity to cold, ice weapons, innate spellcasting.",
                influence: "Rulers of Frigia in Fairy. Minimal direct influence in the mortal world.",
                memberIds: [IDS.princess, IDS.griddlegrim, IDS.grimmlegridge],
                headquartersLocationId: IDS.princessTower,
            },
            {
                id: IDS.church,
                name: "The Church of the One True God",
                description:
                    "The dominant mortal religion. Their clergy sealed Sir Chyde's tomb centuries ago when fey influence began creeping in, placing magical wards and guardians to prevent further encroachment from Fairy.",
                goals: "Protect the mortal world from fey corruption. Maintain the sealing of the tomb.",
                alignment: "Lawful Neutral",
                resources: "Holy wards, animated religious objects, consecrated guardians.",
                influence: "Major religious authority in Dolmenwood.",
                memberIds: [],
                headquartersLocationId: undefined,
            },
        ],

        npcs: [
            {
                id: IDS.princess,
                name: "Princess Snowfall-at-Dusk",
                description:
                    "Beautiful, ageless, otherworldly. Blonde hair the colour of winter sun. Pale skin scintillating like fresh snow. Blue crystalline eyes. Clad in white floaty gown with a star on her brow \u2014 a flashing crystal bound with silver cord.",
                traits: "Dignified, benevolent, resigned to her fate but not without hope. Excited at the possibilities strangers present.",
                motivations: "To be reunited with her love, Sir Chyde, who was tragically taken from her by his mortality.",
                secrets:
                    "She is magically banned from leaving her tower glade. Her professed love in the 'Dreams of the Lady' hook is a trick \u2014 she wants PCs to retrieve Sir Chyde's binding ring for her. She can grant a single wish via Royal Decree.",
                backstory:
                    "The seventeenth daughter of the Cold Prince, she fell in love with Sir Chyde during the ancient war between mortals and fairies. Her father imprisoned her in a forlorn tower in Fairy when he discovered their forbidden love.",
                stats: "AC 15, HP 44, CR 2. Innate spellcasting (charm person, hold person, invisibility, sleep 3/day each). Icicle Dagger +7 to hit. Can grant a wish once in her life.",
                exampleQuote: "The ring holds the key... My eternal salvation...",
                factionId: IDS.frostElves,
            },
            {
                id: IDS.sirChyde,
                name: "The Ghost of Sir Chyde",
                description:
                    "Pale, semi-transparent azure phantom. Thin, drawn with age. Armoured in ghostly plate mail with helm visor raised. Forlorn and love-lost. Kneeling before the portrait of his beloved.",
                traits:
                    "Maudlin, desperate, beseeching. Does not appreciate tomb robbers but will plead for help to be reunited with the princess.",
                motivations:
                    "Join his beloved in Fairy via the magical stairs and finally take her hand in marriage after centuries of separation.",
                secrets:
                    "His spirit is bound to Sir Chyde's binding ring \u2014 he cannot move more than 10 feet from it. If the ring is removed, he manifests once per day to haunt whoever stole it. He can possess living beings.",
                backstory:
                    "A near-mythical hero who fought in the war against the Cold Prince. He fell in love with the princess at the Whything Stones. After his death, the power of his binding ring called his spirit back from the beyond.",
                stats: "AC 17, HP 55, CR 4. Ethereal Sight, Incorporeal Movement, Ring-Bound, Ring-Juvenation. Knight's Punch +6 to hit (4d6+3 necrotic). Can possess humanoids (DC 16 Cha save).",
                exampleQuote:
                    "Please... help me reach my beloved. The stairs in the lower chambers lead to her realm. Take my ring there, and my soul will follow.",
                factionId: undefined,
            },
            {
                id: IDS.dolmbrace,
                name: "Dolmbrace",
                description:
                    "Hooded man in black cloak performing a ritual sacrifice at the Whything Stones. Mumbling incantations in an odd tongue. Knife held aloft \u2014 silver, curved. Wears a golden torc in the form of an owl.",
                traits:
                    "Regards peaceful strangers as auspicious. May offer PCs a role aiding the sacrifice. Powerful spellcaster \u2014 not to be trifled with.",
                motivations: "Complete the ritual sacrifice at the Whything Stones to honour the ley lines.",
                secrets:
                    "6th-level spellcaster. The Drune sect also assisted in the ancient war against the Cold Prince and respect the sanctity of Sir Chyde's tomb.",
                backstory: "A Drune ritualist performing a sacrifice at the standing stones beside the burial mound.",
                stats: "AC 13 (16 with mage armour), HP 39, CR 5. 6th-level spellcaster (spell save DC 14). Green Flame-Wreathed Staff, Conjure Dolmen (Recharge 6). Cantrips: blade ward, dancing lights, friends. Spells up to 3rd level.",
                exampleQuote: "Auspicious... strangers arrive as the stones align. Perhaps you would aid our work?",
                factionId: IDS.drune,
            },
            {
                id: IDS.haithion,
                name: "Haithion",
                description:
                    "Second hooded ritualist at the Whything Stones. Black cloak, golden torc shaped like an owl. Partner to Dolmbrace in the ceremony.",
                traits: "Focused on the ritual. Will defend the ceremony alongside Dolmbrace.",
                motivations: "Complete the ritual sacrifice at the Whything Stones.",
                secrets: "6th-level spellcaster, same capabilities as Dolmbrace.",
                backstory: "A Drune ritualist performing a sacrifice alongside Dolmbrace.",
                stats: "AC 13 (16 with mage armour), HP 39, CR 5. 6th-level spellcaster (spell save DC 14). Green Flame-Wreathed Staff, Conjure Dolmen (Recharge 6). Cantrips: blade ward, dancing lights, friends. Spells up to 3rd level.",
                exampleQuote: "The stones demand tribute. Do not interfere.",
                factionId: IDS.drune,
            },
            {
                id: IDS.briarAnne,
                name: "Briar-Anne",
                description:
                    "Young woman bound to the central standing stone. Wild-eyed, ecstatic, possibly under the influence of a drug or potion. Face daubed with glowing blue paint. Clad in black lacy gown. Red braided hair.",
                traits:
                    "Does not wish to be 'rescued' \u2014 she is a willing sacrifice to the creature Big Chook that lurks in the depths of Lake Longmere.",
                motivations: "Willing sacrifice; believes this is her purpose.",
                secrets: "She has been prepared by the Drune for this role. She speaks Woldish.",
                backstory: "A willing sacrifice chosen by the Drune for their ritual at the Whything Stones.",
                stats: "Commoner; speaks Woldish.",
                exampleQuote: "Do not pity me! This is my calling!",
                factionId: undefined,
            },
            {
                id: IDS.griddlegrim,
                name: "Griddlegrim",
                description:
                    "Scrawny goblin with big head, spindly neck. Dark grey warty skin. Huge yellow beady eyes. Dressed in purple velvet finery. Jovial with a whimsical sense of humour. Rides in a palanquin on the back of the troll Grimmlegridge.",
                traits:
                    "Checks names of visitors to the princess's tower. Allows invited wedding guests to enter. Will let uninvited people in if they eat a mushroom from his pouch.",
                motivations: "Guard the entrance to the tower. Serve the princess.",
                secrets: "His shroom pouch is magical \u2014 eating a mushroom invokes a random magical effect.",
                backstory: "A Dolmenwood goblin serving as the doorman for Princess Snowfall-at-Dusk's tower.",
                stats: "AC 14, HP 21, CR 1. Innate Spellcasting (minor illusion, prestidigitation at will; darkness, sleep 3/day; charm person, phantasmal force 1/day). Silver Allergy.",
                exampleQuote: "Name? Name! You must have a name on the list! No? Well... perhaps a mushroom would help...",
                factionId: IDS.frostElves,
            },
            {
                id: IDS.grimmlegridge,
                name: "Grimmlegridge",
                description:
                    "Hulking, obese troll (10 feet tall). Hairless clay-like flesh. Hessian clothes, ragged and filthy. Bulging pouch of moss-covered humanoid bones. Glowering, moody simpleton.",
                traits:
                    "Does what Griddlegrim tells him. Secretly wants to squash PCs and add their bodies to his moss-corpse collection at the forest edge.",
                motivations: "Serve as doorman and muscle for the tower entrance.",
                secrets: "Vulnerable to acid and fire. Regenerates 10 HP per round unless damaged by acid or fire.",
                backstory:
                    "A Dolmenwood troll serving as the muscle at the tower entrance, carrying Griddlegrim in a palanquin on his back.",
                stats: "AC 15, HP 84, CR 5. Regeneration 10. Mossy Fist +7 to hit (2d6+4 bludgeoning, DC 15 Con or mossy growths). Silver Allergy. Vulnerable to acid and fire.",
                exampleQuote: "Grimmlegridge squash?",
                factionId: IDS.frostElves,
            },
            {
                id: IDS.lordMantle,
                name: "Lord Mantle-of-Runes",
                description: "A frost elf friend of the princess. Announced by a cawing white raven.",
                traits: "Ally of Princess Snowfall-at-Dusk.",
                motivations: "Support the princess and attend the perpetual wedding feast.",
                secrets: "",
                backstory: "A frost elf noble who has secretly journeyed to the princess's tower to attend the wedding feast.",
                stats: "Frost Elf Noble",
                exampleQuote: "",
                factionId: IDS.frostElves,
            },
        ],

        locations: [
            {
                id: IDS.dolmenwood,
                name: "Dolmenwood",
                description:
                    "A dense, tangled forest where the mortal world and the realm of Fairy overlap. Brambles half-bury the paths. Twisted trees seem to close in around travellers. Ancient standing stones mark intersections of ley lines. The forest is home to talking toads, ghostly owls, tipsy goblin merchants, and stranger things.",
                secrets: "The boundary between the mortal world and Fairy is thin here. Ley lines crisscross beneath the forest floor.",
                subLocationIds: [IDS.whythingStones, IDS.burialMound],
            },
            {
                id: IDS.whythingStones,
                name: "The Whything Stones",
                description:
                    "An ancient circle of rune-etched standing stones in a forest clearing. The stones reflect eldritch markings in moonlight and are clad with dangling mossy beards. The air hums with latent magical energy.",
                secrets:
                    "This is where Sir Chyde and the princess first met. The Drune now use it for their rituals. The burial mound is nearby.",
                parentLocationId: IDS.dolmenwood,
                subLocationIds: [],
            },
            {
                id: IDS.burialMound,
                name: "The Burial Mound",
                description:
                    "A flat-topped hillock, evidently man-made, rising from the tangled Dolmenwood forest. A heavy granite slab, overgrown with lichen and sweet-smelling wild roses, seals the entrance. Inside lies a dank, musty tomb sealed for centuries.",
                secrets:
                    "Sir Chyde's tomb. The lower level contains a warded pool that serves as a portal to Fairy. The tomb was sealed by the Church when fey influence began creeping in.",
                parentLocationId: IDS.dolmenwood,
                subLocationIds: [IDS.priestQuarters, IDS.hallOfHounds],
            },
            {
                id: IDS.priestQuarters,
                name: "The Abandoned Priest's Quarters",
                description:
                    "A damp chamber accessible through a worm hole or hidden door. Rubble from a collapsed wall. 3 wormtongues lurk in the narrow tunnel. A mouldy writing desk with a locked drawer containing a brass sheet about Sir Chyde's hunting dogs.",
                secrets:
                    "Hidden flagstone in the NE corner. Beneath it: a locked metal box trapped with a poison dart (DC 15 to disarm). Inside: silver crucifix (50gp), scroll of hold person, prayer book (500gp), box of 20 holy wafers (cure 1hp each).",
                parentLocationId: IDS.burialMound,
                subLocationIds: [],
            },
            {
                id: IDS.hallOfHounds,
                name: "Hall of Hounds",
                description:
                    "Carved pillars depicting holy war scenes. Massive double doors of smooth stone, locked and warded by magic. Two stone hounds chained to the door base, larger than life.",
                secrets:
                    "Inscription: 'Call to the Companions.' Speaking the names of Sir Chyde's hounds (Flaegr and Chedr) opens the doors. Touching without the password animates the stone hounds to attack.",
                parentLocationId: IDS.burialMound,
                subLocationIds: [],
            },
            {
                id: IDS.towerOnLake,
                name: "Tower on a Frozen Lake",
                description:
                    "A wintry glade emerges beyond the warded pool. Bitter cold, 2 feet of deep snow, sparkling sunshine glinting off crystalline snow. A frozen lake surrounds a white marble tower. Purple crack in the sky drips sticky purple liquid. Hoar-clad forest at the edges with ominous fir-woods and mossy corpses.",
                secrets:
                    "The tower is Princess Snowfall-at-Dusk's prison in Fairy. Characters who came through the tomb ward can pass back, but it is impassable to others. 1d6 days have passed in the mortal world.",
                subLocationIds: [IDS.princessTower],
            },
            {
                id: IDS.princessTower,
                name: "The Princess's Tower",
                description:
                    "A white marble tower with solid cherry wood door, black iron fittings. Icy walls (DC 20 Athletics to climb). Frost-patterned windows. A thin plume of bluish smoke rises from the summit.",
                secrets: "This is Princess Snowfall-at-Dusk's magical prison. She cannot leave the tower glade.",
                parentLocationId: IDS.towerOnLake,
                subLocationIds: [],
            },
        ],

        items: [
            {
                id: IDS.bindingRing,
                name: "Sir Chyde's Binding Ring",
                description:
                    "A bronze band set with a moonstone, with fittings in the form of woven branches. This ring was given to Sir Chyde by Princess Snowfall-at-Dusk as a pledge of her love.",
                rarity: "legendary",
                properties:
                    "Binds the souls of two lovers together for eternity. The ghost of Sir Chyde is tethered to this ring and cannot exist more than 10' from it. Wearing the ring opens the magical door in the warded pool (area 14) leading to Fairy. If the ring is brought to the princess's tower, the two worlds begin to drift apart and the lovers can be reunited. If the ring is crushed, Sir Chyde's soul is released to the afterlife.",
            },
            {
                id: IDS.hubrisBlade,
                name: "Hubris Blade",
                description: "A longsword of fairy construction with wavy blood grooves, surrounded by a white glow.",
                rarity: "rare",
                properties:
                    "Weapon (longsword), rare. +2 to attack and damage rolls. Curse: In combat, you must succeed on a DC 16 Wisdom saving throw or be compelled to attack the largest or toughest target. You cannot willingly surrender or retreat until that target is defeated or has surrendered to you.",
            },
            {
                id: IDS.freezingMirror,
                name: "Freezing Mirror",
                description:
                    "A full-length (5 feet) silver-framed mirror, beautifully wrought, engraved with crucifixes and unicorns at play. Magical and ancient.",
                rarity: "rare",
                properties:
                    "Wondrous item, rare. Passing in front requires DC 20 Constitution saving throw or be frozen still (petrified condition). Worth 1,000gp. Covering bypasses the effect. 20 HP, damage threshold 10. Removing from the tomb causes its properties to fade after one month. Unfreezing: holy water, cure wounds, or sunlight.",
            },
            {
                id: IDS.fungiPouch,
                name: "Pouch of Limitless Fungi",
                description:
                    "A bulging moss-covered pouch made of humanoid bones, belonging to the Dolmenwood goblin Griddlegrim.",
                rarity: "uncommon",
                properties:
                    "Wondrous item, uncommon. Contains an endless supply of magical mushrooms. Eating one invokes a random magical effect (roll on table). The pouch is a fairy item and may have unpredictable side effects.",
            },
            {
                id: IDS.portrait,
                name: "Portrait of the Lady of the Wood",
                description:
                    "A hanging portrait depicting a fair maiden with long blonde hair and white robe, a star upon her brow, amid a stone circle (the Whything Stones). Aged and damp.",
                rarity: "uncommon",
                properties:
                    "If restored, worth 1,500gp. Commissioned by Sir Chyde as a portrait of his forbidden love, Princess Snowfall-at-Dusk.",
            },
        ],

        adventures: [
            {
                id: IDS.adventure,
                title: "Winter's Daughter",
                level: 3,
                hook:
                    "Two hooks lead PCs to the burial mound: either recurring dreams of a beautiful elf lady who promises her heart if the PCs retrieve her stolen ring, or an inheritance from a distant relative of Sir Chyde's family, with a charter revealing the tomb's location and the fabled treasures within.",
                theme: "Dark Fairy Tale, Dungeon Crawl, Romance",
                scenes: [
                    {
                        id: IDS.scene1,
                        title: "Approaching the Burial Mound",
                        type: "exploration",
                        readAloudText:
                            "The forest path grows wild and tangled. Brambles half-bury the trail, and the twisted trees seem to lean inward, as if trying to block your passage. Through the dense canopy, you catch glimpses of a flat-topped hillock rising unnaturally from the undergrowth \u2014 clearly man-made. A low, incomprehensible mumbling drifts from somewhere ahead.",
                        gmNotes:
                            "Random events every 5 minutes (1-in-6): ghostly violet-eyed owl (DC 12 Wis or unconscious 1d6 rounds), 1d4 tipsy goblin merchants from Fairy, gusts of wind (DC 12 Dex or 2d6 bludgeoning), huge warty toad that croaks 'Betrayal'. Mumbling leads to area 2.",
                        rewards: "",
                        npcIds: [],
                        locationId: IDS.dolmenwood,
                    },
                    {
                        id: IDS.scene2,
                        title: "Sacrifice at the Whything Stones",
                        type: "social",
                        readAloudText:
                            "You enter a clearing dominated by a ring of ancient standing stones, their surfaces etched with eldritch markings that catch the moonlight. Two hooded figures in black cloaks stand before the central stone, chanting in an unknown tongue. A young woman with red braided hair is bound to the stone, her face daubed with glowing blue paint. She appears ecstatic, not afraid.",
                        gmNotes:
                            "The Drune ritualists (Dolmbrace & Haithion) regard strangers as auspicious. They may offer PCs a role in the sacrifice. Briar-Anne is WILLING \u2014 she does not want to be rescued. If PCs attack the Drune, these are CR 5 spellcasters who can easily annihilate a low-level party. Let players know these are dangerous.",
                        rewards: "",
                        npcIds: [IDS.dolmbrace, IDS.haithion, IDS.briarAnne],
                        locationId: IDS.whythingStones,
                    },
                    {
                        id: IDS.scene3,
                        title: "The Tomb Entrance",
                        type: "exploration",
                        readAloudText:
                            "A heavy granite slab, thick with centuries of lichen and crowned with sweet-smelling wild roses, seals what appears to be an entrance into the mound. The stone is massive \u2014 it would take tremendous effort to move.",
                        gmNotes:
                            "DC 20 Strength to move the slab (advantage if 2+ creatures cooperate). Breaking: 60 HP, damage threshold 5. Worm hole (area 4) is an alternate entrance \u2014 2' wide, 3 wormtongues inside (AC 14, HP 22, CR 1/2).",
                        rewards: "",
                        npcIds: [],
                        locationId: IDS.burialMound,
                    },
                    {
                        id: IDS.scene4,
                        title: "Hall of Guardians",
                        type: "combat",
                        readAloudText:
                            "You descend into a musty, dank chamber. The air is stifling, the ceiling and walls dripping with moisture. Four mouldy objects stand on plinths in the corners \u2014 a crucifix, a wooden cherub statue, a holy book, and a huge candle. Dust coats the floor thickly. Heavy stone double doors stand at the far end, inscribed 'The Most Dear' in archaic script.",
                        gmNotes:
                            "The 4 animated religious objects (AC 17, HP 17, CR 1/4 each) attack any non-Lawful character who enters. They sermonize in shrill tones. Dusty floor conceals a mosaic of Sir Chyde piercing a fairy knight's heart.",
                        rewards: "",
                        npcIds: [],
                        locationId: IDS.burialMound,
                    },
                    {
                        id: IDS.scene5,
                        title: "The Family Crypt & Fissure",
                        type: "exploration",
                        readAloudText:
                            "Two skeletons waltz through the air in a slow, ghostly dance, arm in arm, slick with an opalescent moisture. One wears a pearl necklace, the other a gold medallion. Five stone coffers line the walls. A dark fissure splits the floor.",
                        gmNotes:
                            "The floating skeletons welcome strangers to dance. They attack if coffers are disturbed. The fissure leads down to Fairy \u2014 looking down shows glimpses of glimmering light like sunlight off snow.",
                        rewards: "Jewellery worth 500gp each (pearl necklace, gold medallion).",
                        npcIds: [],
                        locationId: IDS.burialMound,
                    },
                    {
                        id: IDS.scene6,
                        title: "The Knight's Tomb",
                        type: "social",
                        readAloudText:
                            "Beyond the great doors, you find a chamber of quiet reverence. A pale, semi-transparent figure in ghostly plate armour kneels before a hanging portrait of a beautiful maiden amid standing stones. The ghost turns to you with hollow, desperate eyes.",
                        gmNotes:
                            "Sir Chyde's ghost beseeches the PCs to bring his ring to the lower level stairs which lead to Fairy where his beloved waits. His skeleton lies in the coffer with copper bracelets (amethyst owl eyes, 1,000gp each) and the binding ring on his finger.",
                        rewards:
                            "Sir Chyde's Binding Ring, copper bracelets with amethyst eyes (1,000gp each), Portrait of the Lady (1,500gp if restored).",
                        npcIds: [IDS.sirChyde],
                        locationId: IDS.burialMound,
                    },
                    {
                        id: IDS.scene7,
                        title: "The Warded Pool",
                        type: "exploration",
                        readAloudText:
                            "You descend pristine stone stairs beneath a carved archway of interwoven stone trees. At the bottom, dozens of ghostly votive candles float in mid-air. Beyond them, a shimmering pool fills a vaulted chamber. In the center stands a white marble statue of a maiden \u2014 the same face as the portrait above.",
                        gmNotes:
                            "The candles are a ward \u2014 passing through triggers a wave of religious awe and transports PCs to Fairy. 1d6 days pass in the mortal world. The ward is immune to fairy magic but can be dispelled by non-fairies (DC 20, 9th-level equivalent).",
                        rewards: "",
                        npcIds: [],
                        locationId: IDS.burialMound,
                    },
                    {
                        id: IDS.scene8,
                        title: "Tower on the Frozen Lake",
                        type: "exploration",
                        readAloudText:
                            "Reality shimmers and reforms. You stand in bitter cold, breath condensing in streams of vapour. Two feet of pristine snow covers the ground. A frozen lake stretches before you, and upon an island at its centre rises a white marble tower. Above, a purple crack splits the sky.",
                        gmNotes:
                            "This is Fairy. Random events (1-in-6 every 5 min): 1d3 frost elf knights on white chargers, goblin sleigh-rider, cawing white raven announcing Lord Mantle-of-Runes, 2d6 winter wolves. The frozen lake requires DC 10 Acrobatics.",
                        rewards: "",
                        npcIds: [IDS.griddlegrim, IDS.grimmlegridge],
                        locationId: IDS.towerOnLake,
                    },
                    {
                        id: IDS.scene9,
                        title: "The Wedding Feast",
                        type: "social",
                        readAloudText:
                            "You climb the stairs into a grand hall bedecked for a celebration that has clearly been waiting for a very long time. The feasting table groans under roast swans, mountains of fruit, ice wines, and violet spirits. Around the table sit a dozen fairy folk \u2014 haughty knights and foppish nobles \u2014 all uncomfortably subdued. They have been waiting for centuries.",
                        gmNotes:
                            "WARNING: Any mortal who eats or drinks must DC 20 Wisdom save or be cursed with fairy melancholia (permanent curse). The frost elf guests are ambivalent but will call guards if disturbed.",
                        rewards: "",
                        npcIds: [],
                        locationId: IDS.princessTower,
                    },
                    {
                        id: IDS.scene10,
                        title: "The Princess's Plea",
                        type: "social",
                        readAloudText:
                            "The bedchamber is a vision of winter elegance \u2014 a canopy bed veiled with snow dust and white wolf skins, a dressing table glittering with ice-jewels, and melting icicles burning with electric blue flames in the fireplace. Before you stands Princess Snowfall-at-Dusk. Her crystalline blue eyes fix upon you with desperate hope.",
                        gmNotes:
                            "The princess wants the PCs to retrieve Sir Chyde's binding ring and bring it to her. His soul will follow the ring, allowing the lovers to be reunited. TWIST: If the ring is brought, the two worlds begin to drift apart and the doorway ceases to exist.",
                        rewards:
                            "Ice-jewels (200gp each x 30), fairy silver necklaces (150gp each x 12), platinum hoarfrost brooch (1,000gp), potentially a wish.",
                        npcIds: [IDS.princess],
                        locationId: IDS.princessTower,
                    },
                ],
            },
        ],
    };
}
