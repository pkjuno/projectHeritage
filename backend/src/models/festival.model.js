const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');
const Sido = require('./sido.model');

/**
 * 지역축제 모델.
 * 전국문화축제표준데이터(data.go.kr/data/15013104/standard.do) 등의
 * 데이터 구조를 참고해 설계했다.
 */
class Festival extends Model {}

Festival.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    // 개최 시도 (Sido FK)
    sidoId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // 축제명
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },

    // 개최 시군구
    sigungu: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    // 개최 장소
    location: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    // 개최 시작일
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    // 개최 종료일
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },

    // 주최기관
    hostOrganization: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    // 주관기관
    manageOrganization: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },

    // 축제 등급 (문화체육관광부 지정 등급 등)
    grade: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },

    // 공식 홈페이지 URL
    homepageUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },

    // 위도
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
  },
  {
    sequelize,
    modelName: 'Festival',
    tableName: 'festivals',
    timestamps: true,
    indexes: [{ fields: ['sido_id'] }, { fields: ['name'] }, { fields: ['start_date', 'end_date'] }],
  }
);

// 축제는 하나의 시도에서 개최된다.
Festival.belongsTo(Sido, { foreignKey: 'sidoId', as: 'sido' });
// 시도는 여러 축제를 가질 수 있다.
Sido.hasMany(Festival, { foreignKey: 'sidoId', as: 'festivals' });

module.exports = Festival;
