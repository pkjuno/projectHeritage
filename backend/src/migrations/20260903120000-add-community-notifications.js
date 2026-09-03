'use strict';

/**
 * 커뮤니티 알림을 위한 notifications 테이블 확장.
 *
 * 커뮤니티 스키마(20260903000000)에 이 변경을 넣지 않은 이유:
 * 그때는 알림 로직이 없었고, 쓰지 않는 컬럼을 미리 만들면 "왜 있는지 아무도 모르는 컬럼"이 된다.
 * 알림 기능을 붙이는 지금 함께 추가한다.
 *
 * 실행: npm run db:migrate
 */

// 기존 알림 종류 (되돌릴 때 사용)
const ORIGINAL_TYPES = ['schedule_reminder', 'festival_start', 'notice'];

// 커뮤니티 알림 3종을 더한 목록
const EXTENDED_TYPES = [...ORIGINAL_TYPES, 'post_comment', 'comment_reply', 'post_reaction'];

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1) 알림 종류에 커뮤니티 3종을 추가한다.
    //    ENUM 확장은 값을 늘리기만 하므로 기존 행에 영향이 없다.
    await queryInterface.changeColumn('notifications', 'type', {
      type: Sequelize.ENUM(...EXTENDED_TYPES),
      allowNull: false,
    });

    // 2) 알림을 눌렀을 때 이동할 게시글.
    //    기존 festival_id만으로는 게시글 화면으로 갈 수 없다.
    //    글이 삭제돼도 알림 이력은 남아야 하므로 SET NULL이다.
    //
    //    컬럼/인덱스/외래키를 세 단계로 나눠서 만든다.
    //    addColumn에 references를 함께 주면 MySQL이 인덱스 이름을
    //    'notifications_post_id_foreign_idx'로 자동 생성하는데,
    //    모델 sync는 같은 인덱스를 'post_id'로 만든다.
    //    이 차이를 마이그레이션 드리프트 테스트가 잡아낸다.
    //    (실제로 이 순서로 바꾸기 전까지 테스트가 실패했다)
    await queryInterface.addColumn('notifications', 'post_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    // 인덱스를 먼저 만들어 이름을 고정한다.
    // 이미 쓸 수 있는 인덱스가 있으면 MySQL은 외래키용 인덱스를 새로 만들지 않는다.
    await queryInterface.addIndex('notifications', ['post_id'], { name: 'post_id' });

    await queryInterface.addConstraint('notifications', {
      fields: ['post_id'],
      type: 'foreign key',
      name: 'fk_notification_post',
      references: { table: 'posts', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface, Sequelize) {
    // 외래키 -> 인덱스 -> 컬럼 순으로 되돌린다.
    await queryInterface.removeConstraint('notifications', 'fk_notification_post');
    await queryInterface.removeIndex('notifications', 'post_id');
    await queryInterface.removeColumn('notifications', 'post_id');

    // ENUM을 되돌리기 전에, 사라질 값을 쓰고 있는 행을 정리해야 한다.
    // 남겨두면 changeColumn이 실패하거나 값이 빈 문자열로 잘린다.
    await queryInterface.sequelize.query(
      `DELETE FROM notifications WHERE type IN ('post_comment', 'comment_reply', 'post_reaction')`
    );

    await queryInterface.changeColumn('notifications', 'type', {
      type: Sequelize.ENUM(...ORIGINAL_TYPES),
      allowNull: false,
    });
  },
};
