import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateStarterAdventure } from '../services/aiService';

// aiService.ts:generateStarterAdventure (mock mode) previously failed to
// typecheck (TS2322) because mockService's raw scene objects use `type` /
// `status` typed as plain `string`, not the `SceneType` / `SceneStatus`
// literal unions `AdventureForBatchAdd` requires. This proves the adapter
// added to close that gap actually narrows the values at runtime, not just
// satisfies the compiler.
describe('aiService.generateStarterAdventure — mock mode adapter', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('returns scenes with valid SceneType/SceneStatus literal values', async () => {
        vi.useFakeTimers();
        const validTypes = ['combat', 'social', 'exploration', 'puzzle'];
        const validStatuses = ['planned', 'in-progress', 'completed'];

        const resultPromise = generateStarterAdventure(
            'A haunted coastal town.',
            [],
            [],
            /* isMockMode */ true
        );
        await vi.runAllTimersAsync();
        const adventure = await resultPromise;

        expect(adventure.scenes.length).toBeGreaterThan(0);
        for (const scene of adventure.scenes) {
            expect(validTypes).toContain(scene.type);
            expect(validStatuses).toContain(scene.status);
        }
    });
});
