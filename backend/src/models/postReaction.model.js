const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./user.model');
const Post = require('./post.model');

/** 사용할 수 있는 반응 타입. 화면의 이모지 순서와 같다. */
const REACTION_TYPES = ['like', 'love', 'wow', 'sad', 'angry'];

/**
 * 게시글 반응 모델. (좋아요 + 공감 통합)
 *
 * 좋아요와 공감을 따로 두지 않는다. 한 회원은 글 하나에 반응을 **하나만** 남기고,
 * '좋아요'에서 '슬퍼요'로 바꾸면 type만 갈아탄다. (페이스북 방식)
 *
 * 따로 뒀다면 "좋아요 12 / 공감 8"이 무슨 뜻인지 사용자가 해석하기 어렵고
 * 인기글 정렬 기준도 둘로 쪼개진다. 좋아요는 곧 type='like'이며,
 * 화면에는 전체 개수(reactionCount)와 타입별 분포를 함께 내려주면 둘 다 표현할 수 있다.
 */
class PostReaction extends Model {}

PostReaction.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    // 반응 대상 게시글 (Post FK)
    postId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // 반응한 회원 (User FK)
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // 반응 종류. 'like'가 곧 좋아요다.
    type: {
      type: DataTypes.ENUM(...REACTION_TYPES),
      allowNull: false,
      defaultValue: 'like',
    },
  },
  {
    sequelize,
    modelName: 'PostReaction',
    tableName: 'post_reactions',
    timestamps: true,
    indexes: [
      // 한 회원은 한 게시글에 반응을 하나만 남긴다.
      // 이 제약이 곧 "반응은 1인 1표"라는 정책 그 자체다.
      { unique: true, fields: ['user_id', 'post_id'], name: 'uq_reaction_user_post' },
      // 게시글 상세에서 타입별 개수를 집계할 때 사용한다.
      { fields: ['post_id', 'type'], name: 'idx_reaction_post_type' },
    ],
  }
);

Post.hasMany(PostReaction, { foreignKey: 'postId', as: 'reactions', onDelete: 'CASCADE' });
PostReaction.belongsTo(Post, { foreignKey: 'postId', as: 'post' });

User.hasMany(PostReaction, { foreignKey: 'userId', as: 'reactions', onDelete: 'CASCADE' });
PostReaction.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// 서비스/검증 계층에서 허용 타입 목록이 필요하므로 모델에 붙여 함께 내보낸다.
PostReaction.REACTION_TYPES = REACTION_TYPES;

module.exports = PostReaction;
