import type { Chart, Lane } from "../../types/game";

function generate(): Chart {
  const notes: Chart["notes"] = [];
  let id = 0;
  const bpm = 143;
  const beatMs = 60000 / bpm;

  // Mesmerizer is intense, fast-paced with syncopation
  const introPattern: Lane[] = [1, 3, 0, 2];
  const versePattern: Lane[] = [0, 2, 3, 1, 2, 0, 1, 3];
  const chorusPattern: Lane[] = [3, 1, 0, 2, 3, 0, 2, 1, 0, 3, 1, 2];
  const bridgePattern: Lane[] = [2, 0, 2, 3, 1, 3, 0, 1];

  const oppIntro: Lane[] = [3, 1, 2, 0];
  const oppVerse: Lane[] = [2, 0, 1, 3];
  const oppChorus: Lane[] = [1, 3, 2, 0, 3, 1];

  const startTime = 4000; // grace period after GO!

  for (let beat = 0; beat < 360; beat++) {
    const time = startTime + beat * beatMs;
    let section: number;

    if (beat < 24) section = 0;       // intro
    else if (beat < 72) section = 1;  // verse 1
    else if (beat < 112) section = 2; // chorus 1
    else if (beat < 128) section = 3; // bridge
    else if (beat < 176) section = 1; // verse 2
    else if (beat < 224) section = 2; // chorus 2
    else if (beat < 248) section = 3; // bridge 2
    else if (beat < 300) section = 2; // final chorus
    else if (beat < 330) section = 1; // outro verse
    else section = 2;                 // outro chorus

    let pp: Lane[], op: Lane[];
    switch (section) {
      case 0: pp = introPattern; op = oppIntro; break;
      case 1: pp = versePattern; op = oppVerse; break;
      case 2: pp = chorusPattern; op = oppChorus; break;
      default: pp = bridgePattern; op = oppIntro; break;
    }

    // Player note every beat
    notes.push({
      noteId: `p${id++}`,
      time: Math.round(time),
      lane: pp[beat % pp.length],
      duration: 0,
      isOpponent: false,
    });

    // 8th notes in chorus
    if (section === 2 && beat % 2 === 0) {
      notes.push({
        noteId: `p${id++}`,
        time: Math.round(time + beatMs / 2),
        lane: pp[(beat + 2) % pp.length],
        duration: 0,
        isOpponent: false,
      });
    }

    // 16th note bursts at chorus peaks
    if (section === 2 && beat % 16 === 8) {
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

    // Hold notes at transitions
    if ((beat === 70 || beat === 126 || beat === 174 || beat === 246) && section !== 0) {
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
    id: "mesmerizer",
    title: "Mesmerizer",
    artist: "Hatsune Miku & Kasane Teto SV",
    bpm,
    audioFile: "/audio/mesmerizer.mp3",
    chartOffset: 0,
    notes,
    lyrics: [
      // Verse 1
      { text: "実際の感情はno think!", translation: "No thinking about real feelings!", time: 13890, duration: 1500 },
      { text: "気付かないフリ？", translation: "Are you pretending not to notice?", time: 15390, duration: 1380 },
      { text: "絶対的な虚実と心中", translation: "The absolute truths and your own heart", time: 16770, duration: 2620 },
      { text: "そうやって減っていく安置", translation: "That's how the safe zone is shrinking", time: 19390, duration: 1290 },
      { text: "傷の切り売り", translation: "Prostituting your wounds", time: 20680, duration: 1420 },
      { text: "脆く叫ぶ、醜態", translation: "A feeble cry, such shameful conduct", time: 22100, duration: 1920 },
      { text: "そんなあなたにオススメ！最高級の逃避行", translation: "A recommendation for you! The ultimate escape!", time: 24020, duration: 2500 },
      { text: "やがて、甘美な罠に釣られたものから救われる？", translation: "Will you be saved from being lured into sweet traps?", time: 26520, duration: 2500 },
      { text: "もはや正気の沙汰ではやっていけないこの娑婆じゃ", translation: "You can no longer live sanely in this world", time: 29020, duration: 2700 },
      { text: "敢えて素知らぬ顔で身を任せるのが最適解？", translation: "Is pretending to know nothing the optimal solution?", time: 31720, duration: 3710 },
      { text: "言葉で飾った花束も", translation: "If a bunch of flowers dressed up with words", time: 35430, duration: 2500 },
      { text: "心を奪えば、本物か？", translation: "can steal one's heart, are they real?", time: 37930, duration: 2500 },
      { text: "全てが染まっていくような事象にご招待", translation: "An invitation to where everything is tainted", time: 40430, duration: 4130 },
      { text: "さらば！", translation: "Farewell!", time: 44560, duration: 620 },
      // Chorus 1
      { text: "こんな時代に誂えた", translation: "Tailor-made for this era", time: 45180, duration: 2540 },
      { text: "見て呉れの脆弱性", translation: "with an appearance of vulnerability", time: 47720, duration: 2300 },
      { text: "本当の芝居で騙される", translation: "Fooled by this truthful acting", time: 50020, duration: 2910 },
      { text: "矢鱈と煩い心臓の鼓動", translation: "your heart beats so very loudly", time: 52930, duration: 2590 },
      { text: "残機は疾うにないなっている", translation: "Your extra lives are quickly being lost", time: 55520, duration: 2540 },
      { text: "擦り減る耐久性", translation: "Your durability worn away", time: 58060, duration: 2370 },
      { text: "目の前の事象を躱しつつ", translation: "Dodging matters right in front of you", time: 60430, duration: 2840 },
      { text: "生きるので手一杯！", translation: "You've got your hands full just living!", time: 63270, duration: 1660 },
      { text: "誰か、助けてね", translation: "Someone, please help", time: 64930, duration: 1250 },
      // Chorus 2 (hypnosis)
      { text: "「あなた段々眠くなる」", translation: '"You\'re getting sleepy"', time: 79180, duration: 1250 },
      { text: "浅はかな催眠術", translation: "A shallow hypnosis", time: 80430, duration: 1130 },
      { text: "頭、身体、煙に巻く", translation: "Your head, your body, becoming muddled", time: 81560, duration: 1370 },
      { text: "まさか、数多誑かす!?", translation: "No way! So many tricks!?", time: 82930, duration: 1340 },
      { text: "目の前で揺らぐ硬貨", translation: "Swinging a coin before your eyes", time: 84270, duration: 1370 },
      { text: "動かなくなる彼方", translation: "You'll become completely still", time: 85640, duration: 1290 },
      { text: "「これでいいんだ」自分さえも騙し騙しshut down", translation: '"This is fine" -- coaxed into shut down', time: 86930, duration: 2540 },
      // Repeat
      { text: "「あなた段々眠くなる」浅はかな催眠術", translation: '"You\'re getting sleepy" -- a shallow hypnosis', time: 89470, duration: 2380 },
      { text: "頭、身体、煙に巻く まさか、数多誑かす!?", translation: "Head, body, muddled -- so many tricks!?", time: 91850, duration: 2710 },
      { text: "目の前で揺らぐ硬貨 動かなくなる彼方...", translation: "A coin swaying... you'll become still...", time: 94560, duration: 2660 },
      // Bridge
      { text: "どんなに今日を生き抜いても", translation: "However you survive today,", time: 100020, duration: 2250 },
      { text: "報われぬeveryday", translation: "it's unrewarding everyday", time: 102270, duration: 2370 },
      { text: "もうbotみたいなサイクルで", translation: "Already in a bot-like cycle", time: 104640, duration: 2630 },
      { text: "惰性の瞬間を続けているのだ", translation: "continuing from the moment of inertia", time: 107270, duration: 2870 },
      { text: "運も希望も無いならば", translation: "If you have no luck, no hope,", time: 110140, duration: 2460 },
      { text: "尚更しょうがねえ", translation: "it's all the more pointless", time: 112600, duration: 2330 },
      { text: "無いもんは無いで、諦めて", translation: "If you haven't got it, then give up", time: 114930, duration: 2880 },
      { text: "余物で勝負するのが運命", translation: "Playing with the leftovers is your fate", time: 117810, duration: 2580 },
      // Final chorus
      { text: "こんな時代に誂えた", translation: "Tailor-made for this era", time: 120390, duration: 2750 },
      { text: "見て呉れの脆弱性", translation: "with an appearance of vulnerability", time: 123140, duration: 2210 },
      { text: "本当の芝居で騙される", translation: "Fooled by this truthful acting", time: 125350, duration: 2910 },
      { text: "矢鱈と煩い心臓の鼓動", translation: "your heart beats so very loudly", time: 128260, duration: 2630 },
      { text: "賛美はもう意味ないなっている", translation: "Exaltation has already lost its meaning", time: 130890, duration: 2380 },
      { text: "偽のカリスマ性", translation: "A fake charisma", time: 133270, duration: 2450 },
      { text: "現実を直視しすぎると", translation: "If you stare directly at reality,", time: 135720, duration: 2750 },
      { text: "失明しちゃうんだ！", translation: "you'll end up going blind!", time: 138470, duration: 1500 },
      { text: "だから、適度にね", translation: "So, do it in moderation", time: 139970, duration: 1460 },
    ],
  };
}

export const MESMERIZER_CHART = generate();
