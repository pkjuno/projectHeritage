'use strict';

/**
 * 커뮤니티 신고/차단 스키마.
 *
 * 신고와 차단은 답하는 질문이 다르다.
 *  - 신고: "이 글을 운영자가 봐줬으면 좋겠다" (공개 조치를 요청)
 *  - 차단: "이 사람 글을 나만 안 보고 싶다" (개인 설정)
 * 그래서 하나로 합치지 않는다.
 *
 * 실행: npm run db:migrate
 */

const timestamps = (Sequelize) => ({
  created_at: { type: Sequelize.DATE, allowNull: false },
  updated_at: { type: Sequelize.DATE, allowNull: false },
});

const primaryKey = (Sequelize) => ({
  type: Sequelize.INTEGER,
  primaryKey: true,
  autoIncrement: true,
  allowNull: false,
});

const foreignKey = (Sequelize, table, { allowNull = false, onDelete = 'CASCADE' } = {}) => ({
  type: Sequelize.INTEGER,
  allowNull,
  references: { model: table, key: 'id' },
  onUpdate: 'CASCADE',
  onDelete,
});

// 신고 사유. 화면의 선택지와 순서가 같아야 한다.
const REASONS = ['spam', 'abuse', 'adult', 'commercial', 'etc'];

// 신고 처리 상태.
const STATUSES = ['pending', 'resolved', 'rejected'];

/**
 * 신고 테이블의 공통 컬럼. 게시글용과 댓글용이 같은 모양을 갖도록 한 곳에서 만든다.
 */
const reportColumns = (Sequelize) => ({
  id: primaryKey(Sequelize),
  // 신고한 회원. 회원이 사라져도 신고 이력은 남아야 하므로 SET NULL.
  reporter_id: foreignKey(Sequelize, 'users', { allowNull: true, onDelete: 'SET NULL' }),
  reason: { type: Sequelize.ENUM(...REASONS), allowNull: false },
  // 사유가 '기타'일 때 직접 적는 설명.
  detail: { type: Sequelize.STRING(500), allowNull: true },
  status: {
    type: Sequelize.ENUM(...STATUSES),
    allowNull: false,
    defaultValue: 'pending',
  },
  // 처리한 운영자와 시각. 누가 무엇을 판단했는지 남지 않으면 이력의 의미가 없다.
  handled_by: foreignKey(Sequelize, 'users', { allowNull: true, onDelete: 'SET NULL' }),
  handled_at: { type: Sequelize.DATE, allowNull: true },
  ...timestamps(Sequelize),
});

module.exports = {
  async up(queryInterface, Sequelize) {
    // ------------------------------------------------------------------
    // 1. 게시글 신고
    // ------------------------------------------------------------------
    await queryInterface.createTable('post_reports', {
      ...reportColumns(Sequelize),
      post_id: foreignKey(Sequelize, 'posts'),
    });

    // 한 사람이 같은 글을 여러 번 신고해 처리 목록을 채우는 것을 막는다.
    await queryInterface.addIndex('post_reports', ['reporter_id', 'post_id'], {
      name: 'uq_post_report_reporter_post',
      unique: true,
    });
    // 운영자의 처리 대기 목록 조회.
    await queryInterface.addIndex('post_reports', ['status', 'created_at'], {
      name: 'idx_post_report_status_created',
    });
    // 한 글에 신고가 몇 건 쌓였는지 세는 조회.
    await queryInterface.addIndex('post_reports', ['post_id', 'status'], {
      name: 'idx_post_report_post_status',
    });

    // ------------------------------------------------------------------
    // 2. 댓글 신고
    // ------------------------------------------------------------------
    await queryInterface.createTable('comment_reports', {
      ...reportColumns(Sequelize),
      comment_id: foreignKey(Sequelize, 'post_comments'),
    });

    await queryInterface.addIndex('comment_reports', ['reporter_id', 'comment_id'], {
      name: 'uq_comment_report_reporter_comment',
      unique: true,
    });
    await queryInterface.addIndex('comment_reports', ['status', 'created_at'], {
      name: 'idx_comment_report_status_created',
    });
    await queryInterface.addIndex('comment_reports', ['comment_id', 'status'], {
      name: 'idx_comment_report_comment_status',
    });

    // ------------------------------------------------------------------
    // 3. 사용자 차단
    // ------------------------------------------------------------------
    // 차단은 신고와 달리 운영자가 관여하지 않는 **개인 설정**이다.
    // 차단당한 사람은 자기가 차단됐다는 사실을 알 수 없어야 한다.
    await queryInterface.createTable('user_blocks', {
      id: primaryKey(Sequelize),
      // 차단한 사람
      user_id: foreignKey(Sequelize, 'users'),
      // 차단당한 사람
      blocked_user_id: foreignKey(Sequelize, 'users'),
      ...timestamps(Sequelize),
    });

    await queryInterface.addIndex('user_blocks', ['user_id', 'blocked_user_id'], {
      name: 'uq_user_block_pair',
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('user_blocks');
    await queryInterface.dropTable('comment_reports');
    await queryInterface.dropTable('post_reports');
  },
};
