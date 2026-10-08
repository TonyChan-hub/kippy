"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.permission = void 0;
const nativeModule_1 = require("./nativeModule");
const errors_1 = require("./errors");
const MODULE_ID = 'permission';
async function assertLinked() {
    const linked = await (0, nativeModule_1.getNativeKitModule)().getLinkedModules();
    if (!linked.includes(MODULE_ID)) {
        throw (0, errors_1.moduleNotLinked)(MODULE_ID);
    }
}
async function asStatus(value) {
    return value;
}
exports.permission = {
    async check(kind) {
        await assertLinked();
        return asStatus(await (0, nativeModule_1.getNativeKitModule)().checkPermission(kind));
    },
    async request(kind) {
        await assertLinked();
        return asStatus(await (0, nativeModule_1.getNativeKitModule)().requestPermission(kind));
    },
    async ensure(kind) {
        const current = await exports.permission.check(kind);
        if (current === 'granted' ||
            current === 'limited' ||
            current === 'permanentlyDenied' ||
            current === 'restricted') {
            return current;
        }
        return exports.permission.request(kind);
    },
    async openSettings() {
        await assertLinked();
        await (0, nativeModule_1.getNativeKitModule)().openSettings();
    },
};
