import type { Chart, Lane } from "../../types/game";

function generate(): Chart {
  const notes: Chart["notes"] = [];
  let id = 0;
  const bpm = 175;
  const beatMs = 60000 / bpm;

  // Kasane Territory is fast and aggressive — heavy on 8th notes
  const introPattern: Lane[] = [0, 3, 1, 2];
  const versePattern: Lane[] = [3, 1, 0, 2, 3, 0, 1, 2];
  const chorusPattern: Lane[] = [0, 2, 3, 1, 0, 3, 2, 1, 3, 2, 0, 1];
  const breakPattern: Lane[] = [2, 2, 1, 1, 3, 3, 0, 0];

  const oppIntro: Lane[] = [2, 0, 3, 1];
  const oppVerse: Lane[] = [1, 3, 2, 0];
  const oppChorus: Lane[] = [3, 1, 0, 2, 1, 3];

  const startTime = 1000;

  for (let beat = 0; beat < 320; beat++) {
    const time = startTime + beat * beatMs;
    let section: number;

    if (beat < 32) section = 0;       // intro
    else if (beat < 96) section = 1;  // verse 1
    else if (beat < 144) section = 2; // chorus 1
    else if (beat < 160) section = 3; // break
    else if (beat < 224) section = 1; // verse 2
    else if (beat < 288) section = 2; // chorus 2
    else section = 2;                 // outro/final chorus

    let pp: Lane[], op: Lane[];
    switch (section) {
      case 0: pp = introPattern; op = oppIntro; break;
      case 1: pp = versePattern; op = oppVerse; break;
      case 2: pp = chorusPattern; op = oppChorus; break;
      default: pp = breakPattern; op = oppIntro; break;
    }

    // Player: every beat + 8th notes in chorus
    notes.push({
      noteId: `p${id++}`,
      time: Math.round(time),
      lane: pp[beat % pp.length],
      duration: 0,
      isOpponent: false,
    });

    // 8th notes in chorus and late verse
    if ((section === 2 || (section === 1 && beat % 8 >= 4)) && beat % 2 === 0) {
      notes.push({
        noteId: `p${id++}`,
        time: Math.round(time + beatMs / 2),
        lane: pp[(beat + 3) % pp.length],
        duration: 0,
        isOpponent: false,
      });
    }

    // 16th note bursts at chorus peaks
    if (section === 2 && beat % 16 === 0) {
      for (let i = 1; i <= 3; i++) {
        notes.push({
          noteId: `p${id++}`,
          time: Math.round(time + (beatMs / 4) * i),
          lane: pp[(beat + i) % pp.length],
          duration: 0,
          isOpponent: false,
        });
      }
    }

    // Opponent every 2 beats in verse, every beat in chorus
    if (section >= 2 || beat % 2 === 0) {
      notes.push({
        noteId: `o${id++}`,
        time: Math.round(time),
        lane: op[beat % op.length],
        duration: 0,
        isOpponent: true,
      });
    }

    // Hold notes at section transitions
    if (beat % 48 === 44 && section !== 3) {
      notes.push({
        noteId: `h${id++}`,
        time: Math.round(time),
        lane: (beat % 4) as Lane,
        duration: Math.round(beatMs * 3),
        isOpponent: false,
      });
    }
  }

  return {
    id: "kasane_territory",
    title: "Kasane Territory",
    artist: "Kasane Teto (Owaata-P)",
    bpm,
    audioFile: "/audio/kasane_territory.mp3",
    chartOffset: 0,
    notes,
    lyrics: [
      { text: "かさねテリトリー", translation: "Kasane Territory", time: 2000, duration: 2500 },
      { text: "ティロリロリー", translation: "Ti-ro-ri-ro-ri!", time: 5500, duration: 2000 },
      { text: "ここは私のテリトリー", translation: "This is my territory", time: 11000, duration: 3000 },
      { text: "踏み込んだら許さないよ", translation: "I won't forgive you if you step in", time: 18000, duration: 3000 },
      { text: "テトテトにしてやんよ", translation: "I'll teto-teto you up!", time: 28000, duration: 2500 },
      { text: "かさねかさねかさね", translation: "Pile up, pile up, pile up", time: 36000, duration: 2500 },
      { text: "テリトリー広げるよ", translation: "I'm expanding my territory", time: 45000, duration: 3000 },
      { text: "31歳だけど", translation: "I'm 31 years old, but", time: 55000, duration: 2500 },
      { text: "キメラだってかまわない", translation: "I don't care if I'm a chimera", time: 62000, duration: 3000 },
      { text: "テト テト テリトリー！", translation: "Teto Teto Territory!", time: 72000, duration: 3000 },
    ],
  };
}

export const KASANE_TERRITORY_CHART = generate();
