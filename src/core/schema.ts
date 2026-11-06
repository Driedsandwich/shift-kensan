import { z } from "zod";
import { minimumWages } from "../data/minimum-wages";
export const kinds = [
  "勤務",
  "授業",
  "準備",
  "報告書",
  "研修",
  "片付け",
  "休憩",
] as const;
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      !Number.isNaN(Date.parse(s)) &&
      new Date(s).toISOString().slice(0, 10) === s,
    "実在する日付を入力してください",
  );
export const timeSchema = z
  .string()
  .regex(/^(?:[01]\d|2[0-9]|3\d|4[0-7]):[0-5]\d$/);
export const blockSchema = z
  .object({
    kind: z.enum(kinds),
    start: timeSchema.nullable(),
    end: timeSchema.nullable(),
    instructed: z.enum(["yes", "no", "unknown"]),
    relative: z
      .object({
        edge: z.enum(["before", "after"]),
        minutes: z.number().int().min(1).max(480),
      })
      .strict()
      .optional(),
  })
  .strict();
export const shiftSchema = z
  .object({
    date: dateSchema.nullable(),
    blocks: z.array(blockSchema).max(20),
    classes: z.number().int().min(0).max(30).nullable(),
    paid: z.number().min(0).max(10000000).nullable(),
    evidence: z.string().max(1500),
    uncertain: z.array(z.string().max(200)).max(10),
  })
  .strict();
export const sheetSchema = z
  .object({
    prefecture: z
      .string()
      .refine((s) => minimumWages.some((r) => r.prefecture === s)),
    payType: z.enum(["hourly", "class"]),
    rate: z.number().positive().max(100000).nullable(),
    classMinutes: z.number().int().min(1).max(480).nullable(),
    shifts: z.array(shiftSchema).max(62),
    monthlyPaid: z
      .array(
        z
          .object({
            month: z.string().regex(/^2026-(?:0[1-9]|1[0-2])$/),
            amount: z.number().min(0).max(10000000),
          })
          .strict(),
      )
      .max(9),
    questions: z.array(z.string().max(200)).max(3),
    messageTemplate: z.string().max(1500),
  })
  .strict();
export type Sheet = z.infer<typeof sheetSchema>;
export type Shift = z.infer<typeof shiftSchema>;
export type Block = z.infer<typeof blockSchema>;
export const settingsSchema = z
  .object({
    weekStart: z.number().int().min(0).max(6),
    rounding: z.enum(["ceil", "round", "exact"]),
    includeUnknown: z.boolean(),
    classBasis: z.enum(["floor", "lesson"]),
    holidayDates: z.array(dateSchema).max(100),
    completePeriod: z.boolean(),
  })
  .strict();
export type Settings = z.infer<typeof settingsSchema>;
export const defaultSettings: Settings = {
  weekStart: 0,
  rounding: "ceil",
  includeUnknown: true,
  classBasis: "floor",
  holidayDates: [],
  completePeriod: false,
};
export const requestSchema = z
  .object({
    text: z.string().max(12000),
    images: z
      .array(
        z
          .string()
          .max(1800000)
          .regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/),
      )
      .max(3),
    prefecture: z
      .string()
      .refine((s) => minimumWages.some((r) => r.prefecture === s)),
    payType: z.enum(["hourly", "class"]),
    referenceDate: dateSchema,
    sampleId: z.enum(["class", "night", "clear"]).optional(),
    forceMock: z.boolean().optional(),
  })
  .strict()
  .refine(
    (v) => v.text.trim() || v.images.length || v.sampleId,
    "文か画像を入力してください",
  )
  .refine(
    (v) => v.images.reduce((a, b) => a + b.length, 0) < 3200000,
    "画像の合計が大きすぎます",
  );
export type ExtractionInput = z.infer<typeof requestSchema>;
export function blankSheet(
  prefecture = "東京都",
  payType: Sheet["payType"] = "hourly",
): Sheet {
  return {
    prefecture,
    payType,
    rate: null,
    classMinutes: null,
    shifts: [],
    monthlyPaid: [],
    questions: [],
    messageTemplate: "",
  };
}
export function blankShift(date: string | null = null): Shift {
  return {
    date,
    blocks: [{ kind: "勤務", start: null, end: null, instructed: "yes" }],
    classes: null,
    paid: null,
    evidence: "本人が入力",
    uncertain: [],
  };
}
