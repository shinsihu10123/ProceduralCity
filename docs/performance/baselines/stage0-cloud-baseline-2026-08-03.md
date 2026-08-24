# Stage 0 Cloud Baseline — 2026-08-03

## 판정

`stage0-kernel-baseline.v1` 최초 기준선 실행을 완료했다.

이 결과는 GitHub Actions 공유 Linux runner에서 실행한 최소 Kernel 기준선이다. Stage 0.7의 H1 공식 하드웨어 성능 판정이 아니며, 전체 인공 세계 시뮬레이션의 미래 처리량을 의미하지 않는다. 현재 목적은 다음과 같다.

- 벤치마크 실행 경로 검증
- Release build 성능 원점 확보
- Snapshot·Save I/O 측정 경로 검증
- 결정론 digest 확인
- 후속 커밋의 극단적 성능 회귀 탐지

## 실행 식별자

| 항목 | 값 |
|---|---|
| Workflow run | `30812184674` |
| Artifact ID | `8855227183` |
| Artifact name | `stage0-cloud-baseline-30812184674` |
| Benchmark ID | `stage0-kernel-baseline.v1` |
| Run ID | `github-30812184674-1` |
| Code build ID | `bf760a9e7e87c1e9895e5f71471d69967182c892` |
| Artifact SHA-256 | `7e9c0f7d8fd91d4529568bb3c77935cc9bb83d3c10f9276dca148009b4f13335` |

## 환경

| 항목 | 값 |
|---|---|
| 환경 | GitHub Actions shared runner |
| OS | Linux / Ubuntu 24.04 runner image |
| Architecture | `x86_64` |
| 논리 CPU | 4 |
| Rust | `rustc 1.97.1 (8bab26f4f 2026-07-14)` |
| Build profile | Release |

## 구성

| 항목 | 값 |
|---|---:|
| World seed | 42 |
| Warm-up ticks | 1,000,000 |
| Measured ticks/sample | 10,000,000 |
| Samples | 7 |

## Empty Tick 결과

| 지표 | 값 |
|---|---:|
| 최소 처리량 | 1,583,647,885 ticks/s |
| 중앙 처리량 | 1,593,615,085 ticks/s |
| 최대 처리량 | 1,601,698,569 ticks/s |
| 최소 실행 시간 | 6,243,372 ns |
| 중앙 실행 시간 | 6,275,041 ns |
| p95 실행 시간 | 6,314,535 ns |
| 최대 실행 시간 | 6,314,535 ns |

현재 `SimulationHost::step`은 tick 증가와 lifecycle 검사만 수행한다. 따라서 이 수치는 시스템 상한이나 미래 규모 추정치가 아니라 최소 실행 오버헤드 기준이다.

## Snapshot I/O

| 지표 | 값 |
|---|---:|
| 파일 크기 | 251 bytes |
| 최소 기록 시간 | 413,193 ns |
| 중앙 기록 시간 | 542,575 ns |
| p95 기록 시간 | 4,254,230 ns |
| 최대 기록 시간 | 4,254,230 ns |

## World Save I/O

| 지표 | 값 |
|---|---:|
| 파일 크기 | 858 bytes |
| 최소 기록 시간 | 447,227 ns |
| 중앙 기록 시간 | 504,494 ns |
| p95 기록 시간 | 1,602,047 ns |
| 최대 기록 시간 | 1,602,047 ns |
| 최소 로드·검증 시간 | 16,361 ns |
| 중앙 로드·검증 시간 | 16,580 ns |
| p95 로드·검증 시간 | 31,288 ns |
| 최대 로드·검증 시간 | 31,288 ns |

## 결정론

모든 Empty Tick 샘플은 동일한 최종 상태를 생성했다.

```text
final tick: 10,000,000
final digest: 5378a13874e79360
```

## CI 게이트 결과

다음 항목이 모두 통과했다.

- `cargo fmt --check`
- Clippy `-D warnings`
- Rust 전체 테스트
- RenderSnapshot 생성
- Save → Load → 재실행 연속성
- Release benchmark 실행
- 최소 100,000 ticks/s 하한
- Snapshot p95 2초 이하
- Save p95 2초 이하
- Load p95 5초 이하
- Snapshot·Save 파일 존재와 크기 검증
- Benchmark artifact 업로드
- TypeScript Viewer 계약 검사와 production build
- 기존 V5 검증

## 후속 기준

후속 기준선이 누적되면 동일 환경·동일 설정의 중앙값을 비교한다.

초기 경고 후보:

- Empty Tick 중앙 처리량 10% 이상 저하
- Snapshot 중앙 기록 시간 20% 이상 증가
- Save 중앙 기록 시간 20% 이상 증가
- Save Load 중앙 시간 20% 이상 증가
- Snapshot 또는 Save 크기 10% 이상 증가

공유 runner의 변동성 때문에 단일 실행만으로 병합을 차단하지 않는다. 반복 기준선이 확보된 뒤 통계적 회귀 기준을 별도 확정한다.
