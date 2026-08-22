# JNA's Android guidance: native method registration and reflection require
# these classes and public members to retain their names.
-dontwarn java.awt.**
-keep class com.sun.jna.* { *; }
-keep class * extends com.sun.jna.* { *; }
-keepclassmembers class * extends com.sun.jna.* { public *; }

# rustls-platform-verifier is reached only from Rust through JNI.
-keep,includedescriptorclasses class org.rustls.platformverifier.** { *; }

# The manually named Rust JNI export depends on this exact class name.
-keep class org.jans.cedarling.CedarlingAndroid { *; }

# Preserve native method names across R8.
-keepclasseswithmembernames,includedescriptorclasses class * { native <methods>; }
