const fs = require('fs');
const path = require('path');
const { request, app, resetDatabase, createUserAndLogin, authHeader } = require('../helpers');
const PostImage = require('../../src/models/postImage.model');
const { POST_IMAGE_DIR } = require('../../src/middlewares/upload');

/**
 * 게시글 이미지 첨부 통합 테스트.
 *
 * 파일을 다루는 기능이라 "DB 행이 생겼는지"만 봐서는 부족하다.
 * 실제 파일이 디스크에 있는지, 글을 지우면 사라지는지까지 확인한다.
 */
describe('커뮤니티 - 게시글 이미지 첨부', () => {
  // 1x1 PNG. 테스트가 외부 파일에 의존하지 않도록 바이트를 직접 들고 있는다.
  const PNG_1X1 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );

  beforeEach(async () => {
    await resetDatabase();
    await PostImage.destroy({ where: {}, truncate: true });
  });

  /** 업로드된 파일이 실제로 디스크에 있는지 확인한다. */
  function fileExists(url) {
    return fs.existsSync(path.join(POST_IMAGE_DIR, path.basename(url)));
  }

  it('이미지를 첨부해 글을 쓸 수 있다', async () => {
    const { token } = await createUserAndLogin();

    const response = await request(app)
      .post('/api/community/posts')
      .set(authHeader(token))
      .field('category', 'free')
      .field('title', '사진 있는 글')
      .field('content', '본문입니다')
      .attach('images', PNG_1X1, 'first.png')
      .attach('images', PNG_1X1, 'second.png')
      .expect(201);

    expect(response.body.data.images).toHaveLength(2);
    // 순서가 유지되지 않으면 올린 순서와 다르게 보인다.
    expect(response.body.data.images.map((i) => i.sortOrder)).toEqual([0, 1]);

    for (const image of response.body.data.images) {
      expect(fileExists(image.url)).toBe(true);
    }
  });

  it('이미지 없이도 글을 쓸 수 있다', async () => {
    const { token } = await createUserAndLogin();

    const response = await request(app)
      .post('/api/community/posts')
      .set(authHeader(token))
      .send({ category: 'free', title: '사진 없는 글', content: '본문' })
      .expect(201);

    expect(response.body.data.images).toEqual([]);
  });

  it('원본 파일명은 저장되지만 저장 경로에는 쓰이지 않는다', async () => {
    const { token } = await createUserAndLogin();

    const response = await request(app)
      .post('/api/community/posts')
      .set(authHeader(token))
      .field('category', 'free')
      .field('title', '경로 조작 시도')
      .field('content', '본문')
      // 클라이언트가 보낸 이름을 그대로 경로로 쓰면 상위 디렉터리에 접근할 수 있다.
      .attach('images', PNG_1X1, '../../evil.png')
      .expect(201);

    const image = response.body.data.images[0];
    expect(image.url).toMatch(/^\/uploads\/posts\/[0-9a-f-]+\.png$/);
    expect(image.url).not.toContain('..');
    expect(fileExists(image.url)).toBe(true);
  });

  it('이미지가 아닌 파일은 400', async () => {
    const { token } = await createUserAndLogin();

    await request(app)
      .post('/api/community/posts')
      .set(authHeader(token))
      .field('category', 'free')
      .field('title', '실행 파일 첨부')
      .field('content', '본문')
      .attach('images', Buffer.from('#!/bin/sh\necho hi'), 'run.sh')
      .expect(400);
  });

  it('첨부 개수 상한을 넘으면 400', async () => {
    const { token } = await createUserAndLogin();

    // 제한이 없으면 한 번의 요청으로 디스크를 채울 수 있다.
    const req = request(app)
      .post('/api/community/posts')
      .set(authHeader(token))
      .field('category', 'free')
      .field('title', '너무 많은 첨부')
      .field('content', '본문');

    for (let i = 0; i < 6; i += 1) {
      req.attach('images', PNG_1X1, `image${i}.png`);
    }

    await req.expect(400);
  });

  it('상세 조회에 이미지가 순서대로 담겨 온다', async () => {
    const { token } = await createUserAndLogin();

    const created = await request(app)
      .post('/api/community/posts')
      .set(authHeader(token))
      .field('category', 'free')
      .field('title', '사진 있는 글')
      .field('content', '본문')
      .attach('images', PNG_1X1, 'a.png')
      .attach('images', PNG_1X1, 'b.png')
      .expect(201);

    const detail = await request(app)
      .get(`/api/community/posts/${created.body.data.id}`)
      .expect(200);

    expect(detail.body.data.images.map((i) => i.sortOrder)).toEqual([0, 1]);
  });

  it('글을 지우면 이미지 파일도 지워진다', async () => {
    const { token } = await createUserAndLogin();

    const created = await request(app)
      .post('/api/community/posts')
      .set(authHeader(token))
      .field('category', 'free')
      .field('title', '지울 글')
      .field('content', '본문')
      .attach('images', PNG_1X1, 'gone.png')
      .expect(201);

    const url = created.body.data.images[0].url;
    expect(fileExists(url)).toBe(true);

    await request(app)
      .delete(`/api/community/posts/${created.body.data.id}`)
      .set(authHeader(token))
      .expect(200);

    // 행만 지우고 파일을 두면, URL을 아는 사람은 지운 글의 사진을 계속 볼 수 있고
    // 디스크에는 아무도 참조하지 않는 파일이 쌓인다.
    expect(fileExists(url)).toBe(false);
    expect(await PostImage.count()).toBe(0);
  });

  it('목록 응답에는 이미지를 싣지 않는다', async () => {
    const { token } = await createUserAndLogin();

    await request(app)
      .post('/api/community/posts')
      .set(authHeader(token))
      .field('category', 'free')
      .field('title', '사진 있는 글')
      .field('content', '본문')
      .attach('images', PNG_1X1, 'a.png')
      .expect(201);

    const list = await request(app).get('/api/community/posts').expect(200);
    expect(list.body.data.items[0].images).toBeUndefined();
  });
});
