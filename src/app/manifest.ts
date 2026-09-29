import type { MetadataRoute } from "next";

/** Lets phones install the game to the home screen and launch it full screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hole Rush",
    short_name: "Hole Rush",
    description: "A hole.io-style 3D arena game: swallow the city, grow bigger and outsmart self-trained AI bots.",
    start_url: "/",
    display: "fullscreen",
    display_override: ["fullscreen", "standalone"],
    orientation: "any",
    background_color: "#0b0a1f",
    theme_color: "#0b0a1f",
    categories: ["games"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
