export declare class NativeKitError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export declare function moduleNotLinked(moduleId: string): NativeKitError;
