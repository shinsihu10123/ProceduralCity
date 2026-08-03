# Stage 0 기준 문서 색인

상태: 기준본 확정  
적용 브랜치: `stage0-rebuild`  
문서 체계 버전: `stage0-spec-index.v1`

## 1. 목적

이 디렉터리는 Stage 0.1~0.7의 설계 기준본을 버전 관리한다. Stage 0.8의 실제 개발 환경·실행 기반 문서는 `docs/project/Stage0_0.8_environment.md`에서 관리한다.

Stage 0의 완료는 아키텍처 전체 구현 완료를 뜻하지 않는다. 다음을 뜻한다.

1. 프로젝트 철학과 금지 원칙이 확정되었다.
2. 전체 아키텍처·개발 규칙·코드 구조·데이터 구조·성능 목표가 기준본으로 고정되었다.
3. 실제 기술 스택과 저장소가 구축되었다.
4. 최소 Kernel, Snapshot, Save/Load, Viewer, 결정론 검증, 기준선 벤치마크가 실행된다.
5. 후속 Stage가 따라야 할 승인 기준과 연기 항목이 명시되었다.

## 2. 기준 문서

| Stage | 문서 | 버전 | 상태 |
|---|---|---:|---|
| 0.1 | `Stage0_0.1_project_philosophy.txt` | 0.1.0 | 기준안 확정 |
| 0.2 | `Stage0_0.2_core_principles.txt` | 0.2.0 | 기준안 확정 |
| 0.3 | `Stage0_0.3_architecture.txt` | 0.3.0 | 기준안 확정 |
| 0.4 | `Stage0_0.4_development_rules.txt` | 0.4.0 | 기준안 확정 |
| 0.5 | `Stage0_0.5_code_structure/part-00.txt` → `part-02.txt` | 0.5.0 | 기준안 확정 |
| 0.6 | `Stage0_0.6_data_structure/part-00.txt` → `part-03.txt` | 0.6.0 | 기준안 확정 |
| 0.7 | `Stage0_0.7_performance_targets/part-00.txt` → `part-02.txt` | 0.7.0 | 기준안 확정 |
| 0.8 | `../../project/Stage0_0.8_environment.md` | 0.8.x | 실제 환경·기반 구현 |

## 3. 다중 파트 문서 규칙

GitHub Contents API의 안전한 텍스트 전송 단위를 유지하기 위해 0.5~0.7 원문은 줄 경계를 보존해 여러 파일로 나눴다.

다음 순서로 단순 연결하면 원문이 된다.

```bash
cat docs/specs/stage0/Stage0_0.5_code_structure/part-*.txt > /tmp/Stage0_0.5_code_structure.txt
cat docs/specs/stage0/Stage0_0.6_data_structure/part-*.txt > /tmp/Stage0_0.6_data_structure.txt
cat docs/specs/stage0/Stage0_0.7_performance_targets/part-*.txt > /tmp/Stage0_0.7_performance_targets.txt
```

원본 기준 SHA-256:

| 문서 | SHA-256 |
|---|---|
| Stage 0.5 | `054e913af3dcbe52a4e0985b6ce0c6070fadc64aa6fe0bdba45a3416e0d58f8e` |
| Stage 0.6 | `e5f8d19614bdbe6720b84d6a5468410c61077c95dac4a7934a3e7ca3e0a71ac3` |
| Stage 0.7 | `e049d8b4ff17511f65a836e19b04aab632dddff149b3ac0b0ee4fa3b03ef18e1` |

파트 경계는 문서 의미나 스키마 경계가 아니다. 수정 시 전체 문서를 재구성하고 원본 SHA-256과 문서 버전을 갱신한다.

## 4. 우선순위

충돌 시 다음 순서를 따른다.

1. Stage 0.1 프로젝트 철학
2. Stage 0.2 강제 원칙과 프로젝트 헌법
3. Stage 0.3 아키텍처와 상태 소유권
4. Stage 0.4 개발·검증 규칙
5. Stage 0.5 코드 배치와 의존 규칙
6. Stage 0.6 데이터 계약
7. Stage 0.7 성능 목표
8. Stage 0.8 기술 스택별 구현 결정

하위 문서는 상위 문서의 원칙을 완화하지 않는다. 변경이 필요하면 Stage 0.4의 변경 등급과 ADR 절차를 따른다.

## 5. 관련 문서

- 프로젝트 용어집: `../../project/glossary.md`
- Stage 0 결정 기록: `../../adr/stage0-decision-register.md`
- Stage 0.8 환경과 실행 증거: `../../project/Stage0_0.8_environment.md`
- Stage 0 최종 판정서: `../../project/Stage0_completion_assessment.md`
- 최초 성능 기준선: `../../performance/baselines/stage0-cloud-baseline-2026-08-03.md`
