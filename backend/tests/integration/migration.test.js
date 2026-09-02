const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');
const { sequelize } = require('../../src/config/database');
require('../../src/models');

/**
 * 마이그레이션이 모델 정의와 어긋나지 않는지 검증한다.
 *
 * 마이그레이션은 한 번 써두면 아무도 다시 열어보지 않아서, 모델에 컬럼을 추가하고
 * 마이그레이션을 빼먹어도 개발 중에는 눈치채지 못한다. (테스트는 sync로 스키마를 만들기 때문)
 * 그러면 배포할 때 운영 DB에만 컬럼이 없는 상태가 된다.
 *
 * 그래서 여기서 두 스키마를 실제로 비교한다.
 *   A) 마이그레이션을 순서대로 실행해서 만든 스키마
 *   B) 모델 정의로 sync해서 만든 스키마
 * 둘이 다르면 마이그레이션을 빠뜨린 것이다.
 */

const MIGRATIONS_DIR = path.join(__dirname, '../../src/migrations');

/**
 * 해당 스키마의 컬럼 정의를 "테이블.컬럼 = 타입/널/기본값" 형태로 모두 읽어온다.
 * @param {string} schemaName
 * @returns {Promise<Record<string, string>>}
 */
async function readColumns(schemaName) {
  const [rows] = await sequelize.query(
    `SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME <> 'sequelize_meta'`,
    { replacements: [schemaName] }
  );

  return Object.fromEntries(
    rows.map((row) => [
      `${row.TABLE_NAME}.${row.COLUMN_NAME}`,
      `${row.COLUMN_TYPE} | null=${row.IS_NULLABLE} | default=${row.COLUMN_DEFAULT ?? '-'}`,
    ])
  );
}

/**
 * 해당 스키마의 인덱스 목록을 읽어온다. (유니크 여부와 구성 컬럼까지 비교)
 * @param {string} schemaName
 * @returns {Promise<Record<string, string>>}
 */
async function readIndexes(schemaName) {
  const [rows] = await sequelize.query(
    `SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE,
            GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS COLS
       FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME <> 'sequelize_meta'
      GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE`,
    { replacements: [schemaName] }
  );

  return Object.fromEntries(
    rows.map((row) => [
      `${row.TABLE_NAME}.${row.INDEX_NAME}`,
      `cols=${row.COLS} | unique=${row.NON_UNIQUE === 0}`,
    ])
  );
}

describe('마이그레이션과 모델 정의 일치 여부', () => {
  // 마이그레이션을 적용해볼 임시 스키마. 테스트 DB 이름 뒤에 접미사를 붙여 만든다.
  const scratchSchema = `${sequelize.getDatabaseName()}_migration_check`;
  let scratchSequelize;

  beforeAll(async () => {
    await sequelize.query(`DROP DATABASE IF EXISTS \`${scratchSchema}\``);
    await sequelize.query(
      `CREATE DATABASE \`${scratchSchema}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );

    scratchSequelize = new Sequelize(scratchSchema, sequelize.config.username, sequelize.config.password, {
      host: sequelize.config.host,
      port: sequelize.config.port,
      dialect: 'mysql',
      logging: false,
    });

    // 마이그레이션 파일을 파일명 순서대로 실행한다. (sequelize-cli가 하는 일과 동일한 순서)
    const migrationFiles = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith('.js'))
      .sort();

    const queryInterface = scratchSequelize.getQueryInterface();
    for (const file of migrationFiles) {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      const migration = require(path.join(MIGRATIONS_DIR, file));
      await migration.up(queryInterface, Sequelize);
    }
  }, 60000);

  afterAll(async () => {
    if (scratchSequelize) await scratchSequelize.close();
    await sequelize.query(`DROP DATABASE IF EXISTS \`${scratchSchema}\``);
  });

  it('마이그레이션 파일이 하나 이상 존재한다', () => {
    const migrationFiles = fs.readdirSync(MIGRATIONS_DIR).filter((file) => file.endsWith('.js'));
    expect(migrationFiles.length).toBeGreaterThan(0);
  });

  it('마이그레이션으로 만든 테이블이 모델과 동일하다', async () => {
    const [migrated, synced] = await Promise.all([
      readColumns(scratchSchema),
      readColumns(sequelize.getDatabaseName()),
    ]);

    const migratedTables = [...new Set(Object.keys(migrated).map((key) => key.split('.')[0]))].sort();
    const syncedTables = [...new Set(Object.keys(synced).map((key) => key.split('.')[0]))].sort();

    expect(migratedTables).toEqual(syncedTables);
  });

  it('모든 컬럼의 타입/널 허용/기본값이 모델과 일치한다', async () => {
    const [migrated, synced] = await Promise.all([
      readColumns(scratchSchema),
      readColumns(sequelize.getDatabaseName()),
    ]);

    // 어느 쪽에만 있거나 정의가 다른 컬럼을 모아 한 번에 보여준다.
    const differences = [];

    for (const [column, definition] of Object.entries(synced)) {
      if (migrated[column] === undefined) {
        differences.push(`마이그레이션 누락: ${column} (모델: ${definition})`);
      } else if (migrated[column] !== definition) {
        differences.push(`정의 불일치: ${column}\n  모델        : ${definition}\n  마이그레이션: ${migrated[column]}`);
      }
    }

    for (const column of Object.keys(migrated)) {
      if (synced[column] === undefined) {
        differences.push(`모델에 없는 컬럼이 마이그레이션에 있음: ${column}`);
      }
    }

    expect(differences).toEqual([]);
  });

  it('모든 인덱스가 모델과 일치한다', async () => {
    const [migrated, synced] = await Promise.all([
      readIndexes(scratchSchema),
      readIndexes(sequelize.getDatabaseName()),
    ]);

    const differences = [];

    for (const [index, definition] of Object.entries(synced)) {
      if (migrated[index] === undefined) {
        differences.push(`마이그레이션 누락 인덱스: ${index} (${definition})`);
      } else if (migrated[index] !== definition) {
        differences.push(`인덱스 불일치: ${index}\n  모델        : ${definition}\n  마이그레이션: ${migrated[index]}`);
      }
    }

    for (const index of Object.keys(migrated)) {
      if (synced[index] === undefined) {
        differences.push(`모델에 없는 인덱스가 마이그레이션에 있음: ${index}`);
      }
    }

    expect(differences).toEqual([]);
  });

  it('모든 마이그레이션은 되돌릴 수 있다 (down 구현 필수)', async () => {
    const migrationFiles = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith('.js'))
      .sort()
      .reverse();

    const queryInterface = scratchSequelize.getQueryInterface();

    // 역순으로 되돌린다. down이 없거나 실패하면 여기서 에러가 난다.
    for (const file of migrationFiles) {
      // eslint-disable-next-line global-require, import/no-dynamic-require
      const migration = require(path.join(MIGRATIONS_DIR, file));
      expect(typeof migration.down).toBe('function');
      await migration.down(queryInterface, Sequelize);
    }

    const [tables] = await scratchSequelize.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME <> 'sequelize_meta'`,
      { replacements: [scratchSchema] }
    );

    expect(tables).toEqual([]);
  }, 60000);
});
