import 'package:geolocator/geolocator.dart';

/// 위치 사용이 불가능한 이유를 구분하기 위한 예외.
/// 사용자에게 "왜 안 되는지"를 알려줘야 하므로 사유를 메시지로 전달한다.
class LocationUnavailableException implements Exception {
  final String message;

  LocationUnavailableException(this.message);

  @override
  String toString() => message;
}

/// 현재 위치를 가져오는 서비스.
///
/// 위치 권한은 사용자가 거부하거나 기기 설정에서 꺼둘 수 있으므로,
/// 각 실패 상황을 구분해 안내 메시지를 다르게 준다.
class LocationService {
  /// 현재 위치를 조회한다.
  ///
  /// 위치 서비스가 꺼져 있거나 권한이 없으면 [LocationUnavailableException]을 던진다.
  /// @returns 현재 위치 좌표
  Future<Position> getCurrentPosition() async {
    // 1. 기기의 위치 서비스(GPS) 자체가 켜져 있는지 확인
    final isServiceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!isServiceEnabled) {
      throw LocationUnavailableException('기기의 위치 서비스가 꺼져 있습니다. 설정에서 켜주세요.');
    }

    // 2. 앱 권한 확인 및 요청
    var permission = await Geolocator.checkPermission();

    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }

    if (permission == LocationPermission.denied) {
      throw LocationUnavailableException('위치 권한이 거부되었습니다.');
    }

    // 3. "다시 묻지 않음"으로 영구 거부된 경우는 앱에서 다시 물을 수 없다.
    if (permission == LocationPermission.deniedForever) {
      throw LocationUnavailableException('위치 권한이 영구적으로 거부되어 있습니다. 앱 설정에서 허용해 주세요.');
    }

    return Geolocator.getCurrentPosition();
  }
}
