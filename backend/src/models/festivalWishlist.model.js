const { DataTypes, Model } = require('sequelize');
const { sequelize } = require('../config/database');
const User = require('./user.model');
const Festival = require('./festival.model');

/**
 * 축제 위시리스트(찜) 모델.
 * "가보고 싶다"는 북마크 개념이라 날짜 정보가 없다.
 * 방문 날짜를 정한 계획은 FestivalSchedule에서 별도로 관리한다.
 */
class FestivalWishlist extends Model {}

FestivalWishlist.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    // 찜한 회원 (User FK)
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    // 찜한 축제 (Festival FK)
    festivalId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'FestivalWishlist',
    tableName: 'festival_wishlists',
    timestamps: true,
    indexes: [
      // 같은 축제를 중복으로 찜할 수 없다.
      { unique: true, fields: ['user_id', 'festival_id'], name: 'uq_wishlist_user_festival' },
    ],
  }
);

// 회원/축제가 삭제되면 위시리스트 항목도 함께 정리된다.
User.hasMany(FestivalWishlist, { foreignKey: 'userId', as: 'wishlists', onDelete: 'CASCADE' });
FestivalWishlist.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Festival.hasMany(FestivalWishlist, { foreignKey: 'festivalId', as: 'wishlists', onDelete: 'CASCADE' });
FestivalWishlist.belongsTo(Festival, { foreignKey: 'festivalId', as: 'festival' });

module.exports = FestivalWishlist;
