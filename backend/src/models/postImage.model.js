const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');
const Post = require('./post.model');

/**
 * 게시글 첨부 이미지 모델.
 *
 * 이미지를 본문에 URL로 박아 넣지 않고 별도 행으로 두는 이유:
 *  - 저장소를 옮길 때(로컬 디스크 -> S3) 본문을 찾아 고치지 않아도 된다.
 *  - 글이 지워질 때 어떤 파일을 정리해야 하는지 알 수 있다.
 *  - 첨부 개수를 제한하거나 순서를 바꾸는 일이 쿼리로 처리된다.
 */
class PostImage extends Model {}

PostImage.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    // 첨부된 게시글 (Post FK)
    postId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // 저장소가 돌려준 경로. 로컬이면 '/uploads/posts/xxx.jpg', S3면 전체 URL.
    url: {
      type: DataTypes.STRING(500),
      allowNull: false,
    },

    // 원본 파일명. 표시용일 뿐, 이 값으로 파일을 찾지 않는다.
    // 클라이언트가 보낸 이름을 경로로 쓰면 상위 디렉터리 접근에 노출된다.
    originalName: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    sizeBytes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    // 글 안에서의 표시 순서
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    modelName: 'PostImage',
    tableName: 'post_images',
    timestamps: true,
    indexes: [{ fields: ['post_id', 'sort_order'], name: 'idx_post_image_post_sort' }],
  }
);

Post.hasMany(PostImage, { foreignKey: 'postId', as: 'images', onDelete: 'CASCADE' });
PostImage.belongsTo(Post, { foreignKey: 'postId', as: 'post' });

module.exports = PostImage;
