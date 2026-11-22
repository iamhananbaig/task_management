import java.util.Properties

plugins {
    id("com.android.application")
}

// Release signing key lives outside the repo (~/.android-keys/tasks.properties, or TASKS_SIGNING).
// Without one, release builds come out unsigned.
val signingProps = Properties().apply {
    val path = System.getenv("TASKS_SIGNING") ?: "${System.getProperty("user.home")}/.android-keys/tasks.properties"
    file(path).takeIf { it.exists() }?.inputStream()?.use { load(it) }
}

val appVersionName = (findProperty("appVersionName") as String?) ?: "1.0"

/** 1.2.3 → 10203. Must only ever go up: Android refuses to install a lower versionCode. */
fun versionCodeFor(name: String): Int {
    val parts = name.split('.').map { it.toIntOrNull() ?: error("Version must be numbers like 1.2 or 1.2.3, got $name") }
    require(parts.size in 2..3 && parts.all { it in 0..99 }) { "Version must be like 1.2 or 1.2.3 (each part 0-99), got $name" }
    return parts[0] * 10000 + parts[1] * 100 + parts.getOrElse(2) { 0 }
}

android {
    namespace = "com.iamhananbaig.tasks"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.iamhananbaig.tasks"
        minSdk = 26 // Android 8.0
        targetSdk = 37
        // Release builds get the version from the git tag (android-v1.2 → -PappVersionName=1.2).
        versionName = appVersionName
        versionCode = (findProperty("appVersionCode") as String?)?.toInt() ?: versionCodeFor(appVersionName)
    }

    signingConfigs {
        if (signingProps.containsKey("storeFile")) {
            create("release") {
                storeFile = file(signingProps.getProperty("storeFile"))
                storePassword = signingProps.getProperty("storePassword")
                keyAlias = signingProps.getProperty("keyAlias")
                keyPassword = signingProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".debug"
        }
        release {
            signingConfig = signingConfigs.findByName("release")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    implementation("androidx.activity:activity-ktx:1.13.0")
    implementation("androidx.recyclerview:recyclerview:1.4.0")
    implementation("androidx.swiperefreshlayout:swiperefreshlayout:1.1.0")
    implementation("androidx.work:work-runtime-ktx:2.10.1")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.11.0")
}
