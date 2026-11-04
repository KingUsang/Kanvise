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

function tableBlock(source, tableName) {
  const escapedName = tableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `^      ${escapedName}: \\{[\\s\\S]*?(?=^      [A-Za-z0-9_]+: \\{|^    \\}\\n    Views:)`,
    "m",
  );
  return source.match(pattern)?.[0] ?? null;
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
  if (committedBlock !== generatedBlock) {
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
