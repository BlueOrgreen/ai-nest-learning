"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllExceptionsFilter = void 0;
const common_1 = require("@nestjs/common");
let AllExceptionsFilter = class AllExceptionsFilter {
    logger = new common_1.Logger('Exception');
    friendlyMap = {
        400: '请求参数有误，请检查后重试',
        401: '请先登录，或 Token 已过期',
        403: '权限不足，无法访问该资源',
        404: '请求的资源不存在',
        429: '请求过于频繁，请稍后再试',
        500: '服务器内部错误，请稍后再试',
        502: '上游服务暂时不可用，请稍后再试',
        503: '服务暂时不可用，请稍后再试',
    };
    genericMessages = new Set([
        'Bad Request',
        'Unauthorized',
        'Forbidden',
        'Not Found',
        'Internal Server Error',
        'Conflict',
        'Unprocessable Entity',
    ]);
    extractHttpMessage(body) {
        if (typeof body === 'string') {
            return body;
        }
        if (typeof body === 'object' && body !== null) {
            const raw = body.message;
            if (Array.isArray(raw)) {
                const parts = raw.map((m) => String(m)).filter((m) => m.length > 0);
                return parts.length > 0 ? parts.join('; ') : null;
            }
            if (raw != null && String(raw).length > 0) {
                return String(raw);
            }
        }
        return null;
    }
    isQueryFailedError(exception) {
        return exception instanceof Error && exception.name === 'QueryFailedError';
    }
    mapQueryFailedMessage(exception) {
        const msg = exception.message;
        if (msg.includes("column 'reason'")) {
            return `reason 必须是 manual、order、batch_import、correction 之一，自定义说明请写在 remark`;
        }
        if (msg.includes('Data truncated')) {
            return '参数值不符合数据库字段要求，请检查枚举或字段长度';
        }
        return '数据写入失败，请检查请求参数';
    }
    resolveMessage(status, extracted) {
        if (extracted && !this.genericMessages.has(extracted)) {
            return extracted;
        }
        return this.friendlyMap[status] ?? extracted ?? this.friendlyMap[500];
    }
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const req = ctx.getRequest();
        const res = ctx.getResponse();
        let status = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        let message = this.friendlyMap[500];
        let extracted = null;
        if (exception instanceof common_1.HttpException) {
            status = exception.getStatus();
            extracted = this.extractHttpMessage(exception.getResponse());
            message = this.resolveMessage(status, extracted);
        }
        else if (this.isQueryFailedError(exception)) {
            status = common_1.HttpStatus.BAD_REQUEST;
            message = this.mapQueryFailedMessage(exception);
        }
        const requestId = req.headers['x-request-id'] ?? '-';
        const logMsg = `[${requestId}] ${req.method} ${req.originalUrl} → ${status} ${message}`;
        if (status >= 500) {
            this.logger.error(logMsg, exception instanceof Error ? exception.stack : String(exception));
        }
        else {
            this.logger.warn(logMsg);
        }
        res.status(status).json({ code: status, message, data: null });
    }
};
exports.AllExceptionsFilter = AllExceptionsFilter;
exports.AllExceptionsFilter = AllExceptionsFilter = __decorate([
    (0, common_1.Catch)()
], AllExceptionsFilter);
//# sourceMappingURL=all-exceptions.filter.js.map