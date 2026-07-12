import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  // loadEnv reads from process.env — this is what CF Pages build vars populate
  const env = loadEnv(mode, process.cwd(), "");
  if (!env.VITE_CONVEX_URL) {
    console.error("\n⚠️  VITE_CONVEX_URL is not set in the build environment!");
    console.error("   Make sure it's added under 'Build environment variables' in CF Pages Settings → Environment variables.\n");
    process.exit(1);
  }
  console.log(`\n✅ VITE_CONVEX_URL = ${env.VITE_CONVEX_URL}\n`);

  return {
	plugins: [react()],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
			"@convex": path.resolve(__dirname, "../../convex"),
		},
	},
	server: {
		port: 5173,
		host: true,
	},
	build: {
		outDir: "dist",
		sourcemap: true,
	},
});
