export class NativeKitError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'NativeKitError';
    this.code = code;
  }
}

export function moduleNotLinked(moduleId: string): NativeKitError {
  return new NativeKitError(
    'MODULE_NOT_LINKED',
    `NativeKit module "${moduleId}" is not linked. Fix: npx @bear1210/native-kit add ${moduleId}`,
  );
}
