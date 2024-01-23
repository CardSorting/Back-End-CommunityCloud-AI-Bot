const db = require('better-sqlite3')('jobs.db');
const logger = require('../pino/logger');

class DatabaseHelper {
    static initializeDB() {
        try {
            const tableSchema = `
            CREATE TABLE IF NOT EXISTS job_parameters (
                userId TEXT PRIMARY KEY,
                prompt TEXT,
                modelType TEXT,
                seed INTEGER,
                imageUrl TEXT
            )`;
            db.exec(tableSchema);
        } catch (error) {
            logger.error(`Failed to setup database: ${error.message}`, error);
            throw new Error('Failed to initialize database.');
        }
    }

    static storeJobParameters(data) {
        try {
            // Check for missing properties
            const requiredProps = ['userId', 'prompt', 'modelType', 'seed'];
            const missingProps = requiredProps.filter(prop => data[prop] === undefined);

            if (missingProps.length) {
                logger.error(`Missing data properties: ${missingProps.join(', ')}`);
                throw new Error(`Missing data properties: ${missingProps.join(', ')}`);
            }

            // Logging the data for debugging
            logger.info(`Storing job parameters: ${JSON.stringify(data)}`);

            const stmt = db.prepare('INSERT OR REPLACE INTO job_parameters (userId, prompt, modelType, seed) VALUES (?, ?, ?, ?)');
            stmt.run(data.userId, data.prompt, data.modelType, data.seed);
        } catch (dbError) {
            logger.error('Failed to store job parameters into the database.', dbError);
            throw dbError;
        }
    }

    static storeProcessedJob(data) {
        try {
            // Check for required properties
            const requiredProps = ['userId', 'prompt', 'modelType', 'seed', 'imageUrl'];
            const missingProps = requiredProps.filter(prop => data[prop] === undefined);

            if (missingProps.length) {
                logger.error(`Missing processed job properties: ${missingProps.join(', ')}`);
                throw new Error(`Missing processed job properties: ${missingProps.join(', ')}`);
            }

            // Logging the data for debugging
            logger.info(`Storing processed job data: ${JSON.stringify(data)}`);

            const stmt = db.prepare('INSERT OR REPLACE INTO job_parameters (userId, prompt, modelType, seed, imageUrl) VALUES (?, ?, ?, ?, ?)');
            stmt.run(data.userId, data.prompt, data.modelType, data.seed, data.imageUrl);
        } catch (dbError) {
            logger.error('Failed to store processed job into the database.', dbError);
            throw dbError;
        }
    }

    static retrieveJobParameters(userId) {
        try {
            const stmt = db.prepare('SELECT * FROM job_parameters WHERE userId = ?');
            const result = stmt.get(userId);
            return result;
        } catch (error) {
            logger.error(`Failed to retrieve job parameters for userId: ${userId}`, error);
            throw new Error('Database retrieval failure');
        }
    }
}

module.exports = DatabaseHelper;