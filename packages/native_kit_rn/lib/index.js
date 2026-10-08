"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NativeKit = exports.device = exports.permission = exports.NativeKitError = void 0;
const permission_1 = require("./permission");
Object.defineProperty(exports, "permission", { enumerable: true, get: function () { return permission_1.permission; } });
const device_1 = require("./device");
Object.defineProperty(exports, "device", { enumerable: true, get: function () { return device_1.device; } });
var errors_1 = require("./errors");
Object.defineProperty(exports, "NativeKitError", { enumerable: true, get: function () { return errors_1.NativeKitError; } });
exports.NativeKit = {
    permission: permission_1.permission,
    device: device_1.device,
};
exports.default = exports.NativeKit;
