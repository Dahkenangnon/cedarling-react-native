#!/usr/bin/env ruby
# frozen_string_literal: true

require 'pathname'
require 'xcodeproj'

project_root = Pathname.new(__dir__).join('..').expand_path
example_root = project_root.join('example')
project_path = Dir[example_root.join('ios', '*.xcodeproj').to_s].first
abort 'Generated iOS Xcode project was not found' unless project_path

project = Xcodeproj::Project.open(project_path)
app_target = project.targets.find do |target|
  target.product_type == 'com.apple.product-type.application'
end
abort 'Generated iOS application target was not found' unless app_target

unit_name = "#{app_target.name}Tests"
ui_name = "#{app_target.name}UITests"
abort 'iOS test targets already exist' if project.targets.any? { |target| [unit_name, ui_name].include?(target.name) }

unit_target = project.new_target(:unit_test_bundle, unit_name, :ios, '17.5')
ui_target = project.new_target(:ui_test_bundle, ui_name, :ios, '17.5')
unit_target.add_dependency(app_target)
ui_target.add_dependency(app_target)

tests_group = project.main_group.find_subpath('CedarlingTests', true)
unit_files = Dir[project_root.join('ios', 'Tests', '*.swift').to_s].sort
ui_files = Dir[example_root.join('ios-tests', '*.swift').to_s].sort
abort 'Native unit-test sources were not found' if unit_files.empty?
abort 'iOS UI-test sources were not found' if ui_files.empty?

unit_refs = unit_files.map { |path| tests_group.new_file(path) }
ui_refs = ui_files.map { |path| tests_group.new_file(path) }
unit_target.add_file_references(unit_refs)
ui_target.add_file_references(ui_refs)

resource_paths = [
  example_root.join('assets', 'fixtures', 'bootstrap.json'),
  example_root.join('assets', 'fixtures', 'allow-principal.json'),
  example_root.join('assets', 'fixtures', 'deny-principal.json'),
  example_root.join('assets', 'fixtures', 'resource.json'),
  example_root.join('assets', 'policy-store.cjar')
]
resource_refs = resource_paths.map { |path| tests_group.new_file(path.to_s) }
resource_refs.each { |reference| unit_target.resources_build_phase.add_file_reference(reference) }

app_configs = app_target.build_configurations.to_h { |configuration| [configuration.name, configuration] }
unit_target.build_configurations.each do |configuration|
  app_configuration = app_configs.fetch(configuration.name)
  configuration.base_configuration_reference = app_configuration.base_configuration_reference
  configuration.build_settings.merge!(
    'ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES' => 'YES',
    'BUNDLE_LOADER' => '$(TEST_HOST)',
    'CODE_SIGNING_ALLOWED' => 'NO',
    'GENERATE_INFOPLIST_FILE' => 'YES',
    'IPHONEOS_DEPLOYMENT_TARGET' => '17.5',
    'PRODUCT_BUNDLE_IDENTIFIER' => "com.dahkenangnon.cedarlingreactnative.#{unit_name.downcase}",
    'PRODUCT_NAME' => unit_name,
    'SWIFT_VERSION' => '5.9',
    'TEST_HOST' => "$(BUILT_PRODUCTS_DIR)/#{app_target.product_name}.app/#{app_target.product_name}"
  )
end

ui_target.build_configurations.each do |configuration|
  configuration.build_settings.merge!(
    'GENERATE_INFOPLIST_FILE' => 'YES',
    'IPHONEOS_DEPLOYMENT_TARGET' => '17.5',
    'PRODUCT_BUNDLE_IDENTIFIER' => "com.dahkenangnon.cedarlingreactnative.#{ui_name.downcase}",
    'PRODUCT_NAME' => ui_name,
    'SWIFT_VERSION' => '5.9',
    'TEST_TARGET_NAME' => app_target.name
  )
end

[
  ["#{app_target.name}-NativeTests", unit_target],
  ["#{app_target.name}-UITests", ui_target]
].each do |scheme_name, test_target|
  scheme = Xcodeproj::XCScheme.new
  scheme.add_build_target(app_target)
  scheme.add_test_target(test_target)
  scheme.save_as(project_path, scheme_name, true)
end

project.save
puts "Configured #{unit_name} and #{ui_name} with separate shared schemes in #{project_path}"
