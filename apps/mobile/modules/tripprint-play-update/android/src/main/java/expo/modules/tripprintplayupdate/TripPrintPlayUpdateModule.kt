package expo.modules.tripprintplayupdate

import android.app.Activity
import android.content.Context
import android.os.Build
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateInfo
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.UpdateAvailability
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class TripPrintPlayUpdateModule : Module() {
  override fun definition() = ModuleDefinition {
    // 앱 자체의 버전과 Google Play 업데이트 가용성만 노출한다.
    Name("TripPrintPlayUpdate")
    Function("installedApp") {
      // Play 연결과 무관한 패키지 정보와 설치 경로를 먼저 읽는다.
      requireNotNull(appContext.reactContext).let { context ->
        // 실제 설치 정보만 즉시 반환한다.
        installedVersion(context) + mapOf("channel" to installChannel(context))
      }
    }
    AsyncFunction("startImmediateUpdate") { minimumCode: Int, promise: Promise ->
      // 사용자 버튼에서만 새 Play 조회 후 즉시 업데이트를 실행한다.
      startImmediateUpdate(requireNotNull(appContext.currentActivity), minimumCode, promise)
    }
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
        promise.resolve(availableResult(context, info))
      }
      .addOnFailureListener {
        // 직접 설치 APK와 스토어 연결 실패를 구분 가능한 미확인 상태로 전달한다.
        promise.resolve(versionResult(context, UpdateAvailability.UNKNOWN, null))
      }
  }

  private fun startImmediateUpdate(activity: Activity, minimumCode: Int, promise: Promise) {
    // 이전 조회 객체는 재사용하지 않고 매번 허용 여부를 다시 확인한다.
    AppUpdateManagerFactory.create(activity).let { manager ->
      // 새 조회 결과에 대해서만 Play의 공식 절차를 연다.
      manager.appUpdateInfo.addOnSuccessListener { info ->
        // 단계 배포나 정책 변경으로 실행할 수 없으면 화면에서 다시 확인한다.
        if (installChannel(activity) == "play" && info.availableVersionCode() >= minimumCode && info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE)) {
          manager.startUpdateFlow(info, activity, AppUpdateOptions.newBuilder(AppUpdateType.IMMEDIATE).build())
            .addOnSuccessListener { result ->
              // 취소는 업데이트 완료로 처리하지 않는다.
              promise.resolve(if (result == Activity.RESULT_OK) "accepted" else "cancelled")
            }
            .addOnFailureListener {
              // 내부 오류 원문 대신 실행 불가만 전달한다.
              promise.resolve("unavailable")
            }
        } else promise.resolve("unavailable")
      }.addOnFailureListener {
        // 조회 실패에서는 임의 스토어 이동을 자동 반복하지 않는다.
        promise.resolve("unavailable")
      }
    }
  }

  private fun availableResult(context: Context, info: AppUpdateInfo): Map<String, Any?> {
    // 실제 제공된 버전과 업데이트 실행 허용 유형을 함께 반환한다.
    return versionResult(context, info.updateAvailability(), if (
      info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE ||
      info.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS
    ) info.availableVersionCode() else null) + mapOf(
      "immediateAllowed" to info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE),
      "flexibleAllowed" to info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)
    )
  }

  @Suppress("DEPRECATION")
  private fun installChannel(context: Context): String {
    // Play 설치 경로만 정책 대상으로 분류하고 확인 실패는 추측하지 않는다.
    return try {
      if (context.packageManager.getInstallerPackageName(context.packageName) == "com.android.vending") "play" else "direct"
    } catch (_: Exception) { "unknown" }
  }

  private fun versionResult(context: Context, availability: Int, availableCode: Int?): Map<String, Any?> {
    // 설치 버전은 앱 설정 문자열이 아닌 Android 패키지 정보에서 읽는다.
    return installedVersion(context) + mapOf(
      "status" to when (availability) {
        UpdateAvailability.UPDATE_AVAILABLE, UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS -> "available"
        UpdateAvailability.UPDATE_NOT_AVAILABLE -> "current"
        else -> "unavailable"
      },
      "availableVersionCode" to availableCode,
      "channel" to installChannel(context)
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
