import type { Chart, Lane } from "../../types/game";

/** Generate a simple test chart with notes on all 4 lanes */
function generateTestChart(): Chart {
  const notes: Chart["notes"] = [];
  let id = 0;
  const bpm = 140;
  const beatMs = 60000 / bpm; // ~428ms

  // Simple pattern: alternating lanes every beat for the player
  const playerPattern: Lane[] = [0, 1, 2, 3, 2, 1, 0, 3];
  // Opponent plays a simpler pattern offset by half a beat
  const opponentPattern: Lane[] = [0, 2, 1, 3];

  const startTime = 1000; // start 1 second in

  // 60 seconds of notes
  for (let beat = 0; beat < 140; beat++) {
    const time = startTime + beat * beatMs;

    // Player notes
    const playerLane = playerPattern[beat % playerPattern.length];
    notes.push({
      noteId: `p${id++}`,
      time: Math.round(time),
      lane: playerLane,
      duration: 0,
      isOpponent: false,
    });

    // Opponent notes (every other beat)
    if (beat % 2 === 0) {
      const oppLane = opponentPattern[(beat / 2) % opponentPattern.length];
      notes.push({
        noteId: `o${id++}`,
        time: Math.round(time),
        lane: oppLane,
        duration: 0,
        isOpponent: true,
      });
    }

    // Add some hold notes every 16 beats for the player
    if (beat > 0 && beat % 16 === 0) {
      notes.push({
        noteId: `h${id++}`,
        time: Math.round(time + beatMs * 2),
        lane: (2 as Lane),
        duration: Math.round(beatMs * 2),
        isOpponent: false,
      });
    }
  }

  return {
    id: "test",
    title: "Test Chart",
    artist: "Debug",
    bpm,
    audioFile: "/audio/test.mp3",
    chartOffset: 0,
    notes,
    lyrics: [
      { text: "テスト開始", translation: "Test begins", time: 1000, duration: 2000 },
      { text: "リズムに乗って", translation: "Ride the rhythm", time: 5000, duration: 2500 },
      { text: "矢印を追いかけて", translation: "Chase the arrows", time: 10000, duration: 2500 },
      { text: "ミクとテト", translation: "Miku and Teto", time: 15000, duration: 2000 },
      { text: "バトル開始！", translation: "Battle start!", time: 20000, duration: 2000 },
      { text: "負けないよ", translation: "I won't lose", time: 30000, duration: 2000 },
      { text: "最後まで頑張ろう", translation: "Let's do our best to the end", time: 45000, duration: 3000 },
    ],
  };
}

export const TEST_CHART = generateTestChart();
