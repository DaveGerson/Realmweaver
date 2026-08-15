/**
 * wp-d-linking — finding #2
 *
 * `getArticleExpandedDetails` returns the Content row as
 * `{ value: content.slice(0, 500), fieldKey: 'content', editable: true }`.
 * EntityQuickCard renders every detail with `editable && fieldKey` as an
 * <EditableField>, whose blur handler calls
 * `saveEntityField('article', id, 'content', localValue)` →
 * `campaignService.updateArticle(id, { content: value })`.
 *
 * So a 4,000-character lorebook article that the GM touches in the quick card
 * is permanently rewritten to its first 500 characters.
 *
 * Contract (either remedy satisfies it):
 *   an editable Content row MUST carry the article's FULL content; if the
 *   extractor wants to truncate for display, the row must not be editable.
 */

import { describe, it, expect } from 'vitest';
import { getArticleExpandedDetails } from '../../utils/entityDetailExtractors';
import type { Article } from '../../types/Article';

function makeArticle(overrides: Partial<Article> = {}): Article {
    return {
        id: 'art-1',
        title: 'The Sundering',
        category: 'history',
        content: '',
        subArticleIds: [],
        relatedEntityIds: [],
        ...overrides,
    };
}

describe('wp-d-linking #2 — quick-card inline edit must not truncate article content', () => {
    it('never exposes a truncated Content value as an editable field', () => {
        const longContent = 'The Sundering began when '.repeat(160); // 4,000 chars
        expect(longContent.length).toBe(4000);

        const details = getArticleExpandedDetails(makeArticle({ content: longContent }), null);
        const content = details.find(d => d.label === 'Content');
        expect(content).toBeDefined();

        if (content!.editable && content!.fieldKey) {
            // Editable ⇒ the value round-trips through saveEntityField verbatim,
            // so it must be the complete article body.
            expect(content!.value.length).toBe(longContent.length);
            expect(content!.value).toBe(longContent);
        } else {
            // Read-only display truncation is acceptable, but then the row must
            // not be wired to a fieldKey-driven save.
            expect(content!.editable).toBe(false);
        }
    });

    it('leaves short content editable and intact (no regression)', () => {
        const short = 'A short article body.';
        const details = getArticleExpandedDetails(makeArticle({ content: short }), null);
        const content = details.find(d => d.label === 'Content');
        expect(content?.value).toBe(short);
        expect(content?.editable).toBe(true);
        expect(content?.fieldKey).toBe('content');
    });
});
