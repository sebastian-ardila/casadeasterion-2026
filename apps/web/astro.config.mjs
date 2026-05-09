import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import icon from "astro-icon";

export default defineConfig({
  site: "https://casadeasterionediciones.com",
  output: "static",
  trailingSlash: "ignore",
  integrations: [icon()],
  build: {
    format: "directory",
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
