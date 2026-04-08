const SONG_NAME_COLLATOR = new Intl.Collator("pt-BR", {
  sensitivity: "base",
  ignorePunctuation: true,
  numeric: true,
});

export function compareSongNames(a: string | null | undefined, b: string | null | undefined): number {
  return SONG_NAME_COLLATOR.compare(a ?? "", b ?? "");
}
