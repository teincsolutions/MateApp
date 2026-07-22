pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "MateApp"
include(":mateapp-core")
project(":mateapp-core").projectDir = file("mateapp-core-android/mateapp-core")
