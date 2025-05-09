    // platform/wab/ormconfig.js
    module.exports = {
      type: "postgres",
      // Use DATABASE_URL from environment if available, otherwise fallback (or error)
      url: process.env.DATABASE_URL,
      // Or use individual components if DATABASE_URL isn't set
      // host: process.env.POSTGRES_HOST || "localhost",
      // port: process.env.POSTGRES_PORT || 5432,
      // username: process.env.POSTGRES_USER || "wab",
      // password: process.env.POSTGRES_PASSWORD, // Important: Let env provide this
      // database: process.env.POSTGRES_DATABASE || "wab",

      synchronize: false,
      dropSchema: false,
      logging: ["error", "warn", "migration"], // Enable more logging for migrations
      entities: ["src/wab/server/entities/**/*.ts"],
      migrations: ["src/wab/server/migrations/**/*.ts"],
      subscribers: ["src/wab/server/subscribers/**/*.ts"],
      cli: {
        entitiesDir: "src/wab/server/entities",
        migrationsDir: "src/wab/server/migrations",
        subscribersDir: "src/wab/server/subscribers",
      },
      // Add SSL options if needed for your database connection
      // ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    };
