// swift-tools-version: 5.9
import PackageDescription

// SPM-Hülle für @perfood/capacitor-healthkit (liefert selbst nur eine Podspec).
// scripts/capacitor-healthkit-spm.mjs kopiert diese Datei bei `npm install`
// nach node_modules/@perfood/capacitor-healthkit/. Dann nimmt `npx cap sync`
// das Plugin in ios/App/CapApp-SPM/Package.swift auf.
// Paket- und Produktname müssen "PerfoodCapacitorHealthkit" heißen: so leitet
// die Capacitor-CLI den Namen aus "@perfood/capacitor-healthkit" ab.
let package = Package(
    name: "PerfoodCapacitorHealthkit",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "PerfoodCapacitorHealthkit",
            targets: ["HealthkitPlugin"])
    ],
    dependencies: [
        // __CAPACITOR_IOS_VERSION__ setzt das Skript auf die installierte @capacitor/ios-Version,
        // genau wie die CLI in CapApp-SPM (sonst bricht ein Major-Update die Auflösung).
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", exact: "__CAPACITOR_IOS_VERSION__")
    ],
    targets: [
        .target(
            name: "HealthkitPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm")
            ],
            path: "ios/Plugin",
            // SPM erlaubt kein Swift und Objective-C im selben Target. Die
            // Registrierung aus der .m ersetzt CapacitorHealthkitPlugin+SPM.swift.
            exclude: ["CapacitorHealthkitPlugin.m", "CapacitorHealthkitPlugin.h", "Info.plist"],
            linkerSettings: [.linkedFramework("HealthKit")])
    ]
)
