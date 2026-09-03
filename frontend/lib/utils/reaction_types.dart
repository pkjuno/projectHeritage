/// 게시글 반응(좋아요 + 공감) 종류와 화면 표기.
///
/// 서버의 post_reactions.type ENUM과 순서·값이 같아야 한다.
/// 서버가 없는 값을 받으면 400을 내므로, 화면에서 임의로 종류를 늘리면 안 된다.
library;

/// 반응 종류 코드 (서버 ENUM과 동일한 순서)
const List<String> reactionTypes = ['like', 'love', 'wow', 'sad', 'angry'];

/// 반응 종류별 이모지
const Map<String, String> reactionEmojis = {
  'like': '👍',
  'love': '😍',
  'wow': '😮',
  'sad': '😢',
  'angry': '😠',
};

/// 반응 종류별 한글 이름 (접근성 레이블, 툴팁)
const Map<String, String> reactionLabels = {
  'like': '좋아요',
  'love': '최고예요',
  'wow': '놀라워요',
  'sad': '슬퍼요',
  'angry': '화나요',
};

/// 반응 코드에 해당하는 이모지를 돌려준다.
/// 서버가 앱보다 먼저 새 종류를 추가하더라도 화면이 깨지지 않도록 기본값을 둔다.
String emojiOf(String? type) => reactionEmojis[type] ?? '🙂';

/// 반응 코드에 해당하는 한글 이름을 돌려준다.
String labelOf(String? type) => reactionLabels[type] ?? '반응';
