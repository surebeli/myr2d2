require "json"
package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "react-native-cmd-run"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.author       = "Trae"
  s.homepage     = "https://github.com/trae-ai"
  s.license      = "MIT"
  s.platforms    = { :macos => "10.15" }
  s.source       = { :git => ".", :tag => "v#{s.version}" }
  s.source_files = "macos/*.{h,m}"
  s.dependency "React-Core"
end
