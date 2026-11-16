# AI 생활기록부 작성기

## 프로젝트 구성
- `index.html`: HTML/CSS/Vanilla JavaScript 프론트엔드
- `api/generate.js`: Vercel Serverless Function 및 Gemini API 연동
- `vercel.json`: Vercel 함수 설정
- `.gitignore`: 비밀 환경변수 및 배포 파일 제외

## 실행 및 배포
1. GitHub 저장소에 프로젝트 파일을 업로드합니다.
2. Vercel에서 해당 저장소를 Import합니다.
3. Vercel 프로젝트 Settings → Environment Variables에 `GEMINI_API_KEY`를 등록합니다.
4. 선택적으로 `GEMINI_MODEL`을 설정할 수 있습니다. 기본값은 `gemini-2.5-flash`입니다.
5. 배포 후 웹 주소에서 PDF 업로드와 분석을 테스트합니다.

## 주의
- API 키를 `index.html` 또는 GitHub에 입력하지 마세요.
- 학생 개인정보를 제거하거나 익명화한 평가 자료를 사용하세요.
- 파일을 영구 저장하지 않더라도 PDF 내용은 분석을 위해 Google Gemini API로 전송됩니다.
- Vercel 요청 본문 크기 제한과 실행 시간, Gemini API 사용량 제한이 적용됩니다. 15MB 프론트엔드 제한이 모든 배포 환경에서 전송 성공을 보장하지는 않습니다.
- 실제 학교 업무에 사용하기 전에 학교의 개인정보·외부 AI 서비스 이용 기준 및 최신 생활기록부 기재요령을 확인하세요.
