// In this file you can configure migrate-mongo

const dotenv = require('dotenv');
dotenv.config();

const config = {
  mongodb: {
    url: process.env.MONGO_URI, // Ensure this matches the .env file
    databaseName: "csprac",
    options: {
      // No deprecated options
    },
  },
  migrationsDir: "migrations",
  changelogCollectionName: "changelog",
  migrationFileExtension: ".js",
  useFileHash: false,
  moduleSystem: 'commonjs',
};

module.exports = config;
