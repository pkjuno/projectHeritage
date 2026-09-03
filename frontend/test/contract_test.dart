import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:project_heritage_frontend/models/comment_model.dart';
import 'package:project_heritage_frontend/models/community_dashboard_model.dart';
import 'package:project_heritage_frontend/models/my_activity_model.dart';
import 'package:project_heritage_frontend/models/notification_model.dart';
import 'package:project_heritage_frontend/models/post_model.dart';
import 'package:project_heritage_frontend/services/community_service.dart';

/// 백엔드 실제 응답 계약(contract) 테스트.
///
/// test/fixtures/*.json은 **실제로 실행 중인 백엔드에서 받아온 응답**을 그대로 저장한 것이다.
/// (손으로 만든 샘플이 아니다)
///
/// 손으로 만든 JSON으로 테스트하면 "내가 상상한 서버"에 맞춰 모델을 맞추게 된다.
/// 서버가 필드 이름을 바꾸거나 타입을 바꿔도 그 테스트는 계속 통과한다.
/// 이 파일은 그 간극을 막는다. 서버 응답이 바뀌면 픽스처를 다시 받아 여기서 깨지게 한다.
void main() {
  /// 픽스처 파일을 읽어 JSON으로 파싱한다.
  dynamic loadFixture(String name) {
    final file = File('test/fixtures/$name');
    expect(
      file.existsSync(),
      isTrue,
      reason: '픽스처 $name 이 없습니다. 백엔드를 띄우고 다시 내려받으세요.',
    );
    return jsonDecode(file.readAsStringSync());
  }

  group('게시판 목록 응답', () {
    test('실제 응답을 모델로 변환한다', () {
      final raw = loadFixture('categories.json') as List<dynamic>;
      final categories = raw
          .map((item) => BoardCategoryModel.fromJson(item as Map<String, dynamic>))
          .toList();

      expect(categories, isNotEmpty);

      // 앱은 이 두 값으로 글쓰기 화면을 구성한다. 서버가 안 주면 화면이 잘못 그려진다.
      final notice = categories.firstWhere((c) => c.code == 'notice');
      final review = categories.firstWhere((c) => c.code == 'review');
      expect(notice.isAdminOnly, isTrue, reason: '공지사항은 운영자 전용이어야 한다');
      expect(review.requireFestival, isTrue, reason: '축제 후기는 축제 연결이 필수여야 한다');
    });
  });

  group('게시글 목록 응답', () {
    test('페이지네이션 구조와 항목을 변환한다', () {
      final raw = loadFixture('post_list.json') as Map<String, dynamic>;
      final result = PagedResult.fromJson(raw, PostModel.fromJson);

      expect(result.items, isNotEmpty);
      expect(result.total, greaterThan(0));
      expect(result.page, 1);
    });

    test('목록 응답에 작성자 민감정보가 없다', () {
      final raw = loadFixture('post_list.json') as Map<String, dynamic>;
      final items = raw['items'] as List<dynamic>;

      // 서버가 attributes 지정을 빼먹으면 비밀번호 해시와 refreshToken이 실려 온다.
      // 앱 모델은 그 필드를 읽지 않지만, 응답 자체에 담겨 있다는 사실이 문제다.
      for (final item in items) {
        final author = (item as Map<String, dynamic>)['author'] as Map<String, dynamic>?;
        if (author == null) continue;
        expect(author.containsKey('password'), isFalse);
        expect(author.containsKey('refreshToken'), isFalse);
      }
    });
  });

  group('게시글 상세 응답', () {
    late PostModel post;

    setUpAll(() {
      post = PostModel.fromJson(loadFixture('post_detail.json') as Map<String, dynamic>);
    });

    test('본문과 반응 집계가 함께 온다', () {
      expect(post.content, isNotNull, reason: '상세에는 본문이 있어야 한다');
      expect(post.reactions, isNotNull, reason: '상세에는 반응 집계가 있어야 한다');
    });

    test('반응 집계에 다섯 종류가 모두 채워져 온다', () {
      // 화면이 다섯 종류를 모두 그리므로, 없는 종류도 0으로 와야 방어 코드가 필요 없다.
      for (final type in ['like', 'love', 'wow', 'sad', 'angry']) {
        expect(
          post.reactions!.byType.containsKey(type),
          isTrue,
          reason: '$type 개수가 응답에 없다',
        );
      }
    });

    test('내가 남긴 반응이 그대로 읽힌다', () {
      // 픽스처는 'love' 반응을 남긴 회원의 토큰으로 받았다.
      expect(post.currentReaction, 'love');
    });
  });

  group('댓글 목록 응답', () {
    late List<CommentModel> comments;

    setUpAll(() {
      final raw = loadFixture('comments.json') as Map<String, dynamic>;
      comments = PagedResult.fromJson(raw, CommentModel.fromJson).items;
    });

    test('대댓글이 부모 안에 묶여 온다', () {
      final withReplies = comments.where((c) => c.replies.isNotEmpty);
      expect(withReplies, isNotEmpty, reason: '픽스처에 대댓글이 있어야 한다');

      for (final parent in withReplies) {
        for (final reply in parent.replies) {
          expect(reply.parentId, parent.id);
        }
      }
    });

    test('삭제된 댓글은 자리를 지키되 작성자가 가려져 있다', () {
      final deleted = comments.where((c) => c.isDeleted);
      expect(deleted, isNotEmpty, reason: '픽스처에 삭제된 댓글이 있어야 한다');

      for (final comment in deleted) {
        // 내용만 가리고 이름을 남기면 누가 무엇을 지웠는지가 드러난다.
        expect(comment.author, isNull);
        expect(comment.content, '삭제된 댓글입니다.');
        // 답글이 남아 있어서 자리를 지킨 것이다.
        expect(comment.replies, isNotEmpty);
      }
    });
  });

  group('대시보드 응답', () {
    late CommunityDashboardModel dashboard;

    setUpAll(() {
      dashboard =
          CommunityDashboardModel.fromJson(loadFixture('dashboard.json') as Map<String, dynamic>);
    });

    test('모든 섹션이 변환된다', () {
      expect(dashboard.categories, isNotEmpty);
      expect(dashboard.latest, isNotEmpty);
      expect(dashboard.myActivity, isNotNull, reason: '로그인 토큰으로 받은 응답이다');
    });

    test('대시보드 항목에는 본문이 없다', () {
      // 요약이라 본문을 싣지 않는다. 앱이 여기서 본문을 기대하면 빈 화면이 나온다.
      for (final post in dashboard.latest) {
        expect(post.content, isNull);
      }
    });

    test('게시판 요약에 글 수가 담겨 온다', () {
      final free = dashboard.categories.firstWhere((c) => c.code == 'free');
      expect(free.postCount, greaterThan(0));
    });
  });

  group('내 활동 응답', () {
    test('내 글 목록', () {
      final raw = loadFixture('my_posts.json') as Map<String, dynamic>;
      final result = PagedResult.fromJson(raw, PostModel.fromJson);
      expect(result.items, isNotEmpty);
    });

    test('내 댓글에는 원글이 함께 온다', () {
      final raw = loadFixture('my_comments.json') as Map<String, dynamic>;
      final result = PagedResult.fromJson(raw, MyCommentModel.fromJson);

      expect(result.items, isNotEmpty);
      // 이 필드가 없으면 "무슨 글에 단 댓글인지" 화면에 표시할 수 없다.
      expect(result.items.first.post.title, isNotEmpty);
    });

    test('내 반응에는 반응 종류가 함께 온다', () {
      final raw = loadFixture('my_reactions.json') as Map<String, dynamic>;
      final result = PagedResult.fromJson(raw, MyReactionModel.fromJson);

      expect(result.items, isNotEmpty);
      expect(result.items.first.type, 'love');
      expect(result.items.first.post.title, isNotEmpty);
    });
  });

  group('알림 응답', () {
    test('커뮤니티 알림에 게시글 ID가 담겨 온다', () {
      final raw = loadFixture('notifications.json') as Map<String, dynamic>;
      final items = (raw['items'] as List<dynamic>)
          .map((item) => NotificationModel.fromJson(item as Map<String, dynamic>))
          .toList();

      expect(items, isNotEmpty);

      final community = items.where((n) => n.isCommunity);
      expect(community, isNotEmpty, reason: '픽스처에 커뮤니티 알림이 있어야 한다');

      // 이 값이 없으면 알림을 눌러도 게시글로 갈 수 없다.
      for (final notification in community) {
        expect(notification.postId, isNotNull);
      }
    });
  });
}
