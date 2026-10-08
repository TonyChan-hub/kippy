require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "NativeKitRn"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://github.com/TonyChan-hub/kippy"
  s.license      = package["license"]
  s.authors      = "Kippy"
  s.platforms    = { :ios => "13.0" }
  s.source       = { :git => "https://github.com/TonyChan-hub/kippy.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift}"
  s.dependency "React-Core"
  s.swift_version = "5.0"
  s.pod_target_xcconfig = { "DEFINES_MODULE" => "YES" }
end
