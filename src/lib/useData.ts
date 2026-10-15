import { useEffect, useState } from "react";
import { peekFundamentals, subscribeFundamentals } from "./fundamentals";
import { getLiveStatus, subscribeLiveStatus, type LiveStatus } from "./live";
import { peekQuotes, subscribeQuotes } from "./quotes";
import { peekRankings, subscribeRankings } from "./rankings";
import { peekThemeBoards, subscribeThemeBoards } from "./themes";
import { peekUniverse, subscribeUniverse } from "./universe";

function useStore<T>(peek: () => T, subscribe: (listen: (value: T) => void) => () => void) {
  const [value, setValue] = useState<T>(peek);
  useEffect(() => subscribe(setValue), [subscribe]);
  return value;
}

export function useQuotes() {
  return useStore(peekQuotes, subscribeQuotes);
}

export function useThemeBoards() {
  return useStore(peekThemeBoards, subscribeThemeBoards);
}

export function useRankings() {
  return useStore(peekRankings, subscribeRankings);
}

export function useFundamentals() {
  return useStore(peekFundamentals, subscribeFundamentals);
}

export function useUniverse() {
  return useStore(peekUniverse, subscribeUniverse);
}

export function useLiveStatus(): LiveStatus {
  return useStore(getLiveStatus, subscribeLiveStatus);
}
