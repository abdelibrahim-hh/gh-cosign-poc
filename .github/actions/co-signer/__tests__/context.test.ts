import { describe, it, expect } from "vitest";
import { parseCodeowners, getAffectedOwners, CodeownersEntry } from "../src/context";

describe("parseCodeowners", () => {
  it("parses a simple CODEOWNERS file", () => {
    const content = `# Global owners
* @org/team-frontend
src/api/ @org/team-backend @org/team-api
*.md @org/team-docs`;

    const result = parseCodeowners(content);
    expect(result).toEqual([
      { pattern: "*", owners: ["@org/team-frontend"] },
      { pattern: "src/api/", owners: ["@org/team-backend", "@org/team-api"] },
      { pattern: "*.md", owners: ["@org/team-docs"] },
    ]);
  });

  it("skips comments and empty lines", () => {
    const content = `# This is a comment

* @owner

# Another comment
`;
    const result = parseCodeowners(content);
    expect(result).toEqual([{ pattern: "*", owners: ["@owner"] }]);
  });

  it("returns empty array for empty content", () => {
    expect(parseCodeowners("")).toEqual([]);
  });
});

describe("getAffectedOwners", () => {
  const codeowners: CodeownersEntry[] = [
    { pattern: "src/components/**", owners: ["@org/team-frontend"] },
    { pattern: "src/api/**", owners: ["@org/team-backend"] },
    { pattern: "*.md", owners: ["@org/team-docs"] },
    { pattern: "*", owners: ["@org/default-owner"] },
  ];

  it("returns owners for matching files", () => {
    const owners = getAffectedOwners(["src/components/Button.tsx"], codeowners);
    expect(owners).toContain("@org/team-frontend");
    expect(owners).toContain("@org/default-owner");
  });

  it("returns multiple teams for cross-module changes", () => {
    const owners = getAffectedOwners(
      ["src/components/Button.tsx", "src/api/users.ts"],
      codeowners,
    );
    expect(owners).toContain("@org/team-frontend");
    expect(owners).toContain("@org/team-backend");
  });

  it("deduplicates owners", () => {
    const owners = getAffectedOwners(
      ["src/components/A.tsx", "src/components/B.tsx"],
      codeowners,
    );
    const frontendCount = owners.filter((o) => o === "@org/team-frontend").length;
    expect(frontendCount).toBe(1);
  });

  it("returns empty array when no files provided", () => {
    expect(getAffectedOwners([], codeowners)).toEqual([]);
  });
});
