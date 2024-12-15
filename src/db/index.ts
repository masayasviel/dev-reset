import 'dotenv/config';
import { drizzle } from 'drizzle-orm/mysql2';
import mysql, { type RowDataPacket } from 'mysql2/promise';
import * as R from 'remeda';

import { Table, getTableName } from 'drizzle-orm';
import * as Schema from './schema';

const QUERY = `SELECT
  TABLE_NAME AS table_name,
  REFERENCED_TABLE_NAME AS reference_table_name
FROM
  information_schema.KEY_COLUMN_USAGE`;

async function main(): Promise<void> {
  const poolConnection = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: Number(process.env.MYSQL_PORT),
  });

  const db = drizzle({ client: poolConnection });

  const tables_relation_map = new Map<string, Set<string>>(
    R.entries(Schema)
      .filter(([_, v]) => v instanceof Table)
      .map(([_, v]) => [getTableName(v), new Set<string>()]),
  );

  const [params, _fp] = await poolConnection.execute<RowDataPacket[]>(QUERY);
  const relations = params.filter((res) => res.reference_table_name !== null) as {
    table_name: string;
    reference_table_name: string;
  }[];

  // biome-ignore lint/style/useConst: <explanation>
  for (let r of relations) {
    const s = tables_relation_map.get(r.table_name);
    if (s) {
      s.add(r.reference_table_name);
      tables_relation_map.set(r.table_name, s);
    } else {
      throw Error('schemeに定義していないテーブルがある');
    }
  }

  console.log(tables_relation_map);

  await poolConnection.end();
}

main().then();
