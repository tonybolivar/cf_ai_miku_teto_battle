import type { Chart, Lane } from "../../types/game";

function generate(): Chart {
  const notes: Chart["notes"] = [];
  let id = 0;
  const bpm = 138;
  const beatMs = 60000 / bpm;

  // Po Pi Po is a bouncy, easy song — mostly quarter notes with simple patterns
  const playerPatterns: Lane[][] = [
    [2, 1, 2, 1],           // verse: up-down bounce
    [0, 2, 3, 1],           // pre-chorus: all lanes
    [2, 2, 1, 1, 2, 2, 3, 3], // chorus: doubles
  ];
  const oppPatterns: Lane[][] = [
    [1, 2],
    [0, 3, 1, 2],
    [2, 1, 3, 0],
  ];

  const startTime = 2000;
  let section = 0;

  for (let beat = 0; beat < 200; beat++) {
    const time = startTime + beat * beatMs;

    // Switch section every ~48 beats
    if (beat === 48) section = 1;
    if (beat === 96) section = 2;
    if (beat === 144) section = 1;

    const pp = playerPatterns[section];
    const op = oppPatterns[section];

    // Player note every beat
    notes.push({
      noteId: `p${id++}`,
      time: Math.round(time),
      lane: pp[beat % pp.length],
      duration: 0,
      isOpponent: false,
    });

    // Opponent every 2nd beat
    if (beat % 2 === 0) {
      notes.push({
        noteId: `o${id++}`,
        time: Math.round(time),
        lane: op[(beat / 2) % op.length],
        duration: 0,
        isOpponent: true,
      });
    }

    // Hold notes in chorus sections
    if (section === 2 && beat % 16 === 8) {
      notes.push({
        noteId: `h${id++}`,
        time: Math.round(time),
        lane: 2,
        duration: Math.round(beatMs * 3),
        isOpponent: false,
      });
    }
  }

  return {
    id: "po_pi_po",
    title: "Po Pi Po",
    artist: "Hatsune Miku (Lamaze-P)",
    bpm,
    audioFile: "/audio/po_pi_po.mp3",
    chartOffset: 0,
    notes,
    lyrics: [
      { text: "ぽっぴっぽー", translation: "Po-pi-po!", time: 3000, duration: 2000 },
      { text: "ぽっぴっぽー", translation: "Po-pi-po!", time: 6000, duration: 2000 },
      { text: "野菜ジュースを飲もう", translation: "Let's drink vegetable juice", time: 10000, duration: 3000 },
      { text: "ぽっぴっぽっぽっぽー", translation: "Po-pi-po-ppo-po!", time: 15000, duration: 2500 },
      { text: "お気に入りはどれかな", translation: "Which one is your favorite?", time: 25000, duration: 3000 },
      { text: "ぽっぴっぽー", translation: "Po-pi-po!", time: 35000, duration: 2000 },
      { text: "健康のために", translation: "For your health", time: 45000, duration: 2500 },
      { text: "野菜生活始めよう", translation: "Let's start a veggie life", time: 55000, duration: 3000 },
      { text: "ぽっぴっぽっぽっぽっぽー", translation: "Po-pi-po-ppo-ppo-po!", time: 65000, duration: 3000 },
    ],
  };
}

export const PO_PI_PO_CHART = generate();
