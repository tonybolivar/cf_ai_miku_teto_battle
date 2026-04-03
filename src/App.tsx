import { useState, useCallback } from "react";
import TitleScreen from "./screens/TitleScreen";
import CharacterSelect from "./screens/CharacterSelect";
import ModeSelect from "./screens/ModeSelect";
import SongSelect from "./screens/SongSelect";
import LobbyScreen from "./screens/LobbyScreen";
import TrashTalkScreen from "./screens/TrashTalkScreen";
import GameScreen from "./screens/GameScreen";
import ResultsScreen from "./screens/ResultsScreen";
import LeaderboardScreen from "./screens/LeaderboardScreen";
import { PO_PI_PO_CHART } from "./data/charts/po_pi_po";
import { MESMERIZER_CHART } from "./data/charts/mesmerizer";
import { SONG_LIST, SONG_ASSETS } from "./data/songs";
import { applyDifficulty } from "./utils/chartDifficulty";
import type { Character, GameMode, BotDifficulty, Chart } from "./types/game";

type Screen =
  | "title"
  | "charSelect"
  | "difficulty"
  | "songSelect"
  | "lobby"
  | "trashTalk"
  | "game"
  | "results"
  | "leaderboard";

interface GameConfig {
  character: Character;
  opponentCharacter: Character;
  mode: GameMode;
  botDifficulty: BotDifficulty;
  songId: string;
}

interface GameResult {
  winner: "player" | "opponent" | "draw";
  playerScore: number;
  opponentScore: number;
  playerCombo: number;
  playerMisses: number;
}

const CHART_REGISTRY: Record<string, Chart> = {
  po_pi_po: PO_PI_PO_CHART,
  mesmerizer: MESMERIZER_CHART,
};

async function loadChart(songId: string): Promise<Chart> {
  if (CHART_REGISTRY[songId]) return CHART_REGISTRY[songId];
  try {
    const resp = await fetch(`/charts/${songId}.json`);
    if (resp.ok) {
      const chart = (await resp.json()) as Chart;
      CHART_REGISTRY[songId] = chart;
      return chart;
    }
  } catch { /* fallback */ }
  return PO_PI_PO_CHART;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("title");
  const [config, setConfig] = useState<GameConfig>({
    character: "miku",
    opponentCharacter: "teto",
    mode: "bot",
    botDifficulty: "medium",
    songId: "mesmerizer",
  });
  const [chart, setChart] = useState<Chart>(PO_PI_PO_CHART);
  const [result, setResult] = useState<GameResult | null>(null);
  const [pvpInfo, setPvpInfo] = useState<{ ws: WebSocket; slot: "p1" | "p2"; clockOffset: number; startAt: number } | null>(null);

  // ── Singleplayer flow ──

  const handleCharSelect = useCallback((character: Character) => {
    const opponent: Character = character === "miku" ? "teto" : "miku";
    setConfig((c) => ({ ...c, character, opponentCharacter: opponent, mode: "bot" }));
    setScreen("difficulty");
  }, []);

  const handleDifficulty = useCallback((difficulty: BotDifficulty) => {
    setConfig((c) => ({ ...c, botDifficulty: difficulty }));
    setScreen("songSelect");
  }, []);

  const handleSongSelect = useCallback(async (songId: string) => {
    setConfig((c) => ({ ...c, songId }));
    const loaded = await loadChart(songId);
    setChart(applyDifficulty(loaded, config.botDifficulty));
    setScreen("trashTalk");
  }, [config.botDifficulty]);

  // ── Multiplayer flow (lobby handles char select + song) ──

  const handlePvpGameStart = useCallback(async (
    ws: WebSocket, slot: "p1" | "p2",
    playerChar: Character, opponentChar: Character,
    songId: string, clockOffset: number, startAt: number,
  ) => {
    const loaded = await loadChart(songId);
    setChart(loaded);
    setConfig((c) => ({
      ...c,
      character: playerChar,
      opponentCharacter: opponentChar,
      mode: "pvp",
      songId,
    }));
    setPvpInfo({ ws, slot, clockOffset, startAt });
    setScreen("game");
  }, []);

  // ── Common ──

  const handleGameOver = useCallback((
    winner: "player" | "opponent" | "draw",
    playerScore: number, opponentScore: number,
    maxCombo: number, misses: number,
  ) => {
    setResult({ winner, playerScore, opponentScore, playerCombo: maxCombo, playerMisses: misses });
    setScreen("results");
  }, []);

  switch (screen) {
    case "title":
      return (
        <TitleScreen
          onSingleplayer={() => setScreen("charSelect")}
          onMultiplayer={() => setScreen("lobby")}
        />
      );

    case "charSelect":
      return <CharacterSelect onSelect={handleCharSelect} />;

    case "difficulty":
      return <ModeSelect onSelect={(_, diff) => handleDifficulty(diff ?? "medium")} />;

    case "songSelect":
      return <SongSelect playerCharacter={config.character} mode={config.mode} onSelect={handleSongSelect} />;

    case "lobby":
      return (
        <LobbyScreen
          onGameStart={handlePvpGameStart}
          onCancel={() => setScreen("title")}
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
      const defaultVrm: Record<string, string> = { miku: "/assets/miku.vrm", teto: "/assets/teto.vrm" };
      const songAssets = SONG_ASSETS[config.songId];
      const playerVrm = songAssets?.vrmUrls?.[config.character] ?? defaultVrm[config.character];
      const opponentVrm = songAssets?.vrmUrls?.[config.opponentCharacter] ?? defaultVrm[config.opponentCharacter];

      return (
        <GameScreen
          chart={chart}
          playerCharacter={config.character}
          opponentCharacter={config.opponentCharacter}
          mode={config.mode}
          botDifficulty={config.botDifficulty}
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
      const closePvp = () => { pvpInfo?.ws?.close(); setPvpInfo(null); };
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
