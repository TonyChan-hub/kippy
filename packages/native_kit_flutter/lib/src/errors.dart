class NativeKitException implements Exception {
  NativeKitException(this.code, this.message);

  final String code;
  final String message;

  @override
  String toString() => 'NativeKitException($code): $message';
}

NativeKitException moduleNotLinked(String moduleId) {
  return NativeKitException(
    'MODULE_NOT_LINKED',
    'NativeKit module "$moduleId" is not linked. Fix: npx @bear1210/native-kit add $moduleId',
  );
}
