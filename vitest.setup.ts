import { expect } from "vitest";
import * as matchers from "vitest-axe/matchers";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "vitest-axe/extend-expect";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://placeholder.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "placeholder_anon_key";

expect.extend(matchers);

afterEach(() => {
  cleanup();
});
