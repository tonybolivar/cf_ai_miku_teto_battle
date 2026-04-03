import type { Chart, Lane } from "../../types/game";

function generate(): Chart {
  const notes: Chart["notes"] = [];
  let id = 0;
  const bpm = 148;
  const beatMs = 60000 / bpm;

  // Melt is a medium-difficulty ballad with flowing patterns
  const versePattern: Lane[] = [0, 1, 2, 3, 2, 1];
  const chorusPattern: Lane[] = [0, 2, 1, 3, 0, 3, 2, 1];
  const bridgePattern: Lane[] = [2, 0, 3, 1, 2, 3, 0, 1];

  const oppVerse: Lane[] = [1, 3, 0, 2];
  const oppChorus: Lane[] = [2, 0, 3, 1];

  const startTime = 1500;
  let section = 0;

  for (let beat = 0; beat < 260; beat++) {
    const time = startTime + beat * beatMs;

    if (beat < 64) section = 0;       // verse 1
    else if (beat < 96) section = 1;  // chorus 1
    else if (beat < 160) section = 0; // verse 2
    else if (beat < 192) section = 1; // chorus 2
    else if (beat < 224) section = 2; // bridge
    else section = 1;                 // final chorus

    let pp: Lane[];
    let op: Lane[];
    if (section === 0) { pp = versePattern; op = oppVerse; }
    else if (section === 1) { pp = chorusPattern; op = oppChorus; }
    else { pp = bridgePattern; op = oppChorus; }

    // Player: note every beat in chorus, every other beat in verse
    if (section >= 1 || beat % 2 === 0) {
      notes.push({
        noteId: `p${id++}`,
        time: Math.round(time),
        lane: pp[beat % pp.length],
        duration: 0,
        isOpponent: false,
      });
    }

    // Add 8th notes in chorus for density
    if (section === 1 && beat % 4 === 2) {
      notes.push({
        noteId: `p${id++}`,
        time: Math.round(time + beatMs / 2),
        lane: pp[(beat + 1) % pp.length],
        duration: 0,
        isOpponent: false,
      });
    }

    // Opponent every 2 beats
    if (beat % 2 === 1) {
      notes.push({
        noteId: `o${id++}`,
        time: Math.round(time),
        lane: op[(beat / 2 | 0) % op.length],
        duration: 0,
        isOpponent: true,
      });
    }

    // Hold notes at section transitions
    if ((beat === 62 || beat === 94 || beat === 158 || beat === 222) && section > 0) {
      notes.push({
        noteId: `h${id++}`,
        time: Math.round(time),
        lane: 2,
        duration: Math.round(beatMs * 4),
        isOpponent: false,
      });
    }
  }

  return {
    id: "melt",
    title: "Melt",
    artist: "Hatsune Miku (ryo/supercell)",
    bpm,
    audioFile: "/audio/melt.mp3",
    chartOffset: 0,
    notes,
    lyrics: [
      { text: "朝目が覚めて", translation: "When I wake up in the morning", time: 2000, duration: 3000 },
      { text: "真っ先に思い浮かぶ", translation: "The first thing that comes to mind", time: 6000, duration: 3000 },
      { text: "君のことを考えると", translation: "When I think about you", time: 12000, duration: 3000 },
      { text: "溶けてしまいそう", translation: "I feel like I'm going to melt", time: 18000, duration: 3000 },
      { text: "Melt 溶けてしまいそう", translation: "Melt, I feel like melting", time: 26000, duration: 3500 },
      { text: "好きだなんて絶対に言えない", translation: "I could never say that I like you", time: 35000, duration: 3500 },
      { text: "だけど目が合うと", translation: "But when our eyes meet", time: 45000, duration: 3000 },
      { text: "溶けてしまいそうよ", translation: "I feel like I'm melting away", time: 55000, duration: 3000 },
      { text: "Melt 目も合わせられない", translation: "Melt, I can't even look at you", time: 65000, duration: 3500 },
      { text: "この気持ちは止められない", translation: "I can't stop these feelings", time: 75000, duration: 3500 },
    ],
  };
}

export const MELT_CHART = generate();
