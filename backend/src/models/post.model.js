const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./user.model');
const Festival = require('./festival.model');
const BoardCategory = require('./boardCategory.model');

/**
 * 게시글 모델.
 *
 * 일반 게시판이 아니라 **축제와 연결되는 게시판**이다.
 * festivalId를 선택적으로 가질 수 있어서, 축제 상세 화면에 "이 축제 후기"를 붙이고
 * 대시보드에 "지금 이야기가 많은 축제"를 낼 수 있다. 자유 글은 festivalId가 NULL이다.
 *
 * 조회수/댓글수/반응수/공유수는 비정규화 카운터다. 자세한 이유는 각 컬럼 주석 참고.
 */
class Post extends Model {
  /**
   * 이 글을 수정할 수 있는 회원인지 판단한다.
   *
   * 운영자에게도 수정 권한을 주지 않는다. 남의 글 내용을 바꿀 수 있다는 것 자체가 사고 원인이고,
   * 문제가 있는 글은 고치는 게 아니라 숨기는(hidden) 것이 맞다.
   * @param {{id: number}} user
   * @returns {boolean}
   */
  isEditableBy(user) {
    return Boolean(user) && this.userId === user.id;
  }

  /**
   * 이 글을 삭제할 수 있는 회원인지 판단한다. (작성자 본인 또는 운영자)
   * @param {{id: number, role: string}} user
   * @returns {boolean}
   */
  isDeletableBy(user) {
    if (!user) return false;
    return this.userId === user.id || user.role === 'admin';
  }

  /**
   * 목록/상세에 노출되는 상태인지 여부.
   * @returns {boolean}
   */
  isVisible() {
    return this.status === 'published';
  }
}

Post.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    // 게시판 (BoardCategory FK)
    categoryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // 작성자 (User FK)
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // 연결된 축제 (Festival FK, 선택).
    // 공공데이터 재적재로 축제가 지워져도 글은 남아야 하므로 FK는 SET NULL이다.
    festivalId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },

    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    // published: 정상 / hidden: 운영자 블라인드 / deleted: 작성자 삭제
    // 물리 삭제를 하지 않는 이유는 신고 처리 이력과 통계가 함께 사라지기 때문이다.
    status: {
      type: DataTypes.ENUM('published', 'hidden', 'deleted'),
      allowNull: false,
      defaultValue: 'published',
    },

    // 운영자가 목록 상단에 고정한 글
    isPinned: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    // --- 아래 4개는 비정규화 카운터 ---
    // 매번 COUNT(*)로 세지 않는 이유: 인기글 정렬(ORDER BY reaction_count DESC)에 인덱스를 태워야 하는데
    // 집계 함수로는 불가능하다. 글이 늘어날수록 목록 API가 그대로 느려진다.
    // 대신 원본과 어긋날 수 있으므로 (1) 증감을 트랜잭션 안에서 처리하고
    // (2) 보정 스크립트로 대조하며 (3) 테스트로 정합성을 검증한다.
    // NULL을 허용하지 않는 이유는 `count + 1`이 NULL이 되는 사고를 막기 위해서다.
    viewCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    commentCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    reactionCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    shareCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    // 삭제 시각 (status='deleted'와 함께 기록)
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Post',
    tableName: 'posts',
    timestamps: true,
    indexes: [
      // 게시판별 최신순 목록 (가장 많이 쓰이는 조회)
      {
        fields: ['category_id', 'status', 'created_at'],
        name: 'idx_post_category_status_created',
      },
      // 전체 최신글 / 대시보드
      { fields: ['status', 'created_at'], name: 'idx_post_status_created' },
      // 내가 쓴 글
      { fields: ['user_id', 'created_at'], name: 'idx_post_user_created' },
      // 축제 상세의 "이 축제 후기"
      {
        fields: ['festival_id', 'status', 'created_at'],
        name: 'idx_post_festival_status_created',
      },
    ],
  }
);

// 게시판이 지워진다고 글이 사라지면 안 되므로 CASCADE가 아니다.
// (게시판을 닫을 때는 BoardCategory.isActive = false를 쓴다)
BoardCategory.hasMany(Post, { foreignKey: 'categoryId', as: 'posts', onDelete: 'NO ACTION' });
Post.belongsTo(BoardCategory, { foreignKey: 'categoryId', as: 'category' });

// 회원이 실제로 삭제되면 글도 함께 정리된다. (탈퇴는 status 변경이라 글이 남는다)
User.hasMany(Post, { foreignKey: 'userId', as: 'posts', onDelete: 'CASCADE' });
Post.belongsTo(User, { foreignKey: 'userId', as: 'author' });

// 축제가 지워져도 글은 남고 연결만 끊긴다.
Festival.hasMany(Post, { foreignKey: 'festivalId', as: 'posts', onDelete: 'SET NULL' });
Post.belongsTo(Festival, { foreignKey: 'festivalId', as: 'festival' });

module.exports = Post;
