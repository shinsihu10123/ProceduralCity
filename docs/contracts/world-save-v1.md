# World Save v1

상태: 구현·검증 진행 중  
스키마 ID: `world-save.v1`  
Kernel 상태 스키마: `kernel-state.v1`

## 목적

특정 틱 경계의 권위 Kernel 상태를 저장하고, 같은 코드와 설정에서 복원한 뒤 무중단 실행과 동일한 결정론적 결과를 생성한다.

## 데이터 흐름

```text
SimulationHost
→ SimulationCheckpoint
→ WorldSaveManifest v1
→ contract validation
→ temporary JSON file
→ file sync
→ atomic rename
→ read and validate
→ SimulationCheckpoint restore
→ Kernel digest recomputation
→ additional fixed ticks
→ uninterrupted run digest comparison
```

## 소유권

- Kernel: `tick`, `world_seed`, `running`, deterministic digest 알고리즘
- Contracts: `WorldSaveManifest`, `KernelStateRecord`, 교차 필드 검증
- Persistence: JSON 직렬화·역직렬화와 transactional file I/O
- Headless: Kernel checkpoint와 저장 계약의 매핑, 실행 재개

Persistence는 Kernel 내부 구조를 직접 수정하거나 임의 해석하지 않는다.

## 현재 v1 범위

현재 구현된 권위 상태는 최소 Kernel 상태뿐이다.

- authoritative tick
- world seed
- running lifecycle state
- deterministic digest
- Kernel module manifest
- seed-only configuration hash
- Random Service 자리표시자: stream 0, draw 0
- Event Ledger 자리표시자: event 0
- Intervention Ledger 자리표시자: intervention 0
- canonical manifest digest

개체, 지형, 자원, 사건 원장과 실제 난수 스트림은 해당 모듈이 구현될 때 별도 module state segment로 확장한다.

## 결정론적 식별자

```text
worldId = world-{seed:016x}
saveId  = save-{seed:016x}-{tick:016x}
```

현재 `createdAtUtc`는 `null`로 기록한다. 실시간 생성 시각은 결정론적 승인 경로와 분리된 비권위 메타데이터 정책이 확정될 때 추가한다.

## 저장 명령

```bash
cargo run -p artificial-world-headless -- \
  --ticks 10000 \
  --seed 42 \
  --save-output target/manual/world-save.json
```

## 복원·재실행 명령

```bash
cargo run -p artificial-world-headless -- \
  --load target/manual/world-save.json \
  --ticks 10000
```

`--load`와 `--seed`는 함께 사용할 수 없다. 저장 파일이 세계 시드를 소유한다.

## 복원 검증

복원 시 다음을 순서대로 검증한다.

1. JSON 역직렬화
2. `world-save.v1` 및 `kernel-state.v1` 확인
3. 결정론적 `worldId`와 `saveId`
4. world tick과 Kernel tick 일치
5. Random state seed와 Kernel seed 일치
6. Kernel module manifest 일치
7. configuration hash 일치
8. canonical manifest digest 일치
9. Kernel checkpoint 복원
10. Kernel deterministic digest 재계산 및 저장값과 비교

하나라도 실패하면 세계 실행을 재개하지 않는다.

## Transactional write

1. 최종 경로의 부모 디렉터리 생성
2. `.tmp` 파일에 canonical JSON 기록
3. 파일 `sync_all`
4. 최종 경로로 rename

기록 실패 시 기존 정상 저장 파일을 부분 데이터로 덮어쓰지 않는다.

## 연속성 승인 조건

다음 두 실행의 최종 `tick`, `seed`, `digest`가 완전히 같아야 한다.

```text
A: seed 42 → 20,000 ticks
B: seed 42 → 10,000 ticks → Save → Load → 10,000 ticks
```

현재 Kernel은 D0 Strict Deterministic 대상으로 byte-equivalent digest 일치를 요구한다.

## 버전 정책

- optional 비권위 메타데이터 추가: 호환 가능한 변경 검토 가능
- Kernel 필드 의미·타입 변경: 새 `kernel-state` 버전 필요
- module segment 구조 변경: module schema migration 필요
- 과거 저장을 해석할 수 없는 변경: `world-save.v2` 또는 명시적 migration 필요
