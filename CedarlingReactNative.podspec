require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'CedarlingReactNative'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = package['author']
  s.homepage       = 'https://github.com/Dahkenangnon/cedarling-react-native'
  s.source         = {
    git: 'https://github.com/Dahkenangnon/cedarling-react-native.git',
    tag: s.version.to_s
  }
  s.platform       = :ios, '17.5'
  s.swift_version  = '5.9'
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = [
    'ios/*.swift',
    'ios/generated/*.swift'
  ]
  s.vendored_frameworks = 'ios/CedarlingNative.xcframework'
  s.frameworks = ['Foundation', 'Security', 'SystemConfiguration']
  s.libraries = ['c++', 'resolv']
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }
end
