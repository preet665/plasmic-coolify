import { stringToPair } from "@/wab/server/util/hash";
import * as Sentry from "@sentry/node";
import { parse as parseDbUri } from "pg-connection-string";
import {
  Connection,
  ConnectionOptions,
  createConnection,
  getConnection,
  getConnectionManager,
  getConnectionOptions,
} from "typeorm";

// Unused, just creating for the global side effect of having a connection
// pool.  Contrary to the name, this actually sets up a pool of connections
// that later getConnection() calls draw from.
// When --freshDb is specified, the default connection is created in
// prepareFreshDb and so we guard against trying to create it again (which
// causes an error).
export async function ensureDbConnection(
  dburi: string | ConnectionOptions,
  name: string,
  opts?: {
    maxConnections?: number;
    useEnvPassword?: boolean;
  }
) {
  const maxConnections = opts?.maxConnections ?? 15;
  const connMgr = getConnectionManager();

  if (connMgr.has(name)) {
    try {
      const conn = connMgr.get(name);
      if (conn.isConnected) {
        console.log(`Reusing typeorm connection pool for ${name}`);
        return conn;
      }
    } catch (error: unknown) {
      console.warn(error);
      Sentry.captureException(error);
    }
  }

  console.log(`Creating typeorm connection pool for ${name}`);
  let connOpts: ConnectionOptions;
  if (typeof dburi === "string") {
    const envPassword = process.env.WAB_DBPASSWORD;
    const parsedUri = parseDbUri(dburi);

    console.log('[DEBUG] Inside ensureDbConnection:');
    console.log(`[DEBUG]   name = ${name}`);
    console.log(`[DEBUG]   dburi type = ${typeof dburi}`);
    console.log(`[DEBUG]   dburi value = ${dburi}`);
    console.log(`[DEBUG]   opts?.useEnvPassword = ${opts?.useEnvPassword}`);
    console.log(`[DEBUG]   process.env.WAB_DBPASSWORD = ${process.env.WAB_DBPASSWORD}`);
    console.log(`[DEBUG]   envPassword variable = ${envPassword}`);

    connOpts = Object.assign(
      {},
      await getConnectionOptions(),
      {
        type: "postgres",
        extra: {
          // Set postgres pool size up from default of 10
          // https://node-postgres.com/api/pool
          max: maxConnections,
          simple_query_mode: process.env.PG_SIMPLE_QUERY_MODE === "true",
        },
      },
      // Use envPassword if it's set AND the original URI didn't contain a password.
      // This prevents overriding a password explicitly set in the URI.
      envPassword && !parsedUri.password
        ? {
            // We parse dbUri into its component options, instead of specifying
            // `url:`, because we can't use `url:` in combination with `password:`
            // Explicitly map parsed values to TypeORM properties
            host: parsedUri.host || undefined,
            port: parsedUri.port ? parseInt(parsedUri.port || "5432", 10) : undefined,
            username: parsedUri.user || undefined, // Map 'user' to 'username'
            database: parsedUri.database || undefined,
            password: envPassword,
          }
        : {
            url: dburi,
          }
    );
  } else {
    connOpts = dburi;
  }

  console.log('[DEBUG] Attempting database connection with options:');
  const pgOpts = connOpts as any; // Cast to access properties, assuming postgres
  console.log(`[DEBUG]   Host: ${pgOpts.host ?? (pgOpts.url ? 'from URL' : 'undefined')}`);
  console.log(`[DEBUG]   Port: ${pgOpts.port ?? (pgOpts.url ? 'from URL' : 'undefined')}`);
  console.log(`[DEBUG]   Username: ${pgOpts.username ?? (pgOpts.url ? 'from URL' : 'undefined')}`);
  console.log(`[DEBUG]   Database: ${pgOpts.database ?? (pgOpts.url ? 'from URL' : 'undefined')}`);
  console.log(`[DEBUG]   Password Set: ${!!pgOpts.password || !!pgOpts.url}`);

  console.log('[DEBUG] Final connOpts before createConnection:', JSON.stringify(connOpts, null, 2));

  return await createConnection({
    ...connOpts,
    name,

    // uncomment this to log all SQL queries
    // logging: true
  });
}

export const MIGRATION_POOL_NAME = "migration-pool";

export async function getMigrationConnection() {
  // Should only call this after ensureDbConnections() have been called
  return _getConnection(MIGRATION_POOL_NAME);
}

export async function getDefaultConnection() {
  return _getConnection();
}

async function _getConnection(name?: string) {
  const conn = getConnection(name);
  if (!conn.isConnected) {
    await conn.connect();
  }
  return conn;
}

export async function ensureDbConnections(
  dbUri: string | ConnectionOptions,
  opts?: {
    defaultPoolSize?: number;
    migrationPoolSize?: number;
    useEnvPassword?: boolean;
  }
) {
  await ensureDbConnection(dbUri, "default", {
    maxConnections: opts?.defaultPoolSize ?? 15,
    useEnvPassword: opts?.useEnvPassword,
  });
  await ensureDbConnection(dbUri, MIGRATION_POOL_NAME, {
    maxConnections: opts?.migrationPoolSize ?? 10,
    useEnvPassword: opts?.useEnvPassword,
  });
}

async function withAdvisoryLock(
  conn: Connection,
  callback: () => Promise<void>
): Promise<void> {
  const lockName = stringToPair("migration-lock");
  try {
    // wait to acquire lock
    await conn.manager.query(
      `SELECT pg_advisory_lock(${lockName[0]}, ${lockName[1]})`
    );

    // execute our code inside the lock
    await callback();
  } finally {
    // unlock the acquired lock
    const [{ pg_advisory_unlock: wasLocked }]: [
      { pg_advisory_unlock: boolean }
    ] = await conn.manager.query(
      `SELECT pg_advisory_unlock(${lockName[0]}, ${lockName[1]})`
    );

    if (!wasLocked) {
      console.warn(
        `Advisory lock was not locked: ${lockName[0]}, ${lockName[1]}`
      );
    }
  }
}

export async function maybeMigrateDatabase() {
  const conn = await getDefaultConnection();
  await withAdvisoryLock(conn, async () => {
    const migrations = await conn.runMigrations({ transaction: "all" });
    if (migrations.length > 0) {
      console.log(
        `Successfully ran ${migrations.length} migrations`,
        migrations
      );
    }
  });
}

async function closeConnection(name?: string) {
  console.log(`Closing typeorm connection pool for ${name}`);
  const conn = getConnection(name);
  await conn.close();
}

export async function closeDbConnections() {
  await closeConnection("default");
  await closeConnection(MIGRATION_POOL_NAME);
}
