import { TextMatchingEngine } from './matchingEngine';
import type { MatchingEngine } from './matchingEngine';

let currentEngine: MatchingEngine | null = null;

export function getMatchingEngine(): MatchingEngine {
  if (!currentEngine) {
    currentEngine = new TextMatchingEngine();
  }
  return currentEngine;
}

export function setMatchingEngine(engine: MatchingEngine): void {
  currentEngine = engine;
}

export function resetMatchingEngine(): void {
  currentEngine = null;
}
