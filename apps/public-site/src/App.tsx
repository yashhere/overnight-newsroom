import { Routes, Route } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { EditionPage } from "./pages/EditionPage";
import { MissionControlPage } from "./pages/MissionControlPage";

export function App() {
	return (
		<Routes>
			<Route path="/" element={<HomePage />} />
			<Route path="/editions/:editionKey" element={<EditionPage />} />
			<Route path="/mission-control" element={<MissionControlPage />} />
		</Routes>
	);
}
