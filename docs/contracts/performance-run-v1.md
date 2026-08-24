# PerformanceRunManifest v1

## 목적

`performance-run.v1`은 Stage 0 기준선 벤치마크의 실행 조건과 측정 결과를 장기 보존하는 계약이다. CI 서버 수치는 H1 공식 하드웨어 성능을 대체하지 않으며, 동일한 클라우드 실행 경로에서 성능 회귀를 탐지하기 위한 기준선으로 사용한다.

## 벤치마크 ID

```text
stage0-kernel-baseline.v1
```

## 측정 대상

- Empty fixed-tick 처리 시간과 ticks/s
- `RenderSnapshot` transactional write 시간과 파일 크기
- `WorldSaveManifest` transactional write 시간과 파일 크기
- World Save load·계약 검증 시간
- 최종 authoritative tick과 deterministic digest

## 통계

모든 시간은 정수 나노초로 기록한다.

- minimum
- median
- p95
- maximum

처리량은 정수 ticks/s로 기록한다.

- minimum
- median
- maximum

각 측정은 동일 seed, 동일 tick 수, 동일 build에서 반복한다. 모든 Empty Tick 샘플의 최종 digest가 다르면 벤치마크를 실패 처리한다.

## 환경 구분

`hardware.environment` 예시:

- `github-actions`
- `github-codespaces`
- `local`
- 추후 `h0`, `h1`, `h2`

`github-actions` 결과는 변동 가능한 공유 클라우드 하드웨어 결과이므로 공식 H1 목표 통과 판정에 사용하지 않는다.

## 산출물

```text
performance-run.json
artifacts/render-snapshot.json
artifacts/world-save.json
```

GitHub Actions는 세 파일을 하나의 workflow artifact로 보존한다.

## 초기 CI 승인 기준

- Release build
- sample count 7
- sample당 measured tick 10,000,000
- Empty Tick minimum 100,000 ticks/s 이상
- Snapshot 파일 크기 0 초과
- Save 파일 크기 0 초과
- Snapshot p95 write 2초 이하
- Save p95 write 2초 이하
- Save p95 load 5초 이하
- final digest가 16자리 hexadecimal

이 기준은 최소 실행 경로 손상과 극단적 회귀를 탐지하기 위한 하한이다. 정상적인 회귀 차단 기준은 누적 기준선이 확보된 뒤 직전 승인 기준선 대비 백분율로 추가한다.
