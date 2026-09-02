const { XMLParser } = require('fast-xml-parser');

// 국가유산 Open API는 XML로 응답한다. 태그 값만 필요하므로 속성은 무시한다.
const parser = new XMLParser({ ignoreAttributes: true, trimValues: true });

/**
 * XML 문자열을 JS 객체로 변환한다.
 * @param {string} xml
 * @returns {object}
 */
function parseXml(xml) {
  return parser.parse(xml);
}

module.exports = { parseXml };
