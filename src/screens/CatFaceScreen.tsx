import { useEffect, useState } from "react";

const CAT_FACES = [
  "｡＾･ｪ･＾｡", "(=^･ω･^=)", "(=^･ｪ･^=)", "(=^‥^=)", "(^・ω・^ )",
  "(^._.^)ﾉ", "(*ΦωΦ*)", "(ΦωΦ)", "ฅ(^ω^ฅ)", "ฅ•ω•ฅ",
  "(=ↀωↀ=)✧", "(●ↀωↀ●)", "ฅ( ᵕ ω ᵕ )ฅ", "(=^-ω-^=)",
  "₍˄·͈༝·͈˄₎◞ ̑̑ෆ⃛", "(⁎˃ᆺ˂)", "ミ◕ฺｖ◕ฺ彡", "ฅ^•ﻌ•^ฅ",
  "(=｀ω´=)", "ヽ(=^･ω･^=)丿", "d(=^･ω･^=)b", "ლ(=ↀωↀ=)ლ",
  "~(=^‥^)/", "(=^･ω･^)y＝", "✩⃛( ͒ ु•·̫• ू ͒)", "(๑ↀᆺↀ๑)✧",
];

interface CatFaceScreenProps {
  onDone: () => void;
}

export default function CatFaceScreen({ onDone }: CatFaceScreenProps) {
  const [cat] = useState(() => CAT_FACES[Math.floor(Math.random() * CAT_FACES.length)]);

  useEffect(() => {
    const timer = setTimeout(onDone, 2000);
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") onDone();
    };
    window.addEventListener("keydown", handler);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", handler);
    };
  }, [onDone]);

  return (
    <div style={{
      width: "100%", height: "100%", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", background: "#000",
    }}>
      <div style={{
        fontSize: "4rem",
        marginBottom: 30,
        animation: "catBounce 0.6s ease-in-out infinite alternate",
      }}>
        {cat}
      </div>
      <p style={{ color: "#555", fontSize: "0.8rem" }}>Press ENTER</p>
      <style>{`
        @keyframes catBounce {
          0% { transform: translateY(0); }
          100% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
}
