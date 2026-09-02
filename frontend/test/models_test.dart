import 'package:flutter_test/flutter_test.dart';
import 'package:project_heritage_frontend/models/festival_calendar_model.dart';
import 'package:project_heritage_frontend/models/festival_model.dart';
import 'package:project_heritage_frontend/models/nearby_model.dart';
import 'package:project_heritage_frontend/models/user_model.dart';
import 'package:project_heritage_frontend/utils/date_format.dart';

/// 서버 응답을 모델로 변환하는 부분을 검증한다.
///
/// 여기서 틀리면 화면에서 엉뚱한 값이 보이거나 런타임에 캐스팅 오류가 나는데,
/// 실기기로 확인하기 전에는 알기 어렵다. 파싱은 순수 로직이라 테스트하기 쉽다.
void main() {
  group('date_format', () {
    test('서버가 쓰는 YYYY-MM-DD 형식으로 변환한다', () {
      expect(toDateKey(DateTime(2026, 11, 5)), '2026-11-05');
    });

    test('한 자리 월/일도 0을 채운다', () {
      expect(toDateKey(DateTime(2026, 1, 3)), '2026-01-03');
    });

    test('화면 표시용 형식', () {
      expect(toDisplayDate(DateTime(2026, 11, 5)), '2026.11.05');
    });
  });

  group('FestivalModel', () {
    final json = {
      'id': 1,
      'name': '서울빛초롱축제',
      'sido': {'id': 1, 'code': '11', 'name': '서울특별시'},
      'sigungu': '종로구',
      'location': '청계천',
      'startDate': '2026-11-05',
      'endDate': '2026-11-07',
      'latitude': 37.5796,
      'longitude': 126.977,
      'isWishlisted': true,
    };

    test('응답을 모델로 변환한다', () {
      final festival = FestivalModel.fromJson(json);

      expect(festival.id, 1);
      expect(festival.name, '서울빛초롱축제');
      expect(festival.sido?.name, '서울특별시');
      expect(festival.isWishlisted, isTrue);
    });

    test('기간이 여러 날이면 시작~종료로 표시한다', () {
      expect(FestivalModel.fromJson(json).periodLabel, '2026.11.05 ~ 2026.11.07');
    });

    test('하루짜리 축제는 날짜 하나만 표시한다', () {
      final oneDay = FestivalModel.fromJson({...json, 'endDate': '2026-11-05'});
      expect(oneDay.periodLabel, '2026.11.05');
    });

    test('지역은 시도와 시군구를 붙여 표시한다', () {
      expect(FestivalModel.fromJson(json).regionLabel, '서울특별시 종로구');
    });

    test('시군구가 없으면 시도만 표시한다', () {
      final noSigungu = FestivalModel.fromJson({...json, 'sigungu': null});
      expect(noSigungu.regionLabel, '서울특별시');
    });

    test('선택 필드가 없어도 변환에 실패하지 않는다', () {
      final minimal = FestivalModel.fromJson({
        'id': 2,
        'name': '최소축제',
        'startDate': '2026-11-05',
        'endDate': '2026-11-05',
      });

      expect(minimal.sido, isNull);
      expect(minimal.isWishlisted, isFalse);
      expect(minimal.regionLabel, '');
    });
  });

  group('FestivalCalendarModel', () {
    // 서버는 축제 목록과 "날짜 -> 축제 ID" 인덱스를 따로 내려준다.
    final calendar = FestivalCalendarModel.fromJson({
      'year': 2026,
      'month': 11,
      'festivals': [
        {'id': 1, 'name': '축제A', 'startDate': '2026-11-05', 'endDate': '2026-11-07'},
        {'id': 2, 'name': '축제B', 'startDate': '2026-11-06', 'endDate': '2026-11-06'},
      ],
      'days': {
        '2026-11-05': [1],
        '2026-11-06': [1, 2],
        '2026-11-07': [1],
      },
    });

    test('날짜별로 진행 중인 축제를 찾아준다', () {
      expect(calendar.festivalsOn(DateTime(2026, 11, 6)).map((f) => f.name), ['축제A', '축제B']);
    });

    test('기간이 여러 날인 축제는 모든 날짜에서 조회된다', () {
      for (final day in [5, 6, 7]) {
        expect(
          calendar.festivalsOn(DateTime(2026, 11, day)).map((f) => f.id),
          contains(1),
          reason: '11월 $day일에 축제A가 있어야 한다',
        );
      }
    });

    test('축제가 없는 날은 빈 목록', () {
      expect(calendar.festivalsOn(DateTime(2026, 11, 20)), isEmpty);
    });

    test('축제 정보는 중복 없이 한 번만 담긴다', () {
      // 3일짜리 축제가 날짜마다 복사되면 안 된다.
      expect(calendar.totalCount, 2);
    });

    test('빈 캘린더도 안전하게 동작한다', () {
      final empty = FestivalCalendarModel.empty(2026, 11);
      expect(empty.festivalsOn(DateTime(2026, 11, 5)), isEmpty);
    });
  });

  group('NearbyFestivalModel', () {
    test('거리와 축제 정보를 함께 파싱한다', () {
      final nearby = NearbyFestivalModel.fromJson({
        'id': 1,
        'name': '가까운축제',
        'startDate': '2026-11-05',
        'endDate': '2026-11-07',
        // DECIMAL 계산 결과라 문자열로 올 수 있다.
        'distanceKm': '1.4592',
      });

      expect(nearby.festival.name, '가까운축제');
      expect(nearby.distanceKm, closeTo(1.4592, 0.0001));
    });

    test('1km 미만은 m 단위로 표시한다', () {
      final near = NearbyFestivalModel.fromJson({
        'id': 1,
        'name': 'x',
        'startDate': '2026-11-05',
        'endDate': '2026-11-05',
        'distanceKm': '0.35',
      });

      expect(near.distanceLabel, '350m');
    });

    test('1km 이상은 km 단위로 표시한다', () {
      final far = NearbyFestivalModel.fromJson({
        'id': 1,
        'name': 'x',
        'startDate': '2026-11-05',
        'endDate': '2026-11-05',
        'distanceKm': '12.34',
      });

      expect(far.distanceLabel, '12.3km');
    });
  });

  group('UserModel', () {
    test('연결된 간편로그인 목록을 파싱한다', () {
      final user = UserModel.fromJson({
        'id': 1,
        'email': 'me@example.com',
        'name': '홍길동',
        'nickname': '길동이',
        'hasPassword': true,
        'socialAccounts': [
          {'id': 1, 'provider': 'kakao', 'providerEmail': 'a@k.com'},
          {'id': 2, 'provider': 'naver', 'providerEmail': null},
        ],
      });

      expect(user.socialAccounts, hasLength(2));
      expect(user.isLinked(AuthProvider.kakao), isTrue);
      expect(user.isLinked(AuthProvider.google), isFalse);
    });

    test('닉네임이 있으면 닉네임을, 없으면 이름을 표시한다', () {
      final base = {'id': 1, 'email': 'a@b.com', 'name': '홍길동'};

      expect(UserModel.fromJson({...base, 'nickname': '길동이'}).displayName, '길동이');
      expect(UserModel.fromJson(base).displayName, '홍길동');
      expect(UserModel.fromJson({...base, 'nickname': ''}).displayName, '홍길동');
    });

    test('프로필 이미지 상대 경로에 서버 주소를 붙인다', () {
      final user = UserModel.fromJson({
        'id': 1,
        'email': 'a@b.com',
        'name': '홍길동',
        'profileImageUrl': '/uploads/profiles/abc.jpg',
      });

      expect(user.profileImageFullUrl, endsWith('/uploads/profiles/abc.jpg'));
      expect(user.profileImageFullUrl, startsWith('http'));
    });

    test('이미지가 없으면 null을 반환한다', () {
      final user = UserModel.fromJson({'id': 1, 'email': 'a@b.com', 'name': '홍길동'});
      expect(user.profileImageFullUrl, isNull);
    });
  });
}
