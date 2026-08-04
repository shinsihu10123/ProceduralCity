# RenderSnapshot v1

상태: 구현·CI 검증 완료  
스키마 ID: `render-snapshot.v1`

## 목적

시뮬레이션의 권위 상태를 Viewer가 직접 참조하지 않도록, 특정 틱의 읽기 전용 표현을 JSON으로 전달한다.

## 데이터 흐름

```text
SimulationHost
→ Headless snapshot publisher
→ RenderSnapshot validation
→ transactional JSON write
→ Vite public/snapshots/latest.json
→ TypeScript runtime validation
→ Three.js Viewer
```

## 소유권

- Kernel: authoritative tick, seed 기반 실행 상태, deterministic digest
- Contracts crate: Snapshot 필드와 유효성 규칙
- Headless: Kernel 상태를 Snapshot으로 매핑하고 파일로 기록
- Viewer: Snapshot을 읽고 표시만 수행

Viewer는 Kernel 또는 도메인 상태를 수정하지 않는다.

## 현재 v1 필드

- `schemaVersion`
- `source`
- `tick`
- `seed`
- `digest`
- `lodCounts`
- `regions`
- `entities`
- `events`

현재 Kernel에는 권위 개체·사건·Region 상태가 아직 없으므로 세 배열과 LOD 계수는 0으로 출력한다. Viewer가 표시하는 네 구역은 좌표 확인용 presentation scaffold이며 Snapshot 권위 상태가 아니다.

## 생성 명령

```bash
cargo run -p artificial-world-headless -- \
  --ticks 10000 \
  --seed 42 \
  --snapshot-output apps/viewer/public/snapshots/latest.json
```

## Viewer 실행

```bash
npm install --prefix apps/viewer --no-audit --no-fund
npm --prefix apps/viewer run validate:snapshot
npm --prefix apps/viewer run dev -- --host 0.0.0.0
```

## 검증

CI는 다음을 수행한다.

1. Rust 계약 직렬화·역직렬화 round-trip
2. Snapshot 내부 유효성 검사
3. Headless JSON 생성
4. 파일 존재 검사
5. Node 기반 계약 검사
6. TypeScript strict type-check
7. Vite production build

## 버전 정책

- 호환 가능한 선택 필드 추가: minor-compatible 변경
- 필드 의미·단위·타입 변경: 새 스키마 버전 필요
- Viewer는 알 수 없는 `schemaVersion`을 거부
- 기존 v1 파일을 새 의미로 덮어쓰지 않음
