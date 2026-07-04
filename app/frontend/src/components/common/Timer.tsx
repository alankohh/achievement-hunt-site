import { useEffect, useState } from "react";

function getTimeStr(delta: number) {
  const days = Math.floor((delta / (1000 * 60 * 60 * 24)) % 60);
  const hours = Math.floor((delta / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((delta / (1000 * 60)) % 60);
  const seconds = Math.floor((delta / 1000) % 60);
  return [days, hours, minutes, seconds]
    .map((n) => (n < 10 ? "0" + n : "" + n))
    .join(":");
}

export function Timer({
  endsAt,
  preText,
  finishedText,
}: {
  endsAt: number;
  preText: string;
  finishedText: string;
}) {
  const [timeLeft, setTimeLeft] = useState(endsAt - Date.now());

  useEffect(() => {
    const intervalId = setInterval(() => {
      setTimeLeft(Math.max(0, endsAt - Date.now()));
    }, 100);
    return () => clearInterval(intervalId);
  }, [endsAt]);

  return (
    <h1 style={{ fontSize: "3em" }}>
      {timeLeft > 0 ? `${preText}: ${getTimeStr(timeLeft)}` : finishedText}
    </h1>
  );
}
