/// 서버와 주고받는 날짜 형식(DATEONLY, 'YYYY-MM-DD')을 다루는 공용 유틸.
library;

/// DateTime을 서버가 사용하는 'YYYY-MM-DD' 문자열로 변환한다.
/// 캘린더 인덱스 키와 API 요청 파라미터에 공통으로 쓰인다.
String toDateKey(DateTime date) {
  return '${date.year.toString().padLeft(4, '0')}-'
      '${date.month.toString().padLeft(2, '0')}-'
      '${date.day.toString().padLeft(2, '0')}';
}

/// DateTime을 화면 표시용 'YYYY.MM.DD' 문자열로 변환한다.
String toDisplayDate(DateTime date) {
  return '${date.year}.${date.month.toString().padLeft(2, '0')}.${date.day.toString().padLeft(2, '0')}';
}
