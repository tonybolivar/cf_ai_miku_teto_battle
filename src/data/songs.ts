export interface SongMeta {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  color: string;
  difficulty: string;
  difficultyColor: string;
  requiresCharacter?: string; // only available when playing this character
  modes?: ("bot" | "pvp")[]; // which modes this song is available in (default: both)
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
    requiresCharacter: "miku",
    modes: ["bot"],
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
  mmdModels?: Record<string, { pmx: string; vmd: string[] }>;
  yakuzaModels?: Record<string, { meshPar: string; commonPar: string; vmd: string[]; gmt?: string }>;
  mmdStage?: string;
  mmdCamera?: string; // VMD camera animation
  backgroundVideo?: string;
  noStage?: boolean;
  soloCharacter?: string; // only load this character (e.g. "miku")
}

export const SONG_ASSETS: Record<string, SongAssets> = {
  po_pi_po: {
    mmdModels: {
      miku: {
        pmx: "/assets/mmd/miku/mikitm001.pmx",
        vmd: ["/assets/vmd/miku_popipo.vmd"],
      },
    },
    mmdStage: "/assets/mmd/popipo_stage/Stage.pmx",
    noStage: true,
    soloCharacter: "miku",
  },
  mesmerizer: {
    mmdModels: {
      miku: {
        pmx: "/assets/mmd/miku/mikitm001.pmx",
        vmd: ["/assets/vmd/miku_mesmerizer.vmd", "/assets/vmd/facial_miku_mesmerizer.vmd"],
      },
      teto: {
        pmx: "/assets/mmd/teto/tetitm001.pmx",
        vmd: ["/assets/vmd/teto_mesmerizer.vmd.gz", "/assets/vmd/facial_teto_mesmerizer.vmd"],
      },
    },
    backgroundVideo: "/assets/bg_mesmerizer.mp4",
    noStage: true,
  },
};

/** Kiryu mode overrides — activated by secret code on title screen */
export const KIRYU_SONG_ASSETS: Record<string, SongAssets> = {
  po_pi_po: {
    yakuzaModels: {
      miku: {
        meshPar: "/assets/yakuza/kiryu/mesh.par",
        commonPar: "/assets/yakuza/kiryu/tex_common_w64.par",
        vmd: ["/assets/vmd/miku_popipo.vmd"],
      },
    },
    mmdStage: "/assets/mmd/popipo_stage/Stage.pmx",
    noStage: true,
    soloCharacter: "miku",
  },
};
