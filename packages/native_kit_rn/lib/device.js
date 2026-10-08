"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.device = void 0;
const nativeModule_1 = require("./nativeModule");
const errors_1 = require("./errors");
const MODULE_ID = 'device';
async function assertLinked() {
    const linked = await (0, nativeModule_1.getNativeKitModule)().getLinkedModules();
    if (!linked.includes(MODULE_ID)) {
        throw (0, errors_1.moduleNotLinked)(MODULE_ID);
    }
}
exports.device = {
    async getInfo() {
        await assertLinked();
        return (0, nativeModule_1.getNativeKitModule)().getDeviceInfo();
    },
};
