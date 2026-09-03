const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');
const Post = require('./post.model');

/**
 * 게시글 조회 로그 모델. (조회수 중복 집계 방지용)
 *
 * 상세를 열 때마다 조회수를 +1 하면 새로고침만으로 숫자가 부풀고,
 * 그 숫자가 인기글 점수에 들어가므로 순위까지 오염된다.
 * 그래서 "누가 / 어떤 글을 / 어느 날" 봤는지를 남기고 하루에 한 번만 카운트한다.
 *
 * 로그가 계속 쌓이는 테이블이므로 오래된 행은 배치로 정리해야 한다. (viewDate 인덱스)
 */
class PostView extends Model {
  /**
   * 조회자 식별키를 만든다.
   *
   * 로그인 회원과 비로그인 방문자를 한 컬럼으로 합쳐야
   * 유니크 제약 하나로 두 경우의 중복을 모두 막을 수 있다.
   * 접두사를 붙여두면 나중에 회원 조회만 따로 골라내는 것도 가능하다.
   * @param {{userId?: number, ipHash?: string}} params
   * @returns {string} 'u:{회원ID}' 또는 'a:{IP 해시}'
   */
  static buildViewerKey({ userId, ipHash }) {
    return userId ? `u:${userId}` : `a:${ipHash}`;
  }
}

PostView.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    // 조회된 게시글 (Post FK)
    postId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // 조회자 식별키. 로그인 회원은 'u:{userId}', 비로그인은 'a:{IP 해시}'.
    // IP 원문은 저장하지 않는다. 조회수를 세기 위해 개인 식별 정보를 남길 이유가 없다.
    viewerKey: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },

    // 조회한 날짜. 이 값이 바뀌면(=다음 날) 같은 사람도 다시 카운트된다.
    viewDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'PostView',
    tableName: 'post_views',
    timestamps: true,
    indexes: [
      // 같은 사람이 같은 글을 같은 날 여러 번 봐도 행은 하나다.
      {
        unique: true,
        fields: ['post_id', 'viewer_key', 'view_date'],
        name: 'uq_post_view_post_viewer_date',
      },
      // 오래된 로그를 날짜로 잘라 정리하는 배치에서 사용한다.
      { fields: ['view_date'], name: 'idx_post_view_date' },
    ],
  }
);

Post.hasMany(PostView, { foreignKey: 'postId', as: 'views', onDelete: 'CASCADE' });
PostView.belongsTo(Post, { foreignKey: 'postId', as: 'post' });

module.exports = PostView;
