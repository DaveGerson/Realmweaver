/**
 * demoTemplates.ts
 *
 * Sample world description used to quick-fill the "Try a Demo World" prompt
 * in FirstCampaignWizard. This used to also carry a full demo campaign
 * payload (NPCs, factions, locations, items, a 10-scene adventure, plots,
 * articles) inside the body of a function, but that data was never
 * tree-shakeable — being produced by a called function rather than
 * separately-exported constants, Rollup couldn't drop it, and it ended up in
 * the main entry chunk even though the only consumer only ever read the
 * `.setting` prose paragraph. The entity payload has been removed; if a full
 * importable demo campaign is wanted again, add it under
 * `data/templates/*.json` behind the existing dynamic-import path instead
 * (see `data/templates/index.ts`), not as an inline literal here.
 */

/**
 * Sample world description for the Winter's Daughter demo — a dark
 * fairy-tale dungeon crawl setting, used to pre-fill the "world description"
 * field in FirstCampaignWizard's "Try a Demo World" quick-fill.
 */
export const WINTERS_DAUGHTER_SETTING =
    "Dolmenwood — a weird fairy tale forest where the mortal world and the immortal realm of Fairy lie close together. Ancient standing stones mark ley lines, mysterious cultists guard stone circles, and the threat of a banished fairy prince lingers in every frigid wind. The forest is thick with brambles, twisted trees, and the faint sound of unearthly laughter drifting from the glades.";

/**
 * Returns the Winter's Daughter sample world description. Kept as a function
 * (rather than importing the const directly) so call sites don't need to
 * change if this ever grows back into an async template lookup.
 */
export function getWintersDaughterTemplate(): { setting: string } {
    return { setting: WINTERS_DAUGHTER_SETTING };
}
