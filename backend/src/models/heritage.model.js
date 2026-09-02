const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');
const Sido = require('./sido.model');

/**
 * 문화재(국가유산) 모델.
 * 국가유산청_전국 지정문화재 현황 Open API(data.go.kr/data/15034324/openapi.do) 등의
 * 데이터 구조를 참고해 설계했다.
 */
class Heritage extends Model {}

Heritage.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    // 소재 시도 (Sido FK)
    sidoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // 문화재명
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },

    // 지정 구분 (국가지정/시도지정/문화재자료/등록문화재/향토문화유적)
    designationType: {
      type: DataTypes.ENUM(
        '국가지정문화재',
        '시도지정문화재',
        '문화재자료',
        '등록문화재',
        '향토문화유적'
      ),
      allowNull: false,
      defaultValue: '국가지정문화재',
    },

    // 종목코드 (국가유산 Open API의 ccbaKdcd, 참고용)
    categoryCode: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },

    // 관리번호 (국가유산 Open API의 ccbaAsno, 참고용)
    managementNo: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },

    // 지정일
    designatedDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    // 소재지 주소
    address: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    // 위도 (문화재 공간 정보 Open API 연동 시 사용)
    latitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },

    // 경도
    longitude: {
      type: DataTypes.DECIMAL(10, 7),
      allowNull: true,
    },

    // 설명
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // 대표 이미지 URL
    imageUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'Heritage',
    tableName: 'heritages',
    timestamps: true,
    indexes: [
      { fields: ['sido_id'] },
      { fields: ['name'] },
      // 국가유산 Open API의 자연키(종목코드+관리번호+시도) 기준 중복 적재 방지.
      // categoryCode/managementNo가 없는 수동 등록 건은 NULL이라 유니크 제약에 걸리지 않는다.
      {
        unique: true,
        fields: ['category_code', 'management_no', 'sido_id'],
        name: 'uq_heritage_source_key',
      },
    ],
  }
);

// 문화재는 하나의 시도에 소속된다.
Heritage.belongsTo(Sido, { foreignKey: 'sidoId', as: 'sido' });
// 시도는 여러 문화재를 가질 수 있다.
Sido.hasMany(Heritage, { foreignKey: 'sidoId', as: 'heritages' });

module.exports = Heritage;
