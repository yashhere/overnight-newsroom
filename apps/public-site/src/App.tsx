import { Routes, Route } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { EditionPage } from "./pages/EditionPage";

export function App() {
	return (
		<Routes>
			<Route path="/" element={<HomePage />} />
			<Route path="/editions/:editionKey" element={<EditionPage />} />
		</Routes>
	);
}
