const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * 게시판(카테고리) 마스터 모델.
 *
 * ENUM 대신 테이블로 둔 이유는 두 가지다.
 *  1. 게시판을 하나 추가할 때마다 마이그레이션을 돌리지 않아도 된다.
 *  2. "관리자만 쓰기 가능", "축제 연결 필수" 같은 게시판별 정책을 컬럼으로 표현할 수 있다.
 *
 * 시도(Sido) 마스터와 마찬가지로 서버 기동 시 시드 데이터가 채워진다.
 */
class BoardCategory extends Model {
  /**
   * 이 게시판에 글을 쓸 수 있는 회원인지 판단한다.
   * @param {{role: string}} user - 로그인한 회원
   * @returns {boolean}
   */
  canWrite(user) {
    if (!user) return false;
    // write_role이 'admin'인 게시판(공지사항)은 운영자만 작성할 수 있다.
    return this.writeRole === 'user' || user.role === 'admin';
  }
}

BoardCategory.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    // 게시판 코드. API의 ?category= 파라미터로 노출되므로 숫자 ID 대신 이걸 쓴다.
    code: {
      type: DataTypes.STRING(30),
      allowNull: false,
      unique: true,
    },

    // 화면에 표시할 게시판 이름 (예: '축제 후기')
    name: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },

    // 게시판 설명 (목록 화면의 부제)
    description: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },

    // 글을 쓸 수 있는 최소 권한. 공지사항 게시판은 'admin'.
    writeRole: {
      type: DataTypes.ENUM('user', 'admin'),
      allowNull: false,
      defaultValue: 'user',
    },

    // true면 글 작성 시 축제 연결(festivalId)이 필수다. (축제 후기 게시판)
    requireFestival: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    // 게시판 목록 노출 순서 (작을수록 앞)
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },

    // 게시판을 닫을 때 행을 지우지 않고 이 값을 false로 만든다.
    // 행을 지우면 그 게시판에 쌓인 글이 갈 곳을 잃는다.
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: 'BoardCategory',
    tableName: 'board_categories',
    timestamps: true,
  }
);

module.exports = BoardCategory;
