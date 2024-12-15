import { boolean, int, mysqlTable, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/mysql-core';

export const User = mysqlTable('user', {
  id: int('id').autoincrement().primaryKey(),
  createdAt: timestamp('created_at', { mode: 'string' }).notNull().defaultNow(),
  name: varchar('name', { length: 256 }).notNull(),
  code: varchar('code', { length: 256 }).notNull().unique('uniq_code'),
});

export const Tag = mysqlTable('tag', {
  id: int('id').autoincrement().primaryKey(),
  createdAt: timestamp('created_at', { mode: 'string' }).notNull().defaultNow(),
  createdBy: int('created_by')
    .notNull()
    .references(() => User.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 256 }).notNull().unique('uniq_name'),
  isOfficial: boolean('is_official').notNull().default(false),
});

export const UserTagRelation = mysqlTable(
  'user_tag_relation',
  {
    id: int('id').autoincrement().primaryKey(),
    createdAt: timestamp('created_at', { mode: 'string' }).notNull().defaultNow(),
    userId: int('user_id')
      .notNull()
      .references(() => User.id, { onDelete: 'cascade' }),
    tagId: int('tag_id')
      .notNull()
      .references(() => Tag.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    uniqUserAndTag: uniqueIndex('user_and_tag_uniq').on(table.userId, table.tagId),
  }),
);

export const Article = mysqlTable(
  'article',
  {
    id: int('id').autoincrement().primaryKey(),
    createdAt: timestamp('created_at', { mode: 'string' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { mode: 'string' })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date().toISOString()),
    title: varchar('title', { length: 256 }).notNull(),
    articlePath: text('article_path').notNull(),
    userId: int('user_id')
      .notNull()
      .references(() => User.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    uniqUserAndArticleTitle: uniqueIndex('article_title_and_user_uniq').on(table.userId, table.title),
  }),
);

export const ArticleTagRelation = mysqlTable(
  'article_tag_relation',
  {
    id: int('id').autoincrement().primaryKey(),
    createdAt: timestamp('created_at', { mode: 'string' }).notNull().defaultNow(),
    articleId: int('article_id')
      .notNull()
      .references(() => Article.id, { onDelete: 'cascade' }),
    tagId: int('tag_id')
      .notNull()
      .references(() => Tag.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    uniqArticleAndTag: uniqueIndex('article_and_tag_uniq').on(table.articleId, table.tagId),
  }),
);
