# API 단위 확인 메모 · 2026-09-07

## 선물 가격 갭

- NADO `contracts`의 `mark_price`: https://docs.nado.xyz/developer-resources/api/v2/contracts
- Variational stats의 `mark_price`: https://docs.variational.io/technical-documentation/api
- 두 필드를 기초자산 1개 단위로 비교. 마크 가격 간 차이이며 실행 가능한 bid/ask 스프레드가 아님.
- NADO 계약 응답을 받은 시각을 펀딩비 요청 완료 시각과 별도로 기록. Variational은 stats 수신 시각을 기록. 두 시각 모두 원본 마크 가격 갱신 시각을 뜻하지 않음.
- `quotes.updated_at`은 마크 가격 갱신 시각으로 대체하지 않음. 공개 호가의 캐시와 수량별 호가 문제를 피하기 위해 이번 기능은 명시적으로 마크 가격 비교만 제공.
- 수신 후 120초 / 양쪽 수신 시차 30초 제한은 대시보드의 비교 제외 기준이며 원본 데이터 실시간성을 보증하지 않음.

## NADO

- 공식 문서: https://docs.nado.xyz/developer-resources/api/archive-indexer/funding-rate
- 요청: `POST https://archive.prod.nado.xyz/v1`, body `{"funding_rates":{"product_ids":[2]}}`.
- `funding_rate_x18`은 24시간 소수 비율 × 10¹⁸. `update_time`은 원본 갱신 epoch 초.
- 심볼의 거래 가능 상태: `GET https://gateway.prod.nado.xyz/v1/query?type=symbols`.
- 가격/거래량/OI: `GET https://archive.prod.nado.xyz/v2/contracts?edge=false`.
- subscriptions 문서의 일부 예시에 연율 표기가 섞여 있어, 직접 사용하는 indexer 문서의 필드 정의를 기준으로 함.

## Variational

- 공식 API: https://docs.variational.io/technical-documentation/api
- 실제 요청: `GET https://omni-client-api.prod.ap-northeast-1.variational.io/metadata/stats`.
- 공개 문서는 `funding_rate`를 decimal이라고 명시하지만 기간은 설명하지 않음.
- 공식 https://omni.variational.io 의 공개 웹앱 코드를 읽어 기간을 교차 확인함. 아래 자산 이름은 배포 시 변경될 수 있음.
  - `/_app/immutable/chunks/BF_oYedK.js`: 마켓 펀딩비 열의 영어 번역이 `Ann. Funding`.
  - `/_app/immutable/chunks/aLqkoE7q.js`: 마켓 셀에서 `asset.funding_rate`를 퍼센트 포맷 함수에 전달.
  - `/_app/immutable/chunks/BUP-jGIV.js`: 예측 펀딩비를 정산 기간으로 환산하는 `Sh(e,t)` 함수가 `t / dp * +e`를 반환. `t`는 `funding_interval_s`.
  - `/_app/immutable/chunks/CUyZAe0f.js`: `aW` export의 상수 `Mo=365*24*3600`. 위 번들에서 `aW as dp`로 import.
- 따라서 연율 소수값을 8,760으로 나눠 시간당 비율로 사용. 예: `0.1095` → 연 10.95% → 하루 0.03% → 8시간 0.01%.
- `quotes.updated_at`은 호가 시각. 펀딩비 freshness 확인용으로 사용할 수 없음.
- 원본 데이터 의미가 변경될 경우 이 어댑터와 단위 테스트를 함께 갱신해야 함.
