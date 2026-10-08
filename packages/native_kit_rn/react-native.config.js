module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: './android',
        packageImportPath: 'import com.bear1210.nativekit.NativeKitPackage;',
        packageInstance: 'new NativeKitPackage()',
      },
      ios: {},
    },
  },
};
