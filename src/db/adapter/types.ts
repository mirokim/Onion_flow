/**
 * Shared context interface for adapter domain modules.
 * Each domain module receives a DbContext to execute queries
 * without coupling to the SQLiteStorageAdapter class internals.
 */
export interface DbContext {
  queryAll<T>(sql: string, params?: any[]): T[]
  queryOne<T>(sql: string, params?: any[]): T | null
  run(sql: string, params?: any[]): void
  ts(r: any): { createdAt: number; updatedAt: number }
  parseJsonArray<T>(raw: unknown, fallback?: T[]): T[]
}
