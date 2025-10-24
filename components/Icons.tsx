

import {
  BookOpen,
  Users,
  Map,
  Shield,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Save,
  BrainCircuit,
  Dice5,
  Sparkles,
  Swords,
  ScrollText,
  MessageSquare,
  Compass,
  Puzzle,
  Bus,
  FileText,
  Sun,
  Moon,
  Wind,
  Droplets,
  HelpCircle,
  Settings,
  BookHeart,
  FileCode,
  Wand2,
  X,
  Link2,
  FileUp,
  FileDown,
  BookCopy,
  UsersRound,
} from 'lucide-react';

export const Icons = {
  Campaign: BookHeart,
  Setting: Settings,
  NPCs: Users,
  Locations: Map,
  Factions: Shield,
  Items: ScrollText,
  Adventures: BookOpen,
  Scenes: FileText,
  SessionLog: BookCopy,
  PlayerCharacters: UsersRound,
  Plus,
  Trash: Trash2,
  ChevronDown,
  ChevronUp,
  Save,
  Coach: BrainCircuit,
  Dice: Dice5,
  Sparkles,
  Combat: Swords,
  Social: MessageSquare,
  Exploration: Compass,
  Puzzle,
  Travel: Bus,
  Help: HelpCircle,
  FileCode,
  // FIX: Export FileText icon to be used for Markdown export.
  FileText,
  Wizard: Wand2,
  X,
  Link: Link2,
  FileUp,
  FileDown,
};

export const SceneIcon = ({ type, className }: { type: string, className?: string }) => {
  const defaultClass = "w-4 h-4 mr-2";
  const combinedClass = `${defaultClass} ${className || ''}`;
  switch (type) {
    case 'combat':
      return <Icons.Combat className={combinedClass} />;
    case 'social':
      return <Icons.Social className={combinedClass} />;
    case 'exploration':
      return <Icons.Exploration className={combinedClass} />;
    case 'puzzle':
      return <Icons.Puzzle className={combinedClass} />;
    default:
      return <Icons.Scenes className={combinedClass} />;
  }
};
