-- 파일 정리와 등록 경쟁에서 삭제 예정 원본을 다시 참조하지 못하게 한다.
ALTER TABLE uploads ADD COLUMN deleted_at INTEGER;
