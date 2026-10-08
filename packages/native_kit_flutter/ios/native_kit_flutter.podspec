Pod::Spec.new do |s|
  s.name             = 'native_kit_flutter'
  s.version          = '0.0.1'
  s.summary          = 'NativeKit Flutter facade — modular dual-end native APIs.'
  s.description      = <<-DESC
NativeKit Flutter facade — modular dual-end native APIs.
                       DESC
  s.homepage         = 'https://github.com/TonyChan-hub/AppSetup'
  s.license          = { :file => '../LICENSE' }
  s.author           = { 'AppSetup' => 'dev@example.com' }
  s.source           = { :path => '.' }
  s.source_files     = 'Classes/**/*'
  s.dependency 'Flutter'
  s.platform = :ios, '13.0'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES', 'EXCLUDED_ARCHS[sdk=iphonesimulator*]' => 'i386' }
  s.swift_version = '5.0'
end
