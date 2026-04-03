export interface SongMeta {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  color: string;
  difficulty: string;
  difficultyColor: string;
}

export const SONG_LIST: SongMeta[] = [
  {
    id: "po_pi_po",
    title: "Po Pi Po",
    artist: "Hatsune Miku (Lamaze-P)",
    bpm: 138,
    color: "#39C5BB",
    difficulty: "EASY",
    difficultyColor: "#12FA05",
  },
  {
    id: "melt",
    title: "Melt",
    artist: "Hatsune Miku (ryo)",
    bpm: 148,
    color: "#FF88CC",
    difficulty: "MEDIUM",
    difficultyColor: "#FFB800",
  },
  {
    id: "kasane_territory",
    title: "Kasane Territory",
    artist: "Kasane Teto (Owaata-P)",
    bpm: 175,
    color: "#E54451",
    difficulty: "HARD",
    difficultyColor: "#F9393F",
  },
  {
    id: "test",
    title: "Test Chart",
    artist: "Debug",
    bpm: 140,
    color: "#888",
    difficulty: "DEBUG",
    difficultyColor: "#555",
  },
];
