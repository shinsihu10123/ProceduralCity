# Stage 0.8 개발 환경 구축

문서 버전: 0.8.6  
상태: **완료 — Stage 0 최종 승인**  
기준 브랜치: `stage0-rebuild`  
최종 판정서: `Stage0_completion_assessment.md`

## 1. 운영 결정

초기 개발 단말은 iPad로 한다. iPad는 편집·검토·터미널 접속·웹 Viewer 확인에 사용하고, 실제 컴파일과 자동 테스트는 GitHub Codespaces 및 GitHub Actions Linux 환경에서 수행한다.

Stage 0.7의 H0·H1 성능 목표는 유지한다. GitHub Actions 수치는 공유 클라우드 환경의 회귀 기준선이며, 공식 H1 성능은 이후 네이티브 실행 장비 또는 별도 연구 서버에서 검증한다.

## 2. 저장소 정책

- 저장소: `shinsihu10123/ProceduralCity`
- 기존 Deep Time V5: `main`에 보존
- Stage 0 재구축: `stage0-rebuild`
- 작업 PR: Draft PR #25
- 기술적 상태: Stage 0 merge-ready
- 실제 Draft 해제와 병합: 저장소 소유자의 명시적 승인 필요

기존 V5는 시각화와 비교 참고 자료로만 사용한다. 새 코어는 고정 틱, 단일 상태 소유권, `Command → Resolution → Commit → Event` 원칙을 기준으로 재작성한다.

## 3. 확정 기술 스택

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

## 4. 기준 문서와 저장소 구조

Stage 0 기준본:

```text
docs/specs/stage0/README.md
docs/specs/stage0/Stage0_0.1_project_philosophy.txt
docs/specs/stage0/Stage0_0.2_core_principles.txt
docs/specs/stage0/Stage0_0.3_architecture.txt
docs/specs/stage0/Stage0_0.4_development_rules.txt
docs/specs/stage0/Stage0_0.5_code_structure/
docs/specs/stage0/Stage0_0.6_data_structure/
docs/specs/stage0/Stage0_0.7_performance_targets/
docs/project/glossary.md
docs/adr/stage0-decision-register.md
docs/project/Stage0_completion_assessment.md
```

실행 기반:

```text
.devcontainer/devcontainer.json
.github/workflows/stage0-ci.yml
Cargo.toml
rust-toolchain.toml
crates/contracts/
crates/kernel/
crates/persistence/
apps/headless/
apps/benchmark/
apps/viewer/
schemas/snapshots/
schemas/saves/
schemas/performance/
docs/contracts/
docs/performance/baselines/
```

## 5. 최소 Kernel

현재 Kernel 구현:

- `Tick`
- `SimulationHost`
- 시작·일시정지 lifecycle
- 한 번에 정확히 1틱 전진
- 정지 상태 전진 거부
- tick overflow 오류
- 동일 seed·동일 tick의 결정론 digest
- `SimulationCheckpoint`
- checkpoint 생성·복원
- 복원 전후 digest 연속성 테스트

렌더링 frame delta는 Kernel 입력으로 받지 않는다.

## 6. Headless와 RenderSnapshot

기본 실행:

```bash
cargo run -p artificial-world-headless -- --ticks 10000 --seed 42
```

Viewer Snapshot 출력:

```bash
cargo run -p artificial-world-headless -- \
  --ticks 10000 \
  --seed 42 \
  --snapshot-output apps/viewer/public/snapshots/latest.json
```

`render-snapshot.v1` 필드:

- `schemaVersion`
- `source`
- `tick`
- `seed`
- `digest`
- `lodCounts`
- `regions`
- `entities`
- `events`

현재 Kernel에는 실제 Region·Entity·Event 권위 상태가 아직 없으므로 관련 배열은 비어 있다. Viewer가 표시하는 좌표 구획은 presentation scaffold이며 권위 상태가 아니다.

데이터 흐름:

```text
SimulationHost
→ Headless snapshot publisher
→ Rust contract validation
→ transactional JSON write
→ TypeScript runtime validation
→ Three.js Viewer
```

## 7. World Save v1

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
- configuration hash
- Random Service 확장 위치
- Event Ledger 확장 위치
- Intervention 확장 위치
- canonical manifest digest

저장:

```bash
cargo run -p artificial-world-headless -- \
  --ticks 10000 \
  --seed 42 \
  --save-output target/manual/world-save.json
```

복원·추가 실행:

```bash
cargo run -p artificial-world-headless -- \
  --load target/manual/world-save.json \
  --ticks 10000
```

`--load`와 `--seed`는 함께 사용할 수 없다. 복원 시 계약, ID, tick, seed, module manifest, configuration hash, manifest digest를 검증하고 Kernel digest가 저장값과 다르면 실행을 거부한다.

결정론 연속성 검증:

```text
직접 20,000틱:       a315c4dc327dc8a0
10,000틱 저장:       40885885fe2db25d
복원 후 20,000틱:   a315c4dc327dc8a0
```

## 8. 웹 디버그 Viewer

Viewer는 `/snapshots/latest.json`을 읽는다.

- 고정 mock 행위자·사건 생성 제거
- schema version과 source 검사
- tick·seed·digest 표시
- Region·Entity·Event 표시
- 알 수 없는 스키마 거부
- 파일 누락·손상 시 명시적 오류
- 권위 상태 쓰기 경로 없음
- iPad 터치 회전·이동·확대 검증 완료

실행:

```bash
npm install --prefix apps/viewer --no-audit --no-fund
npm --prefix apps/viewer run validate:snapshot
npm --prefix apps/viewer run dev -- --host 0.0.0.0
```

Codespaces 전달 포트 `5173`에서 확인한다.

## 9. PerformanceRunManifest v1

계약:

```text
performance-run.v1
stage0-kernel-baseline.v1
```

측정 대상:

- Empty fixed-tick 실행 시간과 처리량
- RenderSnapshot transactional write 시간·크기
- World Save transactional write 시간·크기
- World Save load·계약 검증 시간
- 최종 tick과 결정론 digest
- 실행 환경·Rust 버전·build profile·sample 구성

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

동일 입력의 모든 sample이 같은 digest를 만들지 않으면 benchmark를 실패 처리한다.

## 10. 최초 클라우드 기준선

환경:

- GitHub Actions Linux x86_64
- 논리 CPU 4개
- Rust 1.97.1
- Release build
- Seed 42
- warm-up 1,000,000틱
- sample당 10,000,000틱
- 7회 반복

| 측정 항목 | minimum | median | p95 / maximum |
|---|---:|---:|---:|
| Empty Tick 실행 시간 | 6,243,372 ns | 6,275,041 ns | 6,314,535 ns |
| Empty Tick 처리량 | 1,583,647,885 ticks/s | 1,593,615,085 ticks/s | 1,601,698,569 ticks/s max |
| Snapshot 기록 | 413,193 ns | 542,575 ns | 4,254,230 ns |
| Save 기록 | 447,227 ns | 504,494 ns | 1,602,047 ns |
| Save load·검증 | 16,361 ns | 16,580 ns | 31,288 ns |

```text
Snapshot size: 251 bytes
Save size:     858 bytes
Final tick:    10,000,000
Final digest:  5378a13874e79360
```

이 수치는 최소 Kernel 실행 오버헤드의 클라우드 회귀 기준선이다. 미래 전체 시뮬레이션 성능이나 H1 공식 판정이 아니다.

## 11. CI 게이트

### Rust·Persistence

1. `cargo fmt --all -- --check`
2. `cargo clippy --workspace --all-targets -- -D warnings`
3. `cargo test --workspace`
4. RenderSnapshot 생성·존재 검증
5. 20,000틱 직접 실행
6. 10,000틱 checkpoint 저장
7. 복원 후 10,000틱 추가 실행
8. tick·seed·digest 연속성 비교

### Cloud baseline benchmark

1. Rust Release build
2. warm-up과 7회 반복
3. 모든 sample digest 일치
4. Empty Tick 최소 처리량
5. Snapshot·Save·Load p95 한도
6. 파일 크기와 산출물 존재
7. workflow artifact 보존

### Kernel → Viewer

1. Headless가 Snapshot 생성
2. Node Snapshot 계약 검사
3. TypeScript strict 검사
4. Vite production build

### 기존 구현 보존

기존 `Validate city engine` workflow도 병행 실행해 `main`의 V5 자산과 기존 경로를 훼손하지 않는지 검사한다.

## 12. iPad·Codespaces 실제 검증

완료:

- iPad에서 `stage0-rebuild` Codespace 기동
- Dev Container 진입
- Rust·Node 도구 실행
- 포트 5173 전달
- Viewer 실제 화면 표시
- 3D 렌더링
- 터치 회전·확대·이동
- Kernel Snapshot 표시

## 13. 완료 상태

| 단계 | 상태 |
|---|---|
| 0.8.1 iPad·클라우드 개발 방식 | 완료 |
| 0.8.2 기존 V5 보존 방침 | 완료 |
| 0.8.3 재구축 브랜치 | 완료 |
| 0.8.4 Dev Container·Codespaces | 완료 |
| 0.8.5 Rust workspace | 완료 |
| 0.8.6 GitHub Actions CI | 완료 |
| 0.8.7 웹 디버그 Viewer | 완료 |
| 0.8.8 최소 Kernel | 완료 |
| 0.8.9.1 Snapshot JSON 계약 | 완료 |
| 0.8.9.2 Kernel → Viewer 연결 | 완료 |
| 0.8.9.3 World Save 계약 | 완료 |
| 0.8.9.4 Save→Load 결정론 연속성 | 완료 |
| 0.8.9.5 기준선 벤치마크 | 완료 |
| 0.8.10 Stage 0 완료 판정 | **완료 — PASS** |

## 14. 의도적 후속 구현

다음은 Stage 0.8 미완료가 아니라 Stage 0 종료 후 첫 수직 슬라이스 또는 후속 Stage 범위다.

- 완전한 TimeService
- EntityRegistry와 강한 ID
- RandomService
- JobScheduler
- CommandBus
- ResolutionPipeline
- StateDelta·CommitBatch·StateCommitter
- EventLedger와 Event Segment
- SpatialGrid
- Terrain·Region 권위 상태
- Climate·Water·Resource
- 실제 LOD
- 1,000,000틱 world-state Soak
- Command storm·Event append benchmark
- H1 네이티브 성능 판정
- Biology·Perception·Memory·AI와 문명 도메인

상세 분류는 `Stage0_completion_assessment.md`를 따른다.

## 15. 후속 작업

Stage 0을 종료하고 **Stage 1 — World Engine**으로 진입한다.

첫 구현 순서:

1. TimeService 확장
2. EntityRegistry
3. RandomService
4. 최소 Command→Resolution→Commit→Event 경로
5. SpatialGrid
6. Region·TerrainCellState
7. World Save 확장
8. S0 benchmark와 1,000,000틱 Soak
