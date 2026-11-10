import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleProp, Text, TextStyle } from "react-native";


const DEFAULT_CHARSET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";

type Props = {
  text: string;

  revealDelayMs?: number;
 
  scrambleIntervalMs?: number;
  
  startDelayMs?: number;
  charset?: string;
 
  style?: StyleProp<TextStyle>;
  
  encryptedStyle?: StyleProp<TextStyle>;
  
  revealedStyle?: StyleProp<TextStyle>;
  onComplete?: () => void;
};

export function EncryptedText({
  text,
  revealDelayMs = 50,
  scrambleIntervalMs = 45,
  startDelayMs = 0,
  charset = DEFAULT_CHARSET,
  style,
  encryptedStyle,
  revealedStyle,
  onComplete,
}: Props) {
  const [revealedCount, setRevealedCount] = useState(0);
  const [scrambleTick, setScrambleTick] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    setRevealedCount(0);
    setScrambleTick(0);

    let revealTimer: ReturnType<typeof setInterval> | undefined;
    let scrambleTimer: ReturnType<typeof setInterval> | undefined;

    const startTimer = setTimeout(() => {
      scrambleTimer = setInterval(() => {
        setScrambleTick((t) => t + 1);
      }, scrambleIntervalMs);

      revealTimer = setInterval(() => {
        setRevealedCount((count) => {
          const next = count + 1;
          if (next >= text.length) {
            if (revealTimer) clearInterval(revealTimer);
            if (scrambleTimer) clearInterval(scrambleTimer);
            onCompleteRef.current?.();
          }
          return next;
        });
      }, revealDelayMs);
    }, startDelayMs);

    return () => {
      clearTimeout(startTimer);
      if (revealTimer) clearInterval(revealTimer);
      if (scrambleTimer) clearInterval(scrambleTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, revealDelayMs, scrambleIntervalMs, startDelayMs]);

  const randomChar = () => charset[Math.floor(Math.random() * charset.length)];

  // Recomputed each scramble tick so unrevealed characters keep flickering;
  // revealed characters just show their real value.
  const chars = useMemo(() => {
    return text.split("").map((char, i) => {
      if (char === " ") return " ";
      return i < revealedCount ? char : randomChar();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, revealedCount, scrambleTick]);

  return (
    <Text style={style}>
      {chars.map((char, i) => (
        <Text key={i} style={i < revealedCount ? revealedStyle : encryptedStyle}>
          {char}
        </Text>
      ))}
    </Text>
  );
}