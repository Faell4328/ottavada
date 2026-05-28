import { describe, expect, it } from "vitest";

import { APP_IMAGE_SOURCES, preloadAppImages } from "../../utils/preloadImages";

describe("preloadAppImages", () => {
  it("preloads every shared app image", () => {
    const createdImages: Array<{ src: string }> = [];

    preloadAppImages(() => {
      const image = { src: "" };
      createdImages.push(image);
      return image;
    });

    expect(createdImages.map((image) => image.src)).toEqual([...APP_IMAGE_SOURCES]);
  });
});