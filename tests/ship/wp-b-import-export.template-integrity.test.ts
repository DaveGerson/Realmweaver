/**
 * wp-b-import-export.template-integrity.test.ts
 *
 * idx 123 — referential-integrity guard for the four shipped campaign
 * templates in data/templates/*.json.
 *
 * This is a test-gap finding: the JSON files are currently clean, so this
 * suite is expected to be GREEN today. Its value is that it fails the moment
 * a future edit introduces a typo'd cross-reference or drifts the hardcoded
 * `TEMPLATE_META.entityCounts`. Without it, a broken reference is invisible:
 * `importTemplateData`'s `remap()` mints a brand-new UUID for any unknown id,
 * so a first-run user gets a scene pointing at an NPC that does not exist.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { TEMPLATE_META } from '../../data/templates/index';

type Json = Record<string, unknown>;

const loadTemplateJson = (fileName: string): Json =>
  JSON.parse(
    readFileSync(new URL(`../../data/templates/${fileName}`, import.meta.url), 'utf-8'),
  ) as Json;

const arr = (value: unknown): Json[] => (Array.isArray(value) ? (value as Json[]) : []);

const idsOf = (value: unknown): string[] =>
  arr(value)
    .map((e) => e['id'])
    .filter((id): id is string => typeof id === 'string');

describe('shipped template registry', () => {
  it('declares at least one template', () => {
    expect(TEMPLATE_META.length).toBeGreaterThan(0);
  });
});

describe.each(TEMPLATE_META.map((m) => [m.id, m] as const))(
  'shipped template: %s',
  (_id, meta) => {
    const data = loadTemplateJson(meta.fileName);

    const npcIds = new Set(idsOf(data['npcs']));
    const locationIds = new Set(idsOf(data['locations']));
    const factionIds = new Set(idsOf(data['factions']));
    const itemIds = new Set(idsOf(data['items']));
    const plotIds = new Set(idsOf(data['plots']));
    const articleIds = new Set(idsOf(data['articles']));
    const allIds = new Set<string>([
      ...npcIds,
      ...locationIds,
      ...factionIds,
      ...itemIds,
      ...plotIds,
      ...articleIds,
    ]);

    /** Collects every [label, referencedId, allowedSet] triple in the file. */
    const refs: Array<[string, string, Set<string>]> = [];

    arr(data['npcs']).forEach((npc) => {
      if (typeof npc['factionId'] === 'string') {
        refs.push([`npc "${npc['name']}".factionId`, npc['factionId'], factionIds]);
      }
    });

    arr(data['factions']).forEach((faction) => {
      (Array.isArray(faction['memberIds']) ? (faction['memberIds'] as unknown[]) : []).forEach(
        (mid) => {
          if (typeof mid === 'string') {
            refs.push([`faction "${faction['name']}".memberIds`, mid, npcIds]);
          }
        },
      );
      if (typeof faction['leaderId'] === 'string') {
        refs.push([`faction "${faction['name']}".leaderId`, faction['leaderId'], npcIds]);
      }
      if (typeof faction['headquartersLocationId'] === 'string') {
        refs.push([
          `faction "${faction['name']}".headquartersLocationId`,
          faction['headquartersLocationId'],
          locationIds,
        ]);
      }
    });

    arr(data['locations']).forEach((loc) => {
      if (typeof loc['parentLocationId'] === 'string') {
        refs.push([`location "${loc['name']}".parentLocationId`, loc['parentLocationId'], locationIds]);
      }
      (Array.isArray(loc['subLocationIds']) ? (loc['subLocationIds'] as unknown[]) : []).forEach(
        (sid) => {
          if (typeof sid === 'string') {
            refs.push([`location "${loc['name']}".subLocationIds`, sid, locationIds]);
          }
        },
      );
      (Array.isArray(loc['connections']) ? (loc['connections'] as Json[]) : []).forEach((conn) => {
        if (typeof conn['targetLocationId'] === 'string') {
          refs.push([
            `location "${loc['name']}".connections.targetLocationId`,
            conn['targetLocationId'],
            locationIds,
          ]);
        }
      });
      if (typeof loc['controllingFactionId'] === 'string') {
        refs.push([
          `location "${loc['name']}".controllingFactionId`,
          loc['controllingFactionId'],
          factionIds,
        ]);
      }
    });

    arr(data['adventures']).forEach((adv) => {
      arr(adv['scenes']).forEach((scene) => {
        if (typeof scene['locationId'] === 'string') {
          refs.push([`scene "${scene['title']}".locationId`, scene['locationId'], locationIds]);
        }
        (Array.isArray(scene['npcIds']) ? (scene['npcIds'] as unknown[]) : []).forEach((nid) => {
          if (typeof nid === 'string') {
            refs.push([`scene "${scene['title']}".npcIds`, nid, npcIds]);
          }
        });
      });
    });

    arr(data['plots']).forEach((plot) => {
      (Array.isArray(plot['relatedEntityIds']) ? (plot['relatedEntityIds'] as unknown[]) : []).forEach(
        (eid) => {
          if (typeof eid === 'string') {
            refs.push([`plot "${plot['title']}".relatedEntityIds`, eid, allIds]);
          }
        },
      );
    });

    it('every cross-reference id resolves to an entity defined in the same file', () => {
      const dangling = refs
        .filter(([, id, allowed]) => !allowed.has(id))
        .map(([label, id]) => `${label} → ${id}`);
      expect(dangling).toEqual([]);
    });

    it('entity ids are unique within the file', () => {
      const all = [
        ...idsOf(data['npcs']),
        ...idsOf(data['locations']),
        ...idsOf(data['factions']),
        ...idsOf(data['items']),
        ...idsOf(data['plots']),
        ...idsOf(data['articles']),
        ...arr(data['adventures']).flatMap((a) => [
          ...idsOf([a] as unknown),
          ...idsOf(a['scenes']),
        ]),
      ];
      expect(new Set(all).size).toBe(all.length);
    });

    it('declared entityCounts match the actual arrays', () => {
      const sceneCount = arr(data['adventures']).reduce(
        (sum, adv) => sum + arr(adv['scenes']).length,
        0,
      );
      expect({
        npcs: arr(data['npcs']).length,
        locations: arr(data['locations']).length,
        factions: arr(data['factions']).length,
        adventures: arr(data['adventures']).length,
        scenes: sceneCount,
        plots: arr(data['plots']).length,
      }).toEqual(meta.entityCounts);
    });

    it('every entity carries a non-empty id and name/title', () => {
      const nameless: string[] = [];
      for (const key of ['npcs', 'locations', 'factions', 'items'] as const) {
        arr(data[key]).forEach((e, i) => {
          if (typeof e['id'] !== 'string' || e['id'].trim() === '') nameless.push(`${key}[${i}].id`);
          if (typeof e['name'] !== 'string' || e['name'].trim() === '')
            nameless.push(`${key}[${i}].name`);
        });
      }
      for (const key of ['adventures', 'plots', 'articles'] as const) {
        arr(data[key]).forEach((e, i) => {
          if (typeof e['id'] !== 'string' || e['id'].trim() === '') nameless.push(`${key}[${i}].id`);
          if (typeof e['title'] !== 'string' || e['title'].trim() === '')
            nameless.push(`${key}[${i}].title`);
        });
      }
      expect(nameless).toEqual([]);
    });
  },
);
