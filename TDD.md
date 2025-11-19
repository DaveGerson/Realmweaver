
# Technical Design Document: D&D RealmWeaver

## 1. Introduction

This document outlines the technical architecture, design choices, and data flow of the D&D RealmWeaver application. It is intended for developers contributing to the project.

RealmWeaver is a single-page application (SPA) designed to assist tabletop RPG Game Masters (GMs) in creating, managing, and running campaigns. It leverages the Google Gemini API to generate creative content and provides a structured interface for organizing that content.

---

## 2. Technology Stack

- **Frontend Framework:** React 19 (using `React.FC` for components).
- **Language:** TypeScript for type safety and improved developer experience.
- **AI Integration:** `@google/genai` library for interacting with the Google Gemini API.
- **Styling:** TailwindCSS for a utility-first CSS framework, enabling rapid and consistent UI development. `tailwind-merge` is used to handle conflicting class names.
- **State Management:**
  - Primarily React Hooks (`useState`, `useEffect`, `useMemo`). The main `campaign` object serves as a single source of truth.
  - **Immer:** Used for safe and ergonomic immutable updates of the complex, nested `campaign` state object. This is critical to prevent state-related bugs in React.
- **Icons:** `lucide-react` for a lightweight and consistent set of SVG icons.
- **Build/Environment:** The application is built to run in a modern browser environment that supports ES6 modules and `importmap`, which is used for dependency management without a traditional bundler like Webpack or Rollup.

---

## 3. Project Structure

The project is organized into a modular structure to separate concerns and improve maintainability.

```
/
├── public/
├── index.html            # Main HTML entry point, includes importmap
├── index.tsx             # React root renderer
├── App.tsx               # Main application component, state management hub
├── TDD.md                # This document
├── readme.md             # User-facing documentation
├── smokeTest.ts          # Script for testing core functionalities
|
├── components/           # All React components
│   ├── common/           # Reusable, generic components (Button, AiTextarea)
│   ├── AdventureEditor.tsx
│   ├── CampaignSidebar.tsx
│   ├── DmCoach.tsx         # Slide-out panel for live DM assistance (Session Weaver)
│   ├── EvocationWizard.tsx # Modal for batch content generation
│   ├── RealmChat/          # RealmChat feature components
│   │   ├── RealmChatWidget.tsx
│   ├── NpcEditor.tsx     # (and other editor components)
│   ├── NpcGenerator.tsx  # (and other generator components)
│   └── ...
|
├── services/             # Business logic, API calls
│   ├── geminiService.ts    # Public-facing service layer orchestrating AI calls
│   └── ai/                 # Gemini API interaction logic
│       ├── core.ts         # Core functions for API calls (generateWithSchema, generateText)
│       ├── realmWeaver.ts  # Logic & schemas for world-building (NPCs, locations)
│       ├── dmCoach.ts      # Logic & schemas for DM Coach tools (narration, improv)
│       ├── evocationWizard.ts # Logic & schemas for batch generation
│       ├── realmChat.ts    # Logic & schemas for RealmChat conversational agent
│       └── mockService.ts  # Mock data and functions for offline/testing mode
|
└── types/                # TypeScript type definitions
    ├── index.ts          # Barrel file re-exporting all types
    ├── Campaign.ts
    ├── NPC.ts
    ├── RealmChat.ts      # RealmChat specific types
    └── ...               # All other entity type definitions
```

---

## 4. State Management and Data Flow

The application employs a centralized state management pattern within the main `App.tsx` component.

### 4.1. Single Source of Truth

- The entire campaign's data (NPCs, locations, adventures, active scenes, notes, etc.) is held in a single state object: `const [campaign, setCampaign] = useState<Campaign | null>(null);`.
- This object is the single source of truth for the application. All UI components render based on this state.

### 4.2. Immutable Updates with Immer

- To prevent mutation of the deeply nested `campaign` object, all updates are performed using Immer's `produce` function.
- This allows for "mutative" syntax within the produce callback, which Immer then uses to create a new, immutably updated state object, triggering a proper React re-render.

**Example (`handleNpcCreated`):**
```typescript
const handleNpcCreated = (newNpcData: Omit<NPC, 'id'>) => {
  const newNpc: NPC = { ...newNpcData, id: crypto.randomUUID() };
  setCampaign(prev => produce(prev, draft => {
    if (draft) draft.npcs.push(newNpc);
  }));
};
```

### 4.3. Data Flow

Data flows in a unidirectional pattern:

1.  **User Interaction:** A user interacts with a component (e.g., clicks "Generate" in `NpcGenerator`).
2.  **Service Call:** The component calls a function from `geminiService.ts`.
3.  **AI Logic:** The service function orchestrates a call to the appropriate AI module (`ai/realmWeaver.ts`), which constructs the prompt and schema.
4.  **API Request:** The `ai/core.ts` module makes the final `ai.models.generateContent` call to the Gemini API.
5.  **Response Handling:** The JSON response flows back up the call stack.
6.  **State Update:** The originating component receives the data and calls a handler function (e.g., `onNpcCreated`) passed down from `App.tsx`.
7.  **Re-render:** The handler in `App.tsx` uses `setCampaign` with `produce` to update the state, causing React to re-render the affected parts of the UI.

This "prop drilling" of handler functions is acceptable for this application's scale. For a larger application, a context-based state management solution might be considered.

### 4.4. Derived State and Memoization

- `useMemo` is used to derive selected entities (e.g., `selectedNpc`, `selectedAdventure`) from the main `campaign` state and the selected ID states.
- This prevents re-computation of these derived values on every render, optimizing performance.

---

## 5. Core AI Functionality (`services/ai/`)

The interaction with the Gemini API is the core of the application.

### 5.1. `core.ts`

- **`generateWithSchema(prompt, schema, instructions, ...)`:** This is the workhorse function. It forces the Gemini model to return a structured, valid JSON object by providing a `responseSchema`. This is crucial for maintaining data integrity. It also handles adding campaign context to the prompt.
- **`generateText(prompt, ...)`:** A simpler function for free-form text generation where a strict schema is not required (e.g., for narration).

### 5.2. AI Modules (`realmWeaver`, `dmCoach`, etc.)

- Each module is responsible for a specific domain of generation.
- **Schemas:** Each module defines detailed JSON schemas (`npcSchema`, `sceneSchema`, etc.) using `@google/genai`'s `Type` enum. These schemas dictate the structure of the data generated by the AI.
- **Instruction Prompting:** Each generator function defines a detailed "system instruction" prompt that tells the model its persona (e.g., "You are a master storyteller...") and the specific requirements for the generation task.
- **Grounded Search:** The `generateNpc` function in `realmWeaver.ts` demonstrates conditional logic to add a `tools: [{googleSearch: {}}]` configuration, which grounds the model's response in Google Search results for well-known characters.

### 5.3. Mock Service

- `mockService.ts` mirrors the public API of `geminiService.ts`.
- When "Mock Mode" is enabled, `geminiService.ts` diverts all calls to `mockService.ts`.
- This allows for rapid UI development, testing, and offline use without making actual API calls. It returns hardcoded data with a simulated delay.

### 5.4 RealmChat
- **`realmChat.ts`:** Implements a conversational agent that returns a compound JSON object containing a text `message`, an array of `suggestions` (user quick replies), and an array of `draftEntities`.
- This enables the AI to "chat" while simultaneously constructing structured data in the background.
- Model selection (Flash Lite, Flash, Pro) is passed as a parameter to trade off speed vs. quality.

---

## 6. The Knowledge Graph & Session Weaver

RealmWeaver operates on Graph Design Principles, ensuring entities are interconnected rather than isolated.

### 6.1. Interconnectivity Points
- **Adventure -> Scene:** Strong hierarchical link.
- **Scene -> Location/NPC:** Scenes occur at a Location and involve NPCs.
- **NPC -> Faction:** NPCs belong to factions (`factionId`).
- **Location -> Faction:** Locations can be controlled/influenced by factions (`controllingFactionId`).
- **Lore (Article) -> Entities:** Articles can be linked to any number of NPCs, Locations, or Factions (`relatedEntityIds`).

### 6.2. Context Injection (Session Weaver)
The `App.tsx` component builds a highly rich context string for the `SessionWeaver` (formerly DM Coach). This is critical for ensuring the AI understands the current game state. The context construction follows this priority:
1.  **Active Session State:** Checks `campaign.activeSceneId`. If set, it injects the current Scene, Adventure, Location, and present NPCs.
2.  **Campaign Notes:** Injects the most recently modified Campaign Notes to ensure the AI is aware of user-created reminders or plot threads.
3.  **Current Focus:** If the user is navigating the editor (e.g. editing an Item) while the session is active, that focused item is also added to the context.
4.  **Relevant Lore:** It recursively scans for Lore Articles linked to any entity currently in the context (Active Location, Active NPCs) and injects their content.

This ensures the AI "knows" the web of relationships surrounding the party at any given moment.

---

## 7. Key Components

- **`App.tsx`:** The root component that manages all campaign state and orchestrates the rendering of different views (welcome screen, campaign creator, main editor).
- **`CampaignSidebar.tsx`:** Renders the navigation tree for the entire campaign. It displays lists of all entities and handles selection, creation triggers, and scene reordering via drag-and-drop.
- **Generator Components (`NpcGenerator.tsx`, etc.):** Simple form components responsible for taking a user prompt and initiating the AI generation process via the `geminiService`.
- **Editor Components (`NpcEditor.tsx`, etc.):** More complex components that display and allow editing of a single entity's data. They manage local form state for input fields and call `onUpdate` props to persist changes to the global state in `App.tsx`. They also feature the "AI-Assist" functionality for enhancing individual text fields.
- **`DmCoach.tsx` (Session Weaver):** A stateful slide-out panel that functions as a separate mini-application. It takes the campaign as context but manages its own state for prompts, results, and the active tool.
- **`EvocationWizard.tsx`:** A complex modal component for batch generation. It has two modes ('simple' and 'detailed') and manages a significant amount of its own state before passing the final, curated `BatchAddData` object to `App.tsx` for integration.
- **`RealmChatWidget.tsx`:** A floating chat interface that allows conversational entity creation. It maintains a separate "Draft" state for entities being built in the chat before they are "Approved" and merged into the main campaign state.

---

## 8. Testing

- **`smokeTest.ts`:** An automated script (`runSmokeTests`) that can be triggered from the application.
  - **`testServiceFunctions`:** Directly calls each function in `geminiService` to ensure the AI (or mock service) returns data in the expected format.
  - **`testCampaignHandlers`:** Simulates a user session by programmatically calling the state handler functions from `App.tsx` in a logical sequence (create campaign -> create entities -> update -> link -> reorder -> delete). It verifies that the state object is correctly manipulated at each step.
- This provides a crucial sanity check to ensure the core data layer and state logic are functioning correctly.
