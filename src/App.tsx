import { useState, useCallback } from "react";
import TitleScreen from "./screens/TitleScreen";
import CharacterSelect from "./screens/CharacterSelect";
import ModeSelect from "./screens/ModeSelect";
import SongSelect from "./screens/SongSelect";
import LobbyScreen from "./screens/LobbyScreen";
import TrashTalkScreen from "./screens/TrashTalkScreen";
import CountdownScreen from "./screens/CountdownScreen";
import GameScreen from "./screens/GameScreen";
import ResultsScreen from "./screens/ResultsScreen";
import LeaderboardScreen from "./screens/LeaderboardScreen";
import { PO_PI_PO_CHART } from "./data/charts/po_pi_po";
import { MESMERIZER_CHART } from "./data/charts/mesmerizer";
import { SONG_LIST, SONG_ASSETS } from "./data/songs";
import type { Character, GameMode, BotDifficulty, Chart } from "./types/game";

type Screen =
  | "title"
  | "charSelect"
  | "modeSelect"
  | "songSelect"
  | "lobby"
  | "trashTalk"
  | "countdown"
  | "game"
  | "results"
  | "leaderboard";

interface GameConfig {
  character: Character;
  opponentCharacter: Character;
  mode: GameMode;
  botDifficulty: BotDifficulty | null;
  songId: string;
  lobbyCode: string | null;
}

interface GameResult {
  winner: "player" | "opponent" | "draw";
  playerScore: number;
  opponentScore: number;
  playerCombo: number;
  playerMisses: number;
}

// Chart registry — songs will be loaded dynamically; test chart is always available
const CHART_REGISTRY: Record<string, Chart> = {
  po_pi_po: PO_PI_PO_CHART,
  mesmerizer: MESMERIZER_CHART,
};

export async function loadChart(songId: string): Promise<Chart> {
  if (CHART_REGISTRY[songId]) return CHART_REGISTRY[songId];

  // Try to load from /charts/{songId}.json
  try {
    const resp = await fetch(`/charts/${songId}.json`);
    if (resp.ok) {
      const chart = (await resp.json()) as Chart;
      CHART_REGISTRY[songId] = chart;
      return chart;
    }
  } catch { /* fallback */ }

  // Fallback to first available
  return PO_PI_PO_CHART;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("title");
  const [config, setConfig] = useState<GameConfig>({
    character: "miku",
    opponentCharacter: "teto",
    mode: "bot",
    botDifficulty: "medium",
    songId: "test",
    lobbyCode: null,
  });
  const [chart, setChart] = useState<Chart>(PO_PI_PO_CHART);
  const [result, setResult] = useState<GameResult | null>(null);
  const [pvpInfo, setPvpInfo] = useState<{ ws: WebSocket; slot: "p1" | "p2"; clockOffset: number; startAt: number } | null>(null);

  const handleCharSelect = useCallback((character: Character) => {
    const opponent: Character = character === "miku" ? "teto" : "miku";
    setConfig((c) => ({ ...c, character, opponentCharacter: opponent }));
    setScreen("modeSelect");
  }, []);

  const handleModeSelect = useCallback((mode: GameMode, difficulty: BotDifficulty | null) => {
    setConfig((c) => ({ ...c, mode, botDifficulty: difficulty }));
    setScreen("songSelect");
  }, []);

  const handleSongSelect = useCallback(async (songId: string) => {
    setConfig((c) => ({ ...c, songId }));
    const loadedChart = await loadChart(songId);
    setChart(loadedChart);
    if (config.mode === "pvp") {
      setScreen("lobby");
    } else {
      setScreen("trashTalk");
    }
  }, [config.mode]);

  const handleGameOver = useCallback((
    winner: "player" | "opponent" | "draw",
    playerScore: number,
    opponentScore: number,
    maxCombo: number,
    misses: number,
  ) => {
    setResult({ winner, playerScore, opponentScore, playerCombo: maxCombo, playerMisses: misses });
    setScreen("results");
  }, []);

  switch (screen) {
    case "title":
      return <TitleScreen onStart={() => setScreen("charSelect")} />;

    case "charSelect":
      return <CharacterSelect onSelect={handleCharSelect} />;

    case "modeSelect":
      return <ModeSelect onSelect={handleModeSelect} />;

    case "songSelect":
      return <SongSelect playerCharacter={config.character} mode={config.mode} onSelect={handleSongSelect} />;

    case "lobby":
      return (
        <LobbyScreen
          playerCharacter={config.character}
          songId={config.songId}
          mode={config.mode}
          botDifficulty={config.botDifficulty ?? undefined}
          onGameStart={(ws, slot, clockOffset, startAt) => {
            setPvpInfo({ ws, slot, clockOffset, startAt });
            setScreen("game");
          }}
          onCancel={() => setScreen("songSelect")}
        />
      );

    case "trashTalk": {
      const songMeta = SONG_LIST.find((s) => s.id === config.songId);
      return (
        <TrashTalkScreen
          opponentCharacter={config.opponentCharacter}
          playerCharacter={config.character}
          songTitle={songMeta?.title ?? config.songId}
          onDone={() => setScreen("game")}
        />
      );
    }

    case "game": {
      // Default VRMs, overridden by song-specific assets
      const defaultVrm: Record<string, string> = {
        miku: "/assets/miku.vrm",
        teto: "/assets/teto.vrm",
      };
      const songAssets = SONG_ASSETS[config.songId];
      const playerVrm = songAssets?.vrmUrls?.[config.character] ?? defaultVrm[config.character];
      const opponentVrm = songAssets?.vrmUrls?.[config.opponentCharacter] ?? defaultVrm[config.opponentCharacter];

      return (
        <GameScreen
          chart={chart}
          playerCharacter={config.character}
          opponentCharacter={config.opponentCharacter}
          mode={config.mode}
          botDifficulty={config.botDifficulty ?? "medium"}
          playerVrmUrl={playerVrm}
          opponentVrmUrl={opponentVrm}
          playerStageUrl={songAssets?.noStage ? undefined : "/assets/stage_teto.glb"}
          songId={config.songId}
          pvpInfo={config.mode === "pvp" ? pvpInfo ?? undefined : undefined}
          onGameOver={handleGameOver}
        />
      );
    }

    case "results": {
      const closePvp = () => {
        pvpInfo?.ws?.close();
        setPvpInfo(null);
      };
      return (
        <ResultsScreen
          winner={result?.winner ?? "draw"}
          playerCharacter={config.character}
          opponentCharacter={config.opponentCharacter}
          playerScore={result?.playerScore ?? 0}
          opponentScore={result?.opponentScore ?? 0}
          playerCombo={result?.playerCombo ?? 0}
          playerMisses={result?.playerMisses ?? 0}
          pvpWs={pvpInfo?.ws}
          onPlayAgain={() => { closePvp(); setScreen("game"); }}
          onRematch={(startAt) => {
            if (pvpInfo) setPvpInfo({ ...pvpInfo, startAt });
            setScreen("game");
          }}
          onLeaderboard={() => { closePvp(); setScreen("leaderboard"); }}
          onTitle={() => { closePvp(); setScreen("title"); }}
        />
      );
    }

    case "leaderboard":
      return <LeaderboardScreen onBack={() => setScreen(result ? "results" : "title")} />;
  }
}
