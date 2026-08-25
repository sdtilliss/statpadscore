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
  purpleTiles?: number; // count of individual athlete tiles at 100th percentile
}

export interface Message {
  id: string;
  leagueId: string;
  playerName: string;
  text: string;
  date: string; // YYYY-MM-DD (Statpad day)
  sentAt: string; // ISO timestamp
}

export interface TripleCrown {
  leagueId: string;
  date: string; // YYYY-MM-DD (Statpad day the crown was won)
  playerName: string;
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
  purpleHits: number;
  // A "win" = holding rank 1 in a (day, sport) group, ranked by percentile
  // (tiebreak: raw score) — the same ordering the Today tab and Triple Crowns use.
  wins: number;
  // Average rank across every (day, sport) the player submitted (1 = won it).
  avgPlacement: number;
  sportBreakdown: Record<string, { count: number; avg: number; best: number; avgPercentile: number; bestPercentile: number; purpleHits: number; wins: number; avgPlacement: number }>;
}
