const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./user.model');
const Post = require('./post.model');

/** 신고 사유. 화면의 선택지와 순서가 같아야 한다. */
const REPORT_REASONS = ['spam', 'abuse', 'adult', 'commercial', 'etc'];

/** 신고 처리 상태. */
const REPORT_STATUSES = ['pending', 'resolved', 'rejected'];

/**
 * 게시글 신고 모델.
 *
 * 신고는 "이 글을 운영자가 봐줬으면 좋겠다"는 **공개 조치 요청**이다.
 * "나만 안 보고 싶다"는 요구는 차단(UserBlock)이 답한다. 둘은 다른 질문이라 합치지 않는다.
 *
 * 신고가 쌓였다고 글이 자동으로 숨겨지지는 않는다. 자동 숨김을 넣으면
 * 여러 계정으로 신고를 몰아 남의 글을 지우는 도구가 된다.
 */
class PostReport extends Model {}

PostReport.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    // 신고 대상 게시글 (Post FK)
    postId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // 신고한 회원 (User FK). 회원이 사라져도 신고 이력은 남아야 하므로 NULL을 허용한다.
    reporterId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    reason: {
      type: DataTypes.ENUM(...REPORT_REASONS),
      allowNull: false,
    },

    // 사유가 'etc'일 때 직접 적는 설명.
    detail: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },

    status: {
      type: DataTypes.ENUM(...REPORT_STATUSES),
      allowNull: false,
      defaultValue: 'pending',
    },

    // 처리한 운영자 (User FK). 누가 판단했는지 남지 않으면 이력의 의미가 없다.
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
    modelName: 'PostReport',
    tableName: 'post_reports',
    timestamps: true,
    indexes: [
      // 한 사람이 같은 글을 여러 번 신고해 처리 목록을 채우는 것을 막는다.
      {
        unique: true,
        fields: ['reporter_id', 'post_id'],
        name: 'uq_post_report_reporter_post',
      },
      // 운영자의 처리 대기 목록 조회
      { fields: ['status', 'created_at'], name: 'idx_post_report_status_created' },
      // 한 글에 신고가 몇 건 쌓였는지 세는 조회
      { fields: ['post_id', 'status'], name: 'idx_post_report_post_status' },
    ],
  }
);

Post.hasMany(PostReport, { foreignKey: 'postId', as: 'reports', onDelete: 'CASCADE' });
PostReport.belongsTo(Post, { foreignKey: 'postId', as: 'post' });

User.hasMany(PostReport, { foreignKey: 'reporterId', as: 'postReports', onDelete: 'SET NULL' });
PostReport.belongsTo(User, { foreignKey: 'reporterId', as: 'reporter' });
PostReport.belongsTo(User, { foreignKey: 'handledBy', as: 'handler' });

PostReport.REPORT_REASONS = REPORT_REASONS;
PostReport.REPORT_STATUSES = REPORT_STATUSES;

module.exports = PostReport;
