const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./user.model');
const PostComment = require('./postComment.model');
const PostReport = require('./postReport.model');

/**
 * 댓글 신고 모델.
 *
 * 게시글 신고(PostReport)와 컬럼 구성이 같다. 대상이 다를 뿐이다.
 * 하나의 다형(polymorphic) 테이블로 합치면 외래키 제약을 걸 수 없어,
 * 이 프로젝트의 다른 테이블과 정합성 보장 수준이 달라진다.
 * (post_reactions / comment_likes를 나눈 것과 같은 이유)
 */
class CommentReport extends Model {}

CommentReport.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    // 신고 대상 댓글 (PostComment FK)
    commentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    reporterId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    reason: {
      type: DataTypes.ENUM(...PostReport.REPORT_REASONS),
      allowNull: false,
    },

    detail: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },

    status: {
      type: DataTypes.ENUM(...PostReport.REPORT_STATUSES),
      allowNull: false,
      defaultValue: 'pending',
    },

    handledBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    handledAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'CommentReport',
    tableName: 'comment_reports',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['reporter_id', 'comment_id'],
        name: 'uq_comment_report_reporter_comment',
      },
      { fields: ['status', 'created_at'], name: 'idx_comment_report_status_created' },
      { fields: ['comment_id', 'status'], name: 'idx_comment_report_comment_status' },
    ],
  }
);

PostComment.hasMany(CommentReport, { foreignKey: 'commentId', as: 'reports', onDelete: 'CASCADE' });
CommentReport.belongsTo(PostComment, { foreignKey: 'commentId', as: 'comment' });

User.hasMany(CommentReport, {
  foreignKey: 'reporterId',
  as: 'commentReports',
  onDelete: 'SET NULL',
});
CommentReport.belongsTo(User, { foreignKey: 'reporterId', as: 'reporter' });
CommentReport.belongsTo(User, { foreignKey: 'handledBy', as: 'handler' });

module.exports = CommentReport;
