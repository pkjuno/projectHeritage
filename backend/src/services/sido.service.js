const Sido = require('../models/sido.model');

/**
 * 광역시도 마스터 목록을 코드순으로 조회한다.
 * @returns {Promise<Sido[]>}
 */
async function list() {
  return Sido.findAll({ order: [['code', 'ASC']] });
}

module.exports = { list };
