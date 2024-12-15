import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql, { type RowDataPacket } from 'mysql2/promise';
import * as R from 'remeda';

import { Table, getTableName } from 'drizzle-orm';
import * as Schema from './schema';

type Record = {
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  [key: string]: any;
};

const QUERY = `SELECT
  TABLE_NAME AS table_name,
  REFERENCED_TABLE_NAME AS reference_table_name
FROM
  information_schema.KEY_COLUMN_USAGE`;

const fixturesDir = path.join(__dirname, 'fixtures');

function topologicalSort(dependencyMap: Map<string, Set<string>>): string[] {
  const sorted: string[] = [];
  const visited: Set<string> = new Set();
  const tempMarked: Set<string> = new Set();

  const visit = (node: string): void => {
    if (tempMarked.has(node)) {
      throw new Error(`${node}で閉路を検出`);
    }

    if (!visited.has(node)) {
      tempMarked.add(node);

      const dependencies = dependencyMap.get(node) || new Set();
      for (const dep of dependencies) {
        visit(dep);
      }

      tempMarked.delete(node);
      visited.add(node);
      sorted.push(node);
    }
  };

  for (const node of dependencyMap.keys()) {
    if (!visited.has(node)) {
      visit(node);
    }
  }

  return sorted;
}

async function main(): Promise<void> {
  const poolConnection = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: Number(process.env.MYSQL_PORT),
  });

  const db = drizzle({ client: poolConnection });

  const tables = R.entries(Schema).filter(([_, v]) => v instanceof Table);
  const schemeMap = new Map(tables.map(([_, v]) => [getTableName(v) as string, v]));
  const dependencyMap = new Map<string, Set<string>>(tables.map(([_, v]) => [getTableName(v), new Set<string>()]));

  const [params, _fp] = await poolConnection.execute<RowDataPacket[]>(QUERY);
  const relations = params.filter((res) => res.reference_table_name !== null) as {
    table_name: string;
    reference_table_name: string;
  }[];

  for (const r of relations) {
    const s = dependencyMap.get(r.table_name);
    if (s) {
      s.add(r.reference_table_name);
      dependencyMap.set(r.table_name, s);
    } else {
      throw Error(`schemeに定義していないテーブル: ${r.table_name}`);
    }
  }

  const sorted = topologicalSort(dependencyMap);

  const files = await fs.promises.readdir(fixturesDir);
  const fixtureFileSet = new Set(files.filter((f) => path.extname(f) === '.json').map((f) => path.parse(f).name));

  await db.transaction(async (tx) => {
    for (const tableName of sorted) {
      if (fixtureFileSet.has(tableName)) {
        const filePath = path.join(fixturesDir, `${tableName}.json`);
        const fileContent = await fs.promises.readFile(filePath, 'utf-8');
        const fixture = JSON.parse(fileContent);
        const targetScheme = schemeMap.get(tableName);
        if (!targetScheme) {
          throw Error();
        }

        await tx.insert(targetScheme).values(fixture);
      }
    }
  });

  await poolConnection.end();
}

main().then();
