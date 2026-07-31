# Procedural City

의존성 없이 실행되는 절차적 생성 기반 3D 도시 웹 앱 MVP입니다. WebGL2를 직접 사용하므로 별도의 빌드 도구나 패키지 설치가 필요하지 않습니다.

## 현재 기능

- 문자열 시드 기반의 재현 가능한 도시 생성
- 절차적 구릉 지형
- 격자형 도로와 차선 표시
- 중심지 접근성에 따른 주거·상업·산업·공공 용도 배정
- 용도와 도심 거리 기반 건물 높이 생성
- 회전·확대·이동 가능한 3D 뷰어
- 도시 규모, 밀도, 지형 굴곡, 도로 간격 조절
- 건물 수, 수용 인구, 평균 높이, 개발 비율 표시
- 생성 결과 JSON 내보내기
- 모바일·태블릿 반응형 레이아웃

## 실행

정적 파일이므로 간단한 로컬 서버에서 실행합니다.

```bash
python3 -m http.server 4173
```

브라우저에서 `http://localhost:4173`에 접속합니다.

## GitHub Pages 배포

이 저장소는 GitHub Pages에 그대로 배포할 수 있습니다.

1. 저장소의 **Settings → Pages**로 이동
2. **Build and deployment**에서 **GitHub Actions** 선택
3. `main` 브랜치에 푸시하면 자동 배포

## 구조

```text
ProceduralCity/
├── .github/workflows/pages.yml
├── docs/architecture.md
├── index.html
├── src/main.js
├── src/style.css
├── LICENSE
└── README.md
```

## 로드맵

### v0.2 — 도시 구조 고도화
- 간선·보조간선·생활도로 계층화
- 곡선 도로 및 교차로 생성
- 블록과 필지 폴리곤 분할
- 공원·학교·병원·역 배치
- 건물 클릭 및 속성 편집

### v0.3 — 실제 공간 데이터
- GeoJSON 가져오기·내보내기
- OpenStreetMap 도로·건물 데이터 연동
- 실제 DEM 고도 데이터 적용
- 좌표계 및 지도 타일 연동

### v0.4 — 도시 시뮬레이션
- 인구·일자리·통근 수요
- 교통량 및 접근성
- 전력·상하수도 수요
- 개발 비용·토지가격·세수
