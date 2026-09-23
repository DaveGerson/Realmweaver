// @vitest-environment jsdom
/**
 * Roadmap L7 — LinkedText routes through the shared linking engine.
 *
 * Covers: engine parity on a randomised-ish corpus, ambiguity rendering,
 * index sharing across many mounted paragraphs, and custom-engine routing.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';

const h = vi.hoisted(() => ({
  state: { campaigns: [] as any[], activeCampaignId: 'c-1' },
}));

vi.mock('../../services/campaignService', () => ({
  campaignService: {
    subscribe: (_listener: () => void) => () => {},
    getState: () => h.state,
    getActiveCampaign: () => h.state.campaigns[0],
  },
}));

import { LinkedText, segmentsFromMatches, getCampaignLinkCandidates } from '../../components/common/LinkedText';
import { TextMatchingEngine } from '../../services/linking/matchingEngine';
import type { EntityMatch } from '../../services/linking/matchingEngine';
import { setMatchingEngine, resetMatchingEngine } from '../../services/linking/engineRegistry';

function seedCampaign(partial: Record<string, any[]>) {
  h.state.campaigns = [{
    id: 'c-1', title: 'T', setting: '', settingType: 'custom',
    npcs: [], locations: [], factions: [], items: [],
    adventures: [], articles: [], plots: [],
    sessionLogs: [], playerCharacters: [], notes: [],
    ...partial,
  }];
}

function linkLabels(): string[] {
  return screen.queryAllByRole('button').map(b => b.textContent ?? '');
}

beforeEach(() => {
  h.state = { campaigns: [], activeCampaignId: 'c-1' };
  resetMatchingEngine();
});

afterEach(() => {
  resetMatchingEngine();
  cleanup();
});

describe('LinkedText ↔ engine parity', () => {
  const corpus = [
    'Kalli Alran met the Emerald Claw in Salvation.',
    'KALLI ALRAN and kalli argued about the emerald claw.',
    'Anaïs, Ana and Ana_backup walked the Great Library.',
    'İzmir Gate: where Sera and SERA-7 wait.',
    'Nothing to see here.',
    'The Great Library of Great Kings holds the Sunblade.',
  ];

  it('renders exactly the spans the engine returns, for every entity type', () => {
    seedCampaign({
      npcs: [
        { id: 'n1', name: 'Kalli Alran' }, { id: 'n2', name: 'Kalli' },
        { id: 'n3', name: 'Ana' }, { id: 'n4', name: 'Anaïs' }, { id: 'n5', name: 'Sera' },
      ],
      factions: [{ id: 'f1', name: 'The Emerald Claw' }, { id: 'f2', name: 'Emerald Claw' }],
      locations: [{ id: 'l1', name: 'Salvation' }, { id: 'l2', name: 'The Great Library' }, { id: 'l3', name: 'Great' }],
      items: [{ id: 'i1', name: 'Sunblade' }],
      adventures: [{ id: 'a1', title: 'Great Kings' }],
      articles: [{ id: 'ar1', title: 'İzmir Gate' }],
      plots: [{ id: 'p1', title: 'Al' }],
    });

    const engine = new TextMatchingEngine();
    const candidates = getCampaignLinkCandidates(h.state.campaigns[0]);

    for (const text of corpus) {
      cleanup();
      const { container } = render(<LinkedText text={text} onNavigate={() => {}} />);
      const expected = engine.findMatches(text, candidates).map(m => text.slice(...m.matchSpan));
      expect(linkLabels()).toEqual(expected);
      expect(container.textContent).toBe(text);
    }
  });

  it('includes adventure/article/plot titles as link targets', () => {
    seedCampaign({
      adventures: [{ id: 'a1', title: 'Curse of Strahd' }],
      articles: [{ id: 'ar1', title: 'Barovian Calendar' }],
      plots: [{ id: 'p1', title: 'The Dark Pact' }],
    });
    render(<LinkedText text="Curse of Strahd, Barovian Calendar, The Dark Pact." onNavigate={() => {}} />);
    expect(linkLabels()).toEqual(['Curse of Strahd', 'Barovian Calendar', 'The Dark Pact']);
  });
});

describe('LinkedText ambiguity rendering', () => {
  it('links ambiguous names to the first candidate and lists all candidates in a tooltip', () => {
    seedCampaign({
      npcs: [{ id: 'm1', name: 'Marcus' }, { id: 'm2', name: 'Marcus' }],
      factions: [{ id: 'f1', name: 'Marcus' }],
    });
    const { container } = render(<LinkedText text="Marcus smiled." onNavigate={() => {}} />);

    expect(linkLabels()).toEqual(['Marcus']);
    const marker = container.querySelector('[data-ambiguous="true"]');
    expect(marker).not.toBeNull();
    expect(marker!.getAttribute('title')).toContain('3 entities');
    expect(marker!.getAttribute('title')).toContain('Marcus (NPC)');
    expect(marker!.getAttribute('title')).toContain('Marcus (Faction)');
    // Text content is untouched by the indicator.
    expect(container.textContent).toBe('Marcus smiled.');
    // Wavy (not dotted) underline distinguishes ambiguous links.
    expect(screen.getByRole('button').className).toContain('decoration-wavy');

    // The link targets the first candidate.
    const text = 'Marcus smiled.';
    const candidates = getCampaignLinkCandidates(h.state.campaigns[0]);
    const [seg] = segmentsFromMatches(text, new TextMatchingEngine().findMatches(text, candidates));
    expect(seg).toMatchObject({ kind: 'link', entityId: 'm1', entityType: 'npc' });
    expect(seg.kind === 'link' && seg.alternatives.map(a => a.entityId)).toEqual(['m2', 'f1']);
  });

  it('does not mark unambiguous links', () => {
    seedCampaign({ npcs: [{ id: 'b', name: 'Brackle' }] });
    const { container } = render(<LinkedText text="Brackle hides." onNavigate={() => {}} />);
    expect(container.querySelector('[data-ambiguous]')).toBeNull();
  });
});

describe('LinkedText performance — shared engine index', () => {
  it('builds the engine index once for many paragraphs of the same campaign', () => {
    seedCampaign({ npcs: [{ id: 'b', name: 'Brackle' }], locations: [{ id: 'l', name: 'Salvation' }] });
    const engine = new TextMatchingEngine();
    setMatchingEngine(engine);

    const texts = Array.from({ length: 25 }, (_, i) => `Paragraph ${i}: Brackle reaches Salvation.`);
    render(<div>{texts.map(t => <p key={t}><LinkedText text={t} onNavigate={() => {}} /></p>)}</div>);

    expect(linkLabels()).toHaveLength(50);
    expect(engine.indexBuilds).toBe(1);
  });

  it('rebuilds once the campaign object changes (rename)', () => {
    seedCampaign({ npcs: [{ id: 'b', name: 'Brackle' }] });
    const engine = new TextMatchingEngine();
    setMatchingEngine(engine);

    const { rerender } = render(<LinkedText text="Brackle and Brackleton" onNavigate={() => {}} />);
    expect(linkLabels()).toEqual(['Brackle']);

    seedCampaign({ npcs: [{ id: 'b', name: 'Brackleton' }] });
    rerender(<LinkedText text="Brackle and Brackleton " onNavigate={() => {}} />);
    expect(linkLabels()).toEqual(['Brackleton']);
    expect(engine.indexBuilds).toBe(2);
  });
});

describe('LinkedText routes through the engine registry', () => {
  it('uses a custom engine set via setMatchingEngine', () => {
    seedCampaign({ npcs: [{ id: 'n1', name: 'Kalli Alran' }] });
    setMatchingEngine({
      findMatches: (text) => [{
        entityId: 'n1', entityType: 'npc', entityName: 'Kalli Alran',
        confidence: 1, matchSpan: [0, Math.min(4, text.length)],
      }],
      info: () => ({ name: 'Stub', version: '0' }),
    });
    render(<LinkedText text="Word soup" onNavigate={() => {}} />);
    expect(linkLabels()).toEqual(['Word']);
  });
});

describe('segmentsFromMatches — defensive against custom engines', () => {
  const m = (start: number, end: number, entityType = 'npc', id = 'x'): EntityMatch => ({
    entityId: id, entityType, entityName: 'x', confidence: 1, matchSpan: [start, end],
  });

  it('sorts spans, drops overlaps, out-of-range spans and unknown types, and covers the full text', () => {
    const text = 'abcdefghij';
    const segs = segmentsFromMatches(text, [
      m(6, 8), m(0, 3), m(2, 5), m(9, 20), m(4, 4), m(8, 9, 'secret'),
    ]);
    expect(segs.map(s => s.text).join('')).toBe(text);
    expect(segs.filter(s => s.kind === 'link').map(s => s.text)).toEqual(['abc', 'gh']);
  });
});
