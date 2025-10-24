
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
  characterSocial: CharacterSocial;
  characterStatistics: CharacterStatistics;
}
