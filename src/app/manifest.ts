import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Travel Bite",
    short_name: "Travel Bite",
    description: "Fresh meals for your bus journey",
    start_url: "/",
    display: "standalone",
    background_color: "#fffdf9",
    theme_color: "#f2632d",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
