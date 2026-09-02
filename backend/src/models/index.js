/**
 * 모든 Sequelize 모델을 한 번에 등록하는 진입점.
 *
 * sequelize.sync()는 "require된 모델"만 대상으로 하기 때문에,
 * 모델 파일이 어딘가에서 우연히 require되는 것에 의존하면
 * 스키마 동기화에서 일부 테이블이 조용히 빠지는 사고가 난다.
 * (실제로 테스트 DB에서 새 컬럼이 생성되지 않는 문제가 있었다)
 *
 * 스키마를 다루는 코드(테스트 초기화 등)는 이 파일을 require해서
 * 모든 모델이 등록된 상태를 보장받는다.
 */
const Sido = require('./sido.model');
const Heritage = require('./heritage.model');
const Festival = require('./festival.model');
const User = require('./user.model');
const SocialAccount = require('./socialAccount.model');
const FestivalWishlist = require('./festivalWishlist.model');
const FestivalSchedule = require('./festivalSchedule.model');
const Notification = require('./notification.model');

module.exports = {
  Sido,
  Heritage,
  Festival,
  User,
  SocialAccount,
  FestivalWishlist,
  FestivalSchedule,
  Notification,
};
