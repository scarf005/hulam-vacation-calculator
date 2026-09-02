# 휴램 휴가 사용일 계산기

<img width="556" height="182" alt="image" src="https://github.com/user-attachments/assets/578f95e0-f76e-4ae0-ad17-6801d2422b95" />

[hulam.co.kr](https://www.hulam.co.kr) 휴가 신청 목록에서 올해 사용한 휴가 일수를 종류(연차/특별휴가/보상휴가 등)별로 자동 집계해 화면 상단에 표시하고, 각 종류에 마우스를 올리면 날짜별 상세 내역을 툴팁으로 보여줍니다.

크롬 확장 프로그램 및 유저스크립트를 지원합니다.

## 설치

### 1. 크롬 확장 프로그램

<img width="2560" height="1036" alt="image" src="https://github.com/user-attachments/assets/636baa83-fa63-4292-b2de-e52c7a0a2541" />

1. https://github.com/scarf005/hulam-vacation-calculator/releases 로 이동합니다
2. [`.zip` 파일](https://github.com/scarf005/hulam-vacation-calculator/releases/latest/download/hulam-vacation-calculator-extension.zip)을 다운로드 후 압축 해제합니다.

<img width="1072" height="652" alt="image" src="https://github.com/user-attachments/assets/7eafa687-9277-491f-9aa7-0c5d31e2475f" />

3. 크롬 주소창에서 `chrome://extensions` 를 입력하여 확장 프로그램 탭으로 진입합니다

<img width="1072" height="652" alt="image" src="https://github.com/user-attachments/assets/d5337d36-570d-4738-9c6a-d2492a216e20" />

4. 우측 상단의 `개발자 모드`를 활성화합니다

<img width="496" height="264" alt="image" src="https://github.com/user-attachments/assets/eafed9e3-569a-41db-9069-967bad4425d4" />
<img width="1072" height="652" alt="image" src="https://github.com/user-attachments/assets/65bd11b4-bbf3-454b-a1ea-bd90818bf444" />

5. `압축해제된 확장 프로그램 로드` 를 클릭 후 2단계의 확장 프로그램 폴더를 선택하여 설치합니다.

### 2. 유저스크립트

1. 유저스크립트 확장 프로그램 설치 ([ViolentMonkey](https://violentmonkey.github.io/) 또는 [Tampermonkey](https://www.tampermonkey.net/) 등)
2. 아래 링크 클릭 → 설치 화면에서 **설치**
   [`hulam-vacation-calculator.user.js`](https://github.com/scarf005/hulam-vacation-calculator/releases/latest/download/hulam-vacation-calculator.user.js)


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
