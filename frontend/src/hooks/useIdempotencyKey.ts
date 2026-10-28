import { useRef } from "react";

export function useIdempotencyKey() {
  const saved = useRef<{ input: string; key: string } | null>(null);
  return (input: unknown) => {
    const value = JSON.stringify(input);
    if (saved.current?.input !== value)
      saved.current = { input: value, key: crypto.randomUUID() };
    return saved.current!.key;
  };
}
