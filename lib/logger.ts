export type LogLevel = "info" | "warn" | "error" | "debug";

export const logger = {
    info: (message: string, context?: any) => log("info", message, context),
    warn: (message: string, context?: any) => log("warn", message, context),
    error: (message: string, error?: Error, context?: any) =>
        log("error", message, { ...context, stackTrace: error?.stack }),
    debug: (message: string, context?: any) => {
        if (process.env.NODE_ENV !== "production") {
            log("debug", message, context);
        }
    },
};

function log(level: LogLevel, message: string, context?: any) {
    const entry = {
        timestamp: new Date().toISOString(),
        level,
        service: "HR-System",
        message,
        context,
    };

    const output = JSON.stringify(entry);

    if (process.env.NODE_ENV === "production") {
        // Send to Sentry/DataDog/CloudWatch
        console.log(output);
    } else {
        console.log(`[${level.toUpperCase()}] ${message}`, context);
    }
}