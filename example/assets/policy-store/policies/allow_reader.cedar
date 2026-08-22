@id("allow_reader")
permit(
  principal is ReactNativeExample::User,
  action == ReactNativeExample::Action::"Read",
  resource is ReactNativeExample::Document
)
when {
  principal.role == "reader"
};
