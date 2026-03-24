# Session Cockpit Archetype Review

> Comprehensive review of Realmweaver's Session Runner from 5 DM archetype perspectives
> Date: 2026-03-18

---

## Review Methodology

Each of the five DM archetypes defined in `docs/DM_ARCHETYPES.md` was used as an evaluative lens against the current Session Cockpit implementation (`components/views/SessionRunner.tsx` and its associated tool components). The review examined each archetype's documented workflow, core motivations, pain points, and stated needs, then evaluated the existing feature set for alignment, friction, and gaps. User stories follow the standard "As a [role], I want [capability] so that [benefit]" format. Critical-to-Quality (CTQ) elements define measurable thresholds that a feature must meet to satisfy the archetype. The synthesis section resolves conflicts across archetypes and proposes a phased implementation plan mapped to the guiding principles in `UX_OVERHAUL_PLAN.md`.

The codebase audit covered:
- `components/views/SessionRunner.tsx` -- 3-column layout with scene list, active scene panel, quick tools, running log
- `components/tools/DiceRoller.tsx` -- Formula parser, advantage/disadvantage, roll history, log-to-session
- `components/tools/CombatTracker.tsx` -- Initiative, HP, turn tracking, combatant management, roster quick-add
- `components/editors/SessionLogEditor.tsx` -- Session prep, Go Live, AI Scribe (voice transcription), post-session recap
- `components/dialogs/DmCoach.tsx` -- Narration, improv suggestions, rollable table generation

---

## Archetype 1: The Prep-Heavy Worldbuilder

### Overall Assessment

The Session Cockpit provides a serviceable scene-navigation framework but fundamentally fails this archetype's need to surface deep lore at the point of use. The Worldbuilder invests 4-10+ hours building rich entity networks, yet the active scene panel shows only NPC names/traits and location name/description -- a fraction of the data they prepared. The disconnect between the worldbuilding tools and the session view means this DM will still keep a second tab open to their entity editors, defeating the purpose of a unified cockpit.

### What Works Well

- **Scene navigation with status tracking.** The left sidebar with planned/in-progress/completed states maps directly to the Worldbuilder's pre-planned session structure. They will have meticulously ordered their scenes.
- **Read-aloud text display.** The amber-highlighted read-aloud box is exactly what this archetype prepares during their 4-10 hour prep sessions. Having it front and center validates their investment.
- **GM Notes section.** The dedicated GM notes block in the active scene panel serves as a reminder of the detailed notes they wrote during prep.
- **Previous session recap banner.** Worldbuilders care deeply about continuity. The "Previously..." banner with loose ends helps them maintain the narrative thread they have carefully constructed.
- **Plot status tracker.** Even in its current local-only form, the ability to cycle plot status (advanced/stalled/unchanged) aligns with their desire to track narrative arc progression across sessions.
- **NPC presence list.** Showing NPCs linked to the active scene is a good starting point -- this archetype will have carefully assigned NPCs to scenes during prep.

### Critical Gaps

- **Shallow entity display.** NPC cards in the active scene show only name, traits, and motivations. The Worldbuilder has written backstory, relationships, faction ties, secrets, appearance details, voice notes, and more. None of this is accessible without leaving the session runner.
- **No entity popover/deep-link.** Clicking an NPC or location name does nothing. The Worldbuilder needs instant access to the full entity record without navigating away from the cockpit.
- **No relationship context.** The Worldbuilder has built a web of NPC-faction-location relationships. During a scene, they need to know "this NPC is secretly working for Faction X" or "this location is controlled by Faction Y." None of this surfaces automatically.
- **No lore/article surfacing.** Articles (lore entries) that are relevant to the current scene, location, or NPCs never appear in the cockpit. The Worldbuilder's carefully written lore sits unused during play.
- **Plot tracker is not persisted.** The Worldbuilder invests heavily in long-term plot arcs. Plot status changes made during the session vanish on page refresh because `plotSessionStatus` is local React state only.
- **No secrets/clues tracking.** There is no mechanism to mark information as "revealed to players" vs. "still hidden." The Worldbuilder tracks this mentally, which is error-prone across 50+ session campaigns.
- **No entity history timeline in-session.** The Worldbuilder wants to know "when did the players last encounter this NPC?" or "what happened the last time they visited this location?" The `EntityHistoryManager` exists but is not wired into the session runner.
- **DM Coach output is not contextualized with deep lore.** The DM Coach receives basic campaign context (title + setting) but not the rich entity data the Worldbuilder has created. Generated narration will feel generic rather than lore-consistent.
- **No cross-entity search from the cockpit.** If the Worldbuilder needs to recall a detail about an NPC not in the current scene, there is no search or quick-lookup capability within the session runner.

### User Stories

- **US-1.1:** As a Worldbuilder, I want to click on any NPC name in the active scene panel and see their full profile in a popover (backstory, relationships, faction, appearance, secrets) so that I can deliver rich, consistent roleplay without leaving the cockpit.
- **US-1.2:** As a Worldbuilder, I want the session runner to automatically surface relevant lore articles when I enter a scene (based on linked location, NPCs, or tags) so that my prepared lore enhances the session rather than sitting unused.
- **US-1.3:** As a Worldbuilder, I want plot status changes (advanced/stalled/unchanged) to persist to the campaign data model so that my long-term arc tracking is not lost between sessions.
- **US-1.4:** As a Worldbuilder, I want to see faction affiliations and relationship edges displayed on NPC cards in the active scene so that I remember political dynamics during roleplay encounters.
- **US-1.5:** As a Worldbuilder, I want a "secrets and clues" panel that tracks which pieces of information have been revealed to players vs. which are still hidden so that I can manage information asymmetry across a long campaign.
- **US-1.6:** As a Worldbuilder, I want the DM Coach to receive my full entity data (NPC backstories, location descriptions, faction goals, active plots) as context so that generated narration and improv suggestions are consistent with my established world.
- **US-1.7:** As a Worldbuilder, I want a quick-search (Cmd+K) accessible from within the session runner so that I can look up any entity, article, or session note without navigating away from the cockpit.
- **US-1.8:** As a Worldbuilder, I want location details in the active scene panel to include connected locations, notable features, and any location-specific NPCs or items so that I can describe the environment with the richness I prepared.
- **US-1.9:** As a Worldbuilder, I want to see an entity's last-seen/last-modified date and the session in which it was last referenced so that I can maintain temporal continuity in my narrative.
- **US-1.10:** As a Worldbuilder, I want unused prep content (scenes that were not reached, NPCs not encountered) to be flagged at session end so that I can decide whether to recycle, discard, or reschedule them.
- **US-1.11:** As a Worldbuilder, I want the running log to support entity tagging (link notes to NPCs, locations, factions) so that post-session I can see all notes related to a specific entity.
- **US-1.12:** As a Worldbuilder, I want to pin important lore snippets to the quick tools panel for the duration of a session so that frequently-referenced world details are always one glance away.
- **US-1.13:** As a Worldbuilder, I want generated Quick NPCs to include a preview/edit step before saving so that AI-created entities meet my world's standards of consistency and depth.

### Critical-to-Quality Elements

- **CTQ-1.1:** Entity popover must render within 200ms of click/hover and display at minimum: name, description, traits, relationships, faction, and last-session-seen.
- **CTQ-1.2:** Relevant lore articles must auto-surface with zero clicks when a scene is activated, based on linked entities.
- **CTQ-1.3:** Plot status changes must persist to `campaignService` state and survive page refresh.
- **CTQ-1.4:** DM Coach context window must include at least the active scene's full NPC profiles, location description, and active plot summaries -- not just campaign title and setting string.
- **CTQ-1.5:** Quick-search must index all entity types (NPCs, locations, factions, items, articles, scenes, session logs, plots) and return results within 300ms.
- **CTQ-1.6:** Entity cards in the session runner must display relationship count and faction badge without requiring expansion.
- **CTQ-1.7:** Secrets/clues tracker must support at least 50 entries per campaign with revealed/unrevealed toggle and session-of-reveal metadata.
- **CTQ-1.8:** Unused prep detection at session end must correctly identify scenes with status "planned" (never set to "in-progress" or "completed") and NPCs in planned-but-unplayed scenes.

### Objectives

Success for this archetype means the Session Cockpit becomes the single view they use during play, eliminating the need for secondary tabs, printed notes, or external wiki lookups. Their 4-10 hours of prep investment is fully realized at the table through automatic lore surfacing, rich entity cards, and deep contextual AI assistance. Post-session, the cockpit feeds information back into the worldbuilding pipeline -- unused prep is surfaced for recycling, new canonical facts from improv are captured, and the session's impact on the world is tracked.

---

## Archetype 2: The Lazy DM / Improvisational Storyteller

### Overall Assessment

The Session Cockpit's current structure is over-structured for the Lazy DM. The three-column layout with a formal scene list assumes a DM who has pre-planned a linear scene sequence, but this archetype works from bullet-point scenes that they deploy flexibly based on player actions. The running log at the bottom is the closest feature to what they actually need -- a fast capture tool -- but it lacks the speed, intelligence, and post-session processing power that would make it transformative. The quick tools panel is well-positioned but the tools themselves require too many clicks.

### What Works Well

- **Running log with tags.** The timestamped note input with Combat/NPC/Decision/Loot/Discovery tags is the right mental model for this archetype. Quick capture with categorization is exactly what the Lazy DM needs.
- **Importance starring.** Being able to mark notes as important during play and filter to important-only is a strong alignment with the "jot down key decisions" post-session workflow.
- **Quick NPC generator.** The ability to generate an NPC inline without leaving the cockpit matches the Lazy DM's improv style -- "the players want to talk to the blacksmith, let me generate one right now."
- **DM Coach improv tool.** The "Improviser" mode that takes a player action and suggests consequences is directly aligned with this archetype's core workflow.
- **Previous session recap.** The "Previously..." banner is useful for the Lazy DM who often skips post-session notes and relies on memory.
- **Scene flexibility.** Scenes can be selected in any order (not forced linear), which partially accommodates the flexible deployment style.

### Critical Gaps

- **No bullet-point/checklist interface.** The Lazy DM's prep is a list of 5-10 bullet points (strong start, potential scenes, secrets/clues, NPCs, locations). The cockpit forces them into a formal scene-based structure that requires pre-creating Scene entities with read-aloud text, GM notes, skill checks, and rewards. This is exactly the over-structured prep they avoid.
- **Improv capture is too slow.** Adding a note requires: type text, optionally select tags, press Enter/Add. During fast improv, the DM needs voice-to-note or single-keystroke capture. The AI Scribe exists in `SessionLogEditor` but is not integrated into the Session Runner.
- **No secrets/clues tracker.** The Lazy DM's most powerful prep tool (from the eight-step method) is a list of secrets and clues that can be attached to any scene. There is no mechanism for this in the cockpit.
- **DM Coach results vanish.** When the DM Coach generates narration or improv suggestions, the output exists only in the coach dialog. It is not logged to the running log, not saved anywhere, and cannot be referenced later. For the Lazy DM who improvises from these outputs, this is critical lost context.
- **Post-session processing is weak.** The Lazy DM wants AI to take their rough notes and turn them into structured session history. The "Process into Log" feature exists in SessionLogEditor but not in the Session Runner's running log.
- **No "strong start" prominent display.** The eight-step method emphasizes the opening hook. There is no dedicated space for the session's strong start that is visually distinct from generic scene content.
- **Quick NPC has no preview.** The Lazy DM improvises NPCs frequently but wants a quick glance before committing. The current flow generates and immediately saves without a preview step.
- **Running log has no full-text search.** After a long session with 50+ notes, finding a specific improvised detail is impossible without scrolling.
- **Dice rolls are not in the running log timeline.** Rolls made in the DiceRoller exist in a separate history, not interleaved with session notes. The Lazy DM wants a single unified timeline.

### User Stories

- **US-2.1:** As a Lazy DM, I want to enter the session runner with just a bulleted list of scenes/beats (no formal scene entities required) so that my minimal prep translates directly into a runnable session.
- **US-2.2:** As a Lazy DM, I want a secrets-and-clues panel where I list 5-10 floating pieces of information and check them off as revealed so that I can deploy them organically across any scene.
- **US-2.3:** As a Lazy DM, I want DM Coach outputs (narration, improv suggestions, tables) to be automatically logged to the running log so that improvised content is captured for post-session reference.
- **US-2.4:** As a Lazy DM, I want voice-to-text note capture available directly in the Session Runner (not just SessionLogEditor) so that I can dictate notes hands-free during play.
- **US-2.5:** As a Lazy DM, I want AI-powered post-session processing that takes my running log and generates a structured recap, identifies new NPCs/locations mentioned, and suggests unresolved threads so that my 10-minute post-session workflow produces complete session history.
- **US-2.6:** As a Lazy DM, I want dice rolls to appear inline in the running log timeline alongside my notes so that I have a single chronological record of the session.
- **US-2.7:** As a Lazy DM, I want the Quick NPC generator to show a preview card before saving so that I can quickly scan and accept or re-generate.
- **US-2.8:** As a Lazy DM, I want full-text search across all running log entries so that I can find improvised details from earlier in the session.
- **US-2.9:** As a Lazy DM, I want a "strong start" display slot at the top of the center panel that shows my opening hook prominently so that I begin the session with energy rather than fumbling.
- **US-2.10:** As a Lazy DM, I want improvised entities (NPCs mentioned in notes, locations described on the fly) to be automatically detected by AI and offered as new entity records after the session so that my improv becomes permanent campaign data with zero extra work.
- **US-2.11:** As a Lazy DM, I want to add a note with a single keyboard shortcut (e.g., `/` to focus the note input) so that capture speed matches conversation speed.
- **US-2.12:** As a Lazy DM, I want the session runner to work without an adventure or pre-planned scenes so that I can run impromptu sessions or one-shots without setup overhead.

### Critical-to-Quality Elements

- **CTQ-2.1:** Time from thought to captured note must be under 3 seconds (keyboard shortcut to focus, type, Enter to save).
- **CTQ-2.2:** Session runner must be fully functional with zero scenes planned -- no empty states that imply failure.
- **CTQ-2.3:** DM Coach outputs must appear in the running log within 1 second of generation completing.
- **CTQ-2.4:** Post-session AI processing must produce a coherent recap from unstructured bullet-point notes with 80%+ factual accuracy.
- **CTQ-2.5:** Secrets/clues tracker must support at least 15 entries with one-click reveal toggle.
- **CTQ-2.6:** Voice-to-text capture must be accessible from the Session Runner with a single click (not requiring navigation to SessionLogEditor).
- **CTQ-2.7:** Running log search must return results within 200ms across up to 200 entries.
- **CTQ-2.8:** Improvised entity detection must identify named NPCs and locations from running log text with 70%+ recall.

### Objectives

Success for this archetype means the Session Cockpit replaces their single text file. Their 30-minute prep translates into a runnable session without requiring entity creation. During play, every improvised detail is captured with minimal friction. Post-session, AI turns rough notes into campaign history automatically. The cockpit should feel like a smart notepad, not a database interface.

---

## Archetype 3: The New/Nervous DM

### Overall Assessment

The Session Cockpit is intimidating for a new DM. The three-column layout with scene navigation, active scene panel, quick tools, and running log presents multiple simultaneous information streams that a nervous DM does not know how to process. There is no guidance on what to do next, no contextual help, and no confidence-building feedback. The combat tracker lacks difficulty indicators, the skill check display has no guidance on what happens on success/failure, and the DM Coach requires the DM to formulate a prompt -- something a new DM struggles to do. The cockpit assumes competence rather than building it.

### What Works Well

- **Scene structure provides guardrails.** For a new DM following a published module, the scene list on the left provides a reassuring sequence: "do this, then this, then this." The status icons (planned/in-progress/completed) give a sense of progress.
- **Read-aloud text block.** New DMs rely heavily on read-aloud text because they are not yet confident improvising descriptions. The prominent, styled read-aloud block is a confidence booster.
- **GM Notes section.** Notes that remind the DM what is supposed to happen in a scene are essential for nervous DMs who fear forgetting critical information.
- **Skill check display.** Showing DC values and skill names is helpful -- the new DM does not have to remember these from their prep.
- **Two-click session end.** Preventing accidental session end with a confirmation step is good UX for someone who might panic-click.
- **Previous session recap.** New DMs often forget what happened last session. The "Previously..." banner with loose ends provides a safety net.

### Critical Gaps

- **No guided mode or progressive disclosure.** The cockpit presents all features at once: scene list, active scene, quick tools, running log, plot tracker, prep notes. A new DM does not know where to look first or what workflow to follow. There is no "First time? Start here" guidance.
- **No encounter difficulty indicators.** The active scene shows NPCs and skill checks but gives no indication of encounter difficulty. The new DM's greatest fear is accidentally TPK-ing the party. There is no "this encounter is Easy/Medium/Hard/Deadly" signal.
- **Skill checks have no outcome guidance.** The skill check display shows "DC 15 Perception -- notice the hidden door" but does not explain what happens if the players succeed or fail. New DMs freeze when they do not know the consequences.
- **No NPC roleplay assistance.** NPC cards show name, traits, and motivations but do not provide voice hints, conversation starters, or "what would this NPC say if asked about X." The new DM struggles with in-character dialogue.
- **Combat tracker is complex.** The CombatTracker assumes familiarity with initiative, HP tracking, and turn management. There are no tooltips, no "how to run combat" guidance, and no suggestions for what monsters should do on their turn.
- **DM Coach requires prompt engineering.** The Coach asks "describe a situation" but a panicking DM does not know how to formulate a useful prompt. There are no template prompts or suggestion chips.
- **No rules reference.** When a player asks "how does grappling work?" the DM has to leave the cockpit to look it up. There is no integrated rules reference or contextual rules surfacing.
- **No "what do I do?" panic button.** When the DM is stuck and the players are staring, there is no single-click "help me" feature that reads the current session context and suggests a next move.
- **No post-session learning.** After the session, there is no "what went well? what could improve?" reflection prompt. The new DM does not get coaching on their development.
- **No confidence metrics.** There is no indication of how the session is going -- no "you've run 3 scenes, introduced 2 NPCs, and the session has been going for 90 minutes" feedback.

### User Stories

- **US-3.1:** As a New DM, I want a guided first-session walkthrough that highlights which panel to look at and what to do next so that the cockpit does not overwhelm me.
- **US-3.2:** As a New DM, I want encounter difficulty labels (Easy/Medium/Hard/Deadly) displayed in the active scene panel so that I know whether my players are in danger before combat begins.
- **US-3.3:** As a New DM, I want skill check entries to include success/failure outcome text so that I know what to narrate regardless of the dice result.
- **US-3.4:** As a New DM, I want NPC cards to include a "voice hint" and 2-3 sample dialogue lines so that I can roleplay NPCs with confidence even if I have never done it before.
- **US-3.5:** As a New DM, I want the DM Coach to offer template prompts and suggestion chips (e.g., "Describe this location," "What does this NPC say?," "The players are stuck -- give them a hint") so that I do not have to formulate prompts from scratch.
- **US-3.6:** As a New DM, I want a "Help me!" panic button that reads the current scene context and suggests what to do next so that I have a lifeline when I freeze.
- **US-3.7:** As a New DM, I want the combat tracker to include tooltips explaining initiative, turns, and basic combat flow so that I can learn the rules while running the game.
- **US-3.8:** As a New DM, I want a session timer displayed in the header so that I can pace my session and not run 2 hours over or end 1 hour early.
- **US-3.9:** As a New DM, I want post-session reflection prompts ("What moment was most fun?", "What surprised you?", "What would you do differently?") so that I improve session over session.
- **US-3.10:** As a New DM, I want the combat tracker to suggest monster tactics ("Goblins will try to flee when below half HP", "The ogre targets the closest PC") so that I run combat dramatically rather than mechanically.
- **US-3.11:** As a New DM, I want a contextual rules lookup that I can invoke from skill checks or combat ("How does stealth work?", "What is the grapple procedure?") so that I do not lose table momentum by switching to a browser tab.
- **US-3.12:** As a New DM, I want the session prep view to tell me exactly what I need to prepare ("You need: a strong opening, 3-5 scenes, NPC details for the characters listed") so that I prepare the right amount -- not too much, not too little.
- **US-3.13:** As a New DM, I want a simplified cockpit mode that hides advanced features (plot tracker, entity tagging, formula dice) and shows only the essentials (scene content, basic dice, notes) so that the interface matches my skill level.
- **US-3.14:** As a New DM, I want AI-generated NPC cheat sheets that consolidate name, appearance, motivation, key knowledge, and voice on a single compact card so that I can glance at it mid-conversation.
- **US-3.15:** As a New DM, I want the DM Coach "Improviser" to proactively suggest options when players do something unexpected (detect deviation from planned scenes and offer 2-3 paths forward) so that I never feel stuck.

### Critical-to-Quality Elements

- **CTQ-3.1:** First-time cockpit experience must include an optional onboarding overlay that explains the three-column layout in 3 steps or fewer.
- **CTQ-3.2:** Encounter difficulty label must be calculated and displayed automatically when scene NPCs have CR/level data, with no DM action required.
- **CTQ-3.3:** DM Coach must offer at least 5 template prompts per tool (narrate, improvise, table) relevant to the current scene context.
- **CTQ-3.4:** Panic button response must return within 5 seconds and provide at least 2 actionable suggestions.
- **CTQ-3.5:** Simplified cockpit mode must be achievable with a single toggle and must hide at least 50% of the interface elements while preserving scene display, dice, and notes.
- **CTQ-3.6:** NPC cheat sheet cards must display all essential information (name, appearance, motivation, key info, voice hint) in a single view without scrolling, at a maximum card height of 200px.
- **CTQ-3.7:** Session timer must be accurate to within 1 second and visible at all times in the session header.
- **CTQ-3.8:** Combat tooltips must cover the 5 most common new-DM questions: initiative order, taking turns, hit points, conditions, and ending combat.

### Objectives

Success for this archetype means the Session Cockpit is less intimidating than a printed module. The new DM should feel supported, not judged. Every moment of uncertainty should be met with a contextual suggestion, not a blank text field. The cockpit should actively teach them how to DM by providing structure, guidance, and post-session reflection -- turning every session into a learning experience. After 5 sessions, the new DM should feel confident enough to start disabling the training wheels.

---

## Archetype 4: The Tactical Combat DM

### Overall Assessment

The Session Cockpit's combat support is the weakest link for this archetype. The CombatTracker provides basic initiative and HP tracking but lacks the depth required for tactical play: no condition tracking, no monster stat blocks, no encounter balancing, no terrain management, no legendary/lair actions, and hardcoded default HP values (10 for NPCs, 20 for PCs). The combat tracker is a slide-out panel rather than a full-screen takeover, which means the Tactical DM cannot see both the battle state and monster details simultaneously. The non-combat portions of the cockpit (scene navigation, DM Coach) are adequate but secondary for this archetype -- combat IS the session.

### What Works Well

- **Auto-populate combatants from scene.** When opening the combat tracker, it auto-creates combatants from the active scene's NPCs and player characters. This saves setup time at the start of each encounter.
- **Initiative sort.** One-click initiative sorting by value is a basic but essential feature.
- **Turn tracking with visual highlight.** The active combatant row is highlighted with an indigo border, making it clear whose turn it is.
- **HP increment/decrement controls.** The +/- buttons next to HP with color coding (green/yellow/red) provide quick damage tracking during fast combat.
- **Roster quick-add.** The ability to add combatants from the campaign's NPC and PC roster saves re-typing names during encounter setup.
- **Round counter.** The prominent round display helps track encounter pacing.
- **Combatant notes field.** The inline notes field per combatant can be used as a workaround for condition tracking, though it is not purpose-built for this.

### Critical Gaps

- **No condition tracking.** D&D 5e has 15 conditions (blinded, charmed, frightened, grappled, etc.) plus concentration tracking. The combat tracker has no condition system -- only a freeform notes field. The Tactical DM tracks 3-5 active conditions per combat and needs visual indicators.
- **Hardcoded default HP.** NPCs default to 10 HP and PCs to 20 HP regardless of level, CR, or class. The Tactical DM needs actual stat block HP values populated automatically or at least editable defaults tied to entity data.
- **No stat blocks.** During combat, the Tactical DM constantly references monster AC, attack bonuses, damage dice, special abilities, and resistances. None of this is accessible from the combat tracker. They must reference external sources.
- **No encounter difficulty calculation.** There is no XP budget, CR-based difficulty assessment, or encounter balance indicator. The Tactical DM designs encounters around difficulty thresholds and needs this information at prep time and during play.
- **No legendary/lair actions.** Boss monsters use legendary actions (3/round) and lair actions (initiative count 20). The combat tracker has no mechanism for tracking these separate action economies.
- **No terrain or positioning.** The Tactical DM uses terrain features (cover, difficult terrain, elevation) as tactical elements. There is no terrain reference or positioning system.
- **Combat tracker is a slide-out panel, not a full view.** At 500px wide, the panel is too narrow for complex encounters with 8-12 combatants. The Tactical DM needs a full-width or full-screen combat view.
- **No turn timer.** Long combats bog down with 5-6 players. A per-turn timer encourages faster play and is standard in dedicated combat trackers.
- **No "on deck" notification.** Players benefit from knowing they are next. No such indicator exists.
- **No post-combat analytics.** The Tactical DM wants to know: How many rounds did it last? Total damage dealt by each side? Which PCs were downed? This informs future encounter design.
- **Dice roller is separate from combat.** Attack rolls, damage rolls, and saving throws made in combat should be associated with the active combatant, but the dice roller exists independently.
- **No damage/healing batch input.** Applying the same damage to multiple combatants (e.g., fireball hitting 4 goblins) requires editing each HP field individually.

### User Stories

- **US-4.1:** As a Tactical DM, I want a condition tracking system with toggleable status icons per combatant (blinded, poisoned, prone, concentrated, etc.) so that I never forget an active condition during combat.
- **US-4.2:** As a Tactical DM, I want monster stat blocks accessible from the combat tracker (one-click expand from a combatant row) so that I can reference AC, attacks, abilities, and resistances without leaving the view.
- **US-4.3:** As a Tactical DM, I want encounter difficulty calculated automatically from combatant CRs and party level so that I can verify balance before and during the encounter.
- **US-4.4:** As a Tactical DM, I want a full-screen combat mode that replaces the three-column layout with a dedicated combat interface so that I have maximum screen real estate for complex encounters.
- **US-4.5:** As a Tactical DM, I want legendary action and lair action trackers per boss combatant so that I can manage these separate action economies within the turn structure.
- **US-4.6:** As a Tactical DM, I want a per-turn timer with configurable duration and visual/audio alert so that I can keep combat moving when players take too long.
- **US-4.7:** As a Tactical DM, I want to apply damage or healing to multiple combatants simultaneously (e.g., AoE effects) so that I can resolve area spells quickly.
- **US-4.8:** As a Tactical DM, I want NPC combatants to auto-populate with correct HP, AC, and basic stats from their entity data or a monster reference so that I do not enter hardcoded defaults.
- **US-4.9:** As a Tactical DM, I want post-combat analytics (rounds elapsed, total damage dealt/received, PCs downed, monsters killed) logged automatically so that I can evaluate encounter balance for future design.
- **US-4.10:** As a Tactical DM, I want an "on deck" indicator that shows the next combatant in initiative order so that the next player can prepare their action.
- **US-4.11:** As a Tactical DM, I want dice rolls made during combat to be associated with the active combatant and logged as part of the combat record so that I have a complete combat timeline.
- **US-4.12:** As a Tactical DM, I want to save and re-use encounter templates (predefined combatant groups) so that I can deploy recurring enemy compositions quickly.
- **US-4.13:** As a Tactical DM, I want combat notes from each encounter to be preserved in the session log so that I can review tactical outcomes during post-session analysis.
- **US-4.14:** As a Tactical DM, I want a concentration tracker that automatically prompts for concentration saves when a concentrating combatant takes damage so that I do not forget this critical rule.

### Critical-to-Quality Elements

- **CTQ-4.1:** Condition system must support all 15 core D&D 5e conditions plus concentration, with visual icon indicators visible without expanding the combatant row.
- **CTQ-4.2:** Stat block lookup must render within 500ms and display AC, HP formula, speed, ability scores, attacks, and special abilities.
- **CTQ-4.3:** Encounter difficulty calculation must use the standard XP budget thresholds (Easy/Medium/Hard/Deadly) and update in real-time as combatants are added or removed.
- **CTQ-4.4:** Full-screen combat mode must accommodate up to 15 combatants with all fields visible without horizontal scrolling.
- **CTQ-4.5:** Turn timer must support durations from 30 seconds to 5 minutes with visual countdown and optional audio alert.
- **CTQ-4.6:** Batch damage application must resolve in a single action for up to 10 combatants.
- **CTQ-4.7:** Combat tracker must maintain 60fps rendering during rapid HP/initiative updates with 12+ combatants.
- **CTQ-4.8:** Post-combat analytics must be generated automatically at encounter end and include: round count, per-combatant damage dealt/received, KO events, and duration.

### Objectives

Success for this archetype means the Combat Tracker rivals Improved Initiative and Shieldmaiden in functionality while being integrated into the session flow rather than siloed. The Tactical DM should never need to alt-tab to a separate combat tool. Encounter design, execution, and post-combat analysis should form a connected pipeline within the cockpit. Combat should feel dynamic and well-managed, not like data entry.

---

## Archetype 5: The Forever DM / Burnout-Risk Veteran

### Overall Assessment

The Session Cockpit addresses the Forever DM's single-campaign workflow reasonably well but completely fails their defining need: managing multiple concurrent campaigns. Campaign switching exists at the app level but the session runner has no awareness of cross-campaign context. The post-session workflow is the most critical gap -- the Forever DM is exhausted after a 4-hour session and needs AI to do the heavy lifting of recap generation, continuity tracking, and next-session prep. The current post-session tools exist in SessionLogEditor but are not accessible from the session end flow, creating a disjointed experience.

### What Works Well

- **AI recap generation.** The "Generate Recap" button in SessionLogEditor that uses AI to create a narrative summary from rough notes is exactly what the Forever DM needs. They are too tired for detailed note-taking after a session.
- **Loose ends field.** The dedicated "Loose Ends" field in post-session supports the Forever DM's need to track unresolved threads without comprehensive session notes.
- **Running log with auto-events.** Scene transitions and NPC creation are automatically logged, providing a timeline even when the DM is too busy to take manual notes.
- **Plot integration.** The ability to link session logs to active plots and track their status supports cross-session continuity.
- **Session date tracking.** Basic but important for a DM running 2-3 weekly sessions across different campaigns.
- **Two-click session end.** Prevents accidental session termination, which is important when the DM is fatigued.

### Critical Gaps

- **No cross-campaign context.** The Forever DM runs 2-3 campaigns simultaneously. There is no way to compare session histories, share NPCs/locations between campaigns, or see a unified view of upcoming sessions across campaigns.
- **Post-session is disconnected from session end.** When the DM clicks "End Session" in the Session Runner, they are taken away from the cockpit. The recap generation, loose ends, and note analysis are in the SessionLogEditor, not in the session end flow. The Forever DM will close the app immediately after ending -- the post-session tools must be in the session end flow itself.
- **No automated continuity tracking.** The Forever DM's greatest fear is forgetting a detail from session 12 during session 50. There is no automatic tracking of "promises made to players," "NPCs who owe favors," "items given but not yet used," or "plot hooks dropped but not followed up."
- **Plot status is not persisted.** Already critical for the Worldbuilder, this is even more critical for the Forever DM who cannot afford to re-remember plot states after each session.
- **No prep template pre-fill.** The Forever DM wants session prep to be partially automated: "Based on where session 11 ended, here are suggested starting scenes, NPCs likely to appear, and plot threads to advance." Current prep is manual.
- **Session timer missing.** The Forever DM runs to a strict schedule (often 3-4 hours with another group the next day). A visible timer helps them pace without constantly checking the clock.
- **No session scheduling overview.** There is no calendar or timeline view showing upcoming sessions across campaigns.
- **AI Scribe is not in Session Runner.** The Forever DM benefits most from voice transcription because they are simultaneously managing complex game state. The AI Scribe is only available in SessionLogEditor, not the Session Runner.
- **No burnout indicators.** There is no mechanism to track DM energy/satisfaction across sessions. Detecting declining session quality or increasing prep avoidance could prompt self-care recommendations.
- **Content cannot be shared across campaigns.** The Forever DM creates a great tavern or NPC and wants to reuse it in another campaign. There is no entity export/import between campaigns.
- **No "emergency NPC" or "emergency one-shot" quick generation.** When the Forever DM has zero prep time, they need a "generate an entire session from this prompt" capability.

### User Stories

- **US-5.1:** As a Forever DM, I want the session end flow to include inline recap generation, loose ends capture, and plot status updates before leaving the cockpit so that I complete post-session tasks while context is fresh.
- **US-5.2:** As a Forever DM, I want AI-generated session recaps that I can review and approve with one click so that post-session documentation takes 2 minutes, not 20.
- **US-5.3:** As a Forever DM, I want a cross-campaign dashboard showing upcoming sessions, recent sessions, and pending loose ends for all campaigns so that I can context-switch efficiently between groups.
- **US-5.4:** As a Forever DM, I want automated continuity tracking that flags promises, unresolved hooks, and unreturned favors from previous sessions so that I never accidentally drop a plot thread.
- **US-5.5:** As a Forever DM, I want a session timer visible in the cockpit header so that I can pace my session without checking external clocks.
- **US-5.6:** As a Forever DM, I want AI-assisted prep pre-fill that reads the previous session's recap and loose ends and suggests opening scenes, relevant NPCs, and plot advancement opportunities so that prep time is halved.
- **US-5.7:** As a Forever DM, I want to copy entities (NPCs, locations, items) between campaigns so that I can reuse content without recreating it from scratch.
- **US-5.8:** As a Forever DM, I want plot status changes to persist to the campaign data model so that cross-session continuity tracking is reliable.
- **US-5.9:** As a Forever DM, I want the AI Scribe (voice transcription) available in the Session Runner so that I can capture game audio hands-free during live play.
- **US-5.10:** As a Forever DM, I want an "emergency session" generator that creates a playable one-shot or continuation from a single prompt ("the party is stuck in a haunted mine") so that I can run a session with zero prep.
- **US-5.11:** As a Forever DM, I want session quality self-tracking (energy level, fun rating, memorable moments) so that I can detect burnout patterns before they become critical.
- **US-5.12:** As a Forever DM, I want the running log to auto-detect new NPC names and location names from my notes and offer to create entity records post-session so that improv content does not disappear.
- **US-5.13:** As a Forever DM, I want the cockpit to remember my personal preferences (dice roller visible/hidden, running log height, preferred DM Coach tool) across sessions so that my muscle memory is preserved.
- **US-5.14:** As a Forever DM, I want campaign data import from Notion, Obsidian, and Google Docs so that migrating my existing campaigns does not require manual re-entry.

### Critical-to-Quality Elements

- **CTQ-5.1:** Session end flow must include recap review, loose ends, and plot status within the same view -- no navigation to a separate editor required.
- **CTQ-5.2:** AI recap generation must complete within 15 seconds and produce a coherent 200-500 word summary.
- **CTQ-5.3:** Cross-campaign dashboard must load data for up to 5 campaigns within 2 seconds.
- **CTQ-5.4:** Continuity tracker must automatically identify and surface unresolved hooks with 70%+ accuracy by analyzing running log entries, loose ends, and plot states.
- **CTQ-5.5:** Session timer must persist across page refresh (stored in sessionStorage or campaign state).
- **CTQ-5.6:** AI-assisted prep pre-fill must produce actionable suggestions within 10 seconds of loading a session prep view.
- **CTQ-5.7:** Entity cross-campaign copy must preserve all fields including relationships (with unmatchable relationship targets flagged for manual resolution).
- **CTQ-5.8:** Emergency session generator must produce a playable session outline (3-5 scenes, 2-3 NPCs, 1 location, 1 conflict) within 20 seconds.

### Objectives

Success for this archetype means the Session Cockpit actively reduces the total time investment of being a Forever DM. Post-session tasks are automated. Continuity is tracked by the system, not by memory. Cross-campaign management is a first-class feature. The cockpit should feel like a co-pilot that handles the administrative burden, leaving the Forever DM free to focus on the creative and social aspects of running games -- the parts that prevent burnout.

---

## Synthesis: Cross-Archetype Analysis

### Universal User Stories (All archetypes agree)

These stories appeared across 3 or more archetypes, indicating universal value:

| ID | User Story | Archetypes |
|---|---|---|
| **UNI-1** | Plot status must persist to campaign data (not local state) | Worldbuilder, Lazy DM, Forever DM |
| **UNI-2** | DM Coach output must auto-log to running log | Worldbuilder, Lazy DM, New DM, Forever DM |
| **UNI-3** | Quick NPC generation must include a preview/edit step | Worldbuilder, Lazy DM, New DM |
| **UNI-4** | Session timer visible in cockpit header | New DM, Tactical DM, Forever DM |
| **UNI-5** | AI Scribe (voice capture) must be available in Session Runner | Lazy DM, New DM, Forever DM |
| **UNI-6** | Post-session AI recap integrated into session end flow | Lazy DM, New DM, Forever DM |
| **UNI-7** | Running log full-text search | Worldbuilder, Lazy DM, Forever DM |
| **UNI-8** | Dice rolls integrated into running log timeline | Lazy DM, Tactical DM, Forever DM |
| **UNI-9** | Entity popovers/quick cards clickable from any entity name | Worldbuilder, New DM, Tactical DM |
| **UNI-10** | Auto-detect and offer to create entities from running log notes | Lazy DM, Forever DM, Worldbuilder |

### Conflicting Needs

| Conflict | Archetypes in Tension | Resolution Approach |
|---|---|---|
| **Scene structure rigidity** -- Worldbuilder wants formal scene sequence; Lazy DM wants bullet-point flexibility | Worldbuilder vs. Lazy DM | Support both: scene list shows formal scenes if they exist, but also supports "beats" (lightweight text-only entries without full Scene entity requirements). The session runner works with zero scenes planned (empty state shows a prompt area, not an error). |
| **Interface complexity** -- Tactical DM and Worldbuilder want deep, information-dense interfaces; New DM wants simplicity | Tactical/Worldbuilder vs. New DM | Progressive disclosure via a "DM Experience" setting (Guided / Standard / Power) that controls which panels and features are visible. Guided mode hides: plot tracker, entity tagging, formula dice, advanced coach options. Power mode enables: full-screen combat, entity popovers, lore surfacing. |
| **Combat tracker scope** -- Tactical DM wants full-screen, feature-rich combat; Lazy DM wants minimal combat tracking; New DM wants guided combat | Tactical vs. Lazy vs. New | Combat tracker supports three modes: (1) Minimal -- just initiative order and HP, inline in the session runner. (2) Standard -- current slide-out panel with conditions added. (3) Full -- dedicated full-screen with stat blocks, analytics, legendary actions. Mode auto-selected by DM Experience setting but manually overridable. |
| **Post-session depth** -- Forever DM wants 2-minute automated processing; Worldbuilder wants detailed entity updates and wiki reconciliation | Forever DM vs. Worldbuilder | Two-phase post-session: Phase 1 (immediate) is a quick AI recap + plot status + loose ends (serves Forever DM). Phase 2 (optional, next day) is a deeper review with entity creation suggestions, relationship updates, and lore reconciliation (serves Worldbuilder). Both are accessible but only Phase 1 is required at session end. |
| **Prep overhead** -- Worldbuilder wants rich prep tools; Lazy DM wants zero-prep capability; New DM wants guided prep | All three prep styles | The session runner accepts three "prep states": (1) Full prep (adventure + scenes + NPCs linked). (2) Light prep (bullet-point beats + optional secrets/clues). (3) Zero prep (just a session title + "emergency generate" option). The cockpit adapts its center panel based on which prep state was used. |
| **AI assistance tone** -- New DM wants prescriptive guidance ("do this next"); Worldbuilder wants lore-consistent suggestions; Lazy DM wants quick options | New vs. Worldbuilder vs. Lazy | DM Coach prompt templates are stratified by experience level. "Guided" mode provides prescriptive suggestions with reasoning. "Standard" mode provides options without prescription. Both use full campaign context for consistency. |

### Priority Matrix

| User Story | Worldbuilder | Lazy DM | New DM | Tactical | Forever DM | Overall Priority |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| UNI-1: Persist plot status | HIGH | MEDIUM | LOW | LOW | CRITICAL | **P0** |
| UNI-2: Auto-log Coach output | HIGH | CRITICAL | HIGH | LOW | HIGH | **P0** |
| UNI-3: Quick NPC preview | HIGH | HIGH | HIGH | LOW | MEDIUM | **P0** |
| UNI-4: Session timer | LOW | MEDIUM | HIGH | MEDIUM | HIGH | **P1** |
| UNI-5: Voice capture in Runner | MEDIUM | HIGH | MEDIUM | LOW | CRITICAL | **P1** |
| UNI-6: Post-session in end flow | MEDIUM | HIGH | MEDIUM | LOW | CRITICAL | **P1** |
| UNI-7: Running log search | HIGH | HIGH | LOW | LOW | HIGH | **P1** |
| UNI-8: Dice in running log | LOW | HIGH | MEDIUM | HIGH | MEDIUM | **P1** |
| UNI-9: Entity popovers | CRITICAL | MEDIUM | HIGH | MEDIUM | MEDIUM | **P1** |
| UNI-10: Auto-detect entities | HIGH | CRITICAL | LOW | LOW | HIGH | **P2** |
| US-1.2: Lore article surfacing | CRITICAL | LOW | LOW | LOW | MEDIUM | **P2** |
| US-1.5: Secrets/clues tracker | HIGH | CRITICAL | MEDIUM | LOW | HIGH | **P1** |
| US-2.1: Bullet-point sessions | LOW | CRITICAL | MEDIUM | LOW | HIGH | **P1** |
| US-2.12: No-adventure sessions | LOW | CRITICAL | MEDIUM | LOW | HIGH | **P1** |
| US-3.1: Guided first session | LOW | LOW | CRITICAL | LOW | LOW | **P2** |
| US-3.2: Encounter difficulty | LOW | MEDIUM | CRITICAL | HIGH | MEDIUM | **P2** |
| US-3.5: Coach template prompts | LOW | MEDIUM | CRITICAL | LOW | MEDIUM | **P1** |
| US-3.6: Panic button | LOW | LOW | CRITICAL | LOW | LOW | **P2** |
| US-3.13: Simplified mode | LOW | LOW | CRITICAL | LOW | LOW | **P2** |
| US-4.1: Condition tracking | LOW | LOW | HIGH | CRITICAL | MEDIUM | **P1** |
| US-4.2: Stat block access | LOW | LOW | HIGH | CRITICAL | MEDIUM | **P2** |
| US-4.4: Full-screen combat | LOW | LOW | LOW | CRITICAL | LOW | **P2** |
| US-4.6: Turn timer | LOW | LOW | MEDIUM | HIGH | MEDIUM | **P2** |
| US-4.8: Auto-populate HP/stats | LOW | LOW | HIGH | CRITICAL | MEDIUM | **P1** |
| US-5.3: Cross-campaign dashboard | LOW | LOW | LOW | LOW | CRITICAL | **P2** |
| US-5.4: Continuity tracker | HIGH | HIGH | LOW | LOW | CRITICAL | **P2** |
| US-5.6: AI prep pre-fill | MEDIUM | HIGH | HIGH | LOW | CRITICAL | **P2** |
| US-5.10: Emergency session gen | LOW | HIGH | MEDIUM | LOW | CRITICAL | **P3** |

### Recommended Implementation Phases

#### Phase A: Universal Fixes (serve all archetypes)

These changes benefit every DM archetype and address gaps that no archetype can work around. They represent the minimum viable improvements to the Session Cockpit.

1. **Persist plot session status** (UNI-1). Move `plotSessionStatus` from local React state to `campaignService.updateSessionLog()`. Add a `plotSessionStatus: Record<string, PlotSessionStatus>` field to `SessionLog` type.
   - Effort: Small
   - Impact: Worldbuilder (HIGH), Forever DM (CRITICAL)

2. **Auto-log DM Coach output to running log** (UNI-2). When the DM Coach generates narration, improv, or a table, automatically add a running log entry with type `coach-used` containing the result summary.
   - Effort: Small
   - Impact: All archetypes benefit

3. **Quick NPC preview step** (UNI-3). After AI generates the NPC, show a compact preview card with name, traits, and description. Offer "Save," "Regenerate," and "Edit before saving" options.
   - Effort: Medium
   - Impact: Worldbuilder (HIGH), Lazy DM (HIGH), New DM (HIGH)

4. **Session timer** (UNI-4). Add an elapsed time display in the session header bar. Start automatically when session begins. Persist to sessionStorage.
   - Effort: Small
   - Impact: New DM (HIGH), Forever DM (HIGH)

5. **Integrate dice rolls into running log** (UNI-8). When a dice roll is logged to session, insert it as a `dice-roll` type entry in `structuredNotes` alongside manual notes, creating a unified timeline.
   - Effort: Medium
   - Impact: Lazy DM (HIGH), Tactical DM (HIGH)

6. **Running log full-text search** (UNI-7). Add a search input in the running log header that filters entries by text content.
   - Effort: Small
   - Impact: Worldbuilder (HIGH), Lazy DM (HIGH), Forever DM (HIGH)

7. **Support adventure-free sessions** (US-2.12). Make the session runner fully functional without an adventure or planned scenes. Show a free-form notes area or beat list in the center panel when no scenes are planned.
   - Effort: Medium
   - Impact: Lazy DM (CRITICAL), Forever DM (HIGH)

#### Phase B: Archetype-Gated Features

These features should be available to all users but are surfaced or hidden based on a "DM Style" setting. They address specific archetype needs without cluttering the interface for others.

1. **Secrets and clues tracker** (US-1.5 / US-2.2). A collapsible panel in the quick tools area listing floating secrets/clues with revealed/unrevealed toggle. Visible by default for Lazy DM and Worldbuilder styles; hidden but accessible for others.
   - Effort: Medium
   - Impact: Lazy DM (CRITICAL), Worldbuilder (HIGH)

2. **Entity popovers/quick cards** (UNI-9). Clicking any entity name (NPC, location, faction) in the session runner opens a floating card with key details, relationships, and action buttons. Visible for all styles but richer in Worldbuilder mode (includes backstory, full relationships, lore links).
   - Effort: Large
   - Impact: Worldbuilder (CRITICAL), New DM (HIGH)

3. **DM Coach template prompts** (US-3.5). Add contextual suggestion chips below the Coach prompt textarea. In Guided mode, show prescriptive prompts ("Describe what happens when they enter the room"). In Standard/Power mode, show open-ended starters.
   - Effort: Medium
   - Impact: New DM (CRITICAL), Lazy DM (MEDIUM)

4. **Combat tracker: condition tracking** (US-4.1). Add a condition toggle bar per combatant row with icon indicators for standard conditions. Visible by default in Tactical style; collapsed to icon-only in other styles.
   - Effort: Medium
   - Impact: Tactical DM (CRITICAL), New DM (HIGH)

5. **Combat tracker: auto-populate real stats** (US-4.8). When adding a combatant from the roster, pull HP/stats from entity data instead of hardcoded defaults. Add optional CR/level fields to NPC type for encounter balancing.
   - Effort: Medium
   - Impact: Tactical DM (CRITICAL), New DM (HIGH)

6. **Post-session flow in session end** (UNI-6). When "End Session" is confirmed, show an inline post-session panel within the session runner (not a navigation to SessionLogEditor) with: AI recap generation, loose ends field, plot status review.
   - Effort: Large
   - Impact: Forever DM (CRITICAL), Lazy DM (HIGH)

7. **Voice capture in Session Runner** (UNI-5). Port the AI Scribe from SessionLogEditor into the Session Runner, with a mic button in the header and transcript feeding into the running log.
   - Effort: Large
   - Impact: Forever DM (CRITICAL), Lazy DM (HIGH)

8. **Bullet-point beats mode** (US-2.1). Allow sessions to use lightweight "beats" (title + 1-2 lines of text) instead of full Scene entities. Beats appear in the scene list sidebar and can be checked off.
   - Effort: Medium
   - Impact: Lazy DM (CRITICAL), Forever DM (HIGH)

#### Phase C: Archetype-Specific Enhancements

Deep features targeting specific archetypes. Lower priority but high differentiation value.

1. **Lore article auto-surfacing** (US-1.2). When a scene is activated, query campaign articles for keyword matches against scene NPCs, location, and description. Surface matched articles as collapsible cards in the center panel.
   - Target: Worldbuilder
   - Effort: Large

2. **Guided first-session onboarding** (US-3.1). A 3-step overlay for new users explaining the cockpit layout and workflow.
   - Target: New DM
   - Effort: Small

3. **Encounter difficulty labels** (US-3.2). Calculate and display Easy/Medium/Hard/Deadly based on combatant CRs and party level. Show in active scene panel and combat tracker.
   - Target: New DM, Tactical DM
   - Effort: Medium

4. **Full-screen combat mode** (US-4.4). A dedicated combat view that replaces the 3-column layout with a full-width combat tracker, stat block sidebar, and combat-specific running log.
   - Target: Tactical DM
   - Effort: Large

5. **Stat block quick reference** (US-4.2). Expandable stat blocks in the combat tracker populated from entity data or a reference database.
   - Target: Tactical DM
   - Effort: Large

6. **Cross-campaign dashboard** (US-5.3). A top-level view showing all campaigns with next session date, pending loose ends count, and quick-switch.
   - Target: Forever DM
   - Effort: Large

7. **Automated continuity tracker** (US-5.4). AI analysis of running logs, loose ends, and plot states across sessions to surface unresolved threads, NPC promises, and dangling hooks.
   - Target: Forever DM, Worldbuilder
   - Effort: Large

8. **AI-assisted prep pre-fill** (US-5.6). When opening a new session log, AI reads the previous session's recap and suggests opening scenes, relevant NPCs, and plot advancement.
   - Target: Forever DM, New DM
   - Effort: Large

9. **Emergency session generator** (US-5.10). One-prompt generation of a complete playable session (3-5 scenes, NPCs, location, conflict).
   - Target: Forever DM, Lazy DM
   - Effort: Medium

10. **Simplified cockpit mode** (US-3.13). A toggle that hides plot tracker, advanced tagging, formula dice, and entity popovers, showing only scene content, basic dice, and notes.
    - Target: New DM
    - Effort: Medium

11. **Post-combat analytics** (US-4.9). Automatic generation of combat statistics at encounter end.
    - Target: Tactical DM
    - Effort: Medium

12. **Panic button** (US-3.6). One-click "I'm stuck" button that reads current scene context and suggests 2-3 next moves.
    - Target: New DM
    - Effort: Medium

### Gated Functionality Design

The Session Cockpit should support a **DM Style** preference that adjusts the interface emphasis. This is not a rigid "mode" that locks features but a set of defaults and visibility preferences that the DM can override at any time.

**Implementation approach:**

1. Add a `dmStyle: 'guided' | 'standard' | 'power'` field to campaign settings (or user preferences if user accounts are implemented).

2. On first campaign creation, ask: "How would you describe your DMing style?" with three options:
   - **"I'm new to this"** -- sets `guided` mode
   - **"I keep it simple"** -- sets `standard` mode
   - **"Give me everything"** -- sets `power` mode

3. Each mode adjusts Session Cockpit defaults:

| Feature | Guided | Standard | Power |
|---|:---:|:---:|:---:|
| Scene list sidebar | Visible | Visible | Visible |
| Read-aloud text | Visible, enlarged | Visible | Visible |
| GM Notes | Visible | Visible | Visible |
| Plot tracker | Hidden | Visible | Visible |
| Secrets/clues panel | Hidden | Visible | Visible |
| Entity popovers | Simple (name + traits) | Standard | Rich (full profile + relationships + lore) |
| DM Coach prompts | Template chips shown | Open prompt | Open prompt with context injection |
| Combat tracker | Inline, simplified | Slide-out panel | Full-screen option available |
| Condition tracking | Hidden | Icon-only | Full condition bar |
| Dice roller | Big buttons only | Buttons + formula | Buttons + formula + combat integration |
| Running log tags | Hidden | Visible | Visible + entity linking |
| Lore surfacing | Off | Off | Auto-surface on scene change |
| Encounter difficulty | Shown prominently | Shown | Shown |
| Onboarding overlay | Shown on first use | Skipped | Skipped |

4. A gear icon in the session header allows toggling individual features regardless of style setting, ensuring no feature is permanently locked.

5. The DM Style preference migrates naturally: a New DM can switch to Standard after 10 sessions, and to Power after 30. The app can suggest migration ("You've run 10 sessions -- want to try Standard mode?").

---

## Appendix: Guiding Principles Alignment

Each recommendation is mapped to Realmweaver's guiding principles from `UX_OVERHAUL_PLAN.md`:

### 1. Session-first, not entity-first

| Recommendation | Alignment |
|---|---|
| Entity popovers (UNI-9) | Surfaces entity data IN the session view rather than requiring navigation to entity editors. The session is the context; entities serve it. |
| Lore auto-surfacing (US-1.2) | Brings worldbuilding output into the session cockpit automatically. Lore exists to enhance sessions, not as an end in itself. |
| Post-session in end flow (UNI-6) | Completes the session lifecycle within the session view. No context-switching to a separate editor. |
| Adventure-free sessions (US-2.12) | Sessions can exist independently of the adventure/entity hierarchy. The session is the primary unit, not the adventure. |
| Emergency session generator (US-5.10) | Generates a session directly, not a collection of entities that then need to be assembled into a session. |

### 2. Zero-click context

| Recommendation | Alignment |
|---|---|
| DM Coach auto-logging (UNI-2) | Coach output flows into the running log without the DM copying/pasting. Zero clicks to capture AI-generated content. |
| Auto-populate combat stats (US-4.8) | Combatant HP/AC populated from entity data. Zero clicks to set up correct stat values. |
| Lore auto-surfacing (US-1.2) | Relevant articles appear when a scene is activated. Zero clicks to access related lore. |
| Previous session recap banner | Already implemented. Previous session context surfaces automatically. |
| AI prep pre-fill (US-5.6) | Opening a new session log auto-generates starting suggestions from previous session data. |
| Plot status persistence (UNI-1) | Plot states from the previous session are available in the next session without the DM manually re-entering them. |

### 3. Generate-in-place

| Recommendation | Alignment |
|---|---|
| Quick NPC with preview (UNI-3) | NPC generated and previewed within the quick tools panel -- no navigation to NPC dashboard. |
| DM Coach template prompts (US-3.5) | AI assistance generated within the session cockpit, not in a separate tool. |
| Emergency session generator (US-5.10) | Entire session generated from within the cockpit or session prep view. |
| Panic button (US-3.6) | AI suggestions generated in-place when the DM is stuck, without leaving the active scene. |
| Bullet-point beats (US-2.1) | Lightweight scenes created inline in the scene list, not through a separate scene generator. |

### 4. Fun > Completeness

| Recommendation | Alignment |
|---|---|
| Bullet-point beats (US-2.1) | A beat with just a title and one line of text is valid. No required fields beyond a title. |
| Adventure-free sessions (US-2.12) | A session log with no adventure, no scenes, and just a running log is a valid session. |
| Quick NPC preview (UNI-3) | Generated NPCs are usable immediately -- editing is optional, not required. |
| Simplified cockpit mode (US-3.13) | Hides complexity that creates friction without adding fun for new DMs. |
| DM Style progressive disclosure | Features reveal themselves as the DM grows, not all at once. |

### 5. The DM's hands are busy

| Recommendation | Alignment |
|---|---|
| Voice capture in Runner (UNI-5) | Hands-free note capture via microphone during live play. |
| Session timer (UNI-4) | Passive time awareness without requiring the DM to check a clock or phone. |
| Auto-log Coach output (UNI-2) | AI-generated content captured automatically -- no copy/paste needed. |
| Dice in running log (UNI-8) | Rolls auto-log to the timeline -- no separate "log this roll" step. |
| Entity auto-detection (UNI-10) | Post-session entity creation from notes -- no manual data entry during play. |
| Keyboard shortcut for notes (US-2.11) | Single keystroke to focus the note input -- minimal hand movement. |
| One-click plot status cycling | Already implemented. Tap to cycle advanced/stalled/unchanged -- no dropdowns or forms. |

### 6. Collaborative by default

| Recommendation | Alignment |
|---|---|
| Post-session recap (UNI-6) | AI-generated player-facing recap can be shared with the group. GM secrets excluded. |
| On-deck combat indicator (US-4.10) | Shows players who is next in initiative -- shareable combat state. |
| Read-aloud text display | Already implemented. Text styled for reading aloud to players. |

### 7. Your data, your way

| Recommendation | Alignment |
|---|---|
| Cross-campaign entity copy (US-5.7) | User's content is portable between their own campaigns. |
| Plot persistence (UNI-1) | All session data persisted reliably -- no data loss from local-only state. |
| Campaign import (US-5.14) | Bring existing campaign data from external tools (Notion, Obsidian). |
| Running log search (UNI-7) | Users can find their own data within the session context. |

### 8. Progressive disclosure

| Recommendation | Alignment |
|---|---|
| DM Style setting (Guided/Standard/Power) | Core mechanism for progressive disclosure. New DMs see essentials; veterans see everything. |
| Simplified cockpit mode (US-3.13) | Reduces visible complexity for new users. |
| Onboarding overlay (US-3.1) | Teaches the interface incrementally. |
| Feature gear toggle | Individual features can be revealed or hidden regardless of style setting. |
| Suggested migration prompts | The app actively encourages growth from Guided to Standard to Power. |
