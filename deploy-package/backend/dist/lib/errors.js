import fs from 'node:fs';
import path from 'node:path';
export class ApiError extends Error {
    status;
    code;
    details;
    constructor(status, code, message, details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
        this.name = 'ApiError';
    }
}
export function notFoundHandler(_req, res) {
    res.status(404).json({ success: false, error: 'Not found', code: 'NOT_FOUND' });
}
export function errorHandler(err, _req, res, _next) {
    if (err instanceof ApiError) {
        res.status(err.status).json({
            success: false,
            error: err.message,
            code: err.code,
            ...(err.details ? { details: err.details } : {}),
        });
        return;
    }
    console.error('[error]', err);
    try {
        const logFile = path.resolve(process.cwd(), 'logs/error.log');
        fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${String(err)}\n${err?.stack ?? ''}\n\n`);
    }
    catch {
        // ignore logging errors
    }
    res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL' });
}
