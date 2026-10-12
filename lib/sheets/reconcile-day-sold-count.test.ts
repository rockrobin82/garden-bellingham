import { expect, test } from "vitest";

import {
  DaySoldCountSyncError,
  reconcileDaySoldCount,
} from "@/lib/sheets/reconcile-day-sold-count";
import { DATES_COLUMNS } from "@/lib/sheets/schema";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

function daySheet(rows: string[][]): string[][] {
  return [[...DATES_COLUMNS], ...rows];
}

function dayRow(date: string, soldCount: string): string[] {
  return [date, "TRUE", "40", soldCount, "35", "25", "", "6"];
}

function unusedClient(): SupabaseClient<Database> {
  return {
    rpc: async () => {
      throw new Error("rpc should not run");
    },
  } as unknown as SupabaseClient<Database>;
}

test("an unexpected dates header does not write a sold count", async () => {
  let writes = 0;

  await expect(
    reconcileDaySoldCount("2099-01-01", {
      supabase: unusedClient(),
      readDateSheet: async () => [["date", "sold_count"]],
      writeSoldCount: async () => {
        writes += 1;
      },
    }),
  ).rejects.toMatchObject({ reason: "unexpected_header" });

  expect(writes).toBe(0);
});

test("a missing date row does not write a sold count", async () => {
  let writes = 0;

  await expect(
    reconcileDaySoldCount("2099-01-02", {
      supabase: unusedClient(),
      readDateSheet: async () => daySheet([dayRow("2099-01-03", "4")]),
      writeSoldCount: async () => {
        writes += 1;
      },
    }),
  ).rejects.toBeInstanceOf(DaySoldCountSyncError);

  expect(writes).toBe(0);
});

test("two rows for the same date do not write a sold count", async () => {
  let writes = 0;

  await expect(
    reconcileDaySoldCount("2099-01-04", {
      supabase: unusedClient(),
      readDateSheet: async () =>
        daySheet([dayRow("2099-01-04", "4"), dayRow("2099-01-04", "9")]),
      writeSoldCount: async () => {
        writes += 1;
      },
    }),
  ).rejects.toMatchObject({ reason: "duplicate_row" });

  expect(writes).toBe(0);
});
