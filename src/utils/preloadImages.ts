export const APP_IMAGE_SOURCES = ["/icon.png", "/logo.png", "/metronome1.avif", "/metronome2.avif"] as const;

type ImageLike = {
  src: string;
};

export function preloadAppImages(createImage: () => ImageLike = () => new Image()) {
  for (const source of APP_IMAGE_SOURCES) {
    const image = createImage();
    image.src = source;
  }
}