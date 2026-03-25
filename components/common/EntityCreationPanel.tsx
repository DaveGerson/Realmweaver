
import React, { useState } from 'react';
import { Icons } from '@/components/common/Icons';
import { Button } from '@/components/common/Button';

interface EntityCreationPanelProps {
  /** Entity type label shown in "Create via Chat" / "X Generator" heading */
  entityLabel: string;
  /** The AI chat-based creation panel (EntityChatGenerator) */
  chatPanel: React.ReactNode;
  /** The form-based generator component */
  formPanel: React.ReactNode;
  /** Initial mode; defaults to 'chat' */
  defaultMode?: 'chat' | 'form';
}

/**
 * Shared chat-vs-form creation mode toggle used by entity dashboards.
 *
 * Usage:
 *   <EntityCreationPanel
 *     entityLabel="NPC"
 *     chatPanel={<EntityChatGenerator ... />}
 *     formPanel={<NpcGenerator ... />}
 *   />
 */
export const EntityCreationPanel: React.FC<EntityCreationPanelProps> = ({
  entityLabel,
  chatPanel,
  formPanel,
  defaultMode = 'chat',
}) => {
  const [creationMode, setCreationMode] = useState<'chat' | 'form'>(defaultMode);

  return (
    <div className="space-y-3">
      {/* Mode toggle header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icons.Sparkles className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-bold font-serif text-slate-100">
            {creationMode === 'chat' ? 'Create via Chat' : `${entityLabel} Generator`}
          </h2>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setCreationMode(creationMode === 'chat' ? 'form' : 'chat')}
        >
          {creationMode === 'chat' ? (
            <>
              <Icons.FileText className="w-4 h-4 mr-2" />
              Switch to form
            </>
          ) : (
            <>
              <Icons.Chat className="w-4 h-4 mr-2" />
              Switch to chat
            </>
          )}
        </Button>
      </div>

      {/* Creation panel */}
      {creationMode === 'chat' ? (
        <div className="h-[480px] border border-slate-800 rounded-xl overflow-hidden">
          {chatPanel}
        </div>
      ) : (
        <div className="relative min-h-[400px]">
          {formPanel}
        </div>
      )}
    </div>
  );
};
