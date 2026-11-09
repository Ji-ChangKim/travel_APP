import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  nicknameSchema,
  nicknameLength,
  profileNicknameKey,
  nicknameChangeIntervalMs,
} from '../../packages/validation/src/profile';

test('닉네임은 일본어 두 문자 체계와 한글·영문·숫자·중간 공백 2개를 지원한다', () => {
  for (const name of [
    'a',
    '가',
    'あいうえお',
    'カタカナー',
    '하루a12',
    'A B',
    '가  나',
    '가 나 다',
    'あいうえおアイウエオ',
    '하루',
  ])
    assert.equal(nicknameSchema.safeParse(name).success, true, name);
  for (const name of [
    '',
    ' ',
    '  ',
    ' asd',
    ' asd ',
    'asd ',
    'a   b',
    'a b c d',
    'a\tb',
    'a\nb',
    '旅行',
    '가_나',
    'a-b',
    'a.b',
    'a😀',
    '＠abc',
    'あいうえおアイウエオ1',
  ])
    assert.equal(nicknameSchema.safeParse(name).success, false, name);
  assert.equal(nicknameLength('가  나'), 4);
  assert.equal(nicknameSchema.parse('하루'), '하루');
  assert.equal(profileNicknameKey('A가나다'), profileNicknameKey('a가나다'));
  assert.equal(nicknameChangeIntervalMs, 2592000000);
});
