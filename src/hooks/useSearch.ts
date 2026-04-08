import { useState, useEffect, useRef, useCallback } from "react";
import * as api from "../api/commands";
import type { SongListItem } from "../types";
import { compareSongNames } from "../utils/songOrder";

export function useSearch(onQueryChange: (query: string) => void) {
  const [localQuery, setLocalQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SongListItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (localQuery.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      onQueryChange("");
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const results = await api.getSearchSuggestions(localQuery, 8);
        setSuggestions([...results].sort((a, b) => compareSongNames(a.name, b.name)));
        setShowSuggestions(true);
        onQueryChange(localQuery);
      } catch (err) {
        console.error("Failed to fetch suggestions:", err);
        setSuggestions([]);
      }
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [localQuery, onQueryChange]);

  // Close suggestions on outside click
  useEffect(() => {
    if (!showSuggestions) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSuggestions]);

  const handleSuggestionClick = useCallback(
    (song: SongListItem) => {
      setLocalQuery(song.name);
      setShowSuggestions(false);
      onQueryChange(song.name);
    },
    [onQueryChange]
  );

  const clearSearch = useCallback(() => {
    setLocalQuery("");
    onQueryChange("");
  }, [onQueryChange]);

  const onFocus = useCallback(() => {
    if (suggestions.length > 0) setShowSuggestions(true);
  }, [suggestions.length]);

  return {
    localQuery,
    setLocalQuery,
    suggestions,
    showSuggestions,
    suggestionsRef,
    handleSuggestionClick,
    clearSearch,
    onFocus,
  };
}
