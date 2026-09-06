
export interface AbilityScores {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

export type ProficiencyLevel = "none" | "half" | "proficient" | "expertise";

export interface Skills {
  acrobatics: ProficiencyLevel;
  animal_handling: ProficiencyLevel;
  arcana: ProficiencyLevel;
  athletics: ProficiencyLevel;
  deception: ProficiencyLevel;
  history: ProficiencyLevel;
  insight: ProficiencyLevel;
  intimidation: ProficiencyLevel;
  investigation: ProficiencyLevel;
  medicine: ProficiencyLevel;
  nature: ProficiencyLevel;
  perception: ProficiencyLevel;
  performance: ProficiencyLevel;
  persuasion: ProficiencyLevel;
  religion: ProficiencyLevel;
  sleight_of_hand: ProficiencyLevel;
  stealth: ProficiencyLevel;
  survival: ProficiencyLevel;
}

export interface ClassLevel {
  charClass: string;
  subclass?: string;
  level: number;
}

export interface CharacterSocial {
  characterName: string;
  background: string;
  species: string;
  personality: string;
  appearance: string;
  backstory: string;
  ideals: string;
  bonds: string;
  flaws: string;
}

export interface CharacterStatistics {
  classes: ClassLevel;
  attributes: AbilityScores;
  skills: Skills;
  actions: string[];
  specialActions: string[];
}

export interface PlayerCharacter {
  id: string;
  playerName: string;
  /**
   * Table Pulse (storyteller-first-design.md P5's narrowest slice — pillars
   * and hooks stay gated). Free text, one appetite per line: what this
   * PLAYER (not the character) has said they want more of. Optional,
   * non-id-bearing, top-level so `normalizePlayerCharacter`'s nested-block
   * deep-merge never has to know about it. Absent on every save that predates
   * this field — read as `?? []`, never defaulted to `[]` on write.
   */
  playerFlags?: string[];
  characterSocial: CharacterSocial;
  characterStatistics: CharacterStatistics;
}
