'use strict';

/**
 * 게시글 첨부 이미지 스키마.
 *
 * 이미지는 게시글 본문에 URL로 박아 넣지 않고 별도 행으로 관리한다.
 * 본문에 박아두면 저장소를 옮길 때(로컬 디스크 -> S3) 모든 글의 본문을
 * 찾아 고쳐야 하고, 지워진 이미지 파일을 정리할 방법도 없다.
 *
 * 실행: npm run db:migrate
 */

const timestamps = (Sequelize) => ({
  created_at: { type: Sequelize.DATE, allowNull: false },
  updated_at: { type: Sequelize.DATE, allowNull: false },
});

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('post_images', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },

      // 첨부된 게시글. 글이 지워지면 이미지 행도 함께 정리된다.
      post_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'posts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },

      // 저장소가 돌려준 경로. 지금은 '/uploads/posts/xxx.jpg' 형태의 로컬 경로이고,
      // S3로 옮기면 여기에 전체 URL이 들어간다. 컬럼을 바꾸지 않아도 되게 넉넉히 잡는다.
      url: { type: Sequelize.STRING(500), allowNull: false },

      // 원본 파일명. 사용자가 어떤 파일을 올렸는지 확인할 때만 쓴다.
      // 이 값으로 파일을 찾지 않는다 — 클라이언트가 보낸 이름은 신뢰할 수 없다.
      original_name: { type: Sequelize.STRING(255), allowNull: true },

      // 바이트 단위 크기. 용량 통계와 정리 대상 판단에 쓴다.
      size_bytes: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },

      // 글 안에서의 표시 순서.
      sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },

      ...timestamps(Sequelize),
    });

    // 한 글의 이미지를 순서대로 읽을 때 사용
    await queryInterface.addIndex('post_images', ['post_id', 'sort_order'], {
      name: 'idx_post_image_post_sort',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('post_images');
  },
};
