import Foundation

internal enum CedarlingJson {
  @discardableResult
  static func requireBootstrap(_ value: String) throws -> [String: Any] {
    try requireObject(value, label: "bootstrap")
  }

  @discardableResult
  static func requireContext(_ value: String) throws -> [String: Any] {
    try requireObject(value, label: "context")
  }

  @discardableResult
  static func requireEntity(_ value: String, label: String) throws -> [String: Any] {
    let object = try requireObject(value, label: label)
    guard let mapping = object["cedar_entity_mapping"] as? [String: Any] else {
      throw CedarlingModuleError(.invalidInput, "\(label).cedar_entity_mapping must be an object")
    }
    try requireNonemptyString(
      mapping["entity_type"],
      label: "\(label).cedar_entity_mapping.entity_type"
    )
    try requireNonemptyString(mapping["id"], label: "\(label).cedar_entity_mapping.id")
    return object
  }

  static func requireAction(_ value: String) throws -> String {
    let action = value.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !action.isEmpty else {
      throw CedarlingModuleError(.invalidInput, "action must be a nonempty string")
    }
    return action
  }

  static func parseTokens(_ value: String) throws -> [TokenInput] {
    let root = try parse(value, label: "tokens")
    guard let tokens = root as? [Any], !tokens.isEmpty else {
      throw CedarlingModuleError(.invalidInput, "tokens must be a nonempty array")
    }
    return try tokens.enumerated().map { index, value in
      guard let token = value as? [String: Any] else {
        throw CedarlingModuleError(.invalidInput, "tokens[\(index)] must be an object")
      }
      let mapping = try requireNonemptyString(
        token["mapping"],
        label: "tokens[\(index)].mapping"
      )
      let payload = try requireNonemptyString(
        token["payload"],
        label: "tokens[\(index)].payload"
      )
      return TokenInput(mapping: mapping, payload: payload)
    }
  }

  private static func requireObject(_ value: String, label: String) throws -> [String: Any] {
    let root = try parse(value, label: label)
    guard let object = root as? [String: Any] else {
      throw CedarlingModuleError(.invalidJson, "\(label) must be a JSON object")
    }
    return object
  }

  private static func parse(_ value: String, label: String) throws -> Any {
    guard !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
          let data = value.data(using: .utf8) else {
      throw CedarlingModuleError(.invalidJson, "\(label) must not be empty")
    }
    do {
      return try JSONSerialization.jsonObject(with: data)
    } catch {
      throw CedarlingModuleError(.invalidJson, "\(label) is not valid JSON")
    }
  }

  private static func requireNonemptyString(_ value: Any?, label: String) throws -> String {
    guard let string = value as? String else {
      throw CedarlingModuleError(.invalidInput, "\(label) must be a nonempty string")
    }
    let trimmed = string.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else {
      throw CedarlingModuleError(.invalidInput, "\(label) must be a nonempty string")
    }
    return trimmed
  }
}
