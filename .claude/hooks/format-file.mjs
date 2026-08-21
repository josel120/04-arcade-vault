#!/usr/bin/env node
// PostToolUse hook: pasa por Prettier y `eslint --fix` cada archivo que Write/Edit
// toca dentro de este proyecto. Nunca bloquea: siempre termina con codigo 0.
//
// Recibe por stdin el payload del hook y devuelve por stdout (opcionalmente) los
// errores de ESLint que --fix no pudo arreglar, como contexto para el modelo.

import { createRequire } from "node:module";
import { readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";

const projectDir = path.resolve(process.env.CLAUDE_PROJECT_DIR ?? process.cwd());
const require = createRequire(path.join(projectDir, "package.json"));

const LINTABLE = /\.(?:[cm]?jsx?|[cm]?tsx?)$/i;
const SKIP_DIRS = /(?:^|[\/])(?:node_modules|\.next|\.git|out|build)(?:[\/]|$)/;

function done(context) {
  if (context) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: context },
        suppressOutput: true,
      }),
    );
  }
  process.exit(0);
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

/** Deja el archivo formateado. Devuelve true si Prettier lo gestiona. */
async function runPrettier(file) {
  const prettier = require("prettier");
  const info = await prettier.getFileInfo(file, {
    ignorePath: path.join(projectDir, ".prettierignore"),
    resolveConfig: true,
  });
  if (info.ignored || !info.inferredParser) return false;

  const config = await prettier.resolveConfig(file);
  const source = await readFile(file, "utf8");
  const formatted = await prettier.format(source, { ...config, filepath: file });
  if (formatted !== source) await writeFile(file, formatted, "utf8");
  return true;
}

/** Aplica `eslint --fix`. Devuelve los mensajes que sobrevivieron. */
async function runEslint(file) {
  const { ESLint } = require("eslint");
  const eslint = new ESLint({ cwd: projectDir, fix: true });
  if (await eslint.isPathIgnored(file)) return [];

  const results = await eslint.lintFiles([file]);
  await ESLint.outputFixes(results);

  const rel = path.relative(projectDir, file).replaceAll("\\", "/");
  return results.flatMap((result) =>
    result.messages.map(
      (m) =>
        `${rel}:${m.line ?? 0}:${m.column ?? 0} ${m.severity === 2 ? "error" : "warning"} ` +
        `${m.message}${m.ruleId ? ` (${m.ruleId})` : ""}`,
    ),
  );
}

async function main() {
  let payload;
  try {
    payload = JSON.parse(await readStdin());
  } catch {
    return done();
  }

  const raw = payload?.tool_response?.filePath ?? payload?.tool_input?.file_path;
  if (typeof raw !== "string" || raw.length === 0) return done();

  const file = path.resolve(projectDir, raw);

  // Solo archivos dentro de este proyecto: mantiene el hook acotado al repo.
  const rel = path.relative(projectDir, file);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) return done();
  if (SKIP_DIRS.test(rel)) return done();
  if (!(await exists(file))) return done();

  const notes = [];

  try {
    await runPrettier(file);
  } catch (error) {
    notes.push(`Prettier no pudo formatear ${rel}: ${error.message}`);
  }

  if (LINTABLE.test(file)) {
    try {
      notes.push(...(await runEslint(file)));
    } catch (error) {
      notes.push(`ESLint no pudo revisar ${rel}: ${error.message}`);
    }
  }

  return done(notes.length > 0 ? notes.join("\n") : undefined);
}

main().catch(() => process.exit(0));
