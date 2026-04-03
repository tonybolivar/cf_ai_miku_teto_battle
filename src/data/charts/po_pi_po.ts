import type { Chart, Lane } from "../../types/game";

function generate(): Chart {
  const notes: Chart["notes"] = [];
  let id = 0;
  const bpm = 138;
  const beatMs = 60000 / bpm;

  const playerPatterns: Lane[][] = [
    [2, 1, 2, 1],
    [0, 2, 3, 1],
    [2, 2, 1, 1, 2, 2, 3, 3],
  ];
  const oppPatterns: Lane[][] = [
    [1, 2],
    [0, 3, 1, 2],
    [2, 1, 3, 0],
  ];

  const startTime = 4000;
  let section = 0;

  for (let beat = 0; beat < 470; beat++) {
    const time = startTime + beat * beatMs;
    if (beat < 48) section = 0;
    else if (beat < 96) section = 1;
    else if (beat < 144) section = 2;
    else if (beat < 192) section = 1;
    else if (beat < 240) section = 0;
    else if (beat < 288) section = 1;
    else if (beat < 336) section = 2;
    else if (beat < 384) section = 1;
    else section = 2;

    const pp = playerPatterns[section];
    const op = oppPatterns[section];

    notes.push({
      noteId: `p${id++}`,
      time: Math.round(time),
      lane: pp[beat % pp.length],
      duration: 0,
      isOpponent: false,
    });

    if (beat % 2 === 0) {
      notes.push({
        noteId: `o${id++}`,
        time: Math.round(time),
        lane: op[(beat / 2) % op.length],
        duration: 0,
        isOpponent: true,
      });
    }

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
      // Intro - Po Pi Po chant
      { text: "ぽっぴっぽー！", translation: "Po Pi Po!", time: 545, duration: 3740 },
      { text: "ぽっぴっぽっぽっぴっぽー", translation: "Po Pi Po!", time: 4285, duration: 3090 },
      { text: "ぽっぴっぽー！", translation: "Po Pi Po!", time: 7375, duration: 3410 },
      { text: "ぽっぴっぽっぽっぴっ ぽぴ", translation: "Po Pi Po Po Pi!", time: 10785, duration: 5370 },
      // Verse 1
      { text: "さあ飲め お前好きだろ？野菜ジュース", translation: "Come on, drink! You like it, right? Vegetable juice!", time: 32375, duration: 2465 },
      { text: "私が決めた いま決めた", translation: "I've decided. I've decided just now.", time: 35895, duration: 2990 },
      { text: "だから飲んで 私の野菜ジュース", translation: "So drink up! My vegetable juice!", time: 39675, duration: 2500 },
      { text: "価格は200円", translation: "Costs 200 yen!", time: 42175, duration: 6000 },
      // Soiya
      { text: "そいや！！ そいや！！", translation: "Soiya! Soiya!", time: 48985, duration: 2870 },
      { text: "どっせー！！ どっせー！！", translation: "Dossee! Dossee!", time: 51855, duration: 4500 },
      { text: "そいや！！ そいや！！", translation: "Soiya! Soiya!", time: 55355, duration: 1000 },
      { text: "どっせー！！ どっせー！！", translation: "Dossee! Dossee!", time: 56355, duration: 2000 },
      // Verse 2
      { text: "まろやか野菜ジュース", translation: "Mild-taste vegetable juice", time: 58355, duration: 1620 },
      { text: "ふわふわ野菜ジュース", translation: "Creamy, creamy vegetable juice", time: 61085, duration: 3160 },
      { text: "いちばんオススメなのは", translation: "The one that's the best for you is...", time: 65245, duration: 3570 },
      { text: "緑のジュース", translation: "The green juice!", time: 68815, duration: 3520 },
      // Chorus
      { text: "ぽっぴぽっぴぽっぽっぴっぽー", translation: "Po Pi Po!", time: 72335, duration: 2000 },
      { text: "ベジタブルな", translation: "Vegetables!", time: 74335, duration: 4000 },
      { text: "ぽっぴぽっぴぽっぽっぴっぽー", translation: "Po Pi Po!", time: 78335, duration: 2000 },
      { text: "生命あふれた", translation: "Bursting with life!", time: 80335, duration: 4000 },
      { text: "ぽっぴぽっぴぽっぽっぴっぽー", translation: "Po Pi Po!", time: 84335, duration: 2000 },
      { text: "あなたも今", translation: "Now you are too!", time: 86335, duration: 4000 },
      { text: "ぽっぴぽっぴぽっぽっぴっぽー", translation: "Po Pi Po!", time: 90335, duration: 2000 },
      { text: "野菜ジュースが好きになる", translation: "Come to love vegetable juice!", time: 92335, duration: 4000 },
      // Verse 3 (repeat)
      { text: "さあ飲め お前好きだろ？野菜ジュース", translation: "Come on, drink! You like it, right?", time: 112675, duration: 3880 },
      { text: "私が決めた いま決めた", translation: "I've decided. I've decided just now.", time: 116555, duration: 3000 },
      { text: "だから飲んで 私の野菜ジュース", translation: "So drink up! My vegetable juice!", time: 119555, duration: 2310 },
      { text: "価格は200円", translation: "Costs just 200 yen!", time: 121865, duration: 4340 },
      // Soiya 2
      { text: "そいや！！ そいや！！", translation: "Soiya! Soiya!", time: 126520, duration: 2500 },
      { text: "どっせー！！ どっせー！！", translation: "Dossee! Dossee!", time: 128520, duration: 4480 },
      { text: "そいや！！ そいや！！", translation: "Come on! Come on!", time: 133000, duration: 3040 },
      { text: "どっせー！！ どっせー！！", translation: "Let's dance!", time: 136040, duration: 1960 },
      // Verse 4
      { text: "まろやか野菜ジュース", translation: "Mellow vegetable juice", time: 137000, duration: 2000 },
      { text: "ふわふわ野菜ジュース", translation: "Creamy vegetable juice", time: 140295, duration: 3100 },
      { text: "いちばんオススメなのは", translation: "I guess you should like the best...", time: 143395, duration: 3350 },
      { text: "緑のジュース！", translation: "Big pale blue juice!", time: 146745, duration: 4000 },
      // Final chorus
      { text: "ぽっぴぽっぴぽっぽっぴっぽー", translation: "Po Pi Po!", time: 150745, duration: 2000 },
      { text: "ベジタブルな", translation: "We are vegetarian!", time: 152745, duration: 4000 },
      { text: "ぽっぴぽっぴぽっぽっぴっぽー", translation: "Po Pi Po!", time: 156745, duration: 2000 },
      { text: "生命あふれた", translation: "Every vegetarian!", time: 158745, duration: 6830 },
      { text: "ぽっぴぽっぴぽっぽっぴっぽー", translation: "Po Pi Po!", time: 165575, duration: 2000 },
      { text: "野菜ジュースが好きになる", translation: "Happy vegetarian!", time: 167575, duration: 5690 },
      // YASAI ending
      { text: "Y・A・S・A・I", translation: "Y.A.S.A.I love you!", time: 173265, duration: 7090 },
    ],
  };
}

export const PO_PI_PO_CHART = generate();
