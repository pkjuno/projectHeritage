const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./user.model');
const Post = require('./post.model');

/**
 * 댓글 / 대댓글 모델.
 *
 * 깊이는 1단계(댓글 -> 대댓글)까지만 허용한다.
 * 대댓글에 다시 답글을 달면 parentId를 최상위 댓글로 고정하고 본문에 멘션만 남긴다.
 * 무한 depth는 모바일 화면에서 들여쓰기를 감당할 수 없고 조회가 재귀 쿼리로 간다.
 */
class PostComment extends Model {
  /**
   * 대댓글인지 여부.
   * @returns {boolean}
   */
  isReply() {
    return this.parentId !== null;
  }

  /**
   * 이 댓글을 수정할 수 있는 회원인지 판단한다. (작성자 본인만)
   * @param {{id: number}} user
   * @returns {boolean}
   */
  isEditableBy(user) {
    return Boolean(user) && this.userId === user.id;
  }

  /**
   * 이 댓글을 삭제할 수 있는 회원인지 판단한다. (작성자 본인 또는 운영자)
   * @param {{id: number, role: string}} user
   * @returns {boolean}
   */
  isDeletableBy(user) {
    if (!user) return false;
    return this.userId === user.id || user.role === 'admin';
  }
}

PostComment.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    // 댓글이 달린 게시글 (Post FK)
    postId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // 작성자 (User FK)
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // 최상위 댓글이면 NULL, 대댓글이면 부모 댓글 ID.
    // 대댓글의 대댓글도 이 값은 항상 "최상위 댓글"을 가리킨다. (깊이 1단계 고정)
    parentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    // 삭제된 댓글은 행을 지우지 않는다.
    // 자식 대댓글이 붙어 있는 댓글을 물리 삭제하면 대화 맥락이 끊기기 때문에
    // 자리를 남기고 "삭제된 댓글입니다"로 표시한다.
    status: {
      type: DataTypes.ENUM('published', 'deleted'),
      allowNull: false,
      defaultValue: 'published',
    },

    // 비정규화 카운터 (comment_likes의 개수)
    likeCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    modelName: 'PostComment',
    tableName: 'post_comments',
    timestamps: true,
    indexes: [
      // 한 게시글의 댓글을 부모-자식 묶음으로 정렬해 읽을 때 사용한다.
      {
        fields: ['post_id', 'parent_id', 'created_at'],
        name: 'idx_comment_post_parent_created',
      },
      // 내가 쓴 댓글
      { fields: ['user_id', 'created_at'], name: 'idx_comment_user_created' },
    ],
  }
);

// 게시글이 실제로 삭제되면 댓글도 함께 정리된다.
Post.hasMany(PostComment, { foreignKey: 'postId', as: 'comments', onDelete: 'CASCADE' });
PostComment.belongsTo(Post, { foreignKey: 'postId', as: 'post' });

User.hasMany(PostComment, { foreignKey: 'userId', as: 'comments', onDelete: 'CASCADE' });
PostComment.belongsTo(User, { foreignKey: 'userId', as: 'author' });

// 부모 댓글 <-> 대댓글 (자기 참조)
PostComment.hasMany(PostComment, { foreignKey: 'parentId', as: 'replies', onDelete: 'CASCADE' });
PostComment.belongsTo(PostComment, { foreignKey: 'parentId', as: 'parent' });

module.exports = PostComment;
