export interface League {
  id: string;
  name: string;
  createdAt: string;
}

export interface Score {
  id: string;
  leagueId: string;
  playerName: string;
  sport: string;
  category: string;
  totalScore: number;
  totalGuesses: number;
  percentile: number;
  date: string; // YYYY-MM-DD
  screenshotUrl: string;
  submittedAt: string;
}

export interface Message {
  id: string;
  leagueId: string;
  playerName: string;
  text: string;
  date: string; // YYYY-MM-DD (Statpad day)
  sentAt: string; // ISO timestamp
}

export interface PlayerStats {
  playerName: string;
  gamesPlayed: number;
  daysPlayed: number;
  avgPercentile: number;
  bestScore: number;
  bestScoreSport: string;
  bestPercentile: number;
  currentStreak: number;
  sportBreakdown: Record<string, { count: number; avg: number; best: number; avgPercentile: number }>;
}
