import { describe, expect, it } from "vitest";
import {
  getUniqueSongAuthors,
  normalizeSearchText,
  songMatchesAuthorFilter,
  songMatchesSearchQuery,
} from "../../utils/songSearch";

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
          updated_at: "",
          is_favorite: false,
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
          updated_at: "",
          is_favorite: false,
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
          updated_at: "",
          is_favorite: false,
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
            updated_at: "",
            is_favorite: false,
            category_ids: [],
            scores: [],
          },
          {
            id: "2",
            name: "B",
            composer: "joel",
            arranger: "Bruno",
            updated_at: "",
            is_favorite: false,
            category_ids: [],
            scores: [],
          },
        ],
        "composer"
      )
    ).toEqual(["Joel"]);
  });

  it("matches author filters including all and none", () => {
    const song = {
      id: "1",
      name: "CANON",
      composer: "Pachelbel",
      arranger: null,
      updated_at: "",
      is_favorite: false,
      category_ids: [],
      scores: [],
    };

    expect(songMatchesAuthorFilter(song, { composer: "all", arranger: "all" })).toBe(true);
    expect(songMatchesAuthorFilter(song, { composer: "Pachelbel", arranger: "none" })).toBe(true);
    expect(songMatchesAuthorFilter(song, { composer: "none", arranger: "all" })).toBe(false);
  });
});