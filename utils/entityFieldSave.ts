
import { campaignService } from '@/services/campaignService';
import type { QuickCardEntityType } from '@/utils/entityDetailExtractors';

// ── Field save dispatcher ─────────────────────────────────────────────────────
// Calls the appropriate campaignService update method for inline quick-card edits.

export function saveEntityField(entityType: QuickCardEntityType, entityId: string, fieldKey: string, value: string): void {
  switch (entityType) {
    case 'npc':
      campaignService.updateNpc(entityId, { [fieldKey]: value });
      break;
    case 'location':
      campaignService.updateLocation(entityId, { [fieldKey]: value });
      break;
    case 'faction':
      campaignService.updateFaction(entityId, { [fieldKey]: value });
      break;
    case 'item':
      campaignService.updateItem(entityId, { [fieldKey]: value });
      break;
    case 'adventure':
      campaignService.updateAdventure(entityId, { [fieldKey]: value });
      break;
    case 'article':
      campaignService.updateArticle(entityId, { [fieldKey]: value });
      break;
    case 'plot':
      campaignService.updatePlot(entityId, { [fieldKey]: value });
      break;
    case 'session-log':
      campaignService.updateSessionLog(entityId, { [fieldKey]: value });
      break;
    case 'scene': {
      const campaign = campaignService.getActiveCampaign();
      if (!campaign) break;
      for (const adv of campaign.adventures) {
        if (adv.scenes.some(s => s.id === entityId)) {
          campaignService.updateScene(adv.id, entityId, { [fieldKey]: value });
          break;
        }
      }
      break;
    }
    // player-character: no inline editing (complex nested structure)
    default:
      break;
  }
}
