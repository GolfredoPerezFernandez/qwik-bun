import type { Config } from "drizzle-kit";

export default {
  schema: './src/db/schema.ts',
  dialect: 'turso',  // dialect correcto para Turso
  dbCredentials: {
    url: process.env.PRIVATE_TURSO_DATABASE_URL!,
    authToken: process.env.PRIVATE_TURSO_AUTH_TOKEN
  },
  out: "./drizzle/migrations/",
} satisfies Config;
