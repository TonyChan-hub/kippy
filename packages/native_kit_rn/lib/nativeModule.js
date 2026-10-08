"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNativeKitModule = getNativeKitModule;
const react_native_1 = require("react-native");
const errors_1 = require("./errors");
const LINKING_ERROR = `NativeKit native module is not linked. ` +
    (react_native_1.Platform.OS === 'ios'
        ? 'Run pod install in the ios/ directory, then rebuild.'
        : 'Rebuild the Android app after installing @bear1210/native-kit-rn.');
function getNativeKitModule() {
    const mod = react_native_1.NativeModules.NativeKit;
    if (!mod) {
        throw new errors_1.NativeKitError('NATIVE_UNAVAILABLE', LINKING_ERROR);
    }
    return mod;
}
