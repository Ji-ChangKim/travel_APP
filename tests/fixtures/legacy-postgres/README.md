# 이전 PostgreSQL 계약 검사 자료

이 폴더의 SQL은 `db0dc16`에 있던 실제 마이그레이션의 보존본이다. 새 운영 DB에 적용하지 않는다. 기존 계약의 회귀 검사를 계속하기 위해 `apps/api/test/database.ts`가 읽는다. `20261106000001_trip_creation_contract.sql`은 현재 작업 트리의 여행 생성 계약을 함께 검사한다.

현재 계정 DB의 적용 대상은 `apps/api/migrations`의 Cloudflare D1 마이그레이션이다. 이 자료로 D1 적용이나 실제 서버 저장을 검증했다고 보고하지 않는다.
