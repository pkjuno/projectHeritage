const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./user.model');
const Post = require('./post.model');

/** 공유 채널. 어떤 경로로 공유되는지 파악하기 위해 남긴다. */
const SHARE_CHANNELS = ['link', 'kakao', 'etc'];

/**
 * 게시글 공유 로그 모델.
 *
 * 같은 사람이 여러 번 공유할 수 있으므로 유니크 제약이 없다. (반응/좋아요와 다른 점)
 *
 * 주의: 이 값은 클라이언트가 "공유했다"고 알려주는 **자진신고 지표**다.
 * 공유 버튼을 눌렀을 뿐 실제로 전송했는지는 알 수 없으므로 정확한 유입 수치가 아니다.
 * 실제 유입은 나중에 딥링크 파라미터로 따로 측정해야 한다.
 */
class PostShare extends Model {}

PostShare.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    // 공유된 게시글 (Post FK)
    postId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // 공유한 회원 (User FK). 비로그인 공유도 기록할 수 있게 NULL을 허용한다.
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    // 공유 채널
    channel: {
      type: DataTypes.ENUM(...SHARE_CHANNELS),
      allowNull: false,
      defaultValue: 'link',
    },
  },
  {
    sequelize,
    modelName: 'PostShare',
    tableName: 'post_shares',
    timestamps: true,
    indexes: [
      // 기간별 공유 추이를 볼 때 사용한다.
      { fields: ['post_id', 'created_at'], name: 'idx_post_share_post_created' },
    ],
  }
);

Post.hasMany(PostShare, { foreignKey: 'postId', as: 'shares', onDelete: 'CASCADE' });
PostShare.belongsTo(Post, { foreignKey: 'postId', as: 'post' });

// 회원이 삭제돼도 공유 통계는 남아야 하므로 연결만 끊는다.
User.hasMany(PostShare, { foreignKey: 'userId', as: 'shares', onDelete: 'SET NULL' });
PostShare.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// 서비스/검증 계층에서 허용 채널 목록이 필요하므로 모델에 붙여 함께 내보낸다.
PostShare.SHARE_CHANNELS = SHARE_CHANNELS;

module.exports = PostShare;
