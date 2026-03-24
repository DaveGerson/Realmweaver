# Template: Freeform Text Generation (Class B)

> Consolidates P2.1 (Narration), P2.2 (Improvisation), P2.4 (Enhanced Text), P3.4 (Chat Brainstorm)

## Current State: 4 Separate Functions

Each builds a prompt string with:
1. A persona ("master Dungeon Master", "creative assistant", etc.)
2. A task description
3. Output constraints (length, format)
4. The user's prompt interpolated in

The ONLY things that vary:
- Persona text
- Task description
- Output format constraints
- Model tier (lite vs standard)

## Proposed Consolidated Template

### Prompt Template

```
You are {{persona}}.
{{taskDescription}}

{{outputConstraints}}

{{userPromptSection}}
```

### Parameterized Config

```typescript
interface FreeformTextConfig {
  id: string;                    // 'narration', 'improvisation', etc.
  persona: string;               // "a master Dungeon Master, in the style of Brennan Lee Mulligan"
  taskDescription: string;       // Core instruction
  outputConstraints: string;     // Length, format, tone
  userPromptTemplate: string;    // How user input is framed (e.g., 'Request: "{prompt}"')
  defaultModel: ModelTier;       // 'lite' | 'standard'
}
```

### Current Configs (Extracted)

```typescript
const narrationConfig: FreeformTextConfig = {
  id: 'narration',
  persona: 'a master Dungeon Master, in the style of Brennan Lee Mulligan or Matt Mercer',
  taskDescription: 'Your task is to generate evocative, sensory-rich narrative descriptions for a tabletop RPG. Do not break character.',
  outputConstraints: 'Provide a short, compelling narrative description (2-4 sentences) that the DM can read aloud to the players.',
  userPromptTemplate: 'Based on the context and the following request:\n\nRequest: "{{prompt}}"',
  defaultModel: 'standard',
};

const improvisationConfig: FreeformTextConfig = {
  id: 'improvisation',
  persona: 'a master Dungeon Master, an expert at improvisation',
  taskDescription: 'Your task is to help a fellow DM handle an unexpected player action in a tabletop RPG. Provide 2-3 immediate, actionable consequences and a potential long-term consequence. Present your response in a clear, easy-to-scan format (e.g., using bullet points or bold headings). Do not break character.',
  outputConstraints: '',
  userPromptTemplate: 'The players did something unexpected. Here is the situation:\n"{{prompt}}"\n\nWhat happens next?',
  defaultModel: 'standard',
};

const enhancedTextConfig: FreeformTextConfig = {
  id: 'enhanced-text',
  persona: 'a creative assistant for a Dungeon Master',
  taskDescription: 'Based on the provided context, generate a short, creative piece of text (2-4 sentences) for the requested field. Be concise and evocative.',
  outputConstraints: '',
  userPromptTemplate: 'Request: "{{prompt}}"',
  defaultModel: 'lite',  // Always cheapest — used for per-field enhancement
};

const chatBrainstormConfig: FreeformTextConfig = {
  id: 'chat-brainstorm',
  persona: 'a creative, collaborative world-building assistant for a TTRPG Dungeon Master',
  taskDescription: 'Your tone is friendly and inquisitive. Help the user brainstorm ideas for their campaign. Ask clarifying questions and offer creative suggestions to help them flesh out their ideas for NPCs, locations, factions, and story hooks.',
  outputConstraints: 'Keep your responses concise (2-4 sentences).',
  userPromptTemplate: '{{prompt}}',  // For chat, the prompt is the latest message
  defaultModel: 'lite',
};
```

### Unified Generator Function

```typescript
export function buildFreeformPrompt(config: FreeformTextConfig, prompt: string): string {
  return [
    `You are ${config.persona}.`,
    config.taskDescription,
    config.outputConstraints,
    '',
    config.userPromptTemplate.replace('{{prompt}}', prompt),
  ].filter(Boolean).join('\n\n');
}

export async function generateFreeformText(
  config: FreeformTextConfig,
  prompt: string,
  options: { model?: ModelTier; campaignContext?: string } = {}
): Promise<string> {
  const model = options.model || config.defaultModel;
  const fullPrompt = buildFreeformPrompt(config, prompt);
  return generateText(fullPrompt, mapTierToModel(model), options.campaignContext);
}
```

## Migration Notes

### What changes for Claude:
1. **API call**: `generateContent` → Claude `messages.create` with `system` parameter
2. **System vs user**: Persona + task become `system`; user prompt stays in `messages`
3. **Model name**: tier enum → Claude model ID
4. For narration/improv, the chat-style API is actually a better fit

### What stays the same:
- All prompt text is model-agnostic
- No schema involved — plain text in, plain text out
- These are the simplest prompts to migrate

## Savings

- **Duplicate persona text eliminated**: 4 copies of similar text → 4 config objects + 1 template
- **Model tier logic unified**: `useLiteModel ? ... : ...` → single `ModelTier` parameter
