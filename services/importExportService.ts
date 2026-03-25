// FIX: Updated type import path to use the barrel file 'types/index.ts'.
import type { Campaign, Article } from '../types/index';

const generateMarkdownForCampaign = (campaign: Campaign): string => {
    let md = `# ${campaign.title}\n\n`;
    md += `## Campaign Setting\n\n${campaign.setting}\n\n`;

    md += `---\n\n# World Entities\n\n`;
    
    // NPCs
    if (campaign.npcs.length > 0) {
        md += `## NPCs\n\n`;
        campaign.npcs.forEach(npc => {
            md += `### ${npc.name}\n\n`;
            if (npc.description) md += `- **Description:** ${npc.description}\n`;
            if (npc.traits) md += `- **Traits:** ${npc.traits}\n`;
            if (npc.exampleQuote) md += `- **Quote:** *"${npc.exampleQuote}"*\n`;
            if (npc.motivations) md += `- **Motivations:** ${npc.motivations}\n`;
            if (npc.secrets) md += `- **Secrets (GM Only):** ${npc.secrets}\n`;
            if (npc.backstory) md += `- **Backstory:** ${npc.backstory}\n`;
            md += `\n`;
        });
    }

    // Locations
    if (campaign.locations.length > 0) {
        md += `## Locations\n\n`;
        campaign.locations.forEach(location => {
            md += `### ${location.name}\n\n`;
            if (location.description) md += `- **Description:** ${location.description}\n`;
            if (location.secrets) md += `- **Secrets:** ${location.secrets}\n`;
            md += `\n`;
        });
    }

    // Factions
    if (campaign.factions.length > 0) {
        md += `## Factions\n\n`;
        campaign.factions.forEach(faction => {
            md += `### ${faction.name}\n\n`;
            if (faction.description) md += `- **Description:** ${faction.description}\n`;
            if (faction.goals) md += `- **Goals:** ${faction.goals}\n`;
            md += `\n`;
        });
    }

    // Items
    if (campaign.items.length > 0) {
        md += `## Items\n\n`;
        campaign.items.forEach(item => {
            md += `### ${item.name} (${item.rarity})\n\n`;
            if (item.description) md += `- **Description:** ${item.description}\n`;
            if (item.properties) md += `- **Properties:** ${item.properties}\n`;
            md += `\n`;
        });
    }
    
    // Articles (Lorebook)
    if (campaign.articles.length > 0) {
        md += `## Lorebook\n\n`;
        const topLevelArticles = campaign.articles.filter(a => !a.parentArticleId);
        const allArticles = campaign.articles;
        
        const renderArticle = (article: Article, level: number) => {
            let articleMd = `${'#'.repeat(level + 3)} ${article.title} (${article.category})\n\n`;
            articleMd += `${article.content}\n\n`;
            
            const children = allArticles.filter(a => a.parentArticleId === article.id);
            children.forEach(child => {
                articleMd += renderArticle(child, level + 1);
            });
            return articleMd;
        }

        topLevelArticles.forEach(article => {
            md += renderArticle(article, 0);
        });
    }


    md += `---\n\n# Storylines\n\n`;

    // Adventures
    if (campaign.adventures.length > 0) {
        campaign.adventures.forEach(adventure => {
            md += `## Adventure: ${adventure.title}\n\n`;
            md += `- **Hook:** ${adventure.hook}\n`;
            md += `- **Theme:** ${adventure.theme}\n`;
            md += `- **Target Level:** ${adventure.level}\n\n`;

            adventure.scenes.forEach(scene => {
                const location = campaign.locations.find(l => l.id === scene.locationId);
                md += `### Scene: ${scene.title}${location ? ` (${location.name})` : ''}\n\n`;
                md += `**Type:** ${scene.type}\n\n`;
                if(scene.readAloudText) md += `**Read-Aloud Text:**\n> ${scene.readAloudText.replace(/\n/g, '\n> ')}\n\n`;
                if(scene.gmNotes) md += `**GM Notes:**\n> ${scene.gmNotes.replace(/\n/g, '\n> ')}\n\n`;
                
                const sceneNpcs = campaign.npcs.filter(npc => scene.npcIds.includes(npc.id));
                if (sceneNpcs.length > 0) {
                    md += `**NPCs Present:** ${sceneNpcs.map(n => n.name).join(', ')}\n\n`;
                }
                
                if (scene.skillChecks && scene.skillChecks.length > 0) {
                    md += `**Skill Checks:**\n`;
                    scene.skillChecks.forEach(sc => {
                        md += `- **${sc.skill} (DC ${sc.dc}):** ${sc.description}\n`;
                    });
                    md += `\n`;
                }

                if (scene.rewards) md += `**Rewards:** ${scene.rewards}\n\n`;
            });
        });
    }

    // Session Logs
    if (campaign.sessionLogs && campaign.sessionLogs.length > 0) {
        md += `## Session Logs\n\n`;
        campaign.sessionLogs.sort((a, b) => new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime()).forEach(log => {
            md += `### ${log.title} (${new Date(log.sessionDate).toLocaleDateString()})\n\n`;
            if (log.recap) md += `**Recap:**\n${log.recap}\n\n`;
            if (log.notableEvents) md += `**Notable Events:**\n${log.notableEvents}\n\n`;
            if (log.looseEnds) md += `**Loose Ends:**\n${log.looseEnds}\n\n`;
        });
    }


    return md;
};

const downloadFile = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export const exportCampaignAsJson = (campaign: Campaign) => {
    const filename = `${campaign.title.replace(/ /g, '_')}.json`;
    // SECURITY: Strip sensitive fields before export to prevent credential leakage
    const { gcpApiKey: _omit, ...exportable } = campaign;
    const content = JSON.stringify(exportable, null, 2);
    downloadFile(filename, content, 'application/json');
};

export const exportCampaignAsObsidian = (campaign: Campaign) => {
    const filename = `${campaign.title.replace(/ /g, '_')}.md`;
    const content = generateMarkdownForCampaign(campaign);
    downloadFile(filename, content, 'text/markdown');
};

export const importCampaignFromJson = (file: File): Promise<Campaign> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const result = event.target?.result as string;
                const data = JSON.parse(result);
                // Basic validation
                if (data.id && data.title && Array.isArray(data.npcs)) {
                    // Normalize all entity arrays for backward compatibility
                    // (Fix C-1: older exports may be missing fields added after initial release)
                    data.locations = data.locations || [];
                    data.factions = data.factions || [];
                    data.items = data.items || [];
                    data.adventures = data.adventures || [];
                    data.articles = data.articles || [];
                    data.sessionLogs = data.sessionLogs || [];
                    data.playerCharacters = data.playerCharacters || [];
                    data.plots = data.plots || [];
                    data.notes = data.notes || [];
                    data.secrets = data.secrets || [];
                    resolve(data as Campaign);
                } else {
                    reject(new Error("Invalid campaign file format."));
                }
            } catch (e) {
                reject(new Error("Failed to parse JSON file."));
            }
        };
        reader.onerror = () => {
            reject(new Error("Failed to read file."));
        };
        reader.readAsText(file);
    });
};