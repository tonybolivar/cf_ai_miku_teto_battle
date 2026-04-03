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
    id: "mesmerizer",
    title: "Mesmerizer",
    artist: "Hatsune Miku & Kasane Teto SV",
    bpm: 143,
    color: "#8B5CF6",
    difficulty: "HARD",
    difficultyColor: "#F9393F",
  },
];

/** Per-song asset configuration */
export interface SongAssets {
  vrmUrls?: Record<string, string>;
  /** MMD mode: PMX model + VMD animation (native MMD, no retargeting) */
  mmdModels?: Record<string, { pmx: string; vmd: string[] }>;
  backgroundVideo?: string;
  noStage?: boolean;
}

export const SONG_ASSETS: Record<string, SongAssets> = {
  mesmerizer: {
    mmdModels: {
      miku: {
        pmx: "/assets/mmd/miku/mikitm001.pmx",
        vmd: ["/assets/vmd/miku_mesmerizer.vmd", "/assets/vmd/facial_miku_mesmerizer.vmd"],
      },
      teto: {
        pmx: "/assets/mmd/teto/tetitm001.pmx",
        vmd: ["/assets/vmd/teto_mesmerizer.vmd", "/assets/vmd/facial_teto_mesmerizer.vmd"],
      },
    },
    backgroundVideo: "/assets/bg_mesmerizer.mp4",
    noStage: true,
  },
};
