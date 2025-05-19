import { ChangelogGenerator } from "~/lib/changelogGenerator";
import type { ChangelogOptions } from "~/types/types";

interface ChangelogJson {
  version: string;
  date: string;
  sections: Record<string, any>;
  fromTag?: string;
  toTag?: string;
  markdown?: string;
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event);

  if (!query.url) {
    setResponseStatus(event, 400);
    return { error: "GitHub URL is required" };
  }

  try {
    const options: Partial<ChangelogOptions> = {
      githubUrl: query.url as string,
      excludeTypes: query.excludeTypes
        ? JSON.parse(query.excludeTypes as string)
        : ["build", "docs", "other", "style"],
      includeRefIssues: query.includeRefIssues === "true",
      useGitmojis: query.useGitmojis !== "false",
      includeInvalidCommits: query.includeInvalidCommits !== "false",
      reverseOrder: query.reverseOrder === "true",
    };

    if (query.fromTag) {
      options.fromTag = query.fromTag as string;
    }

    if (query.toTag) {
      options.toTag = query.toTag as string;
    }

    const authHeader = getHeader(event, "authorization");
    const token = authHeader ? authHeader.replace("Bearer ", "") : "";

    const generator = new ChangelogGenerator(token);
    const result = await generator.generate(options as ChangelogOptions);

    const jsonData: ChangelogJson = parseChangelogToJson(result.changelog);
    jsonData.fromTag = result.fromTag;
    jsonData.toTag = result.toTag;
    jsonData.markdown = result.changelog;

    setHeader(event, "Content-Type", "application/json");
    return jsonData;
  } catch (error: any) {
    setResponseStatus(event, 500);
    return {
      error: error.message || "An error occurred generating the changelog",
    };
  }
});

function parseChangelogToJson(markdownChangelog: string): ChangelogJson {
  const lines = markdownChangelog.split("\n");
  let version = "";
  let date = "";
  const sections: Record<string, any> = {};
  let currentSection = "";

  for (const line of lines) {
    if (line.startsWith("## ")) {
      const versionMatch = line.match(/## \[(.*?)\] - (.*)/);
      if (versionMatch) {
        version = versionMatch[1];
        date = versionMatch[2];
      }
    } else if (line.startsWith("### ")) {
      currentSection = line.replace(/^### (:[\w+-]+: )?/, "").trim();
      sections[currentSection] = [];
    } else if (line.startsWith("- ") && currentSection) {
      const commitMatch = line.match(
        /- \[`(.*?)`\]\((.*?)\) - (?:(?:\*\*(.*?)\*\*: ))?(.*)(?:(?: by \[@(.*?)\]\((.*?)\)))?/
      );
      if (commitMatch) {
        const [, hash, url, scope, subject, author, authorUrl] = commitMatch;
        sections[currentSection].push({
          hash,
          url,
          scope: scope || null,
          subject,
          author: author || null,
          authorUrl: authorUrl || null,
        });
      }
    }
  }

  return {
    version,
    date,
    sections,
  };
}
