import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

async function run() {
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    const migrationsDir = path.resolve(process.cwd(), "migrations");
    const migrationFiles = (await readdir(migrationsDir))
      .filter((file) => file.endsWith(".sql"))
      .sort((a, b) => a.localeCompare(b));

    for (const file of migrationFiles) {
      const sql = await readFile(path.join(migrationsDir, file), "utf8");
      if (!sql.trim()) {
        continue;
      }
      await pool.query(sql);
      console.log(`applied migration: ${file}`);
    }
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
