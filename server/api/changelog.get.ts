import type { ChangelogOptions } from "../../types/types";

const DEFAULT_EXCLUDE: string[] = [];

function parseList(value: unknown): string[] {
  if (typeof value !== "string") return DEFAULT_EXCLUDE;
  if (!value) return DEFAULT_EXCLUDE;
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {}
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const url = str(query.url);

  if (!url) {
    throw createError({
      statusCode: 400,
      statusMessage: "GitHub URL is required",
    });
  }

  const options: ChangelogOptions = {
    githubUrl: url,
    base: str(query.base),
    head: str(query.head),
    fromTag: str(query.fromTag),
    toTag: str(query.toTag),
    excludeTypes: parseList(query.excludeTypes),
    useGitmojis: query.useGitmojis !== "false",
    reverseOrder: query.reverseOrder === "true",
  };

  const authHeader = getHeader(event, "authorization");
  const token = authHeader ? authHeader.replace(/^Bearer\s+/i, "") : "";

  try {
    return await new ChangelogGenerator(token).generate(options);
  } catch (error: any) {
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || "An error occurred generating the changelog",
    });
  }
});
