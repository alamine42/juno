import { pgTable, uuid, text, jsonb, integer, boolean, timestamp, foreignKey, unique } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const contentFrameworks = pgTable("content_frameworks", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	description: text(),
	outputType: text("output_type"),
	questions: jsonb().notNull(),
	promptTemplate: text("prompt_template").notNull(),
	displayOrder: integer("display_order").default(0),
	active: boolean().default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const contentBatches = pgTable("content_batches", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	coachId: uuid("coach_id").notNull(),
	focusTopic: text("focus_topic"),
	postingDays: text("posting_days").array(),
	hasPromotion: boolean("has_promotion").default(false),
	promotionText: text("promotion_text"),
	status: text().default('generating'),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	completedAt: timestamp("completed_at", { mode: 'string' }),
}, (table) => [
	foreignKey({
			columns: [table.coachId],
			foreignColumns: [coaches.id],
			name: "content_batches_coach_id_coaches_id_fk"
		}).onDelete("cascade"),
]);

export const frameworkUsage = pgTable("framework_usage", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	coachId: uuid("coach_id").notNull(),
	frameworkId: uuid("framework_id").notNull(),
	contentId: uuid("content_id"),
	answers: jsonb(),
	completed: boolean().default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.coachId],
			foreignColumns: [coaches.id],
			name: "framework_usage_coach_id_coaches_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.frameworkId],
			foreignColumns: [contentFrameworks.id],
			name: "framework_usage_framework_id_content_frameworks_id_fk"
		}),
	foreignKey({
			columns: [table.contentId],
			foreignColumns: [content.id],
			name: "framework_usage_content_id_content_id_fk"
		}),
]);

export const systemHealth = pgTable("system_health", {
	key: text().primaryKey().notNull(),
	value: jsonb().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
});

export const coaches = pgTable("coaches", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	clerkId: text("clerk_id").notNull(),
	email: text().notNull(),
	name: text(),
	timezone: text().default('UTC'),
	isAdmin: boolean("is_admin").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("coaches_clerk_id_unique").on(table.clerkId),
]);

export const brandProfiles = pgTable("brand_profiles", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	coachId: uuid("coach_id").notNull(),
	styleWords: text("style_words"),
	tone: text(),
	emojiUsage: text("emoji_usage"),
	signOff: text("sign_off"),
	avoidedTopics: text("avoided_topics").array(),
	avoidedWords: text("avoided_words").array(),
	preferredWords: text("preferred_words").array(),
	targetAudience: text("target_audience"),
	examplePosts: text("example_posts").array(),
	completedAt: timestamp("completed_at", { mode: 'string' }),
	skippedCount: integer("skipped_count").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.coachId],
			foreignColumns: [coaches.id],
			name: "brand_profiles_coach_id_coaches_id_fk"
		}).onDelete("cascade"),
	unique("brand_profiles_coach_id_unique").on(table.coachId),
]);

export const chatMessages = pgTable("chat_messages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	coachId: uuid("coach_id").notNull(),
	role: text().notNull(),
	content: text().notNull(),
	contentId: uuid("content_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.coachId],
			foreignColumns: [coaches.id],
			name: "chat_messages_coach_id_coaches_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.contentId],
			foreignColumns: [content.id],
			name: "chat_messages_content_id_content_id_fk"
		}),
]);

export const content = pgTable("content", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	coachId: uuid("coach_id").notNull(),
	type: text().notNull(),
	status: text().default('draft'),
	body: text().notNull(),
	frameworkId: uuid("framework_id"),
	frameworkAnswers: jsonb("framework_answers"),
	batchId: uuid("batch_id"),
	batchPosition: integer("batch_position"),
	reminderAt: timestamp("reminder_at", { mode: 'string' }),
	reminderSentAt: timestamp("reminder_sent_at", { mode: 'string' }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.coachId],
			foreignColumns: [coaches.id],
			name: "content_coach_id_coaches_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.frameworkId],
			foreignColumns: [contentFrameworks.id],
			name: "content_framework_id_content_frameworks_id_fk"
		}),
	foreignKey({
			columns: [table.batchId],
			foreignColumns: [contentBatches.id],
			name: "content_batch_id_content_batches_id_fk"
		}),
]);
