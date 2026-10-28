import type { Database } from "./database.types.js";
import type { PlatformFunctions } from "./platform-functions.types.js";
import type { PlatformTables } from "./platform-tables.types.js";

export type PlatformDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables" | "Functions"> & {
    Functions: PlatformFunctions;
    Tables: PlatformTables;
  };
};
