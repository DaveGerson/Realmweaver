import React, { useMemo, useState } from 'react';
import type { Adventure, Campaign } from '../types/index';
import { Button } from './common/Button';
import { Clipboard, Check } from 'lucide-react';

interface PrepDocumentViewProps {
  adventure: Adventure;
  campaign: Campaign;
}

const generateMarkdown = (adventure: Adventure, campaign: Campaign): string => {
    let md = `# ${adventure.title}\n\n`;

    // ## Adventure Background
    md += `## Adventure Background\n\n`;
    md += `>[!note] GM's Background\n`;
    md += `> **Themes:** ${adventure.theme || 'Not specified'}\n`;
    md += `> **Target Level:** ${adventure.level || 'Not specified'}\n\n`;
    
    if (adventure.hook) {
        md += `>[!quote] Plot Hook\n`;
        md += `> ${adventure.hook.replace(/\n/g, '\n> ')}\n\n`;
    }

    // ## Key NPCs
    const npcIdsInAdventure = new Set<string>();
    adventure.scenes.forEach(scene => scene.npcIds.forEach(id => npcIdsInAdventure.add(id)));
    const relevantNpcs = campaign.npcs.filter(npc => npcIdsInAdventure.has(npc.id));

    if (relevantNpcs.length > 0) {
        md += `## Key NPCs\n\n`;
        relevantNpcs.forEach(npc => {
            md += `>[!npc] ${npc.name}\n`;
            md += `> **Appearance:** ${npc.description?.replace(/\n/g, ' ') || ''}\n`;
            md += `> **Personality/Roleplay Notes:** ${npc.traits?.replace(/\n/g, ' ') || ''}\n`;
            if (npc.secrets) {
              md += `> >[!secret] GM Only\n`;
              md += `> > ${npc.secrets.replace(/\n/g, '\n> > ')}\n`;
            }
            if (npc.exampleQuote) {
              md += `> >[!quote] ${npc.name}\n`;
              md += `> > "${npc.exampleQuote.replace(/\n/g, '\n> > ')}"\n`;
            }
            md += `\n`;
        });
    }

    // ## Scene-by-Scene Flow
    if (adventure.scenes.length > 0) {
        md += `## Scene-by-Scene Flow\n\n`;
        adventure.scenes.forEach(scene => {
            const location = campaign.locations.find(l => l.id === scene.locationId);
            md += `### [!scene] ${scene.title}${location ? ` - ${location.name}` : ''}\n\n`;
            
            if (scene.readAloudText) {
                md += `>[!quote] Read-Aloud Text\n`;
                md += `> ${scene.readAloudText.replace(/\n/g, '\n> ')}\n\n`;
            }
            
            if (scene.gmNotes) {
                md += `>[!note] Scene Overview\n`;
                md += `> ${scene.gmNotes.replace(/\n/g, '\n> ')}\n\n`;
            }
            
            if (scene.skillChecks && scene.skillChecks.length > 0) {
                scene.skillChecks.forEach(sc => {
                    if (sc.skill && sc.dc) {
                        md += `>[!skillcheck] ${sc.skill.toUpperCase()} DC ${sc.dc}\n`;
                        md += `> ${sc.description.replace(/\n/g, '\n> ')}\n\n`;
                    }
                });
            }

            const sceneNpcs = campaign.npcs.filter(npc => scene.npcIds.includes(npc.id));
            if (sceneNpcs.length > 0) {
              md += `**NPCs Present:** ${sceneNpcs.map(n => n.name).join(', ')}\n\n`;
            }

            if (scene.rewards) {
                md += `>[!reward] Treasure & Rewards\n`;
                md += `> ${scene.rewards.replace(/\n/g, '\n> ')}\n\n`;
            }
            md += `***\n\n`;
        });
    }
    
    // ## Adventure Conclusion (Placeholder for now)
    md += `## Adventure Conclusion\n\n`;
    md += `>[!note] Resolution Paths\n`;
    md += `> (Details on how the adventure might conclude based on player actions.)\n\n`;

    return md;
};


export const PrepDocumentView: React.FC<PrepDocumentViewProps> = ({ adventure, campaign }) => {
  const [hasCopied, setHasCopied] = useState(false);
  
  const markdownContent = useMemo(() => generateMarkdown(adventure, campaign), [adventure, campaign]);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(markdownContent);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-4 animate-fade-in">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-400">
          A full Markdown document for your adventure. Copy this into your favorite notes app.
        </p>
        <Button onClick={handleCopy} variant="secondary" size="sm">
          {hasCopied ? <Check className="w-4 h-4 mr-2 text-green-400" /> : <Clipboard className="w-4 h-4 mr-2" />}
          {hasCopied ? 'Copied!' : 'Copy to Clipboard'}
        </Button>
      </div>
      <pre className="w-full h-[60vh] overflow-auto custom-scrollbar bg-slate-900 p-4 rounded-md text-sm whitespace-pre-wrap text-slate-300 border border-slate-700/50">
        <code>
          {markdownContent}
        </code>
      </pre>
    </div>
  );
};
