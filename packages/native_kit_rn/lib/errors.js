"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NativeKitError = void 0;
exports.moduleNotLinked = moduleNotLinked;
class NativeKitError extends Error {
    constructor(code, message) {
        super(message);
        this.name = 'NativeKitError';
        this.code = code;
    }
}
exports.NativeKitError = NativeKitError;
function moduleNotLinked(moduleId) {
    return new NativeKitError('MODULE_NOT_LINKED', `NativeKit module "${moduleId}" is not linked. Fix: npx @bear1210/native-kit add ${moduleId}`);
}
