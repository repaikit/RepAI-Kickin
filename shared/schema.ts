import { pgTable, text, serial, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  position: text("position").notNull(),
  avatar: text("avatar").notNull(),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  trend: text("trend").notNull().default("stable"),
  trendValue: text("trend_value").notNull().default("0%"),
});

export const skills = pgTable("skills", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => players.id),
  reflexes: integer("reflexes").notNull(),
  positioning: integer("positioning").notNull(),
  oneOnOnes: integer("one_on_ones").notNull(),
  commandOfArea: integer("command_of_area").notNull(),
  distribution: integer("distribution").notNull(),
  handling: integer("handling").notNull(),
});

export const challenges = pgTable("challenges", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  image: text("image").notNull(),
  status: text("status").notNull(), // "ongoing", "days_left"
  statusValue: text("status_value"),
  participants: integer("participants").notNull(),
  location: text("location").notNull(),
  prize: text("prize").notNull(),
  theme: text("theme").notNull().default("primary"), // primary, secondary, accent
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertPlayerSchema = createInsertSchema(players).omit({
  id: true,
});

export const insertSkillsSchema = createInsertSchema(skills).omit({
  id: true,
});

export const insertChallengeSchema = createInsertSchema(challenges).omit({
  id: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof players.$inferSelect;

export type InsertSkills = z.infer<typeof insertSkillsSchema>;
export type Skills = typeof skills.$inferSelect;

export type InsertChallenge = z.infer<typeof insertChallengeSchema>;
export type Challenge = typeof challenges.$inferSelect;
