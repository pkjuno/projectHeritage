const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * 광역시도 마스터 모델.
 * 국가유산청 Open API의 시도코드(ccbaCtcd)를 기준으로 한다.
 * 문화재(Heritage), 지역축제(Festival)가 이 테이블을 참조(FK)한다.
 */
class Sido extends Model {}

Sido.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    // 국가유산청 Open API 시도코드 (예: 서울 '11', 부산 '21')
    code: {
      type: DataTypes.STRING(2),
      allowNull: false,
      unique: true,
    },

    // 광역시도명 (예: '서울특별시')
    name: {
      type: DataTypes.STRING(30),
      allowNull: false,
      unique: true,
    },
  },
  {
    sequelize,
    modelName: 'Sido',
    tableName: 'sidos',
    timestamps: true,
  }
);

module.exports = Sido;
