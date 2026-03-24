import { relations } from "drizzle-orm/relations";
import { coaches, contentBatches, frameworkUsage, contentFrameworks, content, brandProfiles, chatMessages } from "./schema";

export const contentBatchesRelations = relations(contentBatches, ({one, many}) => ({
	coach: one(coaches, {
		fields: [contentBatches.coachId],
		references: [coaches.id]
	}),
	contents: many(content),
}));

export const coachesRelations = relations(coaches, ({many}) => ({
	contentBatches: many(contentBatches),
	frameworkUsages: many(frameworkUsage),
	brandProfiles: many(brandProfiles),
	chatMessages: many(chatMessages),
	contents: many(content),
}));

export const frameworkUsageRelations = relations(frameworkUsage, ({one}) => ({
	coach: one(coaches, {
		fields: [frameworkUsage.coachId],
		references: [coaches.id]
	}),
	contentFramework: one(contentFrameworks, {
		fields: [frameworkUsage.frameworkId],
		references: [contentFrameworks.id]
	}),
	content: one(content, {
		fields: [frameworkUsage.contentId],
		references: [content.id]
	}),
}));

export const contentFrameworksRelations = relations(contentFrameworks, ({many}) => ({
	frameworkUsages: many(frameworkUsage),
	contents: many(content),
}));

export const contentRelations = relations(content, ({one, many}) => ({
	frameworkUsages: many(frameworkUsage),
	chatMessages: many(chatMessages),
	coach: one(coaches, {
		fields: [content.coachId],
		references: [coaches.id]
	}),
	contentFramework: one(contentFrameworks, {
		fields: [content.frameworkId],
		references: [contentFrameworks.id]
	}),
	contentBatch: one(contentBatches, {
		fields: [content.batchId],
		references: [contentBatches.id]
	}),
}));

export const brandProfilesRelations = relations(brandProfiles, ({one}) => ({
	coach: one(coaches, {
		fields: [brandProfiles.coachId],
		references: [coaches.id]
	}),
}));

export const chatMessagesRelations = relations(chatMessages, ({one}) => ({
	coach: one(coaches, {
		fields: [chatMessages.coachId],
		references: [coaches.id]
	}),
	content: one(content, {
		fields: [chatMessages.contentId],
		references: [content.id]
	}),
}));