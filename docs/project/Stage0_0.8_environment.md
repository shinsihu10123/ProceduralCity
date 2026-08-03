# Stage 0.8 개발 환경 구축

문서 버전: 0.8.1-draft  
상태: 진행 중  
기준 브랜치: `stage0-rebuild`

## 1. 운영 결정

초기 개발 단말은 iPad로 한다. iPad는 편집·검토·터미널 접속·웹 Viewer 확인에 사용하고, 실제 컴파일과 자동 테스트는 GitHub Codespaces 및 GitHub Actions의 Linux 환경에서 수행한다.

Stage 0.7의 H0·H1 성능 목표는 폐기하지 않는다. 해당 목표는 이후 네이티브 실행 장비 또는 별도 연구 서버에서 검증한다.

## 2. 저장소 정책

- 저장소: `shinsihu10123/ProceduralCity`
- 기존 Deep Time V5: `main`에 보존
- Stage 0 재구축: `stage0-rebuild`
- 작업 PR: Draft PR #25
- Stage 0.8 완료 전 병합 금지

기존 V5는 시각화와 비교 참고 자료로만 사용한다. 새 코어는 고정 틱, 단일 상태 소유권, Command → Resolution → Commit → Event 원칙을 기준으로 재작성한다.

## 3. 초기 기술 스택

| 영역 | 결정 |
|---|---|
| 개발 접속 | iPad Safari |
| 원격 개발 | GitHub Codespaces |
| 시뮬레이션 코어 | Rust |
| 빌드·패키지 | Cargo workspace |
| 실행 방식 | Headless-first |
| 웹 Viewer | TypeScript + Three.js + Vite |
| 자동 검증 | GitHub Actions |
| CI 운영체제 | Ubuntu Linux |
| Rust 검사 | rustfmt, Clippy, cargo test |
| Viewer 검사 | TypeScript strict check, Vite production build |

## 4. 현재 생성된 구조

```text
.devcontainer/devcontainer.json
.github/workflows/stage0-ci.yml
Cargo.toml
rust-toolchain.toml
crates/kernel/Cargo.toml
crates/kernel/src/lib.rs
apps/headless/Cargo.toml
apps/headless/src/main.rs
apps/viewer/package.json
apps/viewer/tsconfig.json
apps/viewer/index.html
apps/viewer/src/main.ts
apps/viewer/src/style.css
```

## 5. 최소 Kernel

현재 Kernel은 다음만 구현한다.

- `Tick`
- `SimulationHost`
- 시작·일시정지 lifecycle
- 한 번에 정확히 1틱 전진
- 정지 상태의 전진 거부
- tick overflow 오류
- 동일 seed·동일 tick의 결정론 digest

렌더링 frame delta는 Kernel 입력으로 받지 않는다.

## 6. Headless 실행

기본 명령:

```bash
cargo run -p artificial-world-headless -- --ticks 10000 --seed 42
```

출력에는 최종 tick, seed, deterministic digest가 포함된다.

## 7. 웹 디버그 Viewer

현재 Viewer는 권위 상태를 수정하지 않는 읽기 전용 진단 스켈레톤이다.

표시 항목:

- 모의 `RenderSnapshot`
- Tick
- Seed
- Deterministic digest
- Entity 표식
- Event 표식
- Region 구획
- LOD A~D 계수
- iPad 터치 기반 회전·이동·확대

현재는 Kernel과 실시간 연결하지 않고 고정된 mock snapshot을 사용한다. 다음 단계에서 Headless 출력과 Snapshot 계약을 연결한다.

실행:

```bash
npm install --prefix apps/viewer --no-audit --no-fund
npm --prefix apps/viewer run dev -- --host 0.0.0.0
```

Codespaces의 전달 포트 `5173`에서 확인한다.

## 8. CI 게이트

GitHub Actions는 다음을 검증한다.

### Rust

1. `cargo fmt --all -- --check`
2. `cargo clippy --workspace --all-targets -- -D warnings`
3. `cargo test --workspace`
4. 10,000틱 Headless smoke test

### Viewer

1. Node.js 환경 구성
2. Viewer 의존성 설치
3. TypeScript strict type-check
4. Vite production build

2026-08-03 기준 최신 Stage 0 CI와 기존 city engine 검증이 모두 성공했다.

## 9. Codespaces 검증

2026-08-03 사용자 확인으로 iPad에서 `stage0-rebuild` Codespace의 실제 기동을 완료했다.

남은 수동 검증:

```bash
git pull
rustc --version
cargo --version
node --version
npm --version
cargo test --workspace
cargo run -p artificial-world-headless -- --ticks 10000 --seed 42
npm install --prefix apps/viewer --no-audit --no-fund
npm --prefix apps/viewer run dev -- --host 0.0.0.0
```

## 10. 진행 상태

| 단계 | 상태 |
|---|---|
| 0.8.1 iPad·클라우드 개발 방식 | 완료 |
| 0.8.2 기존 V5 보존 방침 | 완료 |
| 0.8.3 재구축 브랜치 | 완료 |
| 0.8.4 Dev Container 구성 파일 | 완료 |
| 0.8.4 Codespaces 실제 기동 | 완료 — 사용자 확인 |
| 0.8.5 Rust workspace | 완료 |
| 0.8.6 GitHub Actions CI | 완료 |
| 0.8.7 웹 디버그 Viewer 스켈레톤 | 완료 — CI build 성공 |
| 0.8.8 Kernel 최소 실행 | CI 검증 완료 |
| 0.8.9 Save/Load·기준선 벤치마크 | 다음 |
| 0.8.10 Stage 0 완료 판정 | 대기 |

## 11. 다음 작업

1. Codespace에서 최신 `stage0-rebuild` pull
2. Rust·Node 버전과 로컬 테스트 확인
3. 10,000틱 Headless 실행 확인
4. 포트 5173에서 Viewer 실제 화면 확인
5. Snapshot JSON 계약 추가
6. Kernel → Viewer 데이터 연결
7. Save/Load 최소 구현
8. 최초 기준선 벤치마크 실행
