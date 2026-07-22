# 휴가 사용일 계산기

[hulam.co.kr](https://www.hulam.co.kr) 휴가 신청 목록에서 **올해 사용한 휴가 일수를
종류(연차/특별휴가/보상휴가 등)별로 자동 집계**해 화면 상단에 표시하고, 각 종류에
마우스를 올리면 날짜별 상세 내역을 툴팁으로 보여줍니다.

하나의 소스(`src/main.js`)로 **크롬 확장**과 **유저스크립트** 두 가지를 자동 빌드합니다.

## 설치

### 1. 크롬 확장 (비개발자 권장)

크롬 웹스토어에서 클릭 한 번으로 설치 — 별도 프로그램이 필요 없습니다.

> **웹스토어 링크:** 최초 게시 후 이곳에 추가됩니다.

### 2. 유저스크립트 (Tampermonkey 사용자)

1. [Tampermonkey](https://www.tampermonkey.net/) 설치
2. 아래 링크 클릭 → 설치 화면에서 **설치**
   [`hulam-vacation-calculator.user.js`](https://github.com/scarf005/hulam-vacation-calculator/releases/latest/download/hulam-vacation-calculator.user.js)

이후 새 버전이 릴리스되면 Tampermonkey가 자동으로 업데이트합니다.

## 개발

[Deno](https://deno.com) 필요.

```sh
deno task build   # dist/ 에 유저스크립트 + 확장 + zip 생성
deno task check   # 타입 체크
```

빌드 산출물 (`dist/`, git 미추적):

| 파일 | 용도 |
| --- | --- |
| `dist/hulam-vacation-calculator.user.js` | 유저스크립트 |
| `dist/extension/` | 크롬 MV3 확장 (개발자 모드 → "압축해제된 확장 프로그램 로드") |
| `dist/hulam-vacation-calculator-extension.zip` | 웹스토어 업로드용 |

이름·버전·`@match` 등 메타데이터는 [`src/meta.json`](src/meta.json) 한 곳에서만
관리하며, 유저스크립트 배너와 확장 manifest가 여기서 생성됩니다. 버전을 올리려면
`src/meta.json`의 `version`을 수정하세요.

## 릴리스 / 배포

`vX.Y.Z` 태그를 push하면 [CI](.github/workflows/build.yml)가 자동으로:

1. 유저스크립트 + 확장 zip 빌드
2. GitHub 릴리스 생성 후 두 파일 첨부
3. (시크릿 설정 시) 크롬 웹스토어에 자동 게시

```sh
git tag v2.2.0 && git push origin v2.2.0
```

### 웹스토어 자동 게시 설정 (최초 1회)

1. [Chrome Web Store 개발자 등록](https://chrome.google.com/webstore/devconsole) ($5, 1회)
2. `dist/...-extension.zip`을 콘솔에 최초 수동 업로드 → **확장 ID** 발급
3. [chrome-webstore-upload-keys](https://github.com/fregante/chrome-webstore-upload-keys)
   절차로 API 자격증명 발급
4. 저장소 **Settings → Secrets → Actions**에 등록:
   - `CWS_EXTENSION_ID`
   - `CWS_CLIENT_ID`
   - `CWS_CLIENT_SECRET`
   - `CWS_REFRESH_TOKEN`

시크릿이 없으면 웹스토어 게시 단계만 건너뛰고 릴리스는 정상 생성됩니다.
