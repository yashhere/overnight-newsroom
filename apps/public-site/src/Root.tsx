import { ConvexProvider, ConvexReactClient } from "convex/react";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";

const convexUrl = import.meta.env.VITE_CONVEX_URL;
if (!convexUrl) {
	throw new Error("VITE_CONVEX_URL is not set. Check your .env.local file.");
}

const convex = new ConvexReactClient(convexUrl);

export function Root() {
	return (
		<ConvexProvider client={convex}>
			<BrowserRouter>
				<App />
			</BrowserRouter>
		</ConvexProvider>
	);
}
