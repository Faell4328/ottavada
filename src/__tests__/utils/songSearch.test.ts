import { describe, expect, it } from "vitest";
import {
  getRelatedAuthorOptions,
  getUniqueSongAuthors,
  normalizeSearchText,
  songMatchesAuthorFilter,
  songMatchesSearchQuery,
} from "../../utils/songSearch";
import type { SongListItem } from "../../types";

describe("songSearch", () => {
  it("normalizes accents and punctuation", () => {
    expect(normalizeSearchText("Hino Nacional (Edição)!")).toBe("hino nacional edicao");
  });

  it("matches by song name", () => {
    expect(
      songMatchesSearchQuery(
        {
          id: "1",
          name: "HINO NACIONAL",
          composer: "JOEL",
          arranger: null,
          path: "/songs/hino-nacional",
          updated_at: "",
          is_favorite: false,
          status: "main",
          category_ids: [],
          scores: [],
        },
        normalizeSearchText("nacional")
      )
    ).toBe(true);
  });

  it("matches by composer or arranger", () => {
    expect(
      songMatchesSearchQuery(
        {
          id: "1",
          name: "CANON IN D",
          composer: "PACHELBEL",
          arranger: "JOHN DOE",
          path: "/songs/canon-in-d",
          updated_at: "",
          is_favorite: false,
          status: "main",
          category_ids: [],
          scores: [],
        },
        normalizeSearchText("john")
      )
    ).toBe(true);
  });

  it("returns true when the query is empty", () => {
    expect(
      songMatchesSearchQuery(
        {
          id: "1",
          name: "ANY",
          composer: null,
          arranger: null,
          path: "/songs/any",
          updated_at: "",
          is_favorite: false,
          status: "main",
          category_ids: [],
          scores: [],
        },
        ""
      )
    ).toBe(true);
  });

  it("extracts unique authors in sorted order", () => {
    expect(
      getUniqueSongAuthors(
        [
          {
            id: "1",
            name: "A",
            composer: "Joel",
            arranger: "Ana",
            path: "/songs/a",
            updated_at: "",
            is_favorite: false,
            status: "main",
            category_ids: [],
            scores: [],
          },
          {
            id: "2",
            name: "B",
            composer: "joel",
            arranger: "Bruno",
            path: "/songs/b",
            updated_at: "",
            is_favorite: false,
            status: "main",
            category_ids: [],
            scores: [],
          },
        ],
        "composer"
      )
    ).toEqual(["Joel"]);
  });

  it("matches author filters including all and none", () => {
    const song: SongListItem = {
      id: "1",
      name: "CANON",
      composer: "Pachelbel",
      arranger: null,
      path: "/songs/canon",
      updated_at: "",
      is_favorite: false,
      status: "main",
      category_ids: [],
      scores: [],
    };

    expect(songMatchesAuthorFilter(song, { composer: "all", arranger: "all" })).toBe(true);
    expect(songMatchesAuthorFilter(song, { composer: "Pachelbel", arranger: "none" })).toBe(true);
    expect(songMatchesAuthorFilter(song, { composer: "none", arranger: "all" })).toBe(false);
  });
});

describe("getRelatedAuthorOptions", () => {
  const songs: SongListItem[] = [
    makeSong("A", "Bach", "Joel"),
    makeSong("B", "Beethoven", null),
    makeSong("C", "Bach", "Ana"),
    makeSong("D", null, "Joel"),
    makeSong("E", "Bach", "Joel"),
  ];

  it("returns all composers when relatedFilter is all", () => {
    const result = getRelatedAuthorOptions(songs, "composer", "all");
    expect(result).toEqual(["Bach", "Beethoven"]);
  });

  it("returns all arrangers when relatedFilter is all", () => {
    const result = getRelatedAuthorOptions(songs, "arranger", "all");
    expect(result).toEqual(["Ana", "Joel"]);
  });

  it("returns composers only from songs with arranger none", () => {
    const result = getRelatedAuthorOptions(songs, "composer", "none");
    expect(result).toEqual(["Beethoven"]);
  });

  it("returns arrangers only from songs with composer none", () => {
    const result = getRelatedAuthorOptions(songs, "arranger", "none");
    expect(result).toEqual(["Joel"]);
  });

  it("returns composers only from songs with specific arranger", () => {
    const result = getRelatedAuthorOptions(songs, "composer", "Joel");
    expect(result).toEqual(["Bach"]);
  });

  it("returns arrangers only from songs with specific composer", () => {
    const result = getRelatedAuthorOptions(songs, "arranger", "Bach");
    expect(result).toEqual(["Ana", "Joel"]);
  });

  it("returns empty array when no songs match the related filter", () => {
    const result = getRelatedAuthorOptions(songs, "composer", "Mozart");
    expect(result).toEqual([]);
  });

  it("returns empty array for empty songs list", () => {
    const result = getRelatedAuthorOptions([], "composer", "all");
    expect(result).toEqual([]);
  });

  it("normalizes accents when matching related filter", () => {
    const accentedSongs: SongListItem[] = [
      makeSong("A", "Bach", "José"),
      makeSong("B", "Beethoven", "Jose"),
    ];

    const result = getRelatedAuthorOptions(accentedSongs, "composer", "José");
    expect(result).toEqual(["Bach", "Beethoven"]);
  });
});

function makeSong(name: string, composer: string | null, arranger: string | null): SongListItem {
  return {
    id: name,
    name,
    composer,
    arranger,
    path: `/songs/${name}`,
    updated_at: "",
    is_favorite: false,
    status: "main",
    category_ids: [],
    scores: [],
  };
}