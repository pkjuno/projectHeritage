const { connectDatabase } = require('../config/database');
const { seedSidos } = require('../seeders/sido.seed');
const { runHeritageImport } = require('./heritageImporter');
const { runFestivalImport } = require('./festivalImporter');

/**
 * 커맨드라인 인자를 파싱한다.
 * 사용 예) node src/importers/run.js heritage --sidoCode=11 --dry-run --sample
 * @param {string[]} argv - process.argv.slice(2)
 * @returns {{target: string, options: {sidoCode?: string, dryRun: boolean, sample: boolean}}}
 */
function parseArgs(argv) {
  const [target, ...rest] = argv;
  const options = { dryRun: false, sample: false };

  for (const arg of rest) {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--sample') options.sample = true;
    else if (arg.startsWith('--sidoCode=')) options.sidoCode = arg.split('=')[1];
  }

  return { target, options };
}

/**
 * 배치 스크립트 진입점.
 * 1) DB 연결/스키마 동기화 -> 2) 시도 마스터 시드 확인 -> 3) 지정한 도메인 수집·적재
 */
async function main() {
  const { target, options } = parseArgs(process.argv.slice(2));

  if (!['heritage', 'festival'].includes(target)) {
    console.error('사용법: node src/importers/run.js <heritage|festival> [--sidoCode=11] [--dry-run] [--sample]');
    console.error('  --dry-run  DB에 저장하지 않고 수집/매핑만 수행');
    console.error('  --sample   각 소스의 원본 응답 1건과 매핑 결과를 콘솔에 출력 (필드 매핑 검증용)');
    process.exitCode = 1;
    return;
  }

  await connectDatabase();
  await seedSidos();

  if (target === 'heritage') {
    await runHeritageImport(options);
  } else {
    await runFestivalImport(options);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[Importer] 실행 중 오류가 발생했습니다:', error.message);
    process.exit(1);
  });
