import 'package:flutter_test/flutter_test.dart';
import 'package:project_heritage_frontend/models/comment_model.dart';
import 'package:project_heritage_frontend/models/moderation_model.dart';
import 'package:project_heritage_frontend/models/community_dashboard_model.dart';
import 'package:project_heritage_frontend/models/my_activity_model.dart';
import 'package:project_heritage_frontend/models/notification_model.dart';
import 'package:project_heritage_frontend/models/post_model.dart';
import 'package:project_heritage_frontend/models/user_model.dart';
import 'package:project_heritage_frontend/services/community_service.dart';
import 'package:project_heritage_frontend/utils/reaction_types.dart';

/// 커뮤니티 응답을 모델로 변환하는 부분을 검증한다.
///
/// 서버 응답은 화면마다 모양이 다르다.
///  - 목록: 본문(content)과 반응 분포(reactions)가 없고 myReaction만 있다
///  - 상세: 본문과 reactions가 있다
/// 이 차이를 잘못 다루면 목록에서 null 참조가 나거나 반응 표시가 사라지는데,
/// 실기기로 확인하기 전에는 알아채기 어렵다.
void main() {
  group('PostModel', () {
    final detailJson = {
      'id': 1,
      'title': '축제 다녀왔습니다',
      'content': '정말 좋았어요',
      'status': 'published',
      'isPinned': false,
      'viewCount': 10,
      'commentCount': 3,
      'reactionCount': 2,
      'shareCount': 1,
      'createdAt': '2026-09-03T10:00:00.000Z',
      'isMine': true,
      'author': {'id': 7, 'name': '홍길동', 'nickname': '길동이'},
      'category': {'id': 2, 'code': 'review', 'name': '축제 후기', 'requireFestival': true},
      'festival': {
        'id': 5,
        'name': '서울빛초롱축제',
        'startDate': '2026-11-05',
        'endDate': '2026-11-07',
      },
      'reactions': {
        'total': 2,
        'byType': {'like': 1, 'love': 1, 'wow': 0, 'sad': 0, 'angry': 0},
        'myReaction': 'love',
      },
    };

    test('상세 응답을 모델로 변환한다', () {
      final post = PostModel.fromJson(detailJson);

      expect(post.id, 1);
      expect(post.content, '정말 좋았어요');
      expect(post.author?.displayName, '길동이');
      expect(post.category?.code, 'review');
      expect(post.festival?.name, '서울빛초롱축제');
      expect(post.isMine, isTrue);
    });

    test('목록 응답에는 본문과 반응 분포가 없어도 변환된다', () {
      final post = PostModel.fromJson({
        'id': 2,
        'title': '목록에서 온 글',
        'createdAt': '2026-09-03T10:00:00.000Z',
        'reactionCount': 5,
        'myReaction': 'like',
      });

      expect(post.content, isNull);
      expect(post.reactions, isNull);
      expect(post.author, isNull);
      expect(post.festival, isNull);
    });

    test('내 반응은 목록/상세 어느 응답이든 같은 방법으로 읽는다', () {
      // 상세는 reactions 안에, 목록은 최상위 myReaction에 담겨 온다.
      expect(PostModel.fromJson(detailJson).currentReaction, 'love');

      final fromList = PostModel.fromJson({
        'id': 2,
        'title': 'x',
        'createdAt': '2026-09-03T10:00:00.000Z',
        'myReaction': 'wow',
      });
      expect(fromList.currentReaction, 'wow');
    });

    test('반응을 남기지 않았으면 null이다', () {
      final post = PostModel.fromJson({
        'id': 2,
        'title': 'x',
        'createdAt': '2026-09-03T10:00:00.000Z',
      });

      expect(post.currentReaction, isNull);
    });

    test('숨김 처리된 글을 구분한다', () {
      final hidden = PostModel.fromJson({...detailJson, 'status': 'hidden'});

      expect(hidden.isHidden, isTrue);
      expect(PostModel.fromJson(detailJson).isHidden, isFalse);
    });

    test('작성자가 없으면 대체 문구를 쓴다', () {
      final post = PostModel.fromJson({
        'id': 2,
        'title': 'x',
        'createdAt': '2026-09-03T10:00:00.000Z',
      });

      expect(post.authorLabel, '알 수 없음');
    });
  });

  group('ReactionSummaryModel', () {
    test('타입별 개수를 파싱한다', () {
      final summary = ReactionSummaryModel.fromJson({
        'total': 3,
        'byType': {'like': 2, 'sad': 1},
        'myReaction': 'like',
      });

      expect(summary.total, 3);
      expect(summary.countOf('like'), 2);
      expect(summary.hasMine, isTrue);
    });

    test('없는 종류를 물어도 0을 돌려준다', () {
      final summary = ReactionSummaryModel.fromJson({
        'total': 1,
        'byType': {'like': 1},
      });

      // 화면에서 다섯 종류를 모두 그리므로 없는 키에 안전해야 한다.
      expect(summary.countOf('angry'), 0);
      expect(summary.hasMine, isFalse);
    });
  });

  group('BoardCategoryModel', () {
    test('게시판별 정책을 파싱한다', () {
      final notice = BoardCategoryModel.fromJson({
        'id': 1,
        'code': 'notice',
        'name': '공지사항',
        'writeRole': 'admin',
        'requireFestival': false,
      });
      final review = BoardCategoryModel.fromJson({
        'id': 3,
        'code': 'review',
        'name': '축제 후기',
        'writeRole': 'user',
        'requireFestival': true,
      });

      // 이 두 값으로 글쓰기 화면이 게시판 선택지와 축제 칸을 결정한다.
      expect(notice.isAdminOnly, isTrue);
      expect(review.isAdminOnly, isFalse);
      expect(review.requireFestival, isTrue);
    });
  });

  group('CommentModel', () {
    test('대댓글이 부모 안에 묶여 파싱된다', () {
      final comment = CommentModel.fromJson({
        'id': 1,
        'postId': 10,
        'parentId': null,
        'content': '부모 댓글',
        'status': 'published',
        'likeCount': 2,
        'isMine': true,
        'isLiked': false,
        'createdAt': '2026-09-03T10:00:00.000Z',
        'author': {'id': 1, 'name': '홍길동'},
        'replies': [
          {
            'id': 2,
            'postId': 10,
            'parentId': 1,
            'content': '답글',
            'status': 'published',
            'likeCount': 0,
            'createdAt': '2026-09-03T10:01:00.000Z',
            'author': {'id': 2, 'name': '김철수'},
          },
        ],
      });

      expect(comment.replies, hasLength(1));
      expect(comment.isReply, isFalse);
      expect(comment.replies.first.isReply, isTrue);
      expect(comment.replies.first.replies, isEmpty);
    });

    test('삭제된 댓글은 작성자가 없고 삭제 상태로 표시된다', () {
      final deleted = CommentModel.fromJson({
        'id': 1,
        'postId': 10,
        'content': '삭제된 댓글입니다.',
        'status': 'deleted',
        'likeCount': 0,
        'author': null,
        'createdAt': '2026-09-03T10:00:00.000Z',
        'replies': [],
      });

      // 서버가 작성자를 null로 가려서 내려준다. 화면은 그 상태에서
      // 수정/삭제/좋아요 버튼을 모두 숨겨야 한다.
      expect(deleted.isDeleted, isTrue);
      expect(deleted.author, isNull);
      expect(deleted.authorLabel, '알 수 없음');
    });

    test('replies 키가 아예 없어도 깨지지 않는다', () {
      final comment = CommentModel.fromJson({
        'id': 1,
        'postId': 10,
        'content': '답글',
        'createdAt': '2026-09-03T10:00:00.000Z',
      });

      expect(comment.replies, isEmpty);
    });
  });

  group('CommunityDashboardModel', () {
    test('대시보드 전체를 파싱한다', () {
      final dashboard = CommunityDashboardModel.fromJson({
        'trending': [
          {'id': 1, 'title': '인기글', 'createdAt': '2026-09-03T10:00:00.000Z'},
        ],
        'latest': [
          {'id': 2, 'title': '최신글', 'createdAt': '2026-09-03T11:00:00.000Z'},
        ],
        'categories': [
          {'id': 1, 'code': 'free', 'name': '자유게시판', 'postCount': 12, 'todayCount': 2},
        ],
        'festivalTalk': [
          {
            'festival': {
              'id': 5,
              'name': '축제',
              'startDate': '2026-11-05',
              'endDate': '2026-11-07',
            },
            'postCount': 4,
          },
        ],
        'myActivity': {'postCount': 3, 'commentCount': 7, 'receivedReactionCount': 20},
      });

      expect(dashboard.trending.first.title, '인기글');
      expect(dashboard.categories.first.hasNewToday, isTrue);
      expect(dashboard.festivalTalk.first.postCount, 4);
      expect(dashboard.myActivity?.receivedReactionCount, 20);
      expect(dashboard.isEmpty, isFalse);
    });

    test('비로그인 응답은 myActivity가 없다', () {
      final dashboard = CommunityDashboardModel.fromJson({
        'trending': [],
        'latest': [],
        'categories': [],
        'festivalTalk': [],
        'myActivity': null,
      });

      expect(dashboard.myActivity, isNull);
      expect(dashboard.isEmpty, isTrue);
    });

    test('글이 없는 게시판도 목록에 남는다', () {
      final dashboard = CommunityDashboardModel.fromJson({
        'categories': [
          {'id': 1, 'code': 'notice', 'name': '공지사항', 'postCount': 0, 'todayCount': 0},
        ],
      });

      // 글이 없다고 게시판이 화면에서 사라지면 안 된다.
      expect(dashboard.categories, hasLength(1));
      expect(dashboard.categories.first.hasNewToday, isFalse);
    });
  });

  group('내 활동 모델', () {
    test('내 댓글에는 원글이 함께 온다 (작성일 없이도 파싱된다)', () {
      final comment = MyCommentModel.fromJson({
        'id': 1,
        'postId': 10,
        'parentId': 5,
        'content': '내 댓글',
        'likeCount': 1,
        'createdAt': '2026-09-03T10:00:00.000Z',
        // 서버는 내 댓글의 원글에 id/제목/게시판만 담아 보낸다. (작성일 없음)
        'post': {'id': 10, 'title': '원글 제목'},
      });

      // 댓글만 보여주면 무슨 글에 단 댓글인지 알 수 없다.
      expect(comment.post.title, '원글 제목');
      expect(comment.isReply, isTrue);
    });

    test('내 반응에는 반응 종류가 함께 온다', () {
      final reaction = MyReactionModel.fromJson({
        'id': 1,
        'type': 'wow',
        'createdAt': '2026-09-03T10:00:00.000Z',
        'post': {'id': 10, 'title': '반응한 글', 'createdAt': '2026-09-03T09:00:00.000Z'},
      });

      expect(reaction.type, 'wow');
      expect(reaction.post.title, '반응한 글');
    });
  });

  group('PagedResult', () {
    test('다음 페이지가 남았는지 판단한다', () {
      final first = PagedResult.fromJson(
        {'items': [], 'total': 50, 'page': 1, 'totalPages': 3},
        (json) => json,
      );
      final last = PagedResult.fromJson(
        {'items': [], 'total': 50, 'page': 3, 'totalPages': 3},
        (json) => json,
      );

      // 이 판단이 틀리면 무한 스크롤이 멈추지 않거나 마지막 페이지를 못 불러온다.
      expect(first.hasMore, isTrue);
      expect(last.hasMore, isFalse);
    });

    test('items 키가 없어도 빈 목록으로 처리한다', () {
      final result = PagedResult.fromJson({'total': 0}, (json) => json);
      expect(result.items, isEmpty);
      expect(result.hasMore, isFalse);
    });
  });

  group('반응 종류 정의', () {
    test('서버 ENUM과 같은 5종을 정의한다', () {
      // 앱이 서버에 없는 종류를 보내면 400이 난다.
      expect(reactionTypes, ['like', 'love', 'wow', 'sad', 'angry']);
    });

    test('모든 종류에 이모지와 이름이 있다', () {
      for (final type in reactionTypes) {
        expect(reactionEmojis[type], isNotNull, reason: '$type 이모지 누락');
        expect(reactionLabels[type], isNotNull, reason: '$type 이름 누락');
      }
    });

    test('모르는 종류가 와도 화면이 깨지지 않는다', () {
      // 서버가 앱보다 먼저 새 종류를 추가할 수 있다.
      expect(emojiOf('unknown'), isNotEmpty);
      expect(labelOf(null), isNotEmpty);
    });
  });

  group('NotificationModel', () {
    test('커뮤니티 알림은 게시글 ID를 가진다', () {
      final notification = NotificationModel.fromJson({
        'id': 1,
        'type': 'post_comment',
        'title': '내 글에 댓글이 달렸어요',
        'body': '새 댓글이 달렸습니다.',
        'postId': 10,
        'festivalId': null,
      });

      // 이 값으로 축제 상세가 아니라 게시글 상세로 보낸다.
      expect(notification.isCommunity, isTrue);
      expect(notification.postId, 10);
    });

    test('축제 알림은 커뮤니티 알림이 아니다', () {
      final notification = NotificationModel.fromJson({
        'id': 1,
        'type': 'schedule_reminder',
        'title': '내일 방문 예정',
        'body': '축제 방문일이 내일입니다.',
        'festivalId': 5,
      });

      expect(notification.isCommunity, isFalse);
      expect(notification.festivalId, 5);
    });
  });

  group('첨부 이미지', () {
    test('상대 경로에 서버 주소를 붙인다', () {
      final image = PostImageModel.fromJson({
        'id': 1,
        'url': '/uploads/posts/abc.jpg',
        'sortOrder': 0,
      });

      expect(image.fullUrl, startsWith('http'));
      expect(image.fullUrl, endsWith('/uploads/posts/abc.jpg'));
    });

    test('전체 URL은 그대로 쓴다', () {
      // 저장소를 S3로 옮기면 서버가 전체 URL을 준다. 두 경우 모두 다뤄야 한다.
      final image = PostImageModel.fromJson({
        'id': 1,
        'url': 'https://cdn.example.com/posts/abc.jpg',
      });

      expect(image.fullUrl, 'https://cdn.example.com/posts/abc.jpg');
    });

    test('목록 응답처럼 images가 없으면 빈 목록', () {
      final post = PostModel.fromJson({
        'id': 1,
        'title': 'x',
        'createdAt': '2026-09-03T10:00:00.000Z',
      });

      expect(post.images, isEmpty);
    });

    test('상세 응답의 이미지를 순서대로 담는다', () {
      final post = PostModel.fromJson({
        'id': 1,
        'title': 'x',
        'createdAt': '2026-09-03T10:00:00.000Z',
        'images': [
          {'id': 1, 'url': '/uploads/posts/a.jpg', 'sortOrder': 0},
          {'id': 2, 'url': '/uploads/posts/b.jpg', 'sortOrder': 1},
        ],
      });

      expect(post.images.map((i) => i.sortOrder), [0, 1]);
    });
  });

  group('신고 사유', () {
    test('서버 ENUM과 같은 5종을 정의한다', () {
      expect(
        ReportReason.values.map((r) => r.code),
        ['spam', 'abuse', 'adult', 'commercial', 'etc'],
      );
    });

    test("'기타'만 설명을 요구한다", () {
      // 설명 없는 '기타' 신고는 운영자가 무엇을 봐야 할지 알 수 없다.
      expect(ReportReason.etc.requiresDetail, isTrue);
      for (final reason in ReportReason.values.where((r) => r != ReportReason.etc)) {
        expect(reason.requiresDetail, isFalse, reason: '\${reason.code}');
      }
    });
  });

  group('ReportModel', () {
    test('게시글 신고를 파싱한다', () {
      final report = ReportModel.fromJson({
        'id': 1,
        'targetType': 'post',
        'reason': 'spam',
        'detail': null,
        'status': 'pending',
        'createdAt': '2026-09-03T10:00:00.000Z',
        'reporter': {'id': 2, 'name': '홍길동', 'nickname': '길동이'},
        'post': {'id': 10, 'title': '신고된 글', 'status': 'published'},
      });

      expect(report.isPost, isTrue);
      expect(report.reasonLabel, '광고 / 스팸');
      expect(report.targetSummary, '신고된 글');
      expect(report.post?.isHidden, isFalse);
    });

    test('댓글 신고를 파싱한다', () {
      final report = ReportModel.fromJson({
        'id': 2,
        'targetType': 'comment',
        'reason': 'abuse',
        'status': 'pending',
        'createdAt': '2026-09-03T10:00:00.000Z',
        'comment': {'id': 5, 'postId': 10, 'content': '문제 댓글', 'status': 'published'},
      });

      expect(report.isPost, isFalse);
      expect(report.targetSummary, '문제 댓글');
      // 신고자가 탈퇴한 경우에도 목록이 깨지지 않아야 한다.
      expect(report.reporter, isNull);
    });

    test('대상이 이미 가려졌는지 알 수 있다', () {
      final report = ReportModel.fromJson({
        'id': 1,
        'targetType': 'post',
        'reason': 'spam',
        'status': 'pending',
        'createdAt': '2026-09-03T10:00:00.000Z',
        'post': {'id': 10, 'title': '숨겨진 글', 'status': 'hidden'},
      });

      // 운영자가 중복 조치하지 않도록 표시해야 한다.
      expect(report.post?.isHidden, isTrue);
    });
  });

  group('UserModel 권한', () {
    test('운영자를 구분한다', () {
      final base = {'id': 1, 'email': 'a@b.com', 'name': '홍길동'};

      expect(UserModel.fromJson({...base, 'role': 'admin'}).isAdmin, isTrue);
      expect(UserModel.fromJson({...base, 'role': 'user'}).isAdmin, isFalse);
      // role이 없으면 일반 회원으로 본다. 권한을 기본값으로 주면 안 된다.
      expect(UserModel.fromJson(base).isAdmin, isFalse);
    });
  });
}