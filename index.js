const logger = require('./pino/logger');
const ImageProcessor = require('./utils/ImageProcessor');
const queueHandler = require('./utils/LavinMQWorkerQueueHandler');
const DatabaseHelper = require('./utils/DatabaseHelper');
const ModelData = require('./utils/ModelData');

class Worker {
    constructor() {
        this.validateDependencies();
        DatabaseHelper.initializeDB();
        this.setupLavinMQ();
    }

    validateDependencies() {
        const dependencies = [logger, ImageProcessor, queueHandler, DatabaseHelper];
        const missingDependencies = dependencies.filter(dep => !dep);

        if (missingDependencies.length) {
            logger.error(`Missing dependencies: ${missingDependencies.join(', ')}`);
            this.gracefulShutdown(1);
        }
    }

    setupLavinMQ() {
        try {
            queueHandler.consumeImageGenerationTasks(this.handleTaskExecution.bind(this));
        } catch (error) {
            logger.error(`Failed to setup LavinMQ: ${error.message}`);
            this.gracefulShutdown(1);
        }
    }

    handleTaskExecution(msg) {
        try {
            if (this.isValidMessage(msg)) {
                const jobData = this.parseAndStoreMessage(msg);
                this.processImageAndSendResult(jobData);
            }
        } catch (error) {
            logger.error(`Error in task execution: ${error.message}`);
        }
    }

    isValidMessage(msg) {
        if (!msg || !msg.content) {
            logger.warn("Invalid message format from the queue.");
            return false;
        }
        return true;
    }

    parseAndStoreMessage(msg) {
        const jobData = JSON.parse(msg.content.toString());
        DatabaseHelper.storeJobParameters(jobData);
        return jobData;
    }

    async processImageAndSendResult(jobData) {
        try {
            const result = await this.processImage(jobData);
            queueHandler.sendJobResult(result);
        } catch (error) {
            logger.error(`Image processing error for user: ${jobData?.userId || 'Unknown'}: ${error.message}`);
        }
    }

    async processImage(jobData) {
        // Validations
        const { userId, prompt, modelType, seed } = jobData;

        if (!this.areValidJobParameters(userId, prompt, modelType, seed)) {
            throw new Error('Invalid job parameters.');
        }

        if (!ModelData.isValidModelType(modelType)) {
            throw new Error(`Invalid model type received: ${modelType}`);
        }

        // Processing
        const imageProcessor = new ImageProcessor(userId, prompt, modelType, seed);
        const outputUrl = await imageProcessor.run();  // Changed to outputUrl

        const fullData = {
            ...jobData,
            outputUrl,  // Changed to outputUrl
            ...(await DatabaseHelper.retrieveJobParameters(userId))
        };

        await DatabaseHelper.storeProcessedJob(fullData);
        
        return { userId, outputUrl };  // Changed to outputUrl
    }

    areValidJobParameters(userId, prompt, modelType, seed) {
        return userId && prompt && modelType && typeof seed === 'number';
    }

    async retrieveJobParameters(userId) {
        return await DatabaseHelper.retrieveJobParameters(userId);
    }

    gracefulShutdown(exitCode = 0) {
        logger.info('Initiating graceful shutdown...');
        process.exit(exitCode);
    }
}

let workerInstance;

async function initializeWorker() {
    try {
        await queueHandler.initialize();
        workerInstance = new Worker();
    } catch (error) {
        logger.error(`Failed to initialize worker: ${error.message}`);
        process.exit(1);
    }
}

// Handlers for process signals
function handleUnhandledRejection(reason) {
    logger.error(`Unhandled promise rejection: ${reason}`);
    process.exit(1);
}

function handleSigterm() {
    logger.info('Received SIGTERM. Shutting down gracefully.');
    workerInstance?.gracefulShutdown();
}

// Process event listeners
process.on('unhandledRejection', handleUnhandledRejection);
process.on("SIGTERM", handleSigterm);

// Initialize the worker
initializeWorker();
