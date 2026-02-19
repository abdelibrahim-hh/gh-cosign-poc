import { describe, it, expect } from "vitest";
import { isProduction } from "../utils";

describe("common/utils", () => {
	describe("isProduction", () => {
		it("should be a boolean value", () => {
			expect(typeof isProduction).toBe("boolean");
		});

		it("should be false in test environment", () => {
			expect(isProduction).toBe(false);
		});
	});
});
