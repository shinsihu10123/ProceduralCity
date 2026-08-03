# Stage 0.8 개발 환경 구축

문서 버전: 0.8.5-draft  
상태: 구현·자동 검증 완료, Stage 0 최종 판정 대기  
기준 브랜치: `stage0-rebuild`

## 1. 운영 결정

초기 개발 단말은 iPad로 한다. iPad는 편집·검토·터미널 접속·웹 Viewer 확인에 사용하고, 실제 컴파일과 자동 테스트는 GitHub Codespaces 및 GitHub Actions의 Linux 환경에서 수행한다.

Stage 0.7의 H0·H1 성능 목표는 폐기하지 않는다. GitHub Actions 수치는 공유 클라우드 환경의 회귀 기준선이며, 공식 H1 성능은 이후 네이티브 실행 장비 또는 별도 연구 서버에서 검증한다.

## 2. 저장소 정책

- 저장소: `shinsihu10123/ProceduralCity`
- 기존 Deep Time V5: `main`에 보존
- Stage 0 재구축: `stage0-rebuild`
- 작업 PR: Draft PR #25
- Stage 0.8 완료 판정 전 병합 금지

기존 V5는 시각화와 비교 참고 자료로만 사용한다. 새 코어는 고정 틱, 단일 상태 소유권, Command → Resolution → Commit → Event 원칙을 기준으로 재작성한다.

## 3. 초기 기술 스택

| 영역 | 결정 |
|---|---|
| 개발 접속 | iPad Safari |
| 원격 개발 | GitHub Codespaces |
| 시뮬레이션 코어 | Rust |
| 빌드·패키지 | Cargo workspace |
| 실행 방식 | Headless-first |
| 계약 직렬화 | Serde + JSON |
| 영속화 계층 | 별도 Rust `persistence` crate |
| 파일 기록 | temporary file + `sync_all` + atomic rename |
| 웹 Viewer | TypeScript + Three.js + Vite |
| 성능 실행기 | 별도 Rust `benchmark` app |
| 성능 결과 계약 | `performance-run.v1` |
| 자동 검증 | GitHub Actions |
| CI 운영체제 | Ubuntu Linux |
| Rust 검사 | rustfmt, Clippy, cargo test |
| Viewer 검사 | Snapshot runtime validation, TypeScript strict check, Vite build |

## 4. 현재 생성된 구조

```text
.devcontainer/devcontainer.json
.github/workflows/stage0-ci.yml
Cargo.toml
rust-toolchain.toml
crates/contracts/Cargo.toml
crates/contracts/src/lib.rs
crates/contracts/src/world_save.rs
crates/contracts/src/performance.rs
crates/kernel/Cargo.toml
crates/kernel/src/lib.rs
crates/persistence/Cargo.toml
crates/persistence/src/lib.rs
apps/headless/Cargo.toml
apps/headless/src/main.rs
apps/benchmark/Cargo.toml
apps/benchmark/src/main.rs
apps/viewer/package.json
apps/viewer/tsconfig.json
apps/viewer/index.html
apps/viewer/public/snapshots/latest.json
apps/viewer/scripts/validate-snapshot.mjs
apps/viewer/src/main.ts
apps/viewer/src/style.css
schemas/snapshots/render-snapshot.v1.schema.json
schemas/saves/world-save.v1.schema.json
schemas/performance/performance-run.v1.schema.json
docs/contracts/render-snapshot-v1.md
docs/contracts/world-save-v1.md
docs/contracts/performance-run-v1.md
docs/performance/baselines/stage0-cloud-baseline-2026-08-03.json
docs/performance/baselines/stage0-cloud-baseline-2026-08-03.md
```

## 5. 최소 Kernel

현재 Kernel은 다음을 구현한다.

- `Tick`
- `SimulationHost`
- 시작·일시정지 lifecycle
- 한 번에 정확히 1틱 전진
- 정지 상태의 전진 거부
- tick overflow 오류
- 동일 seed·동일 tick의 결정론 digest
- `SimulationCheckpoint`
- checkpoint 생성
- checkpoint 복원
- 복원 전후 digest 연속성 테스트

렌더링 frame delta는 Kernel 입력으로 받지 않는다.

## 6. Headless 실행과 Snapshot 출력

기본 실행:

```bash
cargo run -p artificial-world-headless -- --ticks 10000 --seed 42
```

Viewer용 Snapshot 출력:

```bash
cargo run -p artificial-world-headless -- \
  --ticks 10000 \
  --seed 42 \
  --snapshot-output apps/viewer/public/snapshots/latest.json
```

Snapshot은 Persistence 계층에서 계약 검증 후 transactional write로 기록한다.

## 7. RenderSnapshot v1

스키마 ID:

```text
render-snapshot.v1
```

필드:

- `schemaVersion`
- `source`
- `tick`
- `seed`
- `digest`
- `lodCounts`
- `regions`
- `entities`
- `events`

현재 Kernel에는 권위 개체·사건·Region 상태가 아직 없으므로 관련 배열과 LOD 계수는 0으로 출력한다. Viewer가 표시하는 네 구역은 좌표 확인용 presentation scaffold이며 권위 상태가 아니다.

데이터 흐름:

```text
SimulationHost
→ Headless snapshot publisher
→ Rust contract validation
→ RenderSnapshot JSON
→ TypeScript runtime validation
→ Three.js Viewer
```

## 8. World Save v1

스키마:

```text
world-save.v1
kernel-state.v1
```

현재 저장 범위:

- authoritative tick
- world seed
- running lifecycle state
- Kernel deterministic digest
- Kernel module manifest
- seed-only configuration hash
- Random Service 위치와 카운터 자리표시자
- Event Ledger 위치 자리표시자
- Intervention count 자리표시자
- canonical manifest digest

저장:

```bash
cargo run -p artificial-world-headless -- \
  --ticks 10000 \
  --seed 42 \
  --save-output target/manual/world-save.json
```

복원과 추가 실행:

```bash
cargo run -p artificial-world-headless -- \
  --load target/manual/world-save.json \
  --ticks 10000
```

`--load`와 `--seed`는 함께 사용할 수 없다. 저장 파일이 world seed를 소유한다.

복원 시 계약, ID, tick, seed, module manifest, configuration hash와 manifest digest를 검증하고, Kernel checkpoint를 복원한 뒤 deterministic digest를 재계산한다. 저장값과 복원값이 다르면 실행을 거부한다.

## 9. 웹 디버그 Viewer

Viewer는 `/snapshots/latest.json`을 읽는다.

- 고정 mock 행위자·사건 생성 제거
- 버전과 source 검사
- tick·seed·digest 표시
- Region·Entity·Event 배열 표시
- 알 수 없는 스키마 거부
- 파일 누락·손상 시 명시적 오류 화면
- 권위 상태 쓰기 경로 없음

실행:

```bash
npm install --prefix apps/viewer --no-audit --no-fund
npm --prefix apps/viewer run validate:snapshot
npm --prefix apps/viewer run dev -- --host 0.0.0.0
```

Codespaces의 전달 포트 `5173`에서 확인한다.

## 10. PerformanceRunManifest v1

계약:

```text
performance-run.v1
stage0-kernel-baseline.v1
```

측정 대상:

- Empty fixed-tick 실행 시간
- Empty Tick 처리량
- RenderSnapshot transactional write 시간과 크기
- World Save transactional write 시간과 크기
- World Save load·계약 검증 시간
- 최종 tick과 결정론 digest
- 실행 환경, Rust 버전, build profile, sample 구성

수동 실행:

```bash
cargo run --release -p artificial-world-benchmark -- \
  --output target/benchmark/performance-run.json \
  --seed 42 \
  --warmup-ticks 1000000 \
  --measured-ticks 10000000 \
  --samples 7
```

산출물:

```text
target/benchmark/performance-run.json
target/benchmark/artifacts/render-snapshot.json
target/benchmark/artifacts/world-save.json
```

시간은 정수 나노초, 처리량은 정수 ticks/s로 저장한다. 동일 입력의 모든 샘플이 동일 digest를 생성하지 않으면 벤치마크를 실패 처리한다.

## 11. 최초 클라우드 기준선

실행:

- Workflow run: `30812184674`
- Artifact ID: `8855227183`
- Artifact SHA-256: `7e9c0f7d8fd91d4529568bb3c77935cc9bb83d3c10f9276dca148009b4f13335`
- GitHub Actions Linux x86_64
- 논리 CPU 4개
- Rust `1.97.1`
- Release build
- Seed 42
- Warm-up 1,000,000틱
- 샘플당 10,000,000틱
- 7회 반복

결과:

| 측정 항목 | minimum | median | p95 / maximum |
|---|---:|---:|---:|
| Empty Tick 실행 시간 | 6,243,372 ns | 6,275,041 ns | 6,314,535 ns |
| Empty Tick 처리량 | 1,583,647,885 ticks/s | 1,593,615,085 ticks/s | 1,601,698,569 ticks/s max |
| Snapshot 기록 | 413,193 ns | 542,575 ns | 4,254,230 ns |
| Save 기록 | 447,227 ns | 504,494 ns | 1,602,047 ns |
| Save load·검증 | 16,361 ns | 16,580 ns | 31,288 ns |

파일과 결정론:

| 항목 | 값 |
|---|---:|
| Snapshot 크기 | 251 bytes |
| Save 크기 | 858 bytes |
| Final tick | 10,000,000 |
| Final digest | `5378a13874e79360` |

현재 `SimulationHost::step`은 tick 증가와 lifecycle 검사만 수행한다. 따라서 15억 ticks/s 수준의 수치는 미래 전체 시뮬레이션 용량이 아니라 최소 Kernel 실행 오버헤드의 기준점이다.

GitHub Actions는 공유 runner이므로 이 수치를 Stage 0.7의 H1 공식 성능 판정에 사용하지 않는다. 후속 변경의 극단적 회귀 탐지와 측정 파이프라인 검증에 사용한다.

## 12. CI 게이트

### Rust·Persistence

1. `cargo fmt --all -- --check`
2. `cargo clippy --workspace --all-targets -- -D warnings`
3. `cargo test --workspace`
4. 10,000틱 실행
5. `RenderSnapshot` JSON 출력
6. Snapshot 파일 존재 확인
7. 20,000틱 무중단 실행
8. 10,000틱 checkpoint 저장
9. Save Load 후 10,000틱 추가 실행
10. 무중단 실행과 복원 실행의 tick·seed·digest 비교

### Cloud baseline benchmark

1. Rust Release build
2. 1,000,000틱 warm-up
3. 10,000,000틱 × 7회 측정
4. 모든 샘플 digest 일치
5. 최소 Empty Tick 100,000 ticks/s
6. Snapshot p95 2초 이하
7. Save p95 2초 이하
8. Save load p95 5초 이하
9. Snapshot·Save 파일 존재와 크기 검증
10. Manifest와 실제 Snapshot·Save를 workflow artifact로 보존

### Kernel → Viewer

1. CI에서 Headless를 실행해 Viewer Snapshot 생성
2. Node 기반 Snapshot 계약 검사
3. TypeScript strict type-check
4. Vite production build

2026-08-03 기준 다음 Job이 모두 성공했다.

- Rust kernel, persistence, and headless runner
- Stage 0 cloud baseline benchmark
- Kernel snapshot to TypeScript viewer
- 기존 Validate city engine

Snapshot 검증값:

```json
{
  "tick": 10000,
  "seed": 42,
  "digest": "40885885fe2db25d",
  "snapshotWritten": true
}
```

Save Load 연속성 검증값:

```json
{
  "direct": {
    "tick": 20000,
    "seed": 42,
    "digest": "a315c4dc327dc8a0"
  },
  "checkpoint": {
    "tick": 10000,
    "seed": 42,
    "digest": "40885885fe2db25d",
    "saveWritten": true
  },
  "resumed": {
    "startTick": 10000,
    "tick": 20000,
    "seed": 42,
    "digest": "a315c4dc327dc8a0",
    "loaded": true
  },
  "continuity": "verified"
}
```

## 13. Codespaces 및 iPad 수동 검증

완료:

- iPad에서 `stage0-rebuild` Codespace 기동
- Dev Container 환경 진입
- 포트 5173 전달
- 초기 Viewer 실제 화면 표시
- 3D 렌더링과 터치 조작

Kernel Snapshot 연결, Save Load, 벤치마크는 GitHub Actions Linux 환경에서 자동 검증됐다. 최신 Snapshot 화면의 iPad 재확인은 보조 수동 검사이며 Stage 0.8 자동 승인 게이트에는 포함하지 않는다.

## 14. 진행 상태

| 단계 | 상태 |
|---|---|
| 0.8.1 iPad·클라우드 개발 방식 | 완료 |
| 0.8.2 기존 V5 보존 방침 | 완료 |
| 0.8.3 재구축 브랜치 | 완료 |
| 0.8.4 Dev Container·Codespaces | 완료 |
| 0.8.5 Rust workspace | 완료 |
| 0.8.6 GitHub Actions CI | 완료 |
| 0.8.7 웹 디버그 Viewer 스켈레톤 | 완료 |
| 0.8.8 Kernel 최소 실행 | 완료 |
| 0.8.9.1 Snapshot JSON 계약 | 완료 — CI 검증 |
| 0.8.9.2 Kernel → Viewer 연결 | 완료 — CI 검증 |
| 0.8.9.3 World Save 계약 | 완료 — CI 검증 |
| 0.8.9.4 Save Load 결정론 연속성 | 완료 — CI 검증 |
| 0.8.9.5 기준선 벤치마크 | 완료 — Release CI 및 artifact 검증 |
| 0.8.10 Stage 0 완료 판정 | 다음 |

## 15. 다음 작업

1. Stage 0.1~0.8 산출물과 실제 저장소 구현의 일치 여부 검토
2. 미충족 항목과 의도적 연기 항목 분리
3. Draft PR #25 최종 상태 검토
4. Stage 0 완료 판정서 작성
5. 완료 승인 후 다음 개발 Stage 진입
