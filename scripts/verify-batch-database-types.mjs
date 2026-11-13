#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const [committedPath, generatedPath] = process.argv.slice(2);

if (!committedPath || !generatedPath) {
  console.error("usage: verify-batch-database-types.mjs <committed> <generated>");
  process.exit(2);
}

const [committed, generated] = await Promise.all([
  readFile(committedPath, "utf8"),
  readFile(generatedPath, "utf8"),
]);

const tableNames = [
  "account_memberships",
  "enrolments",
  "student_programme_subjects",
];

function matchingBrace(source, openingIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = openingIndex; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (character === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === quote) {
        quote = null;
      }
      continue;
    }
    if (character === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      continue;
    }
    if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function readKey(source, start) {
  let index = start;
  while (/\s/.test(source[index] || "")) index += 1;
  if (source[index] === '"' || source[index] === "'") {
    const quote = source[index];
    const keyStart = index + 1;
    index += 1;
    while (index < source.length && source[index] !== quote) {
      if (source[index] === "\\") index += 1;
      index += 1;
    }
    return { key: source.slice(keyStart, index), end: index + 1 };
  }
  const keyStart = index;
  while (/[A-Za-z0-9_$]/.test(source[index] || "")) index += 1;
  return { key: source.slice(keyStart, index), end: index };
}

function tableBlock(source, tableName) {
  const tablesMatch = /\bTables\s*:\s*\{/.exec(source);
  if (!tablesMatch) return null;
  const tablesOpen = source.indexOf("{", tablesMatch.index);
  const tablesClose = matchingBrace(source, tablesOpen);
  if (tablesClose < 0) return null;

  let cursor = tablesOpen + 1;
  while (cursor < tablesClose) {
    const { key, end: keyEnd } = readKey(source, cursor);
    if (!key) {
      cursor += 1;
      continue;
    }
    let valueStart = keyEnd;
    while (/\s/.test(source[valueStart] || "")) valueStart += 1;
    if (source[valueStart] !== ":") {
      cursor = keyEnd;
      continue;
    }
    valueStart += 1;
    while (/\s/.test(source[valueStart] || "")) valueStart += 1;
    if (source[valueStart] !== "{") {
      cursor = valueStart + 1;
      continue;
    }
    const valueEnd = matchingBrace(source, valueStart);
    if (valueEnd < 0 || valueEnd > tablesClose) return null;
    if (key === tableName) return source.slice(valueStart, valueEnd + 1);
    cursor = valueEnd + 1;
  }
  return null;
}

function tokens(source) {
  const result = [];
  let index = 0;
  while (index < source.length) {
    if (/\s/.test(source[index])) {
      index += 1;
      continue;
    }
    if (source[index] === "/" && source[index + 1] === "/") {
      index = source.indexOf("\n", index + 2);
      if (index < 0) break;
      continue;
    }
    if (source[index] === "/" && source[index + 1] === "*") {
      const end = source.indexOf("*/", index + 2);
      index = end < 0 ? source.length : end + 2;
      continue;
    }
    if (source[index] === '"' || source[index] === "'" || source[index] === "`") {
      const quote = source[index];
      const start = index;
      index += 1;
      let escaped = false;
      while (index < source.length) {
        if (escaped) escaped = false;
        else if (source[index] === "\\") escaped = true;
        else if (source[index] === quote) {
          index += 1;
          break;
        }
        index += 1;
      }
      result.push(source.slice(start, index));
      continue;
    }
    const identifier = /^[A-Za-z0-9_$]+/.exec(source.slice(index));
    if (identifier) {
      result.push(identifier[0]);
      index += identifier[0].length;
      continue;
    }
    result.push(source[index]);
    index += 1;
  }
  return result;
}

const failures = [];
for (const tableName of tableNames) {
  const committedBlock = tableBlock(committed, tableName);
  const generatedBlock = tableBlock(generated, tableName);

  if (!generatedBlock) {
    failures.push(`generated output is missing public.${tableName}`);
    continue;
  }
  if (!committedBlock) {
    failures.push(`committed output is missing public.${tableName}`);
    continue;
  }
  if (JSON.stringify(tokens(committedBlock)) !== JSON.stringify(tokens(generatedBlock))) {
    failures.push(`generated output drifted for public.${tableName}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  console.error(
    "Regenerate api/src/lib/database.types.ts from the clean local database and commit the Batch D contract.",
  );
  process.exit(1);
}

console.log(`Verified generated database type blocks: ${tableNames.join(", ")}`);
