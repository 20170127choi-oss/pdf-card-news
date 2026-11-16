// Vercel Serverless Function: POST /api/generate
// Configure GEMINI_API_KEY in Vercel Project Settings > Environment Variables.
const MAX_BYTES = 15 * 1024 * 1024;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function send(res, status, body) {
  return res.status(status).json(body);
}

function extractJson(text) {
  const cleaned = String(text || "").trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI 응답에서 JSON을 찾지 못했습니다.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "POST 요청만 허용됩니다." });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return send(res, 500, { error: "서버에 Gemini API 키가 설정되지 않았습니다. Vercel 환경변수를 확인해 주세요." });

    const { mimeType, fileName, fileData } = req.body || {};
    if (mimeType !== "application/pdf" || typeof fileData !== "string" || !fileData.length) {
      return send(res, 400, { error: "올바른 PDF 파일 데이터가 전달되지 않았습니다." });
    }
    if (fileData.length > Math.ceil(MAX_BYTES * 4 / 3) + 8) {
      return send(res, 413, { error: "PDF 파일이 15MB를 초과했습니다." });
    }
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(fileData) || fileData.length % 4 !== 0) {
      return send(res, 400, { error: "PDF 데이터 형식이 올바르지 않습니다." });
    }
    const pdfBuffer = Buffer.from(fileData, "base64");
    if (!pdfBuffer.length || pdfBuffer.length > MAX_BYTES || pdfBuffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
      return send(res, 400, { error: "유효한 PDF 파일이 아니거나 파일 크기 제한을 초과했습니다." });
    }

    const prompt = `
당신은 대한민국 학교생활기록부 작성을 지원하는 교육 기록 문장 작성 보조자입니다.
첨부된 PDF 평가 자료를 읽고, 자료에 명시된 사실과 평가 근거만 사용하여 생활기록부에 활용할 수 있는 문장 초안 3종을 작성하세요.

[공통 원칙]
1. 평가 자료에 없는 학생의 성격, 행동, 태도, 참여도, 성장 과정, 성취 사실을 추측하거나 만들어내지 마세요.
2. 자료에서 확인할 수 없는 내용은 언급하지 마세요. 근거가 부족하면 확인 가능한 평가 내용만 간결하게 서술하세요.
3. 평가 결과를 단순 나열하지 말고 교육적 의미가 드러나도록 자연스럽게 연결하세요.
4. 객관적이고 전문적인 교사 기록 문체를 사용하세요. 문장 종결은 '~함.', '~보임.', '~기름.' 등 기록체로 작성하세요.
5. 평가 자료에 포함된 학생 이름, 연락처 등 개인정보를 결과에 반복하지 마세요.
6. 특정 점수나 성취수준이 있다면 임의로 변경하거나 왜곡하지 마세요.
7. 세 버전은 동일한 평가 사실과 성취 수준을 유지하고, 표현의 강조점과 어조만 달리하세요.
8. 평가 자료가 읽히지 않거나 평가 근거가 전혀 없다면 사실을 만들어내지 말고, 자료 확인이 필요하다는 내용을 각 결과에 짧게 작성하세요.

[버전별 기준]
- generous: 확인된 강점과 긍정적인 측면을 먼저 제시하고, 보완점은 개선 방향 중심으로 완곡하게 표현하세요. 평가 수준을 부풀리지 마세요.
- standard: 강점과 보완점을 균형 있게 반영하고, 자료와 가장 직접적으로 일치하는 표현을 사용하세요.
- strict: 확인된 성취 수준과 보완이 필요한 부분을 상대적으로 명확하게 표현하세요. 비난하거나 낙인찍지 말고, 자료에 없는 부정적 사실을 추가하지 마세요.

[출력 조건]
- 각 버전은 생활기록부에 활용할 수 있는 완결된 문장 1~3개로 작성하세요.
- 학생을 직접 평가하는 감정적 표현, 과장, 추상적인 칭찬을 피하세요.
- 설명이나 머리말 없이 아래 JSON 객체만 출력하세요.
{
  "generous": "관대한 버전 문장",
  "standard": "기본 버전 문장",
  "strict": "엄격한 버전 문장"
}`;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`;
    const geminiResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { text: prompt + (fileName ? `\n\n업로드된 파일명(참고용): ${String(fileName).slice(0, 120)}` : "") },
            { inlineData: { mimeType: "application/pdf", data: fileData } }
          ]
        }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              generous: { type: "STRING" },
              standard: { type: "STRING" },
              strict: { type: "STRING" }
            },
            required: ["generous", "standard", "strict"]
          },
          temperature: 0.35,
          maxOutputTokens: 1800
        }
      })
    });

    if (!geminiResponse.ok) {
      const errBody = await geminiResponse.json().catch(() => ({}));
      const code = geminiResponse.status;
      if (code === 429) return send(res, 429, { error: "Gemini API 사용량 한도에 도달했습니다. 잠시 후 다시 시도해 주세요." });
      if (code === 400) return send(res, 400, { error: "Gemini가 PDF를 처리하지 못했습니다. 파일이 손상되지 않았는지 확인해 주세요." });
      if (code === 401 || code === 403) return send(res, 502, { error: "Gemini API 인증에 실패했습니다. 서버의 API 키와 사용 권한을 확인해 주세요." });
      console.error("Gemini API request failed:", code, errBody.error?.status || "unknown");
      return send(res, 502, { error: "Gemini 분석 요청에 실패했습니다. 잠시 후 다시 시도해 주세요." });
    }

    const responseData = await geminiResponse.json();
    const text = responseData.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("").trim();
    if (!text) return send(res, 502, { error: "Gemini에서 분석 결과를 반환하지 않았습니다. PDF를 확인한 뒤 다시 시도해 주세요." });

    let result;
    try { result = extractJson(text); }
    catch {
      console.error("Gemini returned an invalid structured response.");
      return send(res, 502, { error: "AI 응답 형식이 올바르지 않습니다. 다시 시도해 주세요." });
    }
    for (const key of ["generous", "standard", "strict"]) {
      if (typeof result[key] !== "string" || !result[key].trim()) {
        return send(res, 502, { error: "AI 응답에 일부 결과가 누락되었습니다. 다시 시도해 주세요." });
      }
      result[key] = result[key].trim();
    }
    res.setHeader("Cache-Control", "no-store");
    return send(res, 200, { result });
  } catch (error) {
    // Do not log request bodies, PDF contents, or secrets.
    console.error("Generate function error:", error?.message || "unknown");
    return send(res, 500, { error: "서버 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." });
  }
};
