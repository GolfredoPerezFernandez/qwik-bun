
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';
import { tursoClient } from '~/utils/turso';
import { RequestEventBase } from '@builder.io/qwik-city';

export function createDB(requestEvent: RequestEventBase) {
  const client = tursoClient(requestEvent);
  return drizzle(client, { schema });
}