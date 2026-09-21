import type {
  Campaign,
  DmAction,
  DmProposal,
  DmTurnResult,
  DungeonMasterState,
} from '@/types/index';
import { proposeDungeonMasterTurn } from './aiService';
import { executeAction, RulingRequired } from './rules/engine';
import type { DieRoller } from './rules/dice';

function appendTurn(
  state: DungeonMasterState,
  input: string,
  proposal: DmProposal,
  resultText: string,
): DungeonMasterState {
  const next = structuredClone(state);
  next.messages.push(
    { id: crypto.randomUUID(), role: 'player', text: input, rulePages: [] },
    {
      id: crypto.randomUUID(),
      role: 'dm',
      text: resultText,
      rulePages: proposal.rulePages,
    },
  );
  next.revision++;
  return next;
}
export function resolveDmProposal(
  state: DungeonMasterState,
  input: string,
  proposal: DmProposal,
  die?: DieRoller,
): DmTurnResult {
  if (proposal.needsRuling)
    return {
      state: appendTurn(
        state,
        input,
        proposal,
        `${proposal.narration}\n\nRuling needed: ${proposal.needsRuling}`,
      ),
      proposal,
      events: [],
      status: 'needs-ruling',
    };
  try {
    const resolved = proposal.action
      ? executeAction(state, proposal.action, die)
      : { state, events: [] };
    // The resolved log is authoritative. A second free-form completion cannot
    // replace a miss with a hit or rewrite resource expenditure.
    const text = [
      proposal.narration,
      ...resolved.events.map((e) => e.text),
    ].join('\n\n');
    return {
      state: appendTurn(resolved.state, input, proposal, text),
      proposal,
      events: resolved.events,
      status: 'resolved',
    };
  } catch (error) {
    if (!(error instanceof RulingRequired)) throw error;
    const blocked = {
      ...proposal,
      action: null,
      needsRuling: error.message,
      rulePages: [...new Set([...proposal.rulePages, ...error.rulePages])],
    };
    return {
      state: appendTurn(
        state,
        input,
        blocked,
        `${proposal.narration}\n\nRuling needed: ${error.message}`,
      ),
      proposal: blocked,
      events: [],
      status: 'needs-ruling',
    };
  }
}
export async function runDungeonMasterTurn(
  campaign: Campaign,
  state: DungeonMasterState,
  input: string,
  actingActorId: string,
  isMockMode: boolean,
): Promise<DmTurnResult> {
  const proposal = await proposeDungeonMasterTurn(
    campaign,
    state,
    input,
    actingActorId,
    isMockMode,
  );
  return resolveDmProposal(state, input, proposal);
}
export function runDirectDmAction(
  state: DungeonMasterState,
  action: DmAction,
  die?: DieRoller,
): DungeonMasterState {
  const result = executeAction(state, action, die);
  result.state.messages.push({
    id: crypto.randomUUID(),
    role: 'system',
    text: result.events.map((e) => e.text).join('\n'),
    rulePages: [...new Set(result.events.flatMap((e) => e.rulePages))],
  });
  return result.state;
}
