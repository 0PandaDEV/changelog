import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { ChangelogGenerator } from "../server/utils/changelogGenerator";

function input(name: string): string {
  return (process.env[`INPUT_${name.toUpperCase()}`] || "").trim();
}

function list(name: string): string[] {
  return input(name)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function setOutput(name: string, value: string): void {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) {
    console.log(`${name}=${value}`);
    return;
  }
  const delimiter = `ghadelimiter_${randomUUID()}`;
  appendFileSync(file, `${name}<<${delimiter}\n${value}\n${delimiter}\n`);
}

function fail(message: string): never {
  console.log(`::error::${message.replace(/\r?\n/g, "%0A")}`);
  process.exit(1);
}

async function run(): Promise<void> {
  const token = input("token");
  if (token) console.log(`::add-mask::${token}`);

  const repository = input("repository") || process.env.GITHUB_REPOSITORY || "";
  if (!repository) fail("repository is required");

  const pushedTag =
    process.env.GITHUB_REF_TYPE === "tag" ? process.env.GITHUB_REF_NAME : "";

  const generator = new ChangelogGenerator(token);
  const result = await generator.generate({
    githubUrl: repository,
    base: input("base") || undefined,
    head: input("head") || pushedTag || undefined,
    excludeTypes: list("exclude-types"),
    excludeScopes: list("exclude-scopes"),
    useGitmojis: input("use-gitmojis") !== "false",
    reverseOrder: input("reverse-order") === "true",
  });

  setOutput("markdown", result.markdown);
  setOutput("json", JSON.stringify(result));
  setOutput("base", result.base);
  setOutput("head", result.head);
  setOutput("total-commits", String(result.totalCommits));
  setOutput("compare-url", result.compareUrl);

  const outputFile = input("output-file");
  if (outputFile) {
    const target = resolve(process.env.GITHUB_WORKSPACE || process.cwd(), outputFile);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, result.markdown);
  }

  if (input("step-summary") === "true" && process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${result.markdown}\n`);
  }

  console.log(
    `${result.totalCommits} commits from ${result.base || "start"} to ${result.head}`
  );
  if (result.truncated) console.log("::warning::Too many commits, the changelog is incomplete");
}

run().catch((error: unknown) => {
  fail(error instanceof Error ? error.message : String(error));
});
