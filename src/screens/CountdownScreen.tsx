import { useEffect, useState } from "react";

interface CountdownScreenProps {
  onDone: () => void;
}

export default function CountdownScreen({ onDone }: CountdownScreenProps) {
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (count === 0) {
      const timer = setTimeout(onDone, 500);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setCount((c) => c - 1), 800);
    return () => clearTimeout(timer);
  }, [count, onDone]);

  const text = count > 0 ? String(count) : "GO!";
  const color = count > 0 ? "#FFF" : "#12FA05";
  const scale = count === 0 ? 1.5 : 1;

  return (
    <div style={{
      width: "100%", height: "100%", display: "flex", alignItems: "center",
      justifyContent: "center", background: "#000",
      fontFamily: '"Noto Sans JP", sans-serif',
    }}>
      <span
        key={count}
        style={{
          fontSize: "8rem", color, fontWeight: "bold",
          transform: `scale(${scale})`, transition: "transform 0.3s ease-out",
          animation: "countPop 0.4s ease-out",
          textShadow: count === 0 ? "0 0 40px #12FA05" : "none",
        }}
      >
        {text}
      </span>

      <style>{`
        @keyframes countPop {
          0% { transform: scale(2); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: scale(${scale}); }
        }
      `}</style>
    </div>
  );
}
