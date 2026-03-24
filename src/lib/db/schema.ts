import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// Coaches table - stores user info
export const coaches = pgTable('coaches', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkId: text('clerk_id').notNull().unique(),
  email: text('email').notNull(),
  name: text('name'),
  timezone: text('timezone').default('UTC'),
  isAdmin: boolean('is_admin').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const coachesRelations = relations(coaches, ({ one, many }) => ({
  brandProfile: one(brandProfiles, {
    fields: [coaches.id],
    references: [brandProfiles.coachId],
  }),
  content: many(content),
  chatMessages: many(chatMessages),
  contentBatches: many(contentBatches),
  frameworkUsage: many(frameworkUsage),
}))

// Brand profiles table - stores user preferences for content generation
export const brandProfiles = pgTable('brand_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  coachId: uuid('coach_id')
    .notNull()
    .unique()
    .references(() => coaches.id, { onDelete: 'cascade' }),
  styleWords: text('style_words'),
  tone: text('tone'),
  emojiUsage: text('emoji_usage'),
  signOff: text('sign_off'),
  avoidedTopics: text('avoided_topics').array(),
  avoidedWords: text('avoided_words').array(),
  preferredWords: text('preferred_words').array(),
  targetAudience: text('target_audience'),
  examplePosts: text('example_posts').array(),
  completedAt: timestamp('completed_at'),
  skippedCount: integer('skipped_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const brandProfilesRelations = relations(brandProfiles, ({ one }) => ({
  coach: one(coaches, {
    fields: [brandProfiles.coachId],
    references: [coaches.id],
  }),
}))

// Content frameworks table - templates for content generation
export const contentFrameworks = pgTable('content_frameworks', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  outputType: text('output_type'),
  questions: jsonb('questions').notNull(),
  promptTemplate: text('prompt_template').notNull(),
  displayOrder: integer('display_order').default(0),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
})

export const contentFrameworksRelations = relations(
  contentFrameworks,
  ({ many }) => ({
    content: many(content),
    frameworkUsage: many(frameworkUsage),
  })
)

// Content batches table - batch generation records
export const contentBatches = pgTable('content_batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  coachId: uuid('coach_id')
    .notNull()
    .references(() => coaches.id, { onDelete: 'cascade' }),
  focusTopic: text('focus_topic'),
  postingDays: text('posting_days').array(),
  hasPromotion: boolean('has_promotion').default(false),
  promotionText: text('promotion_text'),
  status: text('status').default('generating'),
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
})

export const contentBatchesRelations = relations(
  contentBatches,
  ({ one, many }) => ({
    coach: one(coaches, {
      fields: [contentBatches.coachId],
      references: [coaches.id],
    }),
    content: many(content),
  })
)

// Content table - generated content pieces
export const content = pgTable('content', {
  id: uuid('id').primaryKey().defaultRandom(),
  coachId: uuid('coach_id')
    .notNull()
    .references(() => coaches.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'caption' or 'carousel_script'
  status: text('status').default('draft'), // 'draft', 'reminder_set', 'posted'
  body: text('body').notNull(),
  frameworkId: uuid('framework_id').references(() => contentFrameworks.id),
  frameworkAnswers: jsonb('framework_answers'),
  batchId: uuid('batch_id').references(() => contentBatches.id),
  batchPosition: integer('batch_position'),
  reminderAt: timestamp('reminder_at'),
  reminderSentAt: timestamp('reminder_sent_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const contentRelations = relations(content, ({ one, many }) => ({
  coach: one(coaches, {
    fields: [content.coachId],
    references: [coaches.id],
  }),
  framework: one(contentFrameworks, {
    fields: [content.frameworkId],
    references: [contentFrameworks.id],
  }),
  batch: one(contentBatches, {
    fields: [content.batchId],
    references: [contentBatches.id],
  }),
  chatMessages: many(chatMessages),
}))

// Chat messages table - conversation history
export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  coachId: uuid('coach_id')
    .notNull()
    .references(() => coaches.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'user' or 'assistant'
  content: text('content').notNull(),
  contentId: uuid('content_id').references(() => content.id),
  createdAt: timestamp('created_at').defaultNow(),
})

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  coach: one(coaches, {
    fields: [chatMessages.coachId],
    references: [coaches.id],
  }),
  relatedContent: one(content, {
    fields: [chatMessages.contentId],
    references: [content.id],
  }),
}))

// Framework usage table - tracks user interactions with frameworks
export const frameworkUsage = pgTable('framework_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  coachId: uuid('coach_id')
    .notNull()
    .references(() => coaches.id, { onDelete: 'cascade' }),
  frameworkId: uuid('framework_id')
    .notNull()
    .references(() => contentFrameworks.id),
  contentId: uuid('content_id').references(() => content.id),
  answers: jsonb('answers'),
  completed: boolean('completed').default(false),
  createdAt: timestamp('created_at').defaultNow(),
})

export const frameworkUsageRelations = relations(frameworkUsage, ({ one }) => ({
  coach: one(coaches, {
    fields: [frameworkUsage.coachId],
    references: [coaches.id],
  }),
  framework: one(contentFrameworks, {
    fields: [frameworkUsage.frameworkId],
    references: [contentFrameworks.id],
  }),
  content: one(content, {
    fields: [frameworkUsage.contentId],
    references: [content.id],
  }),
}))

// System health table - monitoring
export const systemHealth = pgTable('system_health', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// Export types inferred from schema
export type Coach = typeof coaches.$inferSelect
export type NewCoach = typeof coaches.$inferInsert
export type BrandProfile = typeof brandProfiles.$inferSelect
export type NewBrandProfile = typeof brandProfiles.$inferInsert
export type ContentFramework = typeof contentFrameworks.$inferSelect
export type ContentBatch = typeof contentBatches.$inferSelect
export type NewContentBatch = typeof contentBatches.$inferInsert
export type Content = typeof content.$inferSelect
export type NewContent = typeof content.$inferInsert
export type ChatMessage = typeof chatMessages.$inferSelect
export type NewChatMessage = typeof chatMessages.$inferInsert
export type FrameworkUsage = typeof frameworkUsage.$inferSelect
export type SystemHealth = typeof systemHealth.$inferSelect
