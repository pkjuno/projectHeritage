require('dotenv').config();
const { sequelize, connectDatabase } = require('../config/database');
require('../models');

/**
 * 커뮤니티 비정규화 카운터 보정 스크립트.
 *
 * posts의 댓글/반응/공유/조회 수와 post_comments의 좋아요 수는 원본을 COUNT(*)한 값을
 * 미리 저장해 둔 것이다. 증감은 원본 변경과 같은 트랜잭션에서 처리하지만,
 * 배포 중 강제 종료나 과거 데이터 이관처럼 트랜잭션 밖에서 벌어지는 일까지 막지는 못한다.
 *
 * 그래서 실제 값과 대조해 보정하는 수단을 따로 둔다.
 * 카운터를 비정규화하기로 한 이상 이 스크립트가 없으면 어긋난 값을 되돌릴 방법이 없다.
 *
 * 실행:
 *   npm run community:recount              # 어긋난 항목만 출력 (변경 없음)
 *   npm run community:recount -- --apply   # 실제로 보정
 */

// 보정 대상: [설명, 카운터 컬럼을 가진 테이블, 컬럼, 실제 값을 세는 서브쿼리]
const COUNTER_SPECS = [
  {
    label: '게시글 댓글 수',
    table: 'posts',
    column: 'comment_count',
    // 삭제된 댓글은 화면에 보이지 않으므로 세지 않는다.
    actual: `(SELECT COUNT(*) FROM post_comments c
               WHERE c.post_id = t.id AND c.status = 'published')`,
  },
  {
    label: '게시글 반응 수',
    table: 'posts',
    column: 'reaction_count',
    actual: '(SELECT COUNT(*) FROM post_reactions r WHERE r.post_id = t.id)',
  },
  {
    label: '게시글 공유 수',
    table: 'posts',
    column: 'share_count',
    actual: '(SELECT COUNT(*) FROM post_shares s WHERE s.post_id = t.id)',
  },
  {
    label: '게시글 조회 수',
    table: 'posts',
    column: 'view_count',
    actual: '(SELECT COUNT(*) FROM post_views v WHERE v.post_id = t.id)',
  },
  {
    label: '댓글 좋아요 수',
    table: 'post_comments',
    column: 'like_count',
    actual: '(SELECT COUNT(*) FROM comment_likes l WHERE l.comment_id = t.id)',
  },
];

/**
 * 저장된 카운터와 실제 값이 다른 행을 찾는다.
 * @param {typeof COUNTER_SPECS[0]} spec
 * @returns {Promise<Array<{id: number, stored: number, actual: number}>>}
 */
async function findMismatches(spec) {
  const [rows] = await sequelize.query(
    `SELECT t.id, t.${spec.column} AS stored, ${spec.actual} AS actual
       FROM ${spec.table} t
      HAVING stored <> actual`,
    // 개발 환경은 SQL을 콘솔에 찍도록 설정돼 있는데, 그러면 이 스크립트의
    // 보고 내용이 쿼리문에 묻혀 읽을 수 없게 된다. 여기서만 로그를 끈다.
    { logging: false }
  );

  return rows;
}

/**
 * 어긋난 카운터를 실제 값으로 되돌린다.
 * @param {typeof COUNTER_SPECS[0]} spec
 * @returns {Promise<void>}
 */
async function fix(spec) {
  await sequelize.query(`UPDATE ${spec.table} t SET t.${spec.column} = ${spec.actual}`, {
    logging: false,
  });
}

async function main() {
  const apply = process.argv.includes('--apply');

  await connectDatabase({ quiet: true });

  let totalMismatch = 0;

  for (const spec of COUNTER_SPECS) {
    const mismatches = await findMismatches(spec);
    totalMismatch += mismatches.length;

    if (mismatches.length === 0) {
      console.log(`[OK]  ${spec.label}: 어긋난 행 없음`);
      continue;
    }

    console.log(`[!!]  ${spec.label}: ${mismatches.length}건 불일치`);
    // 전부 찍으면 로그가 넘치므로 앞의 몇 건만 보여준다.
    for (const row of mismatches.slice(0, 10)) {
      console.log(`        id=${row.id} 저장값=${row.stored} 실제값=${row.actual}`);
    }
    if (mismatches.length > 10) {
      console.log(`        ... 외 ${mismatches.length - 10}건`);
    }

    if (apply) {
      await fix(spec);
      console.log(`      -> 보정 완료`);
    }
  }

  if (totalMismatch === 0) {
    console.log('\n모든 카운터가 실제 값과 일치합니다.');
  } else if (!apply) {
    console.log('\n보정하려면 --apply 옵션을 붙여 다시 실행하세요.');
    console.log('  npm run community:recount -- --apply');
  }

  await sequelize.close();
}

main().catch(async (error) => {
  console.error('[recount] 실패:', error.message);
  await sequelize.close();
  process.exit(1);
});
