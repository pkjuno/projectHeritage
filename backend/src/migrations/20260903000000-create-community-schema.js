'use strict';

/**
 * 커뮤니티(게시판) 스키마 마이그레이션.
 *
 * 게시글/댓글/반응/공유/조회 로그를 한 번에 만든다.
 * 설계 배경과 대안 비교는 docs/COMMUNITY_PLAN.md 4장을 참고할 것.
 *
 * 실행: npm run db:migrate
 */

// 모든 테이블이 공통으로 갖는 타임스탬프 컬럼
const timestamps = (Sequelize) => ({
  created_at: { type: Sequelize.DATE, allowNull: false },
  updated_at: { type: Sequelize.DATE, allowNull: false },
});

// 기본 키 (자동 증가 정수)
const primaryKey = (Sequelize) => ({
  type: Sequelize.INTEGER,
  primaryKey: true,
  autoIncrement: true,
  allowNull: false,
});

/**
 * 외래키 컬럼 정의를 만든다.
 * @param {object} Sequelize
 * @param {string} table - 참조할 테이블
 * @param {{allowNull?: boolean, onDelete?: string}} [options]
 */
const foreignKey = (Sequelize, table, { allowNull = false, onDelete = 'CASCADE' } = {}) => ({
  type: Sequelize.INTEGER,
  allowNull,
  references: { model: table, key: 'id' },
  onUpdate: 'CASCADE',
  onDelete,
});

/**
 * 비정규화 카운터 컬럼. 0부터 시작하고 NULL을 허용하지 않는다.
 *
 * NULL을 허용하면 `count + 1`이 NULL이 되는 사고가 나므로 반드시 NOT NULL DEFAULT 0으로 둔다.
 */
const counter = (Sequelize) => ({
  type: Sequelize.INTEGER,
  allowNull: false,
  defaultValue: 0,
});

module.exports = {
  async up(queryInterface, Sequelize) {
    // ------------------------------------------------------------------
    // 1. 게시판 마스터
    // ------------------------------------------------------------------
    // ENUM이 아니라 테이블로 둔 이유:
    //  - 게시판을 하나 추가할 때마다 마이그레이션을 돌리지 않아도 된다.
    //  - "관리자만 쓰기 가능", "축제 연결 필수" 같은 게시판별 정책을 컬럼으로 표현할 수 있다.
    await queryInterface.createTable('board_categories', {
      id: primaryKey(Sequelize),
      // 코드값. API의 ?category= 파라미터로 쓰이므로 숫자 ID 대신 이걸 노출한다.
      code: { type: Sequelize.STRING(30), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(50), allowNull: false },
      description: { type: Sequelize.STRING(200), allowNull: true },
      // 이 게시판에 글을 쓸 수 있는 최소 권한. 공지사항은 'admin'.
      write_role: {
        type: Sequelize.ENUM('user', 'admin'),
        allowNull: false,
        defaultValue: 'user',
      },
      // true면 글 작성 시 festival_id가 반드시 있어야 한다. (축제 후기 게시판)
      require_festival: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      // 게시판 목록 노출 순서
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      // 게시판을 닫을 때 행을 지우지 않고 이 값을 false로 만든다. (기존 글이 사라지면 안 되므로)
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      ...timestamps(Sequelize),
    });

    // ------------------------------------------------------------------
    // 2. 게시글
    // ------------------------------------------------------------------
    await queryInterface.createTable('posts', {
      id: primaryKey(Sequelize),
      // 게시판. 카테고리를 지운다고 글이 사라지면 안 되므로 CASCADE가 아니다.
      // (게시판을 닫을 때는 board_categories.is_active = false를 쓴다)
      category_id: foreignKey(Sequelize, 'board_categories', { onDelete: 'NO ACTION' }),
      user_id: foreignKey(Sequelize, 'users'),
      // 연결된 축제. 자유 글은 NULL이다.
      // 축제 데이터는 공공데이터 재적재로 지워질 수 있는데 그때 글까지 날아가면 안 되므로 SET NULL.
      festival_id: foreignKey(Sequelize, 'festivals', { allowNull: true, onDelete: 'SET NULL' }),
      title: { type: Sequelize.STRING(200), allowNull: false },
      content: { type: Sequelize.TEXT, allowNull: false },
      // published: 정상 / hidden: 관리자 블라인드 / deleted: 작성자 삭제
      // 물리 삭제를 하지 않는 이유는 신고 처리 이력과 통계가 같이 날아가기 때문이다.
      status: {
        type: Sequelize.ENUM('published', 'hidden', 'deleted'),
        allowNull: false,
        defaultValue: 'published',
      },
      // 관리자가 목록 상단에 고정한 글
      is_pinned: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      // 비정규화 카운터. 원본 테이블을 COUNT(*)하지 않고 정렬/표시에 바로 쓴다.
      view_count: counter(Sequelize),
      comment_count: counter(Sequelize),
      reaction_count: counter(Sequelize),
      share_count: counter(Sequelize),
      deleted_at: { type: Sequelize.DATE, allowNull: true },
      ...timestamps(Sequelize),
    });

    // 게시판별 최신순 목록 (가장 많이 쓰이는 조회)
    await queryInterface.addIndex('posts', ['category_id', 'status', 'created_at'], {
      name: 'idx_post_category_status_created',
    });
    // 전체 최신글 / 대시보드
    await queryInterface.addIndex('posts', ['status', 'created_at'], {
      name: 'idx_post_status_created',
    });
    // 내가 쓴 글
    await queryInterface.addIndex('posts', ['user_id', 'created_at'], {
      name: 'idx_post_user_created',
    });
    // 축제 상세의 "이 축제 후기"
    await queryInterface.addIndex('posts', ['festival_id', 'status', 'created_at'], {
      name: 'idx_post_festival_status_created',
    });

    // ------------------------------------------------------------------
    // 3. 댓글 / 대댓글
    // ------------------------------------------------------------------
    await queryInterface.createTable('post_comments', {
      id: primaryKey(Sequelize),
      post_id: foreignKey(Sequelize, 'posts'),
      user_id: foreignKey(Sequelize, 'users'),
      // 최상위 댓글이면 NULL, 대댓글이면 부모 댓글 ID.
      // 깊이는 1단계까지만 허용한다. 대댓글에 단 답글도 parent_id는 최상위 댓글로 고정한다.
      // (무한 depth는 모바일 들여쓰기가 감당되지 않고 조회가 재귀로 간다)
      parent_id: foreignKey(Sequelize, 'post_comments', { allowNull: true }),
      content: { type: Sequelize.TEXT, allowNull: false },
      // 삭제된 댓글은 행을 지우지 않는다. 자식 대댓글이 붙어 있으면 대화 맥락이 끊기기 때문에
      // "삭제된 댓글입니다"로 표시하고 자리를 남긴다.
      status: {
        type: Sequelize.ENUM('published', 'deleted'),
        allowNull: false,
        defaultValue: 'published',
      },
      like_count: counter(Sequelize),
      ...timestamps(Sequelize),
    });

    // 한 게시글의 댓글을 부모-자식 묶음으로 정렬해 읽을 때 사용
    await queryInterface.addIndex('post_comments', ['post_id', 'parent_id', 'created_at'], {
      name: 'idx_comment_post_parent_created',
    });
    // 내가 쓴 댓글
    await queryInterface.addIndex('post_comments', ['user_id', 'created_at'], {
      name: 'idx_comment_user_created',
    });

    // ------------------------------------------------------------------
    // 4. 게시글 반응 (좋아요 + 공감 통합)
    // ------------------------------------------------------------------
    // 좋아요와 공감을 따로 두지 않는다. 한 사람은 글 하나에 반응을 하나만 남기고,
    // '좋아요'에서 '슬퍼요'로 바꾸면 type만 갈아탄다. (페이스북 방식)
    // 따로 두면 "좋아요 12 / 공감 8"의 의미가 모호하고 인기글 정렬 기준이 둘로 쪼개진다.
    await queryInterface.createTable('post_reactions', {
      id: primaryKey(Sequelize),
      post_id: foreignKey(Sequelize, 'posts'),
      user_id: foreignKey(Sequelize, 'users'),
      type: {
        type: Sequelize.ENUM('like', 'love', 'wow', 'sad', 'angry'),
        allowNull: false,
        defaultValue: 'like',
      },
      ...timestamps(Sequelize),
    });

    // 한 회원은 한 게시글에 반응을 하나만 남긴다. (이 제약이 곧 "반응 = 1인 1표"라는 정책이다)
    await queryInterface.addIndex('post_reactions', ['user_id', 'post_id'], {
      name: 'uq_reaction_user_post',
      unique: true,
    });
    // 게시글 상세에서 타입별 개수를 집계할 때 사용
    await queryInterface.addIndex('post_reactions', ['post_id', 'type'], {
      name: 'idx_reaction_post_type',
    });

    // ------------------------------------------------------------------
    // 5. 댓글 좋아요
    // ------------------------------------------------------------------
    // 댓글은 이모지 반응까지 필요하지 않아 단순 좋아요만 둔다.
    // post_reactions와 합쳐 다형(polymorphic) 테이블로 만들 수도 있지만,
    // 그러면 외래키 제약을 걸 수 없어 이 프로젝트의 다른 테이블과 정합성 보장 수준이 달라진다.
    await queryInterface.createTable('comment_likes', {
      id: primaryKey(Sequelize),
      comment_id: foreignKey(Sequelize, 'post_comments'),
      user_id: foreignKey(Sequelize, 'users'),
      ...timestamps(Sequelize),
    });

    await queryInterface.addIndex('comment_likes', ['user_id', 'comment_id'], {
      name: 'uq_comment_like_user_comment',
      unique: true,
    });

    // ------------------------------------------------------------------
    // 6. 조회 로그 (조회수 중복 집계 방지)
    // ------------------------------------------------------------------
    // 상세를 열 때마다 +1 하면 새로고침으로 숫자가 부풀고 인기글 순위가 오염된다.
    // 그래서 "누가/어떤 글을/어느 날" 봤는지를 기록하고 하루 1회만 카운트한다.
    await queryInterface.createTable('post_views', {
      id: primaryKey(Sequelize),
      post_id: foreignKey(Sequelize, 'posts'),
      // 조회자 식별키. 로그인 회원은 'u:{userId}', 비로그인은 'a:{IP 해시}'.
      // 두 경우를 한 컬럼으로 합쳐야 유니크 제약 하나로 중복을 막을 수 있다.
      // IP 원문은 저장하지 않는다. (개인정보를 남기지 않기 위해 해시만 보관)
      viewer_key: { type: Sequelize.STRING(64), allowNull: false },
      view_date: { type: Sequelize.DATEONLY, allowNull: false },
      ...timestamps(Sequelize),
    });

    // 같은 사람이 같은 글을 같은 날 여러 번 봐도 행은 하나다.
    await queryInterface.addIndex('post_views', ['post_id', 'viewer_key', 'view_date'], {
      name: 'uq_post_view_post_viewer_date',
      unique: true,
    });
    // 오래된 로그를 날짜로 잘라 정리하는 배치에서 사용
    await queryInterface.addIndex('post_views', ['view_date'], { name: 'idx_post_view_date' });

    // ------------------------------------------------------------------
    // 7. 공유 로그
    // ------------------------------------------------------------------
    // 같은 사람이 여러 번 공유할 수 있으므로 유니크 제약이 없다.
    // 이 값은 클라이언트가 "공유했다"고 알려주는 자진신고 지표라 정확한 유입 수치가 아니다.
    // 실제 유입은 나중에 딥링크 파라미터로 따로 측정해야 한다.
    await queryInterface.createTable('post_shares', {
      id: primaryKey(Sequelize),
      post_id: foreignKey(Sequelize, 'posts'),
      // 비로그인 공유도 기록할 수 있게 NULL을 허용한다.
      user_id: foreignKey(Sequelize, 'users', { allowNull: true, onDelete: 'SET NULL' }),
      channel: {
        type: Sequelize.ENUM('link', 'kakao', 'etc'),
        allowNull: false,
        defaultValue: 'link',
      },
      ...timestamps(Sequelize),
    });

    await queryInterface.addIndex('post_shares', ['post_id', 'created_at'], {
      name: 'idx_post_share_post_created',
    });
  },

  async down(queryInterface) {
    // 외래키 제약 때문에 참조하는 쪽(자식 테이블)부터 지운다.
    await queryInterface.dropTable('post_shares');
    await queryInterface.dropTable('post_views');
    await queryInterface.dropTable('comment_likes');
    await queryInterface.dropTable('post_reactions');
    await queryInterface.dropTable('post_comments');
    await queryInterface.dropTable('posts');
    await queryInterface.dropTable('board_categories');
  },
};
