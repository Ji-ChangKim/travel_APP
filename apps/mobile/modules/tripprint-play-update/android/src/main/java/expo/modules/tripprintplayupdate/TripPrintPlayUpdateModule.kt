package expo.modules.tripprintplayupdate

import android.content.Context
import android.os.Build
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.install.model.UpdateAvailability
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class TripPrintPlayUpdateModule : Module() {
  override fun definition() = ModuleDefinition {
    // 앱 자체의 버전과 Google Play 업데이트 가용성만 노출한다.
    Name("TripPrintPlayUpdate")
    AsyncFunction("checkForUpdate") { promise: Promise ->
      // 계정 정보나 여행 기록은 스토어 조회에 전달하지 않는다.
      checkForUpdate(requireNotNull(appContext.reactContext), promise)
    }
  }

  private fun checkForUpdate(context: Context, promise: Promise) {
    // 공식 Play 응답에 실패하면 최신 버전으로 간주하지 않는다.
    AppUpdateManagerFactory.create(context).appUpdateInfo
      .addOnSuccessListener { info ->
        // availableVersionCode는 업데이트가 있을 때만 유효하다.
        promise.resolve(versionResult(context, info.updateAvailability(), if (
          info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE ||
          info.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS
        ) info.availableVersionCode() else null))
      }
      .addOnFailureListener {
        // 직접 설치 APK와 스토어 연결 실패를 구분 가능한 미확인 상태로 전달한다.
        promise.resolve(versionResult(context, UpdateAvailability.UNKNOWN, null))
      }
  }

  private fun versionResult(context: Context, availability: Int, availableCode: Int?): Map<String, Any?> {
    // 설치 버전은 앱 설정 문자열이 아닌 Android 패키지 정보에서 읽는다.
    return installedVersion(context) + mapOf(
      "status" to when (availability) {
        UpdateAvailability.UPDATE_AVAILABLE, UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS -> "available"
        UpdateAvailability.UPDATE_NOT_AVAILABLE -> "current"
        else -> "unavailable"
      },
      "availableVersionCode" to availableCode
    )
  }

  @Suppress("DEPRECATION")
  private fun installedVersion(context: Context): Map<String, Any?> {
    // 사용자에게 배포된 실제 패키지의 버전만 비교한다.
    return context.packageManager.getPackageInfo(context.packageName, 0).let { info ->
      // 최신 여부를 알 수 없는 상태에서도 설치된 버전 자체는 정확하게 반환한다.
      mapOf(
        "packageName" to context.packageName,
        "installedVersionCode" to if (Build.VERSION.SDK_INT >= 28) info.longVersionCode.toDouble() else info.versionCode.toDouble(),
        "installedVersionName" to (info.versionName ?: "")
      )
    }
  }
}
