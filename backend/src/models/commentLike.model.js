const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./user.model');
const PostComment = require('./postComment.model');

/**
 * 댓글 좋아요 모델.
 *
 * 댓글에는 이모지 반응까지 필요하지 않아 단순 좋아요만 둔다.
 * PostReaction과 하나의 다형(polymorphic) 테이블로 합칠 수도 있지만,
 * 그러면 대상 테이블이 둘이라 외래키 제약을 걸 수 없다.
 * 이 프로젝트의 다른 테이블은 모두 FK로 정합성을 보장하고 있으므로 형태를 맞춘다.
 */
class CommentLike extends Model {}

CommentLike.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    // 좋아요 대상 댓글 (PostComment FK)
    commentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // 좋아요를 누른 회원 (User FK)
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'CommentLike',
    tableName: 'comment_likes',
    timestamps: true,
    indexes: [
      // 한 회원은 한 댓글에 좋아요를 한 번만 누를 수 있다.
      { unique: true, fields: ['user_id', 'comment_id'], name: 'uq_comment_like_user_comment' },
    ],
  }
);

PostComment.hasMany(CommentLike, { foreignKey: 'commentId', as: 'likes', onDelete: 'CASCADE' });
CommentLike.belongsTo(PostComment, { foreignKey: 'commentId', as: 'comment' });

User.hasMany(CommentLike, { foreignKey: 'userId', as: 'commentLikes', onDelete: 'CASCADE' });
CommentLike.belongsTo(User, { foreignKey: 'userId', as: 'user' });

module.exports = CommentLike;
