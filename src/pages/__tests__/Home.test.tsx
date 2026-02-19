import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Home } from "../Home";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
		i18n: {
			resolvedLanguage: "en",
			changeLanguage: vi.fn(),
		},
	}),
}));

describe("pages/Home", () => {
	it("should render without crashing", () => {
		render(<Home />);

		expect(screen.getByText("home.greeting")).toBeInTheDocument();
	});

	it("should render a translate button", () => {
		render(<Home />);

		const button = screen.getByRole("button", { name: /translate/i });
		expect(button).toBeInTheDocument();
	});
});
